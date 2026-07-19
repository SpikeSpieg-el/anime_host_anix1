import type { Metadata } from "next"
import { WebApplicationStructuredData } from "@/components/seo/structured-data"

export const metadata: Metadata = {
  title: "Weebx — Гача-крутки аниме персонажей. Собирай легендарку",
  description: "Крути гачу и собирай легендарных аниме-персонажей! Высокий шанс SSR, ежедневные бонусы, PvP-арена. Получи первый дроп бесплатно на Weebx!",
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
    title: "Weebx — Гача-крутки аниме персонажей",
    description: "Крути гачу и собирай легендарных аниме-персонажей! Высокий шанс SSR, ежедневные бонусы.",
    type: "website",
    url: "https://weeb-x.com/gacha",
    siteName: "Weebx",
    locale: "ru_RU",
    images: [{ url: "https://weeb-x.com/og-image.png", width: 1200, height: 630, alt: "Weebx — гача аниме персонажей" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Weebx — Гача-крутки аниме персонажей",
    description: "Крути гачу и собирай легендарных аниме-персонажей! Высокий шанс SSR.",
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
  return (
    <>
      <WebApplicationStructuredData
        name="Weebx Gacha"
        url="https://weeb-x.com/gacha"
        description="Крути гачу и собирай легендарных аниме-персонажей! Высокий шанс SSR, ежедневные бонусы, PvP-арена."
        applicationCategory="Game"
      />
      {children}
    </>
  )
}
