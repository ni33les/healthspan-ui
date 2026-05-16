import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildMarketplaceSearchQueries,
  recommendProductStack,
  type ProductCandidate,
  type ProductRecommendationNeed
} from "../lib/product-recommendations.ts";

function need(
  id: string,
  name: string,
  weight: number,
  targetComparableAmount = 1000,
  itemType: ProductRecommendationNeed["itemType"] = "supplement"
): ProductRecommendationNeed {
  return {
    category: itemType === "food" ? "Food" : "Supplement",
    displayName: name,
    id,
    itemType,
    normalizedName: name.toLowerCase().replace(/\s+/g, "_"),
    sourceId: id,
    targetComparableAmount,
    targetDose: null,
    targetText: "1 mg/day",
    weight
  };
}

function product(input: Readonly<{
  affiliate?: boolean;
  amount: number;
  id: string;
  name: string;
  status?: ProductCandidate["listStatus"];
}>): ProductCandidate {
  return {
    activeAffiliateLinkId: input.affiliate ? `${input.id}-affiliate` : null,
    activeAffiliateUrl: input.affiliate ? `https://affiliate.example/${input.id}` : null,
    affiliateStatus: input.affiliate ? "active" : "none",
    automatedSafetyPassed: true,
    availabilityStatus: "in_stock",
    currency: "THB",
    facts: [
      {
        amount: input.amount,
        comparableAmount: input.amount * 1000,
        confidence: "high",
        itemType: "supplement",
        name: input.name,
        normalizedName: input.name.toLowerCase().replace(/\s+/g, "_"),
        unit: "mg"
      }
    ],
    id: input.id,
    labelStatus: "parsed",
    listStatus: input.status ?? "whitelisted",
    platform: "shopee",
    priceAmount: 100,
    productUrl: `https://example.com/${input.id}`,
    region: "TH",
    title: input.name
  };
}

describe("product recommendation scoring", () => {
  it("builds broad marketplace search queries instead of exact dose strings", () => {
    const queries = buildMarketplaceSearchQueries([
      need("vitamin_d", "Vitamin D3", 7, 1000),
      need("coq10", "CoQ10", 6, 1000),
      need("chia", "Chia Seeds", 5, 0, "food")
    ]);

    assert.equal(queries.includes("multivitamin"), true);
    assert.equal(queries.includes("vitamin d3"), true);
    assert.equal(queries.includes("coenzyme q10"), true);
    assert.equal(queries.includes("chia seeds"), true);
    assert.equal(queries.includes("chia seeds supplement"), false);
    assert.equal(
      queries.some((query) => /\d+\s*(mg|mcg|iu)/i.test(query)),
      false
    );
  });

  it("selects nutritional coverage over affiliate-only matches", () => {
    const result = recommendProductStack({
      candidates: [
        product({ affiliate: true, amount: 0.2, id: "affiliate", name: "Magnesium" }),
        product({ amount: 1, id: "best", name: "Magnesium" })
      ],
      needs: [need("magnesium", "Magnesium", 5)]
    });

    assert.equal(result.recommendations[0]?.product.id, "best");
    assert.equal(result.stackCoveragePercent, 100);
  });

  it("uses affiliate links as a tie-breaker for equivalent safe products", () => {
    const result = recommendProductStack({
      candidates: [
        product({ amount: 1, id: "plain", name: "Vitamin D" }),
        product({ affiliate: true, amount: 1, id: "affiliate", name: "Vitamin D" })
      ],
      needs: [need("vitamin_d", "Vitamin D", 5)]
    });

    assert.equal(result.recommendations[0]?.product.id, "affiliate");
  });

  it("caps stack size and avoids double-counting duplicate coverage", () => {
    const result = recommendProductStack({
      candidates: [
        product({ amount: 1, id: "one", name: "Zinc" }),
        product({ amount: 1, id: "two", name: "Zinc" }),
        product({ amount: 1, id: "three", name: "Zinc" }),
        product({ amount: 1, id: "four", name: "Zinc" }),
        product({ amount: 1, id: "five", name: "Zinc" }),
        product({ amount: 1, id: "six", name: "Zinc" }),
        product({ amount: 1, id: "seven", name: "Zinc" })
      ],
      maxProducts: 6,
      needs: [need("zinc", "Zinc", 5)]
    });

    assert.equal(result.recommendations.length, 1);
    assert.equal(result.stackCoveragePercent, 100);
  });

  it("excludes blacklisted and missing-label products", () => {
    const missingFacts = {
      ...product({ amount: 1, id: "missing", name: "Iron" }),
      facts: [],
      labelStatus: "missing" as const
    };
    const blocked = product({
      amount: 1,
      id: "blocked",
      name: "Iron",
      status: "blacklisted"
    });
    const result = recommendProductStack({
      candidates: [missingFacts, blocked],
      needs: [need("iron", "Iron", 5)]
    });

    assert.equal(result.recommendations.length, 0);
    assert.equal(result.exclusions.length, 2);
  });

  it("allows parsed-safe unknowns and marks them for review", () => {
    const result = recommendProductStack({
      candidates: [
        product({
          amount: 1,
          id: "unknown",
          name: "CoQ10",
          status: "unknown"
        })
      ],
      needs: [need("coq10", "CoQ10", 5)]
    });

    assert.equal(result.recommendations[0]?.unknownAtRecommendation, true);
  });
});
