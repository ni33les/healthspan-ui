export const TASK_PRIORITY = {
  doNow: 6,
  high: 4,
  low: 2,
  normal: 3,
  urgent: 5,
  whenYouCan: 1
} as const;

export type TaskPriority = 1 | 2 | 3 | 4 | 5 | 6;

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

  return Math.max(1, Math.min(6, Math.round(numeric))) as TaskPriority;
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
