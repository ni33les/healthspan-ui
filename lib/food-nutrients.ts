export const foodNutrientCatalog = [
  { category: "Energy", id: "energy_kcal", label: "Energy", unit: "kcal" },
  { category: "Macronutrients", id: "protein_g", label: "Protein", unit: "g" },
  { category: "Macronutrients", id: "carbohydrate_g", label: "Carbohydrate", unit: "g" },
  { category: "Macronutrients", id: "fiber_g", label: "Fiber", unit: "g" },
  { category: "Macronutrients", id: "sugar_g", label: "Sugar", unit: "g" },
  { category: "Macronutrients", id: "total_fat_g", label: "Total fat", unit: "g" },
  { category: "Macronutrients", id: "saturated_fat_g", label: "Saturated fat", unit: "g" },
  { category: "Macronutrients", id: "omega_3_g", label: "Omega-3", unit: "g" },
  { category: "Macronutrients", id: "omega_6_g", label: "Omega-6", unit: "g" },
  { category: "Minerals", id: "calcium_mg", label: "Calcium", unit: "mg" },
  { category: "Minerals", id: "iron_mg", label: "Iron", unit: "mg" },
  { category: "Minerals", id: "magnesium_mg", label: "Magnesium", unit: "mg" },
  { category: "Minerals", id: "phosphorus_mg", label: "Phosphorus", unit: "mg" },
  { category: "Minerals", id: "potassium_mg", label: "Potassium", unit: "mg" },
  { category: "Minerals", id: "sodium_mg", label: "Sodium", unit: "mg" },
  { category: "Minerals", id: "zinc_mg", label: "Zinc", unit: "mg" },
  { category: "Minerals", id: "selenium_mcg", label: "Selenium", unit: "mcg" },
  { category: "Minerals", id: "copper_mg", label: "Copper", unit: "mg" },
  { category: "Minerals", id: "manganese_mg", label: "Manganese", unit: "mg" },
  { category: "Vitamins", id: "vitamin_a_mcg_rae", label: "Vitamin A", unit: "mcg RAE" },
  { category: "Vitamins", id: "vitamin_c_mg", label: "Vitamin C", unit: "mg" },
  { category: "Vitamins", id: "vitamin_d_mcg", label: "Vitamin D", unit: "mcg" },
  { category: "Vitamins", id: "vitamin_e_mg", label: "Vitamin E", unit: "mg" },
  { category: "Vitamins", id: "vitamin_k_mcg", label: "Vitamin K", unit: "mcg" },
  { category: "Vitamins", id: "thiamin_mg", label: "Thiamin", unit: "mg" },
  { category: "Vitamins", id: "riboflavin_mg", label: "Riboflavin", unit: "mg" },
  { category: "Vitamins", id: "niacin_mg", label: "Niacin", unit: "mg" },
  { category: "Vitamins", id: "vitamin_b6_mg", label: "Vitamin B6", unit: "mg" },
  { category: "Vitamins", id: "folate_mcg_dfe", label: "Folate", unit: "mcg DFE" },
  { category: "Vitamins", id: "vitamin_b12_mcg", label: "Vitamin B12", unit: "mcg" },
  { category: "Other", id: "choline_mg", label: "Choline", unit: "mg" },
  { category: "Other", id: "caffeine_mg", label: "Caffeine", unit: "mg" },
  { category: "Other", id: "polyphenols_mg", label: "Polyphenols", unit: "mg" },
  { category: "Other", id: "probiotics_cfu", label: "Probiotics", unit: "CFU" }
] as const;

export type FoodNutrientId = (typeof foodNutrientCatalog)[number]["id"];
export type FoodNutrientConfidence = "high" | "low" | "moderate";

export type FoodServingSize = Readonly<{
  grams: number;
  isDefault: boolean;
  label: string;
  source: string | null;
}>;

export type FoodNutrientProfileValue = Readonly<{
  amountPer100g: number | null;
  category: string;
  confidence: FoodNutrientConfidence | null;
  label: string;
  nutrientId: FoodNutrientId;
  source: string | null;
  unit: string;
}>;

