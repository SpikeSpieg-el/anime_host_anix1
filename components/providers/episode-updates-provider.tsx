"use client"

import React, { createContext, useCallback, useContext, useEffect, useState, useRef } from "react"
import { getFreshAnimeData } from "@/app/actions/get-fresh-anime-data"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/components/auth/auth-provider"

export interface EpisodeUpdate {
  animeId: string
  animeTitle: string
  oldEpisode: number
  newEpisode: number
  totalEpisodes?: number
  updatedAt: string
}

interface EpisodeUpdatesContextValue {
  updates: EpisodeUpdate[]
  checkAnimeUpdates: (force?: boolean) => void
  clearUpdate: (id: string) => void
  clearAllUpdates: () => void
  mounted: boolean
  isChecking: boolean
}

const EpisodeUpdatesContext = createContext<EpisodeUpdatesContextValue | null>(null)

const EPISODE_UPDATES_KEY = "episode_updates_v1"
const LAST_CHECK_KEY = "last_episode_check_ts"
const BOOKMARK_SNAPSHOT_KEY = "bookmarks_snapshot_v1"
const UPDATE_EVENT = "episode_updates_changed"

export function EpisodeUpdatesProvider({ children }: { children: React.ReactNode }) {
  const [updates, setUpdates] = useState<EpisodeUpdate[]>([])
  const [mounted, setMounted] = useState(false)
  const [isChecking, setIsChecking] = useState(false)
  const { user } = useAuth()

  const updatesRef = useRef<EpisodeUpdate[]>([])
  const isCheckingRef = useRef(false)

  useEffect(() => {
    updatesRef.current = updates
  }, [updates])

  const updateSnapshot = useCallback((animeId: string, episodeNumber: number) => {
    try {
      const raw = localStorage.getItem(BOOKMARK_SNAPSHOT_KEY)
      const snapshot = raw ? JSON.parse(raw) : {}

      if (!snapshot[animeId] || snapshot[animeId] < episodeNumber) {
        snapshot[animeId] = episodeNumber
        localStorage.setItem(BOOKMARK_SNAPSHOT_KEY, JSON.stringify(snapshot))
      }
    } catch (e) {
      console.error("Snapshot update error", e)
    }
  }, [])

  const loadUpdates = useCallback(async () => {
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
      const stored = localStorage.getItem(EPISODE_UPDATES_KEY)
      if (stored) {
        try {
          setUpdates(JSON.parse(stored))
        } catch {
          setUpdates([])
        }
      }
    }
  }, [user])

  const clearUpdate = useCallback(async (id: string) => {
    const target = updatesRef.current.find((u) => u.animeId === id)
    if (target) {
      updateSnapshot(id, target.newEpisode)
    }

    const newUpdates = updatesRef.current.filter((u) => u.animeId !== id)
    setUpdates(newUpdates)

    if (user) {
      const { error } = await supabase
        .from("episode_updates")
        .delete()
        .eq("user_id", user.id)
        .eq("anime_id", id)
      if (error) {
        console.error("Failed to delete episode update from DB:", error)
      }
    } else {
      localStorage.setItem(EPISODE_UPDATES_KEY, JSON.stringify(newUpdates))
    }

    window.dispatchEvent(new Event(UPDATE_EVENT))
  }, [user, updateSnapshot])

  const clearAllUpdates = useCallback(async () => {
    updatesRef.current.forEach((u) => updateSnapshot(u.animeId, u.newEpisode))

    setUpdates([])

    if (user) {
      const { error } = await supabase
        .from("episode_updates")
        .delete()
        .eq("user_id", user.id)
      if (error) {
        console.error("Failed to clear episode updates in DB:", error)
      }
    } else {
      localStorage.setItem(EPISODE_UPDATES_KEY, JSON.stringify([]))
    }

    window.dispatchEvent(new Event(UPDATE_EVENT))
  }, [user, updateSnapshot])

  const checkAnimeUpdates = useCallback(async (force?: boolean) => {
    if (typeof window === "undefined") return

    // Fix #3: Prevent concurrent execution
    if (isCheckingRef.current) return
    isCheckingRef.current = true

    // Throttle: once per 15 minutes unless forced
    if (!force) {
      const lastCheck = localStorage.getItem(LAST_CHECK_KEY)
      const now = Date.now()
      if (lastCheck && now - Number(lastCheck) < 15 * 60 * 1000) {
        isCheckingRef.current = false
        return
      }
    }

    setIsChecking(true)

    try {
      let idsToCheck: string[] = []
      type HistoryItem = { id: string; episode?: number }
      let watchHistory: HistoryItem[] = []

      let bookmarks: { id: string }[] = []

      if (user) {
        const [historyRes, bookmarksRes] = await Promise.all([
          supabase
            .from("watch_history")
            .select("anime_id, episode")
            .eq("user_id", user.id)
            .order("timestamp", { ascending: false })
            .limit(100),
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
        isCheckingRef.current = false
        setIsChecking(false)
        return
      }

      const freshData = await getFreshAnimeData(idsToCheck)

      // Dispatch fresh anime data so BookmarksProvider can refresh stale bookmark entries
      if (freshData.length > 0) {
        const freshMap: Record<string, { status: string; episodesCurrent: number; episodesTotal: number; title: string }> = {}
        freshData.forEach((a) => {
          freshMap[String(a.id)] = {
            status: a.status,
            episodesCurrent: a.episodesCurrent,
            episodesTotal: a.episodesTotal,
            title: a.title,
          }
        })
        window.dispatchEvent(new CustomEvent("anime-data-refreshed", { detail: freshMap }))
      }

      const snapshotRaw = localStorage.getItem(BOOKMARK_SNAPSHOT_KEY)
      const snapshot = snapshotRaw ? JSON.parse(snapshotRaw) : {}

      let newUpdatesList = [...updatesRef.current]
      let hasChanges = false

      // Build a set of IDs returned from the API for quick lookup
      const freshIds = new Set(freshData.map((a) => String(a.id)))

      freshData.forEach((anime) => {
        // Fix #1: For non-ongoing anime, remove any existing notification instead of skipping
        if (anime.status !== "ongoing") {
          const existingIdx = newUpdatesList.findIndex((u) => u.animeId === String(anime.id))
          if (existingIdx !== -1) {
            newUpdatesList.splice(existingIdx, 1)
            hasChanges = true
          }
          return
        }

        const historyItem = watchHistory.find((h: HistoryItem) => String(h.id) === String(anime.id))
        let watchedEp = historyItem ? historyItem.episode || 0 : 0

        if (snapshot[anime.id]) {
          watchedEp = Math.max(watchedEp, snapshot[anime.id])
        }

        if (anime.episodesCurrent > watchedEp) {
          const existingIdx = newUpdatesList.findIndex((u) => u.animeId === anime.id)

          if (existingIdx === -1 || newUpdatesList[existingIdx].newEpisode < anime.episodesCurrent) {
            const updateObj: EpisodeUpdate = {
              animeId: anime.id,
              animeTitle: anime.title,
              oldEpisode: watchedEp,
              newEpisode: anime.episodesCurrent,
              totalEpisodes: anime.episodesTotal,
              updatedAt: new Date().toISOString(),
            }

            if (existingIdx !== -1) {
              newUpdatesList[existingIdx] = updateObj
            } else {
              newUpdatesList.push(updateObj)
            }
            hasChanges = true
          }
        } else {
          const existingIdx = newUpdatesList.findIndex((u) => u.animeId === anime.id)
          if (existingIdx !== -1) {
            newUpdatesList.splice(existingIdx, 1)
            hasChanges = true
          }
        }
      })

      // Fix #1 (continued): Also remove notifications for IDs that the API didn't return at all
      // (anime may have been deleted from Shikimori or API failed for those IDs)
      // Only remove if we got a successful response (freshData.length > 0)
      if (freshData.length > 0) {
        const staleFromApi = newUpdatesList.filter(
          (u) => !freshIds.has(String(u.animeId)) && idsToCheck.includes(String(u.animeId))
        )
        if (staleFromApi.length > 0) {
          newUpdatesList = newUpdatesList.filter(
            (u) => !(idsToCheck.includes(String(u.animeId)) && !freshIds.has(String(u.animeId)))
          )
          hasChanges = true
        }
      }

      // Remove notifications for anime no longer in history or bookmarks
      const validIds = new Set(idsToCheck.map(String))
      const staleUpdates = newUpdatesList.filter((u) => !validIds.has(String(u.animeId)))
      if (staleUpdates.length > 0) {
        newUpdatesList = newUpdatesList.filter((u) => validIds.has(String(u.animeId)))
        hasChanges = true

        try {
          const snapshotRaw = localStorage.getItem(BOOKMARK_SNAPSHOT_KEY)
          if (snapshotRaw) {
            const snapshot = JSON.parse(snapshotRaw)
            let snapshotChanged = false
            staleUpdates.forEach((u) => {
              if (snapshot[u.animeId]) {
                delete snapshot[u.animeId]
                snapshotChanged = true
              }
            })
            if (snapshotChanged) {
              localStorage.setItem(BOOKMARK_SNAPSHOT_KEY, JSON.stringify(snapshot))
            }
          }
        } catch (e) {
          console.error("Snapshot cleanup error", e)
        }
      }

      if (hasChanges) {
        if (user) {
          const payload = newUpdatesList.map((u) => ({
            user_id: user.id,
            anime_id: u.animeId,
            anime_title: u.animeTitle,
            old_episode: u.oldEpisode,
            new_episode: u.newEpisode,
            total_episodes: u.totalEpisodes,
            updated_at: u.updatedAt,
          }))

          const keepIds = new Set(newUpdatesList.map((u) => u.animeId))
          const toDelete = updatesRef.current.filter((u) => !keepIds.has(u.animeId)).map((u) => u.animeId)
          if (toDelete.length > 0) {
            const { error: delError } = await supabase
              .from("episode_updates")
              .delete()
              .eq("user_id", user.id)
              .in("anime_id", toDelete)
            if (delError) {
              console.error("Failed to delete stale episode updates:", delError)
            }
          }
          if (payload.length > 0) {
            const { error: upsertError } = await supabase
              .from("episode_updates")
              .upsert(payload, { onConflict: "user_id, anime_id" })
            if (upsertError) {
              console.error("Failed to upsert episode updates:", upsertError)
            }
          }

          setUpdates(newUpdatesList)

          const newOnly = newUpdatesList.filter(
            (u) => !updatesRef.current.some((old) => old.animeId === u.animeId)
          )
          if (newOnly.length > 0) {
            const topUpdate = newUpdatesList[0]
            fetch("/api/push/send", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                userId: user.id,
                title: `Weebx — Новая серия: ${topUpdate.animeTitle}`,
                message: `Вышла серия ${topUpdate.newEpisode}${topUpdate.totalEpisodes ? ` из ${topUpdate.totalEpisodes}` : ""}`,
                url: `/watch/${topUpdate.animeId}`,
              }),
            }).catch((e) => console.warn("Push send failed:", e))
          }
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
      isCheckingRef.current = false
    }
  }, [user])

  useEffect(() => {
    setMounted(true)
    loadUpdates()

    const handleStorage = (e: StorageEvent) => {
      if (e.key === EPISODE_UPDATES_KEY) loadUpdates()
    }
    const handleCustom = () => loadUpdates()
    const handleCheckNeeded = () => checkAnimeUpdates(true)

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

  const value: EpisodeUpdatesContextValue = {
    updates,
    checkAnimeUpdates,
    clearUpdate,
    clearAllUpdates,
    mounted,
    isChecking,
  }

  return <EpisodeUpdatesContext.Provider value={value}>{children}</EpisodeUpdatesContext.Provider>
}

export function useEpisodeUpdatesContext() {
  const ctx = useContext(EpisodeUpdatesContext)
  if (!ctx) {
    throw new Error("useEpisodeUpdatesContext must be used within EpisodeUpdatesProvider")
  }
  return ctx
}
