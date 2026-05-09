import { randomUUID } from "node:crypto";
import { getSql } from "@/lib/db";

export type AdminReviewJobRow = Readonly<{
  actionOptions: string[];
  id: string;
  maxAmount: number | null;
  maxUnit: string | null;
  newDose: string | null;
  originalDose: string | null;
  planId: string | null;
  priority: number;
  queuedAt: string;
  requiredFields: string[];
  reviewKind: string;
  status: string;
  supplementName: string;
}>;

export type AdminReviewQueueData = Readonly<{
  databaseAvailable: boolean;
  generatedAt: string;
  rows: AdminReviewJobRow[];
  summary: {
    doseReduced: number;
    reviewRequired: number;
    total: number;
    unknown: number;
  };
}>;

type ReviewJobDbRow = Readonly<{
  id: string;
  payload: Record<string, unknown> | null;
  plan_id: string | null;
  priority: number | string;
  queued_at: Date | string;
  status: string;
}>;

function textOrNull(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function textArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function numberOrNull(value: unknown) {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : null;
}

function emptyAdminReviewQueueData(): AdminReviewQueueData {
  return {
    databaseAvailable: false,
    generatedAt: new Date().toISOString(),
    rows: [],
    summary: {
      doseReduced: 0,
      reviewRequired: 0,
      total: 0,
      unknown: 0
    }
  };
}

function rowFromDb(row: ReviewJobDbRow): AdminReviewJobRow {
  const payload = row.payload ?? {};

  return {
    actionOptions: textArray(payload.actionOptions),
    id: row.id,
    maxAmount: numberOrNull(payload.maxAmount),
    maxUnit: textOrNull(payload.maxUnit),
    newDose: textOrNull(payload.newDose),
    originalDose: textOrNull(payload.originalDose),
    planId: row.plan_id,
    priority: Number(row.priority) || 0,
    queuedAt: new Date(row.queued_at).toISOString(),
    requiredFields: textArray(payload.requiredFields),
    reviewKind: textOrNull(payload.reviewKind) ?? "review_required",
    status: row.status,
    supplementName:
      textOrNull(payload.supplementName) ??
      textOrNull(payload.normalizedSupplementName) ??
      "Unknown supplement"
  };
}

function buildSummary(rows: AdminReviewJobRow[]) {
  return rows.reduce(
    (summary, row) => {
      summary.total += 1;

      if (row.reviewKind === "dose_reduced") {
        summary.doseReduced += 1;
      } else if (row.reviewKind === "unknown_supplement") {
        summary.unknown += 1;
      } else {
        summary.reviewRequired += 1;
      }

      return summary;
    },
    {
      doseReduced: 0,
      reviewRequired: 0,
      total: 0,
      unknown: 0
    }
  );
}

export async function getAdminReviewQueueData(): Promise<AdminReviewQueueData> {
  const sql = getSql();

  if (!sql) {
    return emptyAdminReviewQueueData();
  }

  try {
    const rows = await sql<ReviewJobDbRow[]>`
      select
        id::text,
        plan_id::text,
        status,
        priority,
        payload,
        queued_at
      from public.jobs
      where job_type = 'supplement_review'
        and status = 'queued'
      order by priority desc, queued_at asc
      limit 200
    `;
    const mappedRows = rows.map(rowFromDb);

    return {
      databaseAvailable: true,
      generatedAt: new Date().toISOString(),
      rows: mappedRows,
      summary: buildSummary(mappedRows)
    };
  } catch (error) {
    console.error("Unable to load admin review queue", error);
    return emptyAdminReviewQueueData();
  }
}

export async function dismissAdminReviewJob({
  actor,
  id
}: Readonly<{
  actor?: string | null;
  id: string;
}>) {
  const sql = getSql();

  if (!sql) {
    throw new Error("Database is not configured");
  }

  await sql.begin(async (transaction) => {
    const updated = await transaction<{ id: string }[]>`
      update public.jobs
      set
        status = 'complete',
        completed_at = now(),
        updated_at = now()
      where id = ${id}::uuid
        and job_type = 'supplement_review'
        and status = 'queued'
      returning id::text
    `;

    if (!updated[0]) {
      throw new Error("Review job not found");
    }

    await transaction`
      update public.safety_reviews
      set
        status = 'closed',
        reviewed_at = coalesce(reviewed_at, now()),
        closed_at = now(),
        reviewer_id = ${actor ?? "admin_dashboard"},
        reviewer_note = coalesce(reviewer_note, 'Dismissed from admin review queue.'),
        client_notification_status = 'not_required',
        updated_at = now()
      where job_id = ${id}::uuid
        and status in ('open', 'in_review', 'escalated')
    `;

    await transaction`
      insert into public.job_audit_events (
        id,
        job_id,
        event_type,
        level,
        event_payload,
        created_at
      )
      values (
        ${randomUUID()}::uuid,
        ${id}::uuid,
        'supplement_review_dismissed',
        'low',
        ${transaction.json({ actor: actor ?? "admin_dashboard" })},
        now()
      )
    `;
  });

  return getAdminReviewQueueData();
}
