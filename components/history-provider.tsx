"use client"

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/components/auth-provider"

type WatchHistoryItem = {
  id: string
  title: string
  poster: string
  timestamp: number
  episode?: number
  episodesTotal?: number
}

type HistoryContextValue = {
  items: WatchHistoryItem[]
  add: (anime: WatchHistoryItem) => void
  clear: () => void
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
        // ИСПОЛЬЗУЕМ UPSERT ВМЕСТО DELETE + INSERT
        // Это гарантирует обновление записи, если она есть, или создание новой
        const { error } = await supabase.from('watch_history').upsert({
          user_id: user.id,
          anime_id: anime.id,
          title: anime.title,
          poster: anime.poster,
          timestamp: anime.timestamp,
          episode: anime.episode,
          episodes_total: anime.episodesTotal
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
  }, [user])

  const clear = useCallback(async () => {
    setItems([])

    if (user) {
      await supabase.from('watch_history').delete().eq('user_id', user.id)
    } else {
      window.localStorage.removeItem(STORAGE_KEY)
    }
  }, [user])

  // Загрузка данных
  useEffect(() => {
    async function fetchHistory() {
      if (user) {
        // Если залогинен - берем из Supabase
        const { data, error } = await supabase
          .from('watch_history')
          .select('*')
          .eq('user_id', user.id)
          .order('timestamp', { ascending: false })
        
        if (data) {
          const remoteItems = data.map((row: any) => ({
            id: String(row.anime_id), // Приводим к строке для надежности
            title: row.title,
            poster: row.poster,
            timestamp: row.timestamp,
            episode: row.episode,
            episodesTotal: row.episodes_total
          }))
          setItems(remoteItems)
        }
      } else {
        // Если нет - из LocalStorage
        setItems(safeParseHistory(window.localStorage.getItem(STORAGE_KEY)))
      }
    }

    fetchHistory()
    
    // Слушаем событие синхронизации после входа
    window.addEventListener("auth-synced", fetchHistory)
    
    // Слушаем события добавления в историю (от HistoryTracker)
    const handleAddToHistory = (event: CustomEvent) => {
      add(event.detail)
    }
    window.addEventListener("add-to-history" as any, handleAddToHistory)
    
    return () => {
      window.removeEventListener("auth-synced", fetchHistory)
      window.removeEventListener("add-to-history" as any, handleAddToHistory)
    }
  }, [user, add]) // Важно: add в зависимостях, так как он зависит от user

  // Сохранение в localStorage (только для анонимов)
  useEffect(() => {
    if (!user) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
    }
  }, [items, user])

  const value = useMemo<HistoryContextValue>(() => ({ items, add, clear }), [items, add, clear])

  return <HistoryContext.Provider value={value}>{children}</HistoryContext.Provider>
}

export function useHistory() {
  const ctx = useContext(HistoryContext)
  if (!ctx) throw new Error("useHistory must be used within HistoryProvider")
  return ctx
}