import type postgres from "postgres";
import type { AssessmentJobSnapshot, AssessmentPlan } from "@/lib/assessment-jobs";
import { getSql } from "@/lib/db";

type StoredAssessmentStatus =
  | "captured"
  | "failed"
  | "plan_selected"
  | "preparing"
  | "queued"
  | "ready";

type PersistAssessmentInput = Readonly<{
  answers?: unknown;
  locale?: unknown;
  selectedPlan?: AssessmentPlan | null;
  snapshot: AssessmentJobSnapshot;
  status: StoredAssessmentStatus;
}>;

type PersistPlanSelectionInput = PersistAssessmentInput &
  Readonly<{
    previousPlanId: string;
  }>;

let schemaReady: Promise<void> | null = null;

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-9a-f][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function normalizeLocale(locale: unknown) {
  return locale === "th" ? "th" : "en";
}

function toJsonRecord(value: unknown) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}

function toJsonValue(value: unknown): postgres.JSONValue {
  if (value === undefined) {
    return {};
  }

  const serialized = JSON.stringify(value);

  if (serialized === undefined) {
    return {};
  }

  return JSON.parse(serialized) as postgres.JSONValue;
}

function scalarOrNull(value: unknown) {
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  return null;
}

function buildAnswerSummary(answers: unknown) {
  const record = toJsonRecord(answers);

  return {
    age: scalarOrNull(record.age),
    budget: scalarOrNull(record.budget),
    country: scalarOrNull(record.country),
    goals: Array.isArray(record.goals) ? record.goals : [],
    medications: scalarOrNull(record.meds),
    pills: scalarOrNull(record.pills),
    sex: scalarOrNull(record.sex),
    symptoms: Array.isArray(record.symptoms) ? record.symptoms : []
  };
}

function toStoredPlan(plan: AssessmentPlan | null | undefined) {
  if (plan === "pro") {
    return "pro";
  }

  if (plan === "precision") {
    return "precision";
  }

  return null;
}

async function ensureAssessmentSchema() {
  const sql = getSql();

  if (!sql) {
    return;
  }

  schemaReady ??= (async () => {
    await sql`
      create table if not exists assessment_submissions (
        plan_id uuid primary key,
        locale text not null default 'en' check (locale in ('en', 'th')),
        selected_plan assessment_plan null,
        status assessment_status not null default 'captured',
        answers jsonb not null default '{}'::jsonb,
        answer_summary jsonb not null default '{}'::jsonb,
        queue_position integer null,
        captured_at timestamptz not null default now(),
        plan_selected_at timestamptz null,
        processing_started_at timestamptz null,
        completed_at timestamptz null,
        updated_at timestamptz not null default now()
      )
    `;

    await sql`
      create index if not exists assessment_submissions_status_idx
        on assessment_submissions (status, captured_at desc)
    `;
    await sql`
      create index if not exists assessment_submissions_plan_idx
        on assessment_submissions (selected_plan, captured_at desc)
    `;
    await sql`
      create index if not exists assessment_submissions_answers_gin_idx
        on assessment_submissions using gin (answers jsonb_path_ops)
    `;
  })();

  await schemaReady;
}

export async function persistAssessmentSubmission({
  answers,
  locale,
  selectedPlan,
  snapshot,
  status
}: PersistAssessmentInput) {
  const sql = getSql();

  if (!sql || !isUuid(snapshot.planId)) {
    return;
  }

  await ensureAssessmentSchema();

  await sql`
    insert into assessment_submissions (
      plan_id,
      locale,
      selected_plan,
      status,
      answers,
      answer_summary,
      queue_position,
      plan_selected_at,
      processing_started_at,
      completed_at,
      updated_at
    )
    values (
      ${snapshot.planId}::uuid,
      ${normalizeLocale(locale)},
      ${toStoredPlan(selectedPlan)},
      ${status},
      ${sql.json(toJsonValue(answers))},
      ${sql.json(toJsonValue(buildAnswerSummary(answers)))},
      ${snapshot.queuePosition},
      ${selectedPlan ? sql`now()` : null},
      ${status === "queued" || status === "preparing" || status === "ready"
        ? sql`now()`
        : null},
      ${status === "ready" ? sql`now()` : null},
      now()
    )
    on conflict (plan_id) do update set
      locale = excluded.locale,
      selected_plan = excluded.selected_plan,
      status = excluded.status,
      answers = excluded.answers,
      answer_summary = excluded.answer_summary,
      queue_position = excluded.queue_position,
      plan_selected_at = coalesce(
        assessment_submissions.plan_selected_at,
        excluded.plan_selected_at
      ),
      processing_started_at = coalesce(
        assessment_submissions.processing_started_at,
        excluded.processing_started_at
      ),
      completed_at = coalesce(
        assessment_submissions.completed_at,
        excluded.completed_at
      ),
      updated_at = now()
  `;
}

export async function persistAssessmentPlanSelection({
  answers,
  locale,
  previousPlanId,
  selectedPlan,
  snapshot,
  status
}: PersistPlanSelectionInput) {
  const sql = getSql();

  if (!sql || !isUuid(snapshot.planId)) {
    return;
  }

  await ensureAssessmentSchema();

  if (isUuid(previousPlanId)) {
    const updated = await sql`
      update assessment_submissions set
        plan_id = ${snapshot.planId}::uuid,
        locale = ${normalizeLocale(locale)},
        selected_plan = ${toStoredPlan(selectedPlan ?? snapshot.plan)},
        status = ${status},
        answers = ${sql.json(toJsonValue(answers))},
        answer_summary = ${sql.json(toJsonValue(buildAnswerSummary(answers)))},
        queue_position = ${snapshot.queuePosition},
        plan_selected_at = coalesce(plan_selected_at, now()),
        processing_started_at = coalesce(processing_started_at, now()),
        completed_at = case
          when ${status} = 'ready' then coalesce(completed_at, now())
          else completed_at
        end,
        updated_at = now()
      where plan_id = ${previousPlanId}::uuid
      returning plan_id
    `;

    if (updated.length > 0) {
      return;
    }
  }

  await persistAssessmentSubmission({
    answers,
    locale,
    selectedPlan: selectedPlan ?? snapshot.plan,
    snapshot,
    status
  });
}
