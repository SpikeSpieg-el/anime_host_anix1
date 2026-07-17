"use client"

import { useState, useEffect, useRef } from 'react'
import { Play, Pause, SkipForward, SkipBack, Volume2, VolumeX } from 'lucide-react'

interface TVPlayerProps {
  animeId: string
  episode: number
  animeTitle: string
  totalEpisodes: number
  onNextEpisode: () => void
  onPrevEpisode: () => void
}

export function TVPlayer({ animeId, episode, animeTitle, totalEpisodes, onNextEpisode, onPrevEpisode }: TVPlayerProps) {
  const [kodikUrl, setKodikUrl] = useState<string>('')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    setIsLoading(true)
    const directUrl = `https://kodikplayer.com/find-player?shikimoriID=${animeId}&episode=${episode}&quality=720&no_ads=true&no_provider_ads=true&block_blocked_countries=true&hide_selectors=true`
    const url = `/api/kodik/player-proxy?url=${encodeURIComponent(directUrl)}`
    setKodikUrl(url)
    setIsLoading(false)
  }, [animeId, episode])


  return (
    <div className="space-y-4">
      <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary"></div>
          </div>
        )}
        
        {kodikUrl && (
          <iframe
            src={kodikUrl}
            className="w-full h-full"
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
            sandbox="allow-scripts allow-same-origin allow-presentation"
            referrerPolicy="no-referrer"
          />
        )}
      </div>

      <div className="flex items-center justify-center gap-4">
        <button
          onClick={onPrevEpisode}
          disabled={episode <= 1}
          className="flex items-center gap-2 px-6 py-3 bg-secondary hover:bg-secondary/80 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed focus:ring-2 focus:ring-primary text-lg font-medium"
        >
          <SkipBack className="h-6 w-6" />
          Предыдущая
        </button>

        <button
          onClick={onNextEpisode}
          disabled={episode >= totalEpisodes}
          className="flex items-center gap-2 px-6 py-3 bg-primary hover:bg-primary/80 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed focus:ring-2 focus:ring-primary text-lg font-medium"
        >
          Следующая
          <SkipForward className="h-6 w-6" />
        </button>
      </div>
    </div>
  )
}
