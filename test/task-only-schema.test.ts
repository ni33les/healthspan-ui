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

  it("stores curated food benefit and nutrient tags", () => {
    assert.match(schema, /\bbenefit_tags\s+text\[\]\s+not\s+null\s+default\s+'\{\}'::text\[\]/i);
    assert.match(schema, /\bnutrient_tags\s+text\[\]\s+not\s+null\s+default\s+'\{\}'::text\[\]/i);
    assert.match(schema, /\bfoods_benefit_tags_gin_idx\b/i);
    assert.match(schema, /\bfoods_nutrient_tags_gin_idx\b/i);
  });

  it("stores food nutrient facts separately from display tags", () => {
    assert.match(schema, /\bcreate\s+table\s+public\.nutrients\b/i);
    assert.match(schema, /\bcreate\s+table\s+public\.food_serving_sizes\b/i);
    assert.match(schema, /\bcreate\s+table\s+public\.food_nutrient_profiles\b/i);
    assert.match(schema, /\bamount_per_100g\s+numeric\(14,\s*4\)\s+not\s+null/i);
    assert.match(schema, /\bprimary\s+key\s+\(food_id,\s*nutrient_id\)/i);
  });

  it("stores plan chat refinements as task-native adjustment records", () => {
    assert.match(schema, /\bcreate\s+table\s+public\.plan_guidance_adjustments\b/i);
    assert.match(schema, /\bplan_id\s+uuid\s+not\s+null\s+references\s+public\.assessments\(plan_id\)/i);
    assert.match(schema, /\bitem_type\s+text\s+not\s+null\s+check\s+\(item_type\s+in\s+\('food',\s+'supplement'\)\)/i);
    assert.match(schema, /\bplan_guidance_adjustments_active_unique_idx\b/i);
  });
});
