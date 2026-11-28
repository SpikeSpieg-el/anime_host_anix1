"use client"

import {
  useEffect,
  useState,
  useRef,
  useCallback,
  useMemo,
  type CSSProperties,
} from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import {
  Bookmark,
  Calendar,
  Eye,
  Layers,
  PlayCircle,
  Star,
} from "lucide-react"
import type { Anime } from "@/lib/shikimori"
import { KodikPlayer } from "@/components/watch/kodik-player"
import { HentaiPlayer } from "@/components/watch/hentai-player"
import { EpisodeSelector } from "@/components/watch/episode-selector"
import { RegionWarning } from "@/components/shared/region-warning"
import { recordWatchStart } from "@/components/providers/history-tracker"
import { activityRecorder } from "@/components/providers/account-stats-recorder"
import { Button } from "@/components/ui/button"
import { useBookmarks } from "@/components/providers/bookmarks-provider"
import { useCover } from "@/components/providers/cover-provider"
import { isPlaceholderPoster, shouldRecoverPoster } from "@/lib/poster-url"
import { useAuth } from "@/components/auth/auth-provider"
import { isHentaiContent } from "@/lib/hentai-detector"
import { AgeRatingBadge } from "@/components/watch/age-rating-badge"
import { getAgeRatingInfo } from "@/lib/age-rating"
import { cleanAnimeTitle } from "@/lib/seo/watch-url"
import { PageBreadcrumbs } from "@/components/shared/page-breadcrumbs"
import { WatchPageGallery } from "@/components/watch/watch-page-gallery"
import { CoverModal } from "@/components/watch/cover-modal"
import { FloatingNav } from "@/components/layout/floating-nav"
import { AuthPromptBanner } from "@/components/watch/auth-prompt-banner"
import { BoostyBanner } from "@/components/watch/boosty-banner"
import {
  PendingSubscribeOnMount,
  TitleSubscribeButton,
} from "@/components/shared/title-subscribe-button"
import { cn } from "@/lib/utils"
import { AnalyticsEvent, trackEvent } from "@/lib/analytics"
import { useExitIntent } from "@/hooks/use-exit-intent"
import { GuestHookId, canShowGuestHook } from "@/lib/guest-hooks"

interface WatchPageClientProps {
  anime: Anime
  initialEpisode?: number
}

const getEpisodeText = (count: number): string => {
  if (count === 1) return "Серия"
  const lastDigit = count % 10
  const lastTwoDigits = count % 100

  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) return "Серий"
  if (lastDigit === 1) return "Серия"
  if (lastDigit >= 2 && lastDigit <= 4) return "Серии"
  return "Серий"
}

// Винительная форма для «смотрю N …»: 1 серию, 2 серии, 5 серий.
const getWatchingEpisodeText = (count: number): string => {
  const lastDigit = count % 10
  const lastTwoDigits = count % 100

  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) return "серий"
  if (lastDigit === 1) return "серию"
  if (lastDigit >= 2 && lastDigit <= 4) return "серии"
  return "серий"
}

function buildNotchedCardPath(
  w: number,
  h: number,
  tabW: number,
  tabH: number,
  outerR: number,
  notchR: number,
  inset = 0,
): string {
  const xL = inset
  const xR = w - inset
  const yT = inset
  const yB = h - inset
  const yStep = tabH + inset

  const R = Math.max(4, Math.min(outerR - inset, (h - tabH) / 2, w / 4))
  const rOut = Math.max(4, Math.min(notchR - inset, tabH / 2))
  const rIn = Math.max(4, Math.min(notchR + inset, tabH / 2))

  const minTabW = R + rOut + 8
  const clampedTabW = Math.max(minTabW, Math.min(tabW, w - R - rIn - 16))
  const xNotch = w - clampedTabW + inset

  return [
    `M ${xL + R} ${yStep}`,
    `L ${xNotch - rIn} ${yStep}`,
    `A ${rIn} ${rIn} 0 0 0 ${xNotch} ${yStep - rIn}`,
    `L ${xNotch} ${yT + rOut}`,
    `A ${rOut} ${rOut} 0 0 1 ${xNotch + rOut} ${yT}`,
    `L ${xR - R} ${yT}`,
    `A ${R} ${R} 0 0 1 ${xR} ${yT + R}`,
    `L ${xR} ${yB - R}`,
    `A ${R} ${R} 0 0 1 ${xR - R} ${yB}`,
    `L ${xL + R} ${yB}`,
    `A ${R} ${R} 0 0 1 ${xL} ${yB - R}`,
    `L ${xL} ${yStep + R}`,
    `A ${R} ${R} 0 0 1 ${xL + R} ${yStep}`,
    "Z",
  ].join(" ")
}

