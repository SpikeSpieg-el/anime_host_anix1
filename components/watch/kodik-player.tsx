"use client"

import { createVideoProgressTracker } from "@/lib/analytics-video"
import { useState, useEffect, useMemo, useRef, useCallback } from "react"
import { createPortal } from "react-dom"
import { PlayerLoading } from "@/components/watch/player-loading"
import { AlertCircle, ChevronDown, Mic, Subtitles, Check, X, SkipForward, Clock, Info } from "lucide-react"
import { RegionDetector } from "@/components/providers/region-detector"
import { getProxiedSrc } from "@/lib/image-loader"
import { lockOrientation, useFullscreenOrientation } from "@/hooks/use-fullscreen-orientation"
import {
  extractEndingTimings,
  getTranslationMaxEpisode,
  hasNextEpisode as hasNextEpisodeAvailable,
  isEndingReached,
  isEpisodeAvailableInTranslation,
  isEpisodeMissingFromTranslation,
  isSeekedBackBeforeEnding,
  isVideoEndedEvent,
  parseSeconds,
  resolveMaxEpisode,
  type KodikSeasonsMap,
} from "@/lib/kodik-player-logic"

interface KodikPlayerProps {
  shikimoriId: string
  title: string
  poster: string
  episode: number
  /**
   * Сколько серий реально вышло (по Shikimori).
   * Нужен, чтобы кнопка «Следующая серия» не вела на несуществующую серию:
   * сайт всё равно зажмёт номер серии этим значением.
   */
  maxEpisode?: number
  onStart?: () => void
  onCountryChange?: (country: string) => void
  onRegionDetected?: (isRussia: boolean) => void
  onEpisodeChange?: (episode: number) => void
  /** Вызывается, когда следующей серии нет ни в одной озвучке. */
  onEpisodeUnavailable?: (episode: number) => void
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
  /** Карта сезонов от Kodik: { "1": { episodes: { "1": "//link", ... } } } */
  seasons?: KodikSeasonsMap
}

const STORAGE_KEY_PREFIX = "kodik-translation-"
const UI_HIDE_DELAY = 3500
const NOTICE_HIDE_DELAY = 5000
const NEXT_EPISODE_CONFIRM_TIMEOUT = 9000

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

