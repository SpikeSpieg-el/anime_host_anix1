import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Тест поиска — Weebx",
  robots: {
    index: false,
    follow: false,
  },
}

export default function TestSearchLayout({ children }: { children: React.ReactNode }) {
  return children
}
