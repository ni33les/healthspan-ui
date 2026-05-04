import { NextResponse } from "next/server";
import { createAssessmentJob } from "@/lib/assessment-jobs";

export async function POST() {
  const snapshot = createAssessmentJob();

  return NextResponse.json(snapshot);
}
