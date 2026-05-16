import { getSql } from "@/lib/db";
import type { MarketplaceProductSnapshot } from "@/lib/marketplace-adapters";
import {
  doseExceedsLimit,
  normalizeDoseUnit,
  parseDoseLimit
} from "@/lib/dose-conversion";
import {
  normalizeProductKey,
  type ProductAvailabilityStatus,
  type ProductCandidate,
  type ProductCandidateFact,
  type ProductConfidence,
  type ProductListStatus,
  type ProductRecommendationNeed,
  type ProductPlatform
} from "@/lib/product-recommendations";

export type ProductAffiliateStatus = "active" | "flagged_stale" | "none";
export type ProductLabelStatus = "failed" | "missing" | "parsed" | "stale";

export type AdminProductFact = ProductCandidateFact & Readonly<{
  id: string;
}>;

export type AdminProductAffiliateLink = Readonly<{
  id: string;
  network: string | null;
  status: "active" | "flagged_stale" | "inactive";
  url: string;
}>;

export type AdminProductRow = Readonly<{
  affiliateLinks: AdminProductAffiliateLink[];
  affiliateStatus: ProductAffiliateStatus;
  availabilityStatus: ProductAvailabilityStatus;
  brandName: string | null;
  brandStatus: ProductListStatus | null;
  category: string | null;
  currency: string;
  facts: AdminProductFact[];
  id: string;
  imageUrl: string | null;
  labelStatus: ProductLabelStatus;
  listStatus: ProductListStatus;
  platform: ProductPlatform;
  priceAmount: number | null;
  productUrl: string;
  recommendationHistory: {
    averageProductCoveragePercent: number | null;
    averageStackCoveragePercent: number | null;
    chosenCount: number;
    lastRecommendedAt: string | null;
  };
  region: string;
  title: string;
  updatedAt: string;
}>;

export type AdminProductsData = Readonly<{
  databaseAvailable: boolean;
  generatedAt: string;
  platforms: ProductPlatform[];
  rows: AdminProductRow[];
  summary: {
    activeAffiliate: number;
    blacklisted: number;
    missingFacts: number;
    reviewRequired: number;
    total: number;
    unknown: number;
    whitelisted: number;
  };
}>;

type ProductDbRow = Readonly<{
  active_affiliate_link_id: string | null;
  active_affiliate_url: string | null;
  affiliate_links: unknown;
  affiliate_status: ProductAffiliateStatus;
  availability_status: ProductAvailabilityStatus;
  brand_name: string | null;
  brand_status: ProductListStatus | null;
  category: string | null;
  currency: string;
  facts: unknown;
  history_average_product_coverage_percent: string | number | null;
  history_average_stack_coverage_percent: string | number | null;
  history_chosen_count: string | number | null;
  history_last_recommended_at: Date | string | null;
  id: string;
  image_url: string | null;
  label_status: ProductLabelStatus;
  list_status: ProductListStatus;
  platform: ProductPlatform;
  price_amount: string | number | null;
  product_data_expires_at: Date | string | null;
  product_url: string;
  region: string;
  title: string;
  updated_at: Date | string;
}>;

type FactDbPayload = Readonly<{
  amount?: number | string | null;
  confidence?: ProductConfidence | null;
  foodId?: string | null;
  id?: string;
  itemType?: "food" | "nutrient" | "supplement";
  maxAmount?: number | string | null;
  maxUnit?: string | null;
  name?: string;
  normalizedName?: string;
  nutrientId?: string | null;
  servingLabel?: string | null;
  supplementId?: string | null;
  supplementStatus?: ProductListStatus | null;
  unit?: string | null;
}>;

const productStatuses = new Set<ProductListStatus>([
  "blacklisted",
  "inactive",
  "review_required",
  "unknown",
  "whitelisted"
]);
const productPlatforms = new Set<ProductPlatform>(["lazada", "manual", "shopee"]);
const productLabelStatuses = new Set<ProductLabelStatus>([
  "failed",
  "missing",
  "parsed",
  "stale"
]);
const productAvailabilityStatuses = new Set<ProductAvailabilityStatus>([
  "in_stock",
  "out_of_stock",
  "unavailable",
  "unknown"
]);

