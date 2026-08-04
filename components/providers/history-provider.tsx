"use client"

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/components/auth/auth-provider"

type WatchHistoryItem = {
  id: string
  title: string
  poster: string
  timestamp: number
  episode?: number
  episodesTotal?: number
  is_archived?: boolean
}

type HistoryContextValue = {
  items: WatchHistoryItem[]
  isLoading: boolean
  add: (anime: WatchHistoryItem) => void
  clear: () => void
  remove: (ids: string[]) => void
  toggleArchived: (id: string) => void
  moveToArchive: (id: string) => void
}

const HistoryContext = createContext<HistoryContextValue | null>(null)

const STORAGE_KEY = "watch-history"

function safeParseHistory(raw: string | null): WatchHistoryItem[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as WatchHistoryItem[]
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item) => item && typeof item === "object" && typeof item.id === "string")
  } catch {
    return []
  }
}

export function HistoryProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<WatchHistoryItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const abortControllerRef = useRef<AbortController | null>(null)
  const { user } = useAuth()

  const add = useCallback(async (anime: WatchHistoryItem) => {
    // Вычисляем архивный статус: берем из объекта, либо из текущего стейта, либо false
    let currentIsArchived = false

    // 1. Оптимистичное обновление UI (мгновенно обновляем стейт без потери is_archived)
    setItems((prev) => {
      const existingItem = prev.find((item) => item.id === anime.id)
      currentIsArchived = anime.is_archived ?? existingItem?.is_archived ?? false
      
      const filtered = prev.filter((item) => item.id !== anime.id)
      const updatedItem = { ...anime, is_archived: currentIsArchived }
      return [updatedItem, ...filtered].slice(0, 20)
    })

    // 2. Если пользователь авторизован, сохраняем в БД
    if (user) {
      try {
        // ИСПОЛЬЗУЕМ UPSERT C ЯВНЫМ УКАЗАНИЕМ is_archived: false (или сохраняем текущий)
        const { error } = await supabase.from('watch_history').upsert({
          user_id: user.id,
          anime_id: anime.id,
          title: anime.title,
          poster: anime.poster,
          timestamp: anime.timestamp,
          episode: anime.episode,
          episodes_total: anime.episodesTotal,
          is_archived: currentIsArchived, // <--- ЯВНО УКАЗЫВАЕМ СТАТУС АРХИВА!
        }, { 
          onConflict: 'user_id, anime_id' 
        })

        if (error) {
          console.error("Failed to save history to DB:", error)
        } else {
           setTimeout(() => {
             window.dispatchEvent(new CustomEvent('episode-updates-check-needed'))
           }, 1000)
        }
      } catch (e) {
        console.error("Error in history add:", e)
      }
    }
  }, [user?.id])

  const clear = useCallback(async () => {
    setItems([])

    if (user) {
      await supabase.from('watch_history').delete().eq('user_id', user.id)
    } else {
      window.localStorage.removeItem(STORAGE_KEY)
    }
  }, [user?.id])

  // Загрузка данных
  useEffect(() => {
    let isMounted = true
    
    async function fetchHistory() {
      if (!isMounted) return
      
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      
      setIsLoading(true)
      
      abortControllerRef.current = new AbortController()
      const signal = abortControllerRef.current.signal
      
      const timeoutId = setTimeout(() => {
        if (abortControllerRef.current) {
          abortControllerRef.current.abort()
        }
      }, 5000)
      
      try {
        if (user) {
          if (signal.aborted) return
          
          const { data, error } = await supabase
            .from('watch_history')
            .select('*')
            .eq('user_id', user.id)
            .order('timestamp', { ascending: false })
          
          clearTimeout(timeoutId)
          
          if (signal.aborted) return
          
          if (error) {
            console.error('[HistoryProvider] Error fetching history:', error)
            const fallback = safeParseHistory(window.localStorage.getItem(STORAGE_KEY))
            if (isMounted) setItems(fallback)
          } else if (data && isMounted) {
            const remoteItems = data.map((row: any) => ({
              id: String(row.anime_id),
              title: row.title,
              poster: row.poster,
              timestamp: row.timestamp,
              episode: row.episode,
              episodesTotal: row.episodes_total,
              is_archived: row.is_archived === true // Явная проверка на boolean true
            }))
            setItems(remoteItems)
          }
        } else {
          const localItems = safeParseHistory(window.localStorage.getItem(STORAGE_KEY))
          if (isMounted) setItems(localItems)
        }
      } catch (err) {
        console.error('[HistoryProvider] Exception in fetchHistory:', err)
        clearTimeout(timeoutId)
        const fallback = safeParseHistory(window.localStorage.getItem(STORAGE_KEY))
        if (isMounted) setItems(fallback)
      } finally {
        clearTimeout(timeoutId)
        if (isMounted) setIsLoading(false)
      }
    }

    fetchHistory()
    
    const handleSupabaseReconnect = () => fetchHistory()
    window.addEventListener("supabase-reconnected", handleSupabaseReconnect)
    window.addEventListener("auth-synced", fetchHistory)
    
    const handleAddToHistory = (event: CustomEvent) => {
      add(event.detail)
    }
    window.addEventListener("add-to-history" as any, handleAddToHistory)
    
    return () => {
      isMounted = false
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
        abortControllerRef.current = null
      }
      window.removeEventListener("supabase-reconnected", handleSupabaseReconnect)
      window.removeEventListener("auth-synced", fetchHistory)
      window.removeEventListener("add-to-history" as any, handleAddToHistory)
    }
  }, [user?.id, add])

  useEffect(() => {
    if (!user?.id) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
    }
  }, [items, user?.id])

  useEffect(() => {
    if (typeof document === "undefined") return
    const ids = items.map((i) => i.id)
    document.cookie = `watched_history=${JSON.stringify(ids)}; path=/; max-age=31536000; SameSite=Lax`
  }, [items])

  const toggleArchived = useCallback(async (id: string) => {
    const currentItem = items.find(item => item.id === id)
    if (!currentItem) return

    const newArchivedStatus = !currentItem.is_archived

    setItems((prev) => 
      prev.map((item) => 
        item.id === id 
          ? { ...item, is_archived: newArchivedStatus }
          : item
      )
    )

    if (user) {
      try {
        await supabase
          .from('watch_history')
          .update({ is_archived: newArchivedStatus })
          .match({ user_id: user.id, anime_id: id })
      } catch (error) {
        console.error('Failed to toggle archive status:', error)
        setItems((prev) => 
          prev.map((item) => 
            item.id === id 
              ? { ...item, is_archived: currentItem.is_archived }
              : item
          )
        )
      }
    }
  }, [user?.id, items])

  const moveToArchive = useCallback(async (id: string) => {
    setItems((prev) => 
      prev.map((item) => 
        item.id === id 
          ? { ...item, is_archived: true }
          : item
      )
    )

    if (user) {
      try {
        await supabase
          .from('watch_history')
          .update({ is_archived: true })
          .match({ user_id: user.id, anime_id: id })
      } catch (error) {
        console.error('Failed to move to archive:', error)
      }
    }
  }, [user?.id])

  const remove = useCallback(async (ids: string[]) => {
    setItems((prev) => prev.filter(item => !ids.includes(item.id)))

    if (user) {
      try {
        for (const id of ids) {
          await supabase
            .from('watch_history')
            .delete()
            .match({ user_id: user.id, anime_id: id })
        }
      } catch (error) {
        console.error('[remove] Exception:', error)
      }
    } else {
      const existing = safeParseHistory(window.localStorage.getItem(STORAGE_KEY))
      const filtered = existing.filter(item => !ids.includes(item.id))
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered))
    }

    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('episode-updates-check-needed'))
    }, 500)
  }, [user?.id])

  const value = useMemo<HistoryContextValue>(() => ({ items, isLoading, add, clear, remove, toggleArchived, moveToArchive }), [items, isLoading, add, clear, remove, toggleArchived, moveToArchive])

  return <HistoryContext.Provider value={value}>{children}</HistoryContext.Provider>
}

export function useHistory() {
  const ctx = useContext(HistoryContext)
  if (!ctx) throw new Error("useHistory must be used within HistoryProvider")
  return ctx
}