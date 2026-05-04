import { LockClosedIcon } from "@heroicons/react/20/solid";

type CtaContent = Readonly<{
  button: string;
  reassurance: string;
  titleLine1: string;
  titleLine2: string;
}>;

type CtaSectionProps = Readonly<{
  content: CtaContent;
  ctaHref: string;
}>;

const ctaBackgroundImage =
  "https://images.pexels.com/photos/4853331/pexels-photo-4853331.jpeg?auto=compress&cs=tinysrgb&w=1800";

export function CtaSection({ content, ctaHref }: CtaSectionProps) {
  return (
    <section className="relative overflow-hidden bg-[#F3F8FF]">
      <div
        aria-hidden={true}
        className="absolute inset-0 bg-cover bg-center opacity-34"
        style={{
          backgroundImage: `url("${ctaBackgroundImage}")`,
          backgroundPosition: "center 45%"
        }}
      />
      <div
        aria-hidden={true}
        className="absolute inset-0 bg-gradient-to-b from-[#F3F8FF]/76 via-[#F3F8FF]/58 to-[#F3F8FF]/84"
      />
      <div className="relative mx-auto flex min-h-[28rem] max-w-7xl flex-col items-center justify-center px-6 py-24 text-center sm:py-32 lg:px-8">
        <h2 className="max-w-2xl text-4xl font-semibold tracking-normal text-balance text-gray-900 sm:text-5xl">
          {content.titleLine1}
          {content.titleLine2 ? (
            <>
              <br />
              {content.titleLine2}
            </>
          ) : null}
        </h2>
        <div className="mt-10 flex justify-center">
          <a
            href={ctaHref}
            className="inline-flex items-center gap-2 rounded-md bg-[#1FA77A] px-5 py-3 text-[15px] font-semibold uppercase tracking-[0.08em] text-white shadow-sm hover:bg-[#188a65] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1FA77A]"
          >
            {content.button}
          </a>
        </div>
        <div className="mt-5 flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-gray-900">
          <LockClosedIcon
            aria-hidden={true}
            className="size-3.5 flex-none text-gray-900"
          />
          <span>{content.reassurance}</span>
        </div>
      </div>
    </section>
  );
}
