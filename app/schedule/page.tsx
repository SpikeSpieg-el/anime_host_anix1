import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { ScheduleClient } from "@/components/schedule-client"
import { getAnimeCalendar } from "@/lib/shikimori"
import { ScrollToTop } from "@/components/scroll-to-top"
import { Metadata } from "next"


export const metadata: Metadata = {
  title: "Расписание выхода серий | Weeb.X",
  description: "Календарь выхода новых серий аниме. Узнайте, что посмотреть сегодня.",
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
        <ScheduleClient schedule={schedule} />

      </div>

      <ScrollToTop />
      <Footer />
    </main>
  )
}