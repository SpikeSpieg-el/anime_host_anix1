import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Weeb-X — PvP-арена аниме битв. Сразись и возглавь рейтинг",
  description: "Участвуй в PvP-сражениях с аниме-персонажами! Рейтинговая система, награды за победы, таблица лидеров. Собери команду и стань чемпионом на Weeb-X!",
  keywords: [
    "пвп арена",
    "аниме битвы",
    "рейтинг бойцов",
    "собрать команду для пвп",
    "таблица лидеров",
    "бои аниме онлайн",
    "бойцовский клуб аниме",
    "аниме игры онлайн",
    "аниме онлайн игры смотреть",
    "игры аниме онлайн бесплатно",
    "аниме игра на русском",
    "аниме игры как геншин",
    "weebx",
    "weeb x",
    "WeebX",
    "Weeb-X",
    "weeb x пвп",
    "weebx арена",
  ],
  alternates: {
    canonical: "https://weeb-x.com/battle",
  },
  openGraph: {
    title: "Weeb-X — PvP-арена аниме битв",
    description: "Участвуй в PvP-сражениях с аниме-персонажами! Рейтинговая система, награды за победы.",
    type: "website",
    url: "https://weeb-x.com/battle",
    siteName: "Weeb-X",
    locale: "ru_RU",
  },
  twitter: {
    card: "summary_large_image",
    title: "Weeb-X — PvP-арена аниме битв",
    description: "Участвуй в PvP-сражениях с аниме-персонажами! Рейтинговая система, награды за победы.",
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default function BattleLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
