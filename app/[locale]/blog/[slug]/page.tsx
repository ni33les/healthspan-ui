import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BlogArticle } from "@/components/blog-article";
import { SiteFooter } from "@/components/site-footer";
import { TitleBar } from "@/components/title-bar";
import { getPublishedBlogPost } from "@/lib/blog";
import { getDictionary, isLocale, type Locale } from "@/lib/i18n";

type BlogArticlePageProps = Readonly<{
  params: Promise<{
    locale: string;
    slug: string;
  }>;
}>;

export const dynamic = "force-dynamic";

async function getPagePost(params: BlogArticlePageProps["params"]) {
  const { locale: rawLocale, slug } = await params;

  if (!isLocale(rawLocale)) {
    return null;
  }

  const locale: Locale = rawLocale;
  const post = await getPublishedBlogPost(locale, slug);

  return post ? { locale, post } : null;
}

export async function generateMetadata({
  params
}: BlogArticlePageProps): Promise<Metadata> {
  const page = await getPagePost(params);

  if (!page) {
    return {};
  }

  return {
    description: page.post.seoDescription,
    title: `MattaNutra | ${page.post.seoTitle}`
  };
}

export default async function BlogArticlePage({
  params
}: BlogArticlePageProps) {
  const page = await getPagePost(params);

  if (!page) {
    notFound();
  }

  const dictionary = getDictionary(page.locale);
  const currentPath = `/${page.locale}/blog/${page.post.slug}`;

  return (
    <main className="flex min-h-screen flex-col bg-background text-foreground">
      <TitleBar
        currentLocale={page.locale}
        currentPath={currentPath}
        title={dictionary.hero.eyebrow}
      />
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col">
        <BlogArticle post={page.post} />
        <SiteFooter content={dictionary.footer} locale={page.locale} />
      </div>
    </main>
  );
}
