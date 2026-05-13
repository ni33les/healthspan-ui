export const TASK_PRIORITY = {
  critical: 5,
  expedited: 3,
  high: 4,
  low: 1,
  normal: 2
} as const;

export type TaskPriority = 1 | 2 | 3 | 4 | 5;
export type TaskDependencyType = "approved" | "complete" | "successful";
export type TaskIdempotencyScope = "active" | "successful";

export type TaskRetryPolicyInput =
  | false
  | null
  | undefined
  | Readonly<{
      backoffMultiplier?: unknown;
      initialDelaySeconds?: unknown;
      maxDelaySeconds?: unknown;
      maxRetries?: unknown;
    }>;

export type NormalizedTaskRetryPolicy = Readonly<{
  backoffMultiplier: number;
  initialDelaySeconds: number;
  maxDelaySeconds: number;
  maxRetries: number;
}>;

const TERMINAL_TASK_STATUSES = new Set([
  "cancelled",
  "completed",
  "failed",
  "skipped"
]);
const SUCCESSFUL_TASK_STATUSES = new Set(["completed", "skipped"]);

export type TaskSequenceDependencyInput = Readonly<{
  key?: string | null;
  taskId?: string | null;
  type?: TaskDependencyType;
}>;

export type TaskSequencePlanTaskInput = Readonly<{
  dependsOn?: ReadonlyArray<TaskSequenceDependencyInput>;
  key?: string | null;
  title?: string;
  taskType: string;
}>;

export type TaskSequencePlanStageInput = Readonly<{
  dependencyType?: TaskDependencyType;
  dependsOnPreviousStage?: boolean;
  tasks: ReadonlyArray<TaskSequencePlanTaskInput>;
}>;

export type TaskSequencePlanItem = Readonly<{
  dependencies: ReadonlyArray<Readonly<{
    key?: string;
    taskId?: string;
    type: TaskDependencyType;
  }>>;
  key: string;
  stageIndex: number;
  taskIndex: number;
}>;

export function normalizeTaskPriority(value: unknown): TaskPriority {
  const numeric =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number(value)
        : TASK_PRIORITY.normal;

  if (!Number.isFinite(numeric)) {
    return TASK_PRIORITY.normal;
  }

  return Math.max(1, Math.min(5, Math.round(numeric))) as TaskPriority;
}

function boundedNumber(
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number
) {
  const numeric =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number(value)
        : fallback;

  if (!Number.isFinite(numeric)) {
    return fallback;
  }

  return Math.max(minimum, Math.min(maximum, numeric));
}

function boundedInteger(
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number
) {
  return Math.round(boundedNumber(value, fallback, minimum, maximum));
}

export function normalizeTaskIdempotencyScope(
  value: unknown
): TaskIdempotencyScope {
  return value === "successful" ? "successful" : "active";
}

export function taskStatusMatchesIdempotencyScope(
  status: string,
  scope: TaskIdempotencyScope
) {
  if (!TERMINAL_TASK_STATUSES.has(status)) {
    return true;
  }

  return scope === "successful" && SUCCESSFUL_TASK_STATUSES.has(status);
}

export function normalizeTaskRetryPolicy(
  value: TaskRetryPolicyInput
): NormalizedTaskRetryPolicy | null {
  if (value === false || value === null || value === undefined) {
    return null;
  }

  const maxRetries = boundedInteger(value.maxRetries, 0, 0, 10);

  if (maxRetries < 1) {
    return null;
  }

  return {
    backoffMultiplier: boundedNumber(value.backoffMultiplier, 2, 1, 5),
    initialDelaySeconds: boundedInteger(
      value.initialDelaySeconds,
      300,
      30,
      86_400
    ),
    maxDelaySeconds: Math.max(
      boundedInteger(value.initialDelaySeconds, 300, 30, 86_400),
      boundedInteger(value.maxDelaySeconds, 3_600, 30, 86_400)
    ),
    maxRetries
  };
}

