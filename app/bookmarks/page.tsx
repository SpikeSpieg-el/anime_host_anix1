"use client"

import { useMemo } from "react"
import { AnimeCard } from "@/components/anime-card"
import { useBookmarks } from "@/components/bookmarks-provider"
import { useEpisodeUpdates } from "@/hooks/use-episode-updates"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import Link from "next/link"
import { Bookmark, ArrowLeft } from "lucide-react"

export default function BookmarksPage() {
  const { items } = useBookmarks()
  const { updates } = useEpisodeUpdates()

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

  return (
    <main className="min-h-screen bg-background text-foreground pb-20 md:pb-24">
      <Navbar />

      <div className="container mx-auto px-4 pt-8 pb-12">
        <div className="mb-8">
          <Link href="/" className="inline-flex items-center gap-2 px-4 py-2 bg-secondary hover:bg-accent border border-border hover:border-primary text-muted-foreground hover:text-foreground font-medium rounded-xl transition-all mb-4 dark:bg-zinc-800 dark:hover:bg-zinc-800 dark:border-zinc-800 dark:hover:border-orange-500 dark:text-zinc-400 dark:hover:text-white">
            <ArrowLeft className="w-4 h-4" />
            На главную
          </Link>
          <div className="flex items-center gap-3">
            <Bookmark size={28} className="text-orange-500" />
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold text-foreground dark:text-white">Сохранённое</h1>
              <p className="text-muted-foreground mt-1 dark:text-zinc-500">
                {items.length} {items.length === 1 ? 'аниме' : items.length < 5 ? 'аниме' : 'аниме'} в закладках
              </p>
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
            {items.map((anime) => (
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
