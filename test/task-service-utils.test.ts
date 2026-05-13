import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  hasRequiredCapabilities,
  normalizeCapabilities,
  normalizeLeaseSeconds,
  normalizeTaskIdempotencyScope,
  normalizeTaskPriority,
  normalizeTaskRetryPolicy,
  TASK_PRIORITY,
  taskRetryDelaySeconds,
  taskStatusMatchesIdempotencyScope
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

  it("reuses successful idempotent tasks but leaves failed tasks retryable", () => {
    assert.equal(normalizeTaskIdempotencyScope("successful"), "successful");
    assert.equal(normalizeTaskIdempotencyScope("anything"), "active");

    assert.equal(
      taskStatusMatchesIdempotencyScope("queued", "active"),
      true
    );
    assert.equal(
      taskStatusMatchesIdempotencyScope("completed", "active"),
      false
    );
    assert.equal(
      taskStatusMatchesIdempotencyScope("completed", "successful"),
      true
    );
    assert.equal(
      taskStatusMatchesIdempotencyScope("failed", "successful"),
      false
    );
  });

  it("normalizes retry policies and applies bounded exponential backoff", () => {
    const policy = normalizeTaskRetryPolicy({
      backoffMultiplier: 3,
      initialDelaySeconds: 60,
      maxDelaySeconds: 500,
      maxRetries: 3
    });

    assert.ok(policy);
    assert.equal(policy.maxRetries, 3);
    assert.equal(taskRetryDelaySeconds(1, policy), 60);
    assert.equal(taskRetryDelaySeconds(2, policy), 180);
    assert.equal(taskRetryDelaySeconds(3, policy), 500);
    assert.equal(normalizeTaskRetryPolicy({ maxRetries: 0 }), null);
    assert.equal(normalizeTaskRetryPolicy(false), null);
  });
});
