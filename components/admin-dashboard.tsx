"use client";

import {
  useEffect,
  useState,
  type ComponentType,
  type SVGProps
} from "react";
import {
  Bars3Icon,
  BeakerIcon,
  ChartPieIcon,
  ChevronDownIcon,
  DocumentTextIcon,
  EnvelopeIcon,
  ExclamationTriangleIcon,
  FunnelIcon,
  HomeIcon,
  MegaphoneIcon,
  QueueListIcon,
  ShieldCheckIcon,
  XMarkIcon
} from "@heroicons/react/24/outline";
import { HealthspanLogo } from "@/components/healthspan-logo";
import type {
  AdminDashboardData,
  AdminDashboardKpi,
  AdminDashboardKpiId,
  AdminDashboardRate,
  AdminDashboardRateId,
  AdminDashboardRange
} from "@/lib/admin-dashboard-data";
import {
  adminDashboardFilterEntries,
  emptyAdminDashboardFilters,
  hasAdminDashboardFilters,
  type AdminDashboardFilters
} from "@/lib/admin-dashboard-filters";
import type {
  AdminFlowData,
  AdminFlowNodeId
} from "@/lib/admin-flow-data";
import type { Locale } from "@/lib/i18n";

type AdminDashboardView = "flow" | "kpi";
type Icon = ComponentType<SVGProps<SVGSVGElement>>;

type AdminNavItem = Readonly<{
  current?: boolean;
  href?: string;
  icon: Icon;
  name: string;
  view?: AdminDashboardView;
}>;

type KpiText = Readonly<{
  title: string;
}>;

type RateText = Readonly<{
  formula: string;
  title: string;
}>;

type AdminContent = Readonly<{
  bucketPrefix: string;
  closeSidebar: string;
  dataUnavailable: string;
  emptyFlow: string;
  filters: {
    active: string;
    affiliate: string;
    apply: string;
    campaign: string;
    campaignId: string;
    clear: string;
    device: string;
    emailHash: string;
    locale: string;
    medium: string;
    planId: string;
    promoCode: string;
    ray: string;
    selectedPlan: string;
    source: string;
    title: string;
  };
  generated: string;
  flowNodes: Record<AdminFlowNodeId, string>;
  flowMetrics: {
    dropped: string;
    happy: string;
    next: string;
    reached: string;
  };
  flowSummary: {
    conversionRate: string;
    converted: string;
    entered: string;
    reachedHealthScore: string;
  };
  flowStatus: {
    lossy: string;
    needsWork: string;
    okay: string;
  };
  flowTitle: string;
  kpis: Record<AdminDashboardKpiId, KpiText>;
  navigation: AdminNavItem[];
  nextBuckets: string;
  openSidebar: string;
  queues: AdminNavItem[];
  queuesTitle: string;
  pageTitles: Record<AdminDashboardView, string>;
  ranges: Record<AdminDashboardRange, string>;
  rates: Record<AdminDashboardRateId, RateText>;
  ratesTitle: string;
  title: string;
  trend: Record<AdminDashboardKpi["trend"], string>;
}>;

const rangeOrder: AdminDashboardRange[] = [
  "hour",
  "day",
  "week",
  "month",
  "year",
  "all"
];

