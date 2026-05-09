import { NextResponse } from "next/server";
import { adminDashboardTokenAllowed } from "@/lib/admin-auth";
import {
  isSupplementConfidence,
  isSupplementListStatus,
  updateAdminSupplement
} from "@/lib/admin-supplements";
import { isUuid } from "@/lib/assessment-store";
import { isSupplementSafetyFlags } from "@/lib/supplement-safety-flags";

export const runtime = "nodejs";

type AdminSupplementRouteProps = Readonly<{
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

function amountValue(value: unknown) {
  if (value === null || value === "") {
    return null;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export async function PATCH(
  request: Request,
  { params }: AdminSupplementRouteProps
) {
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;
  const accessToken =
    request.headers.get("x-admin-dashboard-token") ?? textOrNull(body.accessToken);

  if (!adminDashboardTokenAllowed(accessToken)) {
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
      { message: "Supplement not found" },
      {
        headers: {
          "Cache-Control": "no-store"
        },
        status: 404
      }
    );
  }

  if (
    !isSupplementListStatus(body.listStatus) ||
    !isSupplementConfidence(body.confidence) ||
    !isSupplementSafetyFlags(body.safetyFlags)
  ) {
    return NextResponse.json(
      { message: "Invalid supplement status" },
      {
        headers: {
          "Cache-Control": "no-store"
        },
        status: 400
      }
    );
  }

  try {
    const row = await updateAdminSupplement({
      actor: "admin_dashboard",
      confidence: body.confidence,
      id,
      listStatus: body.listStatus,
      maxAmount: amountValue(body.maxAmount),
      maxUnit: textOrNull(body.maxUnit) ?? "",
      safetyFlags: body.safetyFlags,
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
    console.error("Unable to update supplement", error);

    return NextResponse.json(
      { message: "Unable to update supplement" },
      {
        headers: {
          "Cache-Control": "no-store"
        },
        status: 500
      }
    );
  }
}