export function taskRetryDelaySeconds(
  retryAttempt: number,
  policy: NormalizedTaskRetryPolicy
) {
  const retryNumber = Math.max(1, Math.round(retryAttempt));
  const delay =
    policy.initialDelaySeconds *
    Math.pow(policy.backoffMultiplier, retryNumber - 1);

  return Math.round(Math.min(policy.maxDelaySeconds, delay));
}

export function normalizeCapabilities(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .map((item) =>
          typeof item === "string" ? item.trim().toLowerCase() : ""
        )
        .filter(Boolean)
    )
  ).sort();
}

export function hasRequiredCapabilities(
  requiredCapabilities: readonly string[],
  availableCapabilities: readonly string[]
) {
  if (requiredCapabilities.length < 1) {
    return true;
  }

  const available = new Set(normalizeCapabilities([...availableCapabilities]));

  return normalizeCapabilities([...requiredCapabilities]).every((capability) =>
    available.has(capability)
  );
}

export function normalizeLeaseSeconds(value: unknown) {
  const numeric =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number(value)
        : 300;

  if (!Number.isFinite(numeric)) {
    return 300;
  }

  return Math.max(30, Math.min(3600, Math.round(numeric)));
}

function optionalText(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  return trimmed ? trimmed : null;
}

function cleanText(value: unknown, fallback: string) {
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmed = value.trim();

  return trimmed ? trimmed : fallback;
}

function uuidOrNull(value: unknown) {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ? value
    : null;
}

export function normalizeTaskDependencyType(value: unknown): TaskDependencyType {
  return value === "approved" || value === "successful" ? value : "complete";
}

function sequenceTaskKey(
  task: Pick<TaskSequencePlanTaskInput, "key" | "taskType">,
  stageIndex: number,
  taskIndex: number
) {
  return (
    optionalText(task.key) ??
    `${stageIndex + 1}.${taskIndex + 1}:${cleanText(task.taskType, "task")}`
  );
}

export function buildTaskSequenceDependencyPlan(
  stages: ReadonlyArray<TaskSequencePlanStageInput>
): TaskSequencePlanItem[] {
  const knownKeys = new Set<string>();
  const plan: TaskSequencePlanItem[] = [];
  let previousStageKeys: string[] = [];

  stages.forEach((stage, stageIndex) => {
    const currentStageKeys: string[] = [];

    stage.tasks.forEach((task, taskIndex) => {
      const key = sequenceTaskKey(task, stageIndex, taskIndex);

      if (knownKeys.has(key)) {
        throw new Error(`Duplicate task sequence key: ${key}`);
      }

      const dependencies: Array<{
        key?: string;
        taskId?: string;
        type: TaskDependencyType;
      }> = [];
      const stageDependencyType = normalizeTaskDependencyType(stage.dependencyType);

      if (stageIndex > 0 && stage.dependsOnPreviousStage !== false) {
        for (const previousKey of previousStageKeys) {
          dependencies.push({
            key: previousKey,
            type: stageDependencyType
          });
        }
      }

      for (const dependency of task.dependsOn ?? []) {
        const dependencyKey = optionalText(dependency.key);
        const dependencyTaskId = uuidOrNull(dependency.taskId);
        const dependencyType = normalizeTaskDependencyType(dependency.type);

        if (dependencyKey) {
          if (!knownKeys.has(dependencyKey)) {
            throw new Error(`Unknown task sequence dependency key: ${dependencyKey}`);
          }

          dependencies.push({
            key: dependencyKey,
            type: dependencyType
          });
          continue;
        }

        if (!dependencyTaskId) {
          throw new Error("Task sequence dependency requires a known key or valid taskId");
        }

        dependencies.push({
          taskId: dependencyTaskId,
          type: dependencyType
        });
      }

      plan.push({
        dependencies,
        key,
        stageIndex,
        taskIndex
      });
      knownKeys.add(key);
      currentStageKeys.push(key);
    });

    previousStageKeys = currentStageKeys;
  });

  return plan;
}
