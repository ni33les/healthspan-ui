import { NextResponse } from "next/server";
import { createAssessmentJob } from "@/lib/assessment-jobs";

export async function POST(request: Request) {
  let body: { answers?: unknown; locale?: unknown; plan?: unknown } = {
    plan: "free"
  };

  try {
    body = (await request.json()) as {
      answers?: unknown;
      locale?: unknown;
      plan?: unknown;
    };
  } catch {
    body = { plan: "free" };
  }

  const snapshot = createAssessmentJob(body);

  return NextResponse.json(snapshot, {
    headers: {
      "Cache-Control": "no-store"
    }
  });
}
