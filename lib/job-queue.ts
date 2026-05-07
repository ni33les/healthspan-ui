import type postgres from "postgres";
import { getSql } from "@/lib/db";
import { isLocale, type Locale } from "@/lib/i18n";
import {
  normalizeAssessmentPlan,
  type AssessmentPlan
} from "@/lib/assessment-jobs";
import { analyzeFormulationWithGrok } from "@/lib/formulation-analysis";
import {
  ensureAssessmentSchema,
  isUuid,
  toJsonValue
} from "@/lib/assessment-store";

type JobType = "formulation";
type AuditLevel = "critical" | "high" | "low" | "medium";

type ClaimedJob = {
  attempts: number;
  id: string;
  job_type: JobType | string;
  plan_id: string | null;
};

const globalJobsWorker = globalThis as typeof globalThis & {
  mattanutraJobsSchemaReadyV4?: Promise<void>;
  mattanutraJobsWorker?: Promise<void>;
};

function priorityForPlan(plan: AssessmentPlan) {
  if (plan === "pro") {
    return 30;
  }

  return 20;
}

async function ensureJobsSchema(sql: postgres.Sql) {
  globalJobsWorker.mattanutraJobsSchemaReadyV4 ??= (async () => {
    await ensureAssessmentSchema();

    await sql`
      create table if not exists jobs (
        id uuid primary key,
        job_type text not null,
        plan_id uuid null references assessments(plan_id) on delete cascade,
        status text not null default 'queued' check (
          status in ('queued', 'running', 'complete', 'failed')
        ),
        priority integer not null default 0,
        attempts integer not null default 0,
        payload jsonb not null default '{}'::jsonb,
        error_message text null,
        queued_at timestamptz not null default now(),
        started_at timestamptz null,
        completed_at timestamptz null,
        failed_at timestamptz null,
        updated_at timestamptz not null default now()
      )
    `;

    await sql`
      do $$
      begin
        if to_regclass('public.assessment_formulations') is not null
          and to_regclass('public.formulations') is null then
          alter table public.assessment_formulations rename to formulations;
        end if;
      end $$;
    `;

    await sql`
      create table if not exists formulations (
        plan_id uuid not null references assessments(plan_id) on delete cascade,
        version integer not null default 1,
        formulation jsonb not null,
        model_version text null,
        generated_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        primary key (plan_id, version)
      )
    `;

    await sql`
      create table if not exists recommendations (
        plan_id uuid not null references assessments(plan_id) on delete cascade,
        version integer not null default 1,
        recommendations jsonb not null,
        generated_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        primary key (plan_id, version)
      )
    `;

    await sql`
      create table if not exists job_audit_events (
        id uuid primary key,
        job_id uuid null references jobs(id) on delete set null,
        plan_id uuid null references assessments(plan_id) on delete cascade,
        event_type text not null,
        level text not null default 'low' check (
          level in ('low', 'medium', 'high', 'critical')
        ),
        event_payload jsonb not null default '{}'::jsonb,
        created_at timestamptz not null default now()
      )
    `;

    await sql`
      alter table formulations
        add column if not exists version integer not null default 1
    `;

    await sql`
      alter table recommendations
        add column if not exists version integer not null default 1
    `;

    await sql`
      alter table job_audit_events
        add column if not exists level text not null default 'low'
    `;

    await sql`
      update job_audit_events
      set level = 'low'
      where level is null
        or level not in ('low', 'medium', 'high', 'critical')
    `;

    await sql`
      alter table job_audit_events
        alter column level set default 'low',
        alter column level set not null
    `;

    await sql`
      do $$
      begin
        if not exists (
          select 1
          from pg_constraint
          where conrelid = 'public.job_audit_events'::regclass
            and conname = 'job_audit_events_level_check'
        ) then
          alter table job_audit_events
            add constraint job_audit_events_level_check
            check (level in ('low', 'medium', 'high', 'critical'));
        end if;
      end $$;
    `;

    await sql`
      do $$
      declare
        current_pkey text;
      begin
        select conname into current_pkey
        from pg_constraint
        where conrelid = 'public.formulations'::regclass
          and contype = 'p'
        limit 1;

        if not exists (
          select 1
          from pg_constraint
          where conrelid = 'public.formulations'::regclass
            and contype = 'p'
            and pg_get_constraintdef(oid) = 'PRIMARY KEY (plan_id, version)'
        ) then
          if current_pkey is not null then
            execute format('alter table public.formulations drop constraint %I', current_pkey);
          end if;

          alter table public.formulations
            add constraint formulations_pkey primary key (plan_id, version);
        end if;

        select conname into current_pkey
        from pg_constraint
        where conrelid = 'public.recommendations'::regclass
          and contype = 'p'
        limit 1;

        if not exists (
          select 1
          from pg_constraint
          where conrelid = 'public.recommendations'::regclass
            and contype = 'p'
            and pg_get_constraintdef(oid) = 'PRIMARY KEY (plan_id, version)'
        ) then
          if current_pkey is not null then
            execute format('alter table public.recommendations drop constraint %I', current_pkey);
          end if;

          alter table public.recommendations
            add constraint recommendations_pkey primary key (plan_id, version);
        end if;
      end $$;
    `;

    await sql`
      create index if not exists jobs_queue_idx
        on jobs (status, priority desc, queued_at asc)
    `;
    await sql`
      create index if not exists jobs_plan_type_idx
        on jobs (plan_id, job_type, status)
    `;
    await sql`
      create index if not exists formulations_latest_idx
        on formulations (plan_id, version desc, generated_at desc)
    `;
    await sql`
      create index if not exists recommendations_latest_idx
        on recommendations (plan_id, version desc, generated_at desc)
    `;
    await sql`
      create index if not exists job_audit_events_plan_idx
        on job_audit_events (plan_id, created_at desc)
    `;
    await sql`
      create index if not exists job_audit_events_job_idx
        on job_audit_events (job_id, created_at desc)
    `;
  })().catch((error) => {
    globalJobsWorker.mattanutraJobsSchemaReadyV4 = undefined;
    throw error;
  });

  await globalJobsWorker.mattanutraJobsSchemaReadyV4;
}

