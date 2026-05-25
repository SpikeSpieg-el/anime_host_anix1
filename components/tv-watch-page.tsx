"use client"

import { useState, useEffect } from 'react'
import { TVLayout } from './tv-layout'
import { TVPlayer } from './tv-player'
import { TVEpisodeSelector } from './tv-episode-selector'
import type { Anime } from '@/lib/shikimori'
import { ChevronLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface TVWatchPageProps {
  anime: Anime
  initialEpisode?: number
}

export function TVWatchPage({ anime, initialEpisode }: TVWatchPageProps) {
  const router = useRouter()
  const [currentEpisode, setCurrentEpisode] = useState(initialEpisode || 1)

  const handleEpisodeChange = (episode: number) => {
    setCurrentEpisode(episode)
    router.push(`/watch/${anime.id}?episode=${episode}`, { scroll: false })
  }

  const handleBack = () => {
    router.back()
  }

  return (
    <TVLayout>
      <div className="space-y-6">
        <button
          onClick={handleBack}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground focus:ring-2 focus:ring-primary rounded px-3 py-2 transition"
        >
          <ChevronLeft className="h-6 w-6" />
          <span className="text-lg">Назад</span>
        </button>

        <div>
          <h1 className="text-4xl font-bold mb-2">{anime.title}</h1>
          <div className="flex items-center gap-4 text-lg text-muted-foreground">
            <span>Серия {currentEpisode}</span>
            {anime.episodesTotal > 0 && <span>из {anime.episodesTotal}</span>}
            {anime.rating > 0 && <span>⭐ {anime.rating.toFixed(1)}</span>}
          </div>
        </div>

        <TVPlayer
          animeId={anime.id}
          episode={currentEpisode}
          animeTitle={anime.title}
          totalEpisodes={anime.episodesTotal}
          onNextEpisode={() => {
            if (currentEpisode < anime.episodesTotal) {
              handleEpisodeChange(currentEpisode + 1)
            }
          }}
          onPrevEpisode={() => {
            if (currentEpisode > 1) {
              handleEpisodeChange(currentEpisode - 1)
            }
          }}
        />

        <TVEpisodeSelector
          currentEpisode={currentEpisode}
          totalEpisodes={anime.episodesTotal}
          onEpisodeSelect={handleEpisodeChange}
        />

        {anime.description && (
          <div className="bg-secondary/40 rounded-lg p-6">
            <h2 className="text-2xl font-bold mb-4">Описание</h2>
            <p className="text-lg text-muted-foreground leading-relaxed whitespace-pre-line">
              {anime.description}
            </p>
          </div>
        )}

        <div className="bg-secondary/40 rounded-lg p-6">
          <h2 className="text-2xl font-bold mb-4">Информация</h2>
          <div className="grid grid-cols-2 gap-4 text-lg">
            <div>
              <span className="text-muted-foreground">Год:</span>
              <span className="ml-2 font-medium">{anime.year}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Статус:</span>
              <span className="ml-2 font-medium">{anime.status}</span>
            </div>
            <div className="col-span-2">
              <span className="text-muted-foreground">Жанры:</span>
              <span className="ml-2 font-medium">{anime.genres.join(', ')}</span>
            </div>
          </div>
        </div>
      </div>
    </TVLayout>
  )
}
