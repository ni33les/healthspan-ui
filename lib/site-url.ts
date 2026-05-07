import type { Locale } from "@/lib/i18n";

export function siteBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.APP_BASE_URL ||
    "https://mattanutra.com"
  ).replace(/\/+$/, "");
}

export function buildAssessmentResultsUrl(locale: Locale, planId: string) {
  return `${siteBaseUrl()}/${locale}/assessment/results?plan=${encodeURIComponent(planId)}`;
}

export function buildReassessmentUrl(locale: Locale, planId: string) {
  return `${siteBaseUrl()}/${locale}/assessment?plan=${encodeURIComponent(planId)}&reassessment=1`;
}

export function buildUnsubscribeUrl(token: string) {
  return `${siteBaseUrl()}/api/unsubscribe?token=${encodeURIComponent(token)}`;
}
