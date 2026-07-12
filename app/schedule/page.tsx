import { Navbar } from "@/components/layout/navbar"
import { Footer } from "@/components/layout/footer"
import { ScheduleClient } from "@/components/shared/schedule-client"
import { getAnimeCalendar } from "@/lib/shikimori"
import { ScrollToTop } from "@/components/layout/scroll-to-top"
import { Metadata } from "next"
import { CoverProvider } from "@/components/providers/cover-provider"


export const metadata: Metadata = {
  title: "Расписание выхода серий | Weeb-X",
  description: "Календарь выхода новых серий аниме. Узнайте, что посмотреть сегодня.",
  keywords: [
    "расписание аниме",
    "расписание онгоингов",
    "календарь аниме",
    "выход серий аниме",
    "новые серии аниме",
    "аниме сегодня",
    "аниме на этой неделе",
    "онгоинги аниме",
    "новинки аниме",
    "аниме расписание",
    "когда выйдет аниме",
    "дата выхода аниме",
    "аниме серии",
    "аниме эпизоды",
    "график выхода аниме",
    "аниме релизы",
    "anime schedule",
    "weebx",
    "weeb x",
    "WeebX",
    "Weeb-X",
    "weeb-x расписание",
    "weebx расписание",
    "weeb x расписание аниме",
    "weeb-x.com расписание",
  ],
  alternates: {
    canonical: "https://weeb-x.com/schedule",
  },
  openGraph: {
    title: "Расписание выхода серий | Weeb-X",
    description: "Календарь выхода новых серий аниме. Узнайте, что посмотреть сегодня.",
    type: "website",
    url: "https://weeb-x.com/schedule",
    siteName: "Weeb-X",
    locale: "ru_RU",
  },
}

export default async function SchedulePage() {
  const schedule = await getAnimeCalendar()

  return (
    <main className="min-h-screen bg-background text-foreground pb-20 md:pb-24 relative">
      {/* Dot Pattern Background */}
      <div className="absolute inset-0 z-0 pointer-events-none opacity-[0.07]">
        <div className="absolute inset-0 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:20px_20px]" />
      </div>

      <Navbar />

      <div className="container mx-auto px-3 sm:px-4 py-8 relative z-10">
        <CoverProvider>
          <ScheduleClient schedule={schedule} />
        </CoverProvider>

      </div>

      <ScrollToTop />
      <Footer />
    </main>
  )
}