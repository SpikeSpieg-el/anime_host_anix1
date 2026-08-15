"use client"

import { useEffect, useState, useRef, useCallback, useMemo } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { 
  ArrowLeft, 
  Bookmark, 
  Download, 
  ExternalLink, 
  HardDrive, 
  FileVideo, 
  PlayCircle
} from "lucide-react"
import type { Anime } from "@/lib/shikimori"
import { KodikPlayer } from "@/components/watch/kodik-player"
import { BackupPlayer } from "@/components/watch/backup-player"
import { HentaiPlayer } from "@/components/watch/hentai-player"
import { EpisodeSelector } from "@/components/watch/episode-selector"
import { RegionWarning } from "@/components/shared/region-warning"
import { recordWatchStart } from "@/components/providers/history-tracker"
import { Button } from "@/components/ui/button"
import { useBookmarks } from "@/components/providers/bookmarks-provider"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription
} from "@/components/ui/dialog"
import { isHentaiContent } from "@/lib/hentai-detector"
import { WatchPageGallery } from "@/components/watch/watch-page-gallery"
import { CoverModal } from "@/components/watch/cover-modal"
import { FloatingNav } from "@/components/layout/floating-nav"
import { cn } from "@/lib/utils"
import { Eye } from "lucide-react"

interface WatchPageClientProps {
  anime: Anime
  initialEpisode?: number
}

