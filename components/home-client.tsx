'use client'

import { AnimeCard } from '@/components/anime-card'
import { UserHistory } from '@/components/user-history'
import { BookmarksSection } from '@/components/bookmarks-section'
import { AiAdvisor } from '@/components/ai-advisor'
import { UpdatesBanner } from '@/components/updates-banner'
import { Footer } from '@/components/footer'
import type { Anime } from '@/lib/shikimori'
import Link from "next/link"
import { MessageSquare, User, ExternalLink, ChevronRight, Newspaper, TrendingUp, Play, Star } from "lucide-react"

interface HomePageClientProps {
  initialData: {
    popularNow: Anime[]
    popularAlways: Anime[]
    ongoingAnime: Anime[]
    newsUpdates: any[]
    announcements: any[]
  }
}

export function HomePageClient({ initialData }: HomePageClientProps) {
  return (
    <main className="min-h-screen bg-background text-foreground pb-20 md:pb-24 overflow-x-hidden selection:bg-primary/30 dark:bg-zinc-950 dark:text-white dark:selection:bg-orange-500/30">
      <div className="container mx-auto px-3 sm:px-4 relative z-10">
        
        {/* Demo Button for Testing 
        <EpisodeUpdateDemo />*/}
        
        {/* AiAdvisor 
        <section id="ai-advisor" className="mb-12 md:mb-16 flex justify-center md:justify-start w-full">
           <AiAdvisor />
        </section>*/}

        {/* 2. ИСТОРИЯ И ЗАКЛАДКИ */}
        <section id="history-bookmarks" className="space-y-10 md:space-y-12 mb-14 md:mb-16">
          <UserHistory />
          <BookmarksSection />
        </section>

        {/* 3. ЛЕНТА ОБНОВЛЕНИЙ */}
        <UpdatesBanner updates={initialData.ongoingAnime} announcements={initialData.announcements} />

        {/* 4. НОВОСТИ И ОБНОВЛЕНИЯ */}
        {initialData.newsUpdates.length > 0 && (
            <section id="news" className="mb-14 sm:mb-20">
                <div className="flex flex-row items-center justify-between mb-4 sm:mb-6">
                    <div>
                        <h2 className="text-xl sm:text-3xl font-bold text-foreground mb-1 flex items-center gap-2 sm:gap-3 dark:text-white">
                            <Newspaper className="w-6 h-6 sm:w-7 sm:h-7 text-blue-400" />
                            Новости
                            <span className="hidden sm:inline-block px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 text-xs font-bold border border-blue-500/20 uppercase tracking-wider">
                                News
                            </span>
                        </h2>
                        <p className="text-muted-foreground text-xs sm:text-sm hidden xs:block dark:text-zinc-500">Главные события мира аниме</p>
                    </div>
                    
                    <Link 
                      href="https://shikimori.one/forum/news" 
                      target="_blank" 
                      className="group flex items-center gap-2 bg-secondary hover:bg-accent text-muted-foreground hover:text-accent-foreground px-3 sm:px-4 py-2 rounded-full text-xs sm:text-sm font-medium transition-colors dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-200"
                    >
                        <span>Все новости</span>
                        <ExternalLink className="w-3 h-3 sm:w-4 sm:h-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                    </Link>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
                    {initialData.newsUpdates.map((news) => (
                        <a 
                           key={news.id} 
                           href={news.url} 
                           target="_blank" 
                           rel="noopener noreferrer" 
                           className="group flex flex-col h-full bg-secondary/40 border rounded-xl sm:rounded-2xl p-4 sm:p-5 hover:border-accent transition-all hover:bg-secondary active:scale-[0.98] sm:hover:-translate-y-1 hover:shadow-xl hover:shadow-black/50 dark:bg-zinc-900/40 dark:border-zinc-800 dark:hover:border-zinc-600 dark:hover:bg-zinc-900"
                        >
                            <div className="flex items-center justify-between mb-2 sm:mb-3">
                                <span className="text-[10px] sm:text-xs font-medium text-muted-foreground bg-secondary/50 px-2 py-1 rounded-md dark:text-zinc-500 dark:bg-zinc-800/50">
                                    {news.date}
                                </span>
                            </div>

                            <h3 className="font-bold text-sm sm:text-base text-foreground leading-snug mb-2 group-hover:text-primary transition-colors line-clamp-2 sm:line-clamp-3 dark:text-zinc-100 dark:group-hover:text-blue-400">
                                {news.title}
                            </h3>
                            
                            <p className="text-xs sm:text-sm text-muted-foreground line-clamp-3 mb-3 sm:mb-4 flex-1 leading-relaxed dark:text-zinc-400">
                                {news.excerpt.replace(/\[.*?\]/g, "")}
                            </p>

                            <div className="flex items-center justify-between pt-3 sm:pt-4 border-t mt-auto dark:border-white/5">
                                <div className="flex items-center gap-2 text-[10px] sm:text-xs text-muted-foreground dark:text-zinc-500">
                                    <User className="w-3 h-3" />
                                    <span className="truncate max-w-[100px]">{news.author}</span>
                                </div>
                                <div className="flex items-center gap-1.5 text-[10px] sm:text-xs font-medium text-muted-foreground bg-secondary/50 px-2 py-1 rounded-md group-hover:bg-accent group-hover:text-accent-foreground transition-colors dark:text-zinc-400 dark:bg-zinc-800/50 dark:group-hover:bg-zinc-800 dark:group-hover:text-white">
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
        <section id="popular" className="mb-12 sm:mb-20">
          <div className="flex items-center justify-between mb-4 sm:mb-6">
            <div>
              <h2 className="text-xl sm:text-3xl font-bold text-foreground mb-0.5 sm:mb-1 flex items-center gap-2 sm:gap-3 dark:text-white">
                <TrendingUp className="w-6 h-6 sm:w-7 sm:h-7 text-orange-400" />
                Популярное</h2>
              <p className="text-muted-foreground text-xs sm:text-sm dark:text-zinc-500">Хиты сезона</p>
            </div>
            <Link 
              href="/catalog?sort=popular&status=ongoing" 
              className="flex items-center gap-1 sm:gap-2 bg-orange-500/10 hover:bg-orange-500/20 text-orange-500 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-bold transition-colors whitespace-nowrap"
            >
                Показать все <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4" />
            </Link>
          </div>

          {/* === MOBILE VIEW (< 640px): Список в 2 колонки === */}
          <div className="grid grid-cols-2 gap-3 sm:hidden">
            {initialData.popularNow.slice(0, 12).map((anime) => (
              <AnimeCard key={anime.id} anime={anime} variant="table" />
            ))}
          </div>

          {/* === TABLET & DESKTOP VIEW (>= 640px): Сетка 3 колонки -> 5+ колонок === */}
          <div className="hidden sm:grid sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-x-4 gap-y-6 sm:gap-y-8">
            {initialData.popularNow.slice(0, 12).map((anime) => (
              <AnimeCard key={anime.id} anime={anime} />
            ))}
          </div>
        </section>

        {/* 6. ОНГОИНГИ */}
        <section id="ongoing" className="mb-12 sm:mb-20">
          <div className="flex items-center justify-between mb-4 sm:mb-6">
             <div className="flex items-center gap-2 sm:gap-3">
                <h2 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2 sm:gap-3 dark:text-white">
                  <Play className="w-6 h-6 sm:w-7 sm:h-7 text-green-400" />
                  Онгоинги</h2>
                <span className="px-2 py-0.5 bg-green-500/10 text-green-500 text-[10px] sm:text-xs font-bold rounded uppercase tracking-wider hidden sm:inline-block">Now</span>
             </div>
             <Link 
               href="/catalog?status=ongoing" 
               className="flex items-center gap-1 sm:gap-2 bg-secondary/50 hover:bg-secondary text-muted-foreground hover:text-foreground border border-border hover:border-border/50 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-medium transition-colors whitespace-nowrap dark:bg-zinc-800/50 dark:hover:bg-zinc-800 dark:text-zinc-300 dark:hover:text-white dark:border-white/5 dark:hover:border-white/10"
             >
                Весь список <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4" />
             </Link>
          </div>

          {/* === MOBILE VIEW (< 640px): Список в 2 колонки === */}
          <div className="grid grid-cols-2 gap-3 sm:hidden">
            {initialData.ongoingAnime.map((anime) => (
              <AnimeCard key={anime.id} anime={anime} variant="table" />
            ))}
          </div>

          {/* === TABLET & DESKTOP VIEW (>= 640px): Сетка 3 колонки -> 6 колонок === */}
          <div className="hidden sm:grid sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
            {initialData.ongoingAnime.map((anime) => (
              <AnimeCard key={anime.id} anime={anime} />
            ))}
          </div>
        </section>

        {/* 7. ПОПУЛЯРНЫЕ ВСЕГДА */}
        <section id="legendary" className="mb-14 sm:mb-20">
          <div className="flex items-center justify-between mb-4 sm:mb-6">
            <div>
              <h2 className="text-xl sm:text-3xl font-bold text-foreground mb-0.5 sm:mb-1 flex items-center gap-2 sm:gap-3 dark:text-white">
                <Star className="w-6 h-6 sm:w-7 sm:h-7 text-yellow-400" />
                Легендарное</h2>
              <p className="text-muted-foreground text-xs sm:text-sm dark:text-zinc-500">Шедевры аниме</p>
            </div>
            <Link 
              href="/catalog?sort=popular" 
              className="flex items-center gap-1 sm:gap-2 bg-orange-500/10 hover:bg-orange-500/20 text-orange-500 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-bold transition-colors whitespace-nowrap"
            >
                Показать все <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4" />
            </Link>
          </div>
          
          {/* === MOBILE VIEW (< 640px): Список в 2 колонки === */}
          <div className="grid grid-cols-2 gap-3 sm:hidden">
            {initialData.popularAlways.map((anime) => (
              <AnimeCard key={anime.id} anime={anime} variant="table" />
            ))}
          </div>
          
          {/* === TABLET & DESKTOP VIEW (>= 640px): Сетка 3 колонки -> 5+ колонок === */}
          <div className="hidden sm:grid sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-x-4 gap-y-6 sm:gap-y-8">
            {initialData.popularAlways.map((anime) => (
              <AnimeCard key={anime.id} anime={anime} />
            ))}
          </div>
        </section>
        
        <Footer />
      </div>
    </main>
  )
}