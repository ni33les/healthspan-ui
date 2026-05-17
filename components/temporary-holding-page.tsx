"use client";

import { useMemo, useState } from "react";
import type { FormEvent, SVGProps } from "react";
import { Heart, Leaf, Search, User } from "lucide-react";
import type { Locale } from "@/lib/i18n";

type HoldingCopy = Readonly<{
  body: string;
  ctaBody: string;
  ctaButton: string;
  ctaTitle: string;
  emailLabel: string;
  emailPlaceholder: string;
  error: string;
  success: string;
  title: string;
}>;

const copy: Record<Locale, HoldingCopy> = {
  en: {
    body:
      "We're making sure everything is just right for you before we open our doors. Be the first to know when we're ready.",
    ctaBody: "Leave your email and we will send the launch note when MattaNutra is ready.",
    ctaButton: "Notify me",
    ctaTitle: "Be the first to know",
    emailLabel: "Email address",
    emailPlaceholder: "you@example.com",
    error: "We could not save that email. Please try again.",
    success: "Thanks, we received your email. We'll let you know when we're ready.",
    title: "Getting the right amount right, takes the right amount of time."
  },
  th: {
    body:
      "เรากำลังตรวจสอบให้ทุกอย่างพร้อมก่อนเปิดให้บริการ ฝากอีเมลไว้ แล้วเราจะแจ้งให้คุณทราบทันทีเมื่อพร้อม",
    ctaBody: "ฝากอีเมลไว้ แล้วเราจะส่งข่าวเปิดตัว MattaNutra ให้คุณ",
    ctaButton: "แจ้งเตือนฉัน",
    ctaTitle: "รับข่าวก่อนใคร",
    emailLabel: "อีเมล",
    emailPlaceholder: "you@example.com",
    error: "บันทึกอีเมลไม่สำเร็จ โปรดลองอีกครั้ง",
    success: "ขอบคุณ เราได้รับอีเมลของคุณแล้ว และจะแจ้งให้ทราบเมื่อพร้อม",
    title: "การหาปริมาณที่ใช่ ต้องใช้เวลาที่พอดี"
  }
};

const features = [
  {
    accentClass: "text-[#747FE3]",
    caption: "From confusion",
    icon: Search,
    title: "Clarity"
  },
  {
    accentClass: "text-[#5CBF8D]",
    caption: "You can trust",
    icon: Leaf,
    title: "Guidance"
  },
  {
    accentClass: "text-[#5CBF8D]",
    caption: "Just for you",
    icon: User,
    title: "Personalised"
  },
  {
    accentClass: "text-[#5CBF8D]",
    caption: "In every choice",
    icon: Heart,
    title: "Confidence"
  }
] as const;

