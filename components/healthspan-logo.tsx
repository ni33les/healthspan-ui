import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type HealthspanLogoProps = HTMLAttributes<HTMLDivElement>;

export function HealthspanLogo({
  className,
  ...props
}: HealthspanLogoProps) {
  return (
    <div
      role="img"
      aria-label="PROACTIVEAI Healthspan logo"
      className={cn("inline-flex w-max items-center gap-[13.5px]", className)}
      {...props}
    >
      <svg
        viewBox="0 0 48 48"
        className="h-[40px] w-[40px] shrink-0 sm:h-[45px] sm:w-[45px]"
        aria-hidden="true"
      >
        <rect width="48" height="48" rx="12" fill="#3A7BD5" />
        <path
          d="M8 25h9.2L22.1 12l9.8 24 4.9-11H40"
          fill="none"
          stroke="#ffffff"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="4.2"
        />
        <path
          d="M22.1 12 31.9 36"
          fill="none"
          stroke="#d9e9ff"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2.3"
        />
      </svg>

      <span className="inline-grid leading-none">
        <span className="flex items-baseline gap-[7px] text-[20px] font-semibold uppercase tracking-[0.04em] sm:text-[22.5px]">
          <span className="text-[#20343A]">PROACTIVE</span>
          <span className="text-[#3A7BD5]">AI</span>
        </span>
        <span className="mt-[4.5px] flex w-full justify-between text-[12.25px] font-normal uppercase text-muted-foreground sm:text-[13.5px]">
          {"HEALTHSPAN".split("").map((letter, index) => (
            <span key={`${letter}-${index}`}>{letter}</span>
          ))}
        </span>
      </span>
    </div>
  );
}
