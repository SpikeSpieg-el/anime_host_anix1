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
import type { Metadata } from "next"

export async function generateMetadata(): Promise<Metadata> {
  const title = "Weeb-X — Смотреть аниме онлайн бесплатно | Гача и PvP"
  const description = "Смотри аниме онлайн бесплатно в HD с русской озвучкой. Популярные тайтлы, расписание онгоингов, манга, новости и гача-крутки на Weeb-X."

  return {
    title,
    description,
    keywords: [
      "смотреть аниме",
      "аниме онлайн",
      "смотреть аниме онлайн",
      "аниме бесплатно",
      "смотреть аниме бесплатно",
      "аниме онлайн бесплатно",
      "смотреть аниме без регистрации",
      "аниме без рекламы",
      "аниме с русской озвучкой",
      "русская озвучка аниме",
      "аниме с субтитрами",
      "аниме HD",
      "аниме в хорошем качестве",
      "смотреть аниме в HD",
      "онлайн аниме бесплатно",
      "сайт аниме",
      "лучший сайт аниме",
      "аниме платформа",
      "аниме стриминг",
      "каталог аниме",
      "топ аниме",
      "популярное аниме",
      "лучшее аниме",
      "новинки аниме",
      "аниме сериалы",
      "аниме фильмы",
      "полнометражные аниме",
      "онгоинги аниме",
      "расписание аниме",
      "расписание онгоингов",
      "календарь аниме",
      "выход серий аниме",
      "новые серии аниме",
      "аниме эпизоды",
      "аниме подборки",
      "аниме 2026",
      "читать мангу",
      "манга онлайн",
      "читать мангу бесплатно",
      "манга онлайн бесплатно",
      "онлайн манга",
      "манга бесплатно",
      "новинки манги",
      "аниме гача",
      "гача аниме",
      "гача крутки",
      "аниме PvP",
      "PvP арена аниме",
      "битвы аниме персонажей",
      "новости аниме",
      "аниме новости",
      "weeb-x",
      "weebx",
      "weeb x",
      "WeebX",
      "Weeb-X",
      "weeb-x.com",
      "weebx.com",
      "weeb-x аниме",
      "weebx аниме",
      "weeb-x аниме онлайн",
      "weebx аниме онлайн",
      "weeb-x смотреть аниме",
      "weebx смотреть аниме",
      "weeb x смотреть аниме",
      "weeb-x манга",
      "weebx манга",
      "weeb x читать мангу",
      "weeb-x гача",
      "weebx гача",
      "weeb x гача",
      "weeb-x pvp",
      "weebx pvp",
      "weeb x pvp",
      "weeb-x расписание",
      "weebx расписание",
      "weeb x расписание аниме",
      "weeb-x новости",
      "weebx новости",
      "weeb x новости аниме",
      "weeb-x каталог",
      "weebx каталог",
      "weeb-x stream",
      "weebx stream",
      "weeb-x anime",
      "weebx anime",
      "weeb x аниме",
      "weebx онлайн",
    ].filter(Boolean),
    alternates: {
      canonical: "https://weeb-x.com",
    },
    openGraph: {
      title,
      description,
      type: "website",
      url: "https://weeb-x.com",
      images: [
        {
          url: "/og-image.svg",
          width: 1200,
          height: 630,
          alt: "Weeb-X — Смотреть аниме онлайн бесплатно | Гача и PvP",
        },
      ],
      siteName: "Weeb-X",
      locale: "ru_RU",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["/og-image.svg"],
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