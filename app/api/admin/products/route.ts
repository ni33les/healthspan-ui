import { NextResponse } from "next/server";
import { adminDashboardOrClawRequestAllowed } from "@/lib/admin-auth";
import {
  createAdminProduct,
  isProductAvailabilityStatus,
  isProductLabelStatus,
  isProductListStatus,
  isProductPlatform
} from "@/lib/admin-products";
import type { ProductConfidence } from "@/lib/product-recommendations";

export const runtime = "nodejs";

function textOrNull(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  return trimmed ? trimmed.slice(0, 2000) : null;
}

function normalizedKey(value: unknown) {
  return typeof value === "string"
    ? value.trim().toLowerCase().replaceAll("-", "_")
    : "";
}

function numberOrNull(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function factsFromBody(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => (item && typeof item === "object" ? item as Record<string, unknown> : null))
    .filter((item): item is Record<string, unknown> => Boolean(item))
    .map((item) => {
      const itemType: "food" | "nutrient" | "supplement" =
        item.itemType === "food" || item.itemType === "nutrient"
          ? item.itemType
          : "supplement";

      return {
        amount: numberOrNull(item.amount),
        confidence:
        item.confidence === "high" || item.confidence === "low"
          ? item.confidence as ProductConfidence
          : "moderate" as ProductConfidence,
        itemType,
        name: textOrNull(item.name) ?? "",
        supplementId: textOrNull(item.supplementId),
        unit: textOrNull(item.unit)
      };
    })
    .filter((item) => item.name);
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const accessToken =
    request.headers.get("x-admin-dashboard-token") ?? textOrNull(body.accessToken);

  if (!adminDashboardOrClawRequestAllowed(request, accessToken)) {
    return NextResponse.json(
      { message: "Not found" },
      {
        headers: {
          "Cache-Control": "no-store"
        },
        status: 404
      }
    );
  }

  const platform = normalizedKey(body.platform);
  const listStatus = normalizedKey(body.listStatus);
  const labelStatus = normalizedKey(body.labelStatus);
  const availabilityStatus = normalizedKey(body.availabilityStatus);
  const title = textOrNull(body.title);
  const productUrl = textOrNull(body.productUrl);

  if (
    !title ||
    !productUrl ||
    !isProductPlatform(platform) ||
    (body.listStatus !== undefined && !isProductListStatus(listStatus)) ||
    (body.labelStatus !== undefined && !isProductLabelStatus(labelStatus)) ||
    (body.availabilityStatus !== undefined &&
      !isProductAvailabilityStatus(availabilityStatus))
  ) {
    return NextResponse.json(
      { message: "Invalid product import payload" },
      {
        headers: {
          "Cache-Control": "no-store"
        },
        status: 400
      }
    );
  }

  try {
    const row = await createAdminProduct({
      actor: "admin_dashboard",
      affiliateUrl: textOrNull(body.affiliateUrl),
      availabilityStatus: isProductAvailabilityStatus(availabilityStatus)
        ? availabilityStatus
        : undefined,
      brandName: textOrNull(body.brandName),
      currency: textOrNull(body.currency) ?? "THB",
      facts: factsFromBody(body.facts),
      imageUrl: textOrNull(body.imageUrl),
      labelStatus: isProductLabelStatus(labelStatus) ? labelStatus : undefined,
      listStatus: isProductListStatus(listStatus) ? listStatus : undefined,
      platform,
      priceAmount: numberOrNull(body.priceAmount),
      productUrl,
      region: textOrNull(body.region) ?? "TH",
      title
    });

    return NextResponse.json(
      { row },
      {
        headers: {
          "Cache-Control": "no-store"
        },
        status: 201
      }
    );
  } catch (error) {
    console.error("Unable to import marketplace product", error);

    return NextResponse.json(
      { message: "Unable to import marketplace product" },
      {
        headers: {
          "Cache-Control": "no-store"
        },
        status: 500
      }
    );
  }
}
