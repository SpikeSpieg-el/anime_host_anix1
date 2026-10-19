"use client"

import { useEffect, useState, useRef, useCallback, useMemo } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import {
  Bookmark,
  PlayCircle,
  Star
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
import { Eye } from "lucide-react"
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

export function WatchPageClient({ anime, initialEpisode }: WatchPageClientProps) {
  // ВЫЧИСЛЕНИЕ РЕАЛЬНО ВЫШЕДШИХ СЕРИЙ:
  // Если у онгоинга вышло 5 серий из 13, то доступно ТОЛЬКО 5 серий.
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

  // Понятная возрастная метка из сырого кода Shikimori (r → «16+», r_plus → «18+ Этти»).
  // Нужна для NSFW-баннера над плеером; бейдж на обложке рисует AgeRatingBadge.
  const ageRating = getAgeRatingInfo(anime.shikimoriRating)

  const { user, profile } = useAuth()
  const { isSaved, toggle } = useBookmarks()
  const saved = isSaved(anime.id)

  // Ограничиваем начальную серию в пределах реально вышедших серий
  const [selectedEpisode, setSelectedEpisode] = useState<number>(() => {
    const requested = initialEpisode || 1
    return Math.min(Math.max(1, requested), availableEpisodes)
  })

  const [isStarted, setIsStarted] = useState(false)
  const [selectedCountry, setSelectedCountry] = useState<string>('RU')
  const [isRegionDetected, setIsRegionDetected] = useState(false)
  const [isUpdatingFromPlayer, setIsUpdatingFromPlayer] = useState(false)
  const [posterLoading, setPosterLoading] = useState(true)
  const [isCoverModalOpen, setIsCoverModalOpen] = useState(false)
  const [lastWatchedInfo, setLastWatchedInfo] = useState<{
    season?: number
    episode: number
    time?: string
    translation?: string
  } | null>(null)

  const { showExitPrompt, dismissPrompt: dismissExitPrompt } = useExitIntent({
    enabled: isStarted, // Only track after user starts watching
    minWatchTime: 30 // Show prompt after 30 seconds of watching
  })

  // Крючок «Гача / стартовый пак» — после старта 1-й серии (не перекрывает плеер)
  const [showStarterHook, setShowStarterHook] = useState(false)
  // Крючок «Колода тайтла» — после просмотра / exit intent
  const [showDeckHook, setShowDeckHook] = useState(false)
  const starterHookArmed = useRef(false)

  // Жанровые пилюли на мобиле уходят в горизонтальный скролл; по краям ряда —
  // затемнение, которое показывается только там, где контент реально уходит
  // за пределы блока (справа всегда есть что скроллить, слева — когда уже
  // прокручено). Без скролль-детекции затемнение висело бы и там, где
  // пилюли влезли целиком.
  const genreRowRef = useRef<HTMLDivElement>(null)
  const [genreFade, setGenreFade] = useState<{ left: boolean; right: boolean }>({ left: false, right: false })
  const updateGenreFade = useCallback(() => {
    const el = genreRowRef.current
    if (!el) return
    const max = el.scrollWidth - el.clientWidth
    setGenreFade({ left: el.scrollLeft > 4, right: max > 4 && el.scrollLeft < max - 4 })
  }, [])
  useEffect(() => {
    updateGenreFade()
    const el = genreRowRef.current
    if (!el) return
    const onScroll = () => updateGenreFade()
    el.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    // Шрифты и раскладка могут доехать после первого рендера — пересчитать.
    const timer = setTimeout(updateGenreFade, 400)
    return () => {
      el.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      clearTimeout(timer)
    }
  }, [updateGenreFade])

  const playerRef = useRef<HTMLDivElement>(null)
  const lastRecordedEpisode = useRef("")
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // После начала просмотра (гость) — через ~45с показываем стартовый бонус под плеером
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

  // Exit intent → колода по тайтлу (ценность CCG, не «сохраните прогресс»)
  useEffect(() => {
    if (showExitPrompt && !user && canShowGuestHook(GuestHookId.TITLE_DECK)) {
      setShowStarterHook(false) // один баннер за раз — не спамим
      setShowDeckHook(true)
    }
  }, [showExitPrompt, user])

  // Загрузка сохранённого прогресса из localStorage. Не блокируем плеер,
  // если браузер запретил доступ к хранилищу.
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(`last-watched-${anime.id}`)
      if (!stored) return

      const data = JSON.parse(stored)
      if (data && typeof data.episode === 'number') {
        setLastWatchedInfo(data)
      }
    } catch {
      // Storage/JSON can be unavailable or corrupt; viewing still works.
    }
  }, [anime.id])

  // Инициализация выбранной серии (с защитой от выходящих серий)
  useEffect(() => {
    if (!isStarted) {
      if (initialEpisode && initialEpisode > 0) {
        setSelectedEpisode(Math.min(initialEpisode, availableEpisodes))
      } else if (lastWatchedInfo?.episode) {
        setSelectedEpisode(Math.min(lastWatchedInfo.episode, availableEpisodes))
      }
    }
  }, [initialEpisode, lastWatchedInfo, isStarted, availableEpisodes])

  // Синхронизация истории и URL при изменении серии
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
        { id: anime.id, title: anime.title, poster: anime.poster },
        { episode: selectedEpisode, episodesTotal: availableEpisodes }
      )
    }
  }, [selectedEpisode, isStarted, pathname, router, searchParams, anime, isUpdatingFromPlayer, availableEpisodes])

  const scrollToPlayer = useCallback(() => {
    if (playerRef.current) {
      const yOffset = -80
      const y = playerRef.current.getBoundingClientRect().top + window.pageYOffset + yOffset
      window.scrollTo({ top: y, behavior: 'smooth' })
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
    if (isRussia && selectedCountry === 'RU') {
      setSelectedCountry('RU')
    }
  }

  const handleEpisodeChangeFromPlayer = (newEpisode: number) => {
    const safeEpisode = Math.min(Math.max(1, newEpisode), availableEpisodes)
    if (safeEpisode !== selectedEpisode) {
      trackEvent(AnalyticsEvent.EPISODE_CHANGE, {
        shikimori_id: anime.shikimoriId, episode: safeEpisode, source: "player",
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

  // Kodik плеер работает внутри iframe, поэтому его реальное
  // currentTime недоступно странице. Считаем только видимое активное время
  // после старта серии, отдельное от общего времени на сайте.
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

  return (
    <div className="flex flex-col gap-6 pt-4 mx-auto">
      {/* Navigation & Actions Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Кнопка «Назад» раньше жила здесь отдельной <Button>. Теперь её
            рисует <PageBreadcrumbs/> — вместе с крошками Главная / Каталог /
            тайтл и с тем же fallback'ом на /catalog при пустой истории. */}
        <PageBreadcrumbs
          backFallback="/catalog"
          items={[
            { label: "Главная", href: "/" },
            { label: "Каталог", href: "/catalog" },
            { label: cleanAnimeTitle(anime.russian || anime.title) || anime.title },
          ]}
        />

        {/* Закладка и подписка стоят рядом намеренно.
            Это два ответа на вопрос «что мне делать с этим тайтлом», и
            разносить их по разным углам экрана незачем: человек, который
            хочет следить за новыми сериями, ищет «следить» рядом с
            «сохранить», а не в шапке тайтла между жанрами.

            Обе кнопки означают разное и друг без друга не работают:
            закладка — «открыть потом», подписка — «напиши, когда выйдет».

            baseline_episode = availableEpisodes, а не выбранная серия:
            человек мог открыть тайтл, посмотреть первую серию и уйти — и всё
            равно не хочет получать «вышла 2». Точка отсчёта — это «сколько
            уже вышло», а не «где он остановился». */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => toggle(anime)}
            className={cn(
              "gap-2 transition-all border",
              saved
                ? "bg-primary/10 border-primary/50 text-primary hover:bg-primary/20"
                : "bg-card border-border text-muted-foreground hover:text-foreground hover:bg-card/80"
            )}
          >
            <Bookmark className={cn("w-4 h-4", saved && "fill-current")} />
            <span>{saved ? "Сохранено" : "В закладки"}</span>
          </Button>

          <TitleSubscribeButton
            animeId={String(anime.shikimoriId || anime.id)}
            animeTitle={anime.title}
            poster={anime.poster}
            baselineEpisode={availableEpisodes}
          />
        </div>
      </div>

      {/* Header Info */}
      <div className="relative overflow-hidden rounded-3xl bg-card/30 border border-border p-4 md:p-8">
        <div className="absolute inset-0 z-0" aria-hidden="true">
          <Image
            src={anime.poster}
            alt=""
            fill
            className="object-cover scale-150 blur-2xl sm:blur-3xl opacity-30 sm:opacity-35"
            sizes="400px"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-card/85 via-card/70 to-card/50 dark:from-zinc-950/90 dark:via-zinc-950/85 dark:to-zinc-950/75" />
          <div className="absolute top-0 left-0 right-0 h-24 sm:h-32 bg-gradient-to-b from-primary/15 to-transparent opacity-60 pointer-events-none" />
        </div>

        <div className="flex flex-row items-start gap-4 md:gap-8 relative z-10">
          {/* Постер + бейдж возраста живут в обёртке-сиблинге. Бейдж НЕ вложен
              в кликабельный постер (div role="button"): раньше из-за вложения
              конфликтовали две кнопки — клику по бейджу нужен был
              stopPropagation, чтобы не открыть обложку, а скринридер читал
              постер одной строкой вместе с бейджем. Теперь это соседи:
              клик по бейджу физически не может открыть обложку, и наоборот. */}
          <div className="relative shrink-0">
            <div
              onClick={() => {
                trackEvent(AnalyticsEvent.COVER_MODAL_OPEN, { shikimori_id: anime.shikimoriId, title: anime.title })
                setIsCoverModalOpen(true)
              }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault()
                  trackEvent(AnalyticsEvent.COVER_MODAL_OPEN, { shikimori_id: anime.shikimoriId, title: anime.title })
                  setIsCoverModalOpen(true)
                }
              }}
              title="Нажмите, чтобы посмотреть обложку"
              className="group/poster relative w-24 aspect-[2/3] md:w-44 rounded-lg md:rounded-xl overflow-hidden shadow-2xl bg-muted ring-1 ring-border cursor-pointer hover:ring-primary/60 hover:shadow-primary/20 transition-all duration-300"
            >
              <Image
                src={anime.poster}
                alt={anime.title}
                fill
                className="object-cover group-hover/poster:scale-105 transition-transform duration-500 ease-out"
                sizes="(max-width: 768px) 100px, 180px"
                priority
                onLoad={() => setPosterLoading(false)}
                onError={() => setPosterLoading(false)}
              />

              {/* Бейдж статуса и оценка поверх обложки. pointer-events-none:
                  клики проходят сквозь них на постер (открытие просмотра). */}
              <div className="absolute top-1.5 left-1.5 z-10 pointer-events-none">
                <span className={cn(
                  "px-1.5 py-0.5 rounded font-bold uppercase tracking-wide shadow-sm",
                  "text-[9px] md:text-[10px]",
                  anime.status === 'Ongoing' ? 'bg-orange-500 text-black' : 'bg-secondary text-secondary-foreground dark:bg-zinc-700 dark:text-white'
                )}>
                  {anime.status === 'Ongoing' ? 'Выходит' : anime.status === 'Announcement' ? 'Анонс' : 'Закончен'}
                </span>
              </div>
              {anime.rating > 0 && (
                <div className="absolute bottom-1.5 left-1.5 z-10 pointer-events-none md:bottom-auto md:left-auto md:top-1.5 md:right-1.5">
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-black/70 backdrop-blur-[2px] text-white text-[10px] md:text-xs font-bold shadow-sm">
                    <Star className="w-3 h-3 fill-yellow-500 text-yellow-500" />
                    {anime.rating}
                  </span>
                </div>
              )}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/poster:opacity-100 transition-opacity duration-300 flex flex-col items-center justify-center gap-1 backdrop-blur-[2px]">
                <Eye className="w-5 h-5 md:w-7 md:h-7 text-white drop-shadow-md" />
                <span className="text-[10px] md:text-xs text-white font-medium drop-shadow-md hidden sm:inline-block">
                  Обложка
                </span>
              </div>

              {posterLoading && (
                <div className="absolute inset-0 bg-neutral-200 dark:bg-zinc-800 animate-pulse flex items-center justify-center z-10">
                  <div className="w-6 h-6 rounded-full border-2 border-orange-500/20 border-t-orange-500 animate-spin" />
                </div>
              )}
            </div>

            {/* Бейдж возраста — СОСЕД постера в обёртке, а не его потомок.
                Прежняя пилюля «Возрастной рейтинг: R» жила в строке мета
                под заголовком, сырой код Shikimori и ломала сгиб ряда.
                Позиция — тот же правый нижний угол: на десктопе счёт
                справа-сверху, статус слева-сверху, на мобиле счёт
                слева-снизу, поэтому угол свободен во всех раскладках.
                z-20 — поверх ховер-оверлея «Обложка». */}
            {ageRating && (
              <div className="absolute bottom-1.5 right-1.5 z-20 pointer-events-none">
                <AgeRatingBadge rating={anime.shikimoriRating} />
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2 md:gap-4 flex-1 min-w-0 pt-1">
            <h1 className="font-unbounded font-black tracking-tight text-xl md:text-3xl lg:text-4xl text-foreground leading-tight">
              {anime.title}
            </h1>
            
            {/* Жанров здесь нет — они идут кнопками ниже. Раньше они были в
                обоих местах одновременно («Экшен, Приключения, Фэнтези» в
                строке метаданных и те же три кнопкой ниже), то есть один и
                тот же список показывался дважды подряд. Кнопки полезнее: они
                кликабельны и ведут в каталог, а текст — нет. */}
            {/* Мета: единый ряд пилюль без точек-разделителей. Оценка, статус
                И возрастная категория живут поверх обложки (см. постер), тут
                их нет, чтобы не мелькать дважды. Возрастная пилюля с сырым
                кодом Shikimori («Возрастной рейтинг: R+PLUS») отсюда убрана:
                длинный текст ломал сгиб ряда на мобиле, а код был непонятен. */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="px-2 py-0.5 rounded-md bg-muted text-xs md:text-sm text-foreground font-bold">
                {anime.year}
              </span>
              <span className="px-2 py-0.5 rounded-md bg-muted text-xs md:text-sm text-foreground font-bold">
                {availableEpisodes} / {totalPlannedEpisodes} {getEpisodeText(totalPlannedEpisodes)}
              </span>
            </div>

            <div className="mt-1 md:mt-2 inline-flex items-center gap-2 text-primary text-sm md:text-base font-semibold">
              <PlayCircle className="w-4 h-4 md:w-5 md:h-5 fill-orange-500/20" />
              Сейчас смотрю: <span className="text-foreground">{selectedEpisode} серию</span>
            </div>
          </div>
        </div>

        {/* Жанры на всю ширину блока. На мобиле — горизонтальный скролл:
            пилюли больше не переносятся столбиком и не съедают высоту.
            Затемнение слева/справа показывается только там, где контент
            реально уходит за блок (genreFade считает это по scrollWidth
            и scrollLeft, слушая scroll и resize). */}
        {anime.genres && anime.genres.length > 0 && (
          <div className="relative mt-1 md:mt-2">
            {/* py-2 у скролл-полосы: пилюлям нужен воздух сверху и снизу,
                иначе при горизонтальном скролле ряд выглядит приклеенным
                к строке меты и к краю блока. Отступ сверху уменьшен, чтобы
                суммарный ритм не разъехался. */}
            <div ref={genreRowRef} className="flex flex-nowrap gap-2 overflow-x-auto no-scrollbar py-2 md:flex-wrap">
              {anime.genres.slice(0, 6).map((genre) => (
                <Link
                  key={genre}
                  href={`/catalog?genre=${encodeURIComponent(String(anime.genreIds?.[genre] ?? genre))}`}
                  className="shrink-0 inline-flex items-center px-3 py-1.5 rounded-full bg-muted/50 border border-border hover:border-primary/40 hover:bg-primary/10 text-muted-foreground hover:text-primary text-xs md:text-sm font-medium transition-all duration-200"
                  onClick={() => trackEvent(AnalyticsEvent.CATALOG_FILTER_CLICK, { filter: "genre", value: genre, location: "watch_page" })}
                >
                  {genre}
                </Link>
              ))}
            </div>
            <div className={cn(
              "pointer-events-none absolute inset-y-0 -left-2 w-10 bg-gradient-to-r from-background to-transparent transition-opacity duration-200",
              genreFade.left ? "opacity-100" : "opacity-0"
            )} />
            <div className={cn(
              "pointer-events-none absolute inset-y-0 -right-2 w-10 bg-gradient-to-l from-background to-transparent transition-opacity duration-200",
              genreFade.right ? "opacity-100" : "opacity-0"
            )} />
          </div>
        )}
      </div>

      {/* Человек пришёл по ссылке от бота (`/watch/<id>?sub=1`) — подписываем
          без лишнего клика. Молчаливый компонент, рендерится в пустоту. */}
      <PendingSubscribeOnMount
        animeId={String(anime.shikimoriId || anime.id)}
        animeTitle={anime.title}
        poster={anime.poster}
        baselineEpisode={availableEpisodes}
      />

      {/* Player Section */}
      <div id="player" ref={playerRef} className="w-full scroll-mt-24">
        {anime.isNsfw && !profile?.allow_nsfw_search && (
          <div role="alert" className="mb-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
            Внимание: возрастная категория этого тайтла — {ageRating ? `${ageRating.label} (${ageRating.description})` : "18+"}. Вы открыли его напрямую; в безопасном поиске такой контент скрыт.
          </div>
        )}
        <RegionWarning selectedCountry={selectedCountry} isRegionDetected={isRegionDetected} />
        
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
              poster={anime.poster}
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

      {/* Boosty Donation Banner */}
      <BoostyBanner />

      {/* Крючок: стартовый пак / стартовый бонус — после начала просмотра */}
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

      {/* Крючок: колода по тайтлу — exit intent / после серии */}
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
      <div id="episodes" className="bg-card/20 border border-border rounded-2xl p-4 md:p-6 backdrop-blur-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <h2 className="text-lg md:text-xl font-bold text-foreground">
            Список серий
          </h2>
          <div className="text-xs font-medium px-3 py-1.5 rounded-full bg-muted text-muted-foreground self-start sm:self-auto">
            {totalPlannedEpisodes > availableEpisodes ? (
              <>Вышло: <span className="text-foreground">{availableEpisodes}</span> из <span className="text-foreground">{totalPlannedEpisodes}</span></>
            ) : (
              <>Всего: <span className="text-foreground">{availableEpisodes}</span></>
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
      <WatchPageGallery anime={anime} />

      {/* Cover Modal */}
      <CoverModal
        isOpen={isCoverModalOpen}
        onClose={() => setIsCoverModalOpen(false)}
        imageUrl={anime.poster}
        title={anime.title}
        subtitle={anime.originalTitle || anime.year?.toString()}
      />

      <FloatingNav variant="watch-page" />
    </div>
  )
}
