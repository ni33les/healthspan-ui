export type SupplementSafetyFlag =
  | "allergy_caution"
  | "bleeding_risk"
  | "condition_caution"
  | "contamination_risk"
  | "exclude_automated_use"
  | "general_caution"
  | "hormone_caution"
  | "kidney_caution"
  | "liver_caution"
  | "medication_interaction"
  | "pregnancy_caution"
  | "regulatory_risk"
  | "stimulant"
  | "upper_dose_risk";

export const supplementSafetyFlags = [
  "general_caution",
  "upper_dose_risk",
  "medication_interaction",
  "condition_caution",
  "pregnancy_caution",
  "bleeding_risk",
  "liver_caution",
  "kidney_caution",
  "stimulant",
  "hormone_caution",
  "allergy_caution",
  "contamination_risk",
  "regulatory_risk",
  "exclude_automated_use"
] as const satisfies SupplementSafetyFlag[];

const safetyFlags = new Set<SupplementSafetyFlag>(supplementSafetyFlags);

export function isSupplementSafetyFlag(
  value: unknown
): value is SupplementSafetyFlag {
  return (
    typeof value === "string" &&
    safetyFlags.has(value as SupplementSafetyFlag)
  );
}

export function isSupplementSafetyFlags(
  value: unknown
): value is SupplementSafetyFlag[] {
  return Array.isArray(value) && value.every(isSupplementSafetyFlag);
}

export function normalizeSupplementSafetyFlags(
  value: unknown
): SupplementSafetyFlag[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return [...new Set(value)].filter(isSupplementSafetyFlag);
}
