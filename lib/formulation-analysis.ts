import type { AssessmentPlan } from "@/lib/assessment-jobs";
import type { Locale } from "@/lib/i18n";
import type {
  FormulationBlueprint,
  FormulationIngredient,
  FormulationStatus
} from "@/lib/mock-formulation";

type AnalysisAuditEvent = {
  eventType: string;
  level?: "critical" | "high" | "low" | "medium";
  payload?: Record<string, unknown>;
};

type AnalysisInput = Readonly<{
  answers: unknown;
  audit?: (event: AnalysisAuditEvent) => Promise<void>;
  locale: Locale;
  plan: AssessmentPlan;
  planId: string;
}>;

type AnalysisResult = Readonly<{
  attempts: number;
  formulation: FormulationBlueprint;
  model: string;
  promptVersion: string;
  responseId?: string;
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
const DEFAULT_GROK_MODEL = "grok-4-1-fast-reasoning";
const DEFAULT_PROMPT_VERSION = "v1";
const MAX_ATTEMPTS = 3;
const REQUEST_TIMEOUT_MS = 360_000;
const VALID_STATUSES = new Set<FormulationStatus>([
  "add",
  "covered",
  "review"
]);

function getConfiguredValue(value: string | undefined) {
  return value?.trim() ?? "";
}

function getGrokConfig() {
  const apiKey = getConfiguredValue(process.env.XAI_API_KEY);

  if (!apiKey) {
    throw new Error("XAI_API_KEY is not configured");
  }

  return {
    apiKey,
    model: getConfiguredValue(process.env.GROK_MODEL) || DEFAULT_GROK_MODEL,
    promptVersion:
      getConfiguredValue(process.env.FORMULATION_PROMPT_VERSION) ||
      DEFAULT_PROMPT_VERSION
  };
}

function systemPrompt(promptVersion: string) {
  return [
    `MATTANUTRA formulation analysis engine ${promptVersion}.`,
    "You are generating a wellness-oriented nutritional formulation brief.",
    "This is not medical advice, a prescription, a diagnosis, or a treatment plan.",
    "Use the completed assessment to produce a concise supplement breakdown.",
    "Do not include product recommendations, marketplace links, personal contact data, markdown, explanations outside JSON, or medical claims.",
    "Return JSON only."
  ].join("\n");
}

function userPrompt({
  answers,
  locale,
  plan,
  planId
}: Pick<AnalysisInput, "answers" | "locale" | "plan" | "planId">) {
  return JSON.stringify(
    {
      assessment: answers,
      contract: {
        supplementBreakdown: [
          {
            category:
              "Foundation | Foundation add-on | Add separately | Targeted | Review",
            dailyDose: "short daily dose string",
            id: "stable kebab-case identifier",
            rationale:
              "one sentence explaining the wellness benefit in plain language",
            status: "covered | add | review",
            supplement: "supplement name"
          }
        ]
      },
      instructions: [
        "Return a JSON object with exactly one top-level key: supplementBreakdown.",
        "supplementBreakdown must contain 6 to 18 items.",
        "Every item must include id, category, supplement, dailyDose, status, and rationale.",
        "Use status=review for anything that should be checked before use because of medication, pregnancy, breastfeeding, condition, or uncertainty.",
        "Keep rationales benefit-focused, for example: Supports skin, joint, and active lifestyle goals.",
        "Use the requested locale for user-visible strings."
      ],
      locale,
      plan,
      planId
    },
    null,
    2
  );
}

function retryPrompt(errors: string[]) {
  return [
    "The previous JSON response failed validation.",
    "Return corrected JSON only, matching the required contract.",
    "Validation errors:",
    ...errors.map((error) => `- ${error}`)
  ].join("\n");
}

async function audit(input: AnalysisInput, event: AnalysisAuditEvent) {
  await input.audit?.(event);
}

async function callGrok({
  apiKey,
  messages,
  model
}: Readonly<{
  apiKey: string;
  messages: Array<{ content: string; role: "assistant" | "system" | "user" }>;
  model: string;
}>) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(XAI_CHAT_COMPLETIONS_URL, {
      body: JSON.stringify({
        messages,
        model,
        response_format: { type: "json_object" },
        stream: false,
        temperature: 0.2
      }),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      method: "POST",
      signal: controller.signal
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `xAI request failed with ${response.status}: ${body.slice(0, 500)}`
      );
    }

    return (await response.json()) as XaiChatCompletion;
  } finally {
    clearTimeout(timeout);
  }
}

