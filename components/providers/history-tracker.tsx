"use client"

import { useHistory } from "@/components/providers/history-provider"
import { activityRecorder } from "./account-stats-recorder"
import { supabase, updateAccountStats } from "@/lib/supabase"
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
      activityRecorder.recordActivity({ eventType: 'watch_start', category: 'viewing', payload: { anime_id: anime.id } })

      // Обновляем статистику аккаунта (только для авторизованных)
      if (typeof window !== 'undefined') {
        const { data: { session } } = supabase.auth.getSession()
        if (session?.user) {
          supabase
            .from('account_stats')
            .select('watch_events')
            .eq('user_id', session.user.id)
            .single()
            .then(({ data: currentStats }: any) => {
              const currentCount = currentStats?.watch_events ?? 0
              updateAccountStats(session.user.id, { watchEvents: currentCount + 1 })
              window.dispatchEvent(new CustomEvent('account-stats-updated'))
            })
            .catch(() => {})
        }
      }
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
    activityRecorder.recordActivity({ eventType: 'watch_end', category: 'viewing', payload: { anime_id: animeId } })
  } catch (e) {
    console.error("Error recording watch_end:", e)
  }
}

export function HistoryTracker({ anime }: { anime: any }) {
  const { add } = useHistory()
  
  return null // Этот компонент ничего не рисует, только логика
}