const content = {
  en: {
    bucketPrefix: "per",
    closeSidebar: "Close sidebar",
    dataUnavailable:
      "Dashboard data is unavailable. Check the database connection and BPM table.",
    emptyFlow: "No flow events in this timeframe.",
    filters: {
      active: "Active filters",
      affiliate: "Affiliate",
      apply: "Apply filters",
      campaign: "Campaign",
      campaignId: "Campaign ID",
      clear: "Clear",
      device: "Device",
      emailHash: "Email hash",
      locale: "Locale",
      medium: "Medium",
      planId: "Plan ID",
      promoCode: "Promo code",
      ray: "Ray",
      selectedPlan: "Plan",
      source: "Source",
      title: "Filters"
    },
    generated: "Generated",
    flowNodes: {
      assessmentStarted: "Started",
      assessmentSubmitted: "Submitted",
      assessmentViewed: "Assessment",
      chatClicked: "Chat",
      dropoffAfterAssessment: "Dropped after assessment",
      dropoffAfterAssessmentStart: "Dropped after start",
      dropoffAfterFormulation: "Dropped after nutrition plan",
      dropoffAfterFreeEmailRequest: "Dropped after free request",
      dropoffAfterHealthScore: "Dropped after HealthScore",
      dropoffAfterLanding: "Dropped after landing",
      dropoffAfterPlanSelection: "Dropped after plan",
      dropoffAfterPrecisionPayment: "Dropped after Precision",
      dropoffAfterProPayment: "Dropped after Pro",
      dropoffAfterResults: "Dropped after results",
      dropoffAfterSubmission: "Dropped after submission",
      formulationReady: "Nutrition plan",
      freeEmailRequested: "Free email",
      freeEmailSent: "Email sent",
      healthscoreViewed: "HealthScore",
      landingViewed: "Landing",
      marketplaceClicked: "Marketplace",
      planSelected: "Plan selected",
      precisionPaid: "Precision paid",
      proPaid: "Pro paid",
      resultsViewed: "Results"
    },
    flowMetrics: {
      dropped: "Dropped",
      happy: "Happy",
      next: "Next",
      reached: "Reached"
    },
    flowSummary: {
      conversionRate: "Conversion",
      converted: "Converted",
      entered: "Landed",
      reachedHealthScore: "HealthScore"
    },
    flowStatus: {
      lossy: "Lossy",
      needsWork: "Needs work",
      okay: "Okay"
    },
    flowTitle: "Sales Conversions",
    kpis: {
      free: {
        title: "Free conversions"
      },
      precision: {
        title: "Precision conversions"
      },
      pro: {
        title: "Pro conversions"
      }
    },
    navigation: [
      { icon: HomeIcon, name: "KPI", view: "kpi" },
      { icon: FunnelIcon, name: "Conversions", view: "flow" },
      { href: "#", icon: MegaphoneIcon, name: "Campaigns" },
      { href: "#", icon: EnvelopeIcon, name: "Leads" },
      { href: "#", icon: ShieldCheckIcon, name: "Safety" },
      { href: "#", icon: BeakerIcon, name: "Supplements" },
      { href: "#", icon: DocumentTextIcon, name: "Content" }
    ],
    nextBuckets: "Next 3 buckets",
    openSidebar: "Open sidebar",
    queues: [
      { href: "#", icon: ExclamationTriangleIcon, name: "Human review" },
      { href: "#", icon: QueueListIcon, name: "Jobs" },
      { href: "#", icon: ChartPieIcon, name: "Reports" }
    ],
    queuesTitle: "Queues",
    pageTitles: {
      flow: "Sales Conversions",
      kpi: "Key Performance Indicators"
    },
    ranges: {
      all: "All",
      day: "Day",
      hour: "Hour",
      month: "Month",
      week: "Week",
      year: "Year"
    },
    rates: {
      freeRate: {
        formula: "Free email requests / HealthScore views",
        title: "Free conversion rate"
      },
      paidRate: {
        formula: "(Paid Precision + Paid Pro) / HealthScore views",
        title: "Paid conversion rate"
      },
      precisionRate: {
        formula: "Paid Precision purchases / HealthScore views",
        title: "Precision conversion rate"
      },
      proRate: {
        formula: "Paid Pro purchases / HealthScore views",
        title: "Pro conversion rate"
      }
    },
    ratesTitle: "Conversion rates",
    title: "KPI",
    trend: {
      down: "Down",
      flat: "Flat",
      up: "Up"
    }
  },
  th: {
    bucketPrefix: "ต่อ",
    closeSidebar: "ปิดแถบเมนู",
    dataUnavailable:
      "ไม่สามารถโหลดข้อมูลแดชบอร์ดได้ กรุณาตรวจสอบการเชื่อมต่อฐานข้อมูลและตาราง BPM",
    emptyFlow: "ยังไม่มีข้อมูล Flow ในช่วงเวลานี้",
    filters: {
      active: "ตัวกรองที่ใช้",
      affiliate: "Affiliate",
      apply: "ใช้ตัวกรอง",
      campaign: "Campaign",
      campaignId: "Campaign ID",
      clear: "ล้าง",
      device: "อุปกรณ์",
      emailHash: "Email hash",
      locale: "ภาษา",
      medium: "Medium",
      planId: "Plan ID",
      promoCode: "Promo code",
      ray: "Ray",
      selectedPlan: "แผน",
      source: "Source",
      title: "ตัวกรอง"
    },
    generated: "สร้างเมื่อ",
    flowNodes: {
      assessmentStarted: "เริ่มทำ",
      assessmentSubmitted: "ส่งแบบประเมิน",
      assessmentViewed: "แบบประเมิน",
      chatClicked: "แชต",
      dropoffAfterAssessment: "ออกหลังแบบประเมิน",
      dropoffAfterAssessmentStart: "ออกหลังเริ่มทำ",
      dropoffAfterFormulation: "ออกหลังแผนโภชนาการ",
      dropoffAfterFreeEmailRequest: "ออกหลังขออีเมลฟรี",
      dropoffAfterHealthScore: "ออกหลัง HealthScore",
      dropoffAfterLanding: "ออกหลังหน้าแรก",
      dropoffAfterPlanSelection: "ออกหลังเลือกแผน",
      dropoffAfterPrecisionPayment: "ออกหลัง Precision",
      dropoffAfterProPayment: "ออกหลัง Pro",
      dropoffAfterResults: "ออกหลังผลลัพธ์",
      dropoffAfterSubmission: "ออกหลังส่งแบบประเมิน",
      formulationReady: "แผนโภชนาการ",
      freeEmailRequested: "อีเมลฟรี",
      freeEmailSent: "ส่งอีเมลแล้ว",
      healthscoreViewed: "HealthScore",
      landingViewed: "หน้าแรก",
      marketplaceClicked: "มาร์เก็ตเพลส",
      planSelected: "เลือกแผน",
      precisionPaid: "Precision ชำระแล้ว",
      proPaid: "Pro ชำระแล้ว",
      resultsViewed: "ผลลัพธ์"
    },
    flowMetrics: {
      dropped: "ออก",
      happy: "ไปต่อ",
      next: "ถัดไป",
      reached: "มาถึง"
    },
    flowSummary: {
      conversionRate: "คอนเวอร์ชัน",
      converted: "แปลงเป็นลูกค้า/ลีด",
      entered: "เข้า Landing",
      reachedHealthScore: "HealthScore"
    },
    flowStatus: {
      lossy: "สูญเสียสูง",
      needsWork: "ควรปรับปรุง",
      okay: "ดี"
    },
    flowTitle: "Sales Conversions",
    kpis: {
      free: {
        title: "คอนเวอร์ชันฟรี"
      },
      precision: {
        title: "คอนเวอร์ชัน Precision"
      },
      pro: {
        title: "คอนเวอร์ชัน Pro"
      }
    },
    navigation: [
      { icon: HomeIcon, name: "KPI", view: "kpi" },
      { icon: FunnelIcon, name: "Conversions", view: "flow" },
      { href: "#", icon: MegaphoneIcon, name: "แคมเปญ" },
      { href: "#", icon: EnvelopeIcon, name: "ลีด" },
      { href: "#", icon: ShieldCheckIcon, name: "ความปลอดภัย" },
      { href: "#", icon: BeakerIcon, name: "อาหารเสริม" },
      { href: "#", icon: DocumentTextIcon, name: "คอนเทนต์" }
    ],
    nextBuckets: "คาดการณ์ 3 ช่วงถัดไป",
    openSidebar: "เปิดแถบเมนู",
    queues: [
      { href: "#", icon: ExclamationTriangleIcon, name: "รีวิวโดยคน" },
      { href: "#", icon: QueueListIcon, name: "งานในคิว" },
      { href: "#", icon: ChartPieIcon, name: "รายงาน" }
    ],
    queuesTitle: "คิวงาน",
    pageTitles: {
      flow: "Sales Conversions",
      kpi: "Key Performance Indicators"
    },
    ranges: {
      all: "ทั้งหมด",
      day: "วัน",
      hour: "ชั่วโมง",
      month: "เดือน",
      week: "สัปดาห์",
      year: "ปี"
    },
    rates: {
      freeRate: {
        formula: "คำขอแผนฟรี / การดู HealthScore",
        title: "อัตราคอนเวอร์ชันฟรี"
      },
      paidRate: {
        formula: "(Precision ที่ชำระแล้ว + Pro ที่ชำระแล้ว) / การดู HealthScore",
        title: "อัตราคอนเวอร์ชันชำระเงิน"
      },
      precisionRate: {
        formula: "Precision ที่ชำระแล้ว / การดู HealthScore",
        title: "อัตราคอนเวอร์ชัน Precision"
      },
      proRate: {
        formula: "Pro ที่ชำระแล้ว / การดู HealthScore",
        title: "อัตราคอนเวอร์ชัน Pro"
      }
    },
    ratesTitle: "อัตราคอนเวอร์ชัน",
    title: "KPI",
    trend: {
      down: "ลดลง",
      flat: "คงที่",
      up: "เพิ่มขึ้น"
    }
  }
} satisfies Record<Locale, AdminContent>;

