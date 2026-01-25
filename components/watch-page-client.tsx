"use client"

import { useEffect, useState, useRef } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import Image from "next/image"
import { 
  ArrowLeft, 
  Bookmark, 
  Download, 
  ExternalLink, 
  HardDrive, 
  FileVideo, 
  PlayCircle,

} from "lucide-react"
import type { Anime } from "@/lib/shikimori"
import { KodikPlayer } from "@/components/kodik-player"
import { BackupPlayer } from "@/components/backup-player"
import { EpisodeSelector } from "@/components/episode-selector"
import { RegionWarning } from "@/components/region-warning"
import { recordWatchStart } from "@/components/history-tracker"
import { Button } from "@/components/ui/button"
import { useBookmarks } from "@/components/bookmarks-provider"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils" // Убедись, что у тебя есть cn (clsx + tailwind-merge) или используй шаблонные строки

interface WatchPageClientProps {
  anime: Anime
  initialEpisode?: number
}

// Хелпер для ссылок
const getTrackerLink = (tracker: 'rutracker' | 'rutor', query: string) => {
  const term = encodeURIComponent(query)
  if (tracker === 'rutracker') return `https://rutracker.org/forum/tracker.php?nm=${term}`
  if (tracker === 'rutor') return `https://rutor.info/search/0/0/0/0/${term}`
  return '#'
}

// Helper function for dynamic episode/series text
const getEpisodeText = (count: number): string => {
  if (count === 1) return "Серия"
  const lastDigit = count % 10
  const lastTwoDigits = count % 100
  
  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) return "Серий"
  if (lastDigit === 1) return "Серия"
  if (lastDigit >= 2 && lastDigit <= 4) return "Серии"
  return "Серий"
}

