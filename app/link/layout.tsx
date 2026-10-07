import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Привязка Telegram — Weebx",
  description: "Подтвердите привязку Telegram-бота Weebx к вашему аккаунту.",
  // Служебная страница с одноразовым кодом в адресе: в индексации ей не
  // место, а код в URL не должен разлетаться по поисковой выдаче.
  robots: { index: false, follow: false, nocache: true },
}

// Layout в App Router обязан экспортировать default, даже если ему нечего
// делать, кроме как отдать children — иначе падает проверка типов Next.
export default function LinkLayout({ children }: { children: React.ReactNode }) {
  return children
}