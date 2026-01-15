"use client"

import { useMemo } from "react"
import { AnimeCard } from "@/components/anime-card"
import { useBookmarks } from "@/components/bookmarks-provider"
import Link from "next/link"
import { ChevronRight } from "lucide-react"

export function BookmarksSection() {
  const { items } = useBookmarks()

  const displayList = useMemo(() => items.slice(0, 6), [items])
  const hasMore = items.length > 6

  if (items.length === 0) return null

  return (
    <section className="mb-16">
      <div className="flex items-end justify-between mb-6">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-1">Сохранённое</h2>
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
        {displayList.map((anime) => (
          <AnimeCard key={anime.id} anime={anime} />
        ))}
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
