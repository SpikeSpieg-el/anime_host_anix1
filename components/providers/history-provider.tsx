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
    // 1. Оптимистичное обновление UI (мгновенно обновляем стейт)
    setItems((prev) => {
      const filtered = prev.filter((item) => item.id !== anime.id)
      return [anime, ...filtered].slice(0, 20)
    })

    // 2. Если пользователь авторизован, сохраняем в БД
    if (user) {
      try {
        // Проверяем, завершено ли аниме (досмотрен до последней серии)
        const isCompleted = anime.episodesTotal && anime.episode && anime.episode >= anime.episodesTotal
        
        // ИСПОЛЬЗУЕМ UPSERT ВМЕСТО DELETE + INSERT
        // Это гарантирует обновление записи, если она есть, или создание новой
        const { error } = await supabase.from('watch_history').upsert({
          user_id: user.id,
          anime_id: anime.id,
          title: anime.title,
          poster: anime.poster,
          timestamp: anime.timestamp,
          episode: anime.episode,
          episodes_total: anime.episodesTotal,
          is_archived: isCompleted // Автоматически перемещаем в архив если завершено
        }, { 
          onConflict: 'user_id, anime_id' 
        })

        if (error) {
          console.error("Failed to save history to DB:", error)
        } else {
           // Запускаем проверку обновлений эпизодов только после успешного сохранения
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
      if (!isMounted) {
        console.log('[HistoryProvider] Component unmounted, skipping fetch')
        return
      }
      
      console.log('[HistoryProvider] Starting fetchHistory, user:', user?.id)
      
      // Отменяем предыдущий запрос если он завис
      if (abortControllerRef.current) {
        console.log('[HistoryProvider] Aborting previous request')
        abortControllerRef.current.abort()
      }
      
      setIsLoading(true)
      
      // Создаём новый AbortController
      abortControllerRef.current = new AbortController()
      const signal = abortControllerRef.current.signal
      
      const timeoutId = setTimeout(() => {
        console.log('[HistoryProvider] Request timeout, aborting')
        if (abortControllerRef.current) {
          abortControllerRef.current.abort()
        }
      }, 5000) // 5 секунд
      
      try {
        if (user) {
          // Если залогинен - берем из Supabase
          console.log('[HistoryProvider] Fetching from Supabase for user:', user.id)
          
          // Проверяем не отменён ли запрос
          if (signal.aborted) {
            console.log('[HistoryProvider] Request already aborted before fetch')
            return
          }
          
          const { data, error } = await supabase
            .from('watch_history')
            .select('*')
            .eq('user_id', user.id)
            .order('timestamp', { ascending: false })
          
          clearTimeout(timeoutId)
          
          // Проверяем не отменён ли запрос после fetch
          if (signal.aborted) {
            console.log('[HistoryProvider] Request aborted after fetch')
            return
          }
          
          if (error) {
            console.error('[HistoryProvider] Error fetching history:', error)
            // При ошибке используем localStorage как fallback
            const fallback = safeParseHistory(window.localStorage.getItem(STORAGE_KEY))
            console.log('[HistoryProvider] Using localStorage fallback, items:', fallback.length)
            if (isMounted) {
              setItems(fallback)
            }
          } else if (data && isMounted) {
            const remoteItems = data.map((row: any) => ({
              id: String(row.anime_id),
              title: row.title,
              poster: row.poster,
              timestamp: row.timestamp,
              episode: row.episode,
              episodesTotal: row.episodes_total,
              is_archived: row.is_archived || false
            }))
            console.log('[HistoryProvider] Loaded from Supabase, items:', remoteItems.length)
            setItems(remoteItems)
          }
        } else {
          // Если нет - из LocalStorage
          const localItems = safeParseHistory(window.localStorage.getItem(STORAGE_KEY))
          console.log('[HistoryProvider] No user, loading from localStorage, items:', localItems.length)
          if (isMounted) {
            setItems(localItems)
          }
        }
      } catch (err) {
        console.error('[HistoryProvider] Exception in fetchHistory:', err)
        clearTimeout(timeoutId)
        // При исключении используем localStorage
        const fallback = safeParseHistory(window.localStorage.getItem(STORAGE_KEY))
        console.log('[HistoryProvider] Exception fallback, items:', fallback.length)
        if (isMounted) {
          setItems(fallback)
        }
      } finally {
        clearTimeout(timeoutId)
        if (isMounted) {
          console.log('[HistoryProvider] Fetch completed, setting isLoading to false')
          setIsLoading(false)
        }
      }
    }

    fetchHistory()
    
    // Слушаем событие переподключения Supabase (вызывается из lib/supabase.ts)
    const handleSupabaseReconnect = () => {
      console.log('[HistoryProvider] Supabase reconnected, reloading history...')
      fetchHistory()
    }

    window.addEventListener("supabase-reconnected", handleSupabaseReconnect)
    
    // Слушаем событие синхронизации после входа
    window.addEventListener("auth-synced", fetchHistory)
    
    // Слушаем события добавления в историю (от HistoryTracker)
    const handleAddToHistory = (event: CustomEvent) => {
      add(event.detail)
    }
    window.addEventListener("add-to-history" as any, handleAddToHistory)
    
    return () => {
      isMounted = false
      // Отменяем все pending запросы
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

  // Синхронизация ID истории в cookie для сервера (исключение из «Для вас» на главной)
  useEffect(() => {
    if (typeof document === "undefined") return
    const ids = items.map((i) => i.id)
    document.cookie = `watched_history=${JSON.stringify(ids)}; path=/; max-age=31536000; SameSite=Lax`
  }, [items])

  const toggleArchived = useCallback(async (id: string) => {
    const currentItem = items.find(item => item.id === id)
    if (!currentItem) return

    setItems((prev) => 
      prev.map((item) => 
        item.id === id 
          ? { ...item, is_archived: !item.is_archived }
          : item
      )
    )

    if (user) {
      try {
        await supabase
          .from('watch_history')
          .update({ is_archived: !currentItem.is_archived })
          .match({ user_id: user.id, anime_id: id })
      } catch (error) {
        console.error('Failed to toggle archive status:', error)
        // Revert on error
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
    console.log('[remove] Starting removal of ids:', ids)
    console.log('[remove] User:', user?.id)
    setItems((prev) => prev.filter(item => !ids.includes(item.id)))

    if (user) {
      try {
        // Delete each item individually using match like toggleArchived
        for (const id of ids) {
          console.log(`[remove] Deleting anime_id: ${id}, user_id: ${user.id}`)
          const { error } = await supabase
            .from('watch_history')
            .delete()
            .match({ user_id: user.id, anime_id: id })
          
          if (error) {
            console.error(`[remove] Failed to remove item ${id}:`, error)
          } else {
            console.log(`[remove] Successfully removed item ${id}`)
          }
        }
        
        // Force reload from database to ensure sync
        console.log('[remove] Reloading data from database...')
        const { data, error } = await supabase
          .from('watch_history')
          .select('*')
          .eq('user_id', user.id)
          .order('timestamp', { ascending: false })
        
        if (data) {
          const remoteItems = data.map((row: any) => ({
            id: String(row.anime_id),
            title: row.title,
            poster: row.poster,
            timestamp: row.timestamp,
            episode: row.episode,
            episodesTotal: row.episodes_total,
            is_archived: row.is_archived || false
          }))
          console.log('[remove] Reloaded items count:', remoteItems.length)
          setItems(remoteItems)
        }
        if (error) {
          console.error('[remove] Error reloading:', error)
        }
      } catch (error) {
        console.error('[remove] Exception:', error)
      }
    } else {
      console.log('[remove] Guest mode - updating localStorage')
      // Handle localStorage for guests
      const existing = safeParseHistory(window.localStorage.getItem(STORAGE_KEY))
      const filtered = existing.filter(item => !ids.includes(item.id))
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered))
      console.log('[remove] localStorage updated')
    }

    // Trigger episode updates recheck after removal
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