const socialLinks = [
  {
    href: "https://x.com/MattaNutra",
    icon: (props: SVGProps<SVGSVGElement>) => (
      <svg fill="currentColor" viewBox="0 0 24 24" {...props}>
        <path d="M13.682 10.622 20.239 3h-1.554l-5.693 6.618L8.445 3H3.2l6.877 10.007L3.2 21h1.554l6.012-6.989L15.569 21h5.244l-7.131-10.378Zm-2.128 2.474-.697-.997-5.543-7.929H7.7l4.474 6.399.697.996 5.815 8.318h-2.386l-4.745-6.787Z" />
      </svg>
    ),
    name: "X"
  },
  {
    href: "https://www.instagram.com/mattanutra/",
    icon: (props: SVGProps<SVGSVGElement>) => (
      <svg fill="currentColor" viewBox="0 0 24 24" {...props}>
        <path
          clipRule="evenodd"
          d="M12.315 2c2.43 0 2.784.013 3.808.06 1.064.049 1.791.218 2.427.465a4.902 4.902 0 0 1 1.772 1.153 4.902 4.902 0 0 1 1.153 1.772c.247.636.416 1.363.465 2.427.048 1.067.06 1.407.06 4.123v.08c0 2.643-.012 2.987-.06 4.043-.049 1.064-.218 1.791-.465 2.427a4.902 4.902 0 0 1-1.153 1.772 4.902 4.902 0 0 1-1.772 1.153c-.636.247-1.363.416-2.427.465-1.067.048-1.407.06-4.123.06h-.08c-2.643 0-2.987-.012-4.043-.06-1.064-.049-1.791-.218-2.427-.465a4.902 4.902 0 0 1-1.772-1.153 4.902 4.902 0 0 1-1.153-1.772c-.247-.636-.416-1.363-.465-2.427C2.013 15.099 2 14.744 2 12.315v-.63c0-2.43.013-2.784.06-3.808.049-1.064.218-1.791.465-2.427a4.902 4.902 0 0 1 1.153-1.772A4.902 4.902 0 0 1 5.45 2.525c.636-.247 1.363-.416 2.427-.465C8.901 2.013 9.256 2 11.685 2h.63Zm-.081 1.802h-.468c-2.456 0-2.784.011-3.807.058-.975.045-1.504.207-1.857.344-.467.182-.8.398-1.15.748-.35.35-.566.683-.748 1.15-.137.353-.3.882-.344 1.857-.047 1.023-.058 1.351-.058 3.807v.468c0 2.456.011 2.784.058 3.807.045.975.207 1.504.344 1.857.182.466.399.8.748 1.15.35.35.683.566 1.15.748.353.137.882.3 1.857.344 1.054.048 1.37.058 4.041.058h.08c2.597 0 2.917-.01 3.96-.058.976-.045 1.505-.207 1.858-.344.466-.182.8-.398 1.15-.748.35-.35.566-.683.748-1.15.137-.353.3-.882.344-1.857.048-1.055.058-1.37.058-4.041v-.08c0-2.597-.01-2.917-.058-3.96-.045-.976-.207-1.505-.344-1.858a3.097 3.097 0 0 0-.748-1.15 3.098 3.098 0 0 0-1.15-.748c-.353-.137-.882-.3-1.857-.344-1.023-.047-1.351-.058-3.807-.058ZM12 6.865a5.135 5.135 0 1 1 0 10.27 5.135 5.135 0 0 1 0-10.27Zm0 1.802a3.333 3.333 0 1 0 0 6.666 3.333 3.333 0 0 0 0-6.666Zm5.338-3.205a1.2 1.2 0 1 1 0 2.4 1.2 1.2 0 0 1 0-2.4Z"
          fillRule="evenodd"
        />
      </svg>
    ),
    name: "Instagram"
  },
  {
    href: "https://www.facebook.com/people/MattaNutra/61589624542529/",
    icon: (props: SVGProps<SVGSVGElement>) => (
      <svg fill="currentColor" viewBox="0 0 24 24" {...props}>
        <path
          clipRule="evenodd"
          d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z"
          fillRule="evenodd"
        />
      </svg>
    ),
    name: "Facebook"
  },
  {
    href: "https://www.tiktok.com/@mattanutra",
    icon: (props: SVGProps<SVGSVGElement>) => (
      <svg fill="currentColor" viewBox="0 0 24 24" {...props}>
        <path d="M16.6 5.82a5.45 5.45 0 0 1-3.12-3.31h-2.86v12.07a2.55 2.55 0 1 1-1.83-2.44V9.23a5.41 5.41 0 1 0 4.86 5.38V8.44a8.34 8.34 0 0 0 4.86 1.55V7.05a5.46 5.46 0 0 1-1.91-1.23Z" />
      </svg>
    ),
    name: "TikTok"
  },
  {
    href: "https://www.youtube.com/@MattaNutra",
    icon: (props: SVGProps<SVGSVGElement>) => (
      <svg fill="currentColor" viewBox="0 0 24 24" {...props}>
        <path
          clipRule="evenodd"
          d="M19.812 5.418c.861.23 1.538.907 1.768 1.768C21.998 8.746 22 12 22 12s0 3.255-.418 4.814a2.504 2.504 0 0 1-1.768 1.768C18.254 19 12 19 12 19s-6.255 0-7.814-.419a2.505 2.505 0 0 1-1.768-1.768C2 15.255 2 12 2 12s0-3.255.417-4.814a2.507 2.507 0 0 1 1.768-1.768C5.744 5 11.998 5 11.998 5s6.255 0 7.814.418ZM15.194 12 10 15V9l5.194 3Z"
          fillRule="evenodd"
        />
      </svg>
    ),
    name: "YouTube"
  },
  {
    href: "https://line.me/R/ti/p/@344enooi?oat_content=url&ts=05091931",
    icon: (props: SVGProps<SVGSVGElement>) => (
      <svg fill="currentColor" viewBox="0 0 24 24" {...props}>
        <path d="M12 3.5c-5.05 0-9.16 3.28-9.16 7.31 0 3.61 3.23 6.64 7.6 7.22.3.06.7.2.8.47.09.24.06.62.03.86l-.13.82c-.04.24-.19.94.79.51.98-.42 5.29-3.11 7.22-5.33A6.48 6.48 0 0 0 21.16 10.81C21.16 6.78 17.05 3.5 12 3.5Zm-3.95 9.18H6.29a.48.48 0 0 1-.48-.48V8.37a.48.48 0 0 1 .96 0v3.35h1.28a.48.48 0 1 1 0 .96Zm1.85-.48a.48.48 0 0 1-.96 0V8.37a.48.48 0 1 1 .96 0v3.83Zm4.15 0a.48.48 0 0 1-.85.3l-1.76-2.4v2.1a.48.48 0 1 1-.96 0V8.37a.48.48 0 0 1 .85-.29l1.76 2.4V8.37a.48.48 0 1 1 .96 0v3.83Zm2.95-2.4a.48.48 0 1 1 0 .96h-1.28v.96H17a.48.48 0 1 1 0 .96h-1.76a.48.48 0 0 1-.48-.48V8.37c0-.26.21-.48.48-.48H17a.48.48 0 1 1 0 .96h-1.28v.95H17Z" />
      </svg>
    ),
    name: "LINE"
  }
] as const;

