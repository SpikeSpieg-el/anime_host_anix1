"use client"

type WatchHistoryItem = {
  id: string
  title: string
  poster: string
  timestamp: number
  episode?: number
}

export function recordWatchStart(
  anime: { id: string; title: string; poster: string },
  options?: { episode?: number }
) {
  try {
    const history: WatchHistoryItem[] = JSON.parse(localStorage.getItem("watch-history") || "[]")
    const filtered = history.filter((item) => item.id !== anime.id)

    const newItem: WatchHistoryItem = {
      id: anime.id,
      title: anime.title,
      poster: anime.poster,
      timestamp: Date.now(),
      episode: options?.episode,
    }

    localStorage.setItem("watch-history", JSON.stringify([newItem, ...filtered].slice(0, 20)))
  } catch (e) {
    console.error(e)
  }
}

export function HistoryTracker({ anime }: { anime: any }) {
  return null // Этот компонент ничего не рисует, только логика
}