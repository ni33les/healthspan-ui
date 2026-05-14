import { hostname } from "node:os";
import { executeTaskWorkItem } from "../lib/task-execution.ts";
import {
  AGENT_CAPABILITIES,
  SYSTEM_AGENTS,
  taskReservationAgent
} from "../lib/system-agents.ts";
import { WorkerApiClient, type WorkerAgentConfig } from "./api-client.ts";

type WorkerMode =
  | "all"
  | "communications"
  | "content"
  | "email"
  | "formulation"
  | "healthscore"
  | "hosting";

const DEFAULT_POLL_WAIT_SECONDS = 20;
const DEFAULT_LEASE_SECONDS = 900;

function envText(name: string, fallback = "") {
  return process.env[name]?.trim() || fallback;
}

function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function workerMode(value: string | undefined): WorkerMode {
  return value === "communications" ||
    value === "content" ||
    value === "email" ||
    value === "formulation" ||
    value === "healthscore" ||
    value === "hosting"
    ? value
    : "all";
}

function workerVersion() {
  return envText("WORKER_VERSION", envText("npm_package_version", "dev"));
}

function instanceId(mode: WorkerMode) {
  return envText(
    "WORKER_INSTANCE_ID",
    `${hostname()}:${mode}:${process.pid}`
  );
}

const WORKER_PROFILES: Record<Exclude<WorkerMode, "all">, WorkerAgentConfig> = {
  communications: {
    capabilities: [
      AGENT_CAPABILITIES.clientSafetyFollowup,
      AGENT_CAPABILITIES.communicationDispatch,
      AGENT_CAPABILITIES.communicationRoute
    ],
    name: SYSTEM_AGENTS.communicationsCoordinator.name,
    taskTypes: ["client_safety_followup"],
    type: "deterministic"
  },
  content: {
    capabilities: [AGENT_CAPABILITIES.contentPublish],
    name: SYSTEM_AGENTS.contentPublisher.name,
    taskTypes: ["content_status_change"],
    type: "deterministic"
  },
  email: {
    capabilities: [
      AGENT_CAPABILITIES.emailSend,
      AGENT_CAPABILITIES.freeEmailSend,
      AGENT_CAPABILITIES.reassessmentEmailSend
    ],
    name: SYSTEM_AGENTS.emailDispatcher.name,
    taskTypes: ["send_example_email", "send_reassessment_email"],
    type: "deterministic"
  },
  formulation: {
    capabilities: [
      AGENT_CAPABILITIES.formulationGeneration,
      AGENT_CAPABILITIES.freeExampleFormulation
    ],
    model: SYSTEM_AGENTS.formulationWorker.model,
    name: SYSTEM_AGENTS.formulationWorker.name,
    taskTypes: ["generate_formulation", "generate_example_formulation"],
    type: "ai"
  },
  healthscore: {
    capabilities: [
      AGENT_CAPABILITIES.healthScoreAnalysis,
      AGENT_CAPABILITIES.salesCopy
    ],
    model: SYSTEM_AGENTS.healthScoreEngine.model,
    name: SYSTEM_AGENTS.healthScoreEngine.name,
    taskTypes: ["analyze_healthscore"],
    type: "ai"
  },
  hosting: {
    capabilities: [
      AGENT_CAPABILITIES.hostingCostSync,
      AGENT_CAPABILITIES.scheduler
    ],
    name: SYSTEM_AGENTS.scheduler.name,
    taskTypes: ["sync_digitalocean_billing"],
    type: "deterministic"
  }
};

function allProfile(): WorkerAgentConfig {
  const agents = [
    taskReservationAgent(SYSTEM_AGENTS.communicationsCoordinator),
    taskReservationAgent(SYSTEM_AGENTS.contentPublisher),
    taskReservationAgent(SYSTEM_AGENTS.emailDispatcher),
    taskReservationAgent(SYSTEM_AGENTS.formulationWorker),
    taskReservationAgent(SYSTEM_AGENTS.healthScoreEngine),
    taskReservationAgent(SYSTEM_AGENTS.scheduler)
  ];

  return {
    capabilities: [...new Set(agents.flatMap((agent) => agent.capabilities))],
    name: "MattaNutra External Worker",
    taskTypes: [
      "analyze_healthscore",
      "client_safety_followup",
      "content_status_change",
      "generate_example_formulation",
      "generate_formulation",
      "send_example_email",
      "send_reassessment_email",
      "sync_digitalocean_billing"
    ],
    type: "external"
  };
}