export function WatchPageClient({
  anime,
  initialEpisode
}: WatchPageClientProps) {
  const availableEpisodes = Math.max(anime.episodesCurrent || 0, anime.episodesTotal || 0)
  const hasEpisodes = availableEpisodes > 0

  const { isSaved, toggle } = useBookmarks()
  const saved = isSaved(anime.id)

  const [selectedEpisode, setSelectedEpisode] = useState<number>(initialEpisode || 1)
  const [isStarted, setIsStarted] = useState(false)
  const [selectedCountry, setSelectedCountry] = useState<string>('RU')
  const [isRegionDetected, setIsRegionDetected] = useState(false)
  const [useBackupPlayer, setUseBackupPlayer] = useState(false)
  
  // Реф для скролла к плееру
  const playerRef = useRef<HTMLDivElement>(null)

  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (
      !isStarted &&
      initialEpisode &&
      initialEpisode > 0 &&
      initialEpisode !== selectedEpisode
    ) {
      setSelectedEpisode(initialEpisode)
    }
  }, [initialEpisode, isStarted, selectedEpisode])

  useEffect(() => {
    if (!isStarted) return

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
  }, [selectedEpisode, isStarted, pathname, router, searchParams, anime])

  const handleSelectEpisode = (episode: number) => {
    setSelectedEpisode(episode)
    setIsStarted(true)
    
    // Плавный скролл к плееру, а не в самый верх (лучше UX)
    if (playerRef.current) {
      const yOffset = -80 // Отступ сверху для хедера
      const y = playerRef.current.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  }

  const handleGoBack = () => {
    // Проверяем, есть ли история для возврата
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back()
    } else {
      // Если истории нет, переходим в каталог
      router.push('/catalog')
    }
  }

  const handleCountryChange = (country: string) => {
    setSelectedCountry(country)
    setIsRegionDetected(true)
  }

  const handleRegionDetected = (isRussia: boolean) => {
    setIsRegionDetected(true)
    // Если Россия и страна еще не установлена, устанавливаем RU
    if (isRussia && selectedCountry === 'RU') {
      setSelectedCountry('RU')
    }
  }

  return (
    <div className="flex flex-col gap-6 pt-4 mx-auto">
      
      {/* --- Navigation & Actions Toolbar --- */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Button
          onClick={handleGoBack}
          size="sm"
          variant="ghost"
          className="gap-2 bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800 hover:border-zinc-700 transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Назад</span>
        </Button>

        <div className="flex items-center gap-2">
          {/* Переключатель плееров */}
          {hasEpisodes && (
            <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-lg p-1">
              <Button
                size="sm"
                variant={!useBackupPlayer ? "default" : "ghost"}
                onClick={() => setUseBackupPlayer(false)}
                className={cn(
                  "gap-2 text-xs transition-all",
                  !useBackupPlayer 
                    ? "bg-orange-600 text-white hover:bg-orange-700" 
                    : "text-zinc-400 hover:text-white hover:bg-zinc-800"
                )}
              >
                Основной
              </Button>
              <Button
                size="sm"
                variant={useBackupPlayer ? "default" : "ghost"}
                onClick={() => setUseBackupPlayer(true)}
                className={cn(
                  "gap-2 text-xs transition-all",
                  useBackupPlayer 
                    ? "bg-orange-600 text-white hover:bg-orange-700" 
                    : "text-zinc-400 hover:text-white hover:bg-zinc-800"
                )}
              >
                Запасной
              </Button>
            </div>
          )}

          {/* Кнопка "В закладки" */}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => toggle(anime)}
            className={cn(
              "gap-2 transition-all border",
              saved 
                ? "bg-orange-500/10 border-orange-500/50 text-orange-500 hover:bg-orange-500/20 hover:text-orange-400" 
                : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800 hover:border-zinc-700"
            )}
          >
            <Bookmark className={cn("w-4 h-4", saved && "fill-current")} />
            <span>{saved ? "Сохранено" : "В закладки"}</span>
          </Button>

          {/* Кнопка "Скачать" */}
          <Dialog>
            <DialogTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                className="gap-2 bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800 hover:border-zinc-700 transition-all"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Скачать</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-zinc-950 border-zinc-800 text-white w-[90vw] max-w-md rounded-2xl">
              <DialogHeader>
                <DialogTitle className="text-xl">Скачать аниме</DialogTitle>
                <DialogDescription className="text-zinc-400">
                  Поиск торрентов на внешних ресурсах.
                </DialogDescription>
              </DialogHeader>

              <div className="flex flex-col gap-5 py-2">
                {/* Весь сезон */}
                <div className="space-y-3">
                  <h3 className="text-xs uppercase tracking-wider font-bold text-zinc-500 flex items-center gap-2">
                    <HardDrive className="w-3 h-3" />
                    Весь сезон
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <a
                      href={getTrackerLink('rutracker', anime.title)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between px-4 py-3 rounded-xl bg-zinc-900/50 border border-zinc-800 hover:border-orange-500/40 hover:bg-zinc-800 transition-all group"
                    >
                      <span className="font-medium text-sm">RuTracker</span>
                      <ExternalLink className="w-3 h-3 text-zinc-600 group-hover:text-orange-500 transition-colors" />
                    </a>
                    <a
                      href={getTrackerLink('rutor', anime.title)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between px-4 py-3 rounded-xl bg-zinc-900/50 border border-zinc-800 hover:border-orange-500/40 hover:bg-zinc-800 transition-all group"
                    >
                      <span className="font-medium text-sm">Rutor</span>
                      <ExternalLink className="w-3 h-3 text-zinc-600 group-hover:text-orange-500 transition-colors" />
                    </a>
                  </div>
                </div>

                {/* Текущая серия */}
                {hasEpisodes && (
                   <div className="space-y-3">
                    <h3 className="text-xs uppercase tracking-wider font-bold text-zinc-500 flex items-center gap-2">
                      <FileVideo className="w-3 h-3" />
                      Текущая серия ({selectedEpisode})
                    </h3>
                    <a
                      href={getTrackerLink('rutor', `${anime.title} ${selectedEpisode} серия`)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 w-full p-3 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-medium transition-colors shadow-lg shadow-orange-900/20"
                    >
                      <Download className="w-4 h-4" />
                      Найти серию на Rutor
                    </a>
                   </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* --- Anime Header Info --- */}
      <div className="relative overflow-hidden rounded-3xl bg-zinc-900/30 border border-white/5 p-4 md:p-8">
        {/* Фоновый блюр (опционально, если не нужно - убери этот блок) */}
        <div 
            className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-orange-500/10 to-transparent opacity-50 pointer-events-none" 
            aria-hidden="true" 
        />

        <div className="flex flex-row items-center gap-4 md:gap-8 relative z-10">
          {/* Poster */}
          <div className="relative w-24 aspect-[2/3] md:w-44 shrink-0 rounded-lg md:rounded-xl overflow-hidden shadow-2xl bg-zinc-800 ring-1 ring-white/10">
            <Image
              src={anime.poster}
              alt={anime.title}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100px, 180px"
              priority
            />
          </div>

          {/* Info Text */}
          <div className="flex flex-col gap-2 md:gap-4 flex-1 min-w-0 pt-1">
            <h1 className="text-xl md:text-3xl lg:text-4xl font-black text-white leading-tight">
              {anime.title}
            </h1>
            
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs md:text-sm text-zinc-400 font-medium">
              <span className="px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-300">
                {anime.year}
              </span>
              <span className="w-1 h-1 rounded-full bg-zinc-700" />
              <span>
                {anime.episodesCurrent || "?"} / {anime.episodesTotal || "?"} {getEpisodeText(parseInt(anime.episodesTotal?.toString() || "0"))}
              </span>
              
              {anime.genres && anime.genres.length > 0 && (
                <>
                  <span className="hidden sm:block w-1 h-1 rounded-full bg-zinc-700" />
                  <span className="hidden sm:block text-zinc-500">
                    {anime.genres.slice(0, 3).join(", ")}
                  </span>
                </>
              )}
            </div>

            {hasEpisodes ? (
                <div className="mt-1 md:mt-2 inline-flex items-center gap-2 text-orange-400 text-sm md:text-base font-semibold">
                    <PlayCircle className="w-4 h-4 md:w-5 md:h-5 fill-orange-500/20" />
                    Сейчас смотрю: <span className="text-white">{selectedEpisode} серию</span>
                </div>
            ) : (
                <div className="mt-2 space-y-2">
                    <div className="inline-block px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs md:text-sm font-medium">
                        Анонс
                    </div>
                    {anime.airedOn && (
                        <div className="inline-block px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs md:text-sm font-medium">
                            Выход: {new Date(anime.airedOn).toLocaleDateString('ru-RU', {
                                day: 'numeric',
                                month: 'long',
                                year: 'numeric'
                            })}
                        </div>
                    )}
                </div>
            )}
          </div>
        </div>
      </div>

      {/* --- Player Section --- */}
      <div 
        ref={playerRef} 
        className="w-full scroll-mt-24" // scroll-mt нужен для отступа при скролле
      >
        {/* Предупреждение о регионе */}
        <RegionWarning selectedCountry={selectedCountry} isRegionDetected={isRegionDetected} />
        
        {hasEpisodes ? (
          <div className="rounded-2xl overflow-hidden border border-zinc-800 bg-black shadow-2xl relative aspect-video">
            {!useBackupPlayer ? (
              <KodikPlayer
                shikimoriId={anime.shikimoriId}
                title={anime.title}
                poster={anime.poster}
                episode={selectedEpisode}
                onStart={() => setIsStarted(true)}
                onCountryChange={handleCountryChange}
                onRegionDetected={handleRegionDetected}
              />
            ) : (
              <BackupPlayer
                title={anime.title}
                episode={selectedEpisode}
                isActive={true}
              />
            )}
          </div>
        ) : (
          <div className="aspect-video w-full rounded-2xl bg-zinc-900/50 border border-zinc-800 flex flex-col items-center justify-center p-6 text-center">
            <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center mb-4">
               <PlayCircle className="w-8 h-8 text-zinc-600" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Серии недоступны</h3>
            <p className="text-zinc-500 text-sm max-w-md">
              К сожалению, для этого аниме пока нет доступных серий или плеер временно недоступен.
            </p>
          </div>
        )}
      </div>

      {/* --- Episode Selector --- */}
      {hasEpisodes && (
        <div className="bg-zinc-900/20 border border-white/5 rounded-2xl p-4 md:p-6 backdrop-blur-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <h2 className="text-lg md:text-xl font-bold text-white">
              Список серий
            </h2>
            <div className="text-xs font-medium px-3 py-1.5 rounded-full bg-zinc-800 text-zinc-400 self-start sm:self-auto">
                Всего: <span className="text-zinc-200">{availableEpisodes}</span>
            </div>
          </div>

          <EpisodeSelector
            totalEpisodes={availableEpisodes}
            currentEpisode={selectedEpisode}
            onSelectEpisode={handleSelectEpisode}
          />
        </div>
      )}
    </div>
  )
}