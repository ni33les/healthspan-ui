type AssessmentStatus = "queued" | "preparing" | "ready";
type StepState = "active" | "complete" | "pending";

export type AssessmentPlan = "free" | "precision" | "pro";

export type AssessmentSnapshot = {
  planId: string;
  plan: AssessmentPlan;
  queuePosition: number;
  status: AssessmentStatus;
  steps: Array<{
    id: "sent" | "preparing" | "ready";
    state: StepState;
  }>;
};

type AssessmentSnapshotInput = Readonly<{
  plan?: unknown;
  planId?: string;
  queuePosition?: number | null;
  status?: AssessmentStatus;
}>;

function randomQueuePosition() {
  return Math.floor(Math.random() * 6) + 3;
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

export function buildAssessmentSteps(status: AssessmentStatus) {
  return [
    { id: "sent", state: "complete" },
    {
      id: "preparing",
      state: status === "ready" ? "complete" : "active"
    },
    {
      id: "ready",
      state: status === "ready" ? "complete" : "pending"
    }
  ] satisfies AssessmentSnapshot["steps"];
}

export function createAssessmentSnapshot({
  plan,
  planId = crypto.randomUUID(),
  queuePosition,
  status = "queued"
}: AssessmentSnapshotInput = {}) {
  const normalizedQueuePosition =
    status === "queued" ? Math.max(1, queuePosition ?? randomQueuePosition()) : 0;

  return {
    plan: normalizeAssessmentPlan(plan),
    planId,
    queuePosition: normalizedQueuePosition,
    status,
    steps: buildAssessmentSteps(status)
  } satisfies AssessmentSnapshot;
}