type TemporaryHoldingPageProps = Readonly<{
  locale: Locale;
}>;

export function TemporaryHoldingPage({ locale }: TemporaryHoldingPageProps) {
  const content = copy[locale];
  const localeLinkClass = (targetLocale: Locale) =>
    targetLocale === locale
      ? "z-10 bg-[#5CBF8D] text-white"
      : "bg-white text-[#879590] hover:bg-[#FCFEFD] hover:text-[#11195F]";
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
    <main className="min-h-screen bg-[#FCFEFD] text-[#11195F]">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-8 sm:px-8 lg:px-10">
        <header className="flex items-start justify-between">
          <a
            className="text-left text-lg font-semibold tracking-tight text-[#11195F]"
            href={`/${locale}`}
          >
            <span>
              Matta<span className="text-[#5CBF8D]">Nutra</span>
            </span>
            <span className="mt-1 block text-[0.5rem] font-semibold uppercase tracking-[0.08em] text-[#879590]">
              Knowing The Right Amount
            </span>
          </a>
          <div className="isolate inline-flex rounded-md shadow-sm">
            <a
              className={`relative inline-flex items-center rounded-l-md px-3 py-2 text-sm font-semibold ring-1 ring-inset ring-[#D9F3EC] transition ${localeLinkClass("th")}`}
              href="/th"
            >
              TH
            </a>
            <a
              className={`relative -ml-px inline-flex items-center rounded-r-md px-3 py-2 text-sm font-semibold ring-1 ring-inset ring-[#D9F3EC] transition ${localeLinkClass("en")}`}
              href="/en"
            >
              EN
            </a>
          </div>
        </header>

        <section className="pt-16 text-center sm:pt-20 lg:pt-24">
          <div className="mx-auto w-full max-w-none">
            <p className="mx-auto whitespace-nowrap text-center text-[clamp(3rem,14vw,12rem)] font-semibold leading-none tracking-tight text-[#11195F]">
              Matta<span className="text-[#5CBF8D]">Nutra</span>
            </p>
            <div className="mx-auto mt-4 flex max-w-md items-center justify-center gap-5 text-sm font-semibold uppercase tracking-[0.08em] text-[#879590] sm:text-base">
              <span className="h-0.5 flex-1 bg-[#D9F3EC]" />
              <span>Knowing The Right Amount</span>
              <span className="h-0.5 flex-1 bg-[#D9F3EC]" />
            </div>
          </div>
        </section>

        <section className="py-16 text-center sm:py-20 lg:py-24">
          <div className="mx-auto max-w-3xl">
            <h1 className="font-serif text-5xl font-bold tracking-tight text-balance text-[#11195F] sm:text-7xl">
              {content.title}
            </h1>
            <p className="mx-auto mt-8 max-w-2xl text-lg font-medium leading-8 text-pretty text-[#879590] sm:text-xl/8">
              {content.body}
            </p>
          </div>
        </section>

        <section className="-mx-6 border-y border-[#D9F3EC] bg-white px-6 py-8 sm:-mx-8 sm:px-8 lg:-mx-10 lg:px-10">
          <div className="grid gap-6 sm:grid-cols-4">
            {features.map((feature) => (
              <div
                className="flex items-center gap-4 rounded-lg px-2 py-3"
                key={feature.title}
              >
                <div
                  className={`flex size-10 shrink-0 items-center justify-center ${feature.accentClass}`}
                >
                  <feature.icon aria-hidden="true" className="size-8" />
                </div>
                <div>
                  <h2
                    className={`text-base font-semibold tracking-[0.08em] uppercase ${feature.accentClass}`}
                  >
                    {feature.title}
                  </h2>
                  <p className="mt-1 text-sm text-[#879590]">{feature.caption}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="-mx-6 bg-[#FCFEFD] px-6 py-20 sm:-mx-8 sm:px-8 sm:py-28 lg:-mx-10 lg:px-10">
          <div className="w-full">
            <h2 className="mx-auto max-w-3xl text-center text-3xl font-bold uppercase tracking-[0.2em] text-[#11195F] sm:text-4xl">
              {content.ctaTitle}
            </h2>
            <p className="mx-auto mt-5 max-w-lg text-center text-base leading-7 text-[#879590] sm:text-lg">
              {content.ctaBody}
            </p>
            <form
              className="mx-auto mt-10 flex max-w-2xl flex-col overflow-hidden rounded-[2rem] border border-[#D9F3EC] bg-white sm:flex-row"
              onSubmit={onSubmit}
            >
              <label className="sr-only" htmlFor="holding-email">
                {content.emailLabel}
              </label>
              <input
                autoComplete="email"
                className="min-h-14 min-w-0 flex-auto rounded-[2rem] bg-white px-6 text-base text-[#11195F] outline-none placeholder:text-[#AAB6B2] focus:ring-4 focus:ring-[#D9F3EC] sm:rounded-r-none"
                id="holding-email"
                name="email"
                onChange={(event) => setEmail(event.target.value)}
                placeholder={content.emailPlaceholder}
                required
                type="email"
                value={email}
              />
              <button
                className="min-h-14 flex-none bg-[#202A78] px-8 text-sm font-bold uppercase tracking-[0.16em] text-white transition hover:bg-[#11195F] disabled:cursor-not-allowed disabled:opacity-60 sm:min-w-48"
                disabled={submitting}
                type="submit"
              >
                {submitting ? "..." : content.ctaButton}
              </button>
            </form>

            {message ? (
              <p
                className={`mt-4 text-center text-sm font-medium ${
                  messageType === "success" ? "text-[#3FA978]" : "text-red-600"
                }`}
              >
                {message}
              </p>
            ) : null}
          </div>
        </section>

        <footer className="-mx-6 border-t border-[#D9F3EC] bg-white px-6 py-8 sm:-mx-8 sm:px-8 lg:-mx-10 lg:px-10">
          <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
            <p className="text-sm text-[#AAB6B2]">
              &copy; 2026 MattaNutra. All rights reserved.
            </p>
            <div className="flex flex-wrap justify-center gap-x-7 gap-y-2">
              {socialLinks.map((item) => (
                <a
                  className="flex size-8 items-center justify-center text-[#11195F] transition hover:text-[#5CBF8D]"
                  href={item.href}
                  key={item.name}
                  rel="noreferrer"
                  target="_blank"
                >
                  <span className="sr-only">{item.name}</span>
                  <item.icon aria-hidden="true" className="size-5" />
                </a>
              ))}
            </div>
          </div>
        </footer>
      </div>
    </main>
  );
}
