import type postgres from "postgres";
import { createHash } from "node:crypto";
import {
  buildExampleEmailHtml,
  buildExampleEmailSubject
} from "@/lib/example-email";
import {
  normalizeAssessmentPlan,
  type AssessmentPlan
} from "@/lib/assessment-snapshot";
import { isUuid, toJsonValue } from "@/lib/assessment-store";
import { writeBpmEvent } from "@/lib/bpm";
import {
  dispatchQueuedCommunicationMessages,
  sendClientSafetyFollowupTask
} from "@/lib/communications";
import { getSql } from "@/lib/db";
import { validateLeadEmail } from "@/lib/email-validation";
import { analyzeFormulationWithGrok } from "@/lib/formulation-analysis";
import { applyFormulationSafety } from "@/lib/formulation-safety";
import type { FormulationBlueprint } from "@/lib/formulation-types";
import type { HealthScoreResult } from "@/lib/health-score";
import { analyzeHealthScoreAdvice } from "@/lib/health-score-analysis";
import { isLocale, type Locale } from "@/lib/i18n";
import {
  buildReassessmentEmailHtml,
  buildReassessmentEmailSubject
} from "@/lib/reassessment-email";
import { sendTransactionalEmail } from "@/lib/smtp-email";
import {
  addTaskEvent,
  completeTask,
  createGoal,
  createTask,
  failTask,
  reserveNextTask,
  type ReservedTask,
  type TaskRecord
} from "@/lib/task-service";

type AuditLevel = "critical" | "high" | "low" | "medium";
type StepState = "active" | "complete" | "failed" | "pending";
type WorkTaskType =
  | "analyze_healthscore"
  | "generate_example_formulation"
  | "generate_formulation"
  | "send_example_email"
  | "send_reassessment_email";

const globalWorker = globalThis as typeof globalThis & {
  mattanutraCronWorker?: Promise<{ queued: number }>;
  mattanutraTaskWorker?: Promise<void>;
};

const TASK_PRIORITIES = {
  exampleEmail: 3,
  exampleFormulation: 5,
  healthScoreAnalysis: 5,
  precision: 5,
  pro: 6,
  reassessment: 3
} as const;
const INTERNAL_WORKER_CAPABILITY = "mattanutra_internal_worker";
const COMMUNICATION_WORKER_CAPABILITY = "client_safety_followup";
const COMMUNICATION_DISPATCH_BATCH_SIZE = 10;
const INTERNAL_WORK_TASK_TYPES: WorkTaskType[] = [
  "analyze_healthscore",
  "generate_example_formulation",
  "generate_formulation",
  "send_example_email",
  "send_reassessment_email"
];
const COMMUNICATION_WORKER_TASK_TYPES = ["client_safety_followup"] as const;

function priorityForPlan(plan: AssessmentPlan) {
  return plan === "pro" ? TASK_PRIORITIES.pro : TASK_PRIORITIES.precision;
}

function deterministicUuid(seed: string) {
  const bytes = Buffer.from(
    createHash("sha256").update(seed).digest().subarray(0, 16)
  );

  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = bytes.toString("hex");

  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20)
  ].join("-");
}

function payloadRecord(payload: unknown) {
  return payload && typeof payload === "object" && !Array.isArray(payload)
    ? (payload as Record<string, unknown>)
    : {};
}

function payloadText(payload: unknown, key: string) {
  const value = payloadRecord(payload)[key];

  return typeof value === "string" ? value : "";
}

function newUnsubscribeToken() {
  return crypto.randomUUID();
}

function hasHealthScoreAdvice(value: unknown) {
  const advice = payloadRecord(payloadRecord(value).advice);
  const overview = advice.overview;

  return (
    Boolean(overview && typeof overview === "object") ||
    Array.isArray(advice.paywallFeatures)
  );
}

async function addWorkEvent(
  task: Pick<TaskRecord, "goalId" | "id" | "planId">,
  eventType: string,
  level: AuditLevel = "low",
  eventPayload: Record<string, unknown> = {}
) {
  await addTaskEvent({
    eventPayload,
    eventStatus: level === "critical" || level === "high" ? "observed" : "succeeded",
    eventType,
    goalId: task.goalId,
    severity: level,
    taskId: task.id
  });
}

async function createWorkTask(input: Readonly<{
  actorType: "ai" | "deterministic";
  description?: string;
  goalId: string;
  goalTitle: string;
  idempotencyKey: string;
  maxAttempts?: number;
  payload?: Record<string, unknown>;
  planId?: string | null;
  priority: number;
  reasoningEffort: "medium" | "none";
  source: string;
  taskTitle: string;
  taskType: WorkTaskType;
}>) {
  const sql = getSql();

  if (!sql) {
    return null;
  }

  const goal = await createGoal({
    context: {
      source: input.source,
      taskType: input.taskType,
      ...(input.payload ?? {})
    },
    id: input.goalId,
    planId: input.planId,
    priority: input.priority,
    source: input.source,
    title: input.goalTitle,
    type: "goal"
  });
  const { task } = await createTask({
    actorType: input.actorType,
    description: input.description,
    goalId: goal.id,
    idempotencyKey: input.idempotencyKey,
    initialComment: {
      authorName: "MattaNutra worker",
      authorType: "system",
      body: `${input.taskTitle} queued for task-backed processing.`,
      commentType: "instruction",
      metadata: {
        source: input.source,
        taskType: input.taskType
      },
      visibility: "worker"
    },
    maxAttempts: input.maxAttempts ?? 3,
    payload: {
      planId: input.planId,
      source: input.source,
      ...input.payload
    },
    planId: input.planId,
    priority: input.priority,
    reasoningEffort: input.reasoningEffort,
    requiredCapabilities: [INTERNAL_WORKER_CAPABILITY],
    taskType: input.taskType,
    title: input.taskTitle
  });

  await sql`
    update public.goals
    set
      status = case when status = 'completed' then 'open' else status end,
      completed_at = case when status = 'completed' then null else completed_at end,
      updated_at = now()
    where id = ${goal.id}::uuid
  `;

  return task.id;
}

