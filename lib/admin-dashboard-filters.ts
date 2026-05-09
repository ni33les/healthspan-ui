export type AdminDashboardFilters = Readonly<{
  affiliate: string;
  campaign: string;
  campaignId: string;
  device: string;
  emailHash: string;
  locale: string;
  medium: string;
  planId: string;
  promoCode: string;
  ray: string;
  selectedPlan: string;
  source: string;
}>;

type SearchParamValue = string | string[] | undefined;

const filterKeys = [
  "affiliate",
  "campaign",
  "campaignId",
  "device",
  "emailHash",
  "locale",
  "medium",
  "planId",
  "promoCode",
  "ray",
  "selectedPlan",
  "source"
] as const satisfies ReadonlyArray<keyof AdminDashboardFilters>;

export const emptyAdminDashboardFilters: AdminDashboardFilters = {
  affiliate: "",
  campaign: "",
  campaignId: "",
  device: "",
  emailHash: "",
  locale: "",
  medium: "",
  planId: "",
  promoCode: "",
  ray: "",
  selectedPlan: "",
  source: ""
};

function firstParam(value: SearchParamValue) {
  return Array.isArray(value) ? value[0] : value;
}

function cleanParam(value: SearchParamValue) {
  return (firstParam(value) ?? "").trim().slice(0, 200);
}

function cleanFirstParam(...values: SearchParamValue[]) {
  for (const value of values) {
    const cleaned = cleanParam(value);

    if (cleaned) {
      return cleaned;
    }
  }

  return "";
}

function cleanLocaleFilter(value: SearchParamValue) {
  const locale = cleanParam(value).toLowerCase();

  return locale === "en" || locale === "th" || locale === "none"
    ? locale
    : "";
}

function cleanDeviceFilter(...values: SearchParamValue[]) {
  const allowedDevices = new Set(["desktop", "mobile", "tablet"]);
  const value = cleanFirstParam(...values).toLowerCase();

  if (value === "none") {
    return "none";
  }

  const devices = value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => allowedDevices.has(item));

  if (devices.length === 0 || devices.length === allowedDevices.size) {
    return "";
  }

  return [...new Set(devices)].sort().join(",");
}

export function normalizeAdminDashboardFilters(
  params: Partial<
    Record<keyof AdminDashboardFilters, SearchParamValue> &
      Record<string, SearchParamValue>
  >
): AdminDashboardFilters {
  return {
    affiliate: cleanFirstParam(
      params.affiliate,
      params.affiliate_id,
      params.affiliate_ref,
      params.affiliate_sub_id
    ),
    campaign: cleanFirstParam(
      params.campaign,
      params.utm_campaign,
      params.campaign_name
    ),
    campaignId: cleanFirstParam(params.campaignId, params.campaign_id),
    device: cleanDeviceFilter(params.device, params.device_type),
    emailHash: cleanFirstParam(params.emailHash, params.email_hash),
    locale: cleanLocaleFilter(params.locale),
    medium: cleanFirstParam(params.medium, params.utm_medium),
    planId: cleanFirstParam(params.planId, params.plan_id, params.plan),
    promoCode: cleanFirstParam(params.promoCode, params.promo_code),
    ray: cleanParam(params.ray),
    selectedPlan: cleanFirstParam(params.selectedPlan, params.selected_plan),
    source: cleanFirstParam(
      params.source,
      params.utm_source,
      params.traffic_source,
      params.source_channel
    )
  };
}

export function adminDashboardFilterEntries(filters: AdminDashboardFilters) {
  return filterKeys
    .map((key) => [key, filters[key]] as const)
    .filter(([, value]) => value.length > 0);
}

export function hasAdminDashboardFilters(filters: AdminDashboardFilters) {
  return adminDashboardFilterEntries(filters).length > 0;
}
