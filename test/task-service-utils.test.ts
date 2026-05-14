import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  hasRequiredCapabilities,
  normalizeCapabilities,
  normalizeLeaseSeconds,
  normalizeTaskIdempotencyScope,
  normalizeTaskBusinessValue,
  normalizeTaskRetryPolicy,
  TASK_BUSINESS_VALUE,
  taskEffectiveBusinessValue,
  taskRetryDelaySeconds,
  taskStatusMatchesIdempotencyScope
} from "../lib/task-service-utils.ts";

describe("task service utilities", () => {
  it("normalizes business values and legacy 1-to-5 bands", () => {
    assert.equal(normalizeTaskBusinessValue(undefined), TASK_BUSINESS_VALUE.normal);
    assert.equal(normalizeTaskBusinessValue(0), 1);
    assert.equal(normalizeTaskBusinessValue(9), 9);
    assert.equal(normalizeTaskBusinessValue("4.4"), TASK_BUSINESS_VALUE.high);
    assert.equal(normalizeTaskBusinessValue(12_000), 10_000);
  });

  it("adds bounded queue aging to effective business value", () => {
    const scheduledFor = new Date("2026-05-14T00:00:00.000Z");

    assert.equal(
      taskEffectiveBusinessValue(
        { businessValue: 200, scheduledFor },
        new Date("2026-05-14T00:05:00.000Z")
      ),
      200
    );
    assert.equal(
      taskEffectiveBusinessValue(
        { businessValue: 200, scheduledFor },
        new Date("2026-05-14T00:20:00.000Z")
      ),
      210
    );
    assert.equal(
      taskEffectiveBusinessValue(
        { businessValue: 200, scheduledFor },
        new Date("2026-05-14T08:00:00.000Z")
      ),
      400
    );
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
