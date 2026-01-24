"use client"



import { useHistory } from "@/components/history-provider"

 
type WatchHistoryItem = {
  id: string
  title: string
  poster: string
  timestamp: number
  episode?: number
  episodesTotal?: number
}

export function recordWatchStart(
  anime: { id: string; title: string; poster: string },
  options?: { episode?: number; episodesTotal?: number }
) {
  try {
    const history: WatchHistoryItem[] = JSON.parse(localStorage.getItem("watch-history") || "[]")
    const filtered = history.filter((item) => item.id !== anime.id)

    const newItem: WatchHistoryItem = {
      id: anime.id,
      title: anime.title,
      poster: anime.poster,
      timestamp: Date.now(),
      episode: options?.episode && options.episode > 0 ? options.episode : undefined,
      episodesTotal: options?.episodesTotal && options.episodesTotal > 0 ? options.episodesTotal : undefined,
    }

    localStorage.setItem("watch-history", JSON.stringify([newItem, ...filtered].slice(0, 20)))

    // Отправляем событие для HistoryProvider (если он активен)
    window.dispatchEvent(new CustomEvent('add-to-history', { detail: newItem }))
  } catch (e) {
    console.error("Error adding to history:", e)
  }
}

export function HistoryTracker({ anime }: { anime: any }) {
  const { add } = useHistory()

  
 
  return null // Этот компонент ничего не рисует, только логика
}