export function WatchPageClient({ anime, initialEpisode }: WatchPageClientProps) {
  const availableEpisodes = useMemo(() => {
    if (anime.episodesCurrent && anime.episodesCurrent > 0) {
      return anime.episodesCurrent
    }
    if (anime.episodesTotal && anime.episodesTotal > 0) {
      return anime.episodesTotal
    }
    return 1
  }, [anime.episodesCurrent, anime.episodesTotal])

  const totalPlannedEpisodes = anime.episodesTotal || availableEpisodes
  const ageRating = getAgeRatingInfo(anime.shikimoriRating)

  const { user, profile } = useAuth()
  const { isSaved, toggle } = useBookmarks()
  const saved = isSaved(anime.id)

  const [selectedEpisode, setSelectedEpisode] = useState<number>(() => {
    const requested = initialEpisode || 1
    return Math.min(Math.max(1, requested), availableEpisodes)
  })

  const [isStarted, setIsStarted] = useState(false)
  const [selectedCountry, setSelectedCountry] = useState<string>("RU")
  const [isRegionDetected, setIsRegionDetected] = useState(false)
  const [isUpdatingFromPlayer, setIsUpdatingFromPlayer] = useState(false)
  const [posterLoading, setPosterLoading] = useState(true)
  const [isCoverModalOpen, setIsCoverModalOpen] = useState(false)

  const { getPoster, forgetPoster } = useCover()
  const [poster, setPoster] = useState(anime.poster)
  const getPosterRef = useRef(getPoster)
  getPosterRef.current = getPoster
  const forgetPosterRef = useRef(forgetPoster)
  forgetPosterRef.current = forgetPoster
  const recoveryAttemptedRef = useRef(false)
  const MAX_POSTER_RETRIES = 2
  const posterRetriesRef = useRef(0)

  useEffect(() => {
    setPoster(anime.poster)
    setPosterLoading(true)
    recoveryAttemptedRef.current = false
    posterRetriesRef.current = 0
  }, [anime.id, anime.poster])

  const recoverPoster = useCallback(async () => {
    if (recoveryAttemptedRef.current || posterRetriesRef.current >= MAX_POSTER_RETRIES) return
    recoveryAttemptedRef.current = true
    posterRetriesRef.current += 1

    const animeId = String(anime.shikimoriId || anime.id)
    try {
      const recovered = await getPosterRef.current(
        animeId,
        "",
        anime.originalTitle || anime.title,
        anime.title,
        false,
        true,
      )
      if (!recovered || isPlaceholderPoster(recovered)) {
        forgetPosterRef.current(animeId)
        return
      }
      setPoster(recovered)
    } catch (error) {
      console.warn(`[WatchPage] Не удалось подобрать обложку для ${animeId}:`, error)
    }
  }, [anime.id, anime.shikimoriId, anime.originalTitle, anime.title])

  useEffect(() => {
    if (shouldRecoverPoster(poster)) recoverPoster()
  }, [poster, recoverPoster])

  const handlePosterError = useCallback(() => {
    setPosterLoading(false)
    if (isPlaceholderPoster(poster)) return
    if (posterRetriesRef.current >= MAX_POSTER_RETRIES) return
    forgetPosterRef.current(String(anime.shikimoriId || anime.id))
    recoveryAttemptedRef.current = false
    recoverPoster()
  }, [poster, anime.id, anime.shikimoriId, recoverPoster])

  const [lastWatchedInfo, setLastWatchedInfo] = useState<{
    season?: number
    episode: number
    time?: string
    translation?: string
  } | null>(null)

  const { showExitPrompt, dismissPrompt: dismissExitPrompt } = useExitIntent({
    enabled: isStarted,
    minWatchTime: 30,
  })

  const [showStarterHook, setShowStarterHook] = useState(false)
  const [showDeckHook, setShowDeckHook] = useState(false)
  const starterHookArmed = useRef(false)

  // Мягкое затухание краёв скролла жанров через CSS mask-image
  // (не конфликтует с размытым фоном карточки в светлой и тёмной темах).
  const genreRowRef = useRef<HTMLDivElement>(null)
  const [genreFade, setGenreFade] = useState<{ left: boolean; right: boolean }>({
    left: false,
    right: false,
  })

  const updateGenreFade = useCallback(() => {
    const el = genreRowRef.current
    if (!el) return
    const max = el.scrollWidth - el.clientWidth
    setGenreFade({
      left: el.scrollLeft > 4,
      right: max > 4 && el.scrollLeft < max - 4,
    })
  }, [])

  useEffect(() => {
    updateGenreFade()
    const el = genreRowRef.current
    if (!el) return
    const onScroll = () => updateGenreFade()
    el.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("resize", onScroll)
    const timer = setTimeout(updateGenreFade, 400)
    return () => {
      el.removeEventListener("scroll", onScroll)
      window.removeEventListener("resize", onScroll)
      clearTimeout(timer)
    }
  }, [updateGenreFade])

  const genreMaskStyle = useMemo<CSSProperties | undefined>(() => {
    if (!genreFade.left && !genreFade.right) return undefined
    const mask =
      genreFade.left && genreFade.right
        ? "linear-gradient(to right, transparent, black 24px, black calc(100% - 24px), transparent)"
        : genreFade.left
          ? "linear-gradient(to right, transparent, black 24px, black)"
          : "linear-gradient(to right, black, black calc(100% - 24px), transparent)"
    return { maskImage: mask, WebkitMaskImage: mask }
  }, [genreFade.left, genreFade.right])

  const headerCardRef = useRef<HTMLElement>(null)
  const headerTabRef = useRef<HTMLDivElement>(null)
  const [notchedShape, setNotchedShape] = useState<{
    w: number
    h: number
    clipPath: string
    strokePath: string
  } | null>(null)

  useEffect(() => {
    const cardEl = headerCardRef.current
    const tabEl = headerTabRef.current
    if (!cardEl || !tabEl) return

    const updateShape = () => {
      const w = cardEl.offsetWidth
      const h = cardEl.offsetHeight
      const tabW = tabEl.offsetWidth
      const tabH = tabEl.offsetHeight
      if (w < 80 || h < 80 || tabW <= 0 || tabH <= 0) return

      const outerR = w < 640 ? 18 : 22
      const notchR = 14
      const clipPath = buildNotchedCardPath(w, h, tabW, tabH, outerR, notchR, 0)
      const strokePath = buildNotchedCardPath(w, h, tabW, tabH, outerR, notchR, 0.5)

      setNotchedShape((prev) =>
        prev && prev.w === w && prev.h === h && prev.clipPath === clipPath
          ? prev
          : { w, h, clipPath, strokePath },
      )
    }

    updateShape()
    const observer = new ResizeObserver(updateShape)
    observer.observe(cardEl)
    observer.observe(tabEl)
    return () => observer.disconnect()
  }, [])

  const playerRef = useRef<HTMLDivElement>(null)
  const lastRecordedEpisode = useRef("")
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (user || !isStarted || starterHookArmed.current) return
    if (!canShowGuestHook(GuestHookId.STARTER_PACK)) return

    starterHookArmed.current = true
    const timer = window.setTimeout(() => {
      if (document.visibilityState === "hidden") return
      setShowStarterHook(true)
    }, 45_000)

    return () => window.clearTimeout(timer)
  }, [user, isStarted])

  useEffect(() => {
    if (showExitPrompt && !user && canShowGuestHook(GuestHookId.TITLE_DECK)) {
      setShowStarterHook(false)
      setShowDeckHook(true)
    }
  }, [showExitPrompt, user])

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(`last-watched-${anime.id}`)
      if (!stored) return

      const data = JSON.parse(stored)
      if (data && typeof data.episode === "number") {
        setLastWatchedInfo(data)
      }
    } catch {
      // Storage/JSON can be unavailable or corrupt; viewing still works.
    }
  }, [anime.id])

  useEffect(() => {
    if (!isStarted) {
      if (initialEpisode && initialEpisode > 0) {
        setSelectedEpisode(Math.min(initialEpisode, availableEpisodes))
      } else if (lastWatchedInfo?.episode) {
        setSelectedEpisode(Math.min(lastWatchedInfo.episode, availableEpisodes))
      }
    }
  }, [initialEpisode, lastWatchedInfo, isStarted, availableEpisodes])

  useEffect(() => {
    if (!isStarted || isUpdatingFromPlayer) return

    const current = searchParams.get("episode")
    const currentNumber = current ? Number.parseInt(current, 10) : undefined

    if (currentNumber !== selectedEpisode) {
      const next = new URLSearchParams(searchParams.toString())
      next.set("episode", String(selectedEpisode))
      router.replace(`${pathname}?${next.toString()}`, { scroll: false })
    }

    const episodeKey = `${anime.id}:${selectedEpisode}`
    if (episodeKey !== lastRecordedEpisode.current) {
      lastRecordedEpisode.current = episodeKey
      recordWatchStart(
        { id: anime.id, title: anime.title, poster },
        { episode: selectedEpisode, episodesTotal: availableEpisodes },
      )
    }
  }, [
    selectedEpisode,
    isStarted,
    pathname,
    router,
    searchParams,
    anime,
    poster,
    isUpdatingFromPlayer,
    availableEpisodes,
  ])

  const scrollToPlayer = useCallback(() => {
    if (playerRef.current) {
      const yOffset = -80
      const y = playerRef.current.getBoundingClientRect().top + window.pageYOffset + yOffset
      window.scrollTo({ top: y, behavior: "smooth" })
    }
  }, [])

  const handleSelectEpisode = (episode: number) => {
    const safeEpisode = Math.min(Math.max(1, episode), availableEpisodes)
    trackEvent(AnalyticsEvent.EPISODE_CHANGE, {
      shikimori_id: anime.shikimoriId,
      title: anime.title,
      episode: safeEpisode,
    })
    setSelectedEpisode(safeEpisode)
    setIsStarted(true)
    scrollToPlayer()
  }

  const handleCountryChange = (country: string) => {
    setSelectedCountry(country)
    setIsRegionDetected(true)
  }

  const handleRegionDetected = (isRussia: boolean) => {
    setIsRegionDetected(true)
    if (isRussia && selectedCountry === "RU") {
      setSelectedCountry("RU")
    }
  }

  const handleEpisodeChangeFromPlayer = (newEpisode: number) => {
    const safeEpisode = Math.min(Math.max(1, newEpisode), availableEpisodes)
    if (safeEpisode !== selectedEpisode) {
      trackEvent(AnalyticsEvent.EPISODE_CHANGE, {
        shikimori_id: anime.shikimoriId,
        episode: safeEpisode,
        source: "player",
      })
      setIsUpdatingFromPlayer(true)
      setSelectedEpisode(safeEpisode)
      setIsStarted(true)

      setTimeout(() => {
        setIsUpdatingFromPlayer(false)
      }, 150)
    }
  }

  const handleProgressUpdate = (info: {
    season?: number
    episode: number
    time?: string
    translation?: string
  }) => {
    setLastWatchedInfo(info)
    try {
      window.localStorage.setItem(`last-watched-${anime.id}`, JSON.stringify(info))
    } catch {
      // Progress remains available in memory even if persistence is blocked.
    }
  }

  useEffect(() => {
    if (!isStarted) return

    let lastTick = Date.now()
    const tick = () => {
      const now = Date.now()
      const elapsed = Math.min(Math.max(0, now - lastTick), 30_000)
      lastTick = now
      if (document.visibilityState === "visible" && elapsed > 0) {
        activityRecorder.recordWatchTime(elapsed, {
          anime_id: anime.id,
          episode: selectedEpisode,
        })
      }
    }

    const handleVisibility = () => {
      lastTick = Date.now()
    }
    const timer = window.setInterval(tick, 15_000)
    document.addEventListener("visibilitychange", handleVisibility)

    return () => {
      window.clearInterval(timer)
      document.removeEventListener("visibilitychange", handleVisibility)
      activityRecorder.flushWatchTime()
    }
  }, [anime.id, isStarted, selectedEpisode])

  const statusLabel =
    anime.status === "Ongoing"
      ? "Выходит"
      : anime.status === "Announcement"
        ? "Анонс"
        : "Закончен"

  const showOriginalTitle =
    Boolean(anime.originalTitle) && anime.originalTitle !== anime.title

  return (
    <div className="flex flex-col gap-4 sm:gap-6 pt-2 sm:pt-4 mx-auto">
      {/* Navigation & Actions Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <PageBreadcrumbs
          backFallback="/catalog"
          items={[
            { label: "Главная", href: "/" },
            { label: "Каталог", href: "/catalog" },
            { label: cleanAnimeTitle(anime.russian || anime.title) || anime.title },
          ]}
        />

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => toggle(anime)}
            className={cn(
              "gap-2 transition-all border",
              saved
                ? "bg-primary/10 border-primary/50 text-primary hover:bg-primary/20"
                : "bg-card border-border text-muted-foreground hover:text-foreground hover:bg-card/80",
            )}
          >
            <Bookmark className={cn("w-4 h-4", saved && "fill-current")} />
            <span>{saved ? "Сохранено" : "В закладки"}</span>
          </Button>

          <TitleSubscribeButton
            animeId={String(anime.shikimoriId || anime.id)}
            animeTitle={anime.title}
            poster={poster}
            baselineEpisode={availableEpisodes}
          />
        </div>
      </div>

      {/* Header Info Card */}
      <section
        ref={headerCardRef}
        className="relative pt-[50px] px-4 pb-4 sm:pt-[56px] sm:px-6 sm:pb-6 lg:pt-[60px] lg:px-7 lg:pb-7"
      >
        {/* Размытый фон, обрезанный строго по фигурной форме с «ушком» */}
        <div
          className={cn(
            "absolute inset-0 z-0 overflow-hidden bg-card/40 pointer-events-none select-none",
            !notchedShape && "rounded-2xl md:rounded-3xl border border-border/80",
          )}
          style={
            notchedShape
              ? { clipPath: `path("${notchedShape.clipPath}")` }
              : undefined
          }
          aria-hidden="true"
        >
          <Image
            src={poster}
            alt=""
            fill
            className="object-cover scale-125 blur-2xl sm:blur-3xl opacity-25 dark:opacity-30"
            sizes="400px"
            unoptimized={poster.startsWith("data:")}
          />
          <div className="absolute inset-0 bg-gradient-to-br from-background/90 via-background/80 to-background/70 dark:from-zinc-950/90 dark:via-zinc-950/82 dark:to-zinc-950/75" />
          <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-primary/10 to-transparent" />
        </div>

        {/* Единая непрерывная SVG-рамка по всему периметру с вырезом */}
        {notchedShape && (
          <svg
            aria-hidden="true"
            width={notchedShape.w}
            height={notchedShape.h}
            viewBox={`0 0 ${notchedShape.w} ${notchedShape.h}`}
            className="absolute inset-0 z-10 w-full h-full pointer-events-none text-border/80"
          >
            <path
              d={notchedShape.strokePath}
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
            />
          </svg>
        )}

        {/* Верхний правый выступ («ушко») с бейджами */}
        <div
          ref={headerTabRef}
          className="absolute top-0 right-0 z-20 flex items-center gap-1.5 pl-4 pr-3 pt-2 pb-1 sm:pl-5 sm:pr-4 sm:pt-2 sm:pb-1"
        >
          <span
            className={cn(
              "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] md:text-xs font-bold uppercase tracking-wide border",
              anime.status === "Ongoing"
                ? "bg-orange-500/15 border-orange-500/40 text-orange-600 dark:text-orange-400"
                : "bg-background/60 dark:bg-white/[0.06] border-border/80 text-muted-foreground",
            )}
          >
            {anime.status === "Ongoing" && (
              <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
            )}
            {statusLabel}
          </span>

          {ageRating && <AgeRatingBadge rating={anime.shikimoriRating} />}
        </div>

        <div className="relative z-10 grid grid-cols-[auto_minmax(0,1fr)] md:grid-rows-[auto_1fr] gap-x-3.5 sm:gap-x-5 md:gap-x-7 gap-y-4 md:gap-y-3 items-start">
          {/* Poster */}
          <div className="relative shrink-0 md:row-span-2">
            <div
              onClick={() => {
                trackEvent(AnalyticsEvent.COVER_MODAL_OPEN, {
                  shikimori_id: anime.shikimoriId,
                  title: anime.title,
                })
                setIsCoverModalOpen(true)
              }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault()
                  trackEvent(AnalyticsEvent.COVER_MODAL_OPEN, {
                    shikimori_id: anime.shikimoriId,
                    title: anime.title,
                  })
                  setIsCoverModalOpen(true)
                }
              }}
              title="Нажмите, чтобы посмотреть обложку"
              className="group/poster relative w-[104px] sm:w-[132px] md:w-[164px] lg:w-[184px] aspect-[2/3] rounded-xl overflow-hidden shadow-xl bg-muted ring-1 ring-black/10 dark:ring-white/10 cursor-pointer hover:ring-primary/60 hover:shadow-primary/20 transition-all duration-300"
            >
              <Image
                src={poster}
                alt={anime.title}
                fill
                className="object-cover group-hover/poster:scale-105 transition-transform duration-500 ease-out"
                sizes="(max-width: 640px) 110px, (max-width: 1024px) 170px, 190px"
                priority
                unoptimized={poster.startsWith("data:")}
                onLoad={() => setPosterLoading(false)}
                onError={handlePosterError}
              />

              {anime.rating > 0 && (
                <div className="absolute bottom-1.5 left-1.5 md:bottom-2 md:left-2 z-10 pointer-events-none">
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 md:px-2 md:py-0.5 rounded-md bg-black/75 backdrop-blur-sm ring-1 ring-white/10 text-white text-[11px] md:text-xs font-bold shadow-sm">
                    <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                    {anime.rating}
                  </span>
                </div>
              )}

              <div className="absolute inset-0 bg-black/45 opacity-0 group-hover/poster:opacity-100 transition-opacity duration-300 flex flex-col items-center justify-center gap-1 backdrop-blur-[2px]">
                <Eye className="w-5 h-5 md:w-7 md:h-7 text-white drop-shadow-md" />
                <span className="text-[11px] md:text-xs text-white font-medium drop-shadow-md hidden sm:inline-block">
                  Обложка
                </span>
              </div>

              {posterLoading && (
                <div className="absolute inset-0 bg-neutral-200 dark:bg-zinc-800 animate-pulse flex items-center justify-center z-10">
                  <div className="w-6 h-6 rounded-full border-2 border-orange-500/20 border-t-orange-500 animate-spin" />
                </div>
              )}
            </div>
          </div>

          {/* Title */}
          <div className="flex flex-col justify-center min-w-0 self-center md:self-start">
            <h1 className="font-unbounded font-black tracking-tight text-lg sm:text-2xl lg:text-3xl text-foreground leading-[1.2] break-words">
              {anime.title}
            </h1>
          </div>

          {/* Metadata & Genres */}
          <div className="col-span-2 md:col-span-1 flex flex-col gap-2.5 sm:gap-3 min-w-0 pt-3 border-t border-border/60 md:pt-1 md:border-t-0">
            {/* Key Info Strip */}
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              {Boolean(anime.year) && (
                <span className="inline-flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-lg bg-background/70 dark:bg-white/[0.06] backdrop-blur-sm border border-border/80 text-xs sm:text-sm font-semibold text-foreground whitespace-nowrap">
                  <Calendar className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  {anime.year}
                </span>
              )}

              <span className="inline-flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-lg bg-background/70 dark:bg-white/[0.06] backdrop-blur-sm border border-border/80 text-xs sm:text-sm font-semibold text-foreground whitespace-nowrap">
                <Layers className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                {availableEpisodes} / {totalPlannedEpisodes}{" "}
                {getEpisodeText(totalPlannedEpisodes)}
              </span>

              <button
                type="button"
                onClick={scrollToPlayer}
                className="inline-flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-lg bg-primary/15 hover:bg-primary/25 border border-primary/30 text-primary text-xs sm:text-sm font-semibold whitespace-nowrap transition-colors cursor-pointer"
              >
                <PlayCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-primary/20 shrink-0" />
                <span className="sm:hidden">Смотрю: {selectedEpisode}</span>
                <span className="hidden sm:inline">
                  Сейчас смотрю: {selectedEpisode}{" "}
                  {getWatchingEpisodeText(selectedEpisode)}
                </span>
              </button>
            </div>

            {/* Genres */}
            {anime.genres && anime.genres.length > 0 && (
              <div
                ref={genreRowRef}
                style={genreMaskStyle}
                className="flex flex-nowrap md:flex-wrap items-center gap-1.5 sm:gap-2 overflow-x-auto md:overflow-visible no-scrollbar py-0.5"
              >
                {anime.genres.slice(0, 6).map((genre) => (
                  <Link
                    key={genre}
                    href={`/catalog?genre=${encodeURIComponent(
                      String(anime.genreIds?.[genre] ?? genre),
                    )}`}
                    className="shrink-0 inline-flex items-center px-3 py-1 rounded-full bg-background/60 dark:bg-white/[0.05] border border-border/75 hover:border-primary/50 hover:bg-primary/10 text-muted-foreground hover:text-primary text-xs sm:text-[13px] font-medium transition-colors"
                    onClick={() =>
                      trackEvent(AnalyticsEvent.CATALOG_FILTER_CLICK, {
                        filter: "genre",
                        value: genre,
                        location: "watch_page",
                      })
                    }
                  >
                    {genre}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      <PendingSubscribeOnMount
        animeId={String(anime.shikimoriId || anime.id)}
        animeTitle={anime.title}
        poster={poster}
        baselineEpisode={availableEpisodes}
      />

      {/* Player Section */}
      <div id="player" ref={playerRef} className="w-full scroll-mt-24">
        {anime.isNsfw && !profile?.allow_nsfw_search && (
          <div
            role="alert"
            className="mb-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200"
          >
            Внимание: возрастная категория этого тайтла —{" "}
            {ageRating ? `${ageRating.label} (${ageRating.description})` : "18+"}. Вы
            открыли его напрямую; в безопасном поиске такой контент скрыт.
          </div>
        )}
        <RegionWarning
          selectedCountry={selectedCountry}
          isRegionDetected={isRegionDetected}
        />

        <div className="rounded-2xl overflow-hidden border border-border bg-background shadow-2xl relative aspect-video">
          {isHentaiContent(anime) ? (
            <HentaiPlayer
              title={anime.title}
              originalTitle={anime.originalTitle}
              episode={selectedEpisode}
              isActive={true}
              onStart={() => {
                trackEvent(AnalyticsEvent.EPISODE_PLAY, {
                  shikimori_id: anime.shikimoriId,
                  title: anime.title,
                  episode: selectedEpisode,
                  player: "hentai",
                })
                setIsStarted(true)
              }}
            />
          ) : (
            <KodikPlayer
              shikimoriId={anime.shikimoriId}
              title={anime.title}
              poster={poster}
              episode={selectedEpisode}
              maxEpisode={availableEpisodes}
              animeId={anime.id}
              onStart={() => {
                trackEvent(AnalyticsEvent.EPISODE_PLAY, {
                  shikimori_id: anime.shikimoriId,
                  title: anime.title,
                  episode: selectedEpisode,
                  player: "kodik",
                })
                setIsStarted(true)
              }}
              onCountryChange={handleCountryChange}
              onRegionDetected={handleRegionDetected}
              onEpisodeChange={handleEpisodeChangeFromPlayer}
              onProgressUpdate={handleProgressUpdate}
            />
          )}
        </div>
      </div>

      <BoostyBanner />

      {showStarterHook && !user && (
        <AuthPromptBanner
          variant="starter-pack"
          animeId={anime.id}
          animeTitle={anime.title}
          animeStatus={anime.status}
          trigger="watch_first_episode"
          onDismiss={() => setShowStarterHook(false)}
        />
      )}

      {showDeckHook && !user && (
        <AuthPromptBanner
          variant="title-deck"
          animeId={anime.id}
          animeTitle={anime.title}
          animeStatus={anime.status}
          trigger="exit_intent"
          onDismiss={() => {
            setShowDeckHook(false)
            dismissExitPrompt()
          }}
        />
      )}

      {/* Episode Selector */}
      <div
        id="episodes"
        className="bg-card/20 border border-border rounded-2xl p-4 sm:p-6 backdrop-blur-sm"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4 sm:mb-6">
          <h2 className="text-lg md:text-xl font-bold text-foreground">
            Список серий
          </h2>
          <div className="text-xs font-medium px-3 py-1.5 rounded-full bg-muted text-muted-foreground">
            {totalPlannedEpisodes > availableEpisodes ? (
              <>
                Вышло: <span className="text-foreground">{availableEpisodes}</span> из{" "}
                <span className="text-foreground">{totalPlannedEpisodes}</span>
              </>
            ) : (
              <>
                Всего: <span className="text-foreground">{availableEpisodes}</span>
              </>
            )}
          </div>
        </div>

        <EpisodeSelector
          totalEpisodes={availableEpisodes}
          currentEpisode={selectedEpisode}
          onSelectEpisode={handleSelectEpisode}
          lastWatchedInfo={lastWatchedInfo}
        />
      </div>

      {/* Gallery */}
      <WatchPageGallery anime={anime} poster={poster} />

      {/* Cover Modal */}
      <CoverModal
        isOpen={isCoverModalOpen}
        onClose={() => setIsCoverModalOpen(false)}
        imageUrl={poster}
        title={anime.title}
        subtitle={anime.originalTitle || anime.year?.toString()}
      />

      <FloatingNav variant="watch-page" />
    </div>
  )
}