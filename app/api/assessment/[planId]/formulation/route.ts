import { NextResponse } from "next/server";
import { getAssessmentJobSnapshot } from "@/lib/assessment-jobs";
import { isLocale, type Locale } from "@/lib/i18n";
import { getMockFormulationResult } from "@/lib/mock-formulation";

type FormulationRouteProps = Readonly<{
  params: Promise<{
    planId: string;
  }>;
}>;

export async function GET(request: Request, { params }: FormulationRouteProps) {
  const { planId } = await params;
  const snapshot = getAssessmentJobSnapshot(planId);

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

  const requestedLocale = new URL(request.url).searchParams.get("locale");
  const localeCandidate = requestedLocale ?? undefined;
  const locale: Locale = isLocale(localeCandidate)
    ? localeCandidate
    : "en";

  return NextResponse.json(
    getMockFormulationResult(planId, locale, snapshot?.plan ?? "free")
  );
}
