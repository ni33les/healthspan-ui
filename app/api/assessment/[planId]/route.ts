import { NextResponse } from "next/server";
import {
  getAssessmentJobSnapshot,
  normalizeAssessmentPlan,
  updateAssessmentJob
} from "@/lib/assessment-jobs";
import {
  getStoredAssessmentSnapshot,
  persistAssessmentPlanSelection
} from "@/lib/assessment-store";
import { enqueueFormulationJob, kickJobsWorker } from "@/lib/job-queue";

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
  const snapshot =
    (await getStoredAssessmentSnapshot(planId)) ?? getAssessmentJobSnapshot(planId);

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

  if (snapshot.status !== "ready") {
    void kickJobsWorker();
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
    const selectedPlan = normalizeAssessmentPlan(body.plan);

    await persistAssessmentPlanSelection({
      answers: body.answers,
      locale: body.locale,
      previousPlanId: planId,
      selectedPlan,
      snapshot,
      status: "queued"
    });
    await enqueueFormulationJob({
      answers: body.answers,
      locale: body.locale,
      plan: selectedPlan,
      planId: snapshot.planId
    });
    void kickJobsWorker();
  } catch (error) {
    console.error("Unable to persist assessment plan selection", error);
  }

  const storedSnapshot = await getStoredAssessmentSnapshot(snapshot.planId);

  return NextResponse.json(storedSnapshot ?? snapshot, {
    headers: {
      "Cache-Control": "no-store"
    }
  });
}
