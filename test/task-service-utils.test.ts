import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  hasRequiredCapabilities,
  normalizeCapabilities,
  normalizeLeaseSeconds,
  normalizeTaskPriority,
  TASK_PRIORITY
} from "../lib/task-service-utils.ts";

describe("task service utilities", () => {
  it("normalizes priorities into the 1 to 5 operating bands", () => {
    assert.equal(normalizeTaskPriority(undefined), TASK_PRIORITY.normal);
    assert.equal(normalizeTaskPriority(0), TASK_PRIORITY.low);
    assert.equal(normalizeTaskPriority(9), TASK_PRIORITY.critical);
    assert.equal(normalizeTaskPriority("4.4"), TASK_PRIORITY.high);
  });

  it("cleans, deduplicates and sorts capabilities", () => {
    assert.deepEqual(
      normalizeCapabilities([" Safety ", "ai", "safety", "", null]),
      ["ai", "safety"]
    );
  });

  it("matches required capabilities against agent capabilities", () => {
    assert.equal(hasRequiredCapabilities([], []), true);
    assert.equal(
      hasRequiredCapabilities(["safety", "email"], ["Email", "SAFETY", "ai"]),
      true
    );
    assert.equal(
      hasRequiredCapabilities(["safety", "formulation"], ["safety"]),
      false
    );
  });

  it("clamps task leases to sensible bounds", () => {
    assert.equal(normalizeLeaseSeconds(undefined), 300);
    assert.equal(normalizeLeaseSeconds(2), 30);
    assert.equal(normalizeLeaseSeconds(9999), 3600);
    assert.equal(normalizeLeaseSeconds("90"), 90);
  });
});
