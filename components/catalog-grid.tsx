"use client"

import { AnimeCard } from "./anime-card"
import type { Anime } from "@/lib/shikimori"

interface CatalogGridProps {
  anime: Anime[]
}

export function CatalogGrid({ anime }: CatalogGridProps) {
  if (anime.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-lg text-zinc-500">No anime found matching your filters.</p>
        <p className="text-sm text-zinc-600">Try adjusting your search criteria.</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7">
      {anime.map((item) => (
        <AnimeCard key={item.id} anime={item} />
      ))}
    </div>
  )
}
