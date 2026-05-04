import {
  ClockIcon,
  HeartIcon,
  ShieldCheckIcon
} from "@heroicons/react/24/outline";
import { Target } from "lucide-react";
import type { ComponentType } from "react";

type FeatureIconProps = Readonly<{
  "aria-hidden": boolean;
  className: string;
}>;

type Feature = Readonly<{
  description: string;
  name: string;
}>;

type SupportFeatureContent = Readonly<{
  features: readonly Feature[];
  title: string;
}>;

const featureIcons: ComponentType<FeatureIconProps>[] = [
  Target,
  ShieldCheckIcon,
  ClockIcon,
  HeartIcon
];

export function SupportFeatureSection({
  content
}: Readonly<{ content: SupportFeatureContent }>) {
  return (
    <section className="bg-white py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto grid max-w-2xl grid-cols-1 gap-16 sm:gap-y-20 lg:mx-0 lg:max-w-none lg:grid-cols-5">
          <h2 className="col-span-2 text-4xl font-semibold tracking-normal text-pretty text-gray-900 sm:text-5xl">
            {content.title}
          </h2>
          <dl className="col-span-3 grid grid-cols-1 gap-x-8 gap-y-16 sm:grid-cols-2">
            {content.features.map((feature, index) => {
              const Icon = featureIcons[index] ?? HeartIcon;

              return (
                <div key={feature.name}>
                  <dt className="text-base/7 font-semibold uppercase tracking-[0.08em] text-gray-900">
                    <div className="mb-6 flex size-10 items-center justify-center rounded-lg bg-[#3A7BD5]">
                      <Icon
                        aria-hidden={true}
                        className="size-6 text-white"
                      />
                    </div>
                    {feature.name}
                  </dt>
                  <dd className="mt-1 text-base/7 text-gray-600">
                    {feature.description}
                  </dd>
                </div>
              );
            })}
          </dl>
        </div>
      </div>
    </section>
  );
}
