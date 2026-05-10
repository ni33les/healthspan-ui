import { adminDashboardTokenAllowed } from "@/lib/admin-auth";
import { normalizeAdminDashboardRange } from "@/lib/admin-dashboard-data";
import { getAdminGoalsData } from "@/lib/admin-goals";
import { streamAdminSnapshots } from "@/lib/admin-sse";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const accessToken = url.searchParams.get("access_token");

  if (!adminDashboardTokenAllowed(accessToken)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const range = normalizeAdminDashboardRange(
    url.searchParams.get("range") ?? undefined
  );
  const selectedGoalId = url.searchParams.get("goal");

  return streamAdminSnapshots({
    eventName: "goals",
    load: () => getAdminGoalsData(range, selectedGoalId),
    request
  });
}
