import { NextResponse } from "next/server";
import { adminDashboardTokenAllowed } from "@/lib/admin-auth";
import { dismissAdminReviewJob } from "@/lib/admin-review-queue";
import { isUuid } from "@/lib/assessment-store";

export const runtime = "nodejs";

type AdminReviewJobRouteProps = Readonly<{
  params: Promise<{
    id: string;
  }>;
}>;

function textOrNull(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  return trimmed || null;
}

export async function PATCH(
  request: Request,
  { params }: AdminReviewJobRouteProps
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
      { message: "Review job not found" },
      {
        headers: {
          "Cache-Control": "no-store"
        },
        status: 404
      }
    );
  }

  if (textOrNull(body.action) !== "dismiss") {
    return NextResponse.json(
      { message: "Unsupported review action" },
      {
        headers: {
          "Cache-Control": "no-store"
        },
        status: 400
      }
    );
  }

  try {
    const data = await dismissAdminReviewJob({
      actor: "admin_dashboard",
      id
    });

    return NextResponse.json(
      { data },
      {
        headers: {
          "Cache-Control": "no-store"
        }
      }
    );
  } catch (error) {
    console.error("Unable to update review job", {
      error,
      reviewJobId: id
    });

    return NextResponse.json(
      { message: "Unable to update review job" },
      {
        headers: {
          "Cache-Control": "no-store"
        },
        status: 500
      }
    );
  }
}
