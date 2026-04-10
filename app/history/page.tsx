"use client"

import { useEffect, useState, useMemo } from "react"
import Link from "next/link"
import Image from "next/image"
import { Clock, History, Trash2, ArrowLeft, Archive, Filter, X } from "lucide-react"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { useEpisodeUpdates } from "@/hooks/use-episode-updates"
import { useHistory } from "@/components/history-provider"
import { ScrollToTop } from "@/components/scroll-to-top"
import { HistorySkeleton } from "@/components/skeleton"

function normalizePosterUrl(value: string): string {
  const raw = (value ?? "").trim()
  if (!raw) return raw

  if (raw.startsWith("https//")) return `https://${raw.slice("https//".length)}`
  if (raw.startsWith("http//")) return `http://${raw.slice("http//".length)}`

  if (raw.startsWith("https://shikimori.onehttps//")) {
    return `https://${raw.slice("https://shikimori.onehttps//".length)}`
  }
  if (raw.startsWith("https://shikimori.onehttp//")) {
    return `http://${raw.slice("https://shikimori.onehttp//".length)}`
  }

  return raw
}

export default function HistoryPage() {
  const { items: historyItems, clear, isLoading, toggleArchived } = useHistory()
  const history = historyItems.map((item: any) => ({
    ...item,
    poster: normalizePosterUrl(item?.poster)
  }))
  const [mounted, setMounted] = useState(false)
  const { updates } = useEpisodeUpdates()
  const [showArchivedOnly, setShowArchivedOnly] = useState(false)
  const [showArchiveFilter, setShowArchiveFilter] = useState(false)

  // Filter items based on archive status
  const filteredHistory = useMemo(() => {
    if (!showArchivedOnly) return history
    return history.filter(item => item.is_archived)
  }, [history, showArchivedOnly])

  const archivedCount = history.filter(item => item.is_archived).length

  // Helper function to get update info for an anime
  const getUpdateInfo = (animeId: string) => {
    const update = updates.find(u => u.animeId === animeId)
    if (!update) return undefined

    const historyItem = history.find(h => h.id === animeId)
    if (!historyItem) return undefined

    return {
      newEpisode: update.newEpisode,
      totalEpisodes: update.totalEpisodes
    }
  }

  const handleToggleArchived = (animeId: string) => {
    toggleArchived(animeId)
  }

  useEffect(() => {
    setMounted(true)
  }, [])

  const clearHistory = () => {
    if (confirm("Вы уверены, что хотите очистить всю историю просмотров?")) {
      clear()
    }
  }

  if (!mounted) return null

  if (isLoading) {
    return (
      <main className="min-h-screen bg-background text-foreground pb-20 md:pb-24 relative">
        {/* Dot Pattern Background */}
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
          <HistorySkeleton items={12} />
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-background text-foreground pb-20 md:pb-24 relative">
      {/* Dot Pattern Background */}
      <div className="absolute inset-0 z-0 pointer-events-none opacity-[0.07]">
        <div className="absolute inset-0 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:20px_20px]" />
      </div>

      <Navbar />

      <div className="container mx-auto px-4 pt-8 pb-12 relative z-10">
        <div className="mb-8">
          <Link href="/" className="inline-flex items-center gap-2 px-4 py-2 bg-secondary hover:bg-accent border border-border hover:border-primary text-muted-foreground hover:text-foreground font-medium rounded-xl transition-all mb-4 dark:bg-zinc-800 dark:hover:bg-zinc-800 dark:border-zinc-800 dark:hover:border-orange-500 dark:text-zinc-400 dark:hover:text-white">
            <ArrowLeft className="w-4 h-4" />
            На главную
          </Link>
          <div className="flex items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <History size={28} className="text-orange-500" />
              <div>
                <h1 className="text-3xl sm:text-4xl font-bold text-foreground dark:text-white">История просмотров</h1>
                <p className="text-muted-foreground mt-1 dark:text-zinc-500">
                  {history.length} {history.length === 1 ? 'аниме' : history.length < 5 ? 'аниме' : 'аниме'} в истории
                  {archivedCount > 0 && ` (${archivedCount} в архиве)`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {history.length > 0 && (
                <button
                  onClick={clearHistory}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-secondary hover:bg-destructive/50 border border-border hover:border-destructive text-muted-foreground hover:text-foreground font-medium rounded-xl transition-all dark:bg-zinc-900 dark:hover:bg-red-900/50 dark:border-zinc-800 dark:hover:border-red-500 dark:text-zinc-400 dark:hover:text-white"
                >
                  <Trash2 className="w-4 h-4" />
                  Очистить
                </button>
              )}
              <button
                onClick={() => setShowArchiveFilter(!showArchiveFilter)}
                className="inline-flex items-center gap-2 px-3 py-2 bg-secondary hover:bg-accent border border-border hover:border-primary text-muted-foreground hover:text-foreground font-medium rounded-xl transition-all dark:bg-zinc-800 dark:hover:bg-zinc-800 dark:border-zinc-800 dark:hover:border-orange-500 dark:text-zinc-400 dark:hover:text-white"
              >
                <Filter className="w-4 h-4" />
                Фильтр
              </button>
            </div>
          </div>
          
          {showArchiveFilter && (
            <div className="mb-6 p-4 bg-secondary/50 border border-border rounded-xl dark:bg-zinc-800/50 dark:border-zinc-700">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium text-foreground dark:text-white">Фильтр архива</h3>
                <button
                  onClick={() => setShowArchiveFilter(false)}
                  className="text-muted-foreground hover:text-foreground dark:text-zinc-400 dark:hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowArchivedOnly(false)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    !showArchivedOnly
                      ? 'bg-orange-500 text-black'
                      : 'bg-secondary hover:bg-accent text-muted-foreground hover:text-foreground dark:bg-zinc-700 dark:hover:bg-zinc-600 dark:text-zinc-300 dark:hover:text-white'
                  }`}
                >
                  Активные ({history.length - archivedCount})
                </button>
                <button
                  onClick={() => setShowArchivedOnly(true)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    showArchivedOnly
                      ? 'bg-orange-500 text-black'
                      : 'bg-secondary hover:bg-accent text-muted-foreground hover:text-foreground dark:bg-zinc-700 dark:hover:bg-zinc-600 dark:text-zinc-300 dark:hover:text-white'
                  }`}
                >
                  В архиве ({archivedCount})
                </button>
              </div>
            </div>
          )}
        </div>

        {history.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <History size={64} className="text-muted-foreground/50 mb-4 dark:text-zinc-800" />
            <h2 className="text-xl font-bold text-muted-foreground mb-2 dark:text-zinc-400">История пуста</h2>
            <p className="text-muted-foreground/70 mb-6 dark:text-zinc-600">Начните смотреть аниме, чтобы оно появилось здесь</p>
            <Link
              href="/catalog"
              className="inline-flex items-center gap-2 px-6 py-3 bg-secondary hover:bg-accent border border-border hover:border-primary text-foreground font-medium rounded-xl transition-all dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:border-zinc-800 dark:hover:border-orange-500 dark:text-white"
            >
              Перейти в каталог
              <ArrowLeft className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-3 sm:gap-x-4 gap-y-6 sm:gap-y-8">
          {filteredHistory.map((item: any) => {
            const total = item?.episodesTotal && item.episodesTotal > 0 ? item.episodesTotal : null
            const progress = item?.episode && total ? Math.min(item.episode / total, 1) : null
            const updateInfo = getUpdateInfo(item.id)
            const isCompleted = total && item.episode && item.episode >= total
            return (
              <div key={item.id} className="relative group">
                <Link
                  href={item.episode ? `/watch/${item.id}?episode=${item.episode}` : `/watch/${item.id}`}
                  className="block"
                >
                  <div className="relative aspect-[16/9] md:aspect-[2/3] overflow-hidden rounded-lg bg-secondary border border-border dark:bg-zinc-900 dark:border-zinc-800">
                    <Image
                      src={item.poster}
                      alt={item.title}
                      fill
                      className={`object-cover transition-transform duration-300 group-hover:scale-105 ${
                        item.is_archived ? 'opacity-60' : 'opacity-80 group-hover:opacity-100'
                      }`}
                    />
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-border overflow-hidden dark:bg-zinc-800">
                      {progress !== null && (
                        <div
                          className={`h-full transition-all duration-300 ${
                            isCompleted ? 'bg-green-500' : 'bg-orange-600'
                          }`}
                          style={{ width: `${(progress * 100).toFixed(0)}%` }}
                        />
                      )}
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="bg-orange-600 p-2 rounded-full shadow-lg">
                        <Clock size={16} className="text-white" fill="currentColor" />
                      </div>
                    </div>
                    
                    {/* New episode badge */}
                    {updateInfo && !item.is_archived && (
                      <div className="absolute top-2 right-2">
                        <span className="bg-orange-500 text-black text-[10px] font-bold px-1.5 py-0.5 rounded shadow-sm animate-pulse block">
                          новых серий + {updateInfo.newEpisode - (item.episode || 0)}
                        </span>
                      </div>
                    )}
                    
                    {/* Archive badge */}
                    {item.is_archived && (
                      <div className="absolute top-2 right-2">
                        <span className="bg-gray-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow-sm block">
                          В архиве
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="mt-2">
                    <h3 className={`text-xs font-bold truncate group-hover:text-foreground dark:text-zinc-300 dark:group-hover:text-white ${
                      item.is_archived ? 'text-muted-foreground/50 dark:text-zinc-600' : 'text-muted-foreground'
                    }`}>{item.title}</h3>
                    <p className={`text-[10px] dark:text-zinc-500 ${
                      item.is_archived ? 'text-muted-foreground/50 dark:text-zinc-600' : 'text-muted-foreground/70'
                    }`}>
                      {item.episode
                        ? `Stopped at episode ${item.episode}${total ? ` / ${total}` : ""}`
                        : "Continue"}
                    </p>
                  </div>
                </Link>
                <button
                  onClick={() => handleToggleArchived(item.id)}
                  className={`absolute top-2 left-2 p-1.5 rounded-full shadow-lg transition-all opacity-0 group-hover:opacity-100 ${
                    item.is_archived
                      ? 'bg-orange-500 text-black'
                      : 'bg-secondary/80 text-muted-foreground hover:bg-primary hover:text-white dark:bg-zinc-800/80 dark:text-zinc-300 dark:hover:bg-orange-500 dark:hover:text-black'
                  }`}
                  title={item.is_archived ? 'Вернуть из архива' : 'Переместить в архив'}
                >
                  <Archive className="w-3 h-3" />
                </button>
              </div>
            )
          })}
          </div>
        )}
      </div>

      <ScrollToTop />
      <Footer />
    </main>
  )
}