export function isProductListStatus(value: string): value is ProductListStatus {
  return productStatuses.has(value as ProductListStatus);
}

export function isProductPlatform(value: string): value is ProductPlatform {
  return productPlatforms.has(value as ProductPlatform);
}

export function isProductLabelStatus(value: string): value is ProductLabelStatus {
  return productLabelStatuses.has(value as ProductLabelStatus);
}

export function isProductAvailabilityStatus(
  value: string
): value is ProductAvailabilityStatus {
  return productAvailabilityStatuses.has(value as ProductAvailabilityStatus);
}

function emptyAdminProductsData(): AdminProductsData {
  return {
    databaseAvailable: false,
    generatedAt: new Date().toISOString(),
    platforms: [],
    rows: [],
    summary: {
      activeAffiliate: 0,
      blacklisted: 0,
      missingFacts: 0,
      reviewRequired: 0,
      total: 0,
      unknown: 0,
      whitelisted: 0
    }
  };
}

function numberOrNull(value: unknown) {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : null;
}

function isoOrNull(value: unknown) {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(String(value));

  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function arrayPayload(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function normalizeFact(fact: FactDbPayload): AdminProductFact {
  const amount = numberOrNull(fact.amount);
  const unit = typeof fact.unit === "string" ? fact.unit : null;
  const normalizedName =
    typeof fact.normalizedName === "string" && fact.normalizedName
      ? fact.normalizedName
      : normalizeProductKey(String(fact.name ?? ""));
  const doseUnit = unit ? normalizeDoseUnit(unit) : null;
  const comparableAmount =
    amount !== null && doseUnit && doseUnit !== "iu"
      ? amount *
        (doseUnit === "g" ? 1_000_000 : doseUnit === "mg" ? 1_000 : 1)
      : null;

  return {
    amount,
    comparableAmount,
    confidence: fact.confidence ?? "moderate",
    foodId: fact.foodId ?? null,
    id: fact.id ?? crypto.randomUUID(),
    itemType: fact.itemType ?? "supplement",
    name: fact.name ?? normalizedName,
    normalizedName,
    nutrientId: fact.nutrientId ?? null,
    servingLabel: fact.servingLabel ?? null,
    supplementId: fact.supplementId ?? null,
    unit
  };
}

function productSafetyPasses(facts: readonly AdminProductFact[], rawFacts: unknown) {
  const payloads = arrayPayload(rawFacts) as FactDbPayload[];

  for (const [index, fact] of facts.entries()) {
    const payload = payloads[index];

    if (payload?.supplementStatus === "blacklisted") {
      return false;
    }

    const amount = numberOrNull(payload?.amount);
    const unit = typeof payload?.unit === "string" ? payload.unit : null;
    const maxAmount = numberOrNull(payload?.maxAmount);
    const maxUnit =
      typeof payload?.maxUnit === "string" ? payload.maxUnit : null;
    const doseUnit = unit ? normalizeDoseUnit(unit) : null;
    const limit = parseDoseLimit(maxAmount, maxUnit);

    if (amount !== null && doseUnit && limit) {
      const exceeds = doseExceedsLimit(
        {
          amount,
          originalText: `${amount} ${doseUnit}`,
          unit: doseUnit
        },
        limit,
        fact.normalizedName
      );

      if (exceeds === true) {
        return false;
      }
    }
  }

  return true;
}

function rowFromDb(row: ProductDbRow): AdminProductRow {
  const facts = (arrayPayload(row.facts) as FactDbPayload[]).map(normalizeFact);
  const affiliateLinks = arrayPayload(row.affiliate_links).map((item) => {
    const record = item && typeof item === "object"
      ? item as Record<string, unknown>
      : {};

    return {
      id: typeof record.id === "string" ? record.id : crypto.randomUUID(),
      network: typeof record.network === "string" ? record.network : null,
      status:
        record.status === "flagged_stale" || record.status === "inactive"
          ? record.status
          : "active",
      url: typeof record.url === "string" ? record.url : ""
    } satisfies AdminProductAffiliateLink;
  });

  return {
    affiliateLinks,
    affiliateStatus: row.affiliate_status,
    availabilityStatus: row.availability_status,
    brandName: row.brand_name,
    brandStatus: row.brand_status,
    category: row.category,
    currency: row.currency || "THB",
    facts,
    id: row.id,
    imageUrl: row.image_url,
    labelStatus: row.label_status,
    listStatus: row.list_status,
    platform: row.platform,
    priceAmount: numberOrNull(row.price_amount),
    productUrl: row.product_url,
    recommendationHistory: {
      averageProductCoveragePercent: numberOrNull(
        row.history_average_product_coverage_percent
      ),
      averageStackCoveragePercent: numberOrNull(
        row.history_average_stack_coverage_percent
      ),
      chosenCount: Math.max(0, Math.round(numberOrNull(row.history_chosen_count) ?? 0)),
      lastRecommendedAt: isoOrNull(row.history_last_recommended_at)
    },
    region: row.region,
    title: row.title,
    updatedAt: new Date(row.updated_at).toISOString()
  };
}

function summaryFromRows(rows: AdminProductRow[]) {
  return rows.reduce(
    (summary, row) => {
      summary.total += 1;

      if (row.listStatus === "blacklisted") {
        summary.blacklisted += 1;
      } else if (row.listStatus === "review_required") {
        summary.reviewRequired += 1;
      } else if (row.listStatus === "unknown") {
        summary.unknown += 1;
      } else if (row.listStatus === "whitelisted") {
        summary.whitelisted += 1;
      }

      if (row.affiliateStatus === "active") {
        summary.activeAffiliate += 1;
      }

      if (row.facts.length < 1 || row.labelStatus !== "parsed") {
        summary.missingFacts += 1;
      }

      return summary;
    },
    {
      activeAffiliate: 0,
      blacklisted: 0,
      missingFacts: 0,
      reviewRequired: 0,
      total: 0,
      unknown: 0,
      whitelisted: 0
    }
  );
}

async function loadProductRows() {
  const sql = getSql();

  if (!sql) {
    return null;
  }

  return sql<ProductDbRow[]>`
    select
      marketplace_products.id::text,
      marketplace_products.platform,
      marketplace_products.region,
      marketplace_products.title,
      marketplace_products.brand_name,
      marketplace_products.image_url,
      marketplace_products.product_url,
      marketplace_products.category,
      marketplace_products.list_status,
      marketplace_products.label_status,
      marketplace_products.availability_status,
      marketplace_products.affiliate_status,
      marketplace_products.price_amount,
      marketplace_products.currency,
      marketplace_products.product_data_expires_at,
      marketplace_products.updated_at,
      product_brands.list_status as brand_status,
      active_affiliate.id::text as active_affiliate_link_id,
      active_affiliate.url as active_affiliate_url,
      coalesce(fact_rows.facts, '[]'::jsonb) as facts,
      coalesce(affiliate_rows.affiliate_links, '[]'::jsonb) as affiliate_links,
      coalesce(history.chosen_count, 0) as history_chosen_count,
      history.last_recommended_at as history_last_recommended_at,
      history.average_product_coverage_percent,
      history.average_stack_coverage_percent
    from public.marketplace_products
    left join public.product_brands
      on product_brands.id = marketplace_products.brand_id
    left join lateral (
      select id, url
      from public.product_affiliate_links
      where product_affiliate_links.product_id = marketplace_products.id
        and product_affiliate_links.status = 'active'
      order by product_affiliate_links.updated_at desc
      limit 1
    ) active_affiliate on true
    left join lateral (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', product_facts.id,
            'itemType', product_facts.item_type,
            'supplementId', product_facts.supplement_id,
            'foodId', product_facts.food_id,
            'nutrientId', product_facts.nutrient_id,
            'name', product_facts.name,
            'normalizedName', product_facts.normalized_name,
            'amount', product_facts.amount,
            'unit', product_facts.unit,
            'servingLabel', product_facts.serving_label,
            'confidence', product_facts.confidence,
            'supplementStatus', supplements.list_status,
            'maxAmount', supplement_safety_limits.max_amount,
            'maxUnit', supplement_safety_limits.max_unit
          )
          order by product_facts.created_at asc
        ),
        '[]'::jsonb
      ) as facts
      from public.product_facts
      left join public.supplements
        on supplements.id = product_facts.supplement_id
      left join lateral (
        select max_amount, max_unit
        from public.supplement_safety_limits
        where supplement_safety_limits.supplement_id = product_facts.supplement_id
        order by version desc
        limit 1
      ) supplement_safety_limits on true
      where product_facts.product_id = marketplace_products.id
    ) fact_rows on true
    left join lateral (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', product_affiliate_links.id,
            'network', product_affiliate_links.network,
            'status', product_affiliate_links.status,
            'url', product_affiliate_links.url
          )
          order by product_affiliate_links.updated_at desc
        ),
        '[]'::jsonb
      ) as affiliate_links
      from public.product_affiliate_links
      where product_affiliate_links.product_id = marketplace_products.id
    ) affiliate_rows on true
    left join lateral (
      select
        count(*)::int as chosen_count,
        max(product_recommendation_items.created_at) as last_recommended_at,
        avg(product_recommendation_items.product_coverage_percent) as average_product_coverage_percent,
        avg(product_recommendation_runs.stack_coverage_percent) as average_stack_coverage_percent
      from public.product_recommendation_items
      join public.product_recommendation_runs
        on product_recommendation_runs.id = product_recommendation_items.run_id
      where product_recommendation_items.product_id = marketplace_products.id
    ) history on true
    order by marketplace_products.updated_at desc, marketplace_products.title asc
  `;
}

export async function getAdminProductsData(): Promise<AdminProductsData> {
  try {
    const rows = await loadProductRows();

    if (!rows) {
      return emptyAdminProductsData();
    }

    const mappedRows = rows.map(rowFromDb);

    return {
      databaseAvailable: true,
      generatedAt: new Date().toISOString(),
      platforms: [...new Set(mappedRows.map((row) => row.platform))].sort(),
      rows: mappedRows,
      summary: summaryFromRows(mappedRows)
    };
  } catch (error) {
    console.error("Unable to load marketplace products", error);
    return emptyAdminProductsData();
  }
}

export async function getProductRecommendationCandidates() {
  const rows = await loadProductRows();

  if (!rows) {
    return [];
  }

  return rows.map((row) => {
    const adminRow = rowFromDb(row);
    const activeAffiliateUrl =
      typeof row.active_affiliate_url === "string" ? row.active_affiliate_url : null;
    const productDataExpiresAt = isoOrNull(row.product_data_expires_at);

    return {
      activeAffiliateLinkId: row.active_affiliate_link_id,
      activeAffiliateUrl,
      affiliateStatus: adminRow.affiliateStatus,
      automatedSafetyPassed: productSafetyPasses(adminRow.facts, row.facts),
      availabilityStatus: adminRow.availabilityStatus,
      brandName: adminRow.brandName,
      brandStatus: adminRow.brandStatus,
      currency: adminRow.currency,
      facts: adminRow.facts,
      id: adminRow.id,
      imageUrl: adminRow.imageUrl,
      labelStatus: adminRow.labelStatus,
      listStatus: adminRow.listStatus,
      platform: adminRow.platform,
      priceAmount: adminRow.priceAmount,
      productDataExpiresAt,
      productUrl: adminRow.productUrl,
      region: adminRow.region,
      title: adminRow.title
    } satisfies ProductCandidate;
  });
}

export type UpdateAdminProductInput = Readonly<{
  actor?: string | null;
  adminNotes?: string | null;
  affiliateStatus?: ProductAffiliateStatus;
  availabilityStatus?: ProductAvailabilityStatus;
  id: string;
  labelStatus?: ProductLabelStatus;
  listStatus?: ProductListStatus;
  priceAmount?: number | null;
}>;

export type CreateAdminProductInput = Readonly<{
  actor?: string | null;
  affiliateUrl?: string | null;
  availabilityStatus?: ProductAvailabilityStatus;
  brandName?: string | null;
  currency?: string | null;
  facts?: ReadonlyArray<Readonly<{
    amount?: number | null;
    confidence?: ProductConfidence;
    itemType?: "food" | "nutrient" | "supplement";
    name: string;
    supplementId?: string | null;
    unit?: string | null;
  }>>;
  imageUrl?: string | null;
  labelStatus?: ProductLabelStatus;
  listStatus?: ProductListStatus;
  marketplaceProductId?: string | null;
  platform: ProductPlatform;
  priceAmount?: number | null;
  productUrl: string;
  region?: string | null;
  replaceFacts?: boolean;
  source?: string;
  title: string;
}>;

function cleanNullableText(value: unknown, max = 2000) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  return trimmed ? trimmed.slice(0, max) : null;
}

function normalizedUrl(value: string) {
  try {
    const url = new URL(value);
    url.hash = "";
    url.search = "";

    return url.toString().toLowerCase();
  } catch {
    return value.trim().toLowerCase();
  }
}

function titleContainsNeed(title: string, need: ProductRecommendationNeed) {
  const normalizedTitle = normalizeProductKey(title);
  const needTokens = need.normalizedName
    .split("_")
    .filter((token) => token.length > 1 && token !== "and");

  if (normalizedTitle.includes(need.normalizedName)) {
    return true;
  }

  return needTokens.length > 0 &&
    needTokens.every((token) => normalizedTitle.includes(token));
}

function titleDose(title: string) {
  const match = title.match(/(\d+(?:\.\d+)?)\s*(mcg|µg|ug|mg|g|iu)\b/i);

  if (!match) {
    return { amount: null, unit: null };
  }

  return {
    amount: Number(match[1]),
    unit:
      match[2]
        ?.toLowerCase()
        .replace("µg", "mcg")
        .replace("ug", "mcg") ?? null
  };
}

async function supplementIdsForNeeds(
  sql: NonNullable<ReturnType<typeof getSql>>,
  needs: readonly ProductRecommendationNeed[]
) {
  const normalizedNames = [...new Set(
    needs.map((need) => need.normalizedName).filter(Boolean)
  )];

  if (normalizedNames.length < 1) {
    return new Map<string, string>();
  }

  const rows = await sql<Array<{
    id: string;
    normalized_alias: string;
  }>>`
    select supplements.id::text, supplement_aliases.normalized_alias
    from public.supplement_aliases
    join public.supplements
      on supplements.id = supplement_aliases.supplement_id
    where supplement_aliases.normalized_alias = any(${normalizedNames}::text[])
  `;

  return new Map(rows.map((row) => [row.normalized_alias, row.id]));
}

function factsFromMarketplaceSnapshot(
  snapshot: MarketplaceProductSnapshot,
  needs: readonly ProductRecommendationNeed[],
  supplementIds: ReadonlyMap<string, string>
) {
  const dose = titleDose(snapshot.title);

  return needs
    .filter((need) => need.itemType !== "food")
    .filter((need) => titleContainsNeed(snapshot.title, need))
    .map((need) => ({
      amount: dose.amount,
      confidence: dose.amount ? "moderate" as const : "low" as const,
      itemType: "supplement" as const,
      name: need.displayName,
      supplementId: supplementIds.get(need.normalizedName) ?? null,
      unit: dose.unit
    }));
}

export async function createAdminProduct(input: CreateAdminProductInput) {
  const sql = getSql();

  if (!sql) {
    throw new Error("Database is not configured");
  }

  const title = input.title.trim();
  const productUrl = input.productUrl.trim();

  if (!title || !productUrl) {
    throw new Error("Product title and URL are required");
  }

  const brandName = cleanNullableText(input.brandName, 200);
  const normalizedBrandName = brandName ? normalizeProductKey(brandName) : null;
  const brandRows = normalizedBrandName
    ? await sql<Array<{ id: string }>>`
        insert into public.product_brands (
          name,
          normalized_name,
          list_status,
          created_at,
          updated_at
        )
        values (
          ${brandName},
          ${normalizedBrandName},
          'unknown',
          now(),
          now()
        )
        on conflict (normalized_name) do update set
          updated_at = now()
        returning id::text
      `
    : [];
  const productRows = await sql<Array<{ id: string }>>`
    insert into public.marketplace_products (
      platform,
      region,
      marketplace_product_id,
      title,
      normalized_title,
      brand_id,
      brand_name,
      normalized_brand_name,
      image_url,
      product_url,
      normalized_url,
      list_status,
      label_status,
      availability_status,
      affiliate_status,
      price_amount,
      currency,
      source,
      created_at,
      updated_at
    )
    values (
      ${input.platform},
      ${input.region?.trim() || "TH"},
      ${cleanNullableText(input.marketplaceProductId, 300)},
      ${title},
      ${normalizeProductKey(title)},
      ${brandRows[0]?.id ?? null}::uuid,
      ${brandName},
      ${normalizedBrandName},
      ${cleanNullableText(input.imageUrl)},
      ${productUrl},
      ${normalizedUrl(productUrl)},
      ${input.listStatus ?? "unknown"},
      ${input.labelStatus ?? (input.facts?.length ? "parsed" : "missing")},
      ${input.availabilityStatus ?? "unknown"},
      ${input.affiliateUrl ? "active" : "none"},
      ${input.priceAmount ?? null},
      ${input.currency?.trim() || "THB"},
      ${input.source ?? "admin"},
      now(),
      now()
    )
    on conflict (normalized_url) do update set
      title = excluded.title,
      normalized_title = excluded.normalized_title,
      marketplace_product_id = coalesce(excluded.marketplace_product_id, marketplace_products.marketplace_product_id),
      brand_id = excluded.brand_id,
      brand_name = excluded.brand_name,
      normalized_brand_name = excluded.normalized_brand_name,
      image_url = coalesce(excluded.image_url, marketplace_products.image_url),
      list_status = excluded.list_status,
      label_status = excluded.label_status,
      availability_status = excluded.availability_status,
      affiliate_status = excluded.affiliate_status,
      price_amount = excluded.price_amount,
      currency = excluded.currency,
      updated_at = now()
    returning id::text
  `;
  const productId = productRows[0]?.id;

  if (!productId) {
    throw new Error("Product was not created");
  }

  if (input.replaceFacts && input.facts?.length) {
    await sql`
      delete from public.product_facts
      where product_id = ${productId}::uuid
        and source in ('marketplace_discovery', 'admin')
    `;
  }

  for (const fact of input.facts ?? []) {
    const factName = fact.name.trim();

    if (!factName) {
      continue;
    }

    await sql`
      insert into public.product_facts (
        product_id,
        item_type,
        supplement_id,
        name,
        normalized_name,
        amount,
        unit,
        confidence,
        source,
        created_at,
        updated_at
      )
      values (
        ${productId}::uuid,
        ${fact.itemType ?? "supplement"},
        ${fact.supplementId ?? null}::uuid,
        ${factName},
        ${normalizeProductKey(factName)},
        ${fact.amount ?? null},
        ${cleanNullableText(fact.unit, 40)},
        ${fact.confidence ?? "moderate"},
        ${input.source === "marketplace_discovery" ? "marketplace_discovery" : "admin"},
        now(),
        now()
      )
    `;
  }

  if (input.affiliateUrl) {
    await sql`
      insert into public.product_affiliate_links (
        product_id,
        url,
        status,
        created_at,
        updated_at
      )
      values (
        ${productId}::uuid,
        ${input.affiliateUrl.trim()},
        'active',
        now(),
        now()
      )
    `;
  }

  await sql`
    insert into public.product_admin_audit (
      product_id,
      actor,
      action,
      after_payload
    )
    values (
      ${productId}::uuid,
      ${input.actor ?? "admin_dashboard"},
      'product_created',
      ${sql.json({
        platform: input.platform,
        productUrl,
        title
      })}::jsonb
    )
  `;

  const data = await getAdminProductsData();
  const row = data.rows.find((product) => product.id === productId);

  if (!row) {
    throw new Error("Product not found after creation");
  }

  return row;
}

export async function importDiscoveredMarketplaceProducts(input: Readonly<{
  actor?: string | null;
  needs: readonly ProductRecommendationNeed[];
  products: readonly MarketplaceProductSnapshot[];
}>) {
  const sql = getSql();

  if (!sql || input.products.length < 1) {
    return {
      imported: 0,
      withInferredFacts: 0
    };
  }

  const supplementIds = await supplementIdsForNeeds(sql, input.needs);
  let imported = 0;
  let withInferredFacts = 0;

  for (const snapshot of input.products) {
    const facts = factsFromMarketplaceSnapshot(snapshot, input.needs, supplementIds);

    try {
      await createAdminProduct({
        actor: input.actor ?? "product_matcher",
        availabilityStatus: snapshot.availabilityStatus,
        brandName: snapshot.brandName,
        currency: snapshot.currency,
        facts,
        imageUrl: snapshot.imageUrl,
        labelStatus: facts.length > 0 ? "parsed" : "missing",
        listStatus: "unknown",
        marketplaceProductId: snapshot.marketplaceProductId,
        platform: snapshot.platform,
        priceAmount: snapshot.priceAmount ?? null,
        productUrl: snapshot.productUrl,
        region: snapshot.region,
        replaceFacts: facts.length > 0,
        source: "marketplace_discovery",
        title: snapshot.title
      });
      imported += 1;
      withInferredFacts += facts.length > 0 ? 1 : 0;
    } catch (error) {
      console.error("Unable to import discovered marketplace product", {
        error: error instanceof Error ? error.message : "Unknown product import error",
        productUrl: snapshot.productUrl,
        title: snapshot.title
      });
    }
  }

  return { imported, withInferredFacts };
}

export async function updateAdminProduct(input: UpdateAdminProductInput) {
  const sql = getSql();

  if (!sql) {
    throw new Error("Database is not configured");
  }

  const beforeRows = await sql`
    select to_jsonb(marketplace_products.*) as before_payload
    from public.marketplace_products
    where id = ${input.id}::uuid
    limit 1
  `;

  if (!beforeRows[0]) {
    throw new Error("Product not found");
  }

  const rows = await sql`
    update public.marketplace_products set
      list_status = coalesce(${input.listStatus ?? null}, list_status),
      label_status = coalesce(${input.labelStatus ?? null}, label_status),
      availability_status = coalesce(${input.availabilityStatus ?? null}, availability_status),
      affiliate_status = coalesce(${input.affiliateStatus ?? null}, affiliate_status),
      price_amount = case
        when ${input.priceAmount === undefined} then price_amount
        else ${input.priceAmount ?? null}
      end,
      admin_notes = coalesce(${input.adminNotes ?? null}, admin_notes),
      updated_at = now()
    where id = ${input.id}::uuid
    returning id::text
  `;

  await sql`
    insert into public.product_admin_audit (
      product_id,
      actor,
      action,
      before_payload,
      after_payload
    )
    values (
      ${input.id}::uuid,
      ${input.actor ?? "admin_dashboard"},
      'product_updated',
      ${sql.json(beforeRows[0].before_payload ?? {})}::jsonb,
      ${sql.json({
        affiliateStatus: input.affiliateStatus,
        availabilityStatus: input.availabilityStatus,
        labelStatus: input.labelStatus,
        listStatus: input.listStatus,
        priceAmount: input.priceAmount
      })}::jsonb
    )
  `;

  if (!rows[0]) {
    throw new Error("Product not found");
  }

  const data = await getAdminProductsData();
  const row = data.rows.find((product) => product.id === input.id);

  if (!row) {
    throw new Error("Product not found after update");
  }

  return row;
}
