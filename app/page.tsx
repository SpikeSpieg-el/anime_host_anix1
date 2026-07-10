import { HomePageWrapper } from "@/components/home/home-page-wrapper"
import {
  getPopularNow,
  getPopularAlways,
  getOngoingList,
  getAnnouncements,
  getTopOfWeek,
  type Anime,
} from "@/lib/shikimori"
import { getAggregatedNews } from "@/lib/news/aggregator"
import { cookies } from "next/headers"
import type { Metadata } from "next"

export async function generateMetadata(): Promise<Metadata> {
  const popularNow = await getPopularNow(1)
  const featuredAnime = popularNow[0]

  const title = "Weeb-x — Гача-крутки и PvP-арена с аниме-героями"
  const description = "Крути гачу и собирай легендарных аниме-персонажей! Высокий шанс SSR, ежедневные бонусы, PvP-арена. Получи первый дроп бесплатно на Weeb-x!"

  return {
    title,
    description,
    keywords: [
      "гача",
      "гача игры",
      "аниме гача",
      "PvP арена",
      "бои аниме онлайн",
      "гача лайф",
      "гача клуб",
      "лучшие гача игры",
      "топ гача игр",
      "аниме лутбоксы",
      "аниме игры как геншин",
      "аниме игры онлайн",
      "смотреть аниме",
      "аниме онлайн",
    ].filter(Boolean),
    alternates: {
      canonical: "https://weeb-x.com",
    },
    openGraph: {
      title,
      description,
      type: "website",
      url: "https://weeb-x.com",
      images: featuredAnime ? [
        {
          url: featuredAnime.poster,
          width: 400,
          height: 600,
          alt: featuredAnime.title,
        },
      ] : [
        {
          url: "/og-image.svg",
          width: 1200,
          height: 630,
          alt: "Weeb-X — Аниме streaming",
        },
      ],
      siteName: "Weeb-X",
      locale: "ru_RU",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: featuredAnime ? [featuredAnime.poster] : ["/og-image.svg"],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-video-preview": -1,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
  }
}

function withTimeout<T>(promise: Promise<T>, fallback: T, ms = 8000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ])
}

export default async function HomePage() {
  // Загружаем только критические данные — без тяжёлой рекомендации
  const [popularNow, topOfWeekList, popularAlways, ongoingAnime, newsUpdates, announcements] = await Promise.all([
    withTimeout(getPopularNow(12), []),
    withTimeout(getTopOfWeek(30), []),
    withTimeout(getPopularAlways(12), []),
    withTimeout(getOngoingList(12), []),
    withTimeout(getAggregatedNews(1, 5).then(r => r.items), []),
    withTimeout(getAnnouncements(3), []),
  ])

  const topOfWeekHero =
    topOfWeekList.length > 0
      ? topOfWeekList[Math.floor(Math.random() * topOfWeekList.length)]
      : popularNow[0] ?? null

  return (
    <HomePageWrapper
      topOfWeekHero={topOfWeekHero}
      initialData={{
        popularNow,
        popularAlways,
        ongoingAnime,
        newsUpdates,
        announcements,
      }}
    />
  )
}