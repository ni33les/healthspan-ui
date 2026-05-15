export const foodBenefitTags = [
  "gut_health",
  "heart_health",
  "metabolic_health",
  "anti_inflammatory",
  "immune_support",
  "energy_support",
  "skin_health",
  "recovery_support"
] as const;

export const foodNutrientTags = [
  "fiber",
  "protein",
  "omega_3",
  "magnesium",
  "zinc",
  "calcium",
  "iron",
  "potassium",
  "vitamin_a",
  "vitamin_c",
  "vitamin_d",
  "folate",
  "polyphenols",
  "probiotics"
] as const;

export type FoodBenefitTag = (typeof foodBenefitTags)[number];
export type FoodNutrientTag = (typeof foodNutrientTags)[number];

const benefitSet = new Set<string>(foodBenefitTags);
const nutrientSet = new Set<string>(foodNutrientTags);

function normalizedTag(value: unknown) {
  return typeof value === "string"
    ? value.trim().toLowerCase().replaceAll("-", "_")
    : "";
}

function normalizedTagInput(values: unknown) {
  if (values === undefined) {
    return undefined;
  }

  if (!Array.isArray(values) || values.some((value) => typeof value !== "string")) {
    return null;
  }

  return values.map(normalizedTag).filter(Boolean);
}

function normalizeKnownTags<T extends string>(
  values: unknown,
  allowed: Set<string>
) {
  if (!Array.isArray(values)) {
    return [];
  }

  return [
    ...new Set(
      values
        .map(normalizedTag)
        .filter((tag): tag is T => allowed.has(tag))
    )
  ].sort();
}

function parseKnownTagInput<T extends string>(
  values: unknown,
  allowed: Set<string>
) {
  const tags = normalizedTagInput(values);

  if (tags === undefined) {
    return undefined;
  }

  if (tags === null || tags.some((tag) => !allowed.has(tag))) {
    return null;
  }

  return [...new Set(tags as T[])].sort();
}

export function normalizeFoodBenefitTags(values: unknown): FoodBenefitTag[] {
  return normalizeKnownTags<FoodBenefitTag>(values, benefitSet);
}

export function normalizeFoodNutrientTags(values: unknown): FoodNutrientTag[] {
  return normalizeKnownTags<FoodNutrientTag>(values, nutrientSet);
}

export function parseFoodBenefitTagInput(
  values: unknown
): FoodBenefitTag[] | null | undefined {
  return parseKnownTagInput<FoodBenefitTag>(values, benefitSet);
}

export function parseFoodNutrientTagInput(
  values: unknown
): FoodNutrientTag[] | null | undefined {
  return parseKnownTagInput<FoodNutrientTag>(values, nutrientSet);
}

export function foodTagLabel(value: string) {
  return value
    .split("_")
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}
