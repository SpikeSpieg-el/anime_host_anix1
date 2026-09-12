"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { AlertCircle, Globe, Languages, Play, RefreshCw, Settings2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PlayerLoading } from "@/components/watch/player-loading"
import { getProxiedSrc } from "@/lib/image-loader"

/**
 * Запасной плеер на базе прямой трансляции (порт провайдеров animdl):
 * AniLibria (русская озвучка) → AllAnime (dub/sub).
 * Видео играет в нативном <video> через hls.js: ссылки идут через
 * /api/animdl/hls-прокси, поэтому стримы с hotlink-защитой работают.
 */

interface ApiQuality {
  label: string
  kind: "hls" | "mp4"
  playUrl: string
}

interface ApiSubtitle {
  lang: string
  label: string
  url: string
}

interface StreamResponse {
  ok: boolean
  reason?: string
  message?: string
  provider?: string
  providerLabel?: string
  ruDub?: boolean
  matchedTitle?: string
  qualities?: ApiQuality[]
  subtitles?: ApiSubtitle[]
}

interface BackupPlayerProps {
  title: string
  originalTitle?: string
  episode: number
  isActive: boolean
  poster?: string
  onStart?: () => void
  onProgressUpdate?: (info: {
    season?: number
    episode: number
    time?: string
    translation?: string
    currentTime?: number
    duration?: number
  }) => void
}

type PlayerPhase = "idle" | "resolving" | "ready" | "error"

