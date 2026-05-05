import { NextResponse } from "next/server";
import { isLocale, type Locale } from "@/lib/i18n";
import { getMockFormulationResult } from "@/lib/mock-formulation";
import {
  getStoredAssessmentSnapshot,
  getStoredFormulationResult
} from "@/lib/assessment-store";
import { kickJobsWorker } from "@/lib/job-queue";

type FormulationRouteProps = Readonly<{
  params: Promise<{
    planId: string;
  }>;
}>;

export async function GET(request: Request, { params }: FormulationRouteProps) {
  const { planId } = await params;
  const snapshot = await getStoredAssessmentSnapshot(planId);

  if (snapshot && snapshot.status !== "ready") {
    void kickJobsWorker();

    return NextResponse.json(
      {
        message: "Formulation is still being prepared",
        status: snapshot.status,
        steps: snapshot.steps
      },
      { status: 202 }
    );
  }

  const requestedLocale = new URL(request.url).searchParams.get("locale");
  const localeCandidate = requestedLocale ?? undefined;
  const locale: Locale = isLocale(localeCandidate)
    ? localeCandidate
    : "en";
  const storedResult = await getStoredFormulationResult(planId);

  if (storedResult) {
    return NextResponse.json(storedResult);
  }

  if (snapshot) {
    void kickJobsWorker();

    return NextResponse.json(
      {
        message: "Formulation is still being prepared",
        status: snapshot.status,
        steps: snapshot.steps
      },
      { status: 202 }
    );
  }

  return NextResponse.json(getMockFormulationResult(planId, locale, "free"));
}
