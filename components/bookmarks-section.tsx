"use client"

import { useMemo, useEffect } from "react"
import { AnimeCard } from "@/components/anime-card"
import { useBookmarks } from "@/components/bookmarks-provider"
import { useEpisodeUpdates } from "@/hooks/use-episode-updates"
import { EpisodeUpdateBadge } from "@/components/episode-update-badge"
import Link from "next/link"
import { ChevronRight, Bookmark } from "lucide-react"

export function BookmarksSection() {
  const { items } = useBookmarks()
  const { updates, checkAnimeUpdates, clearUpdate, clearAllUpdates, mounted } = useEpisodeUpdates()

  const displayList = useMemo(() => items.slice(0, 6), [items])
  const hasMore = items.length > 6

  // Check for episode updates when bookmarks change
  useEffect(() => {
    if (mounted && items.length > 0) {
      checkAnimeUpdates(items)
    }
  }, [mounted, items, checkAnimeUpdates])

  if (items.length === 0) return null

  return (
    <section className="mb-16">
      <div className="flex items-end justify-between mb-6">
        <div>
          <div className="flex items-center gap-2">
            <Bookmark className="w-6 h-6 text-orange-500" />
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-1">Сохранённое</h2>
          </div>
          <p className="text-zinc-500 text-sm">Закладки: что посмотреть позже</p>
        </div>
        {hasMore && (
          <Link 
            href="/bookmarks" 
            className="text-orange-500 text-sm font-medium hover:text-orange-400 transition flex items-center gap-1"
          >
            Все {items.length} <ChevronRight className="w-4 h-4" />
          </Link>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-3 sm:gap-x-4 gap-y-6 sm:gap-y-8">
        {displayList.map((anime) => {
          const update = updates.find(u => u.animeId === anime.id)
          return (
            <div key={anime.id} className="relative">
              <AnimeCard anime={anime} />
              {update && (
                <div className="absolute top-1 right-1 z-10 bg-orange-500 text-black text-[8px] font-bold px-1.5 py-0.5 rounded-full shadow-lg animate-pulse">
                  Новая серия
                </div>
              )}
            </div>
          )
        })}
      </div>

      {hasMore && (
        <div className="mt-6 text-center sm:text-left">
          <Link 
            href="/bookmarks"
            className="inline-flex items-center gap-2 px-6 py-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-orange-500 text-white font-medium rounded-xl transition-all"
          >
            Показать все {items.length} сохранённых
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      )}
    </section>
  )
}
