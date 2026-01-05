"use client"

import { useState, useEffect } from "react"
import { PlayerLoading } from "@/components/player-loading"

interface KodikPlayerProps {
  shikimoriId: string
  title: string
}

export function KodikPlayer({ shikimoriId, title }: KodikPlayerProps) {
  const [isLoading, setIsLoading] = useState(true)

  // Ссылка формируется автоматически. 
  // Мы ищем по shikimoriID. Если его нет, можно искать по title.
  // Параметры:
  // &translations=false - скрыть лишние переводы (оставить топ)
  // &only_anime=true - искать только аниме
  const src = `//kodik.cc/find-player?shikimoriID=${shikimoriId}&title=${encodeURIComponent(title)}&types=anime,anime-serial&block_blocked_countries=true`

  useEffect(() => {
    setIsLoading(true)
    
    // Имитируем минимальное время загрузки для UX
    const timer = setTimeout(() => {
      setIsLoading(false)
    }, 1000)

    return () => clearTimeout(timer)
  }, [src])

  const handleIframeLoad = () => {
    setIsLoading(false)
  }

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-zinc-950 border border-zinc-800 shadow-2xl">
      {isLoading && <PlayerLoading />}
      <iframe
        src={src}
        className={`h-full w-full transition-opacity duration-300 ${isLoading ? 'opacity-0' : 'opacity-100'}`}
        width="100%"
        height="100%"
        allowFullScreen
        allow="autoplay; fullscreen"
        title={title}
        onLoad={handleIframeLoad}
      />
    </div>
  )
}