const getTrackerLink = (tracker: 'rutracker' | 'rutor', query: string) => {
  const term = encodeURIComponent(query)
  if (tracker === 'rutracker') return `https://rutracker.org/forum/tracker.php?nm=${term}`
  if (tracker === 'rutor') return `https://rutor.info/search/0/0/0/0/${term}`
  return '#'
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
  const [activePlayer, setActivePlayer] = useState<'main' | 'backup'>('main')
  const [isUpdatingFromPlayer, setIsUpdatingFromPlayer] = useState(false)
  const [posterLoading, setPosterLoading] = useState(true)
  const [isCoverModalOpen, setIsCoverModalOpen] = useState(false)
  const [lastWatchedInfo, setLastWatchedInfo] = useState<{
    season?: number
    episode: number
    time?: string
    translation?: string
  } | null>(null)

  const playerRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // Загрузка сохранённого прогресса из localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storageKey = `last-watched-${anime.id}`
      const stored = localStorage.getItem(storageKey)
      if (stored) {
        try {
          const data = JSON.parse(stored)
          if (data && typeof data.episode === 'number') {
            setLastWatchedInfo(data)
          }
        } catch {
          // ignore
        }
      }
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

    recordWatchStart(
      { id: anime.id, title: anime.title, poster: anime.poster },
      { episode: selectedEpisode, episodesTotal: availableEpisodes }
    )
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
    setSelectedEpisode(safeEpisode)
    setIsStarted(true)
    scrollToPlayer()
  }

  const handleGoBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back()
    } else {
      router.push('/catalog')
    }
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
    if (typeof window !== 'undefined') {
      localStorage.setItem(`last-watched-${anime.id}`, JSON.stringify(info))
    }
  }

  return (
    <div className="flex flex-col gap-6 pt-4 mx-auto">
      {/* Navigation & Actions Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Button
          onClick={handleGoBack}
          size="sm"
          variant="ghost"
          className="gap-2 bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-card/80 transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Назад</span>
        </Button>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-card border border-border rounded-lg p-1">
            <Button
              size="sm"
              variant={activePlayer === 'main' ? "default" : "ghost"}
              onClick={() => setActivePlayer('main')}
              className={cn(
                "gap-2 text-xs transition-all",
                activePlayer === 'main' 
                  ? "bg-primary text-primary-foreground hover:bg-primary/90" 
                  : "text-muted-foreground hover:text-foreground hover:bg-card/80"
              )}
            >
              Основной
            </Button>
            <Button
              size="sm"
              variant={activePlayer === 'backup' ? "default" : "ghost"}
              onClick={() => setActivePlayer('backup')}
              className={cn(
                "gap-2 text-xs transition-all",
                activePlayer === 'backup' 
                  ? "bg-primary text-primary-foreground hover:bg-primary/90" 
                  : "text-muted-foreground hover:text-foreground hover:bg-card/80"
              )}
            >
              Запасной
            </Button>
          </div>

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

          <Dialog>
            <DialogTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                className="gap-2 bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-card/80 transition-all"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Скачать</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border text-foreground w-[90vw] max-w-md rounded-2xl">
              <DialogHeader>
                <DialogTitle className="text-xl">Скачать аниме</DialogTitle>
                <DialogDescription className="text-muted-foreground">
                  Поиск торрентов на внешних ресурсах.
                </DialogDescription>
              </DialogHeader>

              <div className="flex flex-col gap-5 py-2">
                <div className="space-y-3">
                  <h3 className="text-xs uppercase tracking-wider font-bold text-muted-foreground flex items-center gap-2">
                    <HardDrive className="w-3 h-3" />
                    Весь сезон
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <a
                      href={getTrackerLink('rutracker', anime.title)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between px-4 py-3 rounded-xl bg-card/50 border border-border hover:border-primary/40 hover:bg-card/80 transition-all group"
                    >
                      <span className="font-medium text-sm">RuTracker</span>
                      <ExternalLink className="w-3 h-3 text-muted-foreground group-hover:text-primary transition-colors" />
                    </a>
                    <a
                      href={getTrackerLink('rutor', anime.title)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between px-4 py-3 rounded-xl bg-card/50 border border-border hover:border-primary/40 hover:bg-card/80 transition-all group"
                    >
                      <span className="font-medium text-sm">Rutor</span>
                      <ExternalLink className="w-3 h-3 text-muted-foreground group-hover:text-primary transition-colors" />
                    </a>
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="text-xs uppercase tracking-wider font-bold text-muted-foreground flex items-center gap-2">
                    <FileVideo className="w-3 h-3" />
                    Текущая серия ({selectedEpisode})
                  </h3>
                  <a
                    href={getTrackerLink('rutor', `${anime.title} ${selectedEpisode} серия`)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full p-3 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-medium transition-colors shadow-lg shadow-primary/20"
                  >
                    <Download className="w-4 h-4" />
                    Найти серию на Rutor
                  </a>
                </div>
              </div>
            </DialogContent>
          </Dialog>
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

        <div className="flex flex-row items-center gap-4 md:gap-8 relative z-10">
          <div 
            onClick={() => setIsCoverModalOpen(true)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                setIsCoverModalOpen(true)
              }
            }}
            title="Нажмите, чтобы посмотреть обложку"
            className="group/poster relative w-24 aspect-[2/3] md:w-44 shrink-0 rounded-lg md:rounded-xl overflow-hidden shadow-2xl bg-muted ring-1 ring-border cursor-pointer hover:ring-primary/60 hover:shadow-primary/20 transition-all duration-300"
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

            {/* Hover overlay hint */}
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

          <div className="flex flex-col gap-2 md:gap-4 flex-1 min-w-0 pt-1">
            <h1 className="text-xl md:text-3xl lg:text-4xl font-black text-foreground leading-tight">
              {anime.title}
            </h1>
            
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs md:text-sm text-muted-foreground font-medium">
              <span className="px-2 py-0.5 rounded-md bg-muted text-foreground">
                {anime.year}
              </span>
              <span className="w-1 h-1 rounded-full bg-border" />
              <span>
                {availableEpisodes} / {totalPlannedEpisodes} {getEpisodeText(totalPlannedEpisodes)}
              </span>
              
              {anime.genres && anime.genres.length > 0 && (
                <>
                  <span className="hidden sm:block w-1 h-1 rounded-full bg-border" />
                  <span className="hidden sm:block text-muted-foreground">
                    {anime.genres.slice(0, 3).join(", ")}
                  </span>
                </>
              )}
            </div>

            <div className="mt-1 md:mt-2 inline-flex items-center gap-2 text-primary text-sm md:text-base font-semibold">
              <PlayCircle className="w-4 h-4 md:w-5 md:h-5 fill-orange-500/20" />
              Сейчас смотрю: <span className="text-foreground">{selectedEpisode} серию</span>
            </div>

            {anime.genres && anime.genres.length > 0 && (
              <div className="mt-3 md:mt-4">
                <div className="flex flex-wrap gap-2">
                  {anime.genres.slice(0, 6).map((genre) => (
                    <Link
                      key={genre}
                      href={`/catalog?genre=${encodeURIComponent(genre)}`}
                      className="inline-flex items-center px-3 py-1.5 rounded-full bg-muted/50 border border-border hover:border-primary/40 hover:bg-primary/10 text-muted-foreground hover:text-primary text-xs md:text-sm font-medium transition-all duration-200"
                    >
                      {genre}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Player Section */}
      <div id="player" ref={playerRef} className="w-full scroll-mt-24">
        <RegionWarning selectedCountry={selectedCountry} isRegionDetected={isRegionDetected} />
        
        <div className="rounded-2xl overflow-hidden border border-border bg-background shadow-2xl relative aspect-video">
          {isHentaiContent(anime) ? (
            <HentaiPlayer
              title={anime.title}
              originalTitle={anime.originalTitle}
              episode={selectedEpisode}
              isActive={true}
            />
          ) : activePlayer === 'main' ? (
            <KodikPlayer
              shikimoriId={anime.shikimoriId}
              title={anime.title}
              poster={anime.poster}
              episode={selectedEpisode}
              onStart={() => setIsStarted(true)}
              onCountryChange={handleCountryChange}
              onRegionDetected={handleRegionDetected}
              onEpisodeChange={handleEpisodeChangeFromPlayer}
              onProgressUpdate={handleProgressUpdate}
            />
          ) : (
            <BackupPlayer
              title={anime.title}
              episode={selectedEpisode}
              isActive={true}
            />
          )}
        </div>
      </div>

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
