import type { Metadata } from "next"
import { WebApplicationStructuredData } from "@/components/seo/structured-data"

export const metadata: Metadata = {
  title: "Гача Weebx — Крути и собирай коллекцию аниме карт",
  description: "Система гачи на Weebx: призывай аниме персонажей, собирай уникальную коллекцию карт с разными редкостями, распыляй дубликаты в пыль и продавай на маркете. PvP-арена, баннеры с гарантами и кастомные наборы.",
  keywords: [
    "гача",
    "гача игры",
    "аниме гача",
    "гача крутки",
    "аниме карты",
    "коллекция карт",
    "аниме персонажи",
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
    title: "Гача Weebx — Коллекция аниме карт",
    description: "Призывай аниме персонажей, собирай коллекцию карт с разными редкостями. PvP-арена, баннеры с гарантами.",
    type: "website",
    url: "https://weeb-x.com/gacha",
    siteName: "Weebx",
    locale: "ru_RU",
    images: [{ url: "https://weeb-x.com/og-image.png", width: 1200, height: 630, alt: "Гача Weebx — коллекция аниме карт" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Гача Weebx — Коллекция аниме карт",
    description: "Призывай аниме персонажей, собирай коллекцию карт с разными редкостями.",
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
        description="Система гачи на Weebx: призывай аниме персонажей, собирай коллекцию карт, распыляй дубликаты, продавай на маркете."
        applicationCategory="Game"
      />
      {children}
    </>
  )
}