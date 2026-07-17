import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Гайд для новичков — Weebx. Как начать смотреть аниме и играть",
  description: "Полный гайд для новичков Weebx: как смотреть аниме, как работает гача, как участвовать в PvP-арене. Интерфейс, функции и советы.",
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
    title: "Гайд для новичков — Weebx",
    description: "Полный гайд для новичков Weebx: как смотреть аниме, как работает гача, как участвовать в PvP-арене.",
    type: "website",
    url: "https://weeb-x.com/beginners",
    siteName: "Weebx",
    locale: "ru_RU",
  },
  twitter: {
    card: "summary_large_image",
    title: "Гайд для новичков — Weebx",
    description: "Полный гайд для новичков Weebx: как смотреть аниме, как работает гача, как участвовать в PvP-арене.",
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
