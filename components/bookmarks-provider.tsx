"use client"

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import type { Anime } from "@/lib/shikimori"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/components/auth-provider"
import { loggers } from "@/lib/logger"

type BookmarkAnime = Anime & {
  is_completed?: boolean
  created_at?: string
}

type BookmarksContextValue = {
  items: BookmarkAnime[]
  isLoading: boolean
  isSaved: (id: string) => boolean
  add: (anime: BookmarkAnime) => void
  remove: (id: string) => void
  toggle: (anime: BookmarkAnime) => void
  toggleCompleted: (id: string) => void
}

const BookmarksContext = createContext<BookmarksContextValue | null>(null)

const STORAGE_KEY = "bookmarks_v1"

function safeParseBookmarks(raw: string | null): BookmarkAnime[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as BookmarkAnime[]
    if (!Array.isArray(parsed)) return []
    return parsed.filter((a) => a && typeof a === "object" && typeof (a as any).id === "string")
  } catch {
    return []
  }
}

export function BookmarksProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<BookmarkAnime[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const { user } = useAuth() // Получаем юзера

  // 1. Загрузка данных
  useEffect(() => {
    let isMounted = true
    
    async function fetchBookmarks() {
      if (!isMounted) return
      
      setIsLoading(true)
      try {
        if (user) {
          // Если залогинен - берем из Supabase
          const { data } = await supabase
            .from('bookmarks')
            .select('anime_data, is_completed, created_at')
            .eq('user_id', user.id)
          
          if (data && isMounted) {
            const remoteItems = data.map((row: any) => ({
              ...row.anime_data,
              is_completed: row.is_completed || false,
              created_at: row.created_at
            }))
            setItems(remoteItems)
          }
        } else {
          // Если нет - из LocalStorage
          if (isMounted) {
            setItems(safeParseBookmarks(window.localStorage.getItem(STORAGE_KEY)))
          }
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    fetchBookmarks()
    
    // Слушаем событие синхронизации после входа
    window.addEventListener("auth-synced", fetchBookmarks)
    return () => {
      isMounted = false
      window.removeEventListener("auth-synced", fetchBookmarks)
    }
  }, [user])

  // 2. Сохранение (LocalStorage для гостей + cookie для сервера)
  useEffect(() => {
    if (!user) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
    }
    // Синхронизируем ID закладок в cookies для сервера (и гости, и залогиненные) — чтобы «Для вас» их исключал
    const bookmarkIds = items.map((a) => a.id).join(",")
    document.cookie = `bookmark_ids=${bookmarkIds}; path=/; max-age=31536000; SameSite=Lax`
  }, [items, user])

  const isSaved = useCallback(
    (id: string) => {
      return items.some((a) => a.id === id)
    },
    [items],
  )

  const add = useCallback(async (anime: BookmarkAnime) => {
    setItems((prev) => {
      if (prev.some((a) => a.id === anime.id)) return prev
      return [anime, ...prev]
    })

    if (user) {
      try {
        await supabase.from('bookmarks').insert({
          user_id: user.id,
          anime_id: anime.id,
          anime_data: anime,
          created_at: new Date().toISOString()
        })
      } catch (error) {
        // Handle duplicate key error gracefully
        if ((error as any)?.code !== '23505') {
          loggers.bookmarks.error('Failed to add bookmark', error)
        }
      }
    }
  }, [user])

  const remove = useCallback(async (id: string) => {
    setItems((prev) => prev.filter((a) => a.id !== id))

    if (user) {
      try {
        await supabase.from('bookmarks').delete().match({ user_id: user.id, anime_id: id })
      } catch (error) {
        loggers.bookmarks.error('Failed to remove bookmark', error)
      }
    }
  }, [user])

  const toggle = useCallback(async (anime: BookmarkAnime) => {
    let isAdded = false
    setItems((prev) => {
      const exists = prev.some((a) => a.id === anime.id)
      if (exists) {
        return prev.filter((a) => a.id !== anime.id)
      }
      isAdded = true
      return [anime, ...prev]
    })

    if (user) {
      try {
        if (isAdded) {
          await supabase.from('bookmarks').insert({
            user_id: user.id,
            anime_id: anime.id,
            anime_data: anime
          })
        } else {
          await supabase.from('bookmarks').delete().match({ user_id: user.id, anime_id: anime.id })
        }
      } catch (error) {
        if ((error as any)?.code !== '23505') {
          loggers.bookmarks.error('Failed to toggle bookmark', error)
        }
      }
    }
  }, [user])

  const toggleCompleted = useCallback(async (id: string) => {
    setItems((prev) => 
      prev.map((anime) => 
        anime.id === id 
          ? { ...anime, is_completed: !anime.is_completed }
          : anime
      )
    )

    if (user) {
      const anime = items.find(a => a.id === id)
      if (anime) {
        try {
          await supabase
            .from('bookmarks')
            .update({ is_completed: !anime.is_completed })
            .match({ user_id: user.id, anime_id: id })
        } catch (error) {
          loggers.bookmarks.error('Failed to toggle bookmark completion', error)
          // Revert on error
          setItems((prev) => 
            prev.map((a) => 
              a.id === id 
                ? { ...a, is_completed: anime.is_completed }
                : a
            )
          )
        }
      }
    }
  }, [user, items])

  const value = useMemo<BookmarksContextValue>(() => ({ items, isLoading, isSaved, add, remove, toggle, toggleCompleted }), [items, isLoading, isSaved, add, remove, toggle, toggleCompleted])

  return <BookmarksContext.Provider value={value}>{children}</BookmarksContext.Provider>
}

export function useBookmarks() {
  const ctx = useContext(BookmarksContext)
  if (!ctx) throw new Error("useBookmarks must be used within BookmarksProvider")
  return ctx
}
