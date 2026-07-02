"use client"

import { useMemo } from "react"
import { Tv, Film, Clapperboard, Play, Bookmark } from "lucide-react"
import { useBookmarks } from "@/components/providers/bookmarks-provider"
import type { Anime } from "@/lib/shikimori/types"

interface LinkedAnimeCardProps {
  id: number
  name: string
  russian: string
  poster?: string
  kindLabel: string
  statusLabel: string
  episodes?: number
  score?: string
}

export function LinkedAnimeCard({ id, name, russian, poster, kindLabel, statusLabel, episodes, score }: LinkedAnimeCardProps) {
  const { isSaved, toggle } = useBookmarks()
  const idStr = String(id)
  const saved = isSaved(idStr)

  const anime = useMemo<Anime>(() => ({
    id: idStr,
    shikimoriId: idStr,
    title: russian || name,
    originalTitle: name,
    poster: poster || "",
    rating: score ? parseFloat(score) || 0 : 0,
    year: 0,
    episodesCurrent: episodes || 0,
    episodesTotal: episodes || 0,
    status: statusLabel,
    description: "",
    genres: [],
    quality: "",
  }), [idStr, russian, name, poster, score, episodes, statusLabel])

  return (
    <div className="news-linked-anime-card group">
      <a href={`/watch/${id}`} className="news-linked-poster-link">
        {poster ? (
          <img
            src={poster}
            alt={russian || name}
            className="news-linked-poster"
            loading="lazy"
          />
        ) : (
          <div className="news-linked-poster-placeholder">
            <Tv className="w-7 h-7" />
          </div>
        )}
      </a>

      <div className="news-linked-info">
        <span className="news-linked-eyebrow">Связанное аниме</span>
        <a href={`/watch/${id}`} className="flex items-center gap-2 flex-wrap mt-1">
          <span className="text-base sm:text-lg font-bold text-foreground dark:text-white group-hover:text-blue-400 transition-colors">
            {russian || name}
          </span>
          {name && russian && (
            <span className="text-sm text-muted-foreground dark:text-zinc-500">
              / {name}
            </span>
          )}
        </a>
        <div className="flex items-center gap-2 mt-2.5 flex-wrap">
          {kindLabel && (
            <span className="news-tag">
              {kindLabel === 'TV' ? <Tv className="w-3 h-3" /> : kindLabel === 'Фильм' ? <Film className="w-3 h-3" /> : <Clapperboard className="w-3 h-3" />}
              {kindLabel}
            </span>
          )}
          {statusLabel && (
            <span className="news-tag">{statusLabel}</span>
          )}
          {episodes && episodes > 0 && (
            <span className="news-tag">{episodes} эп.</span>
          )}
          {score && parseFloat(score) > 0 && (
            <span className="news-tag news-tag-star">★ {score}</span>
          )}
        </div>
      </div>

      <div className="news-linked-actions">
        <button
          type="button"
          onClick={() => toggle(anime)}
          className={`news-linked-bookmark-btn ${saved ? "is-saved" : ""}`}
          title={saved ? "Убрать из закладок" : "Добавить в закладки"}
        >
          <Bookmark className="w-4 h-4" fill={saved ? "currentColor" : "none"} />
          <span className="hidden sm:inline">{saved ? "В закладках" : "В закладки"}</span>
        </button>
        <a href={`/watch/${id}`} className="news-linked-cta">
          <Play className="w-4 h-4" />
          <span className="hidden sm:inline">Смотреть</span>
        </a>
      </div>
    </div>
  )
}
