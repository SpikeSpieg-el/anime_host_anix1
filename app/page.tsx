import { Navbar } from "@/components/navbar"
import { AnimeCard } from "@/components/anime-card"
import { 
  getPopularNow, 
  getPopularAlways, 
  getOngoingList, 
  getForumNews, 
  getAnnouncements, 
  getHeroRecommendation 
} from "@/lib/shikimori"
import { HeroBanner } from "@/components/hero-banner"
import { UserHistory } from "@/components/user-history"
import { UpdatesBanner } from "@/components/updates-banner" // Предполагаем, что этот компонент может принимать новости
import { BookmarksSection } from "@/components/bookmarks-section"
import { AiAdvisor } from "@/components/ai-advisor"
import { cookies } from 'next/headers'
import Link from "next/link"

export default async function HomePage() {
  // 1. Получаем историю из кук
  const cookieStore = await cookies();
  const watchedHistory = cookieStore.get('watched_history')?.value;
  const watchedIds = watchedHistory ? JSON.parse(watchedHistory) : [];

  // 2. Параллельный запрос данных
  const [
    popularNow,
    popularAlways,
    ongoingAnime,
    newsUpdates,
    announcements,
  ] = await Promise.all([
    getPopularNow(12),         // Популярные онгоинги
    getPopularAlways(12),      // Популярные завершенные
    getOngoingList(12),        // Полный список онгоингов (ranked)
    getForumNews(4),           // Новости сайта/индустрии
    getAnnouncements(3),       // Анонсы
  ]);

  // 3. Рекомендация для Hero баннера
  const heroFallback = [...popularNow, ...popularAlways];
  const recommendedHero = await getHeroRecommendation(watchedIds, heroFallback);
  const heroAnime = recommendedHero || heroFallback[0];
  
  // Убираем hero из списков, чтобы не дублировать (опционально)
  const popularNowList = popularNow.filter(a => a.id !== heroAnime?.id).slice(0, 12);

  return (
    <main className="min-h-screen bg-zinc-950 text-white pb-20 overflow-x-hidden selection:bg-orange-500/30">
      <Navbar />

      {/* 1. HERO SECTION */}
      {heroAnime && <HeroBanner anime={heroAnime} />}

      <div className="container mx-auto px-4 relative z-10 -mt-10">
        
        {/* === ВСТАВИТЬ ЗДЕСЬ === */}
        <div className="mb-12 flex justify-center md:justify-start">
           <AiAdvisor />
        </div>
        {/* ===================== */}

        {/* 2. ИСТОРИЯ И ЗАКЛАДКИ */}
        <UserHistory />
        <BookmarksSection />

        {/* 3. НОВОСТИ И ОБНОВЛЕНИЯ (Аналог /forum/updates) */}
        {newsUpdates.length > 0 && (
            <section className="mb-12 bg-zinc-900/50 p-6 rounded-xl border border-zinc-800">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                        <span className="w-2 h-8 bg-orange-500 rounded-full"></span>
                        Новости индустрии
                    </h2>
                    <Link href="https://shikimori.one/forum/news" target="_blank" className="text-zinc-400 text-sm hover:text-white transition">
                        Все новости Shikimori &rarr;
                    </Link>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {newsUpdates.map((news) => (
                        <a key={news.id} href={news.url} target="_blank" rel="noopener noreferrer" className="block group">
                            <article className="h-full flex flex-col justify-between p-4 bg-zinc-900 rounded-lg hover:bg-zinc-800 transition border border-zinc-800 hover:border-orange-500/50">
                                <div>
                                    <h3 className="font-semibold text-zinc-100 group-hover:text-orange-400 transition line-clamp-2 mb-2">
                                        {news.title}
                                    </h3>
                                    <p className="text-xs text-zinc-500 line-clamp-3 mb-3">{news.excerpt}</p>
                                </div>
                                <div className="flex justify-between items-center text-xs text-zinc-600 mt-auto pt-3 border-t border-zinc-800">
                                    <span>{news.date}</span>
                                    <span className="flex items-center gap-1">
                                        💬 {news.comments}
                                    </span>
                                </div>
                            </article>
                        </a>
                    ))}
                </div>
            </section>
        )}

        {/* 4. ПОПУЛЯРНОЕ СЕЙЧАС (Ongoing Popular) */}
        <section className="mb-16">
          <div className="flex items-end justify-between mb-6">
            <div>
              <h2 className="text-3xl font-bold text-white mb-1">Популярное сейчас</h2>
              <p className="text-zinc-500 text-sm">Главные хиты текущего сезона</p>
            </div>
            <Link href="/catalog?sort=popular&status=ongoing" className="text-orange-500 text-sm font-medium hover:text-orange-400 transition">
                Показать все
            </Link>
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-4 gap-y-8">
            {popularNowList.map((anime) => (
              <AnimeCard key={anime.id} anime={anime} />
            ))}
          </div>
        </section>

        {/* 5. ОНГОИНГИ (Аналог /animes/status/ongoing) */}
        <section className="mb-16">
          <div className="flex items-end justify-between mb-6">
             <div className="flex items-center gap-3">
                <h2 className="text-2xl font-bold text-white">Выходят прямо сейчас</h2>
                <span className="px-2 py-0.5 bg-green-500/10 text-green-500 text-xs font-bold rounded uppercase tracking-wider">Ongoing</span>
             </div>
             <Link href="/catalog?status=ongoing" className="text-zinc-400 text-sm font-medium hover:text-white transition">
                Весь список
             </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {ongoingAnime.map((anime) => (
              <AnimeCard key={anime.id} anime={anime} />
            ))}
          </div>
        </section>

        {/* 6. ПОПУЛЯРНЫЕ ВСЕГДА */}
        <section className="mb-16">
          <div className="flex items-end justify-between mb-6">
            <div>
              <h2 className="text-3xl font-bold text-white mb-1">Легендарное</h2>
              <p className="text-zinc-500 text-sm">Классика и шедевры на все времена</p>
            </div>
            <Link href="/catalog?sort=popular" className="text-orange-500 text-sm font-medium hover:text-orange-400 transition">
                Показать все
            </Link>
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-4 gap-y-8">
            {popularAlways.map((anime) => (
              <AnimeCard key={anime.id} anime={anime} />
            ))}
          </div>
        </section>

      </div>
    </main>
  )
}