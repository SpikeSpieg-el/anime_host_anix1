"use client"

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import type { Anime } from "@/lib/shikimori"

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

  const isSaved = useCallback(
    (id: string) => {
      return items.some((a) => a.id === id)
    },
    [items],
  )

  const add = useCallback((anime: BookmarkAnime) => {
    setItems((prev) => {
      if (prev.some((a) => a.id === anime.id)) return prev
      return [anime, ...prev]
    })
  }, [])

  const remove = useCallback((id: string) => {
    setItems((prev) => prev.filter((a) => a.id !== id))
  }, [])

  const toggle = useCallback(
    (anime: BookmarkAnime) => {
      setItems((prev) => {
        if (prev.some((a) => a.id === anime.id)) return prev.filter((a) => a.id !== anime.id)
        return [anime, ...prev]
      })
    },
    [],
  )

  const value = useMemo<BookmarksContextValue>(() => ({ items, isSaved, add, remove, toggle }), [items, isSaved, add, remove, toggle])

  return <BookmarksContext.Provider value={value}>{children}</BookmarksContext.Provider>
}

export function useBookmarks() {
  const ctx = useContext(BookmarksContext)
  if (!ctx) throw new Error("useBookmarks must be used within BookmarksProvider")
  return ctx
}
