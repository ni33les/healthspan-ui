import { NextResponse } from "next/server";
import { getAssessmentJobSnapshot } from "@/lib/assessment-jobs";
import { getMockFormulationResult } from "@/lib/mock-formulation";

type FormulationRouteProps = Readonly<{
  params: Promise<{
    jobId: string;
  }>;
}>;

export async function GET(_request: Request, { params }: FormulationRouteProps) {
  const { jobId } = await params;
  const snapshot = getAssessmentJobSnapshot(jobId);

  if (snapshot && snapshot.status !== "ready") {
    return NextResponse.json(
      {
        message: "Formulation is still being prepared",
        status: snapshot.status,
        steps: snapshot.steps
      },
      { status: 202 }
    );
  }

  return NextResponse.json(getMockFormulationResult(jobId));
}
