import { NextResponse } from "next/server";
import {
  createAssessmentSnapshot,
  normalizeAssessmentPlan
} from "@/lib/assessment-jobs";
import { persistAssessmentSubmission } from "@/lib/assessment-store";
import { enqueueFormulationJob, kickJobsWorker } from "@/lib/job-queue";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: {
    answers?: unknown;
    intent?: "capture" | "process";
    locale?: unknown;
    plan?: unknown;
  } = {
    plan: "free"
  };

  try {
    body = (await request.json()) as {
      answers?: unknown;
      intent?: "capture" | "process";
      locale?: unknown;
      plan?: unknown;
    };
  } catch {
    body = { plan: "free" };
  }

  const selectedPlan =
    body.intent === "capture" ? null : normalizeAssessmentPlan(body.plan);
  const snapshot = createAssessmentSnapshot({
    plan: selectedPlan ?? body.plan
  });

  try {
    await persistAssessmentSubmission({
      answers: body.answers,
      locale: body.locale,
      selectedPlan,
      snapshot,
      status: body.intent === "capture" ? "captured" : snapshot.status
    });

    if (body.intent === "process" && selectedPlan) {
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
    }
  } catch (error) {
    console.error("Unable to persist assessment submission", error);

    return NextResponse.json(
      { message: "Unable to save assessment" },
      {
        headers: {
          "Cache-Control": "no-store"
        },
        status: 500
      }
    );
  }

  return NextResponse.json(snapshot, {
    headers: {
      "Cache-Control": "no-store"
    }
  });
}
