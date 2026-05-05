import { NextResponse } from "next/server";
import {
  getAssessmentJobSnapshot,
  normalizeAssessmentPlan,
  updateAssessmentJob
} from "@/lib/assessment-jobs";
import { persistAssessmentPlanSelection } from "@/lib/assessment-store";

export const runtime = "nodejs";

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

  try {
    await persistAssessmentPlanSelection({
      answers: body.answers,
      locale: body.locale,
      previousPlanId: planId,
      selectedPlan: normalizeAssessmentPlan(body.plan),
      snapshot,
      status: snapshot.status
    });
  } catch (error) {
    console.error("Unable to persist assessment plan selection", error);
  }

  return NextResponse.json(snapshot, {
    headers: {
      "Cache-Control": "no-store"
    }
  });
}
