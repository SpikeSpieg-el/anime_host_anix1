import { HomePageWrapper } from "@/components/home-page-wrapper"
import {
  getPopularNow,
  getPopularAlways,
  getOngoingList,
  getForumNews,
  getAnnouncements,
  getTopOfWeek,
  getHeroRecommendation,
  getAnimeById,
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

export default async function HomePage() {
  // 1. Получаем историю и закладки из кук (для исключения из блока «Для вас»)
  const cookieStore = await cookies()
  let watchedIds: string[] = []
  try {
    const raw = cookieStore.get("watched_history")?.value
    if (raw) {
      const parsed = JSON.parse(raw)
      watchedIds = Array.isArray(parsed) ? parsed.map(String) : []
    }
  } catch {
    watchedIds = []
  }

  const bookmarkIdsCookie = cookieStore.get("bookmark_ids")?.value
  const bookmarkIds = bookmarkIdsCookie
    ? bookmarkIdsCookie.split(",").filter(Boolean)
    : []

  // 2. Сначала загружаем только критические данные для первого экрана
  const [popularNow, topOfWeekList] = await Promise.all([
    getPopularNow(12),
    getTopOfWeek(30),
  ])

  // 2.1. Сразу готовим данные для Hero (на сервере, с приоритетом)
  const heroFallback: Anime[] = [...popularNow]
  const topOfWeekHero =
    topOfWeekList.length > 0
      ? topOfWeekList[Math.floor(Math.random() * topOfWeekList.length)]
      : heroFallback[0] ?? null

  // 2.2. Параллельно загружаем детали для Hero и рекомендации
  const [topOfWeekHeroFull, recommendedHero] = await Promise.all([
    topOfWeekHero ? getAnimeById(topOfWeekHero.id, false) : Promise.resolve(null),
    getHeroRecommendation(
      watchedIds.filter((id: string) => id !== String(topOfWeekHero?.id)).map(String),
      bookmarkIds,
      heroFallback,
    ),
  ])

  const topOfWeekHeroWithDetails = topOfWeekHero
    ? topOfWeekHeroFull
      ? {
          ...topOfWeekHero,
          ...topOfWeekHeroFull,
          backdrop: topOfWeekHero.backdrop ?? topOfWeekHeroFull.backdrop,
        }
      : topOfWeekHero
    : null

  const recommendedAnime = recommendedHero.anime

  // 3. Остальные данные загружаем параллельно, но не блокируем рендер
  const [popularAlways, ongoingAnime, newsUpdates, announcements] = await Promise.all([
    getPopularAlways(12),
    getOngoingList(12),
    getForumNews(5),
    getAnnouncements(3),
  ])

  return (
    <HomePageWrapper
      topOfWeekHeroWithDetails={topOfWeekHeroWithDetails}
      recommendedAnime={recommendedAnime}
      recommendationReason={recommendedHero.reason}
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