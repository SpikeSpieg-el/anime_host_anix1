"use client"

import { useMemo, useState } from "react"
import { AnimeCard } from "@/components/shared/anime-card"
import { useBookmarks } from "@/components/providers/bookmarks-provider"
import { useEpisodeUpdates } from "@/hooks/use-episode-updates"
import { Navbar } from "@/components/layout/navbar"
import { Footer } from "@/components/layout/footer"
import Link from "next/link"
import { Bookmark, ArrowLeft, ArrowUpDown, Search, X, LayoutGrid, Grid3x3, Table } from "lucide-react"
import { ScrollToTop } from "@/components/layout/scroll-to-top"
import { BookmarksSkeleton } from "@/components/shared/skeleton"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

export default function BookmarksPage() {
  const { items, isLoading } = useBookmarks()
  const { updates } = useEpisodeUpdates()
  
  // Состояния режимов и фильтрации
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'score'>('newest')
  const [viewMode, setViewMode] = useState<'comfortable' | 'compact' | 'table'>('comfortable')
  const [searchQuery, setSearchQuery] = useState('')

  // Функция получения инфо об обновлениях серий
  const getUpdateInfo = (animeId: string) => {
    const update = updates.find(u => u.animeId === animeId)
    if (!update) return undefined

    const anime = items.find(a => a.id === animeId)
    if (!anime) return undefined

    return {
      newEpisode: update.newEpisode,
      totalEpisodes: update.totalEpisodes
    }
  }

  // Сортировка и поиск закладок
  const sortedAndFilteredItems = useMemo(() => {
    // 1. Поиск по названию
    const filtered = items.filter(item => {
      if (!searchQuery.trim()) return true
      const query = searchQuery.toLowerCase().trim()
      const title = item.title?.toLowerCase() || ''
      const russian = (item as any).russian?.toLowerCase() || ''
      return title.includes(query) || russian.includes(query)
    })

    // 2. Сортировка
    const itemsWithDate = filtered.map(item => ({
      ...item,
      sortDate: item.created_at || new Date(0).toISOString()
    }))
    
    return [...itemsWithDate].sort((a, b) => {
      if (sortBy === 'score') {
        const scoreA = Number((a as any).score ?? a.rating) || 0
        const scoreB = Number((b as any).score ?? b.rating) || 0
        return scoreB - scoreA
      }

      const dateA = new Date(a.sortDate).getTime()
      const dateB = new Date(b.sortDate).getTime()
      return sortBy === 'newest' ? dateB - dateA : dateA - dateB
    })
  }, [items, sortBy, searchQuery])

  if (isLoading) {
    return (
      <main className="min-h-screen bg-background text-foreground pb-20 md:pb-24 relative">
        <div className="absolute inset-0 z-0 pointer-events-none opacity-[0.07]">
          <div className="absolute inset-0 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:20px_20px]" />
        </div>

        <Navbar />
        <div className="container mx-auto px-4 pt-8 pb-12 relative z-10">
          <div className="mb-8">
            <div className="h-10 w-32 skeleton rounded-xl mb-4" />
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 skeleton rounded-full" />
              <div className="space-y-2">
                <div className="h-8 w-48 skeleton rounded" />
                <div className="h-4 w-64 skeleton rounded" />
              </div>
            </div>
          </div>
          <BookmarksSkeleton items={12} />
        </div>
      </main>
    )
  }

  const gridClass = viewMode === 'compact' 
    ? "grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-2 sm:gap-3"
    : viewMode === 'table'
    ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4"
    : "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-x-4 gap-y-6 sm:gap-y-8"

  return (
    <main className="min-h-screen bg-background text-foreground pb-20 md:pb-24 relative">
      <div className="absolute inset-0 z-0 pointer-events-none opacity-[0.07]">
        <div className="absolute inset-0 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:20px_20px]" />
      </div>

      <Navbar />

      <div className="container mx-auto px-3 sm:px-4 pt-6 sm:pt-8 pb-12 relative z-10 max-w-7xl">
        
        {/* Кнопка Назад */}
        <div className="mb-6">
          <Link 
            href="/" 
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-secondary hover:bg-accent border border-border hover:border-primary text-muted-foreground hover:text-foreground font-medium rounded-xl transition-all dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:border-zinc-800 dark:hover:border-orange-500 dark:text-zinc-400 dark:hover:text-white text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            На главную
          </Link>
        </div>

        {/* Шапка страницы */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-orange-500/10 border border-orange-500/20 rounded-2xl dark:bg-orange-500/10">
              <Bookmark size={26} className="text-orange-500" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground dark:text-white">Сохранённое</h1>
              <p className="text-xs sm:text-sm text-muted-foreground dark:text-zinc-400 mt-0.5">
                {items.length} {items.length === 1 ? 'аниме' : 'тайтлов'} в закладах
              </p>
            </div>
          </div>
        </div>

        {/* ПАНЕЛЬ ИНСТРУМЕНТОВ: Поиск + Сортировка + Вид просмотра */}
        {items.length > 0 && (
          <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between mb-6 bg-secondary/40 p-2 sm:p-2.5 rounded-2xl border border-border dark:bg-zinc-900/60 dark:border-zinc-800/80 backdrop-blur-sm">
            
            {/* Поиск по закладкам */}
            <div className="relative flex-1 md:max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Поиск по сохранённым..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-10 pl-9 pr-8 text-xs sm:text-sm bg-background border-border dark:bg-zinc-950 dark:border-zinc-800 rounded-xl"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Сортировка и Режимы отображения */}
            <div className="flex items-center gap-2 justify-between md:justify-end">
              
              {/* Кнопка сортировки */}
              <button
                onClick={() => {
                  if (sortBy === 'newest') setSortBy('oldest')
                  else if (sortBy === 'oldest') setSortBy('score')
                  else setSortBy('newest')
                }}
                className="inline-flex items-center gap-2 px-3 py-2 bg-background/80 hover:bg-secondary border border-border hover:border-primary text-muted-foreground hover:text-foreground font-medium rounded-xl transition-all text-xs sm:text-sm dark:bg-zinc-950/80 dark:border-zinc-800 dark:hover:bg-zinc-800 dark:text-zinc-300 dark:hover:text-white"
              >
                <ArrowUpDown className="w-3.5 h-3.5 text-orange-500" />
                <span>
                  {sortBy === 'newest' ? 'Сначала новые' : sortBy === 'oldest' ? 'Сначала старые' : 'По рейтингу'}
                </span>
              </button>

              {/* Переключатель 3 видов просмотра */}
              <div className="flex items-center gap-1 bg-background/80 rounded-xl p-1 border border-border dark:bg-zinc-950/80 dark:border-zinc-800 flex-shrink-0">
                <button
                  onClick={() => setViewMode('comfortable')}
                  title="Комфортная сетка"
                  className={cn(
                    "p-1.5 rounded-lg transition-all",
                    viewMode === 'comfortable' 
                      ? "bg-secondary text-foreground shadow-sm dark:bg-zinc-800 dark:text-white" 
                      : "text-muted-foreground hover:text-foreground dark:text-zinc-500 dark:hover:text-zinc-300"
                  )}
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('compact')}
                  title="Компактная сетка"
                  className={cn(
                    "p-1.5 rounded-lg transition-all",
                    viewMode === 'compact' 
                      ? "bg-secondary text-foreground shadow-sm dark:bg-zinc-800 dark:text-white" 
                      : "text-muted-foreground hover:text-foreground dark:text-zinc-500 dark:hover:text-zinc-300"
                  )}
                >
                  <Grid3x3 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('table')}
                  title="Список"
                  className={cn(
                    "p-1.5 rounded-lg transition-all",
                    viewMode === 'table' 
                      ? "bg-secondary text-foreground shadow-sm dark:bg-zinc-800 dark:text-white" 
                      : "text-muted-foreground hover:text-foreground dark:text-zinc-500 dark:hover:text-zinc-300"
                  )}
                >
                  <Table className="w-4 h-4" />
                </button>
              </div>

            </div>
          </div>
        )}

        {/* Пустое состояние */}
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="p-4 bg-secondary/50 rounded-full mb-4 dark:bg-zinc-900 border border-border dark:border-zinc-800">
              <Bookmark size={48} className="text-muted-foreground/60 dark:text-zinc-600" />
            </div>
            <h2 className="text-xl font-bold text-foreground mb-2 dark:text-zinc-300">Закладки пусты</h2>
            <p className="text-sm text-muted-foreground/80 mb-6 max-w-sm dark:text-zinc-500">
              Сохраняйте интересные аниме в закладки, чтобы быстро возвращаться к ним
            </p>
            <Link
              href="/catalog"
              className="inline-flex items-center gap-2 px-6 py-3 bg-orange-500 hover:bg-orange-600 text-black font-bold rounded-xl transition-all shadow-md"
            >
              Перейти в каталог
              <ArrowLeft className="w-4 h-4 rotate-180" />
            </Link>
          </div>
        ) : sortedAndFilteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center bg-secondary/20 rounded-2xl border border-dashed border-border dark:bg-zinc-900/20 dark:border-zinc-800">
            <Search className="w-10 h-10 text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground font-medium text-sm dark:text-zinc-400">Ничего не найдено</p>
            <p className="text-xs text-muted-foreground/60 mt-1 dark:text-zinc-600">Попробуйте изменить поисковый запрос</p>
          </div>
        ) : (
          /* СЕТКА КАРТОЧЕК */
          <div className={gridClass}>
            {sortedAndFilteredItems.map((anime) => (
              <AnimeCard 
                key={anime.id}
                anime={anime} 
                variant={viewMode === 'compact' ? 'compact' : viewMode === 'table' ? 'table' : 'default'}
                showUpdateBadge={!!getUpdateInfo(anime.id)}
                updateInfo={getUpdateInfo(anime.id)}
              />
            ))}
          </div>
        )}
      </div>

      <ScrollToTop />
      <Footer />
    </main>
  )
}