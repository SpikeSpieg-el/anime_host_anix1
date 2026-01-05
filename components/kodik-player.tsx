"use client"

import { useState, useEffect } from "react"
import { PlayerLoading } from "@/components/player-loading"
import Cookies from 'js-cookie'
import { recordWatchStart } from "@/components/history-tracker"

interface KodikPlayerProps {
  shikimoriId: string
  title: string
  poster: string
  episode?: number
}

export function KodikPlayer({ shikimoriId, title, poster, episode }: KodikPlayerProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [started, setStarted] = useState(false)

  // Ссылка формируется автоматически. 
  // Мы ищем по shikimoriID. Если его нет, можно искать по title.
  // Параметры:
  // &translations=false - скрыть лишние переводы (оставить топ)
  // &only_anime=true - искать только аниме
  // &no_ads=true - отключить рекламу
  const src = `//kodik.cc/find-player?shikimoriID=${shikimoriId}&title=${encodeURIComponent(title)}&types=anime,anime-serial&block_blocked_countries=true&no_ads=true`

  useEffect(() => {
    if (!started) return

    setIsLoading(true)

    // Сохраняем ID аниме в историю просмотра (для рекомендаций/баннеров)
    const currentHistory = JSON.parse(Cookies.get('watched_history') || '[]')
    const newHistory = [shikimoriId, ...currentHistory.filter((id: string) => id !== shikimoriId)].slice(0, 10)
    Cookies.set('watched_history', JSON.stringify(newHistory), { expires: 365 })

    // Сохраняем историю продолжения просмотра (локально)
    recordWatchStart(
      { id: shikimoriId, title, poster },
      { episode }
    )

    // Имитируем минимальное время загрузки для UX
    const timer = setTimeout(() => {
      setIsLoading(false)
    }, 1000)

    return () => clearTimeout(timer)
  }, [episode, poster, shikimoriId, started, title])

  const handleIframeLoad = () => {
    setIsLoading(false)
  }

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-zinc-950 border border-zinc-800 shadow-2xl">
      {!started ? (
        <button
          type="button"
          onClick={() => setStarted(true)}
          className="absolute inset-0 flex items-center justify-center bg-zinc-950/30 backdrop-blur-sm text-white font-semibold hover:bg-zinc-950/40 transition"
        >
          Смотреть
        </button>
      ) : (
        <>
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
        </>
      )}
    </div>
  )
}