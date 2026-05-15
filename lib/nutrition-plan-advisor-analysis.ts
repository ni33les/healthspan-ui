import type { AssessmentPlan } from "@/lib/assessment-snapshot";
import type {
  FoodGuidanceBlueprint,
  FormulationBlueprint,
  NutritionReport,
  PlanGuidanceAdjustment,
  PlanChatMessage
} from "@/lib/formulation-types";
import type { Locale } from "@/lib/i18n";

type AdvisorInput = Readonly<{
  answers: unknown;
  chatMessages: PlanChatMessage[];
  foodGuidance?: FoodGuidanceBlueprint | null;
  formulation?: FormulationBlueprint | null;
  guidanceAdjustments?: PlanGuidanceAdjustment[];
  locale: Locale;
  plan: AssessmentPlan;
  planId: string;
  taskId?: string | null;
  userMessage?: string | null;
}>;

type XaiChatCompletion = {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
  id?: string;
  model?: string;
  usage?: unknown;
};

const XAI_CHAT_COMPLETIONS_URL = "https://api.x.ai/v1/chat/completions";
const DEFAULT_GROK_MODEL = "grok-4.3";
const DEFAULT_PROMPT_VERSION = "v1";
const REQUEST_TIMEOUT_MS = 360_000;

function configured(value: string | undefined) {
  return value?.trim() ?? "";
}

function getGrokConfig(defaultReasoningEffort: "low" | "medium") {
  const apiKey = configured(process.env.XAI_API_KEY);

  if (!apiKey) {
    throw new Error("XAI_API_KEY is not configured");
  }

  return {
    apiKey,
    model: configured(process.env.GROK_MODEL) || DEFAULT_GROK_MODEL,
    promptVersion:
      configured(process.env.NUTRITION_ADVISOR_PROMPT_VERSION) ||
      configured(process.env.FORMULATION_PROMPT_VERSION) ||
      DEFAULT_PROMPT_VERSION,
    reasoningEffort:
      configured(process.env.NUTRITION_ADVISOR_REASONING_EFFORT) ||
      defaultReasoningEffort
  };
}

function parseJsonObject(content: string | null | undefined) {
  if (!content) {
    throw new Error("Nutrition advisor response was empty");
  }

  const trimmed = content.trim();
  const parsed = JSON.parse(trimmed) as unknown;

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Nutrition advisor response was not a JSON object");
  }

  return parsed as Record<string, unknown>;
}

async function callGrok({
  apiKey,
  messages,
  model,
  reasoningEffort,
  temperature
}: Readonly<{
  apiKey: string;
  messages: Array<{ content: string; role: "assistant" | "system" | "user" }>;
  model: string;
  reasoningEffort: string;
  temperature: number;
}>) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(XAI_CHAT_COMPLETIONS_URL, {
      body: JSON.stringify({
        messages,
        model,
        reasoning_effort: reasoningEffort,
        response_format: { type: "json_object" },
        stream: false,
        temperature
      }),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      method: "POST",
      signal: controller.signal
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(
        `xAI request failed with ${response.status}${body ? `: ${body.slice(0, 500)}` : ""}`
      );
    }

    return (await response.json()) as XaiChatCompletion;
  } finally {
    clearTimeout(timeout);
  }
}

function contextPayload(input: AdvisorInput) {
  return {
    assessment: input.answers,
    chatMessages: input.chatMessages.map((message) => ({
      body: message.body,
      createdAt: message.createdAt,
      role: message.role
    })),
    foodGuidance: input.foodGuidance,
    formulation: input.formulation,
    guidanceAdjustments: input.guidanceAdjustments ?? [],
    locale: input.locale,
    plan: input.plan,
    planId: input.planId,
    userMessage: input.userMessage
  };
}

function chatSystemPrompt(promptVersion: string) {
  return [
    `MattaNutra nutrition plan chat advisor ${promptVersion}.`,
    "You help the client refine their food and supplement guidance.",
    "You are conversational, concise, and practical.",
    "You may acknowledge preferences, dislikes, removals, swaps, routines, budget, travel, and timing.",
    "Do not claim to diagnose, treat, cure, prescribe, or replace clinician advice.",
    "Do not override MattaNutra safety state. If an item is hidden or under review, describe it as under team review.",
    "When the client asks to remove, avoid, drop, skip, or exclude a food or supplement, return a structured adjustment so the platform can remove it from the visible plan.",
    "Return JSON only with exactly two keys: reply and adjustments."
  ].join("\n");
}

function reportSystemPrompt(promptVersion: string) {
  return [
    `MattaNutra final nutrition report engine ${promptVersion}.`,
    "You combine completed food guidance, supplement guidance, and the client's chat refinements into a polished final wellness plan.",
    "This is the delivered customer-facing recommendation pack. It is not medical advice, diagnosis, treatment, or a prescription.",
    "Do not include marketplace products, prices, URLs, markdown, or contact data.",
    "Do not turn hidden or under-review items into active recommendations. Mention review status conservatively if relevant.",
    "Return JSON only with exactly one key: report."
  ].join("\n");
}

