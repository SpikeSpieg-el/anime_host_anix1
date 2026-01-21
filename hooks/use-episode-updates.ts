"use client"

import { useEffect, useState, useCallback } from "react"
import type { Anime } from "@/lib/shikimori"

interface WatchedItem {
  id: string
  episode: number
  episodesTotal?: number
  lastChecked?: string
}

interface EpisodeUpdate {
  animeId: string
  animeTitle: string
  oldEpisode: number
  newEpisode: number
  totalEpisodes?: number
  updatedAt: string
}

const EPISODE_UPDATES_KEY = "episode_updates_v1"
const LAST_CHECK_KEY = "last_episode_check"

export function useEpisodeUpdates() {
  const [updates, setUpdates] = useState<EpisodeUpdate[]>([])
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const stored = localStorage.getItem(EPISODE_UPDATES_KEY)
    if (stored) {
      try {
        setUpdates(JSON.parse(stored))
      } catch (e) {
        console.error("Failed to parse episode updates:", e)
      }
    }
  }, [])

  const saveUpdates = useCallback((newUpdates: EpisodeUpdate[]) => {
    setUpdates(newUpdates)
    localStorage.setItem(EPISODE_UPDATES_KEY, JSON.stringify(newUpdates))
  }, [])

  // Get watched history from localStorage
  const getWatchedHistory = useCallback((): WatchedItem[] => {
    try {
      const history = JSON.parse(localStorage.getItem("watch-history") || "[]")
      return history
        .filter((item: any) => item && item.id && item.episode)
        .map((item: any) => ({
          id: item.id,
          episode: item.episode,
          episodesTotal: item.episodesTotal,
          lastChecked: item.lastChecked
        }))
    } catch (e) {
      console.error("Failed to get watched history:", e)
      return []
    }
  }, [])

  // Get bookmarked anime
  const getBookmarks = useCallback((): string[] => {
    try {
      const bookmarks = JSON.parse(localStorage.getItem("bookmarks_v1") || "[]")
      return bookmarks.map((b: any) => b.id).filter(Boolean)
    } catch (e) {
      console.error("Failed to get bookmarks:", e)
      return []
    }
  }, [])

  // Check for episode updates for specific anime
  const checkAnimeUpdates = useCallback(async (animeList: Anime[]) => {
    if (!mounted) return

    const watchedHistory = getWatchedHistory()
    const bookmarkIds = getBookmarks()
    const lastCheck = localStorage.getItem(LAST_CHECK_KEY)
    
    // Skip if checked recently (within last hour)
    if (lastCheck) {
      const lastCheckTime = new Date(lastCheck).getTime()
      const now = new Date().getTime()
      if (now - lastCheckTime < 60 * 60 * 1000) {
        return
      }
    }

    const newUpdates: EpisodeUpdate[] = []
    const currentUpdates = [...updates]

    for (const anime of animeList) {
      const watchedItem = watchedHistory.find(item => item.id === anime.id)
      const isBookmarked = bookmarkIds.includes(anime.id)

      // Only check updates for watched or bookmarked anime
      if (!watchedItem && !isBookmarked) continue

      const currentEpisode = anime.episodesCurrent
      const watchedEpisode = watchedItem?.episode || 0

      // Check if there are new episodes
      if (currentEpisode > watchedEpisode && currentEpisode > 0) {
        // Check if we already have this update
        const existingUpdate = currentUpdates.find(u => u.animeId === anime.id)
        
        if (!existingUpdate || existingUpdate.newEpisode < currentEpisode) {
          const update: EpisodeUpdate = {
            animeId: anime.id,
            animeTitle: anime.title,
            oldEpisode: watchedEpisode,
            newEpisode: currentEpisode,
            totalEpisodes: anime.episodesTotal || undefined,
            updatedAt: new Date().toISOString()
          }
          
          // Replace existing update or add new one
          if (existingUpdate) {
            const index = currentUpdates.indexOf(existingUpdate)
            currentUpdates[index] = update
          } else {
            currentUpdates.push(update)
          }
          
          newUpdates.push(update)
        }
      }
    }

    if (newUpdates.length > 0) {
      saveUpdates(currentUpdates)
    }

    // Update last check time
    localStorage.setItem(LAST_CHECK_KEY, new Date().toISOString())
  }, [mounted, getWatchedHistory, getBookmarks, updates, saveUpdates])

  // Clear updates for specific anime
  const clearUpdate = useCallback((animeId: string) => {
    const newUpdates = updates.filter(u => u.animeId !== animeId)
    saveUpdates(newUpdates)
  }, [updates, saveUpdates])

  // Clear all updates
  const clearAllUpdates = useCallback(() => {
    saveUpdates([])
  }, [saveUpdates])

  // Get update count
  const getUpdateCount = useCallback(() => {
    return updates.length
  }, [updates])

  // Get update for specific anime
  const getUpdateForAnime = useCallback((animeId: string) => {
    return updates.find(u => u.animeId === animeId)
  }, [updates])

  return {
    updates,
    checkAnimeUpdates,
    clearUpdate,
    clearAllUpdates,
    getUpdateCount,
    getUpdateForAnime,
    mounted
  }
}
