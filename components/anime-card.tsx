"use client"

import Link from "next/link"
import Image from "next/image"
import { Play, Star } from "lucide-react"
import { Anime } from "@/lib/shikimori"

// Принимаем данные, которые вернул transformAnime
export function AnimeCard({ anime }: { anime: Anime }) {
  return (
    <Link href={`/watch/${anime.id}`} className="group relative block">
      <div className="relative aspect-[2/3] overflow-hidden rounded-lg bg-zinc-900">
        <Image
          src={anime.poster}
          alt={anime.title}
          fill
          className="object-cover transition-transform duration-300 group-hover:scale-105"
          // ВАЖНО: Shikimori иногда медленный, можно добавить unoptimized если картинки мигают
        />

        {/* Градиент */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-60" />

        {/* Статус (справа сверху) */}
        <div className="absolute top-2 right-2">
          <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
             anime.status === 'Ongoing' ? 'bg-orange-500 text-black' : 'bg-zinc-700 text-white'
          }`}>
            {anime.quality || 'TV'}
          </span>
        </div>

        {/* Рейтинг (внизу) */}
        <div className="absolute bottom-2 left-2 flex items-center gap-1">
           <Star className="w-3 h-3 fill-yellow-500 text-yellow-500" />
           <span className="text-xs font-bold text-white">{anime.rating}</span>
        </div>
      </div>

      <div className="mt-2">
        <h3 className="text-sm font-bold text-white line-clamp-1 group-hover:text-orange-500 transition-colors">
          {anime.title}
        </h3>
        <p className="text-xs text-zinc-500">
          {anime.year} • {anime.episodesCurrent > 0 ? `${anime.episodesCurrent} эп.` : 'Анонс'}
        </p>
      </div>
    </Link>
  )
}