"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { getFreshAnimeData } from "@/app/actions/get-fresh-anime-data"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/components/auth/auth-provider"

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
const UPDATE_EVENT = "episode_updates_changed"

export function useEpisodeUpdates() {
  const [updates, setUpdates] = useState<EpisodeUpdate[]>([])
  const [mounted, setMounted] = useState(false)
  const [isChecking, setIsChecking] = useState(false)
  const { user } = useAuth()

  // Храним updates в ref для доступа внутри асинхронных функций без зависимостей
  const updatesRef = useRef<EpisodeUpdate[]>([])
  useEffect(() => {
    updatesRef.current = updates
  }, [updates])

  // --- 1. Работа со Snapshot (что мы уже видели) ---
  const updateSnapshot = useCallback((animeId: string, episodeNumber: number) => {
    try {
      const raw = localStorage.getItem(BOOKMARK_SNAPSHOT_KEY)
      const snapshot = raw ? JSON.parse(raw) : {}
      
      // Обновляем только если новая серия больше той, что уже записана
      if (!snapshot[animeId] || snapshot[animeId] < episodeNumber) {
        snapshot[animeId] = episodeNumber
        localStorage.setItem(BOOKMARK_SNAPSHOT_KEY, JSON.stringify(snapshot))
      }
    } catch (e) {
      console.error("Snapshot update error", e)
    }
  }, [])

  // --- 2. Загрузка данных ---
  const loadUpdates = useCallback(async () => {
    // Если пользователь авторизован, грузим из БД
    if (user) {
      const { data, error } = await supabase
        .from("episode_updates")
        .select("*")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })

      if (!error && data) {
        const mapped = data.map((row: any) => ({
          animeId: String(row.anime_id),
          animeTitle: row.anime_title,
          oldEpisode: row.old_episode,
          newEpisode: row.new_episode,
          totalEpisodes: row.total_episodes,
          updatedAt: row.updated_at,
        }))
        setUpdates(mapped)
      } else {
        setUpdates([])
      }
    } else {
      // Иначе из LocalStorage
      const stored = localStorage.getItem(EPISODE_UPDATES_KEY)
      if (stored) {
        try {
          setUpdates(JSON.parse(stored))
        } catch { setUpdates([]) }
      }
    }
  }, [user])

  // --- 3. Удаление одного уведомления (FIXED) ---
  const clearUpdate = useCallback(async (id: string) => {
    // 1. Сразу находим, что удаляем, чтобы запомнить номер серии
    const target = updatesRef.current.find(u => u.animeId === id)
    if (target) {
      updateSnapshot(id, target.newEpisode)
    }

    // 2. ОПТИМИСТИЧНО обновляем UI (сразу убираем из списка)
    const newUpdates = updatesRef.current.filter(u => u.animeId !== id)
    setUpdates(newUpdates)

    // 3. Синхронизируем с хранилищем
    if (user) {
      // Удаляем из БД в фоне
      await supabase
        .from("episode_updates")
        .delete()
        .eq("user_id", user.id)
        .eq("anime_id", id)
    } else {
      localStorage.setItem(EPISODE_UPDATES_KEY, JSON.stringify(newUpdates))
    }
    
    // Генерируем событие для других вкладок
    window.dispatchEvent(new Event(UPDATE_EVENT))
  }, [user, updateSnapshot])

  // --- 4. Очистка всех уведомлений (FIXED) ---
  const clearAllUpdates = useCallback(async () => {
    // 1. Запоминаем все серии в snapshot
    updatesRef.current.forEach(u => updateSnapshot(u.animeId, u.newEpisode))

    // 2. Оптимистично чистим UI
    setUpdates([])

    // 3. Синхронизируем
    if (user) {
      await supabase
        .from("episode_updates")
        .delete()
        .eq("user_id", user.id)
    } else {
      localStorage.setItem(EPISODE_UPDATES_KEY, JSON.stringify([]))
    }
    
    window.dispatchEvent(new Event(UPDATE_EVENT))
  }, [user, updateSnapshot])

  // --- 5. Проверка обновлений (Main Logic) ---
  const checkAnimeUpdates = useCallback(async (manualList?: any[]) => {
    if (typeof window === "undefined") return

    // Троттлинг проверок (раз в 15 минут), если не вызвано вручную
    const lastCheck = localStorage.getItem(LAST_CHECK_KEY)
    const now = Date.now()
    if (!manualList && lastCheck && (now - Number(lastCheck) < 15 * 60 * 1000)) {
      return
    }

    setIsChecking(true)

    try {
      // Сбор ID для проверки и истории просмотров
      let idsToCheck: string[] = []
      type HistoryItem = { id: string; episode?: number }
      let watchHistory: HistoryItem[] = []

      let bookmarks: { id: string }[] = []

      if (user) {
        // Залогинен: и история, и закладки только в Supabase — грузим из БД
        const [historyRes, bookmarksRes] = await Promise.all([
          supabase
            .from("watch_history")
            .select("anime_id, episode")
            .eq("user_id", user.id)
            .order("timestamp", { ascending: false })
            .limit(50),
          supabase
            .from("bookmarks")
            .select("anime_id")
            .eq("user_id", user.id),
        ])

        if (!historyRes.error && historyRes.data) {
          watchHistory = historyRes.data.map((row: { anime_id: string; episode: number | null }) => ({
            id: String(row.anime_id),
            episode: row.episode ?? 0,
          }))
        }
        if (!bookmarksRes.error && bookmarksRes.data) {
          bookmarks = bookmarksRes.data.map((row: { anime_id: string }) => ({
            id: String(row.anime_id),
          }))
        }
      } else {
        watchHistory = JSON.parse(localStorage.getItem("watch-history") || "[]")
        bookmarks = JSON.parse(localStorage.getItem("bookmarks_v1") || "[]")
      }

      const idSet = new Set<string>()
      watchHistory.forEach((i: HistoryItem) => i.id && idSet.add(String(i.id)))
      bookmarks.forEach((i: { id: string }) => i.id && idSet.add(String(i.id)))
      idsToCheck = Array.from(idSet)

      if (idsToCheck.length === 0) {
        setIsChecking(false)
        return
      }

      // Запрашиваем свежие данные
      const freshData = await getFreshAnimeData(idsToCheck)

      // Читаем актуальный Snapshot
      const snapshotRaw = localStorage.getItem(BOOKMARK_SNAPSHOT_KEY)
      const snapshot = snapshotRaw ? JSON.parse(snapshotRaw) : {}

      let newUpdatesList = [...updatesRef.current]
      let hasChanges = false

      freshData.forEach(anime => {
        if (anime.status !== "ongoing") return

        // Определяем, какую серию пользователь уже видел
        // 1. Из истории просмотра (из БД для авторизованных или из localStorage)
        const historyItem = watchHistory.find((h: HistoryItem) => String(h.id) === String(anime.id))
        let watchedEp = historyItem ? (historyItem.episode || 0) : 0

        // 2. Из снепшота (если удалял уведомление)
        if (snapshot[anime.id]) {
          watchedEp = Math.max(watchedEp, snapshot[anime.id])
        }

        // Логика: Если вышла новая серия И мы её еще не видели (ни в истории, ни в скрытых)
        if (anime.episodesCurrent > watchedEp) {
          const existingIdx = newUpdatesList.findIndex(u => u.animeId === anime.id)
          
          // Если уведомления нет или оно устарело
          if (existingIdx === -1 || newUpdatesList[existingIdx].newEpisode < anime.episodesCurrent) {
            const updateObj: EpisodeUpdate = {
              animeId: anime.id,
              animeTitle: anime.title,
              oldEpisode: watchedEp,
              newEpisode: anime.episodesCurrent,
              totalEpisodes: anime.episodesTotal,
              updatedAt: new Date().toISOString()
            }

            if (existingIdx !== -1) {
              newUpdatesList[existingIdx] = updateObj
            } else {
              newUpdatesList.push(updateObj)
            }
            hasChanges = true
          }
        } 
        // Если пользователь уже посмотрел серию (watchedEp >= current), а уведомление висит -> удаляем
        else {
          const existingIdx = newUpdatesList.findIndex(u => u.animeId === anime.id)
          if (existingIdx !== -1) {
            newUpdatesList.splice(existingIdx, 1)
            hasChanges = true
          }
        }
      })

      // Сохраняем, если были изменения
      if (hasChanges) {
        if (user) {
          const payload = newUpdatesList.map(u => ({
            user_id: user.id,
            anime_id: u.animeId,
            anime_title: u.animeTitle,
            old_episode: u.oldEpisode,
            new_episode: u.newEpisode,
            total_episodes: u.totalEpisodes,
            updated_at: u.updatedAt
          }))

          const keepIds = new Set(newUpdatesList.map(u => u.animeId))
          const toDelete = updatesRef.current.filter(u => !keepIds.has(u.animeId)).map(u => u.animeId)
          if (toDelete.length > 0) {
            await supabase
              .from("episode_updates")
              .delete()
              .eq("user_id", user.id)
              .in("anime_id", toDelete)
          }
          if (payload.length > 0) {
            await supabase.from("episode_updates").upsert(payload, { onConflict: "user_id, anime_id" })
          }

          setUpdates(newUpdatesList)
        } else {
          localStorage.setItem(EPISODE_UPDATES_KEY, JSON.stringify(newUpdatesList))
          setUpdates(newUpdatesList)
        }
      }
      
      localStorage.setItem(LAST_CHECK_KEY, String(Date.now()))

    } catch (e) {
      console.error("Check updates failed", e)
    } finally {
      setIsChecking(false)
    }
  }, [user])

  // --- 6. Инициализация ---
  useEffect(() => {
    setMounted(true)
    loadUpdates()

    const handleStorage = (e: StorageEvent) => {
      if (e.key === EPISODE_UPDATES_KEY) loadUpdates()
    }
    const handleCustom = () => loadUpdates()
    // После сохранения истории в БД — перепроверить уведомления (без троттлинга)
    const handleCheckNeeded = () => checkAnimeUpdates([])

    // Запускаем проверку при входе
    const timer = setTimeout(() => checkAnimeUpdates(), 2000)

    window.addEventListener("storage", handleStorage)
    window.addEventListener(UPDATE_EVENT, handleCustom)
    window.addEventListener("episode-updates-check-needed" as any, handleCheckNeeded)

    return () => {
      clearTimeout(timer)
      window.removeEventListener("storage", handleStorage)
      window.removeEventListener(UPDATE_EVENT, handleCustom)
      window.removeEventListener("episode-updates-check-needed" as any, handleCheckNeeded)
    }
  }, [loadUpdates, checkAnimeUpdates])

  return {
    updates,
    checkAnimeUpdates,
    clearUpdate,
    clearAllUpdates,
    mounted,
    isChecking
  }
}