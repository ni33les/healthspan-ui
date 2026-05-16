import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  inferPlanFeedbackFromMessage,
  isPlanRefinementRequest,
  normalizePlanFeedbackItems
} from "../lib/plan-feedback.ts";

describe("plan feedback", () => {
  it("normalizes OpenClaw feedback payloads", () => {
    assert.deepEqual(
      normalizePlanFeedbackItems([
        {
          body: "Prefer Thai foods",
          feedbackType: "cuisine",
          itemType: "plan"
        },
        {
          body: "",
          feedbackType: "nonsense"
        }
      ]).map((item) => [
        item.feedbackType,
        item.itemType,
        item.body,
        item.urgency
      ]),
      [
        ["cuisine", "plan", "Prefer Thai foods", "normal"]
      ]
    );
  });

  it("infers safety and preference feedback from chat text", () => {
    assert.deepEqual(
      inferPlanFeedbackFromMessage({
        message: "I am diabetic and I don't like leafy greens. Fewer capsules please."
      }).map((item) => [item.feedbackType, item.itemType, item.urgency]),
      [
        ["safety_disclosure", "condition", "safety"],
        ["removal", "plan", "normal"],
        ["capsule_limit", "supplement", "normal"]
      ]
    );
  });

  it("turns legacy removal adjustments into refinement feedback", () => {
    assert.deepEqual(
      inferPlanFeedbackFromMessage({
        adjustments: [
          {
            action: "remove",
            itemId: "magnesium-glycinate",
            itemName: "Magnesium glycinate",
            itemType: "supplement",
            reason: "Client asked to remove it."
          }
        ],
        message: "Remove magnesium please."
      }).map((item) => [
        item.feedbackType,
        item.itemType,
        item.itemId ?? null,
        item.itemName ?? null
      ])[0],
      ["removal", "supplement", "magnesium-glycinate", "Magnesium glycinate"]
    );
  });

  it("recognizes explicit plan refinement requests", () => {
    assert.equal(isPlanRefinementRequest("Go ahead and regenerate the plan."), true);
    assert.equal(isPlanRefinementRequest("Please refine the nutrition guidance now."), true);
    assert.equal(isPlanRefinementRequest("Okay deliver the plan."), true);
    assert.equal(isPlanRefinementRequest("No that's it. all good."), true);
    assert.equal(isPlanRefinementRequest("No more changes."), true);
    assert.equal(isPlanRefinementRequest("Not yet, don't update the plan."), false);
    assert.equal(isPlanRefinementRequest("No need to update the plan."), false);
    assert.equal(isPlanRefinementRequest("No thanks"), false);
  });
});
