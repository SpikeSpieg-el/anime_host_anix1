import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Рынок карт — Weebx",
  robots: {
    index: false,
    follow: false,
  },
}

export default function MarketDashboardLayout({ children }: { children: React.ReactNode }) {
  return children
}
