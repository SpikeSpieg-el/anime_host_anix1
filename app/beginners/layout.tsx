import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Гайд для новичков — Weeb-X. Как начать смотреть аниме и играть",
  description: "Полный гайд для новичков Weeb-X: как смотреть аниме, как работает гача, как участвовать в PvP-арене. Интерфейс, функции и советы.",
  keywords: [
    "гайд для новичков",
    "как смотреть аниме",
    "инструкция по сайту",
    "гача как начать",
    "pvp для новичков",
    "интерфейс аниме сайта",
    "помощь новичкам",
    "weebx",
    "weeb x",
    "WeebX",
    "Weeb-X",
    "weeb x гайд",
    "weebx новичкам",
  ],
  alternates: {
    canonical: "https://weeb-x.com/beginners",
  },
  openGraph: {
    title: "Гайд для новичков — Weeb-X",
    description: "Полный гайд для новичков Weeb-X: как смотреть аниме, как работает гача, как участвовать в PvP-арене.",
    type: "website",
    url: "https://weeb-x.com/beginners",
    images: [
      {
        url: "/og-image.svg",
        width: 1200,
        height: 630,
        alt: "Weeb-X Гайд для новичков",
      },
    ],
    siteName: "Weeb-X",
    locale: "ru_RU",
  },
  twitter: {
    card: "summary_large_image",
    title: "Гайд для новичков — Weeb-X",
    description: "Полный гайд для новичков Weeb-X: как смотреть аниме, как работает гача, как участвовать в PvP-арене.",
    images: ["/og-image.svg"],
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default function BeginnersLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