export function BackupPlayer({
  title,
  originalTitle,
  episode,
  isActive,
  poster,
  onStart,
  onProgressUpdate,
}: BackupPlayerProps) {
  const [phase, setPhase] = useState<PlayerPhase>("idle")
  const [stream, setStream] = useState<StreamResponse | null>(null)
  const [qualityIndex, setQualityIndex] = useState(0)
  const [statusText, setStatusText] = useState("Ищем русскую озвучку…")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const videoRef = useRef<HTMLVideoElement>(null)
  const hlsRef = useRef<{ destroy: () => void } | null>(null)
  const lastProgressSecondRef = useRef(-1)
  const resumeTimeRef = useRef(0)
  const retryCountRef = useRef(0)

  const resetForEpisode = useCallback(() => {
    hlsRef.current?.destroy()
    hlsRef.current = null
    lastProgressSecondRef.current = -1
    resumeTimeRef.current = 0
    setQualityIndex(0)
  }, [])

  // Смена серии/плеера — сбрасываем состояние под новую серию.
  useEffect(() => {
    if (!isActive) return
    resetForEpisode()
    if (phase === "idle") return
    setPhase("resolving")
    setStatusText("Ищем русскую озвучку…")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, episode, title, originalTitle])

  // Резолв источников через наш API.
  useEffect(() => {
    if (!isActive || phase !== "resolving") return

    let cancelled = false
    const resolve = async () => {
      try {
        const url = new URL("/api/animdl/stream", window.location.origin)
        url.searchParams.set("title", title)
        if (originalTitle) url.searchParams.set("original", originalTitle)
        url.searchParams.set("episode", String(episode))

        const response = await fetch(url.toString(), { cache: "no-store" })
        const data = (await response.json()) as StreamResponse
        if (cancelled) return

        if (data.ok && data.qualities && data.qualities.length > 0) {
          setStream(data)
          setPhase("ready")
        } else {
          setStream(null)
          setErrorMessage(
            data.message ||
              "Не удалось найти русскую озвучку у AniLibria/AllAnime. Попробуйте основной плеер.",
          )
          setPhase("error")
        }
      } catch {
        if (!cancelled) {
          setErrorMessage("Источник временно недоступен. Попробуйте ещё раз или основной плеер.")
          setPhase("error")
        }
      }
    }

    resolve()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, phase, episode, title, originalTitle])

  // Подключение видео-потока (hls.js или нативный HLS в Safari).
  useEffect(() => {
    if (phase !== "ready" || !stream) return
    const quality = stream.qualities?.[qualityIndex]
    if (!quality) return

    const video = videoRef.current
    if (!video) return

    let disposed = false

    const attach = async () => {
      resumeTimeRef.current = video.currentTime || resumeTimeRef.current

      if (quality.kind === "mp4") {
        video.src = quality.playUrl
        video.play().catch(() => {})
        return
      }

      const HlsModule = await import("hls.js")
      const Hls = HlsModule.default
      if (disposed) return

      if (Hls.isSupported()) {
        const hls = new Hls({
          // Прокси и так добавляет Referer, у сегментов свой кеш.
          enableWorker: true,
          lowLatencyMode: false,
          maxBufferLength: 30,
        })
        hlsRef.current = hls
        hls.loadSource(quality.playUrl)
        hls.attachMedia(video)
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          video.play().catch(() => {})
        })
        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (!data.fatal || disposed) return
          if (data.type === Hls.ErrorTypes.MEDIA_ERROR && retryCountRef.current < 2) {
            retryCountRef.current += 1
            hls.recoverMediaError()
            return
          }
          if (retryCountRef.current < 2) {
            retryCountRef.current += 1
            hls.startLoad()
            return
          }
          setErrorMessage("Поток не отвечает. Попробуйте другое качество или основной плеер.")
          setPhase("error")
        })
      } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
        // Safari: нативный HLS.
        video.src = quality.playUrl
        video.play().catch(() => {})
      } else {
        setErrorMessage("Браузер не поддерживает HLS-воспроизведение.")
        setPhase("error")
      }
    }

    attach()

    return () => {
      disposed = true
      hlsRef.current?.destroy()
      hlsRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, stream, qualityIndex])

  // Прогресс для трекинга серии (как в Kodik-плеере).
  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current
    if (!video || !onProgressUpdate) return
    const bucket = Math.floor(video.currentTime / 10)
    if (bucket === lastProgressSecondRef.current) return
    lastProgressSecondRef.current = bucket

    const mins = Math.floor(video.currentTime / 60)
    const secs = Math.floor(video.currentTime % 60)
    onProgressUpdate({
      episode,
      time: `${mins}:${secs.toString().padStart(2, "0")}`,
      translation: stream?.providerLabel
        ? `${stream.providerLabel}${stream.ruDub ? " · русская озвучка" : ""}`
        : undefined,
      currentTime: video.currentTime,
      duration: video.duration || undefined,
    })
  }, [episode, onProgressUpdate, stream])

  const handleStart = () => {
    onStart?.()
    setPhase("resolving")
    setStatusText("Ищем русскую озвучку…")
  }

  const handleQualityChange = (index: number) => {
    if (index === qualityIndex) return
    const video = videoRef.current
    resumeTimeRef.current = video?.currentTime || 0
    setQualityIndex(index)
  }

  const handleLoadedMetadata = () => {
    if (resumeTimeRef.current > 5 && videoRef.current) {
      videoRef.current.currentTime = resumeTimeRef.current
      resumeTimeRef.current = 0
    }
  }

  if (!isActive) return null

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-zinc-950 border border-white/5 shadow-2xl">
      {/* Предупреждение о трекинге до старта */}
      {phase === "idle" && (
        <div className="absolute top-0 left-0 right-0 bg-yellow-500/90 text-black text-xs px-3 py-2 z-10 text-center">
          <span className="hidden sm:inline">
            ⚠️ Запасной плеер: прогресс внутри серии может не сохраняться автоматически.
            Проверьте номер серии в списке перед уходом.
          </span>
          <span className="sm:hidden">⚠️ Запасной плеер: проверьте серию в списке перед уходом</span>
        </div>
      )}

      {phase === "idle" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center group cursor-pointer"
             onClick={handleStart}>
          {poster ? (
            <img
              src={getProxiedSrc(poster)}
              className="absolute inset-0 w-full h-full object-cover opacity-30 blur-sm transition-opacity group-hover:opacity-40"
              alt=""
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 opacity-50 transition-opacity group-hover:opacity-60" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

          {/* Бейдж источников */}
          <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5 px-2.5 py-1.5 bg-black/70 backdrop-blur-sm rounded-lg text-[11px] text-zinc-300">
            <Globe className="w-3.5 h-3.5 text-orange-400" />
            AniLibria / AllAnime
          </div>

          <button
            className="relative z-10 flex items-center gap-3 px-6 py-3 sm:px-8 sm:py-4 bg-orange-600 hover:bg-orange-500 text-white rounded-2xl font-bold transition-all transform group-hover:scale-105 shadow-[0_0_30px_rgba(234,88,12,0.4)]"
          >
            <Play className="w-6 h-6 fill-current" />
            <span className="text-sm sm:text-base">Смотреть {episode} серию</span>
          </button>

          <p className="absolute bottom-4 z-10 text-xs text-zinc-400 px-4 text-center">
            Прямой стрим с русской озвучкой, без VK
          </p>
        </div>
      )}

      {phase === "resolving" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950">
          <PlayerLoading />
          <p className="absolute bottom-8 text-zinc-500 text-xs px-6 text-center">
            {statusText}
          </p>
        </div>
      )}

      {phase === "error" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-400 gap-4 bg-zinc-900 p-6">
          <AlertCircle className="w-12 h-12 text-red-500" />
          <div className="text-center max-w-md">
            <p className="text-lg font-medium text-white mb-2">Серия не найдена в запасных источниках</p>
            <p className="text-sm text-zinc-500 mb-4">{errorMessage}</p>
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-2 border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-600"
                onClick={() => {
                  setErrorMessage(null)
                  setPhase("resolving")
                  setStatusText("Пробуем ещё раз…")
                }}
              >
                <RefreshCw className="w-4 h-4" />
                Обновить
              </Button>
            </div>
          </div>
        </div>
      )}

      {phase === "ready" && stream && (
        <div className="relative w-full h-full">
          <video
            ref={videoRef}
            className="w-full h-full border-0 bg-black"
            controls
            autoPlay
            playsInline
            preload="metadata"
            data-analytics-player="backup"
            data-analytics-episode={episode}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
          >
            {stream.subtitles?.map((subtitle, index) => (
              <track
                key={`${subtitle.url}-${index}`}
                kind="subtitles"
                src={subtitle.url}
                srcLang={subtitle.lang}
                label={subtitle.label}
                default={index === 0}
              />
            ))}
          </video>

          {/* Оверлей: источник и качество */}
          <div className="absolute top-2 left-2 flex items-center gap-1.5 pointer-events-none">
            <span className="flex items-center gap-1 bg-black/70 text-white text-xs px-2 py-1 rounded-md">
              {stream.ruDub ? (
                <Languages className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Globe className="w-3.5 h-3.5 text-orange-400" />
              )}
              {stream.providerLabel}
              {stream.ruDub ? " · русская озвучка" : " · субтитры/дубляж"}
            </span>
          </div>

          {(stream.qualities?.length ?? 0) > 1 && (
            <label className="absolute top-2 right-2 flex items-center gap-1 bg-black/70 rounded-md px-2 py-1 text-xs text-white cursor-pointer hover:bg-black/80 transition-colors">
              <Settings2 className="w-3.5 h-3.5" />
              <select
                className="bg-transparent outline-none cursor-pointer [&>option]:text-black"
                value={qualityIndex}
                onChange={(event) => handleQualityChange(Number(event.target.value))}
                onClick={(event) => event.stopPropagation()}
              >
                {stream.qualities?.map((quality, index) => (
                  <option key={`${quality.playUrl}-${index}`} value={index}>
                    {quality.label}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      )}
    </div>
  )
}
