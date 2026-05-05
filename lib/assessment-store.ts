import type postgres from "postgres";
import type { AssessmentJobSnapshot, AssessmentPlan } from "@/lib/assessment-jobs";
import type { FormulationResult } from "@/lib/mock-formulation";
import { getSql } from "@/lib/db";

export type StoredAssessmentStatus =
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

export function isUuid(value: string) {
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

export function toJsonValue(value: unknown): postgres.JSONValue {
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

export function toStoredPlan(plan: AssessmentPlan | null | undefined) {
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
      do $$
      begin
        if to_regclass('public.assessment_submissions') is not null
          and to_regclass('public.assessments') is null then
          alter table public.assessment_submissions rename to assessments;
        end if;

        if to_regclass('public.assessments') is not null then
          if exists (
            select 1 from pg_constraint
            where conrelid = 'public.assessments'::regclass
              and conname = 'assessment_submissions_pkey'
          ) and not exists (
            select 1 from pg_constraint
            where conrelid = 'public.assessments'::regclass
              and conname = 'assessments_pkey'
          ) then
            alter table public.assessments
              rename constraint assessment_submissions_pkey to assessments_pkey;
          end if;

          if exists (
            select 1 from pg_constraint
            where conrelid = 'public.assessments'::regclass
              and conname = 'assessment_submissions_plan_id_not_null'
          ) and not exists (
            select 1 from pg_constraint
            where conrelid = 'public.assessments'::regclass
              and conname = 'assessments_plan_id_not_null'
          ) then
            alter table public.assessments
              rename constraint assessment_submissions_plan_id_not_null to assessments_plan_id_not_null;
          end if;

          if exists (
            select 1 from pg_constraint
            where conrelid = 'public.assessments'::regclass
              and conname = 'assessment_submissions_locale_not_null'
          ) and not exists (
            select 1 from pg_constraint
            where conrelid = 'public.assessments'::regclass
              and conname = 'assessments_locale_not_null'
          ) then
            alter table public.assessments
              rename constraint assessment_submissions_locale_not_null to assessments_locale_not_null;
          end if;

          if exists (
            select 1 from pg_constraint
            where conrelid = 'public.assessments'::regclass
              and conname = 'assessment_submissions_status_not_null'
          ) and not exists (
            select 1 from pg_constraint
            where conrelid = 'public.assessments'::regclass
              and conname = 'assessments_status_not_null'
          ) then
            alter table public.assessments
              rename constraint assessment_submissions_status_not_null to assessments_status_not_null;
          end if;

          if exists (
            select 1 from pg_constraint
            where conrelid = 'public.assessments'::regclass
              and conname = 'assessment_submissions_answers_not_null'
          ) and not exists (
            select 1 from pg_constraint
            where conrelid = 'public.assessments'::regclass
              and conname = 'assessments_answers_not_null'
          ) then
            alter table public.assessments
              rename constraint assessment_submissions_answers_not_null to assessments_answers_not_null;
          end if;

          if exists (
            select 1 from pg_constraint
            where conrelid = 'public.assessments'::regclass
              and conname = 'assessment_submissions_answer_summary_not_null'
          ) and not exists (
            select 1 from pg_constraint
            where conrelid = 'public.assessments'::regclass
              and conname = 'assessments_answer_summary_not_null'
          ) then
            alter table public.assessments
              rename constraint assessment_submissions_answer_summary_not_null to assessments_answer_summary_not_null;
          end if;

          if exists (
            select 1 from pg_constraint
            where conrelid = 'public.assessments'::regclass
              and conname = 'assessment_submissions_captured_at_not_null'
          ) and not exists (
            select 1 from pg_constraint
            where conrelid = 'public.assessments'::regclass
              and conname = 'assessments_captured_at_not_null'
          ) then
            alter table public.assessments
              rename constraint assessment_submissions_captured_at_not_null to assessments_captured_at_not_null;
          end if;

          if exists (
            select 1 from pg_constraint
            where conrelid = 'public.assessments'::regclass
              and conname = 'assessment_submissions_updated_at_not_null'
          ) and not exists (
            select 1 from pg_constraint
            where conrelid = 'public.assessments'::regclass
              and conname = 'assessments_updated_at_not_null'
          ) then
            alter table public.assessments
              rename constraint assessment_submissions_updated_at_not_null to assessments_updated_at_not_null;
          end if;
        end if;

        if to_regclass('public.assessment_submissions_status_idx') is not null
          and to_regclass('public.assessments_status_idx') is null then
          alter index public.assessment_submissions_status_idx
            rename to assessments_status_idx;
        end if;

        if to_regclass('public.assessment_submissions_plan_idx') is not null
          and to_regclass('public.assessments_plan_idx') is null then
          alter index public.assessment_submissions_plan_idx
            rename to assessments_plan_idx;
        end if;

        if to_regclass('public.assessment_submissions_answers_gin_idx') is not null
          and to_regclass('public.assessments_answers_gin_idx') is null then
          alter index public.assessment_submissions_answers_gin_idx
            rename to assessments_answers_gin_idx;
        end if;
      end $$;
    `;

    await sql`
      create table if not exists assessments (
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
      create index if not exists assessments_status_idx
        on assessments (status, captured_at desc)
    `;
    await sql`
      create index if not exists assessments_plan_idx
        on assessments (selected_plan, captured_at desc)
    `;
    await sql`
      create index if not exists assessments_answers_gin_idx
        on assessments using gin (answers jsonb_path_ops)
    `;
  })();

  await schemaReady;
}

function fromStoredPlan(plan: unknown): AssessmentPlan {
  if (plan === "pro") {
    return "pro";
  }

  if (plan === "precision") {
    return "precision";
  }

  return "free";
}

function toSnapshotStatus(status: unknown): AssessmentJobSnapshot["status"] {
  if (status === "ready") {
    return "ready";
  }

  if (status === "preparing") {
    return "preparing";
  }

  return "queued";
}

function buildSteps(status: AssessmentJobSnapshot["status"]) {
  return [
    { id: "sent", state: "complete" },
    {
      id: "preparing",
      state: status === "ready" ? "complete" : "active"
    },
    {
      id: "ready",
      state: status === "ready" ? "complete" : "pending"
    }
  ] satisfies AssessmentJobSnapshot["steps"];
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
    insert into assessments (
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
        assessments.plan_selected_at,
        excluded.plan_selected_at
      ),
      processing_started_at = coalesce(
        assessments.processing_started_at,
        excluded.processing_started_at
      ),
      completed_at = coalesce(
        assessments.completed_at,
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
      update assessments set
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

export async function getStoredAssessmentSnapshot(planId: string) {
  const sql = getSql();

  if (!sql || !isUuid(planId)) {
    return null;
  }

  await ensureAssessmentSchema();

  const rows = await sql`
    select
      plan_id::text,
      selected_plan::text,
      status::text,
      queue_position
    from assessments
    where plan_id = ${planId}::uuid
    limit 1
  `;

  const row = rows[0];

  if (!row) {
    return null;
  }

  const status = toSnapshotStatus(row.status);
  let queuePosition = Number(row.queue_position ?? 0);

  if (status === "queued") {
    const tableCheck = await sql`
      select to_regclass('jobs') as jobs_table
    `;

    if (tableCheck[0]?.jobs_table) {
      const positions = await sql`
        with current_job as (
          select priority, queued_at
          from jobs
          where plan_id = ${planId}::uuid
            and status = 'queued'
          order by queued_at desc
          limit 1
        )
        select count(*)::int as queue_position
        from jobs
        cross join current_job
        where jobs.status = 'queued'
          and (
            jobs.priority > current_job.priority
            or (
              jobs.priority = current_job.priority
              and jobs.queued_at <= current_job.queued_at
            )
          )
      `;

      queuePosition = Number(positions[0]?.queue_position ?? queuePosition);
    }
  }

  return {
    plan: fromStoredPlan(row.selected_plan),
    planId: row.plan_id,
    queuePosition: status === "queued" ? Math.max(1, queuePosition) : 0,
    status,
    steps: buildSteps(status)
  } satisfies AssessmentJobSnapshot;
}

export async function getStoredFormulationResult(planId: string) {
  const sql = getSql();

  if (!sql || !isUuid(planId)) {
    return null;
  }

  const rows = await sql`
    select formulation
    from formulations
    where plan_id = ${planId}::uuid
    limit 1
  `;

  return (rows[0]?.formulation ?? null) as FormulationResult | null;
}
