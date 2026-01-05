"use client"

import { useState } from "react"
import { KodikPlayer } from "@/components/kodik-player"
import { EpisodeSelector } from "@/components/episode-selector"

interface WatchPageClientProps {
  shikimoriId: string
  title: string
  poster: string
  totalEpisodes: number
  initialEpisode?: number
}

export function WatchPageClient({
  shikimoriId,
  title,
  poster,
  totalEpisodes,
  initialEpisode
}: WatchPageClientProps) {
  const [selectedEpisode, setSelectedEpisode] = useState<number | undefined>(initialEpisode)
  const [showPlayer, setShowPlayer] = useState(!!initialEpisode)

  const handleSelectEpisode = (episode: number) => {
    setSelectedEpisode(episode)
  }

  const handleStartWatching = () => {
    if (selectedEpisode) {
      setShowPlayer(true)
    }
  }

  const handleBackToSelection = () => {
    setShowPlayer(false)
  }

  return (
    <div className="mb-8">
      <h1 className="text-2xl md:text-3xl font-bold mb-4">{title}</h1>

      {!showPlayer ? (
        <EpisodeSelector
          totalEpisodes={totalEpisodes}
          currentEpisode={selectedEpisode}
          onSelectEpisode={handleSelectEpisode}
          onStartWatching={handleStartWatching}
        />
      ) : (
        <div>
          {selectedEpisode && selectedEpisode > 1 && (
            <button
              type="button"
              onClick={handleBackToSelection}
              className="mb-4 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-sm transition"
            >
              ← Выбрать другую серию
            </button>
          )}
          <KodikPlayer
            shikimoriId={shikimoriId}
            title={title}
            poster={poster}
            episode={selectedEpisode}
          />
        </div>
      )}
    </div>
  )
}