function parseJsonObject(content: string | null | undefined) {
  if (!content) {
    throw new Error("Model returned empty content");
  }

  try {
    return JSON.parse(content) as unknown;
  } catch {
    const start = content.indexOf("{");
    const end = content.lastIndexOf("}");

    if (start >= 0 && end > start) {
      return JSON.parse(content.slice(start, end + 1)) as unknown;
    }

    throw new Error("Model returned content that was not valid JSON");
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readText(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" ? value.trim() : "";
}

function validateFormulation(value: unknown) {
  const errors: string[] = [];
  const supplementBreakdown: FormulationIngredient[] = [];

  if (!isRecord(value)) {
    return { errors: ["Top-level response must be a JSON object"] };
  }

  const unexpectedTopLevelKeys = Object.keys(value).filter(
    (key) => key !== "supplementBreakdown"
  );

  if (unexpectedTopLevelKeys.length > 0) {
    errors.push(
      `Top-level response must only include supplementBreakdown, found: ${unexpectedTopLevelKeys.join(", ")}`
    );
  }

  const rawItems = value.supplementBreakdown;

  if (!Array.isArray(rawItems)) {
    return { errors: ["supplementBreakdown must be an array"] };
  }

  if (rawItems.length < 1) {
    errors.push("supplementBreakdown must contain at least one item");
  }

  if (rawItems.length > 30) {
    errors.push("supplementBreakdown must contain no more than 30 items");
  }

  const seenIds = new Set<string>();

  rawItems.forEach((item, index) => {
    if (!isRecord(item)) {
      errors.push(`supplementBreakdown[${index}] must be an object`);
      return;
    }

    const id = readText(item, "id");
    const category = readText(item, "category");
    const supplement = readText(item, "supplement");
    const dailyDose = readText(item, "dailyDose");
    const status = readText(item, "status");
    const rationale = readText(item, "rationale");

    if (!/^[a-z0-9][a-z0-9-]{1,63}$/.test(id)) {
      errors.push(
        `supplementBreakdown[${index}].id must be stable kebab-case`
      );
    } else if (seenIds.has(id)) {
      errors.push(`supplementBreakdown[${index}].id is duplicated`);
    } else {
      seenIds.add(id);
    }

    if (!category) {
      errors.push(`supplementBreakdown[${index}].category is required`);
    }

    if (!supplement) {
      errors.push(`supplementBreakdown[${index}].supplement is required`);
    }

    if (!dailyDose) {
      errors.push(`supplementBreakdown[${index}].dailyDose is required`);
    }

    if (!VALID_STATUSES.has(status as FormulationStatus)) {
      errors.push(
        `supplementBreakdown[${index}].status must be covered, add, or review`
      );
    }

    if (!rationale) {
      errors.push(`supplementBreakdown[${index}].rationale is required`);
    }

    supplementBreakdown.push({
      category,
      dailyDose,
      id,
      rationale,
      status: status as FormulationStatus,
      supplement
    });
  });

  if (errors.length > 0) {
    return { errors };
  }

  return {
    errors,
    formulation: { supplementBreakdown } satisfies FormulationBlueprint
  };
}

export async function analyzeFormulationWithGrok(
  input: AnalysisInput
): Promise<AnalysisResult> {
  const config = getGrokConfig();
  const messages: Array<{
    content: string;
    role: "assistant" | "system" | "user";
  }> = [
    { content: systemPrompt(config.promptVersion), role: "system" },
    {
      content: userPrompt(input),
      role: "user"
    }
  ];
  let lastErrors: string[] = [];

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    await audit(input, {
      eventType: "grok_attempt_started",
      level: "low",
      payload: {
        attempt,
        model: config.model,
        promptVersion: config.promptVersion
      }
    });

    try {
      const completion = await callGrok({
        apiKey: config.apiKey,
        messages,
        model: config.model
      });
      const content = completion.choices?.[0]?.message?.content;
      const parsed = parseJsonObject(content);
      const validation = validateFormulation(parsed);

      if (validation.formulation) {
        await audit(input, {
          eventType: "grok_validation_passed",
          level: "low",
          payload: {
            attempt,
            itemCount: validation.formulation.supplementBreakdown.length,
            model: completion.model ?? config.model,
            promptVersion: config.promptVersion,
            responseId: completion.id,
            usage: completion.usage
          }
        });

        return {
          attempts: attempt,
          formulation: validation.formulation,
          model: completion.model ?? config.model,
          promptVersion: config.promptVersion,
          responseId: completion.id
        };
      }

      lastErrors = validation.errors;
      await audit(input, {
        eventType: "grok_validation_failed",
        level: "medium",
        payload: {
          attempt,
          errors: lastErrors,
          responseId: completion.id
        }
      });

      messages.push({
        content: content ?? "",
        role: "assistant"
      });
      messages.push({
        content: retryPrompt(lastErrors),
        role: "user"
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown xAI analysis error";
      lastErrors = [message];
      await audit(input, {
        eventType: "grok_attempt_failed",
        level: "high",
        payload: {
          attempt,
          error: message
        }
      });

      messages.push({
        content: retryPrompt(lastErrors),
        role: "user"
      });
    }
  }

  throw new Error(
    `Grok formulation analysis failed after ${MAX_ATTEMPTS} attempts: ${lastErrors.join("; ")}`
  );
}
