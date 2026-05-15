import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildFoodNutrientFacts,
  completeFoodNutrientProfile,
  normalizeFoodNutrientProfileInput,
  normalizeFoodServingSize
} from "../lib/food-nutrients.ts";

describe("food nutrient facts", () => {
  it("normalizes serving sizes and per-100g profile input", () => {
    assert.deepEqual(
      normalizeFoodServingSize({
        grams: "12",
        label: "1 tbsp",
        source: "admin"
      }),
      {
        grams: 12,
        isDefault: true,
        label: "1 tbsp",
        source: "admin"
      }
    );
    assert.deepEqual(
      normalizeFoodNutrientProfileInput([
        {
          amountPer100g: "34.44444",
          nutrientId: "fiber_g",
          source: "admin"
        },
        {
          amountPer100g: 999,
          nutrientId: "not_real"
        }
      ]),
      null
    );
    assert.deepEqual(
      normalizeFoodNutrientProfileInput([
        {
          amountPer100g: "34.44444",
          nutrientId: "fiber_g",
          source: "admin"
        }
      ]),
      [
        {
          amountPer100g: 34.4444,
          category: "Macronutrients",
          confidence: "moderate",
          label: "Fiber",
          nutrientId: "fiber_g",
          source: "admin",
          unit: "g"
        }
      ]
    );
  });

  it("calculates serving amounts from curated per-100g values", () => {
    const profile = completeFoodNutrientProfile([
      {
        amountPer100g: 34.4,
        nutrientId: "fiber_g",
        source: "test"
      },
      {
        amountPer100g: 17.8,
        nutrientId: "omega_3_g",
        source: "test"
      }
    ]);

    assert.deepEqual(
      buildFoodNutrientFacts(profile, 12).map((fact) => [
        fact.nutrientId,
        fact.amountPerServing,
        fact.unit
      ]),
      [
        ["fiber_g", 4.13, "g"],
        ["omega_3_g", 2.14, "g"]
      ]
    );
  });
});

