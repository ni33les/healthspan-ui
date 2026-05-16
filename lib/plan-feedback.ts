import type postgres from "postgres";
import type {
  PlanFeedbackItem,
  PlanFeedbackType,
  PlanGuidanceAdjustment
} from "@/lib/formulation-types";

type Db = postgres.Sql | postgres.TransactionSql;

const FEEDBACK_TYPES = new Set<PlanFeedbackType>([
  "budget",
  "capsule_limit",
  "constraint",
  "cuisine",
  "dislike",
  "preference",
  "removal",
  "routine",
  "safety_disclosure",
  "other"
]);

const ITEM_TYPES = new Set([
  "condition",
  "food",
  "other",
  "plan",
  "supplement"
]);

function toJsonValue(value: unknown): postgres.JSONValue {
  return JSON.parse(JSON.stringify(value ?? null)) as postgres.JSONValue;
}

function textValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function recordValue(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function normalizedPlanFeedbackText(value: unknown) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9ก-๙]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function isPlanRefinementRequest(value: unknown) {
  const normalized = normalizedPlanFeedbackText(value);

  if (!normalized) {
    return false;
  }

  const negativeIntent =
    /\b(do not|dont|don t|don't|not yet|not now|no need|wait|hold|stop|cancel)\b/.test(
      normalized
    ) ||
    /^(no|no thanks|no thank you|not now)$/.test(normalized);

  if (negativeIntent) {
    return false;
  }

  return [
    /\b(go ahead|proceed|do it|yes do it|yes please|okay do it|ok do it|lets do it|let s do it)\b/,
    /\b(refine|regenerate|rebuild|rerun|re run|update|generate|finalize|finalise|deliver|ship|produce)\b.*\b(plan|nutrition|guidance|report)\b/,
    /\b(plan|nutrition|guidance|report)\b.*\b(refine|regenerate|rebuild|rerun|re run|update|generate|finalize|finalise|deliver|ship|produce)\b/,
    /\b(make|create|build)\b.*\b(new|updated|refined|final)\b.*\b(plan|nutrition|guidance|report)\b/,
    /\b(no )?(that s it|thats it|that is it|all good|looks good|ready|done)\b/,
    /\b(no more changes|nothing else|nothing more)\b/
  ].some((pattern) => pattern.test(normalized));
}

function feedbackType(value: unknown): PlanFeedbackType {
  const cleaned = textValue(value);

  return FEEDBACK_TYPES.has(cleaned as PlanFeedbackType)
    ? (cleaned as PlanFeedbackType)
    : "other";
}

function itemType(value: unknown): PlanFeedbackItem["itemType"] {
  const cleaned = textValue(value);

  return ITEM_TYPES.has(cleaned) ? cleaned as PlanFeedbackItem["itemType"] : null;
}

function urgency(value: unknown, type: PlanFeedbackType) {
  return value === "safety" || type === "safety_disclosure"
    ? "safety"
    : "normal";
}

export function normalizePlanFeedbackItems(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      const record = recordValue(item);
      const type = feedbackType(record.feedbackType ?? record.type);
      const body = textValue(record.body ?? record.value ?? record.note);
      const name = textValue(record.itemName);

      if (!body && !name) {
        return null;
      }

      return {
        body: body || name,
        feedbackType: type,
        itemId: textValue(record.itemId) || null,
        itemName: name || null,
        itemType: itemType(record.itemType),
        metadata: recordValue(record.metadata),
        urgency: urgency(record.urgency, type)
      } satisfies PlanFeedbackItem;
    })
    .filter(Boolean)
    .slice(0, 40) as PlanFeedbackItem[];
}

function feedbackFromAdjustment(
  adjustment: PlanGuidanceAdjustment
): PlanFeedbackItem {
  return {
    body: adjustment.reason || `Remove ${adjustment.itemName}`,
    feedbackType: "removal",
    itemId: adjustment.itemId ?? null,
    itemName: adjustment.itemName,
    itemType: adjustment.itemType,
    urgency: "normal"
  };
}

function safetyDisclosureFor(message: string) {
  const normalized = normalizedPlanFeedbackText(message);
  const safetyPatterns = [
    /\b(allergy|allergic|anaphylaxis|sesame|peanut|shellfish|tree nut|soy|wheat|egg|milk)\b/,
    /\b(diabetes|diabetic|prediabetes|blood sugar|hypoglycemia)\b/,
    /\b(kidney|egfr|creatinine|dialysis)\b/,
    /\b(pregnant|pregnancy|breastfeeding|conceive)\b/,
    /\b(heart disease|heart failure|blood pressure|hypertension|warfarin|medication)\b/,
    /\b(ibs|celiac|crohn|colitis|reflux|pancreatitis|gallbladder)\b/,
    /\b(eating disorder|restrictive eating|binge|unexplained weight loss|fainting|chest pain)\b/
  ];

  return safetyPatterns.some((pattern) => pattern.test(normalized));
}

