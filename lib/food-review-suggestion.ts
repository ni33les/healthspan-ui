import { recordXaiUsageCost } from "@/lib/finance-ledger";
import type { Locale } from "@/lib/i18n";

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

export type FoodReviewSuggestionInput = Readonly<{
  currentFrequency?: string | null;
  currentRationale?: string | null;
  currentServing?: string | null;
  flagReason?: string | null;
  foodName: string;
  locale: Locale;
  reviewKind?: string | null;
}>;

export type FoodReviewSuggestion = Readonly<{
  frequency: string;
  rationale: string;
  responseId?: string;
  reviewerNote: string;
  serving: string;
}>;

const XAI_CHAT_COMPLETIONS_URL = "https://api.x.ai/v1/chat/completions";
const DEFAULT_GROK_MODEL = "grok-4.3";
const DEFAULT_REASONING_EFFORT = "low";
const REQUEST_TIMEOUT_MS = 90_000;

function configured(value: string | undefined) {
  return value?.trim() ?? "";
}

function config() {
  const apiKey = configured(process.env.XAI_API_KEY);

  if (!apiKey) {
    throw new Error("XAI_API_KEY is not configured");
  }

  return {
    apiKey,
    model: configured(process.env.GROK_MODEL) || DEFAULT_GROK_MODEL,
    reasoningEffort:
      configured(process.env.FOOD_REVIEW_REASONING_EFFORT) ||
      configured(process.env.FOOD_GUIDANCE_REASONING_EFFORT) ||
      DEFAULT_REASONING_EFFORT
  };
}

function parseJsonObject(content: string | null | undefined) {
  if (!content) {
    throw new Error("Model returned empty content");
  }

  const trimmed = content
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();

  try {
    return JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");

    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1)) as Record<
        string,
        unknown
      >;
    }

    throw new Error("Model returned invalid JSON");
  }
}

function text(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim()
    ? value.trim().slice(0, 800)
    : fallback;
}

async function callGrok(input: FoodReviewSuggestionInput) {
  const grok = config();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(XAI_CHAT_COMPLETIONS_URL, {
      body: JSON.stringify({
        messages: [
          {
            content: [
              "You draft conservative food guidance details for MattaNutra human review.",
              "This is internal wellness review support, not medical advice.",
              "Return JSON only. No markdown, no prose outside JSON.",
              "Return exactly one root JSON object with only these keys: serving, frequency, rationale, reviewerNote.",
              "Do not approve, reject, override allergies, or override safety rules.",
              "Use short practical serving sizes, ordinary food language, and conservative frequency.",
              "Avoid extreme dieting, fasting, detox language, weight-loss pressure, and medical treatment claims.",
              "Write in the requested locale."
            ].join("\n"),
            role: "system"
          },
          {
            content: JSON.stringify(
              {
                foodReview: input,
                output: {
                  frequency: "short practical frequency",
                  rationale:
                    "one concise sentence explaining the general wellness reason",
                  reviewerNote:
                    "short admin-facing note about why this draft is conservative",
                  serving: "short practical serving, e.g. 1 tbsp or 1 small bowl"
                }
              },
              null,
              2
            ),
            role: "user"
          }
        ],
        model: grok.model,
        max_tokens: 350,
        reasoning_effort: grok.reasoningEffort,
        response_format: { type: "json_object" },
        stream: false,
        temperature: 0.1
      }),
      headers: {
        Authorization: `Bearer ${grok.apiKey}`,
        "Content-Type": "application/json"
      },
      method: "POST",
      signal: controller.signal
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `xAI food review suggestion failed with ${response.status}: ${body.slice(0, 500)}`
      );
    }

    const completion = (await response.json()) as XaiChatCompletion;
    await recordXaiUsageCost({
      metadata: {
        foodName: input.foodName,
        reviewKind: input.reviewKind
      },
      model: completion.model ?? grok.model,
      purpose: "food_review_suggestion",
      reasoningEffort: grok.reasoningEffort,
      responseId: completion.id,
      usage: completion.usage
    });

    return completion;
  } finally {
    clearTimeout(timeout);
  }
}

export async function suggestFoodReviewDetails(
  input: FoodReviewSuggestionInput
): Promise<FoodReviewSuggestion> {
  if (!input.foodName.trim()) {
    throw new Error("Food name is required");
  }

  const response = await callGrok(input);
  const parsed = parseJsonObject(response.choices?.[0]?.message?.content);

  return {
    frequency: text(parsed.frequency, input.currentFrequency ?? ""),
    rationale: text(parsed.rationale, input.currentRationale ?? ""),
    responseId: response.id,
    reviewerNote: text(
      parsed.reviewerNote,
      "Conservative AI-drafted food guidance details for human review."
    ),
    serving: text(parsed.serving, input.currentServing ?? "")
  };
}
