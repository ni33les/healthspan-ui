import {
  objectValue,
  openClawJson,
  readJsonObject,
  taskApiError,
  textValue
} from "@/lib/openclaw-api";
import {
  heartbeatWorkerSession,
  type WorkerSessionStatus
} from "@/lib/task-service";
import { requireWorkerRequest } from "@/lib/worker-auth";

export const runtime = "nodejs";

function sessionStatus(value: unknown): WorkerSessionStatus {
  return value === "offline" ||
    value === "polling" ||
    value === "working" ||
    value === "idle"
    ? value
    : "idle";
}

export async function POST(request: Request) {
  const unauthorized = requireWorkerRequest(request);

  if (unauthorized) {
    return unauthorized;
  }

  const body = await readJsonObject(request);
  const workerSessionId = textValue(body.workerSessionId);

  if (!workerSessionId) {
    return openClawJson(
      { message: "workerSessionId is required" },
      { status: 400 }
    );
  }

  try {
    const session = await heartbeatWorkerSession({
      agentId: textValue(body.agentId),
      currentTaskId: textValue(body.currentTaskId),
      metadata: objectValue(body.metadata),
      status: sessionStatus(body.status),
      workerSessionId
    });

    return openClawJson({ session });
  } catch (error) {
    return taskApiError(error, "Unable to record worker heartbeat");
  }
}
