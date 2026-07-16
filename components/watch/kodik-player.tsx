"use client"

import { useState, useEffect, useMemo, useRef, useCallback } from "react"
import { createPortal } from "react-dom"
import { PlayerLoading } from "@/components/watch/player-loading"
import { AlertCircle, ChevronDown, Mic, Subtitles, Check, X } from "lucide-react"
import { RegionDetector } from "@/components/providers/region-detector"
import { getProxiedSrc } from "@/lib/image-loader"

interface KodikPlayerProps {
  shikimoriId: string
  title: string
  poster: string
  episode: number
  onStart?: () => void
  onCountryChange?: (country: string) => void
  onRegionDetected?: (isRussia: boolean) => void
  onEpisodeChange?: (episode: number) => void
  onProgressUpdate?: (info: {
    season?: number
    episode: number
    time?: string
    translation?: string
    currentTime?: number
    duration?: number
  }) => void
}

interface KodikTranslation {
  id: string
  translationId: string
  title: string
  type: string
  quality: string
  episodesCount: number
  playerLink: string
}

const STORAGE_KEY_PREFIX = "kodik-translation-"

function getSavedTranslationId(shikimoriId: string): string | null {
  if (typeof window === "undefined") return null
  try {
    return localStorage.getItem(`${STORAGE_KEY_PREFIX}${shikimoriId}`)
  } catch {
    return null
  }
}

