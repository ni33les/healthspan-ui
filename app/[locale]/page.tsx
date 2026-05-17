import { notFound } from "next/navigation";
import { TemporaryHoldingPage } from "@/components/temporary-holding-page";
import { isLocale, locales } from "@/lib/i18n";

type HomeProps = Readonly<{
  params: Promise<{
    locale: string;
  }>;
}>;

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export const dynamic = "force-dynamic";

export default async function Home({ params }: HomeProps) {
  const { locale: rawLocale } = await params;

  if (!isLocale(rawLocale)) {
    notFound();
  }

  return <TemporaryHoldingPage locale={rawLocale} />;
}
