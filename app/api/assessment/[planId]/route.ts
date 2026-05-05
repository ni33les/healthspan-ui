import { NextResponse } from "next/server";
import {
  getAssessmentJobSnapshot,
  updateAssessmentJob
} from "@/lib/assessment-jobs";

type AssessmentStatusRouteProps = Readonly<{
  params: Promise<{
    planId: string;
  }>;
}>;

export async function GET(
  _request: Request,
  { params }: AssessmentStatusRouteProps
) {
  const { planId } = await params;
  const snapshot = getAssessmentJobSnapshot(planId);

  if (!snapshot) {
    return NextResponse.json(
      { message: "Assessment plan not found" },
      {
        headers: {
          "Cache-Control": "no-store"
        },
        status: 404
      }
    );
  }

  return NextResponse.json(snapshot, {
    headers: {
      "Cache-Control": "no-store"
    }
  });
}

export async function PATCH(
  request: Request,
  { params }: AssessmentStatusRouteProps
) {
  const { planId } = await params;
  let body: { answers?: unknown; locale?: unknown; plan?: unknown } = {};

  try {
    body = (await request.json()) as {
      answers?: unknown;
      locale?: unknown;
      plan?: unknown;
    };
  } catch {
    body = {};
  }

  const snapshot = updateAssessmentJob(planId, body);

  if (!snapshot) {
    return NextResponse.json(
      { message: "Assessment plan not found" },
      {
        headers: {
          "Cache-Control": "no-store"
        },
        status: 404
      }
    );
  }

  return NextResponse.json(snapshot, {
    headers: {
      "Cache-Control": "no-store"
    }
  });
}
