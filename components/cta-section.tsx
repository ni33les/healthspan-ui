import { LockClosedIcon } from "@heroicons/react/20/solid";

export function CtaSection() {
  return (
    <section className="bg-background">
      <div className="mx-auto max-w-7xl px-6 py-24 sm:py-32 lg:px-8">
        <h2 className="max-w-2xl text-4xl font-semibold tracking-normal text-balance text-gray-900 sm:text-5xl">
          Personalised today.
          <br />
          Healthier tomorrow.
        </h2>
        <div className="mt-10 flex items-center">
          <a
            href="#"
            className="rounded-md bg-[#1FA77A] px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#188a65] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1FA77A]"
          >
            START YOUR FREE ASSESSMENT NOW
          </a>
        </div>
        <div className="mt-5 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-gray-900">
          <LockClosedIcon
            aria-hidden={true}
            className="size-3.5 flex-none text-gray-900"
          />
          <span>Takes 2-3 minutes * No credit card required</span>
        </div>
      </div>
    </section>
  );
}