const kpiColors = {
  free: "#0EA5E9",
  precision: "#1FA77A",
  pro: "#20343A"
} satisfies Record<AdminDashboardKpiId, string>;

const rateColors = {
  freeRate: "#0EA5E9",
  paidRate: "#20343A",
  precisionRate: "#1FA77A",
  proRate: "#8B5CF6"
} satisfies Record<AdminDashboardRateId, string>;

function classNames(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function adminHref(
  locale: Locale,
  accessToken: string,
  range: AdminDashboardRange,
  view: AdminDashboardView,
  filters?: AdminDashboardFilters
) {
  const params = new URLSearchParams({
    access_token: accessToken,
    range,
    view
  });

  if (filters) {
    adminDashboardFilterEntries(filters).forEach(([key, value]) => {
      params.set(key, value);
    });
  }

  return `/${locale}/admin/dashboard?${params.toString()}`;
}

function formatLocale(locale: Locale) {
  return locale === "th" ? "th-TH-u-nu-latn" : "en-GB";
}

function formatGeneratedAt(value: string, locale: Locale) {
  return new Intl.DateTimeFormat(formatLocale(locale), {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Bangkok"
  }).format(new Date(value));
}

function formatNumber(value: number, locale: Locale) {
  return new Intl.NumberFormat(formatLocale(locale)).format(value);
}

function formatPercent(value: number, locale: Locale) {
  return `${new Intl.NumberFormat(formatLocale(locale), {
    maximumFractionDigits: 1,
    minimumFractionDigits: Number.isInteger(value) ? 0 : 1
  }).format(value)}%`;
}

function SidebarContent({
  accessToken,
  filters,
  labels,
  locale,
  onNavigate,
  range,
  view
}: Readonly<{
  accessToken: string;
  filters: AdminDashboardFilters;
  labels: AdminContent;
  locale: Locale;
  onNavigate?: () => void;
  range: AdminDashboardRange;
  view: AdminDashboardView;
}>) {
  return (
    <div className="flex grow flex-col gap-y-6 overflow-y-auto border-r border-gray-200 bg-white px-6 pb-4">
      <div className="flex h-20 shrink-0 items-center">
        <a
          href={`/${locale}`}
          onClick={onNavigate}
          aria-label="MattaNutra home"
          className="inline-flex rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1FA77A] focus-visible:ring-offset-2"
        >
          <HealthspanLogo />
        </a>
      </div>

      <nav className="flex flex-1 flex-col">
        <ul role="list" className="flex flex-1 flex-col gap-y-8">
          <li>
            <ul role="list" className="-mx-2 space-y-1">
              {labels.navigation.map((item) => {
                const current = item.view === view;
                const href = item.view
                  ? adminHref(locale, accessToken, range, item.view, filters)
                  : item.href ?? "#";

                return (
                  <li key={item.name}>
                    <a
                      href={href}
                      onClick={onNavigate}
                      aria-current={current ? "page" : undefined}
                      className={classNames(
                        current
                          ? "bg-[#1FA77A]/10 text-[#126B4F]"
                          : "text-gray-700 hover:bg-gray-50 hover:text-[#126B4F]",
                        "group flex gap-x-3 rounded-md p-2 text-sm/6 font-semibold"
                      )}
                    >
                      <item.icon
                        aria-hidden={true}
                        className={classNames(
                          current
                            ? "text-[#1FA77A]"
                            : "text-gray-400 group-hover:text-[#1FA77A]",
                          "size-6 shrink-0"
                        )}
                      />
                      {item.name}
                    </a>
                  </li>
                );
              })}
            </ul>
          </li>

          <li>
            <div className="text-xs/6 font-semibold uppercase tracking-[0.16em] text-gray-400">
              {labels.queuesTitle}
            </div>
            <ul role="list" className="-mx-2 mt-2 space-y-1">
              {labels.queues.map((item) => (
                <li key={item.name}>
                  <a
                    href={item.href}
                    onClick={onNavigate}
                    className="group flex gap-x-3 rounded-md p-2 text-sm/6 font-semibold text-gray-700 hover:bg-gray-50 hover:text-[#126B4F]"
                  >
                    <item.icon
                      aria-hidden={true}
                      className="size-6 shrink-0 text-gray-400 group-hover:text-[#1FA77A]"
                    />
                    {item.name}
                  </a>
                </li>
              ))}
            </ul>
          </li>
        </ul>
      </nav>
    </div>
  );
}

function Sparkline({
  color,
  forecast,
  series
}: Readonly<{
  color: string;
  forecast: number[];
  series: number[];
}>) {
  const width = 260;
  const height = 72;
  const actual = series.length > 0 ? series : [0];
  const forecastLine = [actual.at(-1) ?? 0, ...forecast];
  const totalPoints = Math.max(2, actual.length + forecast.length);
  const maxValue = Math.max(1, ...actual, ...forecast);

  const points = (values: number[], startIndex: number) =>
    values
      .map((value, index) => {
        const x = ((startIndex + index) / (totalPoints - 1)) * width;
        const y = height - (value / maxValue) * (height - 8) - 4;

        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");

  return (
    <svg
      aria-hidden={true}
      className="h-20 w-full overflow-visible"
      preserveAspectRatio="none"
      viewBox={`0 0 ${width} ${height}`}
    >
      <line
        x1="0"
        x2={width}
        y1={height - 4}
        y2={height - 4}
        className="stroke-gray-200"
        strokeWidth="1"
      />
      <polyline
        fill="none"
        points={points(actual, 0)}
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="3"
      />
      <polyline
        fill="none"
        opacity="0.55"
        points={points(forecastLine, Math.max(0, actual.length - 1))}
        stroke={color}
        strokeDasharray="5 5"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="3"
      />
    </svg>
  );
}

function TrendPill({
  labels,
  trend
}: Readonly<{
  labels: AdminContent;
  trend: AdminDashboardKpi["trend"];
}>) {
  return (
    <span
      className={classNames(
        trend === "up" && "bg-[#1FA77A]/10 text-[#126B4F]",
        trend === "down" && "bg-red-50 text-red-700",
        trend === "flat" && "bg-gray-100 text-gray-600",
        "rounded-full px-2 py-1 text-xs font-medium"
      )}
    >
      {labels.trend[trend]}
    </span>
  );
}

function KpiCard({
  bucketLabel,
  kpi,
  labels,
  locale
}: Readonly<{
  bucketLabel: string;
  kpi: AdminDashboardKpi;
  labels: AdminContent;
  locale: Locale;
}>) {
  const text = labels.kpis[kpi.id];
  const color = kpiColors[kpi.id];

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">{text.title}</h2>
        </div>
        <TrendPill labels={labels} trend={kpi.trend} />
      </div>

      <div className="mt-5 flex items-end justify-between gap-4">
        <p className="text-4xl font-semibold tracking-tight text-[#20343A]">
          {formatNumber(kpi.value, locale)}
        </p>
        <p className="pb-1 text-xs font-medium uppercase tracking-[0.14em] text-gray-400">
          {labels.bucketPrefix} {bucketLabel}
        </p>
      </div>

      <div className="mt-5">
        <Sparkline color={color} forecast={kpi.forecast} series={kpi.series} />
      </div>

      <p className="mt-3 text-sm text-gray-600">
        <span className="font-medium text-gray-900">{labels.nextBuckets}:</span>{" "}
        {kpi.forecast.map((value) => formatNumber(value, locale)).join(" / ")}
      </p>
    </section>
  );
}

function RateCard({
  labels,
  locale,
  rate
}: Readonly<{
  labels: AdminContent;
  locale: Locale;
  rate: AdminDashboardRate;
}>) {
  const text = labels.rates[rate.id];
  const color = rateColors[rate.id];

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">{text.title}</h3>
          <p className="mt-2 rounded-lg bg-gray-50 px-3 py-2 font-mono text-xs text-gray-600 ring-1 ring-gray-200">
            {text.formula}
          </p>
        </div>
        <TrendPill labels={labels} trend={rate.trend} />
      </div>

      <div className="mt-5 flex items-end justify-between gap-4">
        <p className="text-4xl font-semibold tracking-tight text-[#20343A]">
          {formatPercent(rate.value, locale)}
        </p>
        <p className="pb-1 text-xs font-medium uppercase tracking-[0.14em] text-gray-400">
          {formatNumber(rate.numerator, locale)} /{" "}
          {formatNumber(rate.denominator, locale)}
        </p>
      </div>

      <div className="mt-5">
        <Sparkline
          color={color}
          forecast={rate.forecast}
          series={rate.series}
        />
      </div>

      <p className="mt-3 text-sm text-gray-600">
        <span className="font-medium text-gray-900">{labels.nextBuckets}:</span>{" "}
        {rate.forecast.map((value) => formatPercent(value, locale)).join(" / ")}
      </p>
    </section>
  );
}

function FlowSummaryCard({
  label,
  value
}: Readonly<{
  label: string;
  value: string;
}>) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
      <p className="text-sm font-semibold text-gray-500">{label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-[#20343A]">
        {value}
      </p>
    </div>
  );
}

function flowNodeCount(flowData: AdminFlowData, id: AdminFlowNodeId) {
  return flowData.nodes.find((node) => node.id === id)?.count ?? 0;
}

function flowEdgesFrom(
  flowData: AdminFlowData,
  id: AdminFlowNodeId,
  kind: "continue" | "dropoff"
) {
  return flowData.edges.filter((edge) => edge.from === id && edge.kind === kind);
}

function FlowLegend({ labels }: Readonly<{ labels: AdminContent }>) {
  return (
    <div className="mt-4 flex flex-wrap gap-3 text-xs font-semibold">
      <span className="rounded-full bg-[#ECFDF5] px-3 py-1.5 text-[#126B4F] ring-1 ring-[#A7F3D0]">
        {labels.flowStatus.okay}
      </span>
      <span className="rounded-full bg-amber-50 px-3 py-1.5 text-amber-800 ring-1 ring-amber-200">
        {labels.flowStatus.needsWork}
      </span>
      <span className="rounded-full bg-red-50 px-3 py-1.5 text-red-700 ring-1 ring-red-100">
        {labels.flowStatus.lossy}
      </span>
    </div>
  );
}

type MermaidFlowEdge = Readonly<{
  from: AdminFlowNodeId;
  to: AdminFlowNodeId;
}>;

const mermaidNodeIds: Partial<Record<AdminFlowNodeId, string>> = {
  assessmentStarted: "started",
  assessmentSubmitted: "submitted",
  assessmentViewed: "assessment",
  chatClicked: "chat",
  formulationReady: "formulation",
  freeEmailRequested: "free_email",
  freeEmailSent: "email_sent",
  healthscoreViewed: "healthscore",
  landingViewed: "landing",
  marketplaceClicked: "marketplace",
  planSelected: "plan",
  precisionPaid: "precision",
  proPaid: "pro",
  resultsViewed: "results"
};

const mermaidFlowNodes: AdminFlowNodeId[] = [
  "landingViewed",
  "assessmentViewed",
  "assessmentStarted",
  "assessmentSubmitted",
  "healthscoreViewed",
  "freeEmailRequested",
  "freeEmailSent",
  "planSelected",
  "precisionPaid",
  "proPaid",
  "formulationReady",
  "resultsViewed",
  "chatClicked",
  "marketplaceClicked"
];

const mermaidFlowEdges: MermaidFlowEdge[] = [
  { from: "landingViewed", to: "assessmentViewed" },
  { from: "assessmentViewed", to: "assessmentStarted" },
  { from: "assessmentStarted", to: "assessmentSubmitted" },
  { from: "assessmentSubmitted", to: "healthscoreViewed" },
  { from: "healthscoreViewed", to: "freeEmailRequested" },
  { from: "freeEmailRequested", to: "freeEmailSent" },
  { from: "healthscoreViewed", to: "planSelected" },
  { from: "planSelected", to: "precisionPaid" },
  { from: "planSelected", to: "proPaid" },
  { from: "precisionPaid", to: "formulationReady" },
  { from: "proPaid", to: "formulationReady" },
  { from: "formulationReady", to: "resultsViewed" },
  { from: "resultsViewed", to: "chatClicked" },
  { from: "resultsViewed", to: "marketplaceClicked" }
];

const mermaidTerminalNodes = new Set<AdminFlowNodeId>([
  "chatClicked",
  "freeEmailSent",
  "marketplaceClicked"
]);

function hashString(value: string) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash.toString(36);
}

