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

  // 1. Функция загрузки из LocalStorage
  const loadFromStorage = useCallback(() => {
    if (typeof window === "undefined") return
    const stored = localStorage.getItem(EPISODE_UPDATES_KEY)
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
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

  // 2. Функция загрузки из БД (Supabase)
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

  // 3. Сохранение обновлений (LocalStorage)
  const saveUpdates = useCallback((newUpdates: EpisodeUpdate[]) => {
    setUpdates(newUpdates)
    localStorage.setItem(EPISODE_UPDATES_KEY, JSON.stringify(newUpdates))
    // Уведомляем другие компоненты
    setTimeout(() => window.dispatchEvent(new Event(UPDATE_EVENT)), 0)
  }, [])

  // 4. Сохранение обновлений (БД)
  const saveUpdatesToDb = useCallback(
    async (newUpdates: EpisodeUpdate[]) => {
      if (!user) return
      if (newUpdates.length === 0) {
        setUpdates([])
        // Очистка в БД (опционально, зависит от логики, здесь просто очищаем локальный стейт)
        // Если нужно очистить БД при пустом массиве, нужен отдельный запрос delete
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

  // 5. Сбор ID для проверки из LocalStorage
  const getIdsToCheck = useCallback((): { id: string; watchedEpisode: number; source: 'history' | 'bookmark' }[] => {
    try {
      const historyItems = JSON.parse(localStorage.getItem("watch-history") || "[]")
      const bookmarkItems = JSON.parse(localStorage.getItem("bookmarks_v1") || "[]")

      const itemsMap = new Map<string, { watchedEpisode: number; source: 'history' | 'bookmark' }>()

      // Приоритет 1: История
      historyItems.slice(0, 30).forEach((item: any) => {
        if (item.id) {
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
        watchedEpisode: data.watchedEpisode,
        source: data.source
      }))
    } catch (e) {
      console.error("Failed to prepare IDs for check:", e)
      return []
    }
  }, [])

  // 6. Сбор ID для проверки из БД
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

  // 7. Основная логика проверки обновлений
  const checkForUpdates = useCallback(async (manualAnimeList?: any[]) => {
    if (typeof window === "undefined") return

    const lastCheck = localStorage.getItem(LAST_CHECK_KEY)
    const now = Date.now()
    // Проверка раз в 15 минут, если не вызвано вручную
    if (lastCheck && (now - Number(lastCheck) < 15 * 60 * 1000) && !manualAnimeList) {
      return
    }

    setIsChecking(true)
    try {
      let itemsToCheck = user ? await getIdsToCheckFromDb() : getIdsToCheck()

      // Если передан ручной список (например, при добавлении в закладки), можно его использовать
      // Здесь пока простая логика
      if (manualAnimeList && manualAnimeList.length > 0) {
        // Доп. логика если нужно
      }

      if (itemsToCheck.length === 0) {
        setIsChecking(false)
        return
      }

      const ids = itemsToCheck.map((i) => i.id)
      const freshData = await getFreshAnimeData(ids)

      let currentUpdates = user 
        ? ([] as EpisodeUpdate[]) // При работе с БД логика немного другая (мы upsert-им), но для расчета берем пустой или текущий
        : (JSON.parse(localStorage.getItem(EPISODE_UPDATES_KEY) || "[]") as EpisodeUpdate[])
      
      // Если работаем с БД, лучше получить актуальные обновления перед слиянием, но для упрощения считаем новые
      if (user && updates.length > 0) {
        currentUpdates = [...updates]
      }

      const bookmarksSnapshot = JSON.parse(localStorage.getItem(BOOKMARK_SNAPSHOT_KEY) || "{}")
      const newBookmarksSnapshot = { ...bookmarksSnapshot }
      let hasChanges = false

      freshData.forEach((anime) => {
        const userItem = itemsToCheck.find((i) => i.id === anime.id)
        if (!userItem) return
        if (anime.status !== 'ongoing') return

        let baselineEpisode = userItem.watchedEpisode

        // Логика для закладок (snapshot для отслеживания изменений с момента последнего чека)
        if (userItem.source === 'bookmark') {
          if (newBookmarksSnapshot[anime.id]) {
            baselineEpisode = newBookmarksSnapshot[anime.id]
          } else {
            // Первый раз видим в закладках — запоминаем текущее состояние как базу
            newBookmarksSnapshot[anime.id] = anime.episodesCurrent
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

          // Обновляем снапшот, чтобы не уведомлять снова об этой серии
          if (userItem.source === 'bookmark') {
            newBookmarksSnapshot[anime.id] = anime.episodesCurrent
          }
        } else if (anime.episodesCurrent === baselineEpisode) {
          // Если пользователь досмотрел серию, удаляем уведомление
          const existingIndex = currentUpdates.findIndex((u) => u.animeId === anime.id)
          if (existingIndex !== -1) {
            currentUpdates.splice(existingIndex, 1)
            hasChanges = true
          }
        }
      })

      if (hasChanges) {
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
  }, [getIdsToCheck, getIdsToCheckFromDb, saveUpdates, saveUpdatesToDb, user])

  // 8. Удаление одного обновления
  const clearUpdate = useCallback((id: string) => {
    if (user) {
      supabase
        .from("episode_updates")
        .delete()
        .match({ user_id: user.id, anime_id: id })
        .then(({ error }: { error: any }) => {
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

  // 9. Очистка всех обновлений
  const clearAllUpdates = useCallback(() => {
    if (user) {
      supabase
        .from("episode_updates")
        .delete()
        .eq("user_id", user.id)
        .then(({ error }: { error: any }) => {
          if (error) console.error("Failed to clear all updates:", error)
          setUpdates([])
          setTimeout(() => window.dispatchEvent(new Event(UPDATE_EVENT)), 0)
        })
      return
    }
    saveUpdates([])
  }, [saveUpdates, user])

  // 10. Эффект инициализации и подписки на события
  useEffect(() => {
    setMounted(true)

    // Первичная загрузка
    if (user) {
      loadFromDb()
    } else {
      loadFromStorage()
    }

    // Слушаем изменения в других компонентах (local storage API для межвкладочной синхронизации)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === EPISODE_UPDATES_KEY) {
        loadFromStorage()
      }
    }

    // Слушаем кастомное событие (для синхронизации внутри одной вкладки)
    const handleCustomUpdate = () => {
      if (user) loadFromDb()
      else loadFromStorage()
    }

    // Слушаем событие о необходимости проверки обновлений (например, после просмотра серии)
    const handleCheckNeeded = () => {
      setTimeout(() => checkForUpdates(), 500)
    }

    window.addEventListener(UPDATE_EVENT, handleCustomUpdate)
    window.addEventListener("storage", handleStorageChange)
    window.addEventListener("episode-updates-check-needed", handleCheckNeeded)

    return () => {
      window.removeEventListener(UPDATE_EVENT, handleCustomUpdate)
      window.removeEventListener("storage", handleStorageChange)
      window.removeEventListener("episode-updates-check-needed", handleCheckNeeded)
    }
  }, [user, loadFromDb, loadFromStorage, checkForUpdates])

  // 11. Эффект автозапуска проверки
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