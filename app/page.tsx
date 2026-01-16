import { Navbar } from "@/components/navbar"
import { HomePageClient } from "@/components/home-client"
import { 
  getPopularNow, 
  getPopularAlways, 
  getOngoingList, 
  getForumNews, 
  getAnnouncements, 
  getTopOfWeek
} from "@/lib/shikimori"
import { FloatingNav } from "@/components/floating-nav"
import { cookies } from 'next/headers'

export default async function HomePage() {
  // 1. Получаем историю и закладки из кук
  const cookieStore = await cookies();
  const watchedHistory = cookieStore.get('watched_history')?.value;
  const watchedIds = watchedHistory ? JSON.parse(watchedHistory) : [];
  
  const bookmarkIdsCookie = cookieStore.get('bookmark_ids')?.value;
  const bookmarkIds = bookmarkIdsCookie ? bookmarkIdsCookie.split(',').filter(Boolean) : [];

  // 2. Параллельный запрос данных
  const [
    popularNow,
    popularAlways,
    ongoingAnime,
    newsUpdates,
    announcements,
    topOfWeekList,
  ] = await Promise.all([
    getPopularNow(12),
    getPopularAlways(12),
    getOngoingList(12),
    getForumNews(5),
    getAnnouncements(3),
    getTopOfWeek(30),
  ]);

  return (
    <main className="min-h-screen bg-zinc-950 text-white pb-20 md:pb-24 overflow-x-hidden selection:bg-orange-500/30">
      <Navbar />
      <FloatingNav />
      <HomePageClient 
        initialData={{
          popularNow,
          popularAlways,
          ongoingAnime,
          newsUpdates,
          announcements,
          topOfWeekList,
          watchedIds,
          bookmarkIds
        }}
      />
    </main>
  )
}