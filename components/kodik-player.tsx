"use client"

import { useState, useEffect, useMemo } from "react"
import { PlayerLoading } from "@/components/player-loading"

interface KodikPlayerProps {
  shikimoriId: string
  title: string
  poster: string
  episode: number
  onStart?: () => void
}

export function KodikPlayer({ shikimoriId, title, poster, episode, onStart }: KodikPlayerProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [isStarted, setIsStarted] = useState(false)

  const playerSrc = useMemo(() => {
    const params = new URLSearchParams({
      shikimoriID: shikimoriId,
      episode: String(episode),
      types: 'anime,anime-serial',
      no_ads: 'true',
      block_blocked_countries: 'true',
      hide_selectors: 'false',
      autoplay: '0',
    })
    return `https://kodik.cc/find-player?${params.toString()}`
  }, [shikimoriId, episode])

  useEffect(() => {
    // При смене серии показываем лоадер, пока iframe не загрузит новый контент
    setIsLoading(true)
  }, [episode])

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-zinc-950 border border-white/5 shadow-2xl">
      {!isStarted ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <img 
            src={poster} 
            className="absolute inset-0 w-full h-full object-cover opacity-20 blur-xl" 
            alt="" 
          />
          <button
            onClick={() => {
              onStart?.()
              setIsStarted(true)
            }}
            className="group relative z-10 flex items-center gap-3 px-6 py-3 text-sm sm:px-8 sm:py-4 sm:text-base bg-orange-600 hover:bg-orange-500 text-white rounded-2xl font-bold transition-all hover:scale-105 active:scale-95 shadow-[0_0_30px_rgba(234,88,12,0.4)]"
          >
            <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24">
               <path d="M8 5v14l11-7z" />
            </svg>
            Смотреть {episode} серию
          </button>
        </div>
      ) : (
        <>
          {isLoading && <PlayerLoading />}
          <iframe
            src={playerSrc}
            className={`h-full w-full transition-opacity duration-700 ${isLoading ? 'opacity-0' : 'opacity-100'}`}
            allowFullScreen
            allow="autoplay; fullscreen"
            referrerPolicy="no-referrer"
            loading="lazy"
            onLoad={() => setIsLoading(false)}
            sandbox="allow-forms allow-scripts allow-same-origin allow-presentation allow-popups"
          />
        </>
      )}
    </div>
  )
}