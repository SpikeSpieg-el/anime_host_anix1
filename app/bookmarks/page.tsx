"use client"

import { useMemo, useState } from "react"
import { AnimeCard } from "@/components/shared/anime-card"
import { useBookmarks } from "@/components/providers/bookmarks-provider"
import { useEpisodeUpdates } from "@/hooks/use-episode-updates"
import { Navbar } from "@/components/layout/navbar"
import { Footer } from "@/components/layout/footer"
import Link from "next/link"
import { Bookmark, ArrowLeft, ArrowUpDown } from "lucide-react"
import { ScrollToTop } from "@/components/layout/scroll-to-top"
import { BookmarksSkeleton } from "@/components/shared/skeleton"

export default function BookmarksPage() {
  const { items, isLoading } = useBookmarks()
  const { updates } = useEpisodeUpdates()
  const [sortBy, setSortBy] = useState<'newest' | 'oldest'>('newest')

  // Helper function to get update info for an anime
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

  // Sort items by date added
  const sortedItems = useMemo(() => {
    const itemsWithDate = items.map(item => ({
      ...item,
      sortDate: item.created_at || new Date(0).toISOString()
    }))
    
    return [...itemsWithDate].sort((a, b) => {
      const dateA = new Date(a.sortDate).getTime()
      const dateB = new Date(b.sortDate).getTime()
      // 'newest' = новые первые (большая дата первая)
      // 'oldest' = старые первые (меньшая дата первая)
      return sortBy === 'newest' ? dateB - dateA : dateA - dateB
    })
  }, [items, sortBy])


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
          <BookmarksSkeleton items={12} />
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
              <Bookmark size={28} className="text-orange-500" />
              <div>
                <h1 className="text-3xl sm:text-4xl font-bold text-foreground dark:text-white">Сохранённое</h1>
                <p className="text-muted-foreground mt-1 dark:text-zinc-500">
                  {items.length} {items.length === 1 ? 'аниме' : items.length < 5 ? 'аниме' : 'аниме'} в закладках
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSortBy(sortBy === 'newest' ? 'oldest' : 'newest')}
                className="inline-flex items-center gap-2 px-3 py-2 bg-secondary hover:bg-accent border border-border hover:border-primary text-muted-foreground hover:text-foreground font-medium rounded-xl transition-all dark:bg-zinc-800 dark:hover:bg-zinc-800 dark:border-zinc-800 dark:hover:border-orange-500 dark:text-zinc-400 dark:hover:text-white"
                title={sortBy === 'newest' ? 'Сначала новые' : 'Сначала старые'}
              >
                <ArrowUpDown className="w-4 h-4" />
                {sortBy === 'newest' ? 'Новые' : 'Старые'}
              </button>
            </div>
          </div>
          
        </div>

        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Bookmark size={64} className="text-muted-foreground/50 mb-4 dark:text-zinc-800" />
            <h2 className="text-xl font-bold text-muted-foreground mb-2 dark:text-zinc-400">Закладки пусты</h2>
            <p className="text-muted-foreground/70 mb-6 dark:text-zinc-600">Сохраняйте аниме, чтобы не потерять их</p>
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
            {sortedItems.map((anime) => (
              <AnimeCard 
                key={anime.id}
                anime={anime} 
                showUpdateBadge={!!getUpdateInfo(anime.id)}
                updateInfo={getUpdateInfo(anime.id)}
              />
            ))}
          </div>
        )}
      </div>

      <Footer />
    </main>
  )
}
