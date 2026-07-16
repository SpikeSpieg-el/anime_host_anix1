import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Weeb-x — Гача-крутки аниме персонажей. Собирай легендарку",
  description: "Крути гачу и собирай легендарных аниме-персонажей! Высокий шанс SSR, ежедневные бонусы, PvP-арена. Получи первый дроп бесплатно на Weeb-x!",
  keywords: [
    "гача",
    "гача игры",
    "аниме гача",
    "гача лайф",
    "гача клуб",
    "лучшие гача игры",
    "топ гача игр",
    "аниме лутбоксы",
    "гача крутки",
    "выбить легендарного персонажа",
    "гача система",
    "шанс SSR",
    "бесплатные крутки",
    "weebx",
    "weeb x",
    "WeebX",
    "Weeb-X",
    "weeb x гача",
    "weebx гача",
  ],
  alternates: {
    canonical: "https://weeb-x.com/gacha",
  },
  openGraph: {
    title: "Weeb-x — Гача-крутки аниме персонажей",
    description: "Крути гачу и собирай легендарных аниме-персонажей! Высокий шанс SSR, ежедневные бонусы.",
    type: "website",
    url: "https://weeb-x.com/gacha",
    images: [
      {
        url: "/og-image.svg",
        width: 1200,
        height: 630,
        alt: "Weeb-x Гача-крутки",
      },
    ],
    siteName: "Weeb-X",
    locale: "ru_RU",
  },
  twitter: {
    card: "summary_large_image",
    title: "Weeb-x — Гача-крутки аниме персонажей",
    description: "Крути гачу и собирай легендарных аниме-персонажей! Высокий шанс SSR.",
    images: ["/og-image.svg"],
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default function GachaLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
