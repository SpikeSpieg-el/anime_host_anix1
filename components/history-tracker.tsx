"use client"

<<<<<<< HEAD
=======
import { useHistory } from "@/components/history-provider"

>>>>>>> test-source/main
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
<<<<<<< HEAD
    const history: WatchHistoryItem[] = JSON.parse(localStorage.getItem("watch-history") || "[]")
    const filtered = history.filter((item) => item.id !== anime.id)

=======
>>>>>>> test-source/main
    const newItem: WatchHistoryItem = {
      id: anime.id,
      title: anime.title,
      poster: anime.poster,
      timestamp: Date.now(),
      episode: options?.episode && options.episode > 0 ? options.episode : undefined,
      episodesTotal: options?.episodesTotal && options.episodesTotal > 0 ? options.episodesTotal : undefined,
    }

<<<<<<< HEAD
    localStorage.setItem("watch-history", JSON.stringify([newItem, ...filtered].slice(0, 20)))
  } catch (e) {
    console.error(e)
=======
    // Отправляем событие для HistoryProvider (если он активен)
    window.dispatchEvent(new CustomEvent('add-to-history', { detail: newItem }))
    
    console.log('History item added:', newItem)
  } catch (e) {
    console.error("Error adding to history:", e)
>>>>>>> test-source/main
  }
}

export function HistoryTracker({ anime }: { anime: any }) {
<<<<<<< HEAD
=======
  const { add } = useHistory()
  
>>>>>>> test-source/main
  return null // Этот компонент ничего не рисует, только логика
}