export function inferPlanFeedbackFromMessage(
  input: Readonly<{
    adjustments?: readonly PlanGuidanceAdjustment[];
    message: string;
  }>
) {
  const message = input.message.trim();
  const feedback: PlanFeedbackItem[] = [];

  for (const adjustment of input.adjustments ?? []) {
    feedback.push(feedbackFromAdjustment(adjustment));
  }

  if (!message) {
    return feedback;
  }

  const normalized = normalizedPlanFeedbackText(message);

  if (safetyDisclosureFor(message)) {
    feedback.push({
      body: message,
      feedbackType: "safety_disclosure",
      itemType: "condition",
      urgency: "safety"
    });
  }

  if (/\b(remove|drop|skip|avoid|exclude|dont|don't|do not)\b/i.test(message)) {
    feedback.push({
      body: message,
      feedbackType: "removal",
      itemType: "plan",
      urgency: "normal"
    });
  } else if (/\b(dislike|hate|not like|don't like|dont like|no more)\b/i.test(message)) {
    feedback.push({
      body: message,
      feedbackType: "dislike",
      itemType: "plan",
      urgency: "normal"
    });
  }

  if (/\b(capsule|capsules|pill|pills|tablet|tablets)\b/i.test(message)) {
    feedback.push({
      body: message,
      feedbackType: "capsule_limit",
      itemType: "supplement",
      urgency: "normal"
    });
  }

  if (/\b(budget|cheap|cheaper|expensive|cost)\b/i.test(message)) {
    feedback.push({
      body: message,
      feedbackType: "budget",
      itemType: "plan",
      urgency: "normal"
    });
  }

  if (/\b(thai|vegetarian|vegan|halal|kosher|pescatarian|mediterranean)\b/i.test(message)) {
    feedback.push({
      body: message,
      feedbackType: normalized.includes("thai") ? "cuisine" : "preference",
      itemType: "plan",
      urgency: "normal"
    });
  }

  return feedback;
}

function mergeFeedback(feedback: readonly PlanFeedbackItem[]) {
  const seen = new Set<string>();
  const merged: PlanFeedbackItem[] = [];

  for (const item of feedback) {
    const normalized = normalizedPlanFeedbackText(
      [item.itemName, item.body].filter(Boolean).join(" ")
    );
    const key = [
      item.feedbackType,
      item.itemType ?? "",
      normalizedPlanFeedbackText(item.itemId ?? ""),
      normalized
    ].join(":");

    if (normalized && !seen.has(key)) {
      seen.add(key);
      merged.push(item);
    }
  }

  return merged;
}

export async function loadActivePlanFeedback(sql: Db, planId: string) {
  const rows = await sql<Array<{
    body: string;
    created_at: Date;
    feedback_type: PlanFeedbackType;
    id: string;
    item_id: string | null;
    item_name: string | null;
    item_type: PlanFeedbackItem["itemType"];
    metadata: Record<string, unknown>;
    source_message_id: string | null;
    source_task_id: string | null;
    status: "active" | "revoked";
    urgency: "normal" | "safety";
  }>>`
    select
      id::text,
      feedback_type,
      item_type,
      item_id,
      item_name,
      body,
      urgency,
      status,
      source_message_id::text,
      source_task_id::text,
      metadata,
      created_at
    from public.plan_feedback
    where plan_id = ${planId}::uuid
      and status = 'active'
    order by
      case when urgency = 'safety' then 0 else 1 end,
      created_at asc
  `;

  return rows.map((row) => ({
    body: row.body,
    createdAt: row.created_at.toISOString(),
    feedbackType: row.feedback_type,
    id: row.id,
    itemId: row.item_id,
    itemName: row.item_name,
    itemType: row.item_type,
    metadata: row.metadata ?? {},
    sourceMessageId: row.source_message_id,
    sourceTaskId: row.source_task_id,
    status: row.status,
    urgency: row.urgency
  })) satisfies PlanFeedbackItem[];
}

export async function savePlanFeedback(
  sql: Db,
  input: Readonly<{
    feedback: readonly PlanFeedbackItem[];
    metadata?: Record<string, unknown>;
    messageId?: string | null;
    planId: string;
    taskId?: string | null;
  }>
) {
  const feedback = mergeFeedback(input.feedback);
  let saved = 0;

  for (const item of feedback) {
    const normalizedText = normalizedPlanFeedbackText(
      [item.itemName, item.body].filter(Boolean).join(" ")
    );

    if (!normalizedText) {
      continue;
    }

    const rows = await sql<Array<{ id: string }>>`
      insert into public.plan_feedback (
        id,
        plan_id,
        source_message_id,
        source_task_id,
        feedback_type,
        item_type,
        item_id,
        item_name,
        normalized_text,
        body,
        urgency,
        status,
        metadata,
        created_at,
        updated_at
      )
      values (
        gen_random_uuid(),
        ${input.planId}::uuid,
        ${input.messageId ?? null}::uuid,
        ${input.taskId ?? null}::uuid,
        ${item.feedbackType},
        ${item.itemType ?? null},
        ${item.itemId ?? null},
        ${item.itemName ?? null},
        ${normalizedText},
        ${item.body},
        ${item.urgency ?? "normal"},
        'active',
        ${sql.json(toJsonValue({
          ...(input.metadata ?? {}),
          ...(item.metadata ?? {})
        }))}::jsonb,
        now(),
        now()
      )
      on conflict do nothing
      returning id::text
    `;

    if (rows[0]) {
      saved += 1;
    }
  }

  return saved;
}
