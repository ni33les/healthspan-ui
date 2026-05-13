import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { groupRetryLineages } from "../lib/admin-goal-task-lineage.ts";

type TestTask = Readonly<{
  createdAt: string;
  id: string;
  retryAttempt: number;
  retryOfTaskId: string | null;
  retryRootTaskId: string | null;
  title: string;
}>;

function task(input: Partial<TestTask> & Pick<TestTask, "id">): TestTask {
  return {
    createdAt: input.createdAt ?? "2026-05-13T00:00:00.000Z",
    id: input.id,
    retryAttempt: input.retryAttempt ?? 0,
    retryOfTaskId: input.retryOfTaskId ?? null,
    retryRootTaskId: input.retryRootTaskId ?? null,
    title: input.title ?? input.id
  };
}

describe("admin goal task retry lineage", () => {
  it("groups retry attempts under their root task and orders attempts", () => {
    const groups = groupRetryLineages([
      task({ id: "other" }),
      task({
        createdAt: "2026-05-13T00:05:00.000Z",
        id: "retry-2",
        retryAttempt: 2,
        retryOfTaskId: "retry-1",
        retryRootTaskId: "root"
      }),
      task({
        createdAt: "2026-05-13T00:00:00.000Z",
        id: "root"
      }),
      task({
        createdAt: "2026-05-13T00:02:00.000Z",
        id: "retry-1",
        retryAttempt: 1,
        retryOfTaskId: "root",
        retryRootTaskId: "root"
      })
    ]);

    assert.equal(groups.length, 2);
    assert.equal(groups[0].key, "other");
    assert.equal(groups[0].hasRetryLineage, false);
    assert.equal(groups[1].key, "root");
    assert.equal(groups[1].hasRetryLineage, true);
    assert.deepEqual(
      groups[1].tasks.map((item) => item.id),
      ["root", "retry-1", "retry-2"]
    );
  });

  it("treats orphaned retry rows as a lineage", () => {
    const groups = groupRetryLineages([
      task({
        id: "retry",
        retryAttempt: 1,
        retryOfTaskId: "missing-root"
      })
    ]);

    assert.equal(groups[0].key, "missing-root");
    assert.equal(groups[0].hasRetryLineage, true);
  });
});
