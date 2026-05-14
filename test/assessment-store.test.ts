import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { healthScoreAnalysisStatusFromTaskStatuses } from "../lib/assessment-status.ts";

describe("assessment score analysis status", () => {
  it("treats stored advice as ready", () => {
    assert.equal(
      healthScoreAnalysisStatusFromTaskStatuses(true, ["queued"]),
      "ready"
    );
  });

  it("treats any completed score analysis as ready despite later duplicate active tasks", () => {
    assert.equal(
      healthScoreAnalysisStatusFromTaskStatuses(false, [
        "queued",
        "reserved",
        "completed"
      ]),
      "ready"
    );
  });

  it("keeps score analysis preparing while active work exists", () => {
    assert.equal(
      healthScoreAnalysisStatusFromTaskStatuses(false, ["reserved"]),
      "preparing"
    );
  });

  it("marks score analysis failed when only terminal failures exist", () => {
    assert.equal(
      healthScoreAnalysisStatusFromTaskStatuses(false, ["failed"]),
      "failed"
    );
  });
});
