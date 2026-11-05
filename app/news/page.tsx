import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Newspaper } from "lucide-react";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { PageBreadcrumbs } from "@/components/shared/page-breadcrumbs";
import { ScrollToTopButton } from "@/components/shared/scroll-to-top-button";
import { NewsFeed } from "@/components/news/news-feed";
import {
  CollectionPageStructuredData,
} from "@/components/seo/structured-data";
import { getAggregatedNews } from "@/lib/news/aggregator";
import { toFeedItem } from "@/lib/news/text";

/**
 * Новости — единственный «бесконечный» список на сайте: первая страница
 * рендерится на сервере (SEO + LCP), дальше порции подгружает /api/news.
 * Поэтому страница статична с ISR-ревалидацией, а не dynamic: никаких
 * ?page= в индексе и дублей, которые раньше создавала пагинация.
 */
export const revalidate = 300;

const PAGE_SIZE = 12;

export const metadata: Metadata = {
  title: "Новости аниме — свежие анонсы и премьеры | Weebx",
  description:
    "Свежие новости аниме: анонсы новых сезонов, даты премьер, новости манги и индустрии. Материалы Shikimori и MyAnimeList, а также публикации редакции Weebx.",
  keywords: [
    "новости аниме",
    "аниме новости",
    "анонсы аниме",
    "даты премьер аниме",
    "релизы аниме",
    "новости манги",
    "аниме индустрия",
    "свежие новости аниме",
    "последние аниме",
    "аниме премьеры",
    "anime news",
    "weebx",
    "weeb x",
    "WeebX",
    "Weeb-X",
    "weeb-x новости",
    "weebx новости",
    "weeb x новости аниме",
    "weeb-x.com новости",
  ],
  alternates: {
    canonical: "https://weeb-x.com/news",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  openGraph: {
    title: "Новости аниме — свежие анонсы и премьеры | Weebx",
    description:
      "Свежие новости аниме: анонсы новых сезонов, даты премьер, новости манги и индустрии. Материалы Shikimori и MyAnimeList, а также публикации редакции Weebx.",
    type: "website",
    url: "https://weeb-x.com/news",
    siteName: "Weebx",
    locale: "ru_RU",
    images: [
      {
        url: "https://weeb-x.com/og-image.png",
        width: 1200,
        height: 630,
        alt: "Weebx — новости аниме",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Новости аниме — свежие анонсы и премьеры | Weebx",
    description:
      "Свежие новости аниме: анонсы новых сезонов, даты премьер, новости манги и индустрии. Материалы Shikimori и MyAnimeList, а также публикации редакции Weebx.",
    images: ["https://weeb-x.com/og-image.png"],
  },
};

export default async function NewsPage() {
  const { items, hasNextPage, isFallback } = await getAggregatedNews(1, PAGE_SIZE);
  const feedItems = items.map(toFeedItem);

  return (
    <main className="relative min-h-screen bg-background pb-20 text-foreground md:pb-24">
      <div className="pointer-events-none absolute inset-0 z-0 opacity-[0.07]">
        <div className="absolute inset-0 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:20px_20px]" />
      </div>

      <Navbar />

      <div className="container relative z-10 mx-auto px-4 pb-12 pt-8">
        {/* Кнопка «Назад» + крошки закреплены сверху: при скролле вниз верхняя
            навигация прячется, а этот бар остаётся на месте. */}
        <div className="news-topbar sticky z-30 -mx-4 mb-6 border-b border-border/40 bg-background/85 px-4 py-2 backdrop-blur-md dark:border-white/5 dark:bg-background/80">
          <PageBreadcrumbs
            items={[
              { label: "Главная", href: "/" },
              { label: "Новости" },
            ]}
          />
        </div>

        <div className="mb-8">
          <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary dark:bg-primary/15">
                <Newspaper size={24} aria-hidden />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-foreground dark:text-white sm:text-4xl">
                  Новости аниме
                </h1>
                <p className="mt-1 text-muted-foreground dark:text-zinc-500">
                  Главные события мира аниме
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground dark:text-zinc-500">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-500" aria-hidden />
                Лента обновляется автоматически
              </span>
              <Link
                href="/catalog"
                className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/20 dark:bg-primary/15"
              >
                Смотреть аниме
                <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </Link>
            </div>
          </div>

          <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground dark:text-zinc-400">
            Свежие новости аниме: анонсы новых сезонов, даты премьер, новости манги и
            индустрии. Мы собираем материалы из Shikimori и MyAnimeList и дополняем их
            собственными публикациями Weebx — листайте вниз, новые материалы
            подгружаются сами.
          </p>
        </div>

        {feedItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Newspaper
              size={64}
              className="mb-4 text-muted-foreground/50 dark:text-zinc-800"
              aria-hidden
            />
            <h2 className="mb-2 text-xl font-bold text-muted-foreground dark:text-zinc-400">
              Новости временно недоступны
            </h2>
            <p className="text-muted-foreground/70 dark:text-zinc-600">
              Попробуйте обновить страницу позже
            </p>
          </div>
        ) : (
          <>
            <NewsFeed
              initialItems={feedItems}
              initialHasNextPage={hasNextPage}
              initialIsFallback={isFallback}
              pageSize={PAGE_SIZE}
            />
            <noscript>
              <p className="mt-6 text-center text-xs text-muted-foreground dark:text-zinc-500">
                Включите JavaScript, чтобы следующие новости подгружались при прокрутке.
              </p>
            </noscript>
          </>
        )}
      </div>

      <Footer />

      <ScrollToTopButton />

      {feedItems.length > 0 && (
        <CollectionPageStructuredData
          name="Новости аниме — Weebx"
          description="Свежие новости аниме: анонсы новых сезонов, даты премьер, новости манги и индустрии."
          url="https://weeb-x.com/news"
          items={feedItems}
        />
      )}
    </main>
  );
}