function mermaidEscape(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function mermaidCount(value: number, locale: Locale) {
  return mermaidEscape(formatNumber(value, locale));
}

function mermaidNodeLabel({
  flowData,
  labels,
  locale,
  nodeId
}: Readonly<{
  flowData: AdminFlowData;
  labels: AdminContent;
  locale: Locale;
  nodeId: AdminFlowNodeId;
}>) {
  const reached = flowNodeCount(flowData, nodeId);
  const happy = flowEdgesFrom(flowData, nodeId, "continue").reduce(
    (total, edge) => total + edge.count,
    0
  );
  const dropped = flowEdgesFrom(flowData, nodeId, "dropoff").reduce(
    (total, edge) => total + edge.count,
    0
  );
  const ratio =
    reached > 0 && !mermaidTerminalNodes.has(nodeId)
      ? Math.min(100, (happy / reached) * 100)
      : null;

  const lines = [
    mermaidEscape(labels.flowNodes[nodeId]),
    `<b>▲ ${mermaidCount(reached, locale)} <span style='display:inline-block;width:0.75rem'></span> ▼ ${mermaidCount(dropped, locale)}</b>`
  ];

  if (ratio !== null) {
    lines.push(formatPercent(ratio, locale));
  }

  return lines.join("<br/>");
}

type MermaidNodeHealth = "lossy" | "needs_work" | "neutral" | "okay";

function mermaidNodeHealth(
  flowData: AdminFlowData,
  nodeId: AdminFlowNodeId
): MermaidNodeHealth {
  const reached = flowNodeCount(flowData, nodeId);
  const happy = flowEdgesFrom(flowData, nodeId, "continue").reduce(
    (total, edge) => total + edge.count,
    0
  );

  if (reached === 0 || mermaidTerminalNodes.has(nodeId)) {
    return "neutral";
  }

  const dropRate = Math.max(0, (reached - Math.min(happy, reached)) / reached);

  if (dropRate >= 0.4) {
    return "lossy";
  }

  if (dropRate >= 0.15) {
    return "needs_work";
  }

  return "okay";
}

function flowEdgeCount(
  flowData: AdminFlowData,
  from: AdminFlowNodeId,
  to: AdminFlowNodeId
) {
  return flowData.edges.find((edge) => edge.from === from && edge.to === to)
    ?.count ?? 0;
}

function buildMermaidFlowDefinition(
  flowData: AdminFlowData,
  labels: AdminContent,
  locale: Locale
) {
  const lines = [
    "flowchart TD",
    "  classDef okay fill:#FFFFFF,stroke:#1FA77A,color:#111827,stroke-width:2px;",
    "  classDef needs_work fill:#FFFFFF,stroke:#F59E0B,color:#111827,stroke-width:2px;",
    "  classDef lossy fill:#FFFFFF,stroke:#EF4444,color:#111827,stroke-width:2px;",
    "  classDef neutral fill:#FFFFFF,stroke:#CBD5E1,color:#111827,stroke-width:1px;"
  ];

  mermaidFlowNodes.forEach((nodeId) => {
    const id = mermaidNodeIds[nodeId];

    if (!id) {
      return;
    }

    const label = mermaidNodeLabel({ flowData, labels, locale, nodeId });
    const nodeDefinition = mermaidTerminalNodes.has(nodeId)
      ? `${id}(["${label}"])`
      : `${id}["${label}"]`;

    lines.push(`  ${nodeDefinition}`);
    lines.push(`  class ${id} ${mermaidNodeHealth(flowData, nodeId)};`);
  });

  mermaidFlowEdges.forEach((edge) => {
    const from = mermaidNodeIds[edge.from];
    const to = mermaidNodeIds[edge.to];

    if (!from || !to) {
      return;
    }

    const count = flowEdgeCount(flowData, edge.from, edge.to);

    lines.push(`  ${from} -->|"${mermaidCount(count, locale)}"| ${to}`);
  });

  return lines.join("\n");
}

function MermaidFlow({
  definition,
  labels
}: Readonly<{
  definition: string;
  labels: AdminContent;
}>) {
  const [svg, setSvg] = useState("");

  useEffect(() => {
    let cancelled = false;
    const diagramId = `admin-flow-${hashString(definition)}`;

    import("mermaid")
      .then(async (module) => {
        const mermaid = module.default;
        mermaid.initialize({
          flowchart: {
            curve: "basis",
            htmlLabels: true,
            nodeSpacing: 54,
            rankSpacing: 72
          },
          securityLevel: "loose",
          startOnLoad: false,
          theme: "base",
          themeVariables: {
            fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
            lineColor: "#1FA77A",
            mainBkg: "#FFFFFF",
            primaryBorderColor: "#CBD5E1",
            primaryColor: "#FFFFFF",
            primaryTextColor: "#111827"
          }
        });

        return mermaid.render(diagramId, definition);
      })
      .then((result) => {
        if (!cancelled) {
          setSvg(result.svg);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          console.error("Unable to render admin flow diagram", error);
          setSvg("");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [definition]);

  return (
    <div className="mt-6 overflow-x-auto">
      {svg ? (
        <div
          aria-label={labels.flowTitle}
          className="[&_svg]:mx-auto [&_svg]:h-auto [&_svg]:max-w-full"
          dangerouslySetInnerHTML={{ __html: svg }}
          role="img"
        />
      ) : (
        <div className="flex min-h-96 items-center justify-center text-sm font-medium text-gray-500">
          {labels.flowTitle}
        </div>
      )}
    </div>
  );
}

function FlowChart({
  flowData,
  labels,
  locale
}: Readonly<{
  flowData: AdminFlowData;
  labels: AdminContent;
  locale: Locale;
}>) {
  const hasEvents =
    flowData.nodes.some((node) => node.count > 0) ||
    flowData.edges.some((edge) => edge.count > 0);
  const mermaidDefinition = buildMermaidFlowDefinition(
    flowData,
    labels,
    locale
  );

  return (
    <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
      {hasEvents ? (
        <>
          <FlowLegend labels={labels} />
          <MermaidFlow definition={mermaidDefinition} labels={labels} />
        </>
      ) : (
        <div className="mt-6 flex min-h-64 items-center justify-center rounded-xl bg-gray-50 text-sm font-medium text-gray-500 ring-1 ring-gray-100">
          {labels.emptyFlow}
        </div>
      )}
    </section>
  );
}

function AdminFlowView({
  flowData,
  labels,
  locale
}: Readonly<{
  flowData: AdminFlowData;
  labels: AdminContent;
  locale: Locale;
}>) {
  return (
    <>
      <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-4">
        <FlowSummaryCard
          label={labels.flowSummary.entered}
          value={formatNumber(flowData.summary.entered, locale)}
        />
        <FlowSummaryCard
          label={labels.flowSummary.reachedHealthScore}
          value={formatNumber(flowData.summary.reachedHealthScore, locale)}
        />
        <FlowSummaryCard
          label={labels.flowSummary.converted}
          value={formatNumber(flowData.summary.converted, locale)}
        />
        <FlowSummaryCard
          label={labels.flowSummary.conversionRate}
          value={formatPercent(flowData.summary.conversionRate, locale)}
        />
      </div>
      <FlowChart flowData={flowData} labels={labels} locale={locale} />
    </>
  );
}

function TimeframeSelector({
  accessToken,
  data,
  filters,
  labels,
  locale,
  view
}: Readonly<{
  accessToken: string;
  data: AdminDashboardData;
  filters: AdminDashboardFilters;
  labels: AdminContent;
  locale: Locale;
  view: AdminDashboardView;
}>) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {rangeOrder.map((range) => (
        <a
          key={range}
          href={adminHref(locale, accessToken, range, view, filters)}
          aria-current={data.range === range ? "page" : undefined}
          className={classNames(
            data.range === range
              ? "bg-[#1FA77A] text-white"
              : "bg-white text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50",
            "rounded-full px-3 py-1.5 text-sm font-semibold transition"
          )}
        >
          {labels.ranges[range]}
        </a>
      ))}
    </div>
  );
}

function LocaleFilterSelector({
  accessToken,
  filters,
  locale,
  range,
  view
}: Readonly<{
  accessToken: string;
  filters: AdminDashboardFilters;
  locale: Locale;
  range: AdminDashboardRange;
  view: AdminDashboardView;
}>) {
  const localeOptions = [
    { label: "EN", value: "en" },
    { label: "TH", value: "th" }
  ];
  const activeLocales =
    filters.locale === "en"
      ? new Set(["en"])
      : filters.locale === "th"
        ? new Set(["th"])
        : filters.locale === "none"
          ? new Set<string>()
          : new Set(["en", "th"]);

  function toggledLocaleFilter(value: string) {
    const next = new Set(activeLocales);

    if (next.has(value)) {
      next.delete(value);
    } else {
      next.add(value);
    }

    if (next.size === 2) {
      return "";
    }

    if (next.size === 0) {
      return "none";
    }

    return next.has("en") ? "en" : "th";
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      {localeOptions.map((option) => {
        const active = activeLocales.has(option.value);

        return (
          <a
            key={option.label}
            href={adminHref(locale, accessToken, range, view, {
              ...filters,
              locale: toggledLocaleFilter(option.value)
            })}
            aria-current={active ? "page" : undefined}
            className={classNames(
              active
                ? "bg-[#1FA77A] text-white"
                : "bg-white text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50",
              "rounded-full px-3 py-1.5 text-sm font-semibold transition"
            )}
          >
            {option.label}
          </a>
        );
      })}
    </div>
  );
}

function FilterInput({
  label,
  name,
  value
}: Readonly<{
  label: string;
  name: keyof AdminDashboardFilters;
  value: string;
}>) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-500">
        {label}
      </span>
      <input
        type="text"
        name={name}
        defaultValue={value}
        className="mt-1 block w-full rounded-md bg-white px-3 py-2 text-sm text-gray-900 ring-1 ring-inset ring-gray-200 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-[#1FA77A]"
      />
    </label>
  );
}

function FilterSelect({
  label,
  name,
  options,
  value
}: Readonly<{
  label: string;
  name: keyof AdminDashboardFilters;
  options: Array<Readonly<{ label: string; value: string }>>;
  value: string;
}>) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-500">
        {label}
      </span>
      <select
        name={name}
        defaultValue={value}
        className="mt-1 block w-full rounded-md bg-white px-3 py-2 text-sm text-gray-900 ring-1 ring-inset ring-gray-200 focus:ring-2 focus:ring-inset focus:ring-[#1FA77A]"
      >
        {options.map((option) => (
          <option key={option.value || "all"} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function AdminFilterPanel({
  accessToken,
  filters,
  labels,
  locale,
  range,
  view
}: Readonly<{
  accessToken: string;
  filters: AdminDashboardFilters;
  labels: AdminContent;
  locale: Locale;
  range: AdminDashboardRange;
  view: AdminDashboardView;
}>) {
  const panelFilters = { ...filters, locale: "" };
  const activeFilters = adminDashboardFilterEntries(panelFilters);
  const hasPanelFilters = hasAdminDashboardFilters(panelFilters);
  const clearHref = adminHref(locale, accessToken, range, view, {
    ...emptyAdminDashboardFilters,
    locale: filters.locale
  });

  return (
    <details
      className="mt-6 rounded-2xl bg-white shadow-sm ring-1 ring-gray-200"
      open={hasPanelFilters}
    >
      <summary className="group flex cursor-pointer list-none items-center gap-3 p-5 marker:hidden">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
          <span className="text-sm font-semibold uppercase tracking-[0.16em] text-gray-500">
            {labels.filters.title}
          </span>
          {hasPanelFilters ? (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-semibold uppercase tracking-[0.14em] text-gray-400">
                {labels.filters.active}
              </span>
              {activeFilters.map(([key, value]) => (
                <span
                  key={key}
                  className="rounded-full bg-gray-50 px-2.5 py-1 font-medium text-gray-700 ring-1 ring-gray-200"
                >
                  {labels.filters[key]}: {value}
                </span>
              ))}
            </div>
          ) : null}
        </div>
        <ChevronDownIcon
          aria-hidden={true}
          className="ml-auto size-4 shrink-0 text-gray-400 transition-transform group-open:rotate-180"
        />
      </summary>

      <form
        action={`/${locale}/admin/dashboard`}
        method="get"
        className="border-t border-gray-100 p-5"
      >
        <input type="hidden" name="access_token" value={accessToken} />
        <input type="hidden" name="range" value={range} />
        <input type="hidden" name="view" value={view} />
        <input type="hidden" name="locale" value={filters.locale} />

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <FilterInput
            label={labels.filters.source}
            name="source"
            value={filters.source}
          />
          <FilterInput
            label={labels.filters.medium}
            name="medium"
            value={filters.medium}
          />
          <FilterInput
            label={labels.filters.campaign}
            name="campaign"
            value={filters.campaign}
          />
          <FilterInput
            label={labels.filters.campaignId}
            name="campaignId"
            value={filters.campaignId}
          />
          <FilterInput
            label={labels.filters.affiliate}
            name="affiliate"
            value={filters.affiliate}
          />
          <FilterInput
            label={labels.filters.promoCode}
            name="promoCode"
            value={filters.promoCode}
          />
          <FilterSelect
            label={labels.filters.selectedPlan}
            name="selectedPlan"
            value={filters.selectedPlan}
            options={[
              { label: "All", value: "" },
              { label: "Precision", value: "precision" },
              { label: "Pro", value: "pro" }
            ]}
          />
          <FilterSelect
            label={labels.filters.device}
            name="device"
            value={filters.device}
            options={[
              { label: "All", value: "" },
              { label: "Mobile", value: "mobile" },
              { label: "Tablet", value: "tablet" },
              { label: "Desktop", value: "desktop" }
            ]}
          />
          <FilterInput
            label={labels.filters.planId}
            name="planId"
            value={filters.planId}
          />
          <FilterInput label={labels.filters.ray} name="ray" value={filters.ray} />
          <FilterInput
            label={labels.filters.emailHash}
            name="emailHash"
            value={filters.emailHash}
          />
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="submit"
            className="rounded-md bg-[#1FA77A] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#188B66] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1FA77A]"
          >
            {labels.filters.apply}
          </button>
          <a
            href={clearHref}
            className="rounded-md bg-white px-4 py-2 text-sm font-semibold text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50"
          >
            {labels.filters.clear}
          </a>
        </div>
      </form>
    </details>
  );
}

export function AdminDashboard({
  accessToken,
  data,
  filters,
  flowData,
  locale,
  view
}: Readonly<{
  accessToken: string;
  data: AdminDashboardData;
  filters: AdminDashboardFilters;
  flowData: AdminFlowData;
  locale: Locale;
  view: AdminDashboardView;
}>) {
  const labels = content[locale];
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#20343A]">
      {sidebarOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label={labels.closeSidebar}
            className="absolute inset-0 bg-gray-900/70"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="relative flex h-full w-full max-w-xs">
            <SidebarContent
              accessToken={accessToken}
              filters={filters}
              labels={labels}
              locale={locale}
              onNavigate={() => setSidebarOpen(false)}
              range={data.range}
              view={view}
            />
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="absolute left-full top-5 ml-4 rounded-md p-2 text-white"
            >
              <span className="sr-only">{labels.closeSidebar}</span>
              <XMarkIcon aria-hidden={true} className="size-6" />
            </button>
          </aside>
        </div>
      ) : null}

      <aside className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-72 lg:flex-col">
        <SidebarContent
          accessToken={accessToken}
          filters={filters}
          labels={labels}
          locale={locale}
          range={data.range}
          view={view}
        />
      </aside>

      <div className="sticky top-0 z-40 flex items-center gap-x-6 border-b border-gray-200 bg-white px-4 py-4 shadow-sm sm:px-6 lg:hidden">
        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          className="-m-2.5 p-2.5 text-gray-700 hover:text-gray-900"
        >
          <span className="sr-only">{labels.openSidebar}</span>
          <Bars3Icon aria-hidden={true} className="size-6" />
        </button>
        <div className="flex-1 text-sm/6 font-semibold text-gray-900">
          {view === "flow" ? labels.flowTitle : labels.title}
        </div>
        <span className="inline-flex size-8 items-center justify-center rounded-full bg-[#1FA77A]/10 text-xs font-semibold text-[#126B4F] ring-1 ring-[#1FA77A]/20">
          MN
        </span>
      </div>

      <main className="py-8 lg:pl-72">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-5">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-gray-900">
                {labels.pageTitles[view]}
              </h1>
              {view === "kpi" ? (
                <p className="mt-1 text-xs text-gray-400">
                  {labels.generated}: {formatGeneratedAt(data.generatedAt, locale)}
                </p>
              ) : null}
            </div>
          </div>

          {!(view === "flow" ? flowData.databaseAvailable : data.databaseAvailable) ? (
            <div className="mt-6 rounded-md bg-amber-50 p-4 text-sm font-medium text-amber-800 ring-1 ring-amber-200">
              {labels.dataUnavailable}
            </div>
          ) : null}

          <div className="mt-6">
            <TimeframeSelector
              accessToken={accessToken}
              data={data}
              filters={filters}
              labels={labels}
              locale={locale}
              view={view}
            />
            <LocaleFilterSelector
              accessToken={accessToken}
              filters={filters}
              locale={locale}
              range={data.range}
              view={view}
            />
          </div>

          <AdminFilterPanel
            accessToken={accessToken}
            filters={filters}
            labels={labels}
            locale={locale}
            range={data.range}
            view={view}
          />

          {view === "flow" ? (
            <AdminFlowView flowData={flowData} labels={labels} locale={locale} />
          ) : (
            <>
              <div className="mt-8 grid grid-cols-1 gap-5 xl:grid-cols-3">
                {data.kpis.map((kpi) => (
                  <KpiCard
                    key={kpi.id}
                    bucketLabel={data.bucketLabel}
                    kpi={kpi}
                    labels={labels}
                    locale={locale}
                  />
                ))}
              </div>

              <section className="mt-8">
                <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-gray-500">
                  {labels.ratesTitle}
                </h2>
                <div className="mt-4 grid grid-cols-1 gap-5 xl:grid-cols-4">
                  {data.rates.map((rate) => (
                    <RateCard
                      key={rate.id}
                      labels={labels}
                      locale={locale}
                      rate={rate}
                    />
                  ))}
                </div>
              </section>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
