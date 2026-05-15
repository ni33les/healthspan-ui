import { NextResponse } from "next/server";
import { isUuid, toJsonValue } from "@/lib/assessment-store";
import { getSql } from "@/lib/db";
import { enqueueNutritionPlanChatReplyTask } from "@/lib/task-worker";

type PlanChatRouteProps = Readonly<{
  params: Promise<{
    planId: string;
  }>;
}>;

function messageFromBody(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return "";
  }

  const message = (value as Record<string, unknown>).message;

  return typeof message === "string" ? message.trim() : "";
}

async function loadMessages(planId: string) {
  const sql = getSql();

  if (!sql || !isUuid(planId)) {
    return null;
  }

  const planRows = await sql<Array<{ exists: boolean }>>`
    select exists (
      select 1
      from public.assessments
      where plan_id = ${planId}::uuid
        and selected_plan is not null
    ) as exists
  `;

  if (planRows[0]?.exists !== true) {
    return null;
  }

  const rows = await sql<Array<{
    body: string;
    created_at: Date;
    id: string;
    role: "assistant" | "user";
    status: "failed" | "queued" | "ready";
  }>>`
    select id::text, role, body, status, created_at
    from public.plan_chat_messages
    where plan_id = ${planId}::uuid
    order by created_at asc
  `;

  return rows.map((row) => ({
    body: row.body,
    createdAt: row.created_at.toISOString(),
    id: row.id,
    role: row.role,
    status: row.status
  }));
}

export async function GET(_request: Request, { params }: PlanChatRouteProps) {
  const { planId } = await params;
  const messages = await loadMessages(planId);

  if (!messages) {
    return NextResponse.json({ message: "Plan not found" }, { status: 404 });
  }

  return NextResponse.json({ messages });
}

export async function POST(request: Request, { params }: PlanChatRouteProps) {
  const { planId } = await params;
  const sql = getSql();

  if (!sql || !isUuid(planId)) {
    return NextResponse.json({ message: "Plan not found" }, { status: 404 });
  }

  const body = messageFromBody(await request.json().catch(() => null));

  if (body.length < 1) {
    return NextResponse.json(
      { message: "Message is required" },
      { status: 400 }
    );
  }

  if (body.length > 1200) {
    return NextResponse.json(
      { message: "Message is too long" },
      { status: 400 }
    );
  }

  const planRows = await sql<Array<{ exists: boolean }>>`
    select exists (
      select 1
      from public.assessments
      where plan_id = ${planId}::uuid
        and selected_plan is not null
    ) as exists
  `;

  if (planRows[0]?.exists !== true) {
    return NextResponse.json({ message: "Plan not found" }, { status: 404 });
  }

  const messageRows = await sql<Array<{ id: string }>>`
    insert into public.plan_chat_messages (
      id,
      plan_id,
      role,
      body,
      status,
      metadata,
      created_at,
      updated_at
    )
    values (
      gen_random_uuid(),
      ${planId}::uuid,
      'user',
      ${body},
      'queued',
      ${sql.json(toJsonValue({ source: "results_page" }))}::jsonb,
      now(),
      now()
    )
    returning id::text
  `;
  const messageId = messageRows[0]?.id;
  const taskId = messageId
    ? await enqueueNutritionPlanChatReplyTask({ messageId, planId })
    : null;

  if (!taskId) {
    if (messageId) {
      await sql`
        update public.plan_chat_messages set
          status = 'failed',
          metadata = metadata || ${sql.json(toJsonValue({ error: "Unable to queue chat reply" }))}::jsonb,
          updated_at = now()
        where id = ${messageId}::uuid
      `;
    }

    return NextResponse.json(
      { message: "Unable to queue chat reply" },
      { status: 500 }
    );
  }

  const messages = await loadMessages(planId);

  return NextResponse.json({
    messageId,
    messages: messages ?? [],
    taskId
  });
}
