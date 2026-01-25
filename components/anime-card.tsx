"use client"

import Link from "next/link"
import Image from "next/image"
import { Bookmark, Star } from "lucide-react"
import { Anime } from "@/lib/shikimori"
import { Button } from "@/components/ui/button"
import { useBookmarks } from "@/components/bookmarks-provider"
import { useState } from "react"
import { cn } from "@/lib/utils"

// Helper function for dynamic episode/series text
const getEpisodeText = (count: number): string => {
  if (count === 1) return "Серия"
  const lastDigit = count % 10
  const lastTwoDigits = count % 100
  
  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) return "Серий"
  if (lastDigit === 1) return "Серия"
  if (lastDigit >= 2 && lastDigit <= 4) return "Серии"
  return "Серий"
}

// Функция для генерации запасного постера
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

interface AnimeCardProps {
  anime: Anime
  className?: string
  variant?: 'default' | 'compact' | 'table'
  showUpdateBadge?: boolean
  updateInfo?: {
    newEpisode: number
    totalEpisodes?: number
  }
}

export function AnimeCard({ anime, className, variant = 'default', showUpdateBadge, updateInfo }: AnimeCardProps) {
  const { isSaved, toggle } = useBookmarks()
  const saved = isSaved(anime.id)
  const [imageError, setImageError] = useState(false)
  
  const posterSrc = imageError ? generateFallbackPoster(anime.title) : anime.poster
  const isCompact = variant === 'compact'
  const isTable = variant === 'table'

  // Table variant - horizontal layout
  if (isTable) {
    return (
      <Link href={`/watch/${anime.id}`} className={cn("group relative block bg-zinc-900/50 rounded-lg border border-zinc-800 hover:border-orange-500/50 transition-all p-3", className)}>
        <div className="flex gap-3">
          {/* Poster */}
          <div className="relative w-16 h-20 sm:w-20 sm:h-28 flex-shrink-0 overflow-hidden rounded-md bg-zinc-800">
            <Image
              src={posterSrc}
              alt={anime.title}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-105"
              sizes="80px"
              onError={() => setImageError(true)}
              unoptimized={imageError}
            />
            
            {/* Status badge */}
            <div className="absolute top-1 right-1 flex flex-col items-end gap-1">
              <span className={cn(
                "rounded px-1 py-0.5 font-bold uppercase tracking-wide shadow-sm text-[8px]",
                anime.status === 'Ongoing' ? 'bg-orange-500 text-black' : 'bg-zinc-700 text-white'
              )}>
                {anime.quality || 'TV'}
              </span>
              {showUpdateBadge && updateInfo && (
                <span className="bg-orange-500 text-black text-[8px] font-bold px-1 py-0.5 rounded shadow-sm animate-pulse">
                  новых серий + {updateInfo.newEpisode - anime.episodesCurrent}
                </span>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0 flex flex-col justify-between">
            <div className="flex-1">
              <h3 className="font-bold text-white text-sm group-hover:text-orange-500 transition-colors line-clamp-2 leading-tight mb-1">
                {anime.title}
              </h3>
              <p className="text-zinc-500 text-xs mb-2">
                {anime.year} • {anime.episodesCurrent > 0 ? `${anime.episodesCurrent} ${getEpisodeText(anime.episodesCurrent)}` : 'Анонс'}
                {anime.status === 'Announcement' && anime.airedOn && (
                  <span className="text-orange-400 ml-1">
                    • Выход: {new Date(anime.airedOn).toLocaleDateString('ru-RU', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric'
                    })}
                  </span>
                )}
              </p>
            </div>
            
            {/* Footer with rating and bookmark */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <Star className="w-3 h-3 fill-yellow-500 text-yellow-500" />
                <span className="font-bold text-white text-xs">
                  {anime.rating}
                </span>
              </div>
              
              <Button
                type="button"
                variant="secondary"
                size="icon-sm"
                className="bg-black/60 hover:bg-black/70 text-white border border-white/10 backdrop-blur-sm h-6 w-6"
                aria-label={saved ? "Убрать из закладок" : "Сохранить на потом"}
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  toggle(anime)
                }}
              >
                <Bookmark className={cn(
                  saved ? "fill-orange-500 text-orange-500" : "text-white",
                  "w-3 h-3"
                )} />
              </Button>
            </div>
          </div>
        </div>
      </Link>
    )
  }

  return (
    <Link href={`/watch/${anime.id}`} className={cn("group relative block h-full flex flex-col", className)}>
      <div className="relative aspect-[2/3] w-full overflow-hidden rounded-lg bg-zinc-900 shadow-lg">
        <Image
          src={posterSrc}
          alt={anime.title}
          fill
          className="object-cover transition-transform duration-300 group-hover:scale-105"
          sizes="(max-width: 640px) 33vw, (max-width: 1024px) 20vw, 16vw"
          onError={() => setImageError(true)}
          unoptimized={imageError}
        />

        {/* Градиент */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-60" />

        {/* Статус (справа сверху) */}
        <div className="absolute top-2 right-2 flex flex-col items-end gap-1">
          <span className={cn(
            "rounded px-1.5 py-0.5 font-bold uppercase tracking-wide shadow-sm",
            isCompact ? "text-[8px]" : "text-[10px]",
            anime.status === 'Ongoing' ? 'bg-orange-500 text-black' : 'bg-zinc-700 text-white'
          )}>
            {anime.quality || 'TV'}
          </span>
          {showUpdateBadge && updateInfo && (
            <span className={cn(
              "bg-orange-500 text-black font-bold px-1.5 py-0.5 rounded shadow-sm animate-pulse",
              isCompact ? "text-[8px]" : "text-[10px]"
            )}>
              новых серий + {updateInfo.newEpisode - anime.episodesCurrent}
            </span>
          )}
        </div>

        <div className="absolute top-2 left-2">
          <Button
            type="button"
            variant="secondary"
            size="icon-sm"
            className={cn(
              "bg-black/60 hover:bg-black/70 text-white border border-white/10 backdrop-blur-sm",
              isCompact ? "h-6 w-6" : "h-7 w-7"
            )}
            aria-label={saved ? "Убрать из закладок" : "Сохранить на потом"}
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              toggle(anime)
            }}
          >
            <Bookmark className={cn(
              saved ? "fill-orange-500 text-orange-500" : "text-white",
              isCompact ? "w-3 h-3" : "w-4 h-4"
            )} />
          </Button>
        </div>

        {/* Рейтинг (внизу) */}
        <div className="absolute bottom-2 left-2 flex items-center gap-1">
           <Star className="w-3 h-3 fill-yellow-500 text-yellow-500" />
           <span className={cn("font-bold text-white shadow-black drop-shadow-md", isCompact ? "text-[10px]" : "text-xs")}>
             {anime.rating}
           </span>
        </div>

        {/* Дата выхода для анонсов (внизу справа) */}
        {anime.status === 'Announcement' && anime.airedOn && (
          <div className="absolute bottom-2 right-2">
            <span className={cn(
              "bg-black/80 backdrop-blur-sm text-white px-2 py-1 rounded text-xs font-medium",
              isCompact ? "text-[8px] px-1.5 py-0.5" : "text-xs"
            )}>
              {new Date(anime.airedOn).toLocaleDateString('ru-RU', {
                day: 'numeric',
                month: 'long',
                year: 'numeric'
              })}
            </span>
          </div>
        )}
      </div>

      <div className={cn("mt-2 flex-1 min-h-0", isCompact ? "mt-1.5" : "mt-2")}>
        <h3 className={cn(
          "font-bold text-white line-clamp-2 group-hover:text-orange-500 transition-colors leading-tight",
          isCompact ? "text-xs" : "text-sm"
        )}>
          {anime.title}
        </h3>
        <p className={cn("text-zinc-500 mt-0.5", isCompact ? "text-[10px]" : "text-xs")}>
          {anime.year} • {anime.episodesCurrent > 0 ? `${anime.episodesCurrent} ${getEpisodeText(anime.episodesCurrent)}` : 'Анонс'}
        </p>
      </div>
    </Link>
  )
}