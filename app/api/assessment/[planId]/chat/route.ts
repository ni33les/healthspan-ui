import { NextResponse } from "next/server";
import { isUuid, toJsonValue } from "@/lib/assessment-store";
import { getSql } from "@/lib/db";
import {
  appendPlanChatMessage,
  loadPlanConversationForClient,
  PLAN_CHAT_LIMIT_ERROR_MESSAGE
} from "@/lib/plan-concierge";
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

export async function GET(_request: Request, { params }: PlanChatRouteProps) {
  const { planId } = await params;
  const messages = await loadPlanConversationForClient(planId);

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

  let messageId = "";

  try {
    const recorded = await appendPlanChatMessage(sql, {
      body,
      channel: "gui",
      planId,
      role: "user",
      source: "results_page",
      status: "queued"
    });
    messageId = recorded.messageId;
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === PLAN_CHAT_LIMIT_ERROR_MESSAGE
    ) {
      const messages = await loadPlanConversationForClient(planId);

      return NextResponse.json(
        {
          message: "Chat interaction limit reached",
          messages: messages ?? []
        },
        { status: 429 }
      );
    }

    return NextResponse.json({ message: "Plan not found" }, { status: 404 });
  }
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

  const messages = await loadPlanConversationForClient(planId);

  return NextResponse.json({
    messageId,
    messages: messages ?? [],
    taskId
  });
}
