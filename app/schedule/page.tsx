import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { ScheduleClient } from "@/components/schedule-client"
import { getAnimeCalendar } from "@/lib/shikimori"
import { Metadata } from "next"



export const metadata: Metadata = {
  title: "Расписание выхода серий | Anix",
  description: "Календарь выхода новых серий аниме. Узнайте, что посмотреть сегодня.",
}

export default async function SchedulePage() {
  const schedule = await getAnimeCalendar()

  return (
    <main className="min-h-screen bg-zinc-950 text-white pb-20 md:pb-24">
      <Navbar />
       
      <div className="container mx-auto px-3 sm:px-4 py-8">
        <ScheduleClient schedule={schedule} />
        
      </div>

      <Footer />
    </main>
  )
}