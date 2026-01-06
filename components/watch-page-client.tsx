"use client"

import { useEffect, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Bookmark } from "lucide-react"
import type { Anime } from "@/lib/shikimori"
import { KodikPlayer } from "@/components/kodik-player"
import { EpisodeSelector } from "@/components/episode-selector"
import { recordWatchStart } from "@/components/history-tracker"
import { Button } from "@/components/ui/button"
import { useBookmarks } from "@/components/bookmarks-provider"

interface WatchPageClientProps {
  anime: Anime
  initialEpisode?: number
}

export function WatchPageClient({
  anime,
  initialEpisode
}: WatchPageClientProps) {
  const hasEpisodes = anime.episodesTotal > 0

  const { isSaved, toggle } = useBookmarks()
  const saved = isSaved(anime.id)

  // Устанавливаем 1 серию по умолчанию, если ничего не пришло
  const [selectedEpisode, setSelectedEpisode] = useState<number>(initialEpisode || 1)
  const [isStarted, setIsStarted] = useState(false)

  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

// 2. Инициализация при смене пропсов (если перешли на другое аниме)
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

// 3. Синхронизация State -> URL и История
useEffect(() => {
if (!isStarted) return

const current = searchParams.get("episode")
const currentNumber = current ? Number.parseInt(current, 10) : undefined

// Обновляем URL только если он отличается, чтобы не спамить историю браузера
if (currentNumber !== selectedEpisode) {
  const next = new URLSearchParams(searchParams.toString())
  next.set("episode", String(selectedEpisode))
  router.replace(`${pathname}?${next.toString()}`, { scroll: false })
}

// Записываем в историю
recordWatchStart(
  { id: anime.id, title: anime.title, poster: anime.poster },
  { episode: selectedEpisode }
)
}, [selectedEpisode, isStarted, pathname, router, searchParams, anime.id, anime.title, anime.poster])

  const handleSelectEpisode = (episode: number) => {
    setSelectedEpisode(episode)
    setIsStarted(true) // При клике на серию сразу включаем плеер

    // Плавная прокрутка к плееру при выборе серии (для мобилок)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  return (
    <div className="flex flex-col gap-6 mb-10">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl md:text-4xl font-black tracking-tight text-white">
            {anime.title}
          </h1>
          <div className="flex items-center gap-2 text-orange-500 font-medium">
            <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
            {hasEpisodes ? "Серия " + selectedEpisode : "Анонс"}
          </div>
        </div>

<Button
      type="button"
      variant={saved ? "default" : "secondary"}
      className={saved ? "bg-orange-500 text-black hover:bg-orange-400" : "bg-zinc-800/60 text-white hover:bg-zinc-800 border border-white/10"}
      onClick={() => toggle(anime)}
    >
      <Bookmark className={saved ? "fill-black" : ""} />
      {saved ? "В закладках" : "Сохранить"}
    </Button>
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
            (Всего: {anime.episodesTotal})
          </span>
        </h2>
      </div>

      <EpisodeSelector
        totalEpisodes={anime.episodesTotal}
        currentEpisode={selectedEpisode}
        onSelectEpisode={handleSelectEpisode}
      />
    </div>
  )}
</div>
)
}