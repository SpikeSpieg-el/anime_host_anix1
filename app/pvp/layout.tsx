import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Weebx — PvP-арена аниме битв",
  description: "Сражайся с игроками на PvP-арене Weebx, поднимайся в рейтинге и получай награды.",
  alternates: {
    canonical: "https://weeb-x.com/pvp",
  },
  openGraph: {
    title: "Weebx — PvP-арена аниме битв",
    description: "Сражайся с игроками на PvP-арене Weebx, поднимайся в рейтинге и получай награды.",
    type: "website",
    url: "https://weeb-x.com/pvp",
    siteName: "Weebx",
    locale: "ru_RU",
    images: [{ url: "https://weeb-x.com/og-image.png", width: 1200, height: 630, alt: "Weebx — PvP-арена аниме битв" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Weebx — PvP-арена аниме битв",
    description: "Сражайся с игроками на PvP-арене Weebx, поднимайся в рейтинге и получай награды.",
    images: ["https://weeb-x.com/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default function PvpLayout({ children }: { children: React.ReactNode }) {
  return children
}
