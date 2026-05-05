type JobStatus = "queued" | "preparing" | "ready";
type StepState = "active" | "complete" | "pending";

export type AssessmentPlan = "free" | "precision" | "pro";

type AssessmentJob = {
  answers?: unknown;
  createdAt: number;
  formulationMs: number;
  id: string;
  initialQueue: number;
  locale?: string;
  plan: AssessmentPlan;
  queueMs: number;
  updatedAt: number;
};

export type AssessmentJobSnapshot = {
  planId: string;
  plan: AssessmentPlan;
  queuePosition: number;
  status: JobStatus;
  steps: Array<{
    id: "sent" | "preparing" | "ready";
    state: StepState;
  }>;
};

const globalJobs = globalThis as typeof globalThis & {
  healthspanAssessmentJobs?: Map<string, AssessmentJob>;
};

const jobs = globalJobs.healthspanAssessmentJobs ?? new Map<string, AssessmentJob>();
globalJobs.healthspanAssessmentJobs = jobs;

const uuidPlanStartMs = Date.UTC(2026, 0, 1);
const uuidPlanCodes: Record<AssessmentPlan, number> = {
  free: 0,
  precision: 1,
  pro: 2
};

function decodePlanCode(code: number): AssessmentPlan | null {
  if (code === uuidPlanCodes.pro) {
    return "pro";
  }

  if (code === uuidPlanCodes.precision) {
    return "precision";
  }

  if (code === uuidPlanCodes.free) {
    return "free";
  }

  return null;
}

function formatUuid(hex: string) {
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20)
  ].join("-");
}

function randomHex(length: number) {
  return crypto.randomUUID().replaceAll("-", "").slice(0, length);
}

function createPortablePlanId(job: Omit<AssessmentJob, "id">) {
  const timestampHex = Math.max(0, job.createdAt)
    .toString(16)
    .padStart(12, "0")
    .slice(-12);
  const random40 = BigInt(`0x${randomHex(10)}`);
  const payload =
    (random40 << BigInt(32)) |
    (BigInt(uuidPlanCodes[job.plan]) << BigInt(30)) |
    (BigInt(job.initialQueue) << BigInt(26)) |
    (BigInt(job.queueMs) << BigInt(13)) |
    BigInt(job.formulationMs);
  const payloadHex = payload.toString(16).padStart(18, "0").slice(-18);
  const hex =
    timestampHex +
    "7" +
    payloadHex.slice(0, 3) +
    "8" +
    payloadHex.slice(3);

  return formatUuid(hex);
}

function decodePortableUuidPlanId(id: string): AssessmentJob | null {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      id
    )
  ) {
    return null;
  }

  const normalizedId = id.toLowerCase();
  const hex = normalizedId.replaceAll("-", "");
  const createdAt = Number.parseInt(hex.slice(0, 12), 16);
  const payload = BigInt(`0x${hex.slice(13, 16)}${hex.slice(17)}`);
  const plan = decodePlanCode(Number((payload >> BigInt(30)) & BigInt(0x3)));
  const initialQueue = Number((payload >> BigInt(26)) & BigInt(0xf));
  const queueMs = Number((payload >> BigInt(13)) & BigInt(0x1fff));
  const formulationMs = Number(payload & BigInt(0x1fff));

  if (
    !Number.isSafeInteger(createdAt) ||
    createdAt < uuidPlanStartMs ||
    createdAt > Date.now() + 1000 * 60 * 5 ||
    initialQueue < 1 ||
    queueMs < 1000 ||
    formulationMs < 1000 ||
    !plan
  ) {
    return null;
  }

  return {
    createdAt,
    formulationMs,
    id: normalizedId,
    initialQueue,
    plan,
    queueMs,
    updatedAt: createdAt
  };
}

function decodeLegacyPlanCode(code: string): AssessmentPlan | null {
  if (code === "p") {
    return "pro";
  }

  if (code === "o") {
    return "precision";
  }

  if (code === "f") {
    return "free";
  }

  return null;
}

function decodeLegacyNumber(value: string) {
  const parsed = Number.parseInt(value, 36);
  return Number.isFinite(parsed) ? parsed : null;
}

