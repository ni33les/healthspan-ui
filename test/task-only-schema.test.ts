import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const schema = readFileSync(new URL("../db-schema.sql", import.meta.url), "utf8");

describe("task-only schema", () => {
  it("does not rebuild operational goals", () => {
    assert.equal(/\bcreate\s+table\s+public\.goals\b/i.test(schema), false);
    assert.equal(/\breferences\s+public\.goals\b/i.test(schema), false);
    assert.equal(/\bgoal_id\b/i.test(schema), false);
    assert.equal(/\bgoals_[a-z0-9_]+/i.test(schema), false);
  });

  it("uses task-native business value and chain grouping", () => {
    assert.match(schema, /\bbusiness_value\s+integer\s+not\s+null\s+default\s+200\b/i);
    assert.match(schema, /\btask_group_id\s+uuid\s+not\s+null\b/i);
    assert.match(schema, /\bidempotency_scope_key\s+text\s+not\s+null\s+default\s+'global'/i);
    assert.match(schema, /\bretry_policy\s+jsonb\s+not\s+null\s+default\s+'\{\}'::jsonb/i);
    assert.equal(/\bpriority\s+integer\b/i.test(schema), false);
  });
});
