"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { History, Play } from "lucide-react"
import { animeData, type Anime } from "@/lib/anime-data"

interface ViewedItem {
  id: string
  timestamp: number
}

export function RecentlyViewed() {
  const [recentAnime, setRecentAnime] = useState<Anime[]>([])

  useEffect(() => {
    const stored = localStorage.getItem("recentlyViewed")
    if (stored) {
      const viewedItems: ViewedItem[] = JSON.parse(stored)
      const recent = viewedItems
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 3)
        .map((item) => animeData.find((anime) => anime.id === item.id))
        .filter(Boolean) as Anime[]
      setRecentAnime(recent)
    }
  }, [])

  if (recentAnime.length === 0) {
    return null
  }

  return (
    <section className="mt-12">
      <div className="flex items-center gap-2 mb-6">
        <History className="h-5 w-5 text-orange-500" />
        <h2 className="text-xl font-semibold text-white">Recently Viewed</h2>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {recentAnime.map((anime) => (
          <Link
            key={anime.id}
            href={`/watch/${anime.id}`}
            className="group flex gap-4 rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 hover:border-zinc-700 transition-colors"
          >
            <div className="relative h-24 w-16 flex-shrink-0 overflow-hidden rounded">
              <Image src={anime.poster || "/placeholder.svg"} alt={anime.title} fill className="object-cover" />
            </div>
            <div className="flex flex-col justify-center">
              <h3 className="text-sm font-medium text-white group-hover:text-orange-500 transition-colors line-clamp-2">
                {anime.title}
              </h3>
              <p className="text-xs text-zinc-500 mt-1">
                {anime.year} • {anime.episodes.length} ep
              </p>
              <span className="mt-2 inline-flex items-center gap-1 text-xs text-orange-500">
                <Play className="h-3 w-3 fill-orange-500" />
                Continue
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}
