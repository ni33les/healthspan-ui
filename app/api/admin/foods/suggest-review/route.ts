import { NextResponse } from "next/server";
import { adminDashboardOrClawRequestAllowed } from "@/lib/admin-auth";
import { suggestFoodReviewDetails } from "@/lib/food-review-suggestion";
import { isLocale, type Locale } from "@/lib/i18n";

export const runtime = "nodejs";

function textOrNull(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  return trimmed ? trimmed.slice(0, 2000) : null;
}

function localeValue(value: unknown): Locale {
  return typeof value === "string" && isLocale(value) ? value : "en";
}

export async function POST(request: Request) {
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

  const foodName = textOrNull(body.foodName);

  if (!foodName) {
    return NextResponse.json(
      { message: "Food name is required" },
      {
        headers: {
          "Cache-Control": "no-store"
        },
        status: 400
      }
    );
  }

  try {
    const suggestion = await suggestFoodReviewDetails({
      currentFrequency: textOrNull(body.currentFrequency),
      currentRationale: textOrNull(body.currentRationale),
      currentServing: textOrNull(body.currentServing),
      flagReason: textOrNull(body.flagReason),
      foodName,
      locale: localeValue(body.locale),
      reviewKind: textOrNull(body.reviewKind)
    });

    return NextResponse.json(
      { suggestion },
      {
        headers: {
          "Cache-Control": "no-store"
        }
      }
    );
  } catch (error) {
    console.error("Unable to suggest food review details", {
      error,
      foodName
    });

    return NextResponse.json(
      { message: "Unable to suggest food review details" },
      {
        headers: {
          "Cache-Control": "no-store"
        },
        status: 500
      }
    );
  }
}
