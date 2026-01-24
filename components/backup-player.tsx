"use client"

import { useState, useEffect } from "react"
import { AlertCircle, ExternalLink, Search, Play } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PlayerLoading } from "@/components/player-loading"

interface BackupPlayerProps {
  title: string
  episode: number
  isActive: boolean
  embedSrc?: string
  poster?: string
  onStart?: () => void
}

export function BackupPlayer({ title, episode, isActive, embedSrc, poster, onStart }: BackupPlayerProps) {
  const [hasError, setHasError] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const [resolvedEmbedSrc, setResolvedEmbedSrc] = useState<string | null>(null)
  const [isStarted, setIsStarted] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  
  // Формируем поисковый запрос для VK Video
  const searchQuery = encodeURIComponent(`${title} ${episode} серия`)
  const vkVideoSrc = `https://vk.ru/video?z=${searchQuery}`

  const isFrameableUrl = (src: string) => {
    try {
      const url = new URL(src)
      const host = url.hostname.toLowerCase()
      const isVkHost = 
        host === "vk.ru" || host.endsWith(".vk.ru") || 
        host === "vkvideo.ru" || host.endsWith(".vkvideo.ru") ||
        host === "vk.com" || host.endsWith(".vk.com")

      if (isVkHost) {
        const pathname = url.pathname.toLowerCase()
        if (pathname === "/video_ext.php") return true
        return false
      }
      return true
    } catch {
      return false
    }
  }

  const playerSrc = embedSrc || vkVideoSrc

  useEffect(() => {
    if (isActive) {
      setHasError(false)
      setIsSearching(true)
      setIsLoading(true)
      // Имитация поиска
      setTimeout(() => {
        setIsSearching(false)
        setIsLoading(false)
      }, 1000)
    }
  }, [isActive, episode, title])

  useEffect(() => {
    if (!isActive) return
    if (embedSrc) {
      setResolvedEmbedSrc(embedSrc)
      return
    }

    let cancelled = false
    const run = async () => {
      try {
        const url = new URL("/api/vk-video", window.location.origin)
        url.searchParams.set("title", title)
        url.searchParams.set("episode", String(episode))

        const res = await fetch(url.toString(), { cache: "no-store" })
        if (!res.ok) return
        const json = (await res.json()) as { embedSrc?: string | null }

        if (cancelled) return
        if (typeof json?.embedSrc === "string" && json.embedSrc) {
          setResolvedEmbedSrc(json.embedSrc)
          setIsLoading(false)
        } else {
          setResolvedEmbedSrc(null)
          setIsLoading(false)
        }
      } catch {
        if (!cancelled) {
          setResolvedEmbedSrc(null)
          setIsLoading(false)
        }
      }
    }

    run()

    return () => {
      cancelled = true
    }
  }, [isActive, embedSrc, title, episode])

  const handleStart = () => {
    onStart?.()
    setIsStarted(true)
    setIsLoading(true)
  }

  if (!isActive) {
    return null
  }

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-zinc-950 border border-white/5 shadow-2xl">
      {/* Предупреждение о трекинге */}
      {!isStarted && (
        <div className="absolute top-0 left-0 right-0 bg-yellow-500/90 text-black text-xs px-3 py-2 z-10 text-center">
          <span className="hidden sm:inline">
            ⚠️ Внимание: Запасной плеер может работать не так как запланировано. 
            Вы должны перед уходом сами отследить на какой серии остановились (выбор в списке серии), иначе трекинг не произойдёт.
          </span>
          <span className="sm:hidden">
            ⚠️ Запасной плеер: выберите серию в списке перед уходом для трекинга
          </span>
        </div>
      )}

      {!isStarted ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="flex-1 flex items-center justify-center group cursor-pointer"
               onClick={handleStart}
          >
            {/* Фон-постер или градиент */}
            {poster ? (
              <img
                src={poster}
                className="absolute inset-0 w-full h-full object-cover opacity-30 blur-sm transition-opacity group-hover:opacity-40"
                alt=""
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 opacity-50 transition-opacity group-hover:opacity-60" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

            {/* Кнопка Play */}
            <button
              className="relative z-10 flex items-center gap-3 px-6 py-3 sm:px-8 sm:py-4 bg-orange-600 hover:bg-orange-500 text-white rounded-2xl font-bold transition-all transform group-hover:scale-105 shadow-[0_0_30px_rgba(234,88,12,0.4)]"
            >
              <Play className="w-6 h-6 fill-current" />
              <span className="text-sm sm:text-base">Смотреть {episode} серию</span>
            </button>
          </div>
        </div>
      ) : (
        <>
          {isLoading && !hasError && <PlayerLoading />}
          {hasError ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-400 gap-4 bg-zinc-900 p-6">
          <AlertCircle className="w-12 h-12 text-red-500" />
          <div className="text-center">
            <p className="text-lg font-medium text-white mb-2">Запасной плеер недоступен</p>
            <p className="text-sm text-zinc-500 mb-4">
              Попробуйте вернуться к основному плееру или воспользуйтесь поиском
            </p>
            <div className="flex flex-col gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-2 border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-600"
                onClick={() => window.open(`https://vk.ru/video?z=${searchQuery}`, '_blank')}
              >
                <Search className="w-4 h-4" />
                Найти {episode} серию
              </Button>
            </div>
          </div>
        </div>
          ) : isSearching ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900">
              <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="text-zinc-400 text-sm">Поиск {episode} серии...</p>
            </div>
          ) : (
        <div className="player-box relative w-full h-full">
          {(() => {
            const src = resolvedEmbedSrc || playerSrc
            const ok = isFrameableUrl(src)
            if (!ok) {
              return (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-400 gap-4 bg-zinc-900 p-6">
                  <ExternalLink className="w-12 h-12 text-orange-500" />
                  <div className="text-center">
                    <p className="text-lg font-medium text-white mb-2">Открытие в плеере недоступно</p>
                    <p className="text-sm text-zinc-500 mb-4">
                      VK Video запрещает встраивание в плеер. Откройте поиск в новой вкладке.
                    </p>
                    <div className="flex flex-col gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2 border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-600"
                        onClick={() => window.open(src, "_blank")}
                      >
                        <Search className="w-4 h-4" />
                        Найти {episode} серию
                      </Button>
                    </div>
                  </div>
                </div>
              )
            }

            return (
            <iframe
              id="backup-player"
              src={src}
              className={`w-full h-full border-0 transition-opacity duration-700 ${isLoading ? 'opacity-0' : 'opacity-100'}`}
              allow="autoplay; encrypted-media; fullscreen; picture-in-picture; screen-wake-lock;"
              allowFullScreen
              onLoad={() => {
                setHasError(false)
                setIsLoading(false)
              }}
              onError={() => {
                setHasError(true)
                setIsLoading(false)
              }}
            />
            )
          })()}
          {/* Индикатор поиска */}
          <div className="absolute top-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded-md">
            Поиск: {title} {episode} серия
          </div>
        </div>
          )}
        </>
      )}
    </div>
  )
}
