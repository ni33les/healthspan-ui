import { notFound, redirect } from "next/navigation";
import { isUuid } from "@/lib/assessment-store";
import { isLocale, type Locale } from "@/lib/i18n";
import { nutritionPlanPath } from "@/lib/nutrition-paths";

type AssessmentPlanRedirectPageProps = Readonly<{
  params: Promise<{
    locale: string;
  }>;
  searchParams: Promise<{
    plan?: string;
  }>;
}>;

export default async function AssessmentPlanRedirectPage({
  params,
  searchParams
}: AssessmentPlanRedirectPageProps) {
  const { locale: rawLocale } = await params;

  if (!isLocale(rawLocale)) {
    notFound();
  }

  const locale: Locale = rawLocale;
  const { plan } = await searchParams;
  const planId = typeof plan === "string" && isUuid(plan) ? plan : "";

  if (!planId) {
    notFound();
  }

  redirect(nutritionPlanPath(locale, planId));
}
