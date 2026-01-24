"use client"

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import type { Anime } from "@/lib/shikimori"


import { supabase } from "@/lib/supabase"
import { useAuth } from "@/components/auth-provider"
 

type BookmarkAnime = Anime

type BookmarksContextValue = {
  items: BookmarkAnime[]
  isSaved: (id: string) => boolean
  add: (anime: BookmarkAnime) => void
  remove: (id: string) => void
  toggle: (anime: BookmarkAnime) => void
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


  useEffect(() => {
    setItems(safeParseBookmarks(window.localStorage.getItem(STORAGE_KEY)))
  }, [])

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
    
    // Синхронизируем ID закладок в cookies для server-side доступа
    const bookmarkIds = items.map(a => a.id).join(',')
    document.cookie = `bookmark_ids=${bookmarkIds}; path=/; max-age=31536000; SameSite=Lax`
  }, [items])

  const { user } = useAuth() // Получаем юзера

  // 1. Загрузка данных
  useEffect(() => {
    async function fetchBookmarks() {
      if (user) {
        // Если залогинен - берем из Supabase
        const { data } = await supabase
          .from('bookmarks')
          .select('anime_data')
          .eq('user_id', user.id)
        
        if (data) {
          const remoteItems = data.map(row => row.anime_data)
          setItems(remoteItems)
        }
      } else {
        // Если нет - из LocalStorage
        setItems(safeParseBookmarks(window.localStorage.getItem(STORAGE_KEY)))
      }
    }

    fetchBookmarks()
    
    // Слушаем событие синхронизации после входа
    window.addEventListener("auth-synced", fetchBookmarks)
    return () => window.removeEventListener("auth-synced", fetchBookmarks)
  }, [user])

  // 2. Сохранение (Эффект для LocalStorage)
  useEffect(() => {
    if (!user) {
      // Сохраняем в LS только если не залогинен (или можно дублировать для оффлайн режима)
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
      
      // Синхронизируем ID закладок в cookies для server-side доступа
      const bookmarkIds = items.map(a => a.id).join(',')
      document.cookie = `bookmark_ids=${bookmarkIds}; path=/; max-age=31536000; SameSite=Lax`
    }
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
      await supabase.from('bookmarks').insert({
        user_id: user.id,
        anime_id: anime.id,
        anime_data: anime
      })
    }
  }, [user])

  const remove = useCallback(async (id: string) => {
    setItems((prev) => prev.filter((a) => a.id !== id))

    if (user) {
      await supabase.from('bookmarks').delete().match({ user_id: user.id, anime_id: id })
    }
  }, [user])

  const toggle = useCallback(async (anime: BookmarkAnime) => {
    // Оптимистичное обновление UI
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
      if (isAdded) { // было добавлено в стейт, значит insert в БД
         await supabase.from('bookmarks').insert({
            user_id: user.id,
            anime_id: anime.id,
            anime_data: anime
         }).select().single().then(({error}) => {
             // Если запись уже есть (конфликт), ничего страшного
             if(error && error.code !== '23505') console.error(error)
         })
      } else { // удалено из стейта, delete из БД
         await supabase.from('bookmarks').delete().match({ user_id: user.id, anime_id: anime.id })
      }
    }
  }, [user])
 

  const value = useMemo<BookmarksContextValue>(() => ({ items, isSaved, add, remove, toggle }), [items, isSaved, add, remove, toggle])

  return <BookmarksContext.Provider value={value}>{children}</BookmarksContext.Provider>
}

export function useBookmarks() {
  const ctx = useContext(BookmarksContext)
  if (!ctx) throw new Error("useBookmarks must be used within BookmarksProvider")
  return ctx
}
