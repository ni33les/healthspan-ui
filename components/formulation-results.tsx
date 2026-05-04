"use client";

import { useEffect, useState } from "react";
import {
  ArrowPathIcon,
  ArrowTopRightOnSquareIcon,
  BeakerIcon,
  CheckIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  ShoppingBagIcon,
  SparklesIcon
} from "@heroicons/react/20/solid";
import type {
  FormulationIngredient,
  FormulationResult,
  FormulationStatus,
  RecommendedProduct
} from "@/lib/mock-formulation";
import type { Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type FormulationResultsProps = Readonly<{
  jobId: string;
  locale: Locale;
}>;

type LoadState = "loading" | "ready" | "error";

const copy = {
  en: {
    add: "Add separately",
    constraints: "Constraints",
    context: "Assessment summary",
    covered: "In base option",
    emptyJob: "Demo formulation",
    error:
      "The formulation could not be loaded. Please refresh the page and try again.",
    formula: "Supplement breakdown",
    formulaHint:
      "Hover a product to highlight the formulation entries it covers.",
    generated: "Generated",
    goals: "Goals",
    job: "Job",
    loading: "Loading your formulation",
    marketplace: "View product search",
    matches: "Matches",
    products: "Recommended product searches",
    productsHint:
      "Hover a formulation row or product card to see how the recommendation maps together.",
    profile: "Profile",
    region: "Region",
    review: "Review carefully",
    safety: "Safety notes",
    serving: "Serving guidance",
    statusLegend:
      "Status shows whether an item is covered by the base option, should be added separately, or needs careful review before purchase."
  },
  th: {
    add: "เพิ่มแยกต่างหาก",
    constraints: "ข้อจำกัด",
    context: "สรุปแบบประเมิน",
    covered: "อยู่ในตัวเลือกพื้นฐาน",
    emptyJob: "สูตรตัวอย่าง",
    error: "ไม่สามารถโหลดสูตรได้ กรุณารีเฟรชหน้าและลองอีกครั้ง",
    formula: "รายการอาหารเสริม",
    formulaHint:
      "วางเมาส์บนผลิตภัณฑ์เพื่อไฮไลต์รายการในสูตรที่เกี่ยวข้อง",
    generated: "สร้างเมื่อ",
    goals: "เป้าหมาย",
    job: "งาน",
    loading: "กำลังโหลดสูตรของคุณ",
    marketplace: "ดูการค้นหาผลิตภัณฑ์",
    matches: "ตรงกับ",
    products: "การค้นหาผลิตภัณฑ์ที่แนะนำ",
    productsHint:
      "วางเมาส์บนแถวสูตรหรือการ์ดผลิตภัณฑ์เพื่อดูความเชื่อมโยง",
    profile: "โปรไฟล์",
    region: "ภูมิภาค",
    review: "ตรวจสอบอย่างระมัดระวัง",
    safety: "หมายเหตุด้านความปลอดภัย",
    serving: "คำแนะนำการใช้",
    statusLegend:
      "สถานะแสดงว่ารายการนั้นอยู่ในตัวเลือกพื้นฐาน ควรเพิ่มแยกต่างหาก หรือต้องตรวจสอบก่อนซื้อ"
  }
} satisfies Record<
  Locale,
  Record<
    | "add"
    | "constraints"
    | "context"
    | "covered"
    | "emptyJob"
    | "error"
    | "formula"
    | "formulaHint"
    | "generated"
    | "goals"
    | "job"
    | "loading"
    | "marketplace"
    | "matches"
    | "products"
    | "productsHint"
    | "profile"
    | "region"
    | "review"
    | "safety"
    | "serving"
    | "statusLegend",
    string
  >
>;

const statusStyles = {
  add: {
    badge: "bg-[#3A7BD5]/10 text-[#245f9f] ring-[#3A7BD5]/20",
    dot: "bg-[#3A7BD5]",
    icon: ShoppingBagIcon
  },
  covered: {
    badge: "bg-[#1FA77A]/10 text-[#126b4f] ring-[#1FA77A]/20",
    dot: "bg-[#1FA77A]",
    icon: CheckIcon
  },
  review: {
    badge: "bg-amber-50 text-amber-800 ring-amber-200",
    dot: "bg-amber-500",
    icon: ExclamationTriangleIcon
  }
} satisfies Record<
  FormulationStatus,
  {
    badge: string;
    dot: string;
    icon: typeof CheckIcon;
  }
>;

function getStatusLabel(status: FormulationStatus, labels: (typeof copy)["en"]) {
  if (status === "covered") {
    return labels.covered;
  }

  if (status === "review") {
    return labels.review;
  }

  return labels.add;
}

export function FormulationResults({ jobId, locale }: FormulationResultsProps) {
  const labels = copy[locale];
  const effectiveJobId = jobId || "demo";
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [result, setResult] = useState<FormulationResult | null>(null);
  const [hoveredIngredientId, setHoveredIngredientId] = useState<string | null>(
    null
  );
  const [hoveredProductId, setHoveredProductId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let retryTimer: number | undefined;

    async function fetchFormulation() {
      try {
        const response = await fetch(
          `/api/assessment/${encodeURIComponent(effectiveJobId)}/formulation`,
          { cache: "no-store" }
        );

        if (response.status === 202) {
          retryTimer = window.setTimeout(fetchFormulation, 1000);
          return;
        }

        if (!response.ok) {
          throw new Error("Unable to load formulation");
        }

        const payload = (await response.json()) as FormulationResult;

        if (!cancelled) {
          setResult(payload);
          setLoadState("ready");
        }
      } catch {
        if (!cancelled) {
          setLoadState("error");
        }
      }
    }

    fetchFormulation();

    return () => {
      cancelled = true;

      if (retryTimer) {
        window.clearTimeout(retryTimer);
      }
    };
  }, [effectiveJobId]);

  if (loadState === "loading") {
    return (
      <section className="mx-auto w-full max-w-4xl px-6 py-12 sm:px-8">
        <div className="rounded-lg bg-white px-6 py-12 text-center ring-1 ring-foreground/10">
          <ArrowPathIcon
            aria-hidden={true}
            className="mx-auto size-8 animate-spin text-[#3A7BD5]"
          />
          <h1 className="mt-6 text-3xl font-semibold tracking-normal text-[#20343A]">
            {labels.loading}
          </h1>
        </div>
      </section>
    );
  }

  if (loadState === "error" || !result) {
    return (
      <section className="mx-auto w-full max-w-4xl px-6 py-12 sm:px-8">
        <div className="rounded-lg bg-white px-6 py-12 text-center ring-1 ring-foreground/10">
          <ExclamationTriangleIcon
            aria-hidden={true}
            className="mx-auto size-10 text-amber-500"
          />
          <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-muted-foreground">
            {labels.error}
          </p>
        </div>
      </section>
    );
  }

  const ingredientById = new Map(
    result.formula.map((ingredient) => [ingredient.id, ingredient])
  );
  const hoveredProduct = result.products.find(
    (product) => product.id === hoveredProductId
  );
  const highlightedIngredientIds = new Set(hoveredProduct?.covers ?? []);
  const highlightedProductIds = new Set(
    hoveredIngredientId
      ? result.products
          .filter((product) => product.covers.includes(hoveredIngredientId))
          .map((product) => product.id)
      : []
  );
  const formattedDate = new Intl.DateTimeFormat(
    locale === "th" ? "th-TH" : "en-GB",
    {
      dateStyle: "medium",
      timeStyle: "short"
    }
  ).format(new Date(result.generatedAt));

  return (
    <section className="mx-auto w-full max-w-6xl px-6 py-10 sm:px-8 lg:py-14">
      <div className="rounded-lg bg-white p-6 ring-1 ring-foreground/10 sm:p-8 lg:p-10">
        <div className="grid gap-8 lg:grid-cols-[1fr_20rem] lg:items-start">
          <div>
            <div className="inline-flex items-center gap-2 rounded-md bg-[#3A7BD5]/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#245f9f]">
              <SparklesIcon aria-hidden={true} className="size-4" />
              {labels.job}: {result.jobId || labels.emptyJob}
            </div>
            <h1 className="mt-6 max-w-3xl text-4xl font-semibold tracking-normal text-[#20343A] text-balance sm:text-5xl">
              {result.title}
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
              {result.subtitle}
            </p>
          </div>

          <div className="rounded-lg bg-background p-5 ring-1 ring-foreground/10">
            <p className="text-sm font-semibold uppercase tracking-[0.12em] text-[#20343A]">
              {labels.context}
            </p>
            <dl className="mt-4 space-y-4 text-sm">
              <ContextItem
                label={labels.profile}
                value={`${result.customerContext.ageRange} / ${result.customerContext.sex}`}
              />
              <ContextItem
                label={labels.region}
                value={result.customerContext.region}
              />
              <ContextChips
                label={labels.goals}
                values={result.customerContext.goals}
              />
              <ContextChips
                label={labels.constraints}
                values={result.customerContext.constraints}
              />
            </dl>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-foreground/10 pt-5 text-xs font-medium text-muted-foreground">
          <span>
            {labels.generated}: {formattedDate}
          </span>
          <span aria-hidden={true} className="h-1 w-1 rounded-full bg-foreground/20" />
          <span>{labels.statusLegend}</span>
        </div>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(22rem,0.85fr)]">
        <FormulaPanel
          highlightedIngredientIds={highlightedIngredientIds}
          ingredients={result.formula}
          labels={labels}
          onHoverIngredient={(ingredientId) => {
            setHoveredProductId(null);
            setHoveredIngredientId(ingredientId);
          }}
          onLeaveIngredient={() => setHoveredIngredientId(null)}
        />

        <ProductsPanel
          highlightedProductIds={highlightedProductIds}
          ingredientById={ingredientById}
          labels={labels}
          onHoverProduct={(productId) => {
            setHoveredIngredientId(null);
            setHoveredProductId(productId);
          }}
          onLeaveProduct={() => setHoveredProductId(null)}
          products={result.products}
        />
      </div>

      <div className="mt-8 rounded-lg bg-[#20343A] p-6 text-sm leading-6 text-white/75">
        <div className="flex gap-3">
          <InformationCircleIcon
            aria-hidden={true}
            className="mt-0.5 size-5 flex-none text-white"
          />
          <div>
            <p className="font-semibold uppercase tracking-[0.12em] text-white">
              {labels.safety}
            </p>
            <ul className="mt-3 space-y-2">
              {result.safetyNotes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

type PanelLabels = (typeof copy)["en"];

function ContextItem({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 font-medium text-[#20343A]">{value}</dd>
    </div>
  );
}

function ContextChips({
  label,
  values
}: Readonly<{ label: string; values: string[] }>) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-2 flex flex-wrap gap-2">
        {values.map((value) => (
          <span
            key={value}
            className="rounded-md bg-white px-2.5 py-1.5 text-xs font-medium text-[#20343A] ring-1 ring-foreground/10"
          >
            {value}
          </span>
        ))}
      </dd>
    </div>
  );
}

function FormulaPanel({
  highlightedIngredientIds,
  ingredients,
  labels,
  onHoverIngredient,
  onLeaveIngredient
}: Readonly<{
  highlightedIngredientIds: Set<string>;
  ingredients: FormulationIngredient[];
  labels: PanelLabels;
  onHoverIngredient: (ingredientId: string) => void;
  onLeaveIngredient: () => void;
}>) {
  return (
    <section className="rounded-lg bg-white p-5 ring-1 ring-foreground/10 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-normal text-[#20343A]">
            {labels.formula}
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {labels.formulaHint}
          </p>
        </div>
        <BeakerIcon
          aria-hidden={true}
          className="size-6 flex-none text-[#3A7BD5]"
        />
      </div>

      <div className="mt-6 space-y-3">
        {ingredients.map((ingredient) => {
          const highlighted = highlightedIngredientIds.has(ingredient.id);
          const StatusIcon = statusStyles[ingredient.status].icon;

          return (
            <article
              key={ingredient.id}
              tabIndex={0}
              className={cn(
                "rounded-lg border border-foreground/10 bg-white p-4 transition",
                highlighted && "border-[#3A7BD5]/40 bg-[#3A7BD5]/5 shadow-sm"
              )}
              onBlur={onLeaveIngredient}
              onFocus={() => onHoverIngredient(ingredient.id)}
              onMouseEnter={() => onHoverIngredient(ingredient.id)}
              onMouseLeave={onLeaveIngredient}
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "flex size-7 flex-none items-center justify-center rounded-md text-white",
                        statusStyles[ingredient.status].dot
                      )}
                    >
                      <StatusIcon aria-hidden={true} className="size-4" />
                    </span>
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      {ingredient.category}
                    </p>
                  </div>
                  <h3 className="mt-3 text-base font-semibold text-[#20343A]">
                    {ingredient.supplement}
                  </h3>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    {ingredient.rationale}
                  </p>
                </div>

                <div className="shrink-0 sm:w-44">
                  <span
                    className={cn(
                      "inline-flex rounded-md px-2.5 py-1.5 text-xs font-semibold ring-1 ring-inset",
                      statusStyles[ingredient.status].badge
                    )}
                  >
                    {getStatusLabel(ingredient.status, labels)}
                  </span>
                  <p className="mt-3 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    {labels.serving}
                  </p>
                  <p className="mt-1 text-sm font-medium text-[#20343A]">
                    {ingredient.servingGuidance}
                  </p>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function ProductsPanel({
  highlightedProductIds,
  ingredientById,
  labels,
  onHoverProduct,
  onLeaveProduct,
  products
}: Readonly<{
  highlightedProductIds: Set<string>;
  ingredientById: Map<string, FormulationIngredient>;
  labels: PanelLabels;
  onHoverProduct: (productId: string) => void;
  onLeaveProduct: () => void;
  products: RecommendedProduct[];
}>) {
  return (
    <section className="rounded-lg bg-white p-5 ring-1 ring-foreground/10 sm:p-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-normal text-[#20343A]">
          {labels.products}
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {labels.productsHint}
        </p>
      </div>

      <div className="mt-6 space-y-4">
        {products.map((product) => {
          const highlighted = highlightedProductIds.has(product.id);

          return (
            <article
              key={product.id}
              tabIndex={0}
              className={cn(
                "rounded-lg border border-foreground/10 bg-white p-4 transition",
                highlighted && "border-[#3A7BD5]/40 bg-[#3A7BD5]/5 shadow-sm"
              )}
              onBlur={onLeaveProduct}
              onFocus={() => onHoverProduct(product.id)}
              onMouseEnter={() => onHoverProduct(product.id)}
              onMouseLeave={onLeaveProduct}
            >
              <div className="flex gap-4">
                <div className="flex size-10 flex-none items-center justify-center rounded-md bg-[#20343A] text-sm font-semibold text-white">
                  {product.priority}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md bg-[#1FA77A]/10 px-2 py-1 text-xs font-semibold text-[#126b4f] ring-1 ring-[#1FA77A]/20">
                      {product.tag}
                    </span>
                    <span className="text-xs font-medium text-muted-foreground">
                      {product.marketplace}
                    </span>
                  </div>
                  <h3 className="mt-3 text-base font-semibold text-[#20343A]">
                    {product.name}
                  </h3>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    {product.description}
                  </p>
                </div>
              </div>

              <div className="mt-4 rounded-md bg-background p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  {labels.matches}
                </p>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {product.covers.map((ingredientId) => {
                    const ingredient = ingredientById.get(ingredientId);

                    return (
                      <li
                        key={ingredientId}
                        className="rounded-md bg-white px-2.5 py-1.5 text-xs font-medium text-[#20343A] ring-1 ring-foreground/10"
                      >
                        {ingredient?.supplement ?? ingredientId}
                      </li>
                    );
                  })}
                </ul>
              </div>

              <a
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md bg-[#1FA77A] px-4 py-3 text-sm font-semibold uppercase tracking-[0.08em] text-white transition hover:bg-[#188a65]"
                href={product.url}
                rel="noreferrer"
                target="_blank"
              >
                {labels.marketplace}
                <ArrowTopRightOnSquareIcon
                  aria-hidden={true}
                  className="size-4"
                />
              </a>
            </article>
          );
        })}
      </div>
    </section>
  );
}
