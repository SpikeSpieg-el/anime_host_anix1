import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "История просмотров — Weebx",
  robots: {
    index: false,
    follow: false,
  },
}

export default function HistoryLayout({ children }: { children: React.ReactNode }) {
  return children
}
