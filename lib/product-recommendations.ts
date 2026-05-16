import {
  comparableDoseAmount,
  normalizeDoseUnit,
  parseDose,
  type ParsedDose
} from "@/lib/dose-conversion";
import type {
  FoodGuidanceBlueprint,
  FoodGuidanceItem,
  FormulationBlueprint,
  FormulationIngredient,
  LocalizedText,
  RecommendedProduct
} from "@/lib/formulation-types";

export type ProductListStatus =
  | "blacklisted"
  | "inactive"
  | "review_required"
  | "unknown"
  | "whitelisted";

export type ProductPlatform = "lazada" | "manual" | "shopee";
export type ProductAvailabilityStatus =
  | "in_stock"
  | "out_of_stock"
  | "unavailable"
  | "unknown";
export type ProductConfidence = "high" | "low" | "moderate";

export type ProductRecommendationNeed = Readonly<{
  category: string;
  displayName: string;
  id: string;
  itemType: "food" | "nutrient" | "supplement";
  normalizedName: string;
  sourceId: string;
  targetComparableAmount: number | null;
  targetDose: ParsedDose | null;
  targetText: string | null;
  weight: number;
}>;

export type ProductCandidateFact = Readonly<{
  amount: number | null;
  comparableAmount: number | null;
  confidence: ProductConfidence;
  foodId?: string | null;
  itemType: "food" | "nutrient" | "supplement";
  name: string;
  normalizedName: string;
  nutrientId?: string | null;
  servingLabel?: string | null;
  supplementId?: string | null;
  unit: string | null;
}>;

export type ProductCandidate = Readonly<{
  activeAffiliateLinkId?: string | null;
  activeAffiliateUrl?: string | null;
  affiliateStatus: "active" | "flagged_stale" | "none";
  automatedSafetyPassed: boolean;
  availabilityStatus: ProductAvailabilityStatus;
  brandName?: string | null;
  brandStatus?: ProductListStatus | null;
  currency: string;
  facts: ProductCandidateFact[];
  id: string;
  imageUrl?: string | null;
  labelStatus: "failed" | "missing" | "parsed" | "stale";
  listStatus: ProductListStatus;
  platform: ProductPlatform;
  priceAmount?: number | null;
  productDataExpiresAt?: string | null;
  productUrl: string;
  region: string;
  title: string;
}>;

export type ProductRecommendationExclusion = Readonly<{
  productId: string;
  reason: string;
  title: string;
}>;

export type ProductRecommendationSelection = Readonly<{
  affiliate: boolean;
  affiliateLinkId: string | null;
  coveredNeeds: ProductRecommendationNeed[];
  product: ProductCandidate;
  productCoveragePercent: number;
  rank: number;
  score: number;
  stackContributionPercent: number;
  url: string;
  unknownAtRecommendation: boolean;
  why: string;
}>;

export type ProductRecommendationResult = Readonly<{
  clientNeeds: ProductRecommendationNeed[];
  exclusions: ProductRecommendationExclusion[];
  recommendations: ProductRecommendationSelection[];
  stackCoveragePercent: number;
}>;

type CoverageResult = Readonly<{
  coverageByNeed: Map<string, number>;
  coveredNeeds: ProductRecommendationNeed[];
  percent: number;
}>;

const DEFAULT_TARGET_COUNT = 3;
const DEFAULT_MAX_COUNT = 6;
const MIN_USEFUL_MARGINAL_COVERAGE = 0.02;
const STOP_AFTER_TARGET_MARGINAL_COVERAGE = 0.08;
const GENERIC_BASE_PRODUCT_QUERIES = [
  "multivitamin",
  "multivitamin mineral",
  "วิตามินรวม",
  "อาหารเสริม วิตามินรวม"
];
const SEARCH_TOKEN_REPLACEMENTS: Record<string, string[]> = {
  coq10: ["coq10", "coenzyme q10"],
  magnesium: ["magnesium", "magnesium glycinate", "แมกนีเซียม"],
  omega_3: ["omega 3", "fish oil", "น้ำมันปลา"],
  vitamin_b12: ["vitamin b12", "b12"],
  vitamin_c: ["vitamin c", "วิตามินซี"],
  vitamin_d: ["vitamin d3", "vitamin d", "วิตามินดี"],
  vitamin_d3: ["vitamin d3", "vitamin d", "วิตามินดี"],
  zinc: ["zinc", "สังกะสี"]
};