async function auditJobEvent(
  sql: postgres.Sql,
  {
    eventPayload = {},
    eventType,
    jobId,
    level = "low",
    planId
  }: Readonly<{
    eventPayload?: Record<string, unknown>;
    eventType: string;
    jobId?: string | null;
    level?: AuditLevel;
    planId?: string | null;
  }>
) {
  try {
    await sql`
      insert into job_audit_events (
        id,
        job_id,
        plan_id,
        event_type,
        level,
        event_payload,
        created_at
      )
      values (
        ${crypto.randomUUID()}::uuid,
        ${jobId ?? null}::uuid,
        ${planId ?? null}::uuid,
        ${eventType},
        ${level},
        ${sql.json(toJsonValue(eventPayload))},
        now()
      )
    `;
  } catch (error) {
    console.warn("Unable to write job audit event", error);
  }
}

export async function enqueueFormulationJob({
  answers,
  locale,
  plan,
  planId
}: Readonly<{
  answers?: unknown;
  locale?: unknown;
  plan: AssessmentPlan;
  planId: string;
}>) {
  const sql = getSql();

  if (!sql || !isUuid(planId)) {
    return null;
  }

  await ensureJobsSchema(sql);

  const existing = await sql`
    select id::text
    from jobs
    where plan_id = ${planId}::uuid
      and job_type = 'formulation'
      and status in ('queued', 'running')
    order by queued_at desc
    limit 1
  `;

  if (existing[0]) {
    return existing[0].id as string;
  }

  const jobId = crypto.randomUUID();

  await sql`
    insert into jobs (
      id,
      job_type,
      plan_id,
      status,
      priority,
      payload,
      queued_at,
      updated_at
    )
    values (
      ${jobId}::uuid,
      'formulation',
      ${planId}::uuid,
      'queued',
      ${priorityForPlan(plan)},
      ${sql.json(toJsonValue({ answers, locale, plan }))},
      now(),
      now()
    )
  `;

  await auditJobEvent(sql, {
    eventPayload: { plan, priority: priorityForPlan(plan) },
    eventType: "job_enqueued",
    jobId,
    level: "low",
    planId
  });

  await sql`
    update assessments set
      selected_plan = ${plan},
      status = 'queued',
      queue_position = coalesce(queue_position, 1),
      error_message = null,
      plan_selected_at = coalesce(plan_selected_at, now()),
      updated_at = now()
    where plan_id = ${planId}::uuid
  `;

  return jobId;
}

async function claimNextJob(sql: postgres.Sql) {
  return sql.begin(async (transaction) => {
    const rows = await transaction<ClaimedJob[]>`
      update jobs set
        status = 'running',
        attempts = attempts + 1,
        started_at = coalesce(started_at, now()),
        updated_at = now()
      where id = (
        select id
        from jobs
        where status = 'queued'
        order by priority desc, queued_at asc
        for update skip locked
        limit 1
      )
      returning id::text, job_type, plan_id::text, attempts
    `;

    const job = rows[0] ?? null;

    if (job?.plan_id) {
      await transaction`
      update assessments set
        status = 'preparing',
        queue_position = 0,
        error_message = null,
        processing_started_at = coalesce(processing_started_at, now()),
        updated_at = now()
      where plan_id = ${job.plan_id}::uuid
      `;
    }

    return job;
  });
}

async function failJob(
  sql: postgres.Sql,
  job: ClaimedJob,
  error: unknown
) {
  const message = error instanceof Error ? error.message : "Unknown job error";

  await sql.begin(async (transaction) => {
    await transaction`
      update jobs set
        status = 'failed',
        error_message = ${message},
        failed_at = now(),
        updated_at = now()
      where id = ${job.id}::uuid
    `;

    if (job.plan_id) {
      await transaction`
        update assessments set
          status = 'failed',
          error_message = ${message},
          updated_at = now()
        where plan_id = ${job.plan_id}::uuid
      `;
    }
  });

  await auditJobEvent(sql, {
    eventPayload: { error: message },
    eventType: "job_failed",
    jobId: job.id,
    level: "critical",
    planId: job.plan_id
  });
}

