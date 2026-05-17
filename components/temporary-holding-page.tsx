"use client";

import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import type { Locale } from "@/lib/i18n";

type HoldingCopy = Readonly<{
  body: string;
  button: string;
  emailLabel: string;
  emailPlaceholder: string;
  error: string;
  eyebrow: string;
  privacy: string;
  success: string;
  title: string;
}>;

const copy: Record<Locale, HoldingCopy> = {
  en: {
    body:
      "We are preparing the MattaNutra experience. Join the early access list and we will let you know when your personalised nutrition guide is ready.",
    button: "Join early access",
    emailLabel: "Email address",
    emailPlaceholder: "you@example.com",
    error: "We could not save that email. Please try again.",
    eyebrow: "MattaNutra",
    privacy: "No spam. Just the launch note and early access updates.",
    success: "Thank you. You are on the list.",
    title: "Personalised nutrition is almost ready"
  },
  th: {
    body:
      "เรากำลังเตรียมประสบการณ์ MattaNutra ให้พร้อม ลงทะเบียนล่วงหน้า แล้วเราจะแจ้งให้คุณทราบเมื่อคู่มือโภชนาการเฉพาะบุคคลพร้อมใช้งาน",
    button: "ลงทะเบียนล่วงหน้า",
    emailLabel: "อีเมล",
    emailPlaceholder: "you@example.com",
    error: "บันทึกอีเมลไม่สำเร็จ โปรดลองอีกครั้ง",
    eyebrow: "MattaNutra",
    privacy: "ไม่มีสแปม เราจะส่งเฉพาะข่าวเปิดตัวและข้อมูล early access",
    success: "ขอบคุณ เราเพิ่มคุณในรายชื่อแล้ว",
    title: "โภชนาการเฉพาะบุคคลใกล้พร้อมแล้ว"
  }
};

type TemporaryHoldingPageProps = Readonly<{
  locale: Locale;
}>;

export function TemporaryHoldingPage({ locale }: TemporaryHoldingPageProps) {
  const content = copy[locale];
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<"error" | "success" | null>(
    null
  );
  const [submitting, setSubmitting] = useState(false);

  const source = useMemo(() => {
    if (typeof window === "undefined") {
      return {};
    }

    const params = new URLSearchParams(window.location.search);

    return {
      campaignId: params.get("campaign_id"),
      path: window.location.pathname,
      referrer: document.referrer || null,
      sourceUrl: window.location.href,
      utmCampaign: params.get("utm_campaign"),
      utmContent: params.get("utm_content"),
      utmMedium: params.get("utm_medium"),
      utmSource: params.get("utm_source"),
      utmTerm: params.get("utm_term")
    };
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setMessageType(null);
    setSubmitting(true);

    try {
      const response = await fetch("/api/holding-page-signups", {
        body: JSON.stringify({
          attribution: source,
          email,
          locale
        }),
        headers: {
          "Content-Type": "application/json"
        },
        method: "POST"
      });

      if (!response.ok) {
        throw new Error("Signup failed");
      }

      setEmail("");
      setMessage(content.success);
      setMessageType("success");
    } catch {
      setMessage(content.error);
      setMessageType("error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-white text-gray-950">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-8 sm:px-8 lg:px-10">
        <header className="flex items-center justify-between">
          <a
            className="text-lg font-semibold tracking-tight text-gray-950"
            href={`/${locale}`}
          >
            MattaNutra
          </a>
          <div className="flex gap-3 text-sm font-medium">
            <a className="text-gray-500 hover:text-gray-950" href="/en">
              EN
            </a>
            <a className="text-gray-500 hover:text-gray-950" href="/th">
              TH
            </a>
          </div>
        </header>

        <section className="flex flex-1 items-center py-16 sm:py-24">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-700">
              {content.eyebrow}
            </p>
            <h1 className="mt-5 text-4xl font-semibold tracking-tight text-gray-950 sm:text-6xl">
              {content.title}
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-gray-600">
              {content.body}
            </p>

            <form
              className="mt-10 flex max-w-xl flex-col gap-3 sm:flex-row"
              onSubmit={onSubmit}
            >
              <label className="sr-only" htmlFor="holding-email">
                {content.emailLabel}
              </label>
              <input
                autoComplete="email"
                className="min-h-12 flex-1 rounded-md border border-gray-300 bg-white px-4 text-base text-gray-950 outline-none ring-blue-600/20 transition focus:border-blue-600 focus:ring-4"
                id="holding-email"
                name="email"
                onChange={(event) => setEmail(event.target.value)}
                placeholder={content.emailPlaceholder}
                required
                type="email"
                value={email}
              />
              <button
                className="min-h-12 rounded-md bg-blue-700 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={submitting}
                type="submit"
              >
                {submitting ? "..." : content.button}
              </button>
            </form>

            {message ? (
              <p
                className={`mt-4 text-sm font-medium ${
                  messageType === "success" ? "text-green-700" : "text-red-700"
                }`}
              >
                {message}
              </p>
            ) : null}

            <p className="mt-5 text-sm text-gray-500">{content.privacy}</p>
          </div>
        </section>
      </div>
    </main>
  );
}
