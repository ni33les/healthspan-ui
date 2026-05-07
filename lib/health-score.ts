import type { Locale } from "@/lib/i18n";

export type HealthScoreDomain = Readonly<{
  description: string;
  id: "activity" | "biomarkers" | "habits" | "nutrition" | "sleep" | "stress";
  label: string;
  score: number;
}>;

export type HealthScoreMover = Readonly<{
  impact: string;
  label: string;
}>;

export type HealthScoreResult = Readonly<{
  band: string;
  domains: HealthScoreDomain[];
  headline: string;
  movers: HealthScoreMover[];
  score: number;
  summary: string;
}>;

type DomainId = HealthScoreDomain["id"];

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

function numberValue(value: unknown) {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : null;
}

function arrayValue(value: unknown) {
  return Array.isArray(value) ? value.map(String) : [];
}

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, Math.round(value)));
}

function optionScore(value: unknown, scores: Record<string, number>, fallback: number) {
  return scores[text(value)] ?? fallback;
}

function bmiScore(answers: Record<string, unknown>) {
  const heightCm = numberValue(answers.heightCm);
  const weightKg = numberValue(answers.weightKg);

  if (!heightCm || !weightKg || heightCm <= 0 || weightKg <= 0) {
    return 55;
  }

  const heightM = heightCm / 100;
  const bmi = weightKg / (heightM * heightM);

  if (bmi >= 18.5 && bmi < 23) return 100;
  if (bmi >= 23 && bmi < 25) return 86;
  if (bmi >= 25 && bmi < 28) return 68;
  if (bmi >= 28 && bmi < 30) return 50;
  if (bmi < 18.5) return 48;
  return 34;
}

function labScore(answers: Record<string, unknown>) {
  const labs = asRecord(answers.labs);
  const scores: number[] = [];
  const vitaminD = numberValue(labs.vitaminD);
  const b12 = numberValue(labs.b12);
  const hba1c = numberValue(labs.hba1c);
  const omega3 = numberValue(labs.omega3);
  const homocysteine = numberValue(labs.homocysteine);

  if (vitaminD) scores.push(vitaminD >= 50 && vitaminD <= 80 ? 100 : vitaminD >= 30 ? 70 : 35);
  if (b12) scores.push(b12 >= 500 && b12 <= 1000 ? 100 : b12 >= 350 ? 68 : 38);
  if (hba1c) scores.push(hba1c < 5.4 ? 100 : hba1c < 5.7 ? 74 : hba1c < 6.5 ? 48 : 30);
  if (omega3) scores.push(omega3 >= 8 ? 100 : omega3 >= 5 ? 68 : 40);
  if (homocysteine) scores.push(homocysteine < 8 ? 100 : homocysteine < 12 ? 70 : 42);

  if (scores.length === 0) {
    return null;
  }

  return scores.reduce((sum, score) => sum + score, 0) / scores.length;
}

function domainLabels(locale: Locale) {
  if (locale === "th") {
    return {
      activity: ["กิจกรรมและฟิตเนส", "สะท้อนการเคลื่อนไหว ความฟิต และพื้นฐานการฟื้นตัว"],
      biomarkers: ["ตัวชี้วัดร่างกาย", "รวม BMI และค่าแล็บที่คุณใส่ไว้"],
      habits: ["พฤติกรรมสุขภาพ", "สะท้อนบุหรี่ แสงแดด อาการ และภาระต่อร่างกาย"],
      nutrition: ["โภชนาการ", "สะท้อนรูปแบบอาหาร ปลา แอลกอฮอล์ และโปรตีน"],
      sleep: ["การนอนและการฟื้นตัว", "สะท้อนชั่วโมงนอนและความสดชื่นหลังตื่น"],
      stress: ["ความเครียดและสมดุล", "สะท้อนระดับความเครียด ระบบย่อย และ HRV ถ้ามี"]
    } satisfies Record<DomainId, [string, string]>;
  }

  return {
    activity: ["Activity & fitness", "Reflects movement, cardio base, and recovery capacity."],
    biomarkers: ["Body markers", "Uses BMI plus any lab values you added."],
    habits: ["Health habits", "Reflects smoking, sun exposure, symptoms, and body load."],
    nutrition: ["Nutrition", "Reflects diet pattern, fish intake, alcohol, and protein."],
    sleep: ["Sleep & recovery", "Reflects sleep duration and how refreshed you wake."],
    stress: ["Stress & balance", "Reflects stress load, digestion, and HRV when available."]
  } satisfies Record<DomainId, [string, string]>;
}

function bandForScore(score: number, locale: Locale) {
  if (locale === "th") {
    if (score >= 80) return "ดีเยี่ยม";
    if (score >= 65) return "ดี";
    if (score >= 50) return "พอใช้";
    return "ควรใส่ใจ";
  }

  if (score >= 80) return "Excellent";
  if (score >= 65) return "Good";
  if (score >= 50) return "Fair";
  return "Needs attention";
}

function headlineForScore(score: number, locale: Locale) {
  if (locale === "th") {
    if (score >= 80) return "พื้นฐานสุขภาพของคุณแข็งแรง";
    if (score >= 65) return "คุณมีพื้นฐานที่ดีและยังปรับให้เฉพาะตัวได้อีก";
    if (score >= 50) return "มีหลายจุดที่สามารถยกระดับได้";
    return "มีโอกาสปรับปรุงที่ชัดเจน";
  }

  if (score >= 80) return "You have a strong health foundation.";
  if (score >= 65) return "You have a solid base with clear room to personalise.";
  if (score >= 50) return "Several areas can be improved with the right focus.";
  return "There is a clear opportunity to improve the fundamentals.";
}