async function completeFormulationJob(sql: postgres.Sql, job: ClaimedJob) {
  if (!job.plan_id) {
    throw new Error("Formulation job is missing plan_id");
  }

  const submissions = await sql`
    select
      answers,
      locale,
      selected_plan::text
    from assessments
    where plan_id = ${job.plan_id}::uuid
    limit 1
  `;
  const submission = submissions[0];

  if (!submission) {
    throw new Error("Assessment submission not found");
  }

  const locale: Locale = isLocale(submission.locale)
    ? submission.locale
    : "en";
  const plan = normalizeAssessmentPlan(submission.selected_plan);

  await auditJobEvent(sql, {
    eventType: "formulation_analysis_started",
    jobId: job.id,
    level: "medium",
    planId: job.plan_id
  });

  const analysis = await analyzeFormulationWithGrok({
    answers: submission.answers,
    audit: async ({ eventType, level, payload }) =>
      auditJobEvent(sql, {
        eventPayload: payload,
        eventType,
        jobId: job.id,
        level,
        planId: job.plan_id
      }),
    locale,
    plan,
    planId: job.plan_id
  });

  await sql.begin(async (transaction) => {
    const versionRows = await transaction<{ version: number }[]>`
      select greatest(
        (
          select coalesce(max(version), 0)
          from formulations
          where plan_id = ${job.plan_id}::uuid
        ),
        (
          select coalesce(max(version), 0)
          from recommendations
          where plan_id = ${job.plan_id}::uuid
        )
      ) + 1 as version
    `;
    const version = Number(versionRows[0]?.version ?? 1);

    await transaction`
      insert into formulations (
        plan_id,
        version,
        formulation,
        model_version,
        generated_at,
        updated_at
      )
      values (
        ${job.plan_id}::uuid,
        ${version},
        ${transaction.json(toJsonValue(analysis.formulation))},
        ${`xai:${analysis.model}:${analysis.promptVersion}`},
        now(),
        now()
      )
    `;

    await transaction`
      insert into recommendations (
        plan_id,
        version,
        recommendations,
        generated_at,
        updated_at
      )
      values (
        ${job.plan_id}::uuid,
        ${version},
        ${transaction.json(toJsonValue([]))},
        now(),
        now()
      )
    `;

    await transaction`
      update assessments set
        status = 'ready',
        queue_position = 0,
        error_message = null,
        completed_at = coalesce(completed_at, now()),
        updated_at = now()
      where plan_id = ${job.plan_id}::uuid
    `;

    await transaction`
      update jobs set
        status = 'complete',
        completed_at = now(),
        updated_at = now()
      where id = ${job.id}::uuid
    `;

    await transaction`
      insert into job_audit_events (
        id,
        job_id,
        plan_id,
        event_type,
        level,
        event_payload,
        created_at
      )
      values (
        ${crypto.randomUUID()}::uuid,
        ${job.id}::uuid,
        ${job.plan_id}::uuid,
        'formulation_version_written',
        'medium',
        ${transaction.json(
          toJsonValue({
            attempts: analysis.attempts,
            formulationVersion: version,
            model: analysis.model,
            promptVersion: analysis.promptVersion,
            recommendationVersion: version,
            responseId: analysis.responseId
          })
        )},
        now()
      )
    `;
  });

  await auditJobEvent(sql, {
    eventPayload: {
      attempts: analysis.attempts,
      model: analysis.model,
      promptVersion: analysis.promptVersion
    },
    eventType: "job_completed",
    jobId: job.id,
    level: "medium",
    planId: job.plan_id
  });
}

async function processJob(sql: postgres.Sql, job: ClaimedJob) {
  if (job.job_type === "formulation") {
    await completeFormulationJob(sql, job);
    return;
  }

  throw new Error(`Unsupported job type: ${job.job_type}`);
}

async function runJobsWorker() {
  const sql = getSql();

  if (!sql) {
    return;
  }

  await ensureJobsSchema(sql);
  await auditJobEvent(sql, {
    eventType: "worker_started",
    level: "low"
  });

  while (true) {
    const job = await claimNextJob(sql);

    if (!job) {
      await auditJobEvent(sql, {
        eventType: "worker_idle",
        level: "low"
      });
      return;
    }

    await auditJobEvent(sql, {
      eventPayload: { attempts: job.attempts, jobType: job.job_type },
      eventType: "job_picked_up",
      jobId: job.id,
      level: "low",
      planId: job.plan_id
    });

    try {
      await processJob(sql, job);
    } catch (error) {
      await failJob(sql, job, error);
    }
  }
}

export function kickJobsWorker() {
  if (globalJobsWorker.mattanutraJobsWorker) {
    return globalJobsWorker.mattanutraJobsWorker;
  }

  globalJobsWorker.mattanutraJobsWorker = runJobsWorker().finally(() => {
    globalJobsWorker.mattanutraJobsWorker = undefined;
  });

  return globalJobsWorker.mattanutraJobsWorker;
}
