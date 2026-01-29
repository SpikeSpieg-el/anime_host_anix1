"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { getFreshAnimeData } from "@/app/actions/get-fresh-anime-data"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/components/auth-provider"

interface EpisodeUpdate {
  animeId: string
  animeTitle: string
  oldEpisode: number
  newEpisode: number
  totalEpisodes?: number
  updatedAt: string
}

interface UseEpisodeUpdatesReturn {
  updates: EpisodeUpdate[]
  checkAnimeUpdates: (manualAnimeList?: any[]) => Promise<void>
  clearUpdate: (id: string) => void
  clearAllUpdates: () => void
  mounted: boolean
  isChecking: boolean
}

// Ключи localStorage
const EPISODE_UPDATES_KEY = "episode_updates_v1"
const LAST_CHECK_KEY = "last_episode_check_ts"
const BOOKMARK_SNAPSHOT_KEY = "bookmarks_snapshot_v1"
const UPDATE_EVENT = "episode_updates_changed" 

export function useEpisodeUpdates(): UseEpisodeUpdatesReturn {
  const [updates, setUpdates] = useState<EpisodeUpdate[]>([])
  const [mounted, setMounted] = useState(false)
  const [isChecking, setIsChecking] = useState(false)
  
  // Используем ref для хранения актуального состояния updates внутри замыканий
  const updatesRef = useRef<EpisodeUpdate[]>([])
  const { user } = useAuth()

  // Синхронизация ref со стейтом
  useEffect(() => {
    updatesRef.current = updates
  }, [updates])

  // --- Вспомогательная функция для обновления снэпшота ---
  const updateSnapshot = (animeId: string, episodeNumber: number) => {
    try {
      const snapshot = JSON.parse(localStorage.getItem(BOOKMARK_SNAPSHOT_KEY) || "{}")
      // Записываем, что пользователь "видел" этот эпизод
      if (!snapshot[animeId] || snapshot[animeId] < episodeNumber) {
        snapshot[animeId] = episodeNumber
        localStorage.setItem(BOOKMARK_SNAPSHOT_KEY, JSON.stringify(snapshot))
      }
    } catch (e) {
      console.error("Failed to update snapshot", e)
    }
  }

  // 1. Загрузка из LocalStorage
  const loadFromStorage = useCallback(() => {
    if (typeof window === "undefined") return
    const stored = localStorage.getItem(EPISODE_UPDATES_KEY)
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        setUpdates(prev => {
          if (JSON.stringify(prev) !== JSON.stringify(parsed)) return parsed
          return prev
        })
      } catch (e) {
        console.error("Error parsing updates:", e)
      }
    } else {
      setUpdates([])
    }
  }, [])

  // 2. Загрузка из БД
  const loadFromDb = useCallback(async () => {
    if (!user) return
    const { data, error } = await supabase
      .from("episode_updates")
      .select("anime_id, anime_title, old_episode, new_episode, total_episodes, updated_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })

    if (error) {
      console.error("Failed to load episode updates:", error)
      return
    }

    const mapped: EpisodeUpdate[] = (data ?? []).map((row: any) => ({
      animeId: String(row.anime_id),
      animeTitle: row.anime_title,
      oldEpisode: row.old_episode ?? 0,
      newEpisode: row.new_episode ?? 0,
      totalEpisodes: row.total_episodes ?? undefined,
      updatedAt: row.updated_at,
    }))

    setUpdates(mapped)
  }, [user])

  // 3. Сохранение (LocalStorage)
  const saveUpdates = useCallback((newUpdates: EpisodeUpdate[]) => {
    setUpdates(newUpdates)
    localStorage.setItem(EPISODE_UPDATES_KEY, JSON.stringify(newUpdates))
    setTimeout(() => window.dispatchEvent(new Event(UPDATE_EVENT)), 0)
  }, [])

  // 4. Сохранение (БД)
  const saveUpdatesToDb = useCallback(async (newUpdates: EpisodeUpdate[]) => {
      if (!user) return
      
      // Если список пуст, мы не можем сделать upsert пустого массива,
      // но логика clearUpdate сама удаляет записи.
      // Здесь upsert нужен только для ДОБАВЛЕНИЯ/ОБНОВЛЕНИЯ.
      if (newUpdates.length > 0) {
        const payload = newUpdates.map((u) => ({
          user_id: user.id,
          anime_id: u.animeId,
          anime_title: u.animeTitle,
          old_episode: u.oldEpisode,
          new_episode: u.newEpisode,
          total_episodes: u.totalEpisodes ?? null,
          updated_at: u.updatedAt,
        }))

        const { error } = await supabase
          .from("episode_updates")
          .upsert(payload, { onConflict: "user_id, anime_id" })

        if (error) console.error("Failed to save episode updates:", error)
      }

      await loadFromDb()
      setTimeout(() => window.dispatchEvent(new Event(UPDATE_EVENT)), 0)
    },
    [user, loadFromDb]
  )

  // 5. Сбор ID для проверки (LocalStorage)
  const getIdsToCheck = useCallback((): { id: string; watchedEpisode: number; source: 'history' | 'bookmark' }[] => {
    try {
      const historyItems = JSON.parse(localStorage.getItem("watch-history") || "[]")
      const bookmarkItems = JSON.parse(localStorage.getItem("bookmarks_v1") || "[]")
      const itemsMap = new Map<string, { watchedEpisode: number; source: 'history' | 'bookmark' }>()

      historyItems.slice(0, 30).forEach((item: any) => {
        if (item.id) itemsMap.set(String(item.id), { watchedEpisode: item.episode || 0, source: 'history' })
      })

      bookmarkItems.forEach((item: any) => {
        if (item.id && !itemsMap.has(String(item.id))) {
          itemsMap.set(String(item.id), { watchedEpisode: 0, source: 'bookmark' })
        }
      })

      return Array.from(itemsMap.entries()).map(([id, data]) => ({ id, ...data }))
    } catch (e) {
      return []
    }
  }, [])

  // 6. Сбор ID для проверки (БД)
  const getIdsToCheckFromDb = useCallback(async () => {
    if (!user) return []
    try {
      const itemsMap = new Map<string, { watchedEpisode: number; source: 'history' | 'bookmark' }>()
      
      const { data: historyRows } = await supabase
        .from("watch_history")
        .select("anime_id, episode")
        .eq("user_id", user.id)
        .order("timestamp", { ascending: false })
        .limit(30)

      ;(historyRows ?? []).forEach((row: any) => {
        if (row?.anime_id) itemsMap.set(String(row.anime_id), { watchedEpisode: row.episode || 0, source: 'history' })
      })

      const { data: bookmarkRows } = await supabase
        .from("bookmarks")
        .select("anime_id")
        .eq("user_id", user.id)

      ;(bookmarkRows ?? []).forEach((row: any) => {
        const id = String(row.anime_id)
        if (!itemsMap.has(id)) itemsMap.set(id, { watchedEpisode: 0, source: 'bookmark' })
      })

      return Array.from(itemsMap.entries()).map(([id, data]) => ({ id, ...data }))
    } catch (e) {
      return []
    }
  }, [user])

  // 7. Основная логика проверки
  const checkForUpdates = useCallback(async (manualAnimeList?: any[]) => {
    if (typeof window === "undefined") return

    const lastCheck = localStorage.getItem(LAST_CHECK_KEY)
    const now = Date.now()
    // Проверка раз в 15 минут, если не ручной запуск
    if (lastCheck && (now - Number(lastCheck) < 15 * 60 * 1000) && !manualAnimeList) return

    setIsChecking(true)
    try {
      let itemsToCheck = user ? await getIdsToCheckFromDb() : getIdsToCheck()
      if (itemsToCheck.length === 0) { setIsChecking(false); return; }

      const ids = itemsToCheck.map((i) => i.id)
      const freshData = await getFreshAnimeData(ids)

      // Берем текущие обновления, чтобы не потерять существующие, но еще не просмотренные
      let currentUpdates = [...updatesRef.current]
      
      const bookmarksSnapshot = JSON.parse(localStorage.getItem(BOOKMARK_SNAPSHOT_KEY) || "{}")
      let hasChanges = false

      freshData.forEach((anime) => {
        const userItem = itemsToCheck.find((i) => i.id === anime.id)
        if (!userItem) return
        if (anime.status !== 'ongoing') return

        let baselineEpisode = userItem.watchedEpisode

        // Если это закладка, проверяем snapshot (чтобы не спамить тем, что уже закрыли)
        if (userItem.source === 'bookmark' && bookmarksSnapshot[anime.id]) {
           // Берем максимум между тем что реально посмотрели и тем что "закрыли"
           baselineEpisode = Math.max(baselineEpisode, bookmarksSnapshot[anime.id])
        }

        // Если вышло что-то новее, чем база
        if (anime.episodesCurrent > baselineEpisode) {
          const existingIndex = currentUpdates.findIndex((u) => u.animeId === anime.id)

          // Если такого обновления еще нет или оно устарело
          if (existingIndex === -1 || currentUpdates[existingIndex].newEpisode < anime.episodesCurrent) {
            const updateObj: EpisodeUpdate = {
              animeId: anime.id,
              animeTitle: anime.title,
              oldEpisode: baselineEpisode,
              newEpisode: anime.episodesCurrent,
              totalEpisodes: anime.episodesTotal,
              updatedAt: new Date().toISOString(),
            }

            if (existingIndex !== -1) {
              currentUpdates[existingIndex] = updateObj
            } else {
              currentUpdates.push(updateObj)
            }
            hasChanges = true
          }
        } else {
          // Если пользователь досмотрел серию (baseline догнал current), удаляем уведомление
          const existingIndex = currentUpdates.findIndex((u) => u.animeId === anime.id)
          if (existingIndex !== -1) {
            currentUpdates.splice(existingIndex, 1)
            hasChanges = true
          }
        }
      })

      if (hasChanges) {
        if (user) await saveUpdatesToDb(currentUpdates)
        else saveUpdates(currentUpdates)
      }

      localStorage.setItem(LAST_CHECK_KEY, String(Date.now()))

    } catch (error) {
      console.error("Update check failed:", error)
    } finally {
      setIsChecking(false)
    }
  }, [getIdsToCheck, getIdsToCheckFromDb, saveUpdates, saveUpdatesToDb, user])

  // 8. Удаление одного обновления (С ИСПРАВЛЕНИЕМ)
  const clearUpdate = useCallback((id: string) => {
    // 1. Находим удаляемое обновление, чтобы запомнить серию
    const updateToRemove = updatesRef.current.find(u => u.animeId === id)
    
    // 2. Обновляем Snapshot, чтобы следующая проверка знала, что мы это видели
    if (updateToRemove) {
      updateSnapshot(id, updateToRemove.newEpisode)
    }

    if (user) {
      supabase
        .from("episode_updates")
        .delete()
        .match({ user_id: user.id, anime_id: id })
        .then(() => {
          loadFromDb().then(() => setTimeout(() => window.dispatchEvent(new Event(UPDATE_EVENT)), 0))
        })
      return
    }

    setUpdates((prev) => {
      const next = prev.filter((u) => u.animeId !== id)
      localStorage.setItem(EPISODE_UPDATES_KEY, JSON.stringify(next))
      setTimeout(() => window.dispatchEvent(new Event(UPDATE_EVENT)), 0)
      return next
    })
  }, [user, loadFromDb])

  // 9. Очистка всех обновлений (С ИСПРАВЛЕНИЕМ)
  const clearAllUpdates = useCallback(() => {
    // 1. Проходимся по всем текущим обновлениям и сохраняем их в Snapshot
    updatesRef.current.forEach(u => {
      updateSnapshot(u.animeId, u.newEpisode)
    })

    if (user) {
      supabase
        .from("episode_updates")
        .delete()
        .eq("user_id", user.id)
        .then(() => {
          setUpdates([])
          setTimeout(() => window.dispatchEvent(new Event(UPDATE_EVENT)), 0)
        })
      return
    }
    saveUpdates([])
  }, [saveUpdates, user])

  useEffect(() => {
    setMounted(true)
    if (user) loadFromDb()
    else loadFromStorage()

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === EPISODE_UPDATES_KEY) loadFromStorage()
    }
    const handleCustomUpdate = () => {
      if (user) loadFromDb()
      else loadFromStorage()
    }
    // Если посмотрели серию, нужно обновить статус (удалить уведомление)
    const handleCheckNeeded = () => setTimeout(() => checkForUpdates(), 1000)

    window.addEventListener(UPDATE_EVENT, handleCustomUpdate)
    window.addEventListener("storage", handleStorageChange)
    window.addEventListener("episode-updates-check-needed", handleCheckNeeded)

    return () => {
      window.removeEventListener(UPDATE_EVENT, handleCustomUpdate)
      window.removeEventListener("storage", handleStorageChange)
      window.removeEventListener("episode-updates-check-needed", handleCheckNeeded)
    }
  }, [user, loadFromDb, loadFromStorage, checkForUpdates])

  useEffect(() => {
    if (mounted) {
      const timer = setTimeout(() => checkForUpdates(), 3000)
      return () => clearTimeout(timer)
    }
  }, [mounted, checkForUpdates])

  return {
    updates,
    checkAnimeUpdates: checkForUpdates,
    clearUpdate,
    clearAllUpdates,
    mounted,
    isChecking,
  }
}