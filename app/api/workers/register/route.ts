import {
  objectValue,
  openClawJson,
  readJsonObject,
  taskApiError,
  textValue
} from "@/lib/openclaw-api";
import { registerWorkerSession, type AgentType } from "@/lib/task-service";
import { requireWorkerRequest } from "@/lib/worker-auth";

export const runtime = "nodejs";

function agentType(value: unknown): AgentType {
  const text = textValue(value);

  return text === "ai" ||
    text === "deterministic" ||
    text === "human" ||
    text === "system"
    ? text
    : "external";
}

export async function POST(request: Request) {
  const unauthorized = requireWorkerRequest(request);

  if (unauthorized) {
    return unauthorized;
  }

  const body = await readJsonObject(request);
  const agent = objectValue(body.agent);
  const name = textValue(agent.name) ?? textValue(body.name);
  const instanceId = textValue(body.instanceId);

  if (!name || !instanceId) {
    return openClawJson(
      { message: "agent.name and instanceId are required" },
      { status: 400 }
    );
  }

  try {
    const registration = await registerWorkerSession({
      agent: {
        capabilities: agent.capabilities ?? body.capabilities,
        id: textValue(agent.id),
        metadata: objectValue(agent.metadata),
        model: textValue(agent.model),
        name,
        type: agentType(agent.type ?? body.agentType)
      },
      capabilities: body.capabilities ?? agent.capabilities,
      concurrency: body.concurrency,
      instanceId,
      metadata: objectValue(body.metadata),
      taskTypes: body.taskTypes,
      workerVersion: textValue(body.workerVersion)
    });

    return openClawJson(registration, { status: 201 });
  } catch (error) {
    return taskApiError(error, "Unable to register worker");
  }
}
