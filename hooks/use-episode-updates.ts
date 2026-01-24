"use client"

import { useEffect, useState, useCallback } from "react"
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
const UPDATE_EVENT = "episode_updates_changed" // Имя события для синхронизации

export function useEpisodeUpdates(): UseEpisodeUpdatesReturn {
  const [updates, setUpdates] = useState<EpisodeUpdate[]>([])
  const [mounted, setMounted] = useState(false)
  const [isChecking, setIsChecking] = useState(false)


  const { user } = useAuth()
 

  // Функция загрузки из LocalStorage
  const loadFromStorage = useCallback(() => {
    const stored = localStorage.getItem(EPISODE_UPDATES_KEY)
    if (stored) {
      try {
        const parsed = JSON.parse(stored)



 
        // Сравниваем, изменились ли данные, чтобы избежать лишних ререндеров
        setUpdates(prev => {
          if (JSON.stringify(prev) !== JSON.stringify(parsed)) {
            return parsed
          }
          return prev
        })
      } catch (e) {
        console.error("Error parsing updates:", e)
      }
    } else {
      setUpdates([])
    }
  }, [])


  // 1. Инициализация и подписка на события
  useEffect(() => {
    setMounted(true)
    loadFromStorage()

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

  // 1. Инициализация и подписка на события
  useEffect(() => {
    setMounted(true)
    if (user) {
      loadFromDb()
    } else {
      loadFromStorage()
    }
 

    // Слушаем изменения в других компонентах
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === EPISODE_UPDATES_KEY) {
        loadFromStorage()
      }
    }

    // Слушаем наше кастомное событие (для синхронизации в одной вкладке)

    window.addEventListener(UPDATE_EVENT, loadFromStorage)

    window.addEventListener(UPDATE_EVENT, user ? (loadFromDb as any) : (loadFromStorage as any))

 
    // Слушаем изменения storage (для синхронизации между вкладками)
    window.addEventListener("storage", handleStorageChange)

    return () => {
      window.removeEventListener(UPDATE_EVENT, loadFromStorage)
      window.removeEventListener(UPDATE_EVENT, user ? (loadFromDb as any) : (loadFromStorage as any))
    }
  }, [loadFromStorage, user])


  // Сохранение обновлений
  const saveUpdates = useCallback((newUpdates: EpisodeUpdate[]) => {
    setUpdates(newUpdates)
    localStorage.setItem(EPISODE_UPDATES_KEY, JSON.stringify(newUpdates))
    // Уведомляем другие компоненты (например, Navbar)

    window.dispatchEvent(new Event(UPDATE_EVENT))
  }, [])


    setTimeout(() => window.dispatchEvent(new Event(UPDATE_EVENT)), 0)
  }, [])

  const saveUpdatesToDb = useCallback(
    async (newUpdates: EpisodeUpdate[]) => {
      if (!user) return
      if (newUpdates.length === 0) {
        setUpdates([])
        return
      }

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

      if (error) {
        console.error("Failed to save episode updates:", error)
        return
      }

      await loadFromDb()
      setTimeout(() => window.dispatchEvent(new Event(UPDATE_EVENT)), 0)
    },
    [user, loadFromDb]
  )

 
  // 2. Сбор ID для проверки
  const getIdsToCheck = useCallback((): { id: string; watchedEpisode: number; source: 'history' | 'bookmark' }[] => {
    try {
      const historyItems = JSON.parse(localStorage.getItem("watch-history") || "[]")
      const bookmarkItems = JSON.parse(localStorage.getItem("bookmarks_v1") || "[]")

      const itemsMap = new Map<string, { watchedEpisode: number; source: 'history' | 'bookmark' }>()

      // Приоритет 1: История
      historyItems.slice(0, 30).forEach((item: any) => {
        if (item.id) {

          itemsMap.set(String(item.id), { 

          itemsMap.set(String(item.id), {
 
            watchedEpisode: item.episode || 0,
            source: 'history'
          })
        }
      })

      // Приоритет 2: Закладки
      bookmarkItems.forEach((item: any) => {
        if (item.id && !itemsMap.has(String(item.id))) {

           itemsMap.set(String(item.id), { 
             watchedEpisode: 0,
             source: 'bookmark'
           })
        }
      })

      return Array.from(itemsMap.entries()).map(([id, data]) => ({ 
        id, 

          itemsMap.set(String(item.id), {
            watchedEpisode: 0,
            source: 'bookmark'
          })
        }
      })

      return Array.from(itemsMap.entries()).map(([id, data]) => ({
        id,
 
        watchedEpisode: data.watchedEpisode,
        source: data.source
      }))
    } catch (e) {
      console.error("Failed to prepare IDs for check:", e)
      return []
    }
  }, [])



  const getIdsToCheckFromDb = useCallback(async () => {
    if (!user) return []
    try {
      const itemsMap = new Map<string, { watchedEpisode: number; source: 'history' | 'bookmark' }>()

      const { data: historyRows, error: historyError } = await supabase
        .from("watch_history")
        .select("anime_id, episode")
        .eq("user_id", user.id)
        .order("timestamp", { ascending: false })
        .limit(30)

      if (historyError) {
        console.error("Failed to load watch history:", historyError)
      }

      ;(historyRows ?? []).forEach((row: any) => {
        if (!row?.anime_id) return
        itemsMap.set(String(row.anime_id), {
          watchedEpisode: row.episode || 0,
          source: 'history'
        })
      })

      const { data: bookmarkRows, error: bookmarkError } = await supabase
        .from("bookmarks")
        .select("anime_id")
        .eq("user_id", user.id)

      if (bookmarkError) {
        console.error("Failed to load bookmarks:", bookmarkError)
      }

      ;(bookmarkRows ?? []).forEach((row: any) => {
        if (!row?.anime_id) return
        const id = String(row.anime_id)
        if (!itemsMap.has(id)) {
          itemsMap.set(id, {
            watchedEpisode: 0,
            source: 'bookmark'
          })
        }
      })

      return Array.from(itemsMap.entries()).map(([id, data]) => ({
        id,
        watchedEpisode: data.watchedEpisode,
        source: data.source
      }))
    } catch (e) {
      console.error("Failed to prepare IDs (db) for check:", e)
      return []
    }
  }, [user])

 
  // 3. Проверка обновлений
  const checkForUpdates = useCallback(async (manualAnimeList?: any[]) => {
    if (typeof window === "undefined") return

    const lastCheck = localStorage.getItem(LAST_CHECK_KEY)
    const now = Date.now()
    // Проверка раз в 15 минут
    if (lastCheck && (now - Number(lastCheck) < 15 * 60 * 1000) && !manualAnimeList) {

      return 

      return
 
    }

    setIsChecking(true)
    try {

      let itemsToCheck = getIdsToCheck()
      

      let itemsToCheck = user ? await getIdsToCheckFromDb() : getIdsToCheck()

 
      if (manualAnimeList && manualAnimeList.length > 0) {
        // Логика объединения, если нужно, но пока полагаемся на LS
      }

      if (itemsToCheck.length === 0) {

         setIsChecking(false)
         return

        setIsChecking(false)
        return
 
      }

      const ids = itemsToCheck.map((i) => i.id)
      const freshData = await getFreshAnimeData(ids)


      let currentUpdates = JSON.parse(localStorage.getItem(EPISODE_UPDATES_KEY) || "[]") as EpisodeUpdate[]

      let currentUpdates = user ? ([] as EpisodeUpdate[]) : (JSON.parse(localStorage.getItem(EPISODE_UPDATES_KEY) || "[]") as EpisodeUpdate[])
 
      const bookmarksSnapshot = JSON.parse(localStorage.getItem(BOOKMARK_SNAPSHOT_KEY) || "{}")
      const newBookmarksSnapshot = { ...bookmarksSnapshot }
      let hasChanges = false

      freshData.forEach((anime) => {
        const userItem = itemsToCheck.find((i) => i.id === anime.id)
        if (!userItem) return
        if (anime.status !== 'ongoing') return

        let baselineEpisode = userItem.watchedEpisode

        // Логика для закладок
        if (userItem.source === 'bookmark') {
          if (newBookmarksSnapshot[anime.id]) {
            baselineEpisode = newBookmarksSnapshot[anime.id]
          } else {
            newBookmarksSnapshot[anime.id] = anime.episodesCurrent

            return 

            return
 
          }
        }

        if (anime.episodesCurrent > baselineEpisode) {
          const existingIndex = currentUpdates.findIndex((u) => u.animeId === anime.id)

          if (
            existingIndex === -1 ||
            currentUpdates[existingIndex].newEpisode < anime.episodesCurrent
          ) {
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

          
          if (userItem.source === 'bookmark') {
             newBookmarksSnapshot[anime.id] = anime.episodesCurrent


          if (userItem.source === 'bookmark') {
            newBookmarksSnapshot[anime.id] = anime.episodesCurrent
 
          }
        }
      })

      if (hasChanges) {

        saveUpdates(currentUpdates)
      }
      

        if (user) {
          await saveUpdatesToDb(currentUpdates)
        } else {
          saveUpdates(currentUpdates)
        }
      }

 
      localStorage.setItem(LAST_CHECK_KEY, String(Date.now()))
      localStorage.setItem(BOOKMARK_SNAPSHOT_KEY, JSON.stringify(newBookmarksSnapshot))

    } catch (error) {
      console.error("Update check failed:", error)
    } finally {
      setIsChecking(false)
    }

  }, [getIdsToCheck, saveUpdates])

  }, [getIdsToCheck, getIdsToCheckFromDb, saveUpdates, saveUpdatesToDb, user])
 

  // Автозапуск
  useEffect(() => {
    if (mounted) {
      const timer = setTimeout(() => checkForUpdates(), 3000)
      return () => clearTimeout(timer)
    }
  }, [mounted, checkForUpdates])

  const clearUpdate = useCallback((id: string) => {

    setUpdates((prev) => {
      const next = prev.filter((u) => u.animeId !== id)
      localStorage.setItem(EPISODE_UPDATES_KEY, JSON.stringify(next))
      window.dispatchEvent(new Event(UPDATE_EVENT))
      return next
    })
  }, [])

  const clearAllUpdates = useCallback(() => {
    saveUpdates([])
  }, [saveUpdates])

    if (user) {
      supabase
        .from("episode_updates")
        .delete()
        .match({ user_id: user.id, anime_id: id })
        .then(({ error }) => {
          if (error) console.error("Failed to clear update:", error)
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

  const clearAllUpdates = useCallback(() => {
    if (user) {
      supabase
        .from("episode_updates")
        .delete()
        .eq("user_id", user.id)
        .then(({ error }) => {
          if (error) console.error("Failed to clear all updates:", error)
          setUpdates([])
          setTimeout(() => window.dispatchEvent(new Event(UPDATE_EVENT)), 0)
        })
      return
    }
    saveUpdates([])
  }, [saveUpdates, user])
 

  return {
    updates,
    checkAnimeUpdates: checkForUpdates,
    clearUpdate,
    clearAllUpdates,
    mounted,
    isChecking,
  }
}