export async function analyzeNutritionPlanChatWithGrok(input: AdvisorInput) {
  const config = getGrokConfig("low");
  const completion = await callGrok({
    apiKey: config.apiKey,
    messages: [
      { content: chatSystemPrompt(config.promptVersion), role: "system" },
      {
        content: JSON.stringify(
          {
            context: contextPayload(input),
            instructions: [
              "Return a JSON object with exactly two fields: reply and adjustments.",
              "Use the client's selected locale when possible.",
              "Keep the reply to 2 to 5 short sentences.",
              "Ask at most one useful follow-up question.",
              "adjustments must be an array. Use an empty array when no visible plan item should be changed.",
              "For every removal request, include { action: 'remove', itemType: 'food' | 'supplement', itemId, itemName, reason }.",
              "Use the exact item id and item name from the current foodGuidance or formulation when the requested item matches one.",
              "For broad avoidances not currently in the visible list, still include itemName and the best itemType if clear."
            ]
          },
          null,
          2
        ),
        role: "user"
      }
    ],
    model: config.model,
    reasoningEffort: config.reasoningEffort,
    temperature: 0.3
  });
  const parsed = parseJsonObject(completion.choices?.[0]?.message?.content);
  const reply = typeof parsed.reply === "string" ? parsed.reply.trim() : "";
  const adjustments = normalizeChatAdjustments(parsed.adjustments);

  if (!reply) {
    throw new Error("Nutrition advisor reply was missing");
  }

  return {
    attempts: 1,
    model: completion.model ?? config.model,
    promptVersion: config.promptVersion,
    reasoningEffort: config.reasoningEffort,
    adjustments,
    reply,
    responseId: completion.id,
    usage: completion.usage
  };
}

function normalizeChatAdjustments(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        return null;
      }

      const record = item as Record<string, unknown>;
      const action = typeof record.action === "string" ? record.action : "";
      const itemType =
        typeof record.itemType === "string" ? record.itemType : "";
      const itemName =
        typeof record.itemName === "string" ? record.itemName.trim() : "";

      if (
        action !== "remove" ||
        (itemType !== "food" && itemType !== "supplement") ||
        !itemName
      ) {
        return null;
      }

      return {
        action,
        itemId:
          typeof record.itemId === "string" && record.itemId.trim()
            ? record.itemId.trim()
            : null,
        itemName,
        itemType,
        reason:
          typeof record.reason === "string" && record.reason.trim()
            ? record.reason.trim()
            : null
      } satisfies PlanGuidanceAdjustment;
    })
    .filter(Boolean)
    .slice(0, 20) as PlanGuidanceAdjustment[];
}

function localizedText(value: unknown) {
  if (typeof value === "string") {
    return value;
  }

  if (value && typeof value === "object" && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    const en = typeof record.en === "string" ? record.en.trim() : "";
    const th = typeof record.th === "string" ? record.th.trim() : "";

    if (en || th) {
      return {
        en: en || th,
        th: th || en
      };
    }
  }

  return "";
}

function reportSections(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item, index) => {
      const record =
        item && typeof item === "object" && !Array.isArray(item)
          ? (item as Record<string, unknown>)
          : {};
      const title = localizedText(record.title);
      const body = localizedText(record.body);

      if (!title || !body) {
        return null;
      }

      return {
        body,
        id:
          typeof record.id === "string" && record.id.trim()
            ? record.id.trim()
            : `section-${index + 1}`,
        title
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
}

function normalizeReport(value: unknown): NutritionReport {
  const record =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const summary = localizedText(record.summary);
  const title = localizedText(record.title);
  const dailyFocus = reportSections(record.dailyFocus);
  const synergies = reportSections(record.synergies);
  const nextSteps = reportSections(record.nextSteps);
  const safetyNotes = Array.isArray(record.safetyNotes)
    ? record.safetyNotes.map(localizedText).filter(Boolean)
    : [];

  if (!summary || !title) {
    throw new Error("Nutrition report is missing title or summary");
  }

  if (dailyFocus.length < 1 || nextSteps.length < 1) {
    throw new Error("Nutrition report is missing required sections");
  }

  return {
    dailyFocus,
    nextSteps,
    safetyNotes,
    summary,
    synergies,
    title
  };
}

export async function analyzeNutritionReportWithGrok(input: AdvisorInput) {
  const config = getGrokConfig("medium");
  const completion = await callGrok({
    apiKey: config.apiKey,
    messages: [
      { content: reportSystemPrompt(config.promptVersion), role: "system" },
      {
        content: JSON.stringify(
          {
            context: contextPayload(input),
            contract: {
              report: {
                dailyFocus: [
                  {
                    body: { en: "short paragraph", th: "short paragraph" },
                    id: "stable-kebab-case",
                    title: { en: "short title", th: "short title" }
                  }
                ],
                nextSteps: [
                  {
                    body: { en: "short paragraph", th: "short paragraph" },
                    id: "stable-kebab-case",
                    title: { en: "short title", th: "short title" }
                  }
                ],
                safetyNotes: [
                  {
                    en: "short conservative safety note",
                    th: "short conservative safety note"
                  }
                ],
                summary: {
                  en: "one concise summary paragraph",
                  th: "one concise summary paragraph"
                },
                synergies: [
                  {
                    body: { en: "short paragraph", th: "short paragraph" },
                    id: "stable-kebab-case",
                    title: { en: "short title", th: "short title" }
                  }
                ],
                title: {
                  en: "Final nutrition plan",
                  th: "Final nutrition plan"
                }
              }
            },
            instructions: [
              "Return a JSON object with exactly one top-level key: report.",
              "dailyFocus must contain 3 to 5 practical daily priorities.",
              "synergies must contain 2 to 4 food-plus-supplement combinations or routines.",
              "nextSteps must contain 2 to 4 customer actions.",
              "safetyNotes must contain 2 to 5 conservative notes.",
              "Every display field must include English and Thai."
            ]
          },
          null,
          2
        ),
        role: "user"
      }
    ],
    model: config.model,
    reasoningEffort: config.reasoningEffort,
    temperature: 0.2
  });
  const parsed = parseJsonObject(completion.choices?.[0]?.message?.content);
  const report = normalizeReport(parsed.report);

  return {
    attempts: 1,
    model: completion.model ?? config.model,
    promptVersion: config.promptVersion,
    reasoningEffort: config.reasoningEffort,
    report,
    responseId: completion.id,
    usage: completion.usage
  };
}
