import { Navbar } from "@/components/navbar"
import { AnimeCard } from "@/components/anime-card"
import { 
  getPopularNow, 
  getPopularAlways, 
  getOngoingList, 
  getForumNews, 
  getAnnouncements, 
  getHeroRecommendation,
  getTopOfWeek
} from "@/lib/shikimori"
import { HeroBanner } from "@/components/hero-banner"
import { UserHistory } from "@/components/user-history"
import { BookmarksSection } from "@/components/bookmarks-section"
import { AiAdvisor } from "@/components/ai-advisor"
import { FloatingNav } from "@/components/floating-nav"
import { UpdatesBanner } from "@/components/updates-banner"
import { cookies } from 'next/headers'
import Link from "next/link"
import { MessageSquare, User, ExternalLink, ChevronRight, History, Newspaper, TrendingUp, Play, Star } from "lucide-react"
import { Footer } from "@/components/footer"

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

  // 3. Рекомендация для Hero баннера
  const heroFallback = [...popularNow, ...popularAlways];
  const recommendedHero = await getHeroRecommendation(watchedIds, bookmarkIds, heroFallback);
  
  const topOfWeekHero = topOfWeekList.length > 0 
    ? topOfWeekList[Math.floor(Math.random() * topOfWeekList.length)] 
    : heroFallback[0];
  
  const popularNowList = popularNow.filter(a => a.id !== topOfWeekHero?.id && a.id !== recommendedHero?.id).slice(0, 12);

  return (
    <main className="min-h-screen bg-zinc-950 text-white pb-20 md:pb-24 overflow-x-hidden selection:bg-orange-500/30">
      <Navbar />
      <FloatingNav />

      {/* 1. HERO SECTION */}
      {(topOfWeekHero || recommendedHero) && (
        <section id="hero">
          <HeroBanner 
            topOfWeekAnime={topOfWeekHero} 
            recommendedAnime={recommendedHero} 
          />
        </section>
      )}

      {/* АДАПТИВНЫЙ КОНТЕЙНЕР: px-3 на мобильных, px-4 на ПК */}
      <div className="container mx-auto px-3 sm:px-4 relative z-10 -mt-5 sm:-mt-10">
        
        {/* AiAdvisor */}
        <section id="ai-advisor" className="mb-8 md:mb-12 flex justify-center md:justify-start w-full">
           <AiAdvisor />
        </section>

        {/* 2. ИСТОРИЯ И ЗАКЛАДКИ */}
        <section id="history-bookmarks" className="space-y-8 md:space-y-12 mb-10 md:mb-16">
          <UserHistory />
          <BookmarksSection />
        </section>

        {/* 3. ЛЕНТА ОБНОВЛЕНИЙ */}
        <UpdatesBanner updates={ongoingAnime} announcements={announcements} />

        {/* 4. НОВОСТИ И ОБНОВЛЕНИЯ */}
        {newsUpdates.length > 0 && (
            <section id="news" className="mb-10 sm:mb-16">
                <div className="flex flex-row items-center justify-between mb-4 sm:mb-6">
                    <div>
                        <h2 className="text-xl sm:text-3xl font-bold text-white mb-1 flex items-center gap-2 sm:gap-3">
                            <Newspaper className="w-6 h-6 sm:w-7 sm:h-7 text-blue-400" />
                            Новости
                            <span className="hidden sm:inline-block px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 text-xs font-bold border border-blue-500/20 uppercase tracking-wider">
                                News
                            </span>
                        </h2>
                        <p className="text-zinc-500 text-xs sm:text-sm hidden xs:block">Главные события мира аниме</p>
                    </div>
                    
                    {/* КНОПКА: Единый стиль (Фон + скругление) */}
                    <Link 
                      href="https://shikimori.one/forum/news" 
                      target="_blank" 
                      className="group flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-3 sm:px-4 py-2 rounded-full text-xs sm:text-sm font-medium transition-colors"
                    >
                        <span>Все новости</span>
                        <ExternalLink className="w-3 h-3 sm:w-4 sm:h-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                    </Link>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
                    {newsUpdates.map((news) => (
                        <a 
                           key={news.id} 
                           href={news.url} 
                           target="_blank" 
                           rel="noopener noreferrer" 
                           className="group flex flex-col h-full bg-zinc-900/40 border border-zinc-800 rounded-xl sm:rounded-2xl p-4 sm:p-5 hover:border-zinc-600 transition-all hover:bg-zinc-900 active:scale-[0.98] sm:hover:-translate-y-1 hover:shadow-xl hover:shadow-black/50"
                        >
                            <div className="flex items-center justify-between mb-2 sm:mb-3">
                                <span className="text-[10px] sm:text-xs font-medium text-zinc-500 bg-zinc-800/50 px-2 py-1 rounded-md">
                                    {news.date}
                                </span>
                            </div>

                            <h3 className="font-bold text-sm sm:text-base text-zinc-100 leading-snug mb-2 group-hover:text-blue-400 transition-colors line-clamp-2 sm:line-clamp-3">
                                {news.title}
                            </h3>
                            
                            <p className="text-xs sm:text-sm text-zinc-400 line-clamp-3 mb-3 sm:mb-4 flex-1 leading-relaxed">
                                {news.excerpt.replace(/\[.*?\]/g, "")}
                            </p>

                            <div className="flex items-center justify-between pt-3 sm:pt-4 border-t border-white/5 mt-auto">
                                <div className="flex items-center gap-2 text-[10px] sm:text-xs text-zinc-500">
                                    <User className="w-3 h-3" />
                                    <span className="truncate max-w-[100px]">{news.author}</span>
                                </div>
                                <div className="flex items-center gap-1.5 text-[10px] sm:text-xs font-medium text-zinc-400 bg-zinc-800/50 px-2 py-1 rounded-md group-hover:bg-zinc-800 group-hover:text-white transition-colors">
                                    <MessageSquare className="w-3 h-3" />
                                    <span>{news.comments}</span>
                                </div>
                            </div>
                        </a>
                    ))}
                </div>
            </section>
        )}

        {/* 5. ПОПУЛЯРНОЕ СЕЙЧАС */}
        <section id="popular" className="mb-8 sm:mb-16">
          <div className="flex items-center justify-between mb-4 sm:mb-6">
            <div>
              <h2 className="text-xl sm:text-3xl font-bold text-white mb-0.5 sm:mb-1 flex items-center gap-2 sm:gap-3">
                <TrendingUp className="w-6 h-6 sm:w-7 sm:h-7 text-orange-400" />
                Популярное</h2>
              <p className="text-zinc-500 text-xs sm:text-sm">Хиты сезона</p>
            </div>
            {/* КНОПКА: Оранжевая, стиль кнопки */}
            <Link 
              href="/catalog?sort=popular&status=ongoing" 
              className="flex items-center gap-1 sm:gap-2 bg-orange-500/10 hover:bg-orange-500/20 text-orange-500 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-bold transition-colors whitespace-nowrap"
            >
                Показать все <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4" />
            </Link>
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-x-4 gap-y-6 sm:gap-y-8">
            {popularNowList.map((anime) => (
              <AnimeCard key={anime.id} anime={anime} />
            ))}
          </div>
        </section>

        {/* 6. ОНГОИНГИ */}
        <section id="ongoing" className="mb-8 sm:mb-16">
          <div className="flex items-center justify-between mb-4 sm:mb-6">
             <div className="flex items-center gap-2 sm:gap-3">
                <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2 sm:gap-3">
                  <Play className="w-6 h-6 sm:w-7 sm:h-7 text-green-400" />
                  Онгоинги</h2>
                <span className="px-2 py-0.5 bg-green-500/10 text-green-500 text-[10px] sm:text-xs font-bold rounded uppercase tracking-wider hidden sm:inline-block">Now</span>
             </div>
             {/* КНОПКА: Нейтральная, стиль кнопки */}
             <Link 
               href="/catalog?status=ongoing" 
               className="flex items-center gap-1 sm:gap-2 bg-zinc-800/50 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-white/5 hover:border-white/10 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-medium transition-colors whitespace-nowrap"
             >
                Весь список <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4" />
             </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
            {ongoingAnime.map((anime) => (
              <AnimeCard key={anime.id} anime={anime} />
            ))}
          </div>
        </section>

        {/* 7. ПОПУЛЯРНЫЕ ВСЕГДА */}
        <section id="legendary" className="mb-10 sm:mb-16">
          <div className="flex items-center justify-between mb-4 sm:mb-6">
            <div>
              <h2 className="text-xl sm:text-3xl font-bold text-white mb-0.5 sm:mb-1 flex items-center gap-2 sm:gap-3">
                <Star className="w-6 h-6 sm:w-7 sm:h-7 text-yellow-400" />
                Легендарное</h2>
              <p className="text-zinc-500 text-xs sm:text-sm">Шедевры аниме</p>
            </div>
            {/* КНОПКА: Оранжевая, стиль кнопки */}
            <Link 
              href="/catalog?sort=popular" 
              className="flex items-center gap-1 sm:gap-2 bg-orange-500/10 hover:bg-orange-500/20 text-orange-500 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-bold transition-colors whitespace-nowrap"
            >
                Показать все <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4" />
            </Link>
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-x-4 gap-y-6 sm:gap-y-8">
            {popularAlways.map((anime) => (
              <AnimeCard key={anime.id} anime={anime} />
            ))}
          </div>
        </section>
        
        <Footer />
      </div>
    </main>
  )
}