export type FoodNutrientFact = Readonly<{
  amountPer100g: number;
  amountPerServing: number;
  category: string;
  confidence: FoodNutrientConfidence | null;
  label: string;
  nutrientId: FoodNutrientId;
  servingGrams: number;
  source: string | null;
  unit: string;
}>;

const nutrientIds = new Set<string>(
  foodNutrientCatalog.map((nutrient) => nutrient.id)
);

export function isFoodNutrientId(value: string): value is FoodNutrientId {
  return nutrientIds.has(value);
}

export function nutrientDefinition(id: string) {
  return foodNutrientCatalog.find((nutrient) => nutrient.id === id) ?? null;
}

export function normalizedNutrientAmount(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const amount = Number(value);

  if (!Number.isFinite(amount) || amount < 0 || amount > 1_000_000_000) {
    return null;
  }

  return Math.round(amount * 10000) / 10000;
}

function normalizedConfidence(value: unknown): FoodNutrientConfidence | null {
  return value === "high" || value === "low" || value === "moderate"
    ? value
    : null;
}

function textOrNull(value: unknown, maxLength = 200) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  return trimmed ? trimmed.slice(0, maxLength) : null;
}

export function normalizeFoodServingSize(value: unknown): FoodServingSize | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const label = textOrNull(record.label, 80);
  const grams = normalizedNutrientAmount(record.grams);

  if (!label || !grams || grams <= 0) {
    return null;
  }

  return {
    grams,
    isDefault: true,
    label,
    source: textOrNull(record.source)
  };
}

export function normalizeFoodNutrientProfileInput(values: unknown) {
  if (values === undefined) {
    return undefined;
  }

  if (!Array.isArray(values)) {
    return null;
  }

  const byNutrient = new Map<FoodNutrientId, FoodNutrientProfileValue>();

  for (const value of values) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return null;
    }

    const record = value as Record<string, unknown>;
    const nutrientId =
      typeof record.nutrientId === "string" && isFoodNutrientId(record.nutrientId)
        ? record.nutrientId
        : null;
    const definition = nutrientId ? nutrientDefinition(nutrientId) : null;

    if (!nutrientId || !definition) {
      return null;
    }

    byNutrient.set(nutrientId, {
      amountPer100g: normalizedNutrientAmount(record.amountPer100g),
      category: definition.category,
      confidence: normalizedConfidence(record.confidence) ?? "moderate",
      label: definition.label,
      nutrientId,
      source: textOrNull(record.source) ?? "admin",
      unit: definition.unit
    });
  }

  return [...byNutrient.values()].sort(
    (left, right) =>
      foodNutrientCatalog.findIndex((item) => item.id === left.nutrientId) -
      foodNutrientCatalog.findIndex((item) => item.id === right.nutrientId)
  );
}

export function completeFoodNutrientProfile(values: unknown) {
  const normalized = normalizeFoodNutrientProfileInput(
    Array.isArray(values) ? values : []
  );
  const existing = new Map(
    (normalized ?? []).map((value) => [value.nutrientId, value])
  );

  return foodNutrientCatalog.map<FoodNutrientProfileValue>((definition) => {
    const value = existing.get(definition.id);

    return {
      amountPer100g: value?.amountPer100g ?? null,
      category: definition.category,
      confidence: value?.confidence ?? null,
      label: definition.label,
      nutrientId: definition.id,
      source: value?.source ?? null,
      unit: definition.unit
    };
  });
}

export function calculateNutrientPerServing(
  amountPer100g: number,
  servingGrams: number
) {
  return Math.round(((amountPer100g * servingGrams) / 100) * 100) / 100;
}

export function buildFoodNutrientFacts(
  profile: readonly FoodNutrientProfileValue[],
  servingGrams: number | null | undefined
) {
  if (!servingGrams || servingGrams <= 0) {
    return [];
  }

  return profile
    .filter(
      (value): value is FoodNutrientProfileValue & { amountPer100g: number } =>
        value.amountPer100g !== null
    )
    .map<FoodNutrientFact>((value) => ({
      ...value,
      amountPer100g: value.amountPer100g,
      amountPerServing: calculateNutrientPerServing(value.amountPer100g, servingGrams),
      servingGrams
    }));
}