export function normalizeProductKey(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function textValue(value: LocalizedText) {
  return typeof value === "string" ? value : value.en || value.th;
}

function safePercent(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round(value)));
}

function positiveNumber(value: unknown) {
  const parsed = Number(value);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function doseFromAmount(
  amount: number | null,
  unit: string | null
): ParsedDose | null {
  if (amount === null || amount <= 0 || !unit) {
    return null;
  }

  const normalizedUnit = normalizeDoseUnit(unit);

  return normalizedUnit
    ? {
        amount,
        originalText: `${amount} ${normalizedUnit}`,
        unit: normalizedUnit
      }
    : null;
}

function effectWeight(rank: number, itemType: "food" | "nutrient" | "supplement") {
  const normalizedRank = Number.isFinite(rank) && rank > 0 ? Math.round(rank) : 5;
  const base = Math.max(1, 8 - normalizedRank);

  return itemType === "food" ? base * 0.8 : base;
}

function visibleSafetyStatus(
  item: Pick<FormulationIngredient | FoodGuidanceItem, "safety">,
) {
  return item.safety?.visibility !== "hidden";
}

export function buildProductNeeds(input: Readonly<{
  foodGuidance: FoodGuidanceBlueprint | null;
  formulation: FormulationBlueprint | null;
}>) {
  const supplementNeeds =
    input.formulation?.supplementBreakdown
      ?.filter((item) => visibleSafetyStatus(item))
      .filter((item) => item.status === "add" || item.status === "review")
      .map((item) => {
        const displayName = textValue(item.supplement);
        const normalizedName = normalizeProductKey(displayName);
        const targetText = textValue(item.dailyDose);
        const targetDose = parseDose(targetText, normalizedName);

        return {
          category: item.category,
          displayName,
          id: `supplement:${item.id}`,
          itemType: "supplement" as const,
          normalizedName,
          sourceId: item.id,
          targetComparableAmount: targetDose
            ? comparableDoseAmount(targetDose, normalizedName)
            : null,
          targetDose,
          targetText,
          weight: effectWeight(item.effectivenessRank, "supplement")
        } satisfies ProductRecommendationNeed;
      }) ?? [];
  const foodNeeds =
    input.foodGuidance?.foodGuidance
      ?.filter((item) => visibleSafetyStatus(item))
      .filter((item) => item.status === "add" || item.status === "review")
      .map((item) => {
        const displayName = textValue(item.food);

        return {
          category: item.category,
          displayName,
          id: `food:${item.id}`,
          itemType: "food" as const,
          normalizedName: normalizeProductKey(displayName),
          sourceId: item.id,
          targetComparableAmount: null,
          targetDose: null,
          targetText: textValue(item.serving),
          weight: effectWeight(item.effectivenessRank, "food")
        } satisfies ProductRecommendationNeed;
      }) ?? [];

  return [...supplementNeeds, ...foodNeeds];
}

function humanSearchName(need: ProductRecommendationNeed) {
  const replacement = SEARCH_TOKEN_REPLACEMENTS[need.normalizedName];

  if (replacement) {
    return replacement;
  }

  return [
    need.displayName
      .replace(/\([^)]*\)/g, "")
      .replace(/\b\d+(\.\d+)?\s*(mcg|µg|ug|mg|g|iu)\b/gi, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase()
  ].filter(Boolean);
}

export function buildMarketplaceSearchQueries(
  needs: readonly ProductRecommendationNeed[],
  limit = 16
) {
  const weightedNeeds = [...needs]
    .sort((first, second) => second.weight - first.weight);
  const queries: string[] = [...GENERIC_BASE_PRODUCT_QUERIES];

  for (const need of weightedNeeds) {
    for (const name of humanSearchName(need)) {
      queries.push(name);

      if (
        need.itemType !== "food" &&
        !/supplement|vitamin|วิตามิน|อาหารเสริม/i.test(name)
      ) {
        queries.push(`${name} supplement`);
      }
    }
  }

  return [...new Set(queries.map((query) => query.trim()).filter(Boolean))]
    .slice(0, Math.max(1, limit));
}

function factComparableAmount(fact: ProductCandidateFact) {
  if (typeof fact.comparableAmount === "number" && fact.comparableAmount > 0) {
    return fact.comparableAmount;
  }

  const dose = doseFromAmount(positiveNumber(fact.amount), fact.unit);

  return dose ? comparableDoseAmount(dose, fact.normalizedName) : null;
}

function confidenceMultiplier(confidence: ProductConfidence) {
  if (confidence === "high") {
    return 1;
  }

  return confidence === "moderate" ? 0.85 : 0.65;
}

function matchesNeed(fact: ProductCandidateFact, need: ProductRecommendationNeed) {
  if (fact.itemType !== need.itemType && fact.itemType !== "nutrient") {
    return false;
  }

  if (fact.itemType === "supplement" && fact.supplementId === need.sourceId) {
    return true;
  }

  if (fact.itemType === "food" && fact.foodId === need.sourceId) {
    return true;
  }

  return fact.normalizedName === need.normalizedName;
}

function factNeedCoverage(fact: ProductCandidateFact, need: ProductRecommendationNeed) {
  if (!matchesNeed(fact, need)) {
    return 0;
  }

  const confidence = confidenceMultiplier(fact.confidence);
  const factAmount = factComparableAmount(fact);

  if (
    factAmount !== null &&
    need.targetComparableAmount !== null &&
    need.targetComparableAmount > 0
  ) {
    return Math.min(1, factAmount / need.targetComparableAmount) * confidence;
  }

  return 0.8 * confidence;
}

function productCoverage(product: ProductCandidate, needs: ProductRecommendationNeed[]) {
  const coverageByNeed = new Map<string, number>();
  const coveredNeeds: ProductRecommendationNeed[] = [];
  const totalWeight = needs.reduce((total, need) => total + need.weight, 0);

  for (const need of needs) {
    const coverage = Math.max(
      0,
      ...product.facts.map((fact) => factNeedCoverage(fact, need))
    );

    if (coverage > 0) {
      coverageByNeed.set(need.id, Math.min(1, coverage));
      coveredNeeds.push(need);
    }
  }

  const weightedCoverage = coveredNeeds.reduce(
    (total, need) => total + need.weight * (coverageByNeed.get(need.id) ?? 0),
    0
  );

  return {
    coverageByNeed,
    coveredNeeds,
    percent: totalWeight > 0 ? (weightedCoverage / totalWeight) * 100 : 0
  } satisfies CoverageResult;
}

function exclusionReason(product: ProductCandidate) {
  if (product.brandStatus === "blacklisted" || product.brandStatus === "inactive") {
    return "Brand is blocked";
  }

  if (product.listStatus === "blacklisted" || product.listStatus === "inactive") {
    return "Product is blocked";
  }

  if (
    product.availabilityStatus === "out_of_stock" ||
    product.availabilityStatus === "unavailable"
  ) {
    return "Product is unavailable";
  }

  if (product.labelStatus !== "parsed" || product.facts.length < 1) {
    return "Product label facts are missing";
  }

  if (
    product.productDataExpiresAt &&
    new Date(product.productDataExpiresAt).getTime() < Date.now()
  ) {
    return "Product cache expired";
  }

  if (!product.automatedSafetyPassed) {
    return "Product failed automated safety checks";
  }

  return null;
}

function productPenalty(product: ProductCandidate, budgetAmount?: number | null) {
  let penalty = 0;

  if (product.listStatus === "unknown") {
    penalty += 2;
  } else if (product.listStatus === "review_required") {
    penalty += 1;
  }

  if (product.labelStatus === "stale") {
    penalty += 4;
  }

  if (product.availabilityStatus === "unknown") {
    penalty += 3;
  }

  if (budgetAmount && product.priceAmount && product.priceAmount > budgetAmount) {
    penalty += Math.min(15, ((product.priceAmount - budgetAmount) / budgetAmount) * 10);
  }

  return penalty;
}

function marginalCoveragePercent(
  coverage: CoverageResult,
  existingCoverage: Map<string, number>,
  needs: ProductRecommendationNeed[]
) {
  const totalWeight = needs.reduce((total, need) => total + need.weight, 0);
  const weightedMarginal = needs.reduce((total, need) => {
    const current = existingCoverage.get(need.id) ?? 0;
    const next = coverage.coverageByNeed.get(need.id) ?? 0;

    return total + Math.max(0, next - current) * need.weight;
  }, 0);

  return totalWeight > 0 ? (weightedMarginal / totalWeight) * 100 : 0;
}

function applyCoverage(
  target: Map<string, number>,
  coverage: CoverageResult
) {
  for (const [needId, nextCoverage] of coverage.coverageByNeed.entries()) {
    target.set(needId, Math.max(target.get(needId) ?? 0, nextCoverage));
  }
}

function stackCoveragePercent(
  coverage: Map<string, number>,
  needs: ProductRecommendationNeed[]
) {
  const totalWeight = needs.reduce((total, need) => total + need.weight, 0);
  const weightedCoverage = needs.reduce(
    (total, need) => total + (coverage.get(need.id) ?? 0) * need.weight,
    0
  );

  return totalWeight > 0 ? (weightedCoverage / totalWeight) * 100 : 0;
}

function marketplaceName(platform: ProductPlatform): RecommendedProduct["marketplace"] {
  if (platform === "lazada") {
    return "Lazada Thailand";
  }

  return platform === "shopee" ? "Shopee Thailand" : "Imported product";
}

function whyProductMatches(
  product: ProductCandidate,
  coveredNeeds: ProductRecommendationNeed[],
  stackContributionPercent: number
) {
  const names = coveredNeeds.slice(0, 3).map((need) => need.displayName);
  const prefix = product.listStatus === "unknown"
    ? "Strong unreviewed match"
    : "Strong match";

  return names.length > 0
    ? `${prefix} for ${names.join(", ")}; adds ${safePercent(stackContributionPercent)}% to this stack.`
    : `${prefix}; adds ${safePercent(stackContributionPercent)}% to this stack.`;
}

export function recommendProductStack(input: Readonly<{
  budgetAmount?: number | null;
  candidates: ProductCandidate[];
  maxProducts?: number;
  needs: ProductRecommendationNeed[];
  targetProducts?: number;
}>) {
  const targetCount = input.targetProducts ?? DEFAULT_TARGET_COUNT;
  const maxProducts = Math.min(
    DEFAULT_MAX_COUNT,
    Math.max(1, input.maxProducts ?? DEFAULT_MAX_COUNT)
  );
  const exclusions: ProductRecommendationExclusion[] = [];
  const scored = input.candidates
    .map((product) => {
      const reason = exclusionReason(product);

      if (reason) {
        exclusions.push({
          productId: product.id,
          reason,
          title: product.title
        });
        return null;
      }

      const coverage = productCoverage(product, input.needs);
      const penalty = productPenalty(product, input.budgetAmount);

      if (coverage.percent <= 0) {
        exclusions.push({
          productId: product.id,
          reason: "Product does not cover current client needs",
          title: product.title
        });
        return null;
      }

      return {
        coverage,
        penalty,
        product
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  const selected: ProductRecommendationSelection[] = [];
  const selectedProductIds = new Set<string>();
  const stackCoverage = new Map<string, number>();

  while (selected.length < maxProducts) {
    const ranked = scored
      .filter((item) => !selectedProductIds.has(item.product.id))
      .map((item) => {
        const marginal = marginalCoveragePercent(
          item.coverage,
          stackCoverage,
          input.needs
        );
        const affiliateBonus = item.product.activeAffiliateUrl ? 0.05 : 0;

        return {
          ...item,
          affiliateBonus,
          marginal,
          score:
            marginal * 2 +
            item.coverage.percent * 0.3 -
            item.penalty +
            affiliateBonus
        };
      })
      .filter((item) => item.marginal / 100 >= MIN_USEFUL_MARGINAL_COVERAGE)
      .sort((first, second) => {
        const scoreDelta = second.score - first.score;

        if (Math.abs(scoreDelta) > 0.5) {
          return scoreDelta;
        }

        if (first.product.activeAffiliateUrl !== second.product.activeAffiliateUrl) {
          return first.product.activeAffiliateUrl ? -1 : 1;
        }

        return (first.product.priceAmount ?? Number.MAX_SAFE_INTEGER) -
          (second.product.priceAmount ?? Number.MAX_SAFE_INTEGER);
      });
    const best = ranked[0];

    if (!best) {
      break;
    }

    if (
      selected.length >= targetCount &&
      best.marginal / 100 < STOP_AFTER_TARGET_MARGINAL_COVERAGE
    ) {
      break;
    }

    selectedProductIds.add(best.product.id);
    applyCoverage(stackCoverage, best.coverage);
    selected.push({
      affiliate: Boolean(best.product.activeAffiliateUrl),
      affiliateLinkId: best.product.activeAffiliateLinkId ?? null,
      coveredNeeds: best.coverage.coveredNeeds,
      product: best.product,
      productCoveragePercent: safePercent(best.coverage.percent),
      rank: selected.length + 1,
      score: Number(best.score.toFixed(4)),
      stackContributionPercent: safePercent(best.marginal),
      unknownAtRecommendation: best.product.listStatus === "unknown",
      url: best.product.activeAffiliateUrl || best.product.productUrl,
      why: whyProductMatches(
        best.product,
        best.coverage.coveredNeeds,
        best.marginal
      )
    });
  }

  return {
    clientNeeds: input.needs,
    exclusions,
    recommendations: selected,
    stackCoveragePercent: safePercent(
      stackCoveragePercent(stackCoverage, input.needs)
    )
  } satisfies ProductRecommendationResult;
}

export function toRecommendedProduct(
  selection: ProductRecommendationSelection,
  stackCoveragePercent: number,
  recommendationRunId?: string
) {
  return {
    affiliate: selection.affiliate,
    covers: selection.coveredNeeds.map((need) => need.sourceId),
    description: selection.why,
    id: selection.product.id,
    imageUrl: selection.product.imageUrl ?? null,
    marketplace: marketplaceName(selection.product.platform),
    name: selection.product.title,
    price:
      selection.product.priceAmount && selection.product.priceAmount > 0
        ? {
            amount: selection.product.priceAmount,
            currency: selection.product.currency || "THB"
          }
        : null,
    priority: selection.rank,
    productCoveragePercent: selection.productCoveragePercent,
    productId: selection.product.id,
    rank: selection.rank,
    recommendationRunId,
    stackContributionPercent: selection.stackContributionPercent,
    stackCoveragePercent,
    tag: selection.affiliate ? "Best match + affiliate" : "Best match",
    url: selection.url
  } satisfies RecommendedProduct;
}
