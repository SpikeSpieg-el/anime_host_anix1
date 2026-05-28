import { HomePageWrapper } from "@/components/home/home-page-wrapper"
import {
  getPopularNow,
  getPopularAlways,
  getOngoingList,
  getForumNews,
  getAnnouncements,
  getTopOfWeek,
  type Anime,
} from "@/lib/shikimori"
import { cookies } from "next/headers"
import type { Metadata } from "next"

export async function generateMetadata(): Promise<Metadata> {
  const popularNow = await getPopularNow(1)
  const featuredAnime = popularNow[0]

  const title = "Weeb.X — Аниме streaming без отвлекающих факторов"
  const description = featuredAnime 
    ? `Смотреть аниме онлайн в высоком качестве. Сейчас в топе: ${featuredAnime.title}. Тысячи аниме, фильмы и сериалы без рекламы и отвлечений.`
    : "Смотреть аниме онлайн в высоком качестве. Тысячи аниме, фильмы и сериалы без рекламы и отвлечений. Лучший стриминг для аниме-фанов."

  return {
    title,
    description,
    keywords: [
      "аниме онлайн",
      "смотреть аниме",
      "аниме streaming",
      "anime online",
      "без рекламы",
      "высокое качество",
      "субтитры",
      "озвучка",
      featuredAnime?.title || "",
      ...(featuredAnime?.genres || [])
    ].filter(Boolean),
    openGraph: {
      title,
      description,
      type: "website",
      url: "/",
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
          alt: "Weeb.X — Аниме streaming",
        },
      ],
      siteName: "Weeb.X",
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
    withTimeout(getForumNews(5), []),
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