function summaryForScore(lowest: HealthScoreDomain, locale: Locale) {
  if (locale === "th") {
    return `พื้นที่ที่ควรให้ความสำคัญที่สุดคือ ${lowest.label} คะแนนนี้ช่วยให้เราจัดลำดับสูตรและคำแนะนำตัวอย่างได้เหมาะกับคุณมากขึ้น`;
  }

  return `Your biggest opportunity is ${lowest.label.toLowerCase()}. This score helps us prioritise the formulation and preview recommendations around your actual gaps.`;
}

function buildMovers(domains: HealthScoreDomain[], locale: Locale): HealthScoreMover[] {
  return [...domains]
    .sort((a, b) => a.score - b.score)
    .slice(0, 3)
    .map((domain) => ({
      impact: locale === "th" ? "ผลกระทบสูง" : "High impact",
      label:
        locale === "th"
          ? `ปรับปรุง ${domain.label}`
          : `Improve ${domain.label.toLowerCase()}`
    }));
}

export function computeHealthScore(
  answersInput: unknown,
  locale: Locale = "en"
): HealthScoreResult {
  const answers = asRecord(answersInput);
  const sleepHours = optionScore(
    answers.sleepHours,
    { "4-5": 28, "5-6": 48, "6-7": 72, "7-8": 100, "8+": 86 },
    64
  );
  const sleepQuality = optionScore(answers.sleep, { "1": 20, "2": 40, "3": 62, "4": 84, "5": 100 }, 62);
  const activity = optionScore(
    answers.activity,
    { sedentary: 24, light: 48, moderate: 72, active: 88, athlete: 100 },
    52
  );
  const vo2 = optionScore(
    answers.vo2Proxy,
    { winded: 28, moderate: 55, sustained: 78, athlete: 98 },
    text(answers.vo2Known) === "yes" && numberValue(answers.vo2Max) ? 78 : 55
  );
  const diet = optionScore(
    answers.diet,
    { none: 48, western: 30, balanced: 64, whole: 84, mediterranean: 92, plant: 78, vegan: 72, keto: 64 },
    58
  );
  const fish = optionScore(answers.fish, { never: 25, rarely: 42, weekly: 66, "2-3pw": 88, daily: 96 }, 52);
  const alcohol = optionScore(answers.alcohol, { none: 100, low: 82, moderate: 60, high: 32 }, 65);
  const protein = optionScore(answers.protein, { low: 42, mid: 68, good: 92, high: 88 }, 65);
  const stress = optionScore(answers.stress, { "1": 100, "2": 84, "3": 64, "4": 40, "5": 22 }, 64);
  const gut = optionScore(answers.gut, { great: 100, bloat: 56, constipation: 50, loose: 48, ibs: 38 }, 64);
  const hrv = numberValue(asRecord(answers.labs).hrv);
  const hrvScore = hrv ? (hrv >= 70 ? 100 : hrv >= 55 ? 78 : hrv >= 40 ? 55 : 34) : 64;
  const smoking = optionScore(answers.smoke, { never: 100, exlong: 88, exrecent: 72, occasional: 48, daily: 20 }, 68);
  const sun = optionScore(answers.sun, { minimal: 38, low: 62, moderate: 86, high: 78 }, 62);
  const symptoms = arrayValue(answers.symptoms);
  const symptomScore = answers.feelGreat
    ? 100
    : symptoms.length === 0
      ? 78
      : symptoms.length <= 2
        ? 64
        : symptoms.length <= 4
          ? 46
          : 30;
  const biomarkerScore = labScore(answers);
  const labelLookup = domainLabels(locale);

  const domainScores: Record<DomainId, number> = {
    activity: clamp(activity * 0.7 + vo2 * 0.3),
    biomarkers: clamp(bmiScore(answers) * 0.65 + (biomarkerScore ?? 58) * 0.35),
    habits: clamp(smoking * 0.5 + sun * 0.2 + symptomScore * 0.3),
    nutrition: clamp(diet * 0.45 + fish * 0.25 + alcohol * 0.2 + protein * 0.1),
    sleep: clamp(sleepHours * 0.65 + sleepQuality * 0.35),
    stress: clamp(stress * 0.62 + gut * 0.23 + hrvScore * 0.15)
  };

  const domains = (Object.keys(domainScores) as DomainId[]).map((id) => {
    const [label, description] = labelLookup[id];

    return {
      description,
      id,
      label,
      score: domainScores[id]
    };
  });
  const score = clamp(
    domainScores.sleep * 0.2 +
      domainScores.activity * 0.2 +
      domainScores.nutrition * 0.18 +
      domainScores.stress * 0.15 +
      domainScores.biomarkers * 0.12 +
      domainScores.habits * 0.15,
    8,
    96
  );
  const lowest = [...domains].sort((a, b) => a.score - b.score)[0];

  return {
    band: bandForScore(score, locale),
    domains,
    headline: headlineForScore(score, locale),
    movers: buildMovers(domains, locale),
    score,
    summary: summaryForScore(lowest, locale)
  };
}