function decodeLegacyPortablePlanId(id: string): AssessmentJob | null {
  const [prefix, randomId, createdAtRaw, planRaw, queueRaw, queueMsRaw, formulationMsRaw] =
    id.split("_");

  if (prefix !== "hs" || !/^[a-f0-9]{32}$/.test(randomId ?? "")) {
    return null;
  }

  const createdAt = decodeLegacyNumber(createdAtRaw ?? "");
  const initialQueue = decodeLegacyNumber(queueRaw ?? "");
  const queueMs = decodeLegacyNumber(queueMsRaw ?? "");
  const formulationMs = decodeLegacyNumber(formulationMsRaw ?? "");
  const plan = decodeLegacyPlanCode(planRaw ?? "");

  if (
    createdAt === null ||
    initialQueue === null ||
    queueMs === null ||
    formulationMs === null ||
    !plan
  ) {
    return null;
  }

  return {
    createdAt,
    formulationMs,
    id,
    initialQueue,
    plan,
    queueMs,
    updatedAt: createdAt
  };
}

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function normalizeAssessmentPlan(plan: unknown): AssessmentPlan {
  if (plan === "pro") {
    return "pro";
  }

  if (plan === "precision") {
    return "precision";
  }

  return "free";
}

function pruneJobs() {
  const staleBefore = Date.now() - 1000 * 60 * 30;

  for (const [id, job] of jobs.entries()) {
    if (job.createdAt < staleBefore) {
      jobs.delete(id);
    }
  }
}

type AssessmentJobInput = Readonly<{
  answers?: unknown;
  locale?: unknown;
  plan?: unknown;
}>;

function normalizeLocale(locale: unknown) {
  return locale === "th" ? "th" : "en";
}

export function createAssessmentJob(input: AssessmentJobInput | unknown = {}) {
  pruneJobs();

  const payload =
    input && typeof input === "object" && !Array.isArray(input)
      ? (input as AssessmentJobInput)
      : { plan: input };
  const portableJob: Omit<AssessmentJob, "id"> = {
    answers: payload.answers,
    createdAt: Date.now(),
    formulationMs: randomInt(4500, 7500),
    initialQueue: randomInt(3, 8),
    locale: normalizeLocale(payload.locale),
    plan: normalizeAssessmentPlan(payload.plan),
    queueMs: randomInt(3500, 6500),
    updatedAt: Date.now()
  };
  const job: AssessmentJob = {
    ...portableJob,
    id: createPortablePlanId(portableJob)
  };

  jobs.set(job.id, job);

  const snapshot = getAssessmentJobSnapshot(job.id);

  if (!snapshot) {
    throw new Error("Unable to create assessment plan");
  }

  return snapshot;
}

export function updateAssessmentJob(id: string, input: AssessmentJobInput) {
  pruneJobs();

  const existing =
    jobs.get(id) ?? decodePortableUuidPlanId(id) ?? decodeLegacyPortablePlanId(id);

  if (!existing) {
    return null;
  }

  const nextPlan =
    input.plan === undefined
      ? existing.plan
      : normalizeAssessmentPlan(input.plan);
  const updatedJob: AssessmentJob = {
    ...existing,
    answers: input.answers ?? existing.answers,
    locale:
      input.locale === undefined ? existing.locale : normalizeLocale(input.locale),
    plan: nextPlan,
    updatedAt: Date.now()
  };
  const nextId =
    nextPlan === existing.plan ? existing.id : createPortablePlanId(updatedJob);
  const storedJob: AssessmentJob = {
    ...updatedJob,
    id: nextId
  };

  if (nextId !== existing.id) {
    jobs.delete(existing.id);
  }

  jobs.set(storedJob.id, storedJob);

  return getAssessmentJobSnapshot(storedJob.id);
}

export function getAssessmentJobSnapshot(id: string): AssessmentJobSnapshot | null {
  const job =
    jobs.get(id) ?? decodePortableUuidPlanId(id) ?? decodeLegacyPortablePlanId(id);

  if (!job) {
    return null;
  }

  const elapsed = Date.now() - job.createdAt;
  const readyAt = job.queueMs + job.formulationMs;
  const status: JobStatus =
    elapsed >= readyAt ? "ready" : elapsed >= job.queueMs ? "preparing" : "queued";
  const queueProgress = Math.min(1, elapsed / job.queueMs);
  const queuePosition =
    status === "queued"
      ? Math.max(1, Math.ceil(job.initialQueue * (1 - queueProgress)))
      : 0;

  return {
    planId: job.id,
    plan: job.plan ?? "free",
    queuePosition,
    status,
    steps: [
      { id: "sent", state: "complete" },
      {
        id: "preparing",
        state: status === "ready" ? "complete" : "active"
      },
      {
        id: "ready",
        state: status === "ready" ? "complete" : "pending"
      }
    ]
  };
}
