import { notFound } from "next/navigation";
import { AdminDashboard } from "@/components/admin-dashboard";
import { adminDashboardTokenAllowed } from "@/lib/admin-auth";
import {
  getAdminDashboardData,
  normalizeAdminDashboardRange
} from "@/lib/admin-dashboard-data";
import { normalizeAdminDashboardFilters } from "@/lib/admin-dashboard-filters";
import { getAdminFlowData } from "@/lib/admin-flow-data";

export const dynamic = "force-dynamic";

type AdminDashboardPageProps = Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>;

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminDashboardPage({
  searchParams
}: AdminDashboardPageProps) {
  const params = await searchParams;
  const accessToken = firstParam(params.access_token);
  const range = normalizeAdminDashboardRange(params.range);
  const view = firstParam(params.view) === "flow" ? "flow" : "kpi";
  const filters = normalizeAdminDashboardFilters(params);

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
      locale="en"
      view={view}
    />
  );
}