export async function enqueueHealthScoreAnalysisTask({
  planId
}: Readonly<{
  planId: string;
}>) {
  const sql = getSql();

  if (!sql || !isUuid(planId)) {
    return null;
  }

  const rows = await sql`
    select health_score
    from public.assessments
    where plan_id = ${planId}::uuid
    limit 1
  `;

  if (!rows[0] || hasHealthScoreAdvice(rows[0].health_score)) {
    return null;
  }

  return createWorkTask({
    actorType: "ai",
    goalId: deterministicUuid(`mattanutra:goal:healthscore:${planId}`),
    goalTitle: "Analyze HealthScore",
    idempotencyKey: `healthscore-analysis:${planId}`,
    payload: {},
    planId,
    priority: TASK_PRIORITIES.healthScoreAnalysis,
    reasoningEffort: "medium",
    source: "assessment",
    taskTitle: "Analyze HealthScore",
    taskType: "analyze_healthscore"
  });
}

export async function enqueueFormulationTask({
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

  const assessmentRows = await sql`
    select plan_id
    from public.assessments
    where plan_id = ${planId}::uuid
    limit 1
  `;

  if (!assessmentRows[0]) {
    return null;
  }

  const taskId = await createWorkTask({
    actorType: "ai",
    goalId: deterministicUuid(`mattanutra:goal:formulation:${planId}`),
    goalTitle:
      plan === "pro"
        ? "Prepare Pro nutrition plan"
        : "Prepare Precision nutrition plan",
    idempotencyKey: `formulation:${planId}`,
    payload: { answers, locale, plan },
    planId,
    priority: priorityForPlan(plan),
    reasoningEffort: "medium",
    source: "assessment",
    taskTitle: "Generate nutrition plan",
    taskType: "generate_formulation"
  });

  if (!taskId) {
    return null;
  }

  await sql`
    update public.assessments set
      selected_plan = ${plan},
      status = 'queued',
      queue_position = coalesce(queue_position, 1),
      error_message = null,
      plan_selected_at = coalesce(plan_selected_at, now()),
      updated_at = now()
    where plan_id = ${planId}::uuid
  `;

  return taskId;
}

async function enqueueExampleFormulationTask(
  planId: string,
  requestId: string
) {
  const sql = getSql();

  if (!sql) {
    return null;
  }

  const taskId = await createWorkTask({
    actorType: "ai",
    goalId: deterministicUuid(`mattanutra:goal:free-example:${requestId}`),
    goalTitle: "Prepare Free nutrition plan email",
    idempotencyKey: `example-formulation:${requestId}`,
    payload: { priorityClass: "free_example", requestId },
    planId,
    priority: TASK_PRIORITIES.exampleFormulation,
    reasoningEffort: "medium",
    source: "free_example",
    taskTitle: "Generate Free nutrition plan",
    taskType: "generate_example_formulation"
  });

  if (taskId) {
    await sql`
      update public.assessment_example_requests set
        status = 'formulation_queued',
        updated_at = now()
      where id = ${requestId}::uuid
    `;
  }

  return taskId;
}

async function enqueueExampleEmailTask(planId: string, requestId: string) {
  const sql = getSql();

  if (!sql) {
    return null;
  }

  const taskId = await createWorkTask({
    actorType: "deterministic",
    goalId: deterministicUuid(`mattanutra:goal:free-example:${requestId}`),
    goalTitle: "Prepare Free nutrition plan email",
    idempotencyKey: `example-email:${requestId}`,
    maxAttempts: 2,
    payload: { priorityClass: "free_example", requestId },
    planId,
    priority: TASK_PRIORITIES.exampleEmail,
    reasoningEffort: "none",
    source: "free_example",
    taskTitle: "Send Free nutrition plan email",
    taskType: "send_example_email"
  });

  if (taskId) {
    await sql`
      update public.assessment_example_requests set
        status = 'email_queued',
        updated_at = now()
      where id = ${requestId}::uuid
    `;
  }

  return taskId;
}

export async function requestExampleBrief({
  email,
  locale,
  planId
}: Readonly<{
  email: string;
  locale?: unknown;
  planId: string;
}>) {
  const sql = getSql();

  if (!sql || !isUuid(planId)) {
    return null;
  }

  const emailValidation = validateLeadEmail(email);

  if (!emailValidation.ok) {
    return null;
  }

  const assessmentRows = await sql`
    select health_score
    from public.assessments
    where plan_id = ${planId}::uuid
    limit 1
  `;

  if (!assessmentRows[0]) {
    return null;
  }

  const existingRequests = await sql<{
    id: string;
    status: string;
    task_id: string | null;
  }[]>`
    select
      assessment_example_requests.id::text,
      assessment_example_requests.status,
      (
        select tasks.id::text
        from public.tasks
        where tasks.plan_id = assessment_example_requests.plan_id
          and tasks.payload ->> 'requestId' = assessment_example_requests.id::text
          and tasks.task_type in ('generate_example_formulation', 'send_example_email')
          and tasks.status not in ('completed', 'failed', 'cancelled', 'skipped')
        order by tasks.created_at desc
        limit 1
      ) as task_id
    from public.assessment_example_requests
    where plan_id = ${planId}::uuid
      and lower(email) = ${emailValidation.email}
    order by requested_at desc
    limit 1
  `;
  const existingRequest = existingRequests[0];

  if (existingRequest && existingRequest.status !== "failed") {
    return {
      requestId: existingRequest.id,
      taskId: existingRequest.task_id ?? ""
    };
  }

  const requestId = crypto.randomUUID();
  const normalizedLocale: Locale = isLocale(locale) ? locale : "en";

  await sql`
    insert into public.assessment_example_requests (
      id,
      plan_id,
      email,
      locale,
      status,
      health_score,
      requested_at,
      updated_at
    )
    values (
      ${requestId}::uuid,
      ${planId}::uuid,
      ${emailValidation.email},
      ${normalizedLocale},
      'requested',
      ${sql.json(toJsonValue(assessmentRows[0].health_score))},
      now(),
      now()
    )
  `;

  const taskId = await enqueueExampleFormulationTask(planId, requestId);

  return { requestId, taskId };
}

function mapExampleRequestStatus(status: unknown) {
  if (status === "failed") {
    return "failed";
  }

  if (
    status === "formulation_queued" ||
    status === "formulation_ready" ||
    status === "email_queued" ||
    status === "email_rendered" ||
    status === "email_sent"
  ) {
    return "ready";
  }

  return "preparing";
}

function buildExampleRequestSteps(status: unknown) {
  const mappedStatus = mapExampleRequestStatus(status);
  const isReady = mappedStatus === "ready";
  const isRequestQueued = status === "formulation_queued";
  const hasFailed = mappedStatus === "failed";
  const formulationState: StepState = isReady
    ? "complete"
    : hasFailed
      ? "failed"
      : "active";

  return [
    { id: "assessment", state: "complete" },
    { id: "score", state: "complete" },
    { id: "scoreAnalysis", state: "complete" },
    { id: "payment", state: "complete" },
    { id: "formulation", state: formulationState },
    {
      id: "safety",
      state: isReady && !isRequestQueued ? "complete" : "pending"
    },
    {
      id: "results",
      state: isReady && !isRequestQueued ? "complete" : "pending"
    }
  ];
}

export async function getExampleBriefStatus({
  planId,
  requestId
}: Readonly<{
  planId: string;
  requestId: string;
}>) {
  const sql = getSql();

  if (!sql || !isUuid(planId) || !isUuid(requestId)) {
    return null;
  }

  const rows = await sql<{
    error_message: string | null;
    status: string;
  }[]>`
    select status, error_message
    from public.assessment_example_requests
    where plan_id = ${planId}::uuid
      and id = ${requestId}::uuid
    limit 1
  `;
  const row = rows[0];

  if (!row) {
    return null;
  }

  return {
    ...(row.error_message ? { errorMessage: row.error_message } : {}),
    planId,
    queuePosition: 0,
    requestId,
    status: mapExampleRequestStatus(row.status),
    steps: buildExampleRequestSteps(row.status)
  };
}

export async function scheduleReassessmentAction({
  email,
  locale,
  planId
}: Readonly<{
  email: string;
  locale?: unknown;
  planId: string;
}>) {
  const sql = getSql();

  if (!sql || !isUuid(planId)) {
    return null;
  }

  const emailValidation = validateLeadEmail(email);

  if (!emailValidation.ok) {
    return null;
  }

  const normalizedLocale: Locale = isLocale(locale) ? locale : "en";
  const existing = await sql<
    Array<{
      id: string;
      plan_id: string | null;
      unsubscribe_token: string | null;
    }>
  >`
    select id::text,
      plan_id::text,
      unsubscribe_token
    from public.cron
    where action_type = 'reassessment'
      and status in ('scheduled', 'queued')
      and lower(recipient ->> 'email') = ${emailValidation.email}
    order by
      (plan_id = ${planId}::uuid) desc,
      scheduled_for desc,
      created_at desc
  `;
  const existingPrimary = existing[0];

  if (existingPrimary) {
    const unsubscribeToken =
      existingPrimary.unsubscribe_token || newUnsubscribeToken();

    await sql`
      update public.cron set
        plan_id = ${planId}::uuid,
        recipient = ${sql.json(toJsonValue({ email: emailValidation.email }))},
        payload = ${sql.json(toJsonValue({ locale: normalizedLocale }))},
        recurrence_days = 60,
        unsubscribe_token = ${unsubscribeToken},
        unsubscribed_at = null,
        scheduled_for = now() + interval '60 days',
        status = 'scheduled',
        error_message = null,
        updated_at = now()
      where id = ${existingPrimary.id}::uuid
    `;

    for (const duplicate of existing.slice(1)) {
      await sql`
        update public.cron set
          status = 'cancelled',
          result_payload = ${sql.json(
            toJsonValue({
              cancelledReason: "duplicate_reassessment_email",
              duplicateOf: existingPrimary.id,
              email: emailValidation.email
            })
          )},
          updated_at = now()
        where id = ${duplicate.id}::uuid
      `;
    }

    return existingPrimary.id;
  }

  const cronId = crypto.randomUUID();
  const unsubscribeToken = newUnsubscribeToken();

  await sql`
    insert into public.cron (
      id,
      plan_id,
      action_type,
      recipient,
      payload,
      scheduled_for,
      recurrence_days,
      unsubscribe_token,
      status,
      created_at,
      updated_at
    )
    values (
      ${cronId}::uuid,
      ${planId}::uuid,
      'reassessment',
      ${sql.json(toJsonValue({ email: emailValidation.email }))},
      ${sql.json(toJsonValue({ locale: normalizedLocale }))},
      now() + interval '60 days',
      60,
      ${unsubscribeToken},
      'scheduled',
      now(),
      now()
    )
  `;

  return cronId;
}

export async function cancelReassessmentActionByToken(token: string) {
  const sql = getSql();
  const normalizedToken = token.trim();

  if (!sql || !isUuid(normalizedToken)) {
    return { cancelled: false, reason: "invalid_token" as const };
  }

  const rows = await sql<
    Array<{
      id: string;
      plan_id: string | null;
      status: string;
    }>
  >`
    select id::text, plan_id::text, status
    from public.cron
    where action_type = 'reassessment'
      and unsubscribe_token = ${normalizedToken}
    order by created_at desc
    limit 1
  `;
  const row = rows[0];

  if (!row) {
    return { cancelled: false, reason: "not_found" as const };
  }

  if (row.status === "cancelled") {
    return {
      cancelled: false,
      planId: row.plan_id,
      reason: "already_cancelled" as const
    };
  }

  const cancelled = await sql.begin(async (transaction) => {
    const updated = await transaction<Array<{ id: string }>>`
      update public.cron set
        status = 'cancelled',
        unsubscribed_at = now(),
        result_payload = coalesce(result_payload, '{}'::jsonb) || ${transaction.json(
          toJsonValue({
            cancelledReason: "email_unsubscribe",
            unsubscribedAt: new Date().toISOString()
          })
        )}::jsonb,
        updated_at = now()
      where id = ${row.id}::uuid
        and status in ('scheduled', 'queued')
      returning id::text
    `;

    await transaction`
      update public.tasks set
        status = 'cancelled',
        updated_at = now()
      where task_type = 'send_reassessment_email'
        and status in ('queued', 'reserved', 'running')
        and payload ->> 'cronId' = ${row.id}
    `;

    return updated.length > 0;
  });

  await writeBpmEvent({
    actorType: "system",
    cronId: row.id,
    eventName: "reassessment_unsubscribed",
    eventType: "reassessment",
    planId: row.plan_id,
    properties: {
      status: cancelled ? "cancelled" : row.status
    },
    severity: "medium"
  });

  return {
    cancelled,
    planId: row.plan_id,
    reason: cancelled ? ("cancelled" as const) : ("not_active" as const)
  };
}

async function enqueueReassessmentEmailTask({
  cronId,
  email,
  locale,
  planId
}: Readonly<{
  cronId: string;
  email: string;
  locale: Locale;
  planId: string;
}>) {
  const taskId = await createWorkTask({
    actorType: "deterministic",
    goalId: deterministicUuid(`mattanutra:goal:reassessment:${cronId}`),
    goalTitle: "Send 60-day reassessment invite",
    idempotencyKey: `reassessment:${cronId}`,
    maxAttempts: 2,
    payload: { cronId, email, locale },
    planId,
    priority: TASK_PRIORITIES.reassessment,
    reasoningEffort: "none",
    source: "cron",
    taskTitle: "Send reassessment email",
    taskType: "send_reassessment_email"
  });
  const sql = getSql();

  if (taskId && sql) {
    await sql`
      update public.cron set
        status = 'queued',
        queued_at = now(),
        updated_at = now()
      where id = ${cronId}::uuid
    `;
  }

  return taskId;
}

async function claimDueCronActions(sql: postgres.Sql) {
  return sql.begin(async (transaction) => {
    const rows = await transaction<
      Array<{
        id: string;
        plan_id: string | null;
        recipient: unknown;
        payload: unknown;
      }>
    >`
      update public.cron set
        status = 'queued',
        attempts = attempts + 1,
        updated_at = now()
      where id in (
        select id
        from public.cron
        where scheduled_for <= now()
          and (
            status = 'scheduled'
            or (
              status = 'queued'
              and updated_at < now() - interval '10 minutes'
            )
          )
        order by scheduled_for asc
        for update skip locked
        limit 25
      )
      returning id::text, plan_id::text, recipient, payload
    `;

    return rows;
  });
}

async function runCronWorker() {
  const sql = getSql();

  if (!sql) {
    return { queued: 0 };
  }

  const dueActions = await claimDueCronActions(sql);
  let queued = 0;

  for (const action of dueActions) {
    const planId = action.plan_id ?? "";
    const recipient = payloadRecord(action.recipient);
    const payload = payloadRecord(action.payload);
    const email = typeof recipient.email === "string" ? recipient.email : "";
    const locale: Locale = isLocale(payload.locale) ? payload.locale : "en";

    try {
      if (!isUuid(action.id) || !isUuid(planId)) {
        throw new Error("Scheduled reassessment action is missing identifiers");
      }

      const emailValidation = validateLeadEmail(email);

      if (!emailValidation.ok) {
        throw new Error("Scheduled reassessment action is missing a valid email");
      }

      await enqueueReassessmentEmailTask({
        cronId: action.id,
        email: emailValidation.email,
        locale,
        planId
      });
      queued += 1;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown cron worker error";

      await sql`
        update public.cron set
          status = 'failed',
          error_message = ${message},
          updated_at = now()
        where id = ${action.id}::uuid
      `;
      await writeBpmEvent({
        actorType: "system",
        cronId: action.id,
        errorMessage: message,
        eventName: "cron_action_failed",
        eventType: "error",
        planId: isUuid(planId) ? planId : null,
        severity: "high"
      });
    }
  }

  if (queued > 0) {
    void kickTaskWorker();
  }

  return { queued };
}

async function markAssessmentPreparing(sql: postgres.Sql, planId: string) {
  await sql`
    update public.assessments set
      status = 'preparing',
      queue_position = 0,
      error_message = null,
      processing_started_at = coalesce(processing_started_at, now()),
      updated_at = now()
    where plan_id = ${planId}::uuid
  `;
}

async function completeHealthScoreAnalysisTask(
  sql: postgres.Sql,
  task: TaskRecord
) {
  const planId = task.planId;

  if (!planId) {
    throw new Error("HealthScore analysis task is missing plan_id");
  }

  const rows = await sql`
    select answers, health_score, locale
    from public.assessments
    where plan_id = ${planId}::uuid
    limit 1
  `;
  const row = rows[0];

  if (!row) {
    throw new Error("Assessment submission not found");
  }

  const healthScore = payloadRecord(row.health_score);

  if (typeof healthScore.score !== "number") {
    throw new Error("Assessment is missing a backend HealthScore");
  }

  const locale: Locale = isLocale(row.locale) ? row.locale : "en";
  const baseHealthScore = healthScore as HealthScoreResult;
  const updatedHealthScore: HealthScoreResult = hasHealthScoreAdvice(healthScore)
    ? baseHealthScore
    : ({
        ...baseHealthScore,
        advice: await analyzeHealthScoreAdvice({
          answers: row.answers,
          healthScore: baseHealthScore,
          locale
        })
      } as HealthScoreResult);

  await sql`
    update public.assessments set
      health_score = ${sql.json(toJsonValue(updatedHealthScore))},
      updated_at = now()
    where plan_id = ${planId}::uuid
  `;

  await writeBpmEvent({
    actorType: "worker",
    eventName: "healthscore_analysis_completed",
    eventType: "funnel",
    locale,
    planId,
    properties: {
      cachedOrExisting: hasHealthScoreAdvice(healthScore),
      taskId: task.id
    }
  });
}

async function completeFormulationTask(sql: postgres.Sql, task: TaskRecord) {
  const planId = task.planId;

  if (!planId) {
    throw new Error("Formulation task is missing plan_id");
  }

  await markAssessmentPreparing(sql, planId);

  const submissions = await sql`
    select answers, locale, selected_plan::text
    from public.assessments
    where plan_id = ${planId}::uuid
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

  await addWorkEvent(task, "formulation_analysis_started", "medium");

  const analysis = await analyzeFormulationWithGrok({
    answers: submission.answers,
    audit: async ({ eventType, level, payload }) =>
      addWorkEvent(task, eventType, level ?? "low", payload),
    locale,
    plan,
    planId
  });
  const safeFormulation = await applyFormulationSafety(sql, {
    audit: async ({ eventType, level, payload }) =>
      addWorkEvent(task, eventType, level ?? "low", payload),
    formulation: analysis.formulation,
    locale,
    plan,
    planId,
    taskId: task.id
  });

  await sql.begin(async (transaction) => {
    const versionRows = await transaction<{ version: number }[]>`
      select greatest(
        (
          select coalesce(max(version), 0)
          from public.formulations
          where plan_id = ${planId}::uuid
        ),
        (
          select coalesce(max(version), 0)
          from public.recommendations
          where plan_id = ${planId}::uuid
        )
      ) + 1 as version
    `;
    const version = Number(versionRows[0]?.version ?? 1);

    await transaction`
      insert into public.formulations (
        plan_id,
        version,
        formulation,
        model_version,
        generated_at,
        updated_at
      )
      values (
        ${planId}::uuid,
        ${version},
        ${transaction.json(toJsonValue(safeFormulation))},
        ${`xai:${analysis.model}:${analysis.reasoningEffort}:${analysis.promptVersion}`},
        now(),
        now()
      )
    `;

    await transaction`
      insert into public.recommendations (
        plan_id,
        version,
        recommendations,
        generated_at,
        updated_at
      )
      values (
        ${planId}::uuid,
        ${version},
        ${transaction.json(toJsonValue([]))},
        now(),
        now()
      )
    `;

    await transaction`
      update public.assessments set
        status = 'ready',
        queue_position = 0,
        error_message = null,
        completed_at = coalesce(completed_at, now()),
        updated_at = now()
      where plan_id = ${planId}::uuid
    `;
  });

  await addWorkEvent(task, "formulation_version_written", "medium", {
    attempts: analysis.attempts,
    model: analysis.model,
    promptVersion: analysis.promptVersion,
    reasoningEffort: analysis.reasoningEffort,
    responseId: analysis.responseId,
    safetySummary: safeFormulation.safetySummary
  });
  await writeBpmEvent({
    actorType: "worker",
    eventName: "formulation_ready",
    eventType: "formulation",
    locale,
    metrics: {
      attempts: analysis.attempts
    },
    planId,
    properties: {
      model: analysis.model,
      promptVersion: analysis.promptVersion,
      reasoningEffort: analysis.reasoningEffort,
      responseId: analysis.responseId,
      taskId: task.id
    },
    selectedPlan: plan
  });
}

async function completeExampleFormulationTask(
  sql: postgres.Sql,
  task: TaskRecord
) {
  const planId = task.planId;
  const requestId = payloadText(task.payload, "requestId");

  if (!planId) {
    throw new Error("Example formulation task is missing plan_id");
  }

  if (!isUuid(requestId)) {
    throw new Error("Example formulation task is missing requestId");
  }

  const submissions = await sql`
    select
      assessments.answers,
      assessments.locale,
      assessments.selected_plan::text
    from public.assessments
    join public.assessment_example_requests
      on assessment_example_requests.plan_id = assessments.plan_id
    where assessments.plan_id = ${planId}::uuid
      and assessment_example_requests.id = ${requestId}::uuid
    limit 1
  `;
  const submission = submissions[0];

  if (!submission) {
    throw new Error("Example request not found");
  }

  const locale: Locale = isLocale(submission.locale)
    ? submission.locale
    : "en";
  const plan = normalizeAssessmentPlan(submission.selected_plan);

  await addWorkEvent(task, "example_formulation_analysis_started", "medium", {
    requestId
  });

  const analysis = await analyzeFormulationWithGrok({
    answers: submission.answers,
    audit: async ({ eventType, level, payload }) =>
      addWorkEvent(task, eventType, level ?? "low", { ...payload, requestId }),
    locale,
    plan,
    planId
  });
  const safeFormulation = await applyFormulationSafety(sql, {
    audit: async ({ eventType, level, payload }) =>
      addWorkEvent(task, eventType, level ?? "low", { ...payload, requestId }),
    formulation: analysis.formulation,
    locale,
    plan,
    planId,
    requestId,
    taskId: task.id
  });

  await sql.begin(async (transaction) => {
    const versionRows = await transaction<{ version: number }[]>`
      select coalesce(max(version), 0) + 1 as version
      from public.formulations
      where plan_id = ${planId}::uuid
    `;
    const version = Number(versionRows[0]?.version ?? 1);

    await transaction`
      insert into public.formulations (
        plan_id,
        version,
        formulation,
        model_version,
        generated_at,
        updated_at
      )
      values (
        ${planId}::uuid,
        ${version},
        ${transaction.json(toJsonValue(safeFormulation))},
        ${`xai:${analysis.model}:${analysis.reasoningEffort}:${analysis.promptVersion}:example`},
        now(),
        now()
      )
    `;

    await transaction`
      update public.assessment_example_requests set
        status = 'formulation_ready',
        updated_at = now()
      where id = ${requestId}::uuid
    `;
  });

  await addWorkEvent(task, "example_formulation_version_written", "medium", {
    attempts: analysis.attempts,
    model: analysis.model,
    promptVersion: analysis.promptVersion,
    reasoningEffort: analysis.reasoningEffort,
    requestId,
    responseId: analysis.responseId,
    safetySummary: safeFormulation.safetySummary
  });
  await enqueueExampleEmailTask(planId, requestId);
  await writeBpmEvent({
    actorType: "worker",
    eventName: "free_example_formulation_ready",
    eventType: "formulation",
    exampleRequestId: requestId,
    locale,
    metrics: {
      attempts: analysis.attempts,
      safetySummary: safeFormulation.safetySummary
    },
    planId,
    properties: {
      model: analysis.model,
      promptVersion: analysis.promptVersion,
      reasoningEffort: analysis.reasoningEffort,
      responseId: analysis.responseId,
      taskId: task.id
    },
    selectedPlan: plan
  });
}

async function completeExampleEmailTask(sql: postgres.Sql, task: TaskRecord) {
  const planId = task.planId;
  const requestId = payloadText(task.payload, "requestId");

  if (!planId) {
    throw new Error("Example email task is missing plan_id");
  }

  if (!isUuid(requestId)) {
    throw new Error("Example email task is missing requestId");
  }

  const rows = await sql`
    select
      assessment_example_requests.email,
      assessment_example_requests.health_score,
      assessment_example_requests.locale,
      reassessment.cron_id,
      reassessment.unsubscribe_token,
      formulations.formulation
    from public.assessment_example_requests
    join lateral (
      select formulation
      from public.formulations
      where formulations.plan_id = assessment_example_requests.plan_id
      order by version desc, generated_at desc
      limit 1
    ) formulations on true
    left join lateral (
      select cron.id::text as cron_id, cron.unsubscribe_token
      from public.cron
      where cron.plan_id = assessment_example_requests.plan_id
        and cron.action_type = 'reassessment'
        and cron.status in ('scheduled', 'queued')
        and lower(cron.recipient ->> 'email') = lower(assessment_example_requests.email)
      order by cron.scheduled_for desc, cron.created_at desc
      limit 1
    ) reassessment on true
    where assessment_example_requests.id = ${requestId}::uuid
      and assessment_example_requests.plan_id = ${planId}::uuid
    limit 1
  `;
  const row = rows[0];

  if (!row) {
    throw new Error("Example email request is missing formulation");
  }

  const locale: Locale = isLocale(row.locale) ? row.locale : "en";
  const formulation = row.formulation as FormulationBlueprint;
  const emailValidation = validateLeadEmail(row.email);

  if (!emailValidation.ok) {
    throw new Error("Example email request has an invalid recipient");
  }

  const cronId = typeof row.cron_id === "string" ? row.cron_id : "";
  let unsubscribeToken =
    typeof row.unsubscribe_token === "string" ? row.unsubscribe_token : "";

  if (isUuid(cronId) && !unsubscribeToken) {
    unsubscribeToken = newUnsubscribeToken();
    await sql`
      update public.cron set
        unsubscribe_token = ${unsubscribeToken},
        updated_at = now()
      where id = ${cronId}::uuid
    `;
  }

  const emailHtml = buildExampleEmailHtml({
    formulation,
    healthScore: row.health_score as HealthScoreResult,
    locale,
    planId,
    unsubscribeToken: unsubscribeToken || null
  });
  const delivery = await sendTransactionalEmail({
    html: emailHtml,
    subject: buildExampleEmailSubject(
      locale,
      row.health_score as HealthScoreResult
    ),
    to: emailValidation.email
  });

  await sql`
    update public.assessment_example_requests set
      status = ${delivery.sent ? "email_sent" : "email_rendered"},
      email_html = ${emailHtml},
      updated_at = now()
    where id = ${requestId}::uuid
  `;

  await addWorkEvent(
    task,
    delivery.sent ? "example_email_sent" : "example_email_rendered_not_sent",
    "medium",
    {
      emailType: "example_preview",
      messageId: delivery.messageId,
      reason: delivery.reason,
      requestId,
      sent: delivery.sent,
      to: emailValidation.email
    }
  );
  await writeBpmEvent({
    actorType: "worker",
    email: emailValidation.email,
    eventName: delivery.sent ? "free_email_sent" : "free_email_rendered",
    eventType: "email",
    exampleRequestId: requestId,
    locale,
    planId,
    properties: {
      messageId: delivery.messageId,
      reason: delivery.reason,
      taskId: task.id
    }
  });
}

async function completeReassessmentTask(sql: postgres.Sql, task: TaskRecord) {
  const planId = task.planId;
  const cronId = payloadText(task.payload, "cronId");

  if (!planId) {
    throw new Error("Reassessment task is missing plan_id");
  }

  if (!isUuid(cronId)) {
    throw new Error("Reassessment task is missing cronId");
  }

  const rows = await sql`
    select payload, recurrence_days, recipient, unsubscribe_token
    from public.cron
    where cron.id = ${cronId}::uuid
      and cron.plan_id = ${planId}::uuid
    limit 1
  `;
  const row = rows[0];

  if (!row) {
    throw new Error("Scheduled reassessment action not found");
  }

  const payload = payloadRecord(row.payload);
  const recipient = payloadRecord(row.recipient);
  const storedRecurrenceDays = Number(row.recurrence_days ?? 60);
  const recurrenceDays =
    Number.isFinite(storedRecurrenceDays) && storedRecurrenceDays > 0
      ? storedRecurrenceDays
      : 60;
  const locale: Locale = isLocale(payload.locale) ? payload.locale : "en";
  const email = typeof recipient.email === "string" ? recipient.email : "";
  const emailValidation = validateLeadEmail(email);

  if (!emailValidation.ok) {
    throw new Error("Scheduled reassessment email is invalid");
  }

  const unsubscribeToken =
    typeof row.unsubscribe_token === "string" && row.unsubscribe_token
      ? row.unsubscribe_token
      : newUnsubscribeToken();
  const emailHtml = buildReassessmentEmailHtml({
    locale,
    planId,
    unsubscribeToken
  });
  const delivery = await sendTransactionalEmail({
    html: emailHtml,
    subject: buildReassessmentEmailSubject(locale),
    to: emailValidation.email
  });

  await sql`
    update public.cron set
      status = case
        when coalesce(recurrence_days, ${recurrenceDays}) > 0
        then 'scheduled'
        else 'complete'
      end,
      scheduled_for = case
        when coalesce(recurrence_days, ${recurrenceDays}) > 0
        then now() + (coalesce(recurrence_days, ${recurrenceDays}) * interval '1 day')
        else scheduled_for
      end,
      unsubscribe_token = ${unsubscribeToken},
      result_payload = ${sql.json(
        toJsonValue({
          email: emailValidation.email,
          lastRenderedAt: new Date().toISOString(),
          lastRunTaskId: task.id,
          messageId: delivery.messageId,
          reason: delivery.reason,
          recurrenceDays,
          sent: delivery.sent
        })
      )},
      completed_at = now(),
      updated_at = now()
    where id = ${cronId}::uuid
  `;

  await addWorkEvent(
    task,
    delivery.sent ? "reassessment_email_sent" : "reassessment_rendered_not_sent",
    "medium",
    {
      cronId,
      emailType: "reassessment",
      messageId: delivery.messageId,
      reason: delivery.reason,
      recurrenceDays,
      sent: delivery.sent,
      to: emailValidation.email
    }
  );
  await writeBpmEvent({
    actorType: "worker",
    cronId,
    email: emailValidation.email,
    eventName: delivery.sent
      ? "reassessment_email_sent"
      : "reassessment_email_rendered",
    eventType: "reassessment",
    locale,
    planId,
    properties: {
      messageId: delivery.messageId,
      reason: delivery.reason,
      recurrenceDays,
      taskId: task.id
    }
  });
}

async function processWorkTask(sql: postgres.Sql, task: TaskRecord) {
  if (task.taskType === "analyze_healthscore") {
    await completeHealthScoreAnalysisTask(sql, task);
    return;
  }

  if (task.taskType === "generate_example_formulation") {
    await completeExampleFormulationTask(sql, task);
    return;
  }

  if (task.taskType === "generate_formulation") {
    await completeFormulationTask(sql, task);
    return;
  }

  if (task.taskType === "send_example_email") {
    await completeExampleEmailTask(sql, task);
    return;
  }

  if (task.taskType === "send_reassessment_email") {
    await completeReassessmentTask(sql, task);
    return;
  }

  throw new Error(`Unsupported task type: ${task.taskType}`);
}

async function failWorkTask(
  sql: postgres.Sql,
  reserved: ReservedTask,
  error: unknown
) {
  const task = reserved.task;
  const message = error instanceof Error ? error.message : "Unknown task error";
  const requestId = payloadText(task.payload, "requestId");
  const cronId = payloadText(task.payload, "cronId");

  await sql.begin(async (transaction) => {
    if (task.planId && task.taskType === "generate_formulation") {
      await transaction`
        update public.assessments set
          status = 'failed',
          error_message = ${message},
          updated_at = now()
        where plan_id = ${task.planId}::uuid
      `;
    }

    if (
      task.planId &&
      (task.taskType === "generate_example_formulation" ||
        task.taskType === "send_example_email") &&
      isUuid(requestId)
    ) {
      await transaction`
        update public.assessment_example_requests set
          status = 'failed',
          error_message = ${message},
          updated_at = now()
        where id = ${requestId}::uuid
      `;
    }

    if (task.taskType === "send_reassessment_email" && isUuid(cronId)) {
      await transaction`
        update public.cron set
          status = 'failed',
          error_message = ${message},
          updated_at = now()
        where id = ${cronId}::uuid
      `;
    }
  });

  await failTask({
    agentId: reserved.agent.id,
    errorMessage: message,
    reservationId: reserved.reservationId,
    resultPayload: {
      taskType: task.taskType
    },
    taskId: task.id
  });
  await writeBpmEvent({
    actorType: "worker",
    errorCode: "task_failed",
    errorMessage: message,
    eventName: "worker_task_failed",
    eventType: "error",
    planId: task.planId,
    properties: {
      taskId: task.id,
      taskType: task.taskType
    },
    severity: "critical"
  });
}

async function claimNextInternalTask(): Promise<ReservedTask | null> {
  return reserveNextTask({
    agent: {
      capabilities: [INTERNAL_WORKER_CAPABILITY],
      metadata: {
        worker: "internal"
      },
      name: "MattaNutra Task Worker",
      type: "deterministic"
    },
    leaseSeconds: 3600,
    mustRequireCapability: INTERNAL_WORKER_CAPABILITY,
    taskTypes: INTERNAL_WORK_TASK_TYPES
  });
}

async function claimNextCommunicationTask(): Promise<ReservedTask | null> {
  return reserveNextTask({
    agent: {
      capabilities: [COMMUNICATION_WORKER_CAPABILITY],
      metadata: {
        worker: "communications"
      },
      name: "MattaNutra Communications Worker",
      type: "deterministic"
    },
    leaseSeconds: 600,
    mustRequireCapability: COMMUNICATION_WORKER_CAPABILITY,
    taskTypes: [...COMMUNICATION_WORKER_TASK_TYPES]
  });
}

async function processCommunicationTask(
  sql: postgres.Sql,
  reserved: ReservedTask
) {
  try {
    const result = await sendClientSafetyFollowupTask(reserved);

    await completeTask({
      agentId: reserved.agent.id,
      reservationId: reserved.reservationId,
      resultPayload: {
        channelId: result.channel?.id,
        channelType: result.channel?.channelType,
        messageId: result.message.id,
        status: result.message.status
      },
      taskId: reserved.task.id
    });
    await addWorkEvent(reserved.task, "communication_task_completed", "low", {
      channelType: result.channel?.channelType,
      messageId: result.message.id
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown communication error";

    await failTask({
      agentId: reserved.agent.id,
      errorMessage: message,
      reservationId: reserved.reservationId,
      resultPayload: {
        taskType: reserved.task.taskType
      },
      taskId: reserved.task.id
    });
    await writeBpmEvent({
      actorType: "worker",
      errorMessage: message,
      eventName: "communication_task_failed",
      eventType: "error",
      planId: reserved.task.planId,
      properties: {
        taskId: reserved.task.id,
        taskType: reserved.task.taskType
      },
      severity: "high"
    });
  }
}

async function processQueuedCommunicationDispatch() {
  const results = await dispatchQueuedCommunicationMessages({
    limit: COMMUNICATION_DISPATCH_BATCH_SIZE
  });

  if (results.length === 0) {
    return 0;
  }

  await writeBpmEvent({
    actorType: "worker",
    eventName: "communication_dispatch_batch_processed",
    eventType: "system",
    metrics: {
      attempted: results.filter((result) => result.attempted).length,
      configured: results.filter((result) => result.configured).length,
      failed: results.filter((result) => result.message.status === "failed")
        .length,
      noChannel: results.filter(
        (result) => result.message.status === "no_channel"
      ).length,
      sent: results.filter(
        (result) =>
          result.message.status === "sent" ||
          result.message.status === "delivered"
      ).length,
      total: results.length
    },
    severity: results.some((result) => result.message.status === "failed")
      ? "medium"
      : "low"
  });

  return results.length;
}

async function runTaskWorker() {
  const sql = getSql();

  if (!sql) {
    return;
  }

  while (true) {
    const communicationTask = await claimNextCommunicationTask();

    if (communicationTask) {
      await processCommunicationTask(sql, communicationTask);
      continue;
    }

    const dispatchedMessages = await processQueuedCommunicationDispatch();

    if (dispatchedMessages > 0) {
      continue;
    }

    const reserved = await claimNextInternalTask();

    if (!reserved) {
      return;
    }

    try {
      await processWorkTask(sql, reserved.task);
      await completeTask({
        agentId: reserved.agent.id,
        reservationId: reserved.reservationId,
        resultPayload: {
          planId: reserved.task.planId,
          status: "complete",
          taskType: reserved.task.taskType
        },
        taskId: reserved.task.id
      });
    } catch (error) {
      await failWorkTask(sql, reserved, error);
    }
  }
}

export function kickTaskWorker() {
  if (globalWorker.mattanutraTaskWorker) {
    return globalWorker.mattanutraTaskWorker;
  }

  globalWorker.mattanutraTaskWorker = runTaskWorker().finally(() => {
    globalWorker.mattanutraTaskWorker = undefined;
  });

  return globalWorker.mattanutraTaskWorker;
}

export function kickCronWorker() {
  if (globalWorker.mattanutraCronWorker) {
    return globalWorker.mattanutraCronWorker;
  }

  globalWorker.mattanutraCronWorker = runCronWorker().finally(() => {
    globalWorker.mattanutraCronWorker = undefined;
  });

  return globalWorker.mattanutraCronWorker;
}
