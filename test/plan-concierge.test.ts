import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { planChatWelcomeBody } from "../lib/plan-concierge.ts";

describe("plan concierge", () => {
  it("starts GUI chat with a useful first message", () => {
    const body = planChatWelcomeBody("en");

    assert.match(body, /MattaNutra AI/);
    assert.match(body, /tailor your food and supplement guidance/);
    assert.match(body, /remove, swap, simplify, or adjust/);
    assert.match(body, /\n\n/);
    assert.match(body, /go ahead/);
  });
});
