"use client"

import Link from "next/link"
import Image from "next/image"
import { Bookmark, Star } from "lucide-react"
import { Anime } from "@/lib/shikimori"
import { Button } from "@/components/ui/button"
import { useBookmarks } from "@/components/bookmarks-provider"
import { useState } from "react"

// Функция для генерации запасного постера (упрощенная версия из shikimori.ts)
function generateFallbackPoster(title: string): string {
  const hash = title.split('').reduce((acc, char) => char.charCodeAt(0) + ((acc << 5) - acc), 0);
  const index = Math.abs(hash) % 4;
  const letter = title.slice(0, 1).toUpperCase();
  
  const styles = [
    { bg: '#1a0505', textColor: '#fed7aa', accentColor: '#ea580c' },
    { bg: '#020617', textColor: '#bfdbfe', accentColor: '#3b82f6' },
    { bg: '#1e1b4b', textColor: '#e9d5ff', accentColor: '#8b5cf6' },
    { bg: '#18181b', textColor: '#e4e4e7', accentColor: '#22c55e' }
  ];
  
  const style = styles[index];
  const svg = `
    <svg width="400" height="600" viewBox="0 0 400 600" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="${style.bg}"/>
      <text x="50%" y="40%" font-family="sans-serif" font-weight="900" font-size="300" fill="${style.accentColor}" text-anchor="middle" dominant-baseline="middle" opacity="0.1">${letter}</text>
      <text x="50%" y="55%" font-family="sans-serif" font-size="24" fill="${style.textColor}" text-anchor="middle" font-weight="bold">${title}</text>
      <text x="50%" y="580" font-family="sans-serif" font-size="12" fill="${style.textColor}" opacity="0.6" text-anchor="middle">ANIME COLLECTION</text>
    </svg>
  `;
  
  const base64 = Buffer.from(svg).toString('base64');
  return `data:image/svg+xml;base64,${base64}`;
}

// Принимаем данные, которые вернул transformAnime
export function AnimeCard({ anime }: { anime: Anime }) {
  const { isSaved, toggle } = useBookmarks()
  const saved = isSaved(anime.id)
  const [imageError, setImageError] = useState(false)
  
  const posterSrc = imageError ? generateFallbackPoster(anime.title) : anime.poster

  return (
    <Link href={`/watch/${anime.id}`} className="group relative block">
      <div className="relative aspect-[2/3] overflow-hidden rounded-lg bg-zinc-900">
        <Image
          src={posterSrc}
          alt={anime.title}
          fill
          className="object-cover transition-transform duration-300 group-hover:scale-105"
          sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, (max-width: 1280px) 20vw, 16vw"
          onError={() => setImageError(true)}
          unoptimized={imageError} // Для SVG data URL нужно отключить оптимизацию
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

        <div className="absolute top-2 left-2">
          <Button
            type="button"
            variant="secondary"
            size="icon-sm"
            className="bg-black/60 hover:bg-black/70 text-white border border-white/10"
            aria-label={saved ? "Убрать из закладок" : "Сохранить на потом"}
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              toggle(anime)
            }}
          >
            <Bookmark className={saved ? "fill-orange-500 text-orange-500" : "text-white"} />
          </Button>
        </div>

        {/* Рейтинг (внизу) */}
        <div className="absolute bottom-2 left-2 flex items-center gap-1">
           <Star className="w-3 h-3 fill-yellow-500 text-yellow-500" />
           <span className="text-xs font-bold text-white">{anime.rating}</span>
        </div>
      </div>

      <div className="mt-2 min-h-[3.5rem]">
        <h3 className="text-sm font-bold text-white line-clamp-2 group-hover:text-orange-500 transition-colors min-h-[2.5rem] leading-tight">
          {anime.title}
        </h3>
        <p className="text-xs text-zinc-500">
          {anime.year} • {anime.episodesCurrent > 0 ? `${anime.episodesCurrent} эп.` : 'Анонс'}
        </p>
      </div>
    </Link>
  )
}