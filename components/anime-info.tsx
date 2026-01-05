"use client"

import { Calendar, Globe, Tv, Film, Star, Download } from "lucide-react"
import type { Anime } from "@/lib/anime-data"

interface AnimeInfoProps {
  anime: Anime
}

export function AnimeInfo({ anime }: AnimeInfoProps) {
  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h1 className="text-3xl font-bold text-white">{anime.title}</h1>
        <p className="text-lg text-zinc-500">{anime.originalTitle}</p>
      </div>

      {/* Tech Specs */}
      <div className="flex flex-wrap gap-4">
        <div className="flex items-center gap-2 text-sm text-zinc-400">
          <Film className="h-4 w-4 text-orange-500" />
          <span>{anime.quality}</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-zinc-400">
          <Calendar className="h-4 w-4 text-orange-500" />
          <span>{anime.year}</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-zinc-400">
          <Globe className="h-4 w-4 text-orange-500" />
          <span>{anime.country}</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-zinc-400">
          <Tv className="h-4 w-4 text-orange-500" />
          <span>{anime.episodes.length} Episodes</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-zinc-400">
          <Star className="h-4 w-4 fill-amber-500 text-amber-500" />
          <span className="text-amber-500 font-medium">{anime.rating}</span>
        </div>
      </div>

      {/* Genres */}
      <div className="flex flex-wrap gap-2">
        {anime.genres.map((genre) => (
          <span key={genre} className="rounded-full bg-zinc-800 px-3 py-1 text-sm text-zinc-300">
            {genre}
          </span>
        ))}
      </div>

      {/* Synopsis */}
      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-white">Synopsis</h2>
        <p className="text-zinc-400 leading-relaxed">{anime.description}</p>
      </div>

      {/* Download Links (Mock) */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <Download className="h-5 w-5 text-orange-500" />
          Download
        </h2>
        <div className="flex flex-wrap gap-2">
          {anime.resolutions.map((resolution) => (
            <button
              key={resolution}
              className="flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800/50 px-4 py-2 text-sm font-medium text-zinc-300 hover:border-orange-500/50 hover:bg-orange-500/10 hover:text-orange-500 transition-colors"
            >
              <Download className="h-4 w-4" />
              {resolution} Magnet
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