function saveTranslationId(shikimoriId: string, translationId: string) {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${shikimoriId}`, translationId)
  } catch {
    // ignore
  }
}

export function KodikPlayer({ shikimoriId, title, poster, episode, onStart, onCountryChange, onRegionDetected, onEpisodeChange, onProgressUpdate }: KodikPlayerProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [isStarted, setIsStarted] = useState(false)
  const [hasError, setHasError] = useState(false)
  const [selectedCountry, setSelectedCountry] = useState<string>('RU')
  const [errorMessage, setErrorMessage] = useState<string>('')
  const [showFullscreenHint, setShowFullscreenHint] = useState(false)
  const playerContainerRef = useRef<HTMLDivElement>(null)
  const lastTapRef = useRef<number>(0)

  // --- Кастомное меню озвучек ---
  const [translations, setTranslations] = useState<KodikTranslation[]>([])
  const [translationsLoading, setTranslationsLoading] = useState(false)
  const [selectedTranslation, setSelectedTranslation] = useState<KodikTranslation | null>(null)
  const [showTranslationsMenu, setShowTranslationsMenu] = useState(false)
  const translationsMenuRef = useRef<HTMLDivElement>(null)
  const triggerButtonRef = useRef<HTMLButtonElement>(null)
  const [isMobile, setIsMobile] = useState(false)
  const [menuPos, setMenuPos] = useState<{ top: number; left: number; width: number } | null>(null)
  const [mounted, setMounted] = useState(false)

  // Таймаут для загрузки плеера
  const [loadTimeout, setLoadTimeout] = useState<ReturnType<typeof setTimeout> | null>(null)

  // Загрузка списка озвучек
  const loadTranslations = useCallback(async () => {
    if (translations.length > 0) return
    setTranslationsLoading(true)
    try {
      const res = await fetch(
        `/api/kodik/translations?shikimoriId=${encodeURIComponent(shikimoriId)}&title=${encodeURIComponent(title)}`
      )
      if (!res.ok) throw new Error("Failed to load translations")
      const data = await res.json()
      const list: KodikTranslation[] = data.translations || []
      setTranslations(list)

      // Восстанавливаем сохранённую озвучку или берём первую (самую полную)
      const savedId = getSavedTranslationId(shikimoriId)
      const saved = savedId ? list.find((t) => t.translationId === savedId) : null
      setSelectedTranslation(saved || list[0] || null)
    } catch (e) {
      console.error("Error loading translations:", e)
    } finally {
      setTranslationsLoading(false)
    }
  }, [shikimoriId, title, translations.length])

  // Предзагрузка озвучек при монтировании
  useEffect(() => {
    loadTranslations()
  }, [loadTranslations])

  // Отслеживание мобильного режима и монтирования (для портала)
  useEffect(() => {
    setMounted(true)
    const check = () => setIsMobile(window.innerWidth < 640)
    check()
    window.addEventListener("resize", check)
    return () => window.removeEventListener("resize", check)
  }, [])

  // Открытие меню с измерением позиции кнопки (для десктоп-позиционирования)
  const openMenu = useCallback(() => {
    if (triggerButtonRef.current) {
      const rect = triggerButtonRef.current.getBoundingClientRect()
      setMenuPos({ top: rect.bottom + 8, left: rect.left, width: rect.width })
    }
    setShowTranslationsMenu(true)
  }, [])

  // Закрытие меню озвучек по клику вне
  useEffect(() => {
    if (!showTranslationsMenu) return
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      // Не закрываем если клик по триггер-кнопке (она сама toggles)
      if (triggerButtonRef.current && triggerButtonRef.current.contains(e.target as Node)) {
        return
      }
      if (translationsMenuRef.current && !translationsMenuRef.current.contains(e.target as Node)) {
        setShowTranslationsMenu(false)
      }
    }
    // Используем mousedown для десктопа и touchstart для мобайла
    document.addEventListener("mousedown", handleClickOutside)
    document.addEventListener("touchstart", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
      document.removeEventListener("touchstart", handleClickOutside)
    }
  }, [showTranslationsMenu])

  // Блокировка прокрутки body когда открыт bottom-sheet на мобильных
  useEffect(() => {
    if (!showTranslationsMenu || !isMobile) return
    const original = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = original
    }
  }, [showTranslationsMenu, isMobile])

  const handleSelectTranslation = (tr: KodikTranslation) => {
    setSelectedTranslation(tr)
    saveTranslationId(shikimoriId, tr.translationId)
    setShowTranslationsMenu(false)
    // Перезагружаем iframe с новой озвучкой
    if (isStarted) setIsLoading(true)
  }

  // Portal-меню озвучек: bottom-sheet на мобильных, dropdown на десктопе
  const renderTranslationsPortal = () => {
    if (!showTranslationsMenu || !mounted || translations.length === 0) return null

    const listContent = (
      <>
        <div className="sticky top-0 bg-zinc-900/95 backdrop-blur-md px-3 py-2 border-b border-white/10 flex items-center justify-between z-10">
          <span className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">Озвучка</span>
          <button
            onClick={() => setShowTranslationsMenu(false)}
            className="text-zinc-400 hover:text-white p-1 -mr-1 min-h-[36px] min-w-[36px] flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        {translations.map((tr) => (
          <button
            key={tr.translationId}
            onClick={() => handleSelectTranslation(tr)}
            className="w-full flex items-start gap-2.5 sm:gap-3 px-3 py-3 sm:py-2.5 active:bg-white/10 hover:bg-white/5 transition-colors text-left border-b border-white/5 last:border-0 min-h-[52px]"
          >
            <div className="flex-shrink-0 mt-0.5">
              {tr.type === "subtitles" ? (
                <Subtitles className="w-4 h-4 text-blue-400" />
              ) : (
                <Mic className="w-4 h-4 text-orange-400" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm text-white truncate">{tr.title}</div>
              <div className="text-xs text-zinc-500 flex items-center gap-1.5 sm:gap-2 mt-0.5 flex-wrap">
                <span>{tr.episodesCount} серий</span>
                {tr.quality && <span className="text-zinc-600">·</span>}
                {tr.quality && <span className="truncate">{tr.quality}</span>}
              </div>
            </div>
            {selectedTranslation?.translationId === tr.translationId && (
              <Check className="w-4 h-4 text-orange-500 flex-shrink-0 mt-0.5" />
            )}
          </button>
        ))}
      </>
    )

    if (isMobile) {
      // Bottom-sheet на мобильных: лист снизу экрана, не обрезается контейнером
      return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-end">
          {/* Затемнение */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowTranslationsMenu(false)}
          />
          {/* Лист */}
          <div
            ref={translationsMenuRef}
            className="relative w-full bg-zinc-900/95 backdrop-blur-md border-t border-white/10 rounded-t-2xl shadow-2xl max-h-[80vh] flex flex-col animate-in slide-in-from-bottom duration-300"
            style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
          >
            {/* Хэндл для свайпа */}
            <div className="flex justify-center pt-2 pb-1 flex-shrink-0">
              <div className="w-10 h-1 rounded-full bg-zinc-600" />
            </div>
            <div className="overflow-y-auto flex-1">
              {listContent}
            </div>
          </div>
        </div>,
        document.body
      )
    }

    // Десктоп: позиционированный dropdown через портал
    const style: React.CSSProperties = menuPos
      ? {
          position: "fixed",
          top: `${menuPos.top}px`,
          left: `${menuPos.left}px`,
          zIndex: 9999,
        }
      : { position: "fixed", top: "50%", left: "50%", zIndex: 9999 }

    // Если dropdown не помещается снизу — показываем сверху кнопки
    if (menuPos) {
      const dropdownHeight = Math.min(translations.length * 60 + 50, 400)
      if (menuPos.top + dropdownHeight > window.innerHeight) {
        style.top = `${menuPos.top - 8 - dropdownHeight - 40}px`
      }
    }

    return createPortal(
      <div
        ref={translationsMenuRef}
        style={style}
        className="w-72 max-h-80 overflow-y-auto bg-zinc-900/95 backdrop-blur-md border border-white/10 rounded-xl shadow-2xl"
      >
        {listContent}
      </div>,
      document.body
    )
  }

  // URL плеера формируется из прямой ссылки выбранной озвучки
  const playerSrc = useMemo(() => {
    if (!selectedTranslation?.playerLink) return ""

    // playerLink имеет вид "//kodikplayer.com/serial/<id>/<hash>/720p"
    let url = selectedTranslation.playerLink
    if (url.startsWith("//")) url = `https:${url}`

    const params = new URLSearchParams({
      no_ads: "true", // Отключаем рекламу в плеере
      hide_selectors: "true", // Скрываем встроенные селекторы Kodik (озвучка/сезон/серия)
      autoplay: "0",
      quality: "720",
    })

    if (episode && episode > 0) {
      params.append("episode", String(episode))
    }

    if (selectedCountry && selectedCountry !== "RU") {
      params.append("country", selectedCountry)
    }

    const separator = url.includes("?") ? "&" : "?"
    return `${url}${separator}${params.toString()}`
  }, [selectedTranslation, episode, selectedCountry])

  const handleCountryChange = (countryCode: string) => {
    setSelectedCountry(countryCode)
    onCountryChange?.(countryCode)
  }

  const handleDoubleTap = () => {
    const now = Date.now()
    const DOUBLE_TAP_DELAY = 300

    if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
      setShowFullscreenHint(false)

      if (playerContainerRef.current) {
        const element = playerContainerRef.current as any

        if (!document.fullscreenElement &&
            !(document as any).webkitFullscreenElement &&
            !(document as any).mozFullScreenElement &&
            !(document as any).msFullscreenElement) {

          const requestMethod = element.requestFullscreen ||
                               element.webkitRequestFullscreen ||
                               element.webkitRequestFullScreen ||
                               element.mozRequestFullScreen ||
                               element.msRequestFullscreen;

          if (requestMethod) {
            requestMethod.call(element).catch((err: any) => {
              console.error(`Fullscreen error: ${err.message}`)
            })
          }
        } else {
          if (document.exitFullscreen) document.exitFullscreen().catch(() => {})
          else if ((document as any).webkitExitFullscreen) (document as any).webkitExitFullscreen();
          else if ((document as any).mozCancelFullScreen) (document as any).mozCancelFullScreen();
          else if ((document as any).msExitFullscreen) (document as any).msExitFullscreen();
        }
      }
      return true
    } else {
      setShowFullscreenHint(true)
      setTimeout(() => setShowFullscreenHint(false), 3000)
    }
    lastTapRef.current = now
    return false
  }

  const handleStartPlayer = () => {
    if (!selectedTranslation) {
      // Если озвучки ещё не загружены — ждём
      if (translationsLoading) return
      // Если список пуст — показываем ошибку
      if (translations.length === 0) {
        setHasError(true)
        setErrorMessage("Не удалось получить список озвучек. Попробуйте позже.")
        return
      }
    }
    onStart?.()
    setIsStarted(true)
    setIsLoading(true)
    setHasError(false)
    setErrorMessage('')

    if (loadTimeout) {
      clearTimeout(loadTimeout)
    }

    const timeout = setTimeout(() => {
      if (isLoading) {
        console.log(`⏱️ Player load timeout`)
        setIsLoading(false)
      }
    }, 15000)

    setLoadTimeout(timeout)
  }

  useEffect(() => {
    return () => {
      if (loadTimeout) {
        clearTimeout(loadTimeout)
      }
    }
  }, [loadTimeout])

  // Мониторинг состояния плеера
  useEffect(() => {
    if (!isStarted || hasError) return

    let checkCount = 0
    const maxChecks = 5

    const checkInterval = setInterval(() => {
      checkCount++

      if (isLoading && checkCount >= maxChecks) {
        console.log(`🔍 Player still loading after ${checkCount * 3}s`)
        clearInterval(checkInterval)
        return
      }

      if (checkCount >= maxChecks) {
        clearInterval(checkInterval)
        console.log(`✅ Player monitoring completed`)
      }
    }, 3000)

    return () => {
      clearInterval(checkInterval)
    }
  }, [isStarted, isLoading, hasError])

  // Обработчик postMessage сообщений от плеера Kodik
  useEffect(() => {
    if (!isStarted) return

    const handleMessage = (event: MessageEvent) => {
      // Kodik шлёт сообщения с разных доменов — проверяем по ключу в данных
      console.log('Kodik message received:', event.data)

      if (typeof event.data === 'string') {
        if (event.data.includes('разорвал соединение') ||
            event.data.includes('не отправил данные') ||
            event.data.includes('connection lost') ||
            event.data.includes('error')) {
          console.log(`❌ Connection lost`)
          return
        }
      }

      try {
        let newEpisode: number | undefined
        let progressInfo: {
          season?: number
          episode?: number
          time?: string
          translation?: string
          currentTime?: number
          duration?: number
        } = {}

        if (typeof event.data === 'object' && event.data.key === 'kodik_player_current_episode') {
          if (event.data.value?.episode && typeof event.data.value.episode === 'number') {
            newEpisode = event.data.value.episode
            progressInfo.episode = event.data.value.episode
            progressInfo.season = event.data.value.season
            progressInfo.translation = event.data.value.translation?.title || selectedTranslation?.title
            progressInfo.currentTime = event.data.value.seconds
            progressInfo.duration = event.data.value.duration

            if (event.data.value.time) {
              progressInfo.time = event.data.value.time
            } else if (event.data.value.seconds) {
              const mins = Math.floor(event.data.value.seconds / 60)
              const secs = Math.floor(event.data.value.seconds % 60)
              progressInfo.time = `${mins}:${secs.toString().padStart(2, '0')}`
            }

            if (progressInfo.episode) {
              onProgressUpdate?.({
                episode: progressInfo.episode,
                season: progressInfo.season,
                time: progressInfo.time,
                translation: progressInfo.translation,
                currentTime: progressInfo.currentTime,
                duration: progressInfo.duration
              })
            }
          }
        }
        else if (typeof event.data === 'object') {
          if (event.data.type === 'episode' && event.data.data?.episode) {
            newEpisode = event.data.data.episode
          }
          else if (event.data.episode && typeof event.data.episode === 'number') {
            newEpisode = event.data.episode
          }
          else if (event.data.data?.episode && typeof event.data.data.episode === 'number') {
            newEpisode = event.data.data.episode
          }
          else if (event.data.time && typeof event.data.time === 'number' &&
                   event.data.episode && typeof event.data.episode === 'number') {
            newEpisode = event.data.episode
          }
        }
        else if (typeof event.data === 'number' && event.data > 0) {
          newEpisode = event.data
        }
        else if (typeof event.data === 'string') {
          const match = event.data.match(/episode[:\s]+(\d+)/i)
          if (match && match[1]) {
            newEpisode = parseInt(match[1], 10)
          }
        }

        if (newEpisode && newEpisode !== episode && newEpisode > 0) {
          console.log('Kodik: Episode changed to', newEpisode)
          onEpisodeChange?.(newEpisode)
        }
      } catch (error) {
        console.warn('Error parsing Kodik message:', error)
      }
    }

    window.addEventListener('message', handleMessage)

    return () => {
      window.removeEventListener('message', handleMessage)
    }
  }, [isStarted, episode, onEpisodeChange, onProgressUpdate, selectedTranslation])

  return (
    <div
      ref={playerContainerRef}
      className="relative aspect-video w-full overflow-hidden rounded-xl sm:rounded-2xl bg-zinc-950 border border-white/5 shadow-2xl"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      {!isStarted ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {/* Детектор региона в углу */}
          <div className="z-20 absolute top-2 right-2 sm:top-4 sm:right-4">
            <RegionDetector onCountryChange={handleCountryChange} onRegionDetected={onRegionDetected} />
          </div>

          {/* Кастомное меню выбора озвучки (до старта плеера) */}
          {translations.length > 0 && (
            <div className="absolute top-2 left-2 sm:top-4 sm:left-4 z-20 max-w-[calc(100vw-1rem)]">
              <button
                ref={triggerButtonRef}
                onClick={() => (showTranslationsMenu ? setShowTranslationsMenu(false) : openMenu())}
                className="flex items-center gap-1.5 sm:gap-2 px-2.5 py-2 sm:px-3 sm:py-2 bg-zinc-900/90 backdrop-blur-sm border border-white/10 rounded-lg text-xs sm:text-sm text-white hover:bg-zinc-800 transition-colors min-h-[40px]"
              >
                {selectedTranslation?.type === "subtitles" ? (
                  <Subtitles className="w-4 h-4 flex-shrink-0 text-blue-400" />
                ) : (
                  <Mic className="w-4 h-4 flex-shrink-0 text-orange-400" />
                )}
                <span className="max-w-[120px] sm:max-w-[180px] truncate">
                  {selectedTranslation?.title || "Выбрать озвучку"}
                </span>
                <ChevronDown className={`w-4 h-4 flex-shrink-0 transition-transform ${showTranslationsMenu ? "rotate-180" : ""}`} />
              </button>
            </div>
          )}

          {translationsLoading && translations.length === 0 && (
            <div className="absolute top-2 left-2 sm:top-4 sm:left-4 z-20 px-2.5 py-2 bg-zinc-900/90 backdrop-blur-sm border border-white/10 rounded-lg text-xs text-zinc-400">
              Загрузка озвучек...
            </div>
          )}

          <div className="flex-1 flex items-center justify-center group cursor-pointer w-full"
               onClick={handleStartPlayer}
          >
            {/* Фон-постер */}
            <img
              src={poster ? getProxiedSrc(poster) : undefined}
              className="absolute inset-0 w-full h-full object-cover opacity-30 blur-sm transition-opacity group-hover:opacity-40"
              alt=""
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

            {/* Кнопка Play */}
            <button
              className="relative z-10 flex items-center gap-2 sm:gap-3 px-4 py-2.5 sm:px-8 sm:py-4 bg-orange-600 hover:bg-orange-500 active:bg-orange-700 text-white rounded-xl sm:rounded-2xl font-bold transition-all transform group-hover:scale-105 group-active:scale-95 shadow-[0_0_30px_rgba(234,88,12,0.4)] min-h-[48px]"
            >
              <svg className="w-5 h-5 sm:w-6 sm:h-6 fill-current flex-shrink-0" viewBox="0 0 24 24">
                 <path d="M8 5v14l11-7z" />
              </svg>
              <span className="text-xs sm:text-sm md:text-base">Смотреть {episode} серию</span>
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Боковые зоны для двойного тапа (fullscreen) — шире на мобильных */}
          <div
            className="absolute left-0 top-0 w-[48px] sm:w-[40px] h-full z-10 cursor-pointer pointer-events-auto touch-none"
            onClick={(e) => {
              const isDouble = handleDoubleTap()
              if (isDouble) e.stopPropagation()
            }}
          >
            {showFullscreenHint && (
              <div className="absolute inset-0 bg-orange-500/20 animate-pulse border-r border-orange-500/50 flex items-center justify-center">
                <div className="rotate-[-90deg] whitespace-nowrap text-[10px] font-bold text-orange-400 uppercase tracking-widest">
                  Тапни дважды
                </div>
              </div>
            )}
          </div>
          <div
            className="absolute right-0 top-0 w-[48px] sm:w-[40px] h-full z-10 cursor-pointer pointer-events-auto touch-none"
            onClick={(e) => {
              const isDouble = handleDoubleTap()
              if (isDouble) e.stopPropagation()
            }}
          >
            {showFullscreenHint && (
              <div className="absolute inset-0 bg-orange-500/20 animate-pulse border-l border-orange-500/50 flex items-center justify-center">
                <div className="rotate-[90deg] whitespace-nowrap text-[10px] font-bold text-orange-400 uppercase tracking-widest">
                  Тапни дважды
                </div>
              </div>
            )}
          </div>

          {/* Кастомное меню выбора озвучки (поверх плеера) */}
          {translations.length > 0 && (
            <div className="absolute top-2 left-2 sm:top-3 sm:left-3 z-30 max-w-[calc(100vw-1rem)]">
              <button
                ref={triggerButtonRef}
                onClick={() => (showTranslationsMenu ? setShowTranslationsMenu(false) : openMenu())}
                className="flex items-center gap-1.5 sm:gap-2 px-2.5 py-1.5 sm:px-3 bg-black/70 backdrop-blur-sm border border-white/10 rounded-lg text-xs sm:text-sm text-white hover:bg-black/90 active:bg-black transition-colors min-h-[36px]"
              >
                {selectedTranslation?.type === "subtitles" ? (
                  <Subtitles className="w-3.5 h-3.5 flex-shrink-0 text-blue-400" />
                ) : (
                  <Mic className="w-3.5 h-3.5 flex-shrink-0 text-orange-400" />
                )}
                <span className="max-w-[100px] sm:max-w-[140px] md:max-w-[200px] truncate">
                  {selectedTranslation?.title || "Озвучка"}
                </span>
                <ChevronDown className={`w-3.5 h-3.5 flex-shrink-0 transition-transform ${showTranslationsMenu ? "rotate-180" : ""}`} />
              </button>
            </div>
          )}

          {/* Центральная подсказка при одиночном тапе по бокам */}
          {showFullscreenHint && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none px-4 w-full max-w-xs">
              <style>{`
                @keyframes ripple-wave {
                  0% { transform: scale(0.8); opacity: 0; }
                  20% { transform: scale(1); opacity: 1; }
                  100% { transform: scale(2.5); opacity: 0; }
                }
              `}</style>
              <div className="bg-black/80 backdrop-blur-md border border-white/10 px-3 py-2 sm:px-4 rounded-full flex items-center gap-2 sm:gap-4 shadow-2xl mx-auto w-fit">
                <div className="relative w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center flex-shrink-0">
                  <div
                    className="absolute w-full h-full rounded-full bg-orange-500/40"
                    style={{ animation: 'ripple-wave 1.5s cubic-bezier(0, 0.2, 0.8, 1) infinite' }}
                  />
                  <div
                    className="absolute w-full h-full rounded-full bg-orange-500/20"
                    style={{ animation: 'ripple-wave 1.5s cubic-bezier(0, 0.2, 0.8, 1) infinite 0.2s' }}
                  />
                </div>
                <span className="text-white text-[11px] sm:text-xs font-medium">Полноэкранный режим</span>
              </div>
            </div>
          )}

          {isLoading && !hasError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <PlayerLoading />
            </div>
          )}

          {hasError ? (
             <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-400 gap-3 sm:gap-4 bg-zinc-900 p-4 sm:p-6">
                <AlertCircle className="w-10 h-10 sm:w-12 sm:h-12 text-red-500 flex-shrink-0" />
                <div className="text-center">
                  <p className="text-base sm:text-lg font-medium text-white mb-2">Плеер недоступен</p>
                  <p className="text-xs sm:text-sm text-zinc-400 mb-4 px-2">
                    {errorMessage || 'Проверьте подключение к интернету или попробуйте другую озвучку'}
                  </p>
                  <div className="flex flex-col gap-3">
                    <button
                      onClick={() => {
                        setIsStarted(false)
                        setHasError(false)
                        setErrorMessage('')
                        setIsLoading(true)
                      }}
                      className="text-orange-500 hover:underline active:opacity-70 text-sm min-h-[40px] py-2"
                    >
                      Попробовать снова
                    </button>
                    {translations.length > 1 && (
                      <button
                        onClick={() => {
                          setShowTranslationsMenu(true)
                          setHasError(false)
                          setErrorMessage('')
                        }}
                        className="text-blue-400 hover:underline active:opacity-70 text-sm min-h-[40px] py-2"
                      >
                        Выбрать другую озвучку
                      </button>
                    )}
                  </div>
                </div>
             </div>
          ) : (
            <iframe
              key={selectedTranslation?.translationId || "default"}
              src={playerSrc || undefined}
              className={`h-full w-full transition-opacity duration-700 ${isLoading ? 'opacity-0' : 'opacity-100'}`}
              allowFullScreen
              sandbox="allow-forms allow-scripts allow-same-origin allow-presentation allow-popups-to-escape-sandbox allow-top-navigation"
              loading="lazy"
              onLoad={() => {
                console.log(`✅ Kodik player loaded`)
                setIsLoading(false)
                if (loadTimeout) {
                  clearTimeout(loadTimeout)
                  setLoadTimeout(null)
                }
              }}
              onError={(e) => {
                console.error(`❌ iframe error:`, e)
                setIsLoading(false)
              }}
            />
          )}
        </>
      )}

      {/* Portal-меню озвучек — рендерится на document.body,
          не обрезается overflow-hidden контейнера плеера */}
      {renderTranslationsPortal()}
    </div>
  )
}