export function KodikPlayer({
  shikimoriId,
  title,
  poster,
  episode,
  maxEpisode,
  onStart,
  onCountryChange,
  onRegionDetected,
  onEpisodeChange,
  onEpisodeUnavailable,
  onProgressUpdate
}: KodikPlayerProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [isStarted, setIsStarted] = useState(false)
  const [hasError, setHasError] = useState(false)
  const [selectedCountry, setSelectedCountry] = useState<string>("RU")
  const [errorMessage, setErrorMessage] = useState<string>("")
  const [showFullscreenHint, setShowFullscreenHint] = useState(false)

  // Состояние эндинга
  const [isNearEnd, setIsNearEnd] = useState(false)
  const [isDismissedEnd, setIsDismissedEnd] = useState(false)
  const [timeLeftSeconds, setTimeLeftSeconds] = useState<number | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  // Хранилища таймингов и флагов
  const durationRef = useRef<number>(0)
  const lastSecondsRef = useRef<number>(0)
  const hasTimeRef = useRef<boolean>(false)
  const videoEndedRef = useRef<boolean>(false)
  const isDomEndingActiveRef = useRef<boolean>(false)
  const isPlayingRef = useRef<boolean>(true)
  const playbackStartedAtRef = useRef<number>(0)
  const endingRangeRef = useRef<{ start: number; end?: number } | null>(null)
  const targetEpisodeRef = useRef<number | null>(null)
  const pendingEpisodeRef = useRef<number | null>(null)
  const pendingEpisodeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const playerContainerRef = useRef<HTMLDivElement>(null)
  const lastTapRef = useRef<number>(0)
  const analyticsProgress = useRef(createVideoProgressTracker())

  // Автоскрытие UI и курсора
  const [showUi, setShowUi] = useState(true)
  const uiTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Меню озвучек
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
  const [useProxy, setUseProxy] = useState(false)

  // Текущий сезон — приходит от плеера, нужен для точной границы серий
  // (в много сезонных тайтлах Kodik нумерует серии внутри сезона).
  const [currentSeason, setCurrentSeason] = useState<number | null>(null)

  // --- Проверка наличия следующей серии -------------------------------
  // Kodik врёт и в `episodes_count`, и Shikimori (там 12 серий,
  // а в озвучке может быть 5), поэтому берём САМУЮ строгую границу
  // из известных источников. Если граница неизвестна — кнопки нет.
  const maxAvailableEpisode = useMemo(
    () =>
      resolveMaxEpisode({
        translationMaxEpisode: getTranslationMaxEpisode(selectedTranslation, currentSeason),
        siteMaxEpisode: maxEpisode,
      }),
    [selectedTranslation, currentSeason, maxEpisode]
  )

  const nextEpisodeNumber = Number(episode) + 1

  const hasNextEpisode = useMemo(
    () => hasNextEpisodeAvailable(episode, maxAvailableEpisode),
    [episode, maxAvailableEpisode]
  )

  /** Озвучка, где следующая серия есть, хотя в текущей её нет. */
  const nextEpisodeFallback = useMemo(() => {
    const nextEp = nextEpisodeNumber
    if (!Number.isFinite(nextEp) || nextEp < 2) return null
    return (
      translations.find(
        (tr) =>
          tr.translationId !== selectedTranslation?.translationId &&
          isEpisodeAvailableInTranslation(tr, nextEp) &&
          (!maxEpisode || nextEp <= maxEpisode)
      ) ?? null
    )
  }, [translations, selectedTranslation, nextEpisodeNumber, maxEpisode])

  const [loadTimeout, setLoadTimeout] = useState<ReturnType<typeof setTimeout> | null>(null)

  /** Сколько секунд реально идёт просмотр (запасной сигнал конца серии). */
  const watchedWallSeconds = useCallback(() => {
    if (!playbackStartedAtRef.current) return null
    return Math.max(0, (Date.now() - playbackStartedAtRef.current) / 1000)
  }, [])

  // Единый сброс состояния «конец серии» — при смене серии ИЛИ озвучки
  // (иначе плашка перетекает на новый iframe, где видео ещё в начале).
  const resetEndingState = useCallback(() => {
    setIsNearEnd(false)
    setIsDismissedEnd(false)
    setTimeLeftSeconds(null)
    durationRef.current = 0
    lastSecondsRef.current = 0
    hasTimeRef.current = false
    videoEndedRef.current = false
    isDomEndingActiveRef.current = false
    isPlayingRef.current = true
    playbackStartedAtRef.current = Date.now()
    endingRangeRef.current = null
    targetEpisodeRef.current = null
    pendingEpisodeRef.current = null
    if (pendingEpisodeTimeoutRef.current) {
      clearTimeout(pendingEpisodeTimeoutRef.current)
      pendingEpisodeTimeoutRef.current = null
    }
  }, [])

  useEffect(() => {
    // Смена серии (в т.ч. подтверждённый переход на следующую) — сбрасываем всё.
    resetEndingState()
  }, [episode, resetEndingState])

  useEffect(() => {
    // Другая озвучка — другой материал Kodik, сезон и тайминги свои.
    resetEndingState()
    setCurrentSeason(null)
  }, [selectedTranslation?.translationId, resetEndingState])

  useEffect(() => {
    return () => {
      if (pendingEpisodeTimeoutRef.current) clearTimeout(pendingEpisodeTimeoutRef.current)
    }
  }, [])

  // Автоскрытие служебных подсказок
  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(null), NOTICE_HIDE_DELAY)
    return () => clearTimeout(timer)
  }, [notice])

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
      // Сохранённую озвучку меняем только если ТОЧНО знаем, что серии в ней нет
      const validSaved = saved && !isEpisodeMissingFromTranslation(saved, episode) ? saved : null
      const availableForEpisode =
        list.find((t) => isEpisodeAvailableInTranslation(t, episode)) ||
        list.find((t) => !isEpisodeMissingFromTranslation(t, episode)) ||
        list[0] ||
        null

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

  useEffect(() => {
    if (!selectedTranslation || translations.length === 0) return
    // Точно знаем, что в текущей озвучке этой серии нет — ищем другую
    if (!isEpisodeMissingFromTranslation(selectedTranslation, episode)) return

    const validTranslation = translations.find(
      (t) =>
        t.translationId !== selectedTranslation.translationId &&
        isEpisodeAvailableInTranslation(t, episode)
    )
    if (validTranslation) {
      setNotice(`Серии ${episode} нет в озвучке «${selectedTranslation.title}» — переключаем на «${validTranslation.title}»`)
      setSelectedTranslation(validTranslation)
    }
  }, [episode, selectedTranslation, translations])

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

  const isFullscreen = useFullscreenOrientation("landscape")

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
      if (triggerButtonRef.current && triggerButtonRef.current.contains(e.target as Node)) return
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

  const handleSelectTranslation = useCallback(
    (tr: KodikTranslation) => {
      setShowTranslationsMenu(false)
      if (selectedTranslation?.translationId === tr.translationId) return

      setSelectedTranslation(tr)
      saveTranslationId(shikimoriId, tr.translationId)

      if (isStarted) {
        setIsLoading(true)
        if (loadTimeout) clearTimeout(loadTimeout)
        const timeout = setTimeout(() => {
          setIsLoading(false)
        }, 8000)
        setLoadTimeout(timeout)
      }
    },
    [selectedTranslation, shikimoriId, isStarted, loadTimeout]
  )

  /**
   * Переход на следующую серию.
   *
   * Три уровня защиты от «несуществующей» серии:
   *  1. кнопка вообще не показывается, если серии нет
   *     (`hasNextEpisode` — минимум из озвучки и данных Shikimori);
   *  2. на клике проверяем ещё раз и, если в текущей озвучке серии нет,
   *     пробуем озвучку, где она есть, иначе честно говорим об этом;
   *  3. если родитель серию не принял (зажал своим лимитом) — откатываем
   *     загрузку и показываем подсказку вместо бесконечного спиннера.
   */
  const handleNextEpisode = useCallback(
    (e?: React.MouseEvent) => {
      e?.stopPropagation()

      const nextEp = nextEpisodeNumber
      if (!Number.isFinite(nextEp) || nextEp < 2) return

      if (!hasNextEpisode) {
        // В текущей озвучке серии нет — ищем озвучку, где она есть.
        if (nextEpisodeFallback) {
          setNotice(`Серии ${nextEp} нет в озвучке «${selectedTranslation?.title || "текущая"}» — переключаем на «${nextEpisodeFallback.title}»`)
          handleSelectTranslation(nextEpisodeFallback)
          targetEpisodeRef.current = nextEp
          pendingEpisodeRef.current = nextEp
          onEpisodeChange?.(nextEp)
          return
        }

        setNotice(
          maxEpisode && nextEp > maxEpisode
            ? `Серия ${nextEp} ещё не вышла`
            : `Серии ${nextEp} пока нет ни в одной озвучке`
        )
        setIsDismissedEnd(true)
        onEpisodeUnavailable?.(nextEp)
        return
      }

      targetEpisodeRef.current = nextEp
      pendingEpisodeRef.current = nextEp

      setIsNearEnd(false)
      setIsDismissedEnd(false)
      videoEndedRef.current = false
      isDomEndingActiveRef.current = false
      endingRangeRef.current = null

      setIsLoading(true)
      if (loadTimeout) clearTimeout(loadTimeout)
      const timeout = setTimeout(() => {
        setIsLoading(false)
      }, 8000)
      setLoadTimeout(timeout)

      // Страховка: родитель мог не принять серию (например, зажать своим
      // лимитом вышедших серий) — тогда iframe не перезагрузится и
      // спиннер останется навсегда.
      if (pendingEpisodeTimeoutRef.current) clearTimeout(pendingEpisodeTimeoutRef.current)
      pendingEpisodeTimeoutRef.current = setTimeout(() => {
        if (pendingEpisodeRef.current !== nextEp) return
        pendingEpisodeRef.current = null
        pendingEpisodeTimeoutRef.current = null
        setIsLoading(false)
        targetEpisodeRef.current = null
        setNotice(`Не удалось открыть серию ${nextEp}. Выберите серию или озвучку вручную.`)
      }, NEXT_EPISODE_CONFIRM_TIMEOUT)

      // Сообщаем родительскому компоненту — он обновит `episode`,
      // а iframe перезагрузится уже с нужной серией.
      onEpisodeChange?.(nextEp)
    },
    [
      nextEpisodeNumber,
      hasNextEpisode,
      nextEpisodeFallback,
      selectedTranslation,
      maxEpisode,
      handleSelectTranslation,
      loadTimeout,
      onEpisodeChange,
      onEpisodeUnavailable,
    ]
  )

  const handleDismissNearEnd = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsDismissedEnd(true)
  }

  // Рендер меню выбора озвучек
  const renderTranslationsPortal = () => {
    if (!showTranslationsMenu || !mounted || translations.length === 0) return null

    const portalTarget = isFullscreen && playerContainerRef.current ? playerContainerRef.current : document.body
    const useBottomSheet = isMobile || isFullscreen

    const listContent = (
      <>
        <div className="sticky top-0 bg-zinc-900/95 backdrop-blur-md px-3 py-2 border-b border-white/10 flex items-center justify-between z-10 cursor-default">
          <span className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">Выбор озвучки</span>
          <button
            onClick={() => setShowTranslationsMenu(false)}
            className="text-zinc-400 hover:text-white p-1 -mr-1 min-h-[36px] min-w-[36px] flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        {translations.map((tr) => {
          const isAvailable = !isEpisodeMissingFromTranslation(tr, episode)
          const isSelected = selectedTranslation?.translationId === tr.translationId

          return (
            <button
              key={tr.translationId}
              onClick={() => handleSelectTranslation(tr)}
              className={`w-full flex items-start gap-2.5 sm:gap-3 px-3 py-3 sm:py-2.5 active:bg-white/10 hover:bg-white/5 transition-colors text-left border-b border-white/5 last:border-0 min-h-[52px] cursor-pointer ${
                !isAvailable ? "opacity-60" : ""
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
              {isSelected && <Check className="w-4 h-4 text-orange-500 flex-shrink-0 mt-0.5" />}
            </button>
          )
        })}
      </>
    )

    if (useBottomSheet) {
      return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-end">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowTranslationsMenu(false)} />
          <div
            ref={translationsMenuRef}
            className="relative w-full bg-zinc-900/95 backdrop-blur-md border-t border-white/10 rounded-t-2xl shadow-2xl max-h-[min(80vh,calc(100vh-2rem))] flex flex-col animate-in slide-in-from-bottom duration-300 cursor-default"
            style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
          >
            <div className="flex justify-center pt-2 pb-1 flex-shrink-0">
              <div className="w-10 h-1 rounded-full bg-zinc-600" />
            </div>
            <div className="overflow-y-auto flex-1">{listContent}</div>
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

    if (menuPos && menuPos.top + dropdownMaxHeight > vh) {
      style.top = `${Math.max(8, menuPos.top - 8 - dropdownMaxHeight - 40)}px`
    }

    return createPortal(
      <div
        ref={translationsMenuRef}
        style={style}
        className="w-[min(18rem,calc(100vw-1rem))] max-h-[60vh] overflow-y-auto bg-zinc-900/95 backdrop-blur-md border border-white/10 rounded-xl shadow-2xl cursor-default"
      >
        {listContent}
      </div>,
      portalTarget
    )
  }

  const playerSrc = useMemo(() => {
    if (!selectedTranslation?.playerLink) return ""

    let url = selectedTranslation.playerLink
    if (url.startsWith("//")) url = `https:${url}`

    const params = new URLSearchParams({
      no_ads: "true",
      no_provider_ads: "true",
      hide_selectors: "true",
      autoplay: isStarted ? "1" : "0",
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
  }, [selectedTranslation, episode, selectedCountry, useProxy, isStarted])

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

        if (
          !document.fullscreenElement &&
          !(document as any).webkitFullscreenElement &&
          !(document as any).mozFullScreenElement &&
          !(document as any).msFullscreenElement
        ) {
          const requestMethod =
            element.requestFullscreen ||
            element.webkitRequestFullscreen ||
            element.webkitRequestFullScreen ||
            element.mozRequestFullScreen ||
            element.msRequestFullscreen

          if (requestMethod) {
            Promise.resolve(requestMethod.call(element))
              .then(() => lockOrientation("landscape"))
              .catch((err: any) => {
                console.error(`Fullscreen error: ${err?.message ?? err}`)
              })
          }
        } else {
          if (document.exitFullscreen) document.exitFullscreen().catch(() => {})
          else if ((document as any).webkitExitFullscreen) (document as any).webkitExitFullscreen()
          else if ((document as any).mozCancelFullScreen) (document as any).mozCancelFullScreen()
          else if ((document as any).msExitFullscreen) (document as any).msExitFullscreen()
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
    setErrorMessage("")

    if (loadTimeout) clearTimeout(loadTimeout)
    const timeout = setTimeout(() => {
      if (isLoading) setIsLoading(false)
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
      if (loadTimeout) clearTimeout(loadTimeout)
    }
  }, [loadTimeout])

  useEffect(() => {
    if (!isStarted || hasError) return

    const container = playerContainerRef.current
    if (!container) return

    const handleActivity = () => showUiAndResetTimer()
    const events = ["mouseenter", "mousemove", "click", "touchstart"] as const
    events.forEach((event) => container.addEventListener(event, handleActivity))

    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (container.contains(e.target as Node)) {
        showUiAndResetTimer()
      }
    }
    window.addEventListener("mousemove", handleGlobalMouseMove, { passive: true })

    showUiAndResetTimer()

    return () => {
      events.forEach((event) => container.removeEventListener(event, handleActivity))
      window.removeEventListener("mousemove", handleGlobalMouseMove)
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

  // --- 1. ПРЯМОЙ ПОИСК КНОПКИ KODIK В DOM (#right-block .fp-skip-button.active) ---
  useEffect(() => {
    if (!isStarted) return

    const checkDom = () => {
      try {
        const frame = playerContainerRef.current?.querySelector("iframe")
        const doc = frame?.contentDocument || frame?.contentWindow?.document
        if (!doc) return

        // Реальный <video> — самый надёжный источник времени/длительности
        // (работает, когда плеер открыт через наш прокси и DOM доступен).
        // Рекламные ролики короче серии, поэтому берём видео с максимальной
        // длительностью и не доверяем ничему короче 2 минут.
        const videos = Array.from(doc.querySelectorAll<HTMLVideoElement>("video"))
        let mainVideo: HTMLVideoElement | null = null
        for (const video of videos) {
          const dur = Number(video.duration)
          if (!Number.isFinite(dur) || dur < 120) continue
          if (!mainVideo || dur > Number(mainVideo.duration)) mainVideo = video
        }
        if (mainVideo) {
          const realDuration = parseSeconds(mainVideo.duration)
          if (realDuration && realDuration >= 120) durationRef.current = realDuration

          const realCurrent = parseSeconds(mainVideo.currentTime)
          if (realCurrent !== undefined) {
            lastSecondsRef.current = realCurrent
            hasTimeRef.current = true
            setTimeLeftSeconds((prev) => {
              const left = Math.max(0, durationRef.current - realCurrent)
              return prev === left ? prev : left
            })
          }
          isPlayingRef.current = !mainVideo.paused
        }

        // Поиск кнопки: <div id="right-block"><div class="fp-skip-button active" data-seek-to="1436">Пропустить эндинг</div></div>
        const skipButtons = doc.querySelectorAll<HTMLElement>(
          "#right-block .fp-skip-button, .fp-skip-button, [class*='skip-button']"
        )

        let isEndingActiveNow = false
        let detectedSeekTo: number | undefined

        skipButtons.forEach((btn) => {
          const text = (btn.textContent || "").toLowerCase().trim()

          // СТРОГО ИСКЛЮЧАЕМ ОПЕНИНГ
          if (text.includes("опенинг") || text.includes("opening")) {
            return
          }

          // Проверяем, что это именно кнопка пропуска эндинга
          if (text.includes("эндинг") || text.includes("ending") || text.includes("титр")) {
            const isActive =
              btn.classList.contains("active") ||
              (btn.offsetParent !== null && window.getComputedStyle(btn).display !== "none")

            if (isActive) {
              isEndingActiveNow = true
              const seekAttr = btn.getAttribute("data-seek-to")
              if (seekAttr) {
                const parsed = parseSeconds(seekAttr)
                if (parsed) detectedSeekTo = parsed
              }
            }
          }
        })

        // Маркеры cuepoints на полосе прогресса
        const cueNodes = doc.querySelectorAll<HTMLElement>(
          ".fp-cuepoint, [class*='cuepoint'], [title*='ндинг'], [data-title*='ндинг']"
        )
        cueNodes.forEach((node) => {
          const title = (
            node.getAttribute("title") ||
            node.getAttribute("data-title") ||
            node.getAttribute("data-original-title") ||
            node.textContent ||
            ""
          ).toLowerCase()

          if (title.includes("опенинг") || title.includes("opening")) return

          if (title.includes("эндинг") || title.includes("ending") || title.includes("титр")) {
            const match = title.match(/(\d{1,2}:\d{2}(?::\d{2})?)/)
            if (match && match[1]) {
              const parsed = parseSeconds(match[1])
              if (parsed && parsed > 60) {
                if (!endingRangeRef.current || endingRangeRef.current.start !== parsed) {
                  endingRangeRef.current = { start: parsed, end: endingRangeRef.current?.end }
                }
              }
            }
          }
        })

        if (isEndingActiveNow) {
          isDomEndingActiveRef.current = true
          if (detectedSeekTo && endingRangeRef.current) {
            endingRangeRef.current.end = detectedSeekTo
          } else if (lastSecondsRef.current > 60 && !endingRangeRef.current) {
            endingRangeRef.current = { start: lastSecondsRef.current, end: detectedSeekTo }
          }
        } else {
          isDomEndingActiveRef.current = false
        }

        // Кнопка в DOM сама по себе ничего не значит: она есть в разметке
        // с самого начала. Решаем по времени воспроизведения.
        if (
          isEndingReached({
            currentSec: hasTimeRef.current ? lastSecondsRef.current : null,
            watchedWallSec: watchedWallSeconds(),
            duration: durationRef.current || null,
            endingRange: endingRangeRef.current,
            domSkipActive: isDomEndingActiveRef.current,
            videoEnded: videoEndedRef.current,
            isPlaying: isPlayingRef.current,
          })
        ) {
          setIsNearEnd(true)
        } else if (
          isSeekedBackBeforeEnding({
            currentSec: hasTimeRef.current ? lastSecondsRef.current : null,
            duration: durationRef.current || null,
            endingRange: endingRangeRef.current,
          })
        ) {
          setIsNearEnd(false)
          setIsDismissedEnd(false)
          videoEndedRef.current = false
        }
      } catch {
        // Cross-Origin ограничения
      }
    }

    const interval = setInterval(checkDom, 400)
    return () => clearInterval(interval)
  }, [isStarted, watchedWallSeconds])

  // --- 2. ОБРАБОТЧИК POSTMESSAGE СОБЫТИЙ KODIK ---
  useEffect(() => {
    if (!isStarted) return

    let lastSavedTimeStr = ""

    const handleMessage = (event: MessageEvent) => {
      try {
        let data = event.data
        if (typeof data === "string") {
          try {
            data = JSON.parse(data)
          } catch {
            return
          }
        }

        if (!data || typeof data !== "object") return

        const key = data.key || data.type || data.event
        const value = data.value !== undefined ? data.value : data.data !== undefined ? data.data : data

        // Пришло ли сообщение из нашего плеера. Посторонние окна
        // (рекламные фреймы, счётчики, виджеты) тоже шлют postMessage,
        // и их `ended`/`duration` ломали определение конца серии.
        const playerWindow =
          playerContainerRef.current?.querySelector("iframe")?.contentWindow ?? null
        const isFromPlayerWindow = !playerWindow || event.source === playerWindow
        const isKodikEvent = typeof key === "string" && key.toLowerCase().startsWith("kodik")

        if (!isFromPlayerWindow && !isKodikEvent) return

        // Извлечение меток эндинга из любого пришедшего сообщения
        const detectedEnding = extractEndingTimings(value) || extractEndingTimings(data)
        if (detectedEnding) {
          endingRangeRef.current = detectedEnding
        }

        // Состояние воспроизведения (нужно, чтобы не показывать плашку на паузе)
        const keyStr = typeof key === "string" ? key.toLowerCase() : ""
        if (keyStr.includes("pause")) {
          isPlayingRef.current = false
        } else if (keyStr.includes("play") || keyStr.includes("start") || keyStr.includes("resume")) {
          isPlayingRef.current = true
        }

        // Текущий сезон — уточняет границу доступных серий
        const seasonNum = Number(value?.season)
        if (Number.isFinite(seasonNum) && seasonNum > 0) {
          const normalizedSeason = Math.floor(seasonNum)
          setCurrentSeason((prev) => (prev === normalizedSeason ? prev : normalizedSeason))
        }

        // Общая длительность видео
        const possibleDuration =
          parseSeconds(value?.duration) ??
          parseSeconds(value?.total) ??
          parseSeconds(value?.video_duration) ??
          parseSeconds(data?.duration) ??
          parseSeconds(data?.total)

        if (possibleDuration && possibleDuration >= 120) {
          durationRef.current = possibleDuration
        }

        // Текущее время воспроизведения
        const currentSec =
          parseSeconds(value?.seconds) ??
          parseSeconds(value?.time) ??
          parseSeconds(value?.currentTime) ??
          parseSeconds(data?.seconds) ??
          parseSeconds(data?.time)

        const curDuration = durationRef.current
        const endingRange = endingRangeRef.current

        const promptState = (overrides: Partial<Parameters<typeof isEndingReached>[0]> = {}) => ({
          currentSec: hasTimeRef.current ? lastSecondsRef.current : null,
          watchedWallSec: watchedWallSeconds(),
          duration: curDuration || null,
          endingRange,
          domSkipActive: isDomEndingActiveRef.current,
          videoEnded: videoEndedRef.current,
          isPlaying: isPlayingRef.current,
          ...overrides,
        })

        // Событие окончания серии. Именно серии: ended от преролла
        // сюда не пропускаем (см. isVideoEndedEvent).
        if (isVideoEndedEvent(key) && isFromPlayerWindow) {
          videoEndedRef.current = true
          if (isEndingReached(promptState({ videoEnded: true }))) {
            setIsNearEnd(true)
            setTimeLeftSeconds(0)
          }
        }

        if (typeof currentSec === "number") {
          lastSecondsRef.current = currentSec
          hasTimeRef.current = true

          if (curDuration > 0) {
            const left = Math.max(0, curDuration - currentSec)
            setTimeLeftSeconds(left)
          }

          // Перемотали назад — плашку снимаем
          if (isSeekedBackBeforeEnding(promptState())) {
            setIsNearEnd(false)
            setIsDismissedEnd(false)
            videoEndedRef.current = false
          }

          // --- ОПРЕДЕЛЕНИЕ КОНЦА СЕРИИ ---
          // Плашка показывается ТОЛЬКО если пройдены оба условия:
          //   1. время воспроизведения уже в зоне, где эндинг возможен
          //      (не раньше 60-й секунды и не раньше 45% серии);
          //   2. есть сигнал конца: ended / кнопка в DOM / маркер эндинга /
          //      последние 90 секунд серии.
          if (isEndingReached(promptState())) {
            setIsNearEnd(true)
          }
        }

        // Обновление номера серии (Kodik сам может переключить серию
        // внутри iframe — например, по своему плейлисту после эндинга)
        let newEpisode: number | undefined
        if (key === "kodik_player_current_episode" || key === "episode") {
          newEpisode = typeof value?.episode === "number" ? value.episode : typeof value === "number" ? value : undefined
        }

        // Синхронизация смены серии без двойных вызовов.
        // Серия, которой нет в выбранной озвучке/на сайте, наружу не уходит —
        // иначе родитель поставит номер, под которым плеер ничего не найдёт.
        const isEpisodeKnown =
          maxAvailableEpisode === undefined || (newEpisode !== undefined && newEpisode <= maxAvailableEpisode)

        if (newEpisode && newEpisode > 0 && newEpisode !== episode && isEpisodeKnown) {
          if (targetEpisodeRef.current !== newEpisode) {
            targetEpisodeRef.current = newEpisode
            pendingEpisodeRef.current = newEpisode
            onEpisodeChange?.(newEpisode)
          }
        } else if (newEpisode && newEpisode > 0 && newEpisode !== episode && !isEpisodeKnown) {
          setNotice(
            `Серия ${newEpisode} недоступна в озвучке «${selectedTranslation?.title || "текущая"}»`
          )
        }

        // Прогресс
        let timeStr: string | undefined
        if (typeof currentSec === "number" && currentSec > 0 && currentSec <= 86400) {
          const mins = Math.floor(currentSec / 60)
          const secs = Math.floor(currentSec % 60)
          timeStr = `${mins}:${secs.toString().padStart(2, "0")}`
        }

        if (timeStr && timeStr !== lastSavedTimeStr) {
          lastSavedTimeStr = timeStr
          onProgressUpdate?.({
            episode: newEpisode || episode,
            season: value?.season,
            time: timeStr,
            translation: value?.translation?.title || selectedTranslation?.title,
            currentTime: currentSec,
            duration: curDuration || parseSeconds(value?.duration),
          })
        }
      } catch (error) {
        console.warn("Error parsing Kodik message:", error)
      }
    }

    window.addEventListener("message", handleMessage)
    return () => {
      window.removeEventListener("message", handleMessage)
    }
  }, [
    isStarted,
    episode,
    maxAvailableEpisode,
    onEpisodeChange,
    onProgressUpdate,
    selectedTranslation,
    watchedWallSeconds,
  ])

  return (
    <div
      ref={playerContainerRef}
      className={`relative aspect-video w-full overflow-hidden rounded-xl sm:rounded-2xl bg-zinc-950 border border-white/5 shadow-2xl ${
        showUi ? "cursor-default" : "cursor-none"
      }`}
      style={{ paddingTop: "env(safe-area-inset-top)", ...(isFullscreen ? { overflow: "visible" } : {}) }}
    >
      {!isStarted ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center cursor-default">
          <div className="z-20 absolute top-2 right-2 sm:top-4 sm:right-4">
            <RegionDetector onCountryChange={handleCountryChange} onRegionDetected={onRegionDetected} />
          </div>

          {translations.length > 0 && (
            <div className="absolute top-2 left-2 sm:top-4 sm:left-4 z-20 max-w-[55%] sm:max-w-[240px]">
              <button
                ref={triggerButtonRef}
                onClick={() => (showTranslationsMenu ? setShowTranslationsMenu(false) : openMenu())}
                className="flex items-center gap-1.5 sm:gap-2 px-2.5 py-1.5 sm:px-3 sm:py-2 bg-zinc-900/90 backdrop-blur-sm border border-white/10 rounded-lg text-xs sm:text-sm text-white hover:bg-zinc-800 transition-colors min-h-[38px] w-full cursor-pointer"
              >
                {selectedTranslation?.type === "subtitles" ? (
                  <Subtitles className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0 text-blue-400" />
                ) : (
                  <Mic className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0 text-orange-400" />
                )}
                <span className="truncate flex-1 text-left">
                  {selectedTranslation?.title || "Выбрать озвучку"}
                </span>
                <ChevronDown className={`w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0 transition-transform ${showTranslationsMenu ? "rotate-180" : ""}`} />
              </button>
            </div>
          )}

          {translationsLoading && translations.length === 0 && (
            <div className="absolute top-2 left-2 sm:top-4 sm:left-4 z-20 px-2.5 py-2 bg-zinc-900/90 backdrop-blur-sm border border-white/10 rounded-lg text-xs text-zinc-400">
              Загрузка озвучек...
            </div>
          )}

          <div
            className="flex-1 flex items-center justify-center group cursor-pointer w-full"
            onClick={handleStartPlayer}
          >
            <img
              src={poster ? getProxiedSrc(poster) : undefined}
              className="absolute inset-0 w-full h-full object-cover opacity-30 blur-sm transition-opacity group-hover:opacity-40"
              alt=""
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

            <button className="relative z-10 flex items-center gap-2 sm:gap-3 px-4 py-2.5 sm:px-8 sm:py-4 bg-orange-600 hover:bg-orange-500 active:bg-orange-700 text-white rounded-xl sm:rounded-2xl font-bold transition-all transform group-hover:scale-105 group-active:scale-95 shadow-[0_0_30px_rgba(234,88,12,0.4)] min-h-[44px] sm:min-h-[48px] cursor-pointer">
              <svg className="w-4 h-4 sm:w-6 sm:h-6 fill-current flex-shrink-0" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
              <span className="text-xs sm:text-sm md:text-base">Смотреть {episode} серию</span>
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Интерактивный оверлей */}
          <div
            className={`absolute inset-0 z-20 bg-transparent transition-opacity duration-300 ${
              showUi ? "pointer-events-none opacity-0" : "pointer-events-auto opacity-0 cursor-default"
            }`}
            onClick={showUiAndResetTimer}
            onMouseMove={showUiAndResetTimer}
          />

          {/* Зоны двойного тапа */}
          <div
            className={`absolute left-0 top-12 bottom-16 w-[40px] z-30 cursor-pointer pointer-events-auto touch-none transition-opacity duration-300 ${
              showUi ? "opacity-100" : "opacity-0 pointer-events-none"
            }`}
            onClick={(e) => {
              const isDouble = handleDoubleTap()
              if (isDouble) e.stopPropagation()
            }}
          >
            {showFullscreenHint && (
              <div className="absolute inset-0 bg-orange-500/20 animate-pulse border-r border-orange-500/50 flex items-center justify-center">
                <div className="rotate-[-90deg] whitespace-nowrap text-[9px] font-bold text-orange-400 uppercase tracking-widest">
                  Тапни дважды
                </div>
              </div>
            )}
          </div>
          <div
            className={`absolute right-0 top-12 bottom-16 w-[40px] z-30 cursor-pointer pointer-events-auto touch-none transition-opacity duration-300 ${
              showUi ? "opacity-100" : "opacity-0 pointer-events-none"
            }`}
            onClick={(e) => {
              const isDouble = handleDoubleTap()
              if (isDouble) e.stopPropagation()
            }}
          >
            {showFullscreenHint && (
              <div className="absolute inset-0 bg-orange-500/20 animate-pulse border-l border-orange-500/50 flex items-center justify-center">
                <div className="rotate-[90deg] whitespace-nowrap text-[9px] font-bold text-orange-400 uppercase tracking-widest">
                  Тапни дважды
                </div>
              </div>
            )}
          </div>

          {/* Выбор озвучки в плеере */}
          {showUi && translations.length > 0 && (
            <div
              className={`absolute top-2 left-2 sm:top-3 sm:left-3 z-30 max-w-[50%] sm:max-w-[200px] transition-opacity duration-300 ${
                showUi ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
              }`}
            >
              <button
                ref={triggerButtonRef}
                onClick={() => (showTranslationsMenu ? setShowTranslationsMenu(false) : openMenu())}
                className="flex items-center gap-1.5 sm:gap-2 px-2 py-1.5 sm:px-3 bg-black/80 backdrop-blur-md border border-white/10 rounded-lg text-[11px] sm:text-xs text-white hover:bg-black/95 active:bg-black transition-colors min-h-[32px] sm:min-h-[36px] w-full cursor-pointer"
              >
                {selectedTranslation?.type === "subtitles" ? (
                  <Subtitles className="w-3.5 h-3.5 flex-shrink-0 text-blue-400" />
                ) : (
                  <Mic className="w-3.5 h-3.5 flex-shrink-0 text-orange-400" />
                )}
                <span className="truncate flex-1 text-left">
                  {selectedTranslation?.title || "Озвучка"}
                </span>
                <ChevronDown className={`w-3 h-3 flex-shrink-0 transition-transform ${showTranslationsMenu ? "rotate-180" : ""}`} />
              </button>
            </div>
          )}

          {/* Служебная подсказка (серии нет в озвучке, переход не удался) */}
          {notice && (
            <div className="absolute top-14 right-2.5 sm:top-3 sm:right-5 z-40 max-w-[calc(100%-1.25rem)] sm:max-w-sm animate-in fade-in zoom-in-95 duration-300 pointer-events-auto">
              <div className="flex items-start gap-2 bg-zinc-950/95 backdrop-blur-md border border-orange-500/40 rounded-lg px-2.5 py-2 shadow-[0_8px_30px_rgba(0,0,0,0.85)]">
                <Info className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-orange-400 flex-shrink-0 mt-0.5" />
                <p className="text-[10px] sm:text-xs text-zinc-200 leading-snug">{notice}</p>
                <button
                  onClick={() => setNotice(null)}
                  className="text-zinc-500 hover:text-white transition-colors flex-shrink-0 cursor-pointer"
                  aria-label="Скрыть уведомление"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/*
            ПЛАШКА СЛЕДУЮЩЕЙ СЕРИИ
            Показывается только в зоне эндинга: не раньше 60-й секунды
            и не раньше 45% серии. Сигналы конца: ended именно серии,
            активная кнопка «Пропустить эндинг» в DOM, маркер эндинга
            или последние 90 секунд серии. Правила — в lib/kodik-player-logic.ts.
            Если следующей серии нет — вместо кнопки честно об этом говорим.
          */}
          {isStarted && isNearEnd && !isDismissedEnd && (
            <div className="absolute top-2.5 right-2.5 sm:top-auto sm:bottom-28 md:bottom-32 sm:right-5 z-40 max-w-[calc(100%-4.5rem)] sm:max-w-xs animate-in fade-in zoom-in-95 sm:slide-in-from-bottom-3 duration-300 pointer-events-auto">
              <div
                className={`flex items-center bg-zinc-950/95 sm:bg-zinc-900/95 backdrop-blur-md border rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.85)] overflow-hidden transition-all group ${
                  hasNextEpisode
                    ? "border-white/15 sm:border-white/20 hover:border-orange-500/60"
                    : "border-white/10"
                }`}
              >
                {hasNextEpisode ? (
                  <button
                    onClick={handleNextEpisode}
                    className="flex items-center gap-2 sm:gap-2.5 px-2.5 py-1.5 sm:px-3.5 sm:py-2.5 hover:bg-white/10 active:bg-white/15 transition-colors text-left flex-1 min-w-0 cursor-pointer"
                  >
                    <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg bg-orange-600 group-hover:bg-orange-500 flex items-center justify-center text-white shadow-[0_0_12px_rgba(234,88,12,0.5)] transition-transform group-hover:scale-105 flex-shrink-0">
                      <SkipForward className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-current" />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <div className="text-[11px] sm:text-xs md:text-sm font-bold text-white flex items-center gap-1.5 truncate">
                        <span className="truncate">Следующая серия</span>
                        <span className="text-[10px] sm:text-xs px-1.5 py-0.2 sm:py-0.5 rounded bg-orange-500/20 text-orange-400 border border-orange-500/30 font-mono flex-shrink-0">
                          {nextEpisodeNumber}
                        </span>
                      </div>
                      {typeof timeLeftSeconds === "number" && timeLeftSeconds > 0 && (
                        <div className="text-[9px] sm:text-[11px] text-zinc-400 flex items-center gap-1 mt-0.5">
                          <Clock className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-zinc-500 flex-shrink-0" />
                          <span>
                            До конца: {Math.floor(timeLeftSeconds / 60)}:
                            {(timeLeftSeconds % 60).toString().padStart(2, "0")}
                          </span>
                        </div>
                      )}
                    </div>
                  </button>
                ) : nextEpisodeFallback ? (
                  /* В этой озвучке серии нет, но есть в другой — предлагаем её */
                  <button
                    onClick={handleNextEpisode}
                    className="flex items-center gap-2 sm:gap-2.5 px-2.5 py-1.5 sm:px-3.5 sm:py-2.5 hover:bg-white/10 active:bg-white/15 transition-colors text-left flex-1 min-w-0 cursor-pointer"
                  >
                    <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg bg-orange-600 group-hover:bg-orange-500 flex items-center justify-center text-white shadow-[0_0_12px_rgba(234,88,12,0.5)] transition-transform group-hover:scale-105 flex-shrink-0">
                      <SkipForward className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-current" />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <div className="text-[11px] sm:text-xs md:text-sm font-bold text-white flex items-center gap-1.5 truncate">
                        <span className="truncate">Следующая серия</span>
                        <span className="text-[10px] sm:text-xs px-1.5 py-0.2 sm:py-0.5 rounded bg-orange-500/20 text-orange-400 border border-orange-500/30 font-mono flex-shrink-0">
                          {nextEpisodeNumber}
                        </span>
                      </div>
                      <div className="text-[9px] sm:text-[11px] text-zinc-400 truncate mt-0.5">
                        Нет в этой озвучке · есть в «{nextEpisodeFallback.title}»
                      </div>
                    </div>
                  </button>
                ) : (
                  <div className="flex items-center gap-2 sm:gap-2.5 px-2.5 py-1.5 sm:px-3.5 sm:py-2.5 text-left flex-1 min-w-0">
                    <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg bg-zinc-700/80 flex items-center justify-center text-zinc-300 flex-shrink-0">
                      <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <div className="text-[11px] sm:text-xs md:text-sm font-bold text-white truncate">
                        {maxAvailableEpisode && episode >= maxAvailableEpisode
                          ? `Серия ${episode} — последняя доступная`
                          : "Дальше серий пока нет"}
                      </div>
                      <div className="text-[9px] sm:text-[11px] text-zinc-400 truncate mt-0.5">
                        {maxAvailableEpisode
                          ? `Доступно серий: ${maxAvailableEpisode}`
                          : "Следите за обновлениями"}
                      </div>
                    </div>
                  </div>
                )}

                <div className="w-[1px] h-6 bg-white/10 flex-shrink-0" />

                <button
                  onClick={handleDismissNearEnd}
                  className="px-2 sm:px-2.5 self-stretch flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 active:bg-white/15 transition-colors flex-shrink-0 cursor-pointer"
                  title="Скрыть"
                  aria-label="Скрыть подсказку"
                >
                  <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>
              </div>
            </div>
          )}

          {isLoading && !hasError && (
            <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/40 backdrop-blur-xs cursor-default">
              <PlayerLoading />
            </div>
          )}

          {hasError ? (
            <div className="absolute inset-0 z-50 flex flex-col items-center justify-center text-zinc-400 gap-3 sm:gap-4 bg-zinc-900 p-4 sm:p-6 cursor-default">
              <AlertCircle className="w-10 h-10 sm:w-12 sm:h-12 text-red-500 flex-shrink-0" />
              <div className="text-center">
                <p className="text-base sm:text-lg font-medium text-white mb-2">Плеер недоступен</p>
                <p className="text-xs sm:text-sm text-zinc-400 mb-4 px-2">
                  {errorMessage || "Проверьте подключение к интернету или попробуйте другую озвучку"}
                </p>
                <div className="flex flex-col gap-3">
                  <button
                    onClick={() => {
                      setIsStarted(false)
                      setHasError(false)
                      setErrorMessage("")
                      setIsLoading(true)
                    }}
                    className="text-orange-500 hover:underline active:opacity-70 text-sm min-h-[40px] py-2 cursor-pointer"
                  >
                    Попробовать снова
                  </button>
                  {translations.length > 1 && (
                    <button
                      onClick={() => {
                        setShowTranslationsMenu(true)
                        setHasError(false)
                        setErrorMessage("")
                      }}
                      className="text-blue-400 hover:underline active:opacity-70 text-sm min-h-[40px] py-2 cursor-pointer"
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
              className={`h-full w-full transition-opacity duration-500 ${isLoading ? "opacity-0" : "opacity-100"}`}
              allow="autoplay; encrypted-media; fullscreen; picture-in-picture; screen-wake-lock"
              allowFullScreen
              sandbox="allow-scripts allow-same-origin allow-forms allow-presentation"
              onLoad={() => {
                setIsLoading(false)
                if (loadTimeout) {
                  clearTimeout(loadTimeout)
                  setLoadTimeout(null)
                }
              }}
              onError={() => {
                setIsLoading(false)
              }}
            />
          )}
        </>
      )}

      {renderTranslationsPortal()}
    </div>
  )
}