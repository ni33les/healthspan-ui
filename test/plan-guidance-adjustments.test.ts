import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyPlanGuidanceAdjustmentsToFoodGuidance,
  applyPlanGuidanceAdjustmentsToFormulation,
  inferGuidanceRemovalAdjustments
} from "../lib/plan-guidance-adjustments.ts";
import type {
  FoodGuidanceBlueprint,
  FormulationBlueprint
} from "../lib/formulation-types.ts";

const formulation: FormulationBlueprint = {
  supplementBreakdown: [
    {
      category: "Foundation",
      dailyDose: "200 mg/day",
      effectivenessRank: 1,
      id: "magnesium-glycinate",
      rationale: "Supports recovery.",
      status: "add",
      supplement: "Magnesium glycinate"
    },
    {
      category: "Targeted",
      dailyDose: "1 g/day",
      effectivenessRank: 2,
      id: "omega-3",
      rationale: "Supports heart health.",
      status: "add",
      supplement: "Omega-3"
    }
  ]
};

const foodGuidance: FoodGuidanceBlueprint = {
  foodGuidance: [
    {
      category: "Seeds",
      effectivenessRank: 1,
      food: "Chia seeds",
      frequency: "4 times/week",
      id: "chia-seeds",
      rationale: "Adds fiber.",
      serving: "1 tbsp",
      status: "add"
    },
    {
      category: "Fruit and vegetables",
      effectivenessRank: 2,
      food: "Leafy greens",
      frequency: "Daily",
      id: "leafy-greens",
      rationale: "Adds minerals.",
      serving: "1 cup",
      status: "add"
    }
  ]
};

describe("plan guidance adjustments", () => {
  it("removes matched supplements and foods from visible guidance", () => {
    assert.deepEqual(
      applyPlanGuidanceAdjustmentsToFormulation(formulation, [
        {
          action: "remove",
          itemId: "magnesium-glycinate",
          itemName: "Magnesium glycinate",
          itemType: "supplement"
        }
      ]).supplementBreakdown.map((item) => item.id),
      ["omega-3"]
    );

    assert.deepEqual(
      applyPlanGuidanceAdjustmentsToFoodGuidance(foodGuidance, [
        {
          action: "remove",
          itemName: "Leafy greens",
          itemType: "food"
        }
      ]).foodGuidance.map((item) => item.id),
      ["chia-seeds"]
    );
  });

  it("infers exact item removals from plain chat text", () => {
    assert.deepEqual(
      inferGuidanceRemovalAdjustments({
        foodGuidance,
        formulation,
        userMessage: "Please remove Magnesium glycinate and skip leafy greens."
      }).map((adjustment) => [
        adjustment.itemType,
        adjustment.itemId,
        adjustment.itemName
      ]),
      [
        ["supplement", "magnesium-glycinate", "Magnesium glycinate"],
        ["food", "leafy-greens", "Leafy greens"]
      ]
    );
  });
});
