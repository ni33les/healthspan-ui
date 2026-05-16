import {
  objectValue,
  openClawJson,
  readJsonObject,
  requireOpenClawRequest,
  taskApiError,
  textValue
} from "@/lib/openclaw-api";
import {
  appendPlanChatMessage,
  loadPlanChatMessages,
  PLAN_CHAT_LIMIT_ERROR_MESSAGE,
  type PlanChatChannel
} from "@/lib/plan-concierge";
import { getSql } from "@/lib/db";

export const runtime = "nodejs";

type OpenClawPlanRouteProps = Readonly<{
  params: Promise<{
    planId: string;
  }>;
}>;

function roleValue(value: unknown) {
  return value === "assistant" ? "assistant" : "user";
}

function channelValue(value: unknown): PlanChatChannel {
  const channel = textValue(value);

  return channel === "email" ||
    channel === "gui" ||
    channel === "line" ||
    channel === "telegram" ||
    channel === "whatsapp"
    ? channel
    : "unknown";
}

export async function POST(
  request: Request,
  { params }: OpenClawPlanRouteProps
) {
  const unauthorized = requireOpenClawRequest(request);

  if (unauthorized) {
    return unauthorized;
  }

  const sql = getSql();

  if (!sql) {
    return openClawJson({ message: "Database is not configured" }, { status: 500 });
  }

  const { planId } = await params;
  const body = await readJsonObject(request);
  const message = textValue(body.message ?? body.body);

  if (!message) {
    return openClawJson({ message: "message is required" }, { status: 400 });
  }

  try {
    const recorded = await appendPlanChatMessage(sql, {
      body: message,
      channel: channelValue(body.channel),
      externalMessageId: textValue(body.externalMessageId),
      feedback: body.feedback,
      identityId: textValue(body.identityId),
      metadata: objectValue(body.metadata),
      planId,
      replyToMessageId: textValue(body.replyToMessageId),
      role: roleValue(body.role),
      source: "openclaw",
      status:
        body.status === "failed" || body.status === "queued"
          ? body.status
          : "ready"
    });
    const messages = await loadPlanChatMessages(sql, planId);

    return openClawJson({
      messageId: recorded.messageId,
      messages
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === PLAN_CHAT_LIMIT_ERROR_MESSAGE
    ) {
      return openClawJson(
        { message: "Chat interaction limit reached" },
        { status: 429 }
      );
    }

    return taskApiError(error, "Unable to record OpenClaw plan message");
  }
}