function profileForMode(mode: WorkerMode) {
  return mode === "all" ? allProfile() : WORKER_PROFILES[mode];
}

function requireConfig() {
  const baseUrl =
    envText("WORKER_API_BASE_URL") ||
    envText("MATTANUTRA_API_BASE_URL") ||
    envText("APP_BASE_URL") ||
    "http://localhost:3000";
  const token = envText("WORKER_API_TOKEN");

  if (!token) {
    throw new Error("WORKER_API_TOKEN is required for external workers");
  }

  return { baseUrl, token };
}

async function executeWorkItem(
  client: WorkerApiClient,
  workItem: Record<string, unknown>
) {
  if (workItem.taskType === "client_safety_followup") {
    const communication = await client.sendCommunication({
      body: workItem.body,
      goalId: workItem.goalId,
      messageType: "safety_review_decision",
      metadata: workItem.metadata,
      planId: workItem.planId,
      subject: workItem.subject,
      taskId: workItem.taskId
    });

    return { communication };
  }

  return executeTaskWorkItem(workItem as never);
}

async function runWorker(mode: WorkerMode) {
  const { baseUrl, token } = requireConfig();
  const client = new WorkerApiClient({ baseUrl, token });
  const agentConfig = profileForMode(mode);
  const concurrency = positiveInteger(process.env.WORKER_CONCURRENCY, 1);
  const registration = await client.register({
    agent: agentConfig,
    concurrency,
    instanceId: instanceId(mode),
    workerVersion: workerVersion()
  });
  const agent = registration.agent;
  const workerSessionId = registration.session.id;
  const leaseSeconds =
    positiveInteger(
      process.env.WORKER_LEASE_SECONDS,
      registration.polling.leaseSeconds
    ) || DEFAULT_LEASE_SECONDS;
  const waitSeconds =
    positiveInteger(
      process.env.WORKER_POLL_WAIT_SECONDS,
      registration.polling.waitSeconds
    ) || DEFAULT_POLL_WAIT_SECONDS;

  await client.heartbeat({
    agentId: agent.id,
    status: "idle",
    workerSessionId
  });

  process.on("SIGTERM", () => {
    void client.heartbeat({
      agentId: agent.id,
      status: "offline",
      workerSessionId
    }).finally(() => process.exit(0));
  });
  process.on("SIGINT", () => {
    void client.heartbeat({
      agentId: agent.id,
      status: "offline",
      workerSessionId
    }).finally(() => process.exit(0));
  });

  for (;;) {
    await client.heartbeat({
      agentId: agent.id,
      status: "polling",
      workerSessionId
    });

    const reserved = await client.reserve({
      agent,
      leaseSeconds,
      taskTypes: agentConfig.taskTypes,
      waitSeconds,
      workerSessionId
    });

    if (!reserved.task || !reserved.reservationId || !reserved.workItem) {
      continue;
    }

    const taskId = reserved.task.id;
    const renew = setInterval(() => {
      void client.renew({
        agentId: agent.id,
        leaseSeconds,
        reservationId: reserved.reservationId ?? "",
        taskId,
        workerSessionId
      });
    }, Math.max(30_000, Math.floor(leaseSeconds * 400)));
    (renew as ReturnType<typeof setInterval> & { unref?: () => void }).unref?.();

    try {
      const resultPayload = await executeWorkItem(client, reserved.workItem);

      clearInterval(renew);
      await client.complete({
        agentId: agent.id,
        reservationId: reserved.reservationId,
        resultPayload: resultPayload as Record<string, unknown>,
        taskId,
        workerSessionId
      });
    } catch (error) {
      clearInterval(renew);
      await client.fail({
        agentId: agent.id,
        errorMessage:
          error instanceof Error ? error.message : "Unknown worker error",
        reservationId: reserved.reservationId,
        resultPayload: {
          taskType: reserved.task.taskType
        },
        taskId,
        workerSessionId
      });
    }
  }
}

const mode = workerMode(process.argv[2] ?? process.env.WORKER_MODE);

runWorker(mode).catch((error) => {
  console.error(error);
  process.exit(1);
});
