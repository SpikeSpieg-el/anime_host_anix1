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
const UI_HIDE_DELAY = 3000

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
  const [useProxy, setUseProxy] = useState(false)
  const playerContainerRef = useRef<HTMLDivElement>(null)
  const lastTapRef = useRef<number>(0)

  // Автоскрытие кастомного UI поверх плеера
  const [showUi, setShowUi] = useState(true)
  const uiTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // --- Кастомное меню озвучек ---
  const [translations, setTranslations] = useState<KodikTranslation[]>([])
  const [translationsLoading, setTranslationsLoading] = useState(false)
  const [selectedTranslation, setSelectedTranslation] = useState<KodikTranslation | null>(null)
  const [showTranslationsMenu, setShowTranslationsMenu] = useState(false)
  const translationsMenuRef = useRef<HTMLDivElement>(null)
  const triggerButtonRef = useRef<HTMLButtonElement>(null)
  const showTranslationsMenuRef = useRef(showTranslationsMenu)
  showTranslationsMenuRef.current = showTranslationsMenu
  const [isMobile, setIsMobile] = useState(false)
  const [menuPos, setMenuPos] = useState<{ top: number; left: number; width: number } | null>(null)
  const [mounted, setMounted] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)

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

      const savedId = getSavedTranslationId(shikimoriId)
      const saved = savedId ? list.find((t) => t.translationId === savedId) : null

      const validSaved = (saved && saved.episodesCount >= episode) ? saved : null
      const availableForEpisode = list.find((t) => t.episodesCount >= episode) || list[0] || null

      setSelectedTranslation(validSaved || availableForEpisode)
    } catch (e) {
      console.error("Error loading translations:", e)
    } finally {
      setTranslationsLoading(false)
    }
  }, [shikimoriId, title, translations.length, episode])

  useEffect(() => {
    loadTranslations()
  }, [loadTranslations])

  // Автопереключение озвучки, если в текущей нет нужной серии
  useEffect(() => {
    if (!selectedTranslation || translations.length === 0) return

    if (selectedTranslation.episodesCount < episode) {
      const validTranslation = translations.find((t) => t.episodesCount >= episode)
      if (validTranslation && validTranslation.translationId !== selectedTranslation.translationId) {
        setSelectedTranslation(validTranslation)
      }
    }
  }, [episode, selectedTranslation, translations])

  // Отслеживание мобильного режима и монтирования
  useEffect(() => {
    setMounted(true)
    const check = () => {
      const hasTouch = navigator.maxTouchPoints > 0
      const isNarrow = window.innerWidth < 640
      const isLandscapeMobile = hasTouch && window.innerHeight < 500
      setIsMobile(isNarrow || isLandscapeMobile)
    }
    check()
    window.addEventListener("resize", check)
    window.addEventListener("orientationchange", check)
    return () => {
      window.removeEventListener("resize", check)
      window.removeEventListener("orientationchange", check)
    }
  }, [])

  // Отслеживание fullscreen режима
  useEffect(() => {
    const handleChange = () => {
      const fs = !!(document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).msFullscreenElement)
      setIsFullscreen(fs)
    }
    document.addEventListener('fullscreenchange', handleChange)
    document.addEventListener('webkitfullscreenchange', handleChange)
    document.addEventListener('mozfullscreenchange', handleChange)
    document.addEventListener('MSFullscreenChange', handleChange)
    return () => {
      document.removeEventListener('fullscreenchange', handleChange)
      document.removeEventListener('webkitfullscreenchange', handleChange)
      document.removeEventListener('mozfullscreenchange', handleChange)
      document.removeEventListener('MSFullscreenChange', handleChange)
    }
  }, [])

  const openMenu = useCallback(() => {
    if (triggerButtonRef.current) {
      const rect = triggerButtonRef.current.getBoundingClientRect()
      const vw = window.innerWidth
      const dropdownWidth = Math.min(288, vw - 16)
      let left = rect.left
      if (left + dropdownWidth > vw - 8) {
        left = Math.max(8, vw - dropdownWidth - 8)
      }
      setMenuPos({ top: rect.bottom + 8, left, width: rect.width })
    }
    setShowTranslationsMenu(true)
  }, [])

  useEffect(() => {
    if (!showTranslationsMenu) return
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (triggerButtonRef.current && triggerButtonRef.current.contains(e.target as Node)) {
        return
      }
      if (translationsMenuRef.current && !translationsMenuRef.current.contains(e.target as Node)) {
        setShowTranslationsMenu(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    document.addEventListener("touchstart", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
      document.removeEventListener("touchstart", handleClickOutside)
    }
  }, [showTranslationsMenu])

  useEffect(() => {
    if (!showTranslationsMenu || (!isMobile && !isFullscreen)) return
    const original = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = original
    }
  }, [showTranslationsMenu, isMobile, isFullscreen])

  const handleSelectTranslation = (tr: KodikTranslation) => {
    setShowTranslationsMenu(false)

    if (selectedTranslation?.translationId === tr.translationId) {
      return
    }

    setSelectedTranslation(tr)
    saveTranslationId(shikimoriId, tr.translationId)
    setUseProxy(false)

    if (isStarted) {
      setIsLoading(true)

      if (loadTimeout) clearTimeout(loadTimeout)
      const timeout = setTimeout(() => {
        setIsLoading(false)
      }, 8000)
      setLoadTimeout(timeout)
    }
  }

  // Portal-меню озвучек
  const renderTranslationsPortal = () => {
    if (!showTranslationsMenu || !mounted || translations.length === 0) return null

    const portalTarget = (isFullscreen && playerContainerRef.current)
      ? playerContainerRef.current
      : document.body
    const useBottomSheet = isMobile || isFullscreen

    const listContent = (
      <>
        <div className="sticky top-0 bg-zinc-900/95 backdrop-blur-md px-3 py-2 border-b border-white/10 flex items-center justify-between z-10">
          <span className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">Выбор озвучки</span>
          <button
            onClick={() => setShowTranslationsMenu(false)}
            className="text-zinc-400 hover:text-white p-1 -mr-1 min-h-[36px] min-w-[36px] flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        {translations.map((tr) => {
          const isAvailable = tr.episodesCount >= episode
          const isSelected = selectedTranslation?.translationId === tr.translationId

          return (
            <button
              key={tr.translationId}
              onClick={() => handleSelectTranslation(tr)}
              className={`w-full flex items-start gap-2.5 sm:gap-3 px-3 py-3 sm:py-2.5 active:bg-white/10 hover:bg-white/5 transition-colors text-left border-b border-white/5 last:border-0 min-h-[52px] ${
                !isAvailable ? 'opacity-60' : ''
              }`}
            >
              <div className="flex-shrink-0 mt-0.5">
                {tr.type === "subtitles" ? (
                  <Subtitles className="w-4 h-4 text-blue-400" />
                ) : (
                  <Mic className="w-4 h-4 text-orange-400" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-white truncate flex items-center gap-1.5">
                  <span className="truncate">{tr.title}</span>
                </div>
                <div className="text-xs text-zinc-400 flex items-center gap-1.5 sm:gap-2 mt-0.5 flex-wrap">
                  <span>{tr.episodesCount} серий</span>
                  {!isAvailable && (
                    <span className="text-red-400 font-medium">(нет {episode} серии)</span>
                  )}
                  {tr.quality && isAvailable && <span className="text-zinc-600">·</span>}
                  {tr.quality && isAvailable && <span className="truncate text-zinc-500">{tr.quality}</span>}
                </div>
              </div>
              {isSelected && (
                <Check className="w-4 h-4 text-orange-500 flex-shrink-0 mt-0.5" />
              )}
            </button>
          )
        })}
      </>
    )

    if (useBottomSheet) {
      return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-end">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowTranslationsMenu(false)}
          />
          <div
            ref={translationsMenuRef}
            className="relative w-full bg-zinc-900/95 backdrop-blur-md border-t border-white/10 rounded-t-2xl shadow-2xl max-h-[min(80vh,calc(100vh-2rem))] flex flex-col animate-in slide-in-from-bottom duration-300"
            style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
          >
            <div className="flex justify-center pt-2 pb-1 flex-shrink-0">
              <div className="w-10 h-1 rounded-full bg-zinc-600" />
            </div>
            <div className="overflow-y-auto flex-1">
              {listContent}
            </div>
          </div>
        </div>,
        portalTarget
      )
    }

    const vw = window.innerWidth
    const vh = window.innerHeight
    const dropdownWidth = Math.min(288, vw - 16)
    const dropdownMaxHeight = Math.min(translations.length * 60 + 50, vh * 0.6)

    const style: React.CSSProperties = menuPos
      ? {
          position: "fixed",
          top: `${menuPos.top}px`,
          left: `${Math.min(menuPos.left, vw - dropdownWidth - 8)}px`,
          zIndex: 9999,
          maxWidth: `${dropdownWidth}px`,
        }
      : { position: "fixed", top: "50%", left: "50%", zIndex: 9999, maxWidth: `${dropdownWidth}px` }

    if (menuPos) {
      if (menuPos.top + dropdownMaxHeight > vh) {
        style.top = `${Math.max(8, menuPos.top - 8 - dropdownMaxHeight - 40)}px`
      }
    }

    return createPortal(
      <div
        ref={translationsMenuRef}
        style={style}
        className="w-[min(18rem,calc(100vw-1rem))] max-h-[60vh] overflow-y-auto bg-zinc-900/95 backdrop-blur-md border border-white/10 rounded-xl shadow-2xl"
      >
        {listContent}
      </div>,
      portalTarget
    )
  }

  // Ссылка для плеера
  const playerSrc = useMemo(() => {
    if (!selectedTranslation?.playerLink) return ""

    let url = selectedTranslation.playerLink
    if (url.startsWith("//")) url = `https:${url}`

    const params = new URLSearchParams({
      no_ads: "true",
      no_provider_ads: "true",
      hide_selectors: "true",
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
    const directUrl = `${url}${separator}${params.toString()}`

    if (useProxy) {
      return `/api/kodik/player-proxy?url=${encodeURIComponent(directUrl)}`
    }
    return directUrl
  }, [selectedTranslation, episode, selectedCountry, useProxy])

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
      if (translationsLoading) return
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
        setIsLoading(false)
      }
    }, 12000)

    setLoadTimeout(timeout)
  }

  const clearUiTimer = useCallback(() => {
    if (uiTimerRef.current) {
      clearTimeout(uiTimerRef.current)
      uiTimerRef.current = null
    }
  }, [])

  const showUiAndResetTimer = useCallback(() => {
    setShowUi(true)
    clearUiTimer()
    if (showTranslationsMenuRef.current) return
    uiTimerRef.current = setTimeout(() => {
      setShowUi(false)
    }, UI_HIDE_DELAY)
  }, [clearUiTimer])

  useEffect(() => {
    return () => {
      if (loadTimeout) {
        clearTimeout(loadTimeout)
      }
    }
  }, [loadTimeout])

  useEffect(() => {
    if (!isStarted || hasError) return

    const container = playerContainerRef.current
    if (!container) return

    const handle = () => showUiAndResetTimer()
    const events = ['mouseenter', 'click', 'touchstart'] as const
    events.forEach((event) => container.addEventListener(event, handle))

    showUiAndResetTimer()

    return () => {
      events.forEach((event) => container.removeEventListener(event, handle))
      clearUiTimer()
    }
  }, [isStarted, isLoading, hasError, showUiAndResetTimer, clearUiTimer])

  useEffect(() => {
    if (!isStarted) return
    if (showTranslationsMenu) {
      clearUiTimer()
      setShowUi(true)
    } else {
      showUiAndResetTimer()
    }
  }, [showTranslationsMenu, isStarted, clearUiTimer, showUiAndResetTimer])

  // УНИВЕРСАЛЬНЫЙ СЛУШАТЕЛЬ ТАЙМКОДОВ И ПРОГРЕССА С К О D I K
  useEffect(() => {
    if (!isStarted) return

    let lastSavedTimeStr = ""

    const handleMessage = (event: MessageEvent) => {
      try {
        let data = event.data

        if (typeof data === 'string') {
          try {
            data = JSON.parse(data)
          } catch {
            // Игнорируем обычные строки
          }
        }

        if (!data || typeof data !== 'object') return

        const key = data.key || data.type || data.event
        const value = data.value || data.data || data

        let newEpisode: number | undefined
        let seconds: number | undefined
        let timeStr: string | undefined

        // 1. Извлекаем номер серии
        if (key === 'kodik_player_current_episode' || key === 'episode') {
          if (typeof value?.episode === 'number') newEpisode = value.episode
          else if (typeof value === 'number') newEpisode = value
          
          if (typeof value?.seconds === 'number') seconds = value.seconds
          if (typeof value?.time === 'string') timeStr = value.time
        } else if (typeof data.episode === 'number') {
          newEpisode = data.episode
        }

        // 2. Извлекаем секунды при воспроизведении (time_update)
        if (key === 'kodik_player_time_update' || key === 'time_update' || key === 'time') {
          if (typeof value?.seconds === 'number') seconds = value.seconds
          else if (typeof value === 'number') seconds = value
          else if (typeof value?.time === 'string') timeStr = value.time
          else if (typeof data.seconds === 'number') seconds = data.seconds
        }

        // Переводим секунды в читаемый таймкод "12:45"
        if (typeof seconds === 'number' && seconds > 0) {
          const mins = Math.floor(seconds / 60)
          const secs = Math.floor(seconds % 60)
          timeStr = `${mins}:${secs.toString().padStart(2, '0')}`
        }

        // Обновляем прогресс, если таймкод изменился
        if (timeStr && timeStr !== lastSavedTimeStr) {
          lastSavedTimeStr = timeStr
          onProgressUpdate?.({
            episode: newEpisode || episode,
            season: value?.season,
            time: timeStr,
            translation: value?.translation?.title || selectedTranslation?.title,
            currentTime: seconds,
            duration: value?.duration
          })
        }

        if (newEpisode && newEpisode !== episode && newEpisode > 0) {
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
      style={{ paddingTop: "env(safe-area-inset-top)", ...(isFullscreen ? { overflow: 'visible' } : {}) }}
    >
      {!isStarted ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="z-20 absolute top-2 right-2 sm:top-4 sm:right-4">
            <RegionDetector onCountryChange={handleCountryChange} onRegionDetected={onRegionDetected} />
          </div>

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
            <img
              src={poster ? getProxiedSrc(poster) : undefined}
              className="absolute inset-0 w-full h-full object-cover opacity-30 blur-sm transition-opacity group-hover:opacity-40"
              alt=""
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

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
          <div
            className={`absolute inset-0 z-20 bg-transparent transition-opacity duration-300 ${
              showUi ? 'pointer-events-none opacity-0' : 'pointer-events-auto opacity-0'
            }`}
            onClick={showUiAndResetTimer}
          />

          <div
            className={`absolute left-0 top-0 w-[48px] sm:w-[40px] h-full z-30 cursor-pointer pointer-events-auto touch-none transition-opacity duration-300 ${
              showUi ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
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
            className={`absolute right-0 top-0 w-[48px] sm:w-[40px] h-full z-30 cursor-pointer pointer-events-auto touch-none transition-opacity duration-300 ${
              showUi ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
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

          {showUi && translations.length > 0 && (
            <div className={`absolute top-2 left-2 sm:top-3 sm:left-3 z-30 max-w-[calc(100vw-1rem)] transition-opacity duration-300 ${
              showUi ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
            }`}>
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

          {isLoading && !hasError && (
            <div className="absolute inset-0 z-50 flex flex-col items-center justify-center">
              <PlayerLoading />
            </div>
          )}

          {hasError ? (
             <div className="absolute inset-0 z-50 flex flex-col items-center justify-center text-zinc-400 gap-3 sm:gap-4 bg-zinc-900 p-4 sm:p-6">
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
              key={`${selectedTranslation?.translationId || "default"}-${episode}-${useProxy ? "proxy" : "direct"}`}
              src={playerSrc || undefined}
              className={`h-full w-full transition-opacity duration-700 ${isLoading ? 'opacity-0' : 'opacity-100'}`}
              allow="autoplay; encrypted-media; fullscreen; picture-in-picture; screen-wake-lock"
              allowFullScreen
              sandbox="allow-scripts allow-same-origin allow-presentation allow-popups allow-forms allow-modals allow-downloads"
              onLoad={() => {
                setIsLoading(false)
                if (loadTimeout) {
                  clearTimeout(loadTimeout)
                  setLoadTimeout(null)
                }
              }}
              onError={() => {
                if (useProxy) {
                  setUseProxy(false)
                  setIsLoading(true)
                } else {
                  setIsLoading(false)
                }
              }}
            />
          )}
        </>
      )}

      {renderTranslationsPortal()}
    </div>
  )
}