 "use client"
{/*
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useEpisodeUpdates } from "@/hooks/use-episode-updates"
import { useBookmarks } from "@/components/bookmarks-provider"
import { Play, RefreshCw, Trash2 } from "lucide-react"

export function EpisodeUpdateDemo() {
  const [animeId, setAnimeId] = useState("")
  const [animeTitle, setAnimeTitle] = useState("")
  const [newEpisodeNum, setNewEpisodeNum] = useState("")
  const [watchedEpisode, setWatchedEpisode] = useState("")
  const [totalEpisodes, setTotalEpisodes] = useState("")
  const { updates, clearAllUpdates, mounted } = useEpisodeUpdates()
  const { items } = useBookmarks()

  const simulateUpdate = () => {
    if (!animeId || !animeTitle || !newEpisodeNum) {
      alert("Заполните ID, название и номер новой серии")
      return
    }

    const watchedEp = parseInt(watchedEpisode) || 0
    const newEp = parseInt(newEpisodeNum)
    const total = parseInt(totalEpisodes) || undefined

    if (newEp <= watchedEp) {
      alert("Новая серия должна быть больше просмотренной")
      return
    }

    // Get existing updates
    const existingUpdates = JSON.parse(localStorage.getItem("episode_updates_v1") || "[]")
    
    // Create or update the entry
    const update = {
      animeId,
      animeTitle,
      oldEpisode: watchedEp,
      newEpisode: newEp,
      totalEpisodes: total,
      updatedAt: new Date().toISOString()
    }

    // Update or add the entry
    const existingIndex = existingUpdates.findIndex((u: any) => u.animeId === animeId)
    if (existingIndex >= 0) {
      existingUpdates[existingIndex] = update
    } else {
      existingUpdates.push(update)
    }

    localStorage.setItem("episode_updates_v1", JSON.stringify(existingUpdates))

    // Force reload the page to show the update
    window.location.reload()
  }

  const clearDemoUpdates = () => {
    clearAllUpdates()
    alert("Все демо-обновления очищены")
  }

  const fillSampleData = () => {
    setAnimeId("61159")
    setAnimeTitle("Тандзабуро Тодзима хочет стать Наездником в маске")
    setWatchedEpisode("14")
    setNewEpisodeNum("15")
    setTotalEpisodes("24")
  }

  if (!mounted) return null

  return (
    <div className="fixed bottom-4 right-4 bg-zinc-900 border border-zinc-800 rounded-xl p-4 shadow-2xl z-50 w-80">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Play className="w-4 h-4 text-orange-500" />
          Демо: Новая серия
        </h3>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={clearDemoUpdates}
          className="text-zinc-400 hover:text-red-500"
        >
          <Trash2 className="w-3 h-3" />
        </Button>
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-[10px] text-zinc-400 uppercase tracking-wider mb-1 block">
            ID аниме
          </label>
          <Input
            type="text"
            value={animeId}
            onChange={(e) => setAnimeId(e.target.value)}
            placeholder="Например: 61159"
            className="h-8 text-xs bg-zinc-800 border-zinc-700"
          />
        </div>

        <div>
          <label className="text-[10px] text-zinc-400 uppercase tracking-wider mb-1 block">
            Название аниме
          </label>
          <Input
            type="text"
            value={animeTitle}
            onChange={(e) => setAnimeTitle(e.target.value)}
            placeholder="Название тайтла"
            className="h-8 text-xs bg-zinc-800 border-zinc-700"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] text-zinc-400 uppercase tracking-wider mb-1 block">
              Просмотрено
            </label>
            <Input
              type="number"
              value={watchedEpisode}
              onChange={(e) => setWatchedEpisode(e.target.value)}
              placeholder="14"
              className="h-8 text-xs bg-zinc-800 border-zinc-700"
            />
          </div>
          <div>
            <label className="text-[10px] text-zinc-400 uppercase tracking-wider mb-1 block">
              Новая серия
            </label>
            <Input
              type="number"
              value={newEpisodeNum}
              onChange={(e) => setNewEpisodeNum(e.target.value)}
              placeholder="15"
              className="h-8 text-xs bg-zinc-800 border-zinc-700"
            />
          </div>
        </div>

        <div>
          <label className="text-[10px] text-zinc-400 uppercase tracking-wider mb-1 block">
            Всего серий (опционально)
          </label>
          <Input
            type="number"
            value={totalEpisodes}
            onChange={(e) => setTotalEpisodes(e.target.value)}
            placeholder="24"
            className="h-8 text-xs bg-zinc-800 border-zinc-700"
          />
        </div>

        <div className="flex gap-2">
          <Button
            onClick={fillSampleData}
            variant="outline"
            size="sm"
            className="flex-1 h-8 text-xs border-zinc-700 text-zinc-300 hover:bg-zinc-800"
          >
            <RefreshCw className="w-3 h-3 mr-1" />
            Пример
          </Button>
          <Button
            onClick={simulateUpdate}
            size="sm"
            className="flex-1 h-8 text-xs bg-orange-500 hover:bg-orange-600 text-black font-bold"
          >
            <Play className="w-3 h-3 mr-1" />
            Симулировать
          </Button>
        </div>

        <div className="pt-2 border-t border-zinc-800">
          <p className="text-[10px] text-zinc-500">
            Активных обновлений: <span className="text-orange-400 font-bold">{updates.length}</span>
          </p>
        </div>
      </div>
    </div>
  )
}
*/}