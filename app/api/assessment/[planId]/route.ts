import { NextResponse } from "next/server";
import {
  createAssessmentSnapshot,
  isAssessmentPlan
} from "@/lib/assessment-jobs";
import {
  getStoredAssessmentSnapshot,
  isUuid,
  persistAssessmentSubmission
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
  const snapshot = await getStoredAssessmentSnapshot(planId);

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

  if (!isUuid(planId)) {
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

  if (!isAssessmentPlan(body.plan)) {
    return NextResponse.json(
      { message: "Unsupported assessment plan" },
      {
        headers: {
          "Cache-Control": "no-store"
        },
        status: 400
      }
    );
  }

  try {
    const selectedPlan = body.plan;
    const existingSnapshot = await getStoredAssessmentSnapshot(planId);
    const snapshot = createAssessmentSnapshot({
      plan: selectedPlan,
      planId,
      queuePosition: existingSnapshot?.queuePosition,
      status: "queued"
    });

    await persistAssessmentSubmission({
      answers: body.answers,
      locale: body.locale,
      selectedPlan,
      snapshot,
      status: "queued"
    });
    const jobId = await enqueueFormulationJob({
      answers: body.answers,
      locale: body.locale,
      plan: selectedPlan,
      planId: snapshot.planId
    });

    if (!jobId) {
      throw new Error("Unable to queue assessment processing");
    }

    void kickJobsWorker();

    const storedSnapshot = await getStoredAssessmentSnapshot(snapshot.planId);

    return NextResponse.json(storedSnapshot ?? snapshot, {
      headers: {
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    console.error("Unable to persist assessment plan selection", error);

    return NextResponse.json(
      { message: "Unable to start assessment processing" },
      {
        headers: {
          "Cache-Control": "no-store"
        },
        status: 500
      }
    );
  }
}
