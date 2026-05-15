import { NextResponse } from "next/server";
import { adminDashboardOrClawRequestAllowed } from "@/lib/admin-auth";
import {
  isFoodConfidence,
  isFoodListStatus,
  updateAdminFood,
  type FoodConfidence,
  type FoodListStatus
} from "@/lib/admin-foods";
import { isUuid } from "@/lib/assessment-store";
import {
  normalizeFoodNutrientProfileInput,
  normalizeFoodServingSize
} from "@/lib/food-nutrients";
import {
  parseFoodBenefitTagInput,
  parseFoodNutrientTagInput
} from "@/lib/food-tags";

export const runtime = "nodejs";

type AdminFoodRouteProps = Readonly<{
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

function parseListStatus(value: unknown): FoodListStatus | null {
  const normalized = normalizedKey(value);

  return isFoodListStatus(normalized) ? normalized : null;
}

function parseConfidence(value: unknown): FoodConfidence | null {
  const normalized = normalizedKey(value);

  return isFoodConfidence(normalized) ? normalized : null;
}

export async function PATCH(
  request: Request,
  { params }: AdminFoodRouteProps
) {
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;
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
      { message: "Food not found" },
      {
        headers: {
          "Cache-Control": "no-store"
        },
        status: 404
      }
    );
  }

  const listStatus = parseListStatus(body.listStatus);
  const confidence = parseConfidence(body.confidence);
  const benefitTags = parseFoodBenefitTagInput(body.benefitTags);
  const defaultServing =
    body.defaultServing === undefined
      ? undefined
      : body.defaultServing === null
        ? null
        : normalizeFoodServingSize(body.defaultServing);
  const nutrientProfile = normalizeFoodNutrientProfileInput(body.nutrientProfile);
  const nutrientTags = parseFoodNutrientTagInput(body.nutrientTags);

  if (
    !listStatus ||
    !confidence ||
    benefitTags === null ||
    (body.defaultServing !== undefined &&
      body.defaultServing !== null &&
      defaultServing === null) ||
    nutrientProfile === null ||
    nutrientTags === null
  ) {
    return NextResponse.json(
      { message: "Invalid food governance payload" },
      {
        headers: {
          "Cache-Control": "no-store"
        },
        status: 400
      }
    );
  }

  try {
    const row = await updateAdminFood({
      actor: "admin_dashboard",
      benefitTags,
      confidence,
      defaultServing,
      id,
      listStatus,
      nutrientProfile,
      nutrientTags,
      safetyNotes: textOrNull(body.safetyNotes)
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
    console.error("Unable to update food", error);

    return NextResponse.json(
      { message: "Unable to update food" },
      {
        headers: {
          "Cache-Control": "no-store"
        },
        status: 500
      }
    );
  }
}
