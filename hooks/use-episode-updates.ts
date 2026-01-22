"use client"

import { useEffect, useState, useCallback } from "react"
import { getFreshAnimeData } from "@/app/actions/get-fresh-anime-data"

interface EpisodeUpdate {
  animeId: string
  animeTitle: string
  oldEpisode: number
  newEpisode: number
  totalEpisodes?: number
  updatedAt: string
}

// Ключи localStorage
const EPISODE_UPDATES_KEY = "episode_updates_v1"
const LAST_CHECK_KEY = "last_episode_check_ts"
const BOOKMARK_SNAPSHOT_KEY = "bookmarks_snapshot_v1"
const UPDATE_EVENT = "episode_updates_changed" // Имя события для синхронизации

export function useEpisodeUpdates() {
  const [updates, setUpdates] = useState<EpisodeUpdate[]>([])
  const [mounted, setMounted] = useState(false)
  const [isChecking, setIsChecking] = useState(false)

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

    // Слушаем изменения в других компонентах
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === EPISODE_UPDATES_KEY) {
        loadFromStorage()
      }
    }

    // Слушаем наше кастомное событие (для синхронизации в одной вкладке)
    window.addEventListener(UPDATE_EVENT, loadFromStorage)
    // Слушаем изменения storage (для синхронизации между вкладками)
    window.addEventListener("storage", handleStorageChange)

    return () => {
      window.removeEventListener(UPDATE_EVENT, loadFromStorage)
      window.removeEventListener("storage", handleStorageChange)
    }
  }, [loadFromStorage])

  // Сохранение обновлений
  const saveUpdates = useCallback((newUpdates: EpisodeUpdate[]) => {
    setUpdates(newUpdates)
    localStorage.setItem(EPISODE_UPDATES_KEY, JSON.stringify(newUpdates))
    // Уведомляем другие компоненты (например, Navbar)
    window.dispatchEvent(new Event(UPDATE_EVENT))
  }, [])

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

  // 3. Проверка обновлений
  const checkForUpdates = useCallback(async (manualAnimeList?: any[]) => {
    if (typeof window === "undefined") return

    const lastCheck = localStorage.getItem(LAST_CHECK_KEY)
    const now = Date.now()
    // Проверка раз в 15 минут (уменьшил время для тестов)
    if (lastCheck && (now - Number(lastCheck) < 15 * 60 * 1000) && !manualAnimeList) {
      return 
    }

    setIsChecking(true)
    try {
      let itemsToCheck = getIdsToCheck()
      
      // Если передан ручной список (например, из закладок), добавляем/обновляем его
      if (manualAnimeList && manualAnimeList.length > 0) {
        // Мы используем getIdsToCheck как базу, но если пришли данные из компонента,
        // убеждаемся, что они учтены (хотя getIdsToCheck и так берет из LS)
      }

      if (itemsToCheck.length === 0) {
         setIsChecking(false)
         return
      }

      const ids = itemsToCheck.map((i) => i.id)
      const freshData = await getFreshAnimeData(ids)

      let currentUpdates = JSON.parse(localStorage.getItem(EPISODE_UPDATES_KEY) || "[]") as EpisodeUpdate[]
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
            // Первая инициализация закладки - запоминаем текущее состояние
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
          
          if (userItem.source === 'bookmark') {
             newBookmarksSnapshot[anime.id] = anime.episodesCurrent
          }
        }
      })

      if (hasChanges) {
        saveUpdates(currentUpdates)
      }
      
      localStorage.setItem(LAST_CHECK_KEY, String(Date.now()))
      localStorage.setItem(BOOKMARK_SNAPSHOT_KEY, JSON.stringify(newBookmarksSnapshot))

    } catch (error) {
      console.error("Update check failed:", error)
    } finally {
      setIsChecking(false)
    }
  }, [getIdsToCheck, saveUpdates])

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
      window.dispatchEvent(new Event(UPDATE_EVENT)) // Уведомляем всех
      return next
    })
  }, [])

  const clearAllUpdates = useCallback(() => {
    saveUpdates([])
  }, [saveUpdates])

  return {
    updates,
    checkAnimeUpdates: checkForUpdates,
    clearUpdate,
    clearAllUpdates,
    mounted,
    isChecking,
  }
}