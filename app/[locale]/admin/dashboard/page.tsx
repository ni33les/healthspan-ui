import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminDashboard } from "@/components/admin-dashboard";
import { adminDashboardTokenAllowed } from "@/lib/admin-auth";
import {
  getAdminDashboardData,
  normalizeAdminDashboardRange
} from "@/lib/admin-dashboard-data";
import { normalizeAdminDashboardFilters } from "@/lib/admin-dashboard-filters";
import { getAdminFlowData } from "@/lib/admin-flow-data";
import { isLocale, type Locale } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: {
    follow: false,
    index: false
  },
  title: "MattaNutra Admin"
};

type LocalizedAdminDashboardPageProps = Readonly<{
  params: Promise<{
    locale: string;
  }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>;

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function LocalizedAdminDashboardPage({
  params,
  searchParams
}: LocalizedAdminDashboardPageProps) {
  const [{ locale: rawLocale }, query] = await Promise.all([
    params,
    searchParams
  ]);

  if (!isLocale(rawLocale)) {
    notFound();
  }

  const locale: Locale = rawLocale;
  const accessToken = firstParam(query.access_token);
  const range = normalizeAdminDashboardRange(query.range);
  const view = firstParam(query.view) === "flow" ? "flow" : "kpi";
  const filters = normalizeAdminDashboardFilters(query);

  if (!adminDashboardTokenAllowed(accessToken)) {
    notFound();
  }

  const [data, flowData] = await Promise.all([
    getAdminDashboardData(range, filters),
    getAdminFlowData(range, filters)
  ]);

  return (
    <AdminDashboard
      accessToken={accessToken ?? ""}
      data={data}
      filters={filters}
      flowData={flowData}
      locale={locale}
      view={view}
    />
  );
}
