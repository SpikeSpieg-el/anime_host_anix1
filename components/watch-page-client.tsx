"use client"

import { useEffect, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Bookmark, Download, ExternalLink, HardDrive, FileVideo } from "lucide-react"
import type { Anime } from "@/lib/shikimori"
import { KodikPlayer } from "@/components/kodik-player"
import { EpisodeSelector } from "@/components/episode-selector"
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

interface WatchPageClientProps {
  anime: Anime
  initialEpisode?: number
}

// Хелпер для генерации ссылок
const getTrackerLink = (tracker: 'rutracker' | 'rutor', query: string) => {
  const term = encodeURIComponent(query)
  if (tracker === 'rutracker') return `https://rutracker.org/forum/tracker.php?nm=${term}`
  if (tracker === 'rutor') return `https://rutor.info/search/0/0/0/0/${term}`
  return '#'
}

export function WatchPageClient({
  anime,
  initialEpisode
}: WatchPageClientProps) {
  const availableEpisodes = Math.max(anime.episodesCurrent || 0, anime.episodesTotal || 0)
  const hasEpisodes = availableEpisodes > 0

  const { isSaved, toggle } = useBookmarks()
  const saved = isSaved(anime.id)

  // Default to episode 1 if none provided
  const [selectedEpisode, setSelectedEpisode] = useState<number>(initialEpisode || 1)
  const [isStarted, setIsStarted] = useState(false)

  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // Update state when props change
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

  // Sync State -> URL and History
  useEffect(() => {
    if (!isStarted) return

    const current = searchParams.get("episode")
    const currentNumber = current ? Number.parseInt(current, 10) : undefined

    // Update URL only if different
    if (currentNumber !== selectedEpisode) {
      const next = new URLSearchParams(searchParams.toString())
      next.set("episode", String(selectedEpisode))
      router.replace(`${pathname}?${next.toString()}`, { scroll: false })
    }

    // Record history
    recordWatchStart(
      { id: anime.id, title: anime.title, poster: anime.poster },
      { episode: selectedEpisode }
    )
  }, [selectedEpisode, isStarted, pathname, router, searchParams, anime.id, anime.title, anime.poster])

  const handleSelectEpisode = (episode: number) => {
    setSelectedEpisode(episode)
    setIsStarted(true) 
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  return (
    <div className="flex flex-col gap-6 pt-20 md:pt-24 mb-10">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl md:text-4xl font-black tracking-tight text-white">
            {anime.title}
          </h1>
          <div className="flex items-center gap-2 text-orange-500 font-medium">
            <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
            {hasEpisodes ? "Серия " + selectedEpisode : "Анонс"}
          </div>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          {/* Кнопка "В закладки" */}
          <Button
            type="button"
            variant={saved ? "default" : "secondary"}
            className={`flex-1 md:flex-none ${saved ? "bg-orange-500 text-black hover:bg-orange-400" : "bg-zinc-800/60 text-white hover:bg-zinc-800 border border-white/10"}`}
            onClick={() => toggle(anime)}
          >
            <Bookmark className={`mr-2 h-4 w-4 ${saved ? "fill-black" : ""}`} />
            {saved ? "В закладках" : "Сохранить"}
          </Button>

          {/* Кнопка "Скачать" с диалоговым окном */}
          <Dialog>
            <DialogTrigger asChild>
              <Button 
                variant="secondary" 
                className="flex-1 md:flex-none bg-zinc-800/60 text-white hover:bg-zinc-800 border border-white/10"
              >
                <Download className="mr-2 h-4 w-4" />
                Скачать
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-zinc-950 border-zinc-800 text-white sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Скачать аниме</DialogTitle>
                <DialogDescription className="text-zinc-400">
                  Выберите вариант скачивания. Поиск осуществляется по названию.
                </DialogDescription>
              </DialogHeader>

              <div className="flex flex-col gap-6 py-4">
                
                {/* Секция: Скачать весь сезон */}
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-zinc-300 flex items-center gap-2">
                    <HardDrive className="w-4 h-4 text-orange-500" />
                    Весь сезон / Раздачи
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <a 
                      href={getTrackerLink('rutracker', anime.title)} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 p-3 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-orange-500/50 hover:bg-zinc-800 transition-colors group"
                    >
                      <span className="font-bold text-sm">RuTracker</span>
                      <ExternalLink className="w-3 h-3 text-zinc-500 group-hover:text-white" />
                    </a>
                    <a 
                      href={getTrackerLink('rutor', anime.title)} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 p-3 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-orange-500/50 hover:bg-zinc-800 transition-colors group"
                    >
                      <span className="font-bold text-sm">Rutor</span>
                      <ExternalLink className="w-3 h-3 text-zinc-500 group-hover:text-white" />
                    </a>
                  </div>
                </div>

                {/* Секция: Скачать текущую серию */}
                {hasEpisodes && (
                   <div className="space-y-3">
                    <h3 className="text-sm font-medium text-zinc-300 flex items-center gap-2">
                      <FileVideo className="w-4 h-4 text-orange-500" />
                      Текущая серия ({selectedEpisode})
                    </h3>
                    <div className="p-3 rounded-lg bg-zinc-900/50 border border-zinc-800 text-sm text-zinc-400 mb-2">
                        Прямое скачивание из плеера недоступно. Используйте поиск по серии на трекерах:
                    </div>
                    <a 
                      href={getTrackerLink('rutor', `${anime.title} ${selectedEpisode} серия`)} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="w-full flex items-center justify-center gap-2 p-3 rounded-lg bg-orange-600 hover:bg-orange-700 text-white font-medium transition-colors"
                    >
                      <Download className="w-4 h-4" />
                      Найти {selectedEpisode} серию на Rutor
                    </a>
                   </div>
                )}
                
                <div className="text-[10px] text-zinc-600 text-center">
                   Мы не храним файлы на серверах. Ссылки ведут на внешний поиск по открытым источникам.
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="w-full">
        {hasEpisodes ? (
          <KodikPlayer
            shikimoriId={anime.shikimoriId}
            title={anime.title}
            poster={anime.poster}
            episode={selectedEpisode}
            onStart={() => {
              setIsStarted(true)
            }}
          />
        ) : (
          <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-zinc-950 border border-white/5 shadow-2xl">
            <div className="absolute inset-0 flex items-center justify-center">
              <img
                src={anime.poster}
                className="absolute inset-0 w-full h-full object-cover opacity-20 blur-xl"
                alt=""
              />
              <div className="relative z-10 px-6 py-4 bg-black/40 border border-white/10 rounded-2xl text-center">
                <div className="text-white font-bold">Это анонс</div>
                <div className="text-zinc-400 text-sm mt-1">Эпизоды появятся после релиза</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {hasEpisodes && (
        <div className="bg-zinc-900/40 border border-white/5 rounded-2xl p-4 md:p-6 backdrop-blur-md">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
              Выбор серии
              <span className="text-zinc-500 text-sm font-normal">
                (Всего: {availableEpisodes})
              </span>
            </h2>
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