"use client"

import { useHistory } from "@/components/providers/history-provider"
import { activityRecorder } from "./account-stats-recorder"
import { supabase, incrementAccountStats } from "@/lib/supabase"
import { useAuth } from "@/components/auth/auth-provider"

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
    const newItem: WatchHistoryItem = {
      id: anime.id,
      title: anime.title,
      poster: anime.poster,
      timestamp: Date.now(),
      episode: options?.episode && options.episode > 0 ? options.episode : undefined,
      episodesTotal: options?.episodesTotal && options.episodesTotal > 0 ? options.episodesTotal : undefined,
    }

    // Отправляем событие для HistoryProvider (если он активен)
    window.dispatchEvent(new CustomEvent('add-to-history', { detail: newItem }))

    try {
      void activityRecorder.recordActivity({
        eventType: 'watch_start',
        category: 'viewing',
        payload: { anime_id: anime.id, episode: options?.episode ?? null },
      })

      // В старой версии здесь был синхронный destructuring Promise:
      // `const { data } = supabase.auth.getSession()`, поэтому счётчик почти
      // никогда не обновлялся. Теперь используем атомарный increment RPC.
      void supabase.auth.getSession()
        .then(async ({ data: { session } }: any) => {
          if (!session?.user) return
          await incrementAccountStats(session.user.id, { watchEvents: 1 })
          window.dispatchEvent(new CustomEvent('account-stats-updated'))
        })
        .catch(() => {})
    } catch (e) {
      console.error("Error recording watch_start:", e)
    }

    console.log('History item added:', newItem)
  } catch (e) {
    console.error("Error adding to history:", e)
  }
}

export function recordWatchEnd(animeId: string) {
  try {
    void activityRecorder.recordActivity({ eventType: 'watch_end', category: 'viewing', payload: { anime_id: animeId } })
  } catch (e) {
    console.error("Error recording watch_end:", e)
  }
}

export function HistoryTracker({ anime }: { anime: any }) {
  const { add } = useHistory()
  const { user } = useAuth()

  // Компонент оставлен для обратной совместимости: запись истории происходит
  // через событие add-to-history в recordWatchStart.
  void add
  void user
  void anime
  return null
}
