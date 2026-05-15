import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  normalizeFoodBenefitTags,
  normalizeFoodNutrientTags,
  parseFoodBenefitTagInput,
  parseFoodNutrientTagInput
} from "../lib/food-tags.ts";

describe("food benefit and nutrient tags", () => {
  it("normalizes and deduplicates curated food tags", () => {
    assert.deepEqual(
      normalizeFoodBenefitTags([
        "Gut-Health",
        "gut_health",
        "unknown",
        "energy-support"
      ]),
      ["energy_support", "gut_health"]
    );
    assert.deepEqual(
      normalizeFoodNutrientTags(["Vitamin-C", "vitamin_c", "fiber"]),
      ["fiber", "vitamin_c"]
    );
  });

  it("rejects unknown or malformed tags for admin mutation input", () => {
    assert.deepEqual(
      parseFoodBenefitTagInput(["gut-health", "gut_health"]),
      ["gut_health"]
    );
    assert.deepEqual(parseFoodNutrientTagInput(["fiber", "Vitamin-C"]), [
      "fiber",
      "vitamin_c"
    ]);
    assert.equal(parseFoodBenefitTagInput(["made_up_benefit"]), null);
    assert.equal(parseFoodNutrientTagInput("fiber"), null);
    assert.equal(parseFoodNutrientTagInput([123]), null);
    assert.equal(parseFoodBenefitTagInput(undefined), undefined);
  });
});
