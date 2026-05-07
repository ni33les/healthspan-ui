type AssessmentStatus = "failed" | "queued" | "preparing" | "ready";
type StepState = "active" | "complete" | "failed" | "pending";

export type AssessmentPlan = "precision" | "pro";

export const DEFAULT_ASSESSMENT_PLAN: AssessmentPlan = "precision";

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

export function isAssessmentPlan(plan: unknown): plan is AssessmentPlan {
  if (plan === "pro") {
    return true;
  }

  if (plan === "precision") {
    return true;
  }

  return false;
}

export function normalizeAssessmentPlan(plan: unknown): AssessmentPlan {
  return isAssessmentPlan(plan) ? plan : DEFAULT_ASSESSMENT_PLAN;
}

export function buildAssessmentSteps(status: AssessmentStatus) {
  return [
    { id: "sent", state: "complete" },
    {
      id: "preparing",
      state:
        status === "ready"
          ? "complete"
          : status === "failed"
            ? "failed"
            : "active"
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
    status === "queued" ? Math.max(1, queuePosition ?? 1) : 0;

  return {
    plan: normalizeAssessmentPlan(plan),
    planId,
    queuePosition: normalizedQueuePosition,
    status,
    steps: buildAssessmentSteps(status)
  } satisfies AssessmentSnapshot;
}
