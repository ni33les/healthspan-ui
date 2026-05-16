import { NextResponse } from "next/server";
import { adminDashboardOrClawRequestAllowed } from "@/lib/admin-auth";
import {
  isProductAvailabilityStatus,
  isProductLabelStatus,
  isProductListStatus,
  updateAdminProduct,
  type ProductAffiliateStatus
} from "@/lib/admin-products";
import { isUuid } from "@/lib/assessment-store";

export const runtime = "nodejs";

type AdminProductRouteProps = Readonly<{
  params: Promise<{
    id: string;
  }>;
}>;

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

function parseAffiliateStatus(value: unknown): ProductAffiliateStatus | undefined {
  const normalized = normalizedKey(value);

  return normalized === "active" ||
    normalized === "flagged_stale" ||
    normalized === "none"
    ? normalized
    : undefined;
}

function parseOptionalNumber(value: unknown) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === "") {
    return null;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

export async function PATCH(
  request: Request,
  { params }: AdminProductRouteProps
) {
  const { id } = await params;
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

  if (!isUuid(id)) {
    return NextResponse.json(
      { message: "Product not found" },
      {
        headers: {
          "Cache-Control": "no-store"
        },
        status: 404
      }
    );
  }

  const listStatus = normalizedKey(body.listStatus);
  const labelStatus = normalizedKey(body.labelStatus);
  const availabilityStatus = normalizedKey(body.availabilityStatus);
  const priceAmount = parseOptionalNumber(body.priceAmount);

  if (
    (body.listStatus !== undefined && !isProductListStatus(listStatus)) ||
    (body.labelStatus !== undefined && !isProductLabelStatus(labelStatus)) ||
    (body.availabilityStatus !== undefined &&
      !isProductAvailabilityStatus(availabilityStatus)) ||
    (priceAmount === undefined && body.priceAmount !== undefined)
  ) {
    return NextResponse.json(
      { message: "Invalid product governance payload" },
      {
        headers: {
          "Cache-Control": "no-store"
        },
        status: 400
      }
    );
  }

  try {
    const row = await updateAdminProduct({
      actor: "admin_dashboard",
      adminNotes: textOrNull(body.adminNotes),
      affiliateStatus: parseAffiliateStatus(body.affiliateStatus),
      availabilityStatus: isProductAvailabilityStatus(availabilityStatus)
        ? availabilityStatus
        : undefined,
      id,
      labelStatus: isProductLabelStatus(labelStatus) ? labelStatus : undefined,
      listStatus: isProductListStatus(listStatus) ? listStatus : undefined,
      priceAmount
    });

    return NextResponse.json(
      { row },
      {
        headers: {
          "Cache-Control": "no-store"
        }
      }
    );
  } catch (error) {
    console.error("Unable to update marketplace product", error);

    return NextResponse.json(
      { message: "Unable to update marketplace product" },
      {
        headers: {
          "Cache-Control": "no-store"
        },
        status: 500
      }
    );
  }
}
