"use client"

import React, { createContext, useContext, useCallback, useEffect, useState, useRef } from "react"
import { resolveBestPoster, getAnimeBackdrop } from "@/lib/shikimori/images"

interface CoverCache {
  [animeId: string]: {
    poster: string
    backdrop: string | null
    timestamp: number
    sources: string[]
  }
}

interface CoverContextValue {
  getPoster: (animeId: string, shikimoriUrl: string, romajiName: string, russianName: string, disableExternalAPIs?: boolean) => Promise<string>
  getBackdrop: (animeId: string, disableExternalAPIs?: boolean) => Promise<string | null>
  preloadBatch: (animes: Array<{ id: string; shikimoriUrl: string; romajiName: string; russianName: string }>) => Promise<void>
  getFromCache: (animeId: string) => { poster: string; backdrop: string | null } | null
  clearCache: () => void
  isLoading: boolean
}

const CoverContext = createContext<CoverContextValue | null>(null)

const CACHE_KEY = "cover-cache"
const CACHE_VERSION = "v1"
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000 // 7 дней

function loadCacheFromStorage(): CoverCache {
  if (typeof window === "undefined") return {}
  
  try {
    const raw = window.localStorage.getItem(CACHE_KEY)
    if (!raw) return {}
    
    const data = JSON.parse(raw)
    if (data.version !== CACHE_VERSION) return {}
    
    // Очищаем устаревшие записи
    const now = Date.now()
    const cleaned: CoverCache = {}
    
    for (const [id, entry] of Object.entries(data.cache || {})) {
      const typedEntry = entry as { poster: string; backdrop: string | null; timestamp: number; sources: string[] }
      if (now - typedEntry.timestamp < CACHE_TTL) {
        cleaned[id] = typedEntry
      }
    }
    
    return cleaned
  } catch {
    return {}
  }
}

function saveCacheToStorage(cache: CoverCache) {
  if (typeof window === "undefined") return
  
  try {
    const data = {
      version: CACHE_VERSION,
      cache,
      timestamp: Date.now()
    }
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(data))
  } catch (e) {
    console.error('[CoverProvider] Failed to save cache:', e)
  }
}

export function CoverProvider({ children }: { children: React.ReactNode }) {
  const [cache, setCache] = useState<CoverCache>({})
  const [isLoading, setIsLoading] = useState(false)
  const pendingRequestsRef = useRef<Map<string, Promise<string>>>(new Map())
  const pendingBackdropRequestsRef = useRef<Map<string, Promise<string | null>>>(new Map())

  // Загружаем кэш при монтировании
  useEffect(() => {
    const saved = loadCacheFromStorage()
    setCache(saved)
  }, [])

  // Сохраняем кэш при изменениях
  useEffect(() => {
    if (Object.keys(cache).length > 0) {
      saveCacheToStorage(cache)
    }
  }, [cache])

  const getPoster = useCallback(async (
    animeId: string,
    shikimoriUrl: string,
    romajiName: string,
    russianName: string,
    disableExternalAPIs: boolean = false
  ): Promise<string> => {
    // Проверяем кэш
    const cached = cache[animeId]
    if (cached && cached.poster) {
      console.log(`[CoverProvider] Poster cache hit for ${animeId}`)
      return cached.poster
    }

    // Проверяем pending запросы
    const pending = pendingRequestsRef.current.get(animeId)
    if (pending) {
      console.log(`[CoverProvider] Using pending request for ${animeId}`)
      return pending
    }

    // Создаём новый запрос
    const promise = (async () => {
      try {
        console.log(`[CoverProvider] Fetching poster for ${animeId} (${russianName || romajiName})`)
        
        const poster = await resolveBestPoster(
          shikimoriUrl,
          romajiName,
          russianName,
          animeId,
          disableExternalAPIs
        )

        // Определяем источник
        const sources: string[] = []
        if (poster.includes('shikimori')) sources.push('shikimori')
        else if (poster.includes('kodik')) sources.push('kodik')
        else if (poster.includes('anilist')) sources.push('anilist')
        else if (poster.includes('myanimelist') || poster.includes('jikan')) sources.push('mal')
        else sources.push('fallback')

        console.log(`[CoverProvider] Poster for ${animeId} from: ${sources.join(', ')}`)

        // Обновляем кэш
        setCache(prev => ({
          ...prev,
          [animeId]: {
            poster,
            backdrop: prev[animeId]?.backdrop || null,
            timestamp: Date.now(),
            sources
          }
        }))

        return poster
      } catch (error) {
        console.error(`[CoverProvider] Error fetching poster for ${animeId}:`, error)
        
        // Fallback - генерируем заглушку
        const fallback = generateFallbackPoster(russianName || romajiName || "Anime")
        
        setCache(prev => ({
          ...prev,
          [animeId]: {
            poster: fallback,
            backdrop: prev[animeId]?.backdrop || null,
            timestamp: Date.now(),
            sources: ['fallback']
          }
        }))

        return fallback
      } finally {
        // Удаляем из pending
        pendingRequestsRef.current.delete(animeId)
      }
    })()

    pendingRequestsRef.current.set(animeId, promise)
    return promise
  }, [cache])

  const getBackdrop = useCallback(async (
    animeId: string,
    disableExternalAPIs: boolean = false
  ): Promise<string | null> => {
    // Проверяем кэш
    const cached = cache[animeId]
    if (cached && cached.backdrop !== undefined) {
      console.log(`[CoverProvider] Backdrop cache hit for ${animeId}`)
      return cached.backdrop
    }

    // Проверяем pending запросы
    const pending = pendingBackdropRequestsRef.current.get(animeId)
    if (pending) {
      console.log(`[CoverProvider] Using pending backdrop request for ${animeId}`)
      return pending
    }

    // Создаём новый запрос
    const promise = (async () => {
      try {
        console.log(`[CoverProvider] Fetching backdrop for ${animeId}`)
        
        const backdrop = await getAnimeBackdrop(animeId, disableExternalAPIs)

        console.log(`[CoverProvider] Backdrop for ${animeId}: ${backdrop ? 'found' : 'not found'}`)

        // Обновляем кэш
        setCache(prev => ({
          ...prev,
          [animeId]: {
            poster: prev[animeId]?.poster || '',
            backdrop,
            timestamp: Date.now(),
            sources: prev[animeId]?.sources || []
          }
        }))

        return backdrop
      } catch (error) {
        console.error(`[CoverProvider] Error fetching backdrop for ${animeId}:`, error)
        
        setCache(prev => ({
          ...prev,
          [animeId]: {
            poster: prev[animeId]?.poster || '',
            backdrop: null,
            timestamp: Date.now(),
            sources: prev[animeId]?.sources || []
          }
        }))

        return null
      } finally {
        // Удаляем из pending
        pendingBackdropRequestsRef.current.delete(animeId)
      }
    })()

    pendingBackdropRequestsRef.current.set(animeId, promise)
    return promise
  }, [cache])

  const preloadBatch = useCallback(async (
    animes: Array<{ id: string; shikimoriUrl: string; romajiName: string; russianName: string }>
  ) => {
    console.log(`[CoverProvider] Preloading batch of ${animes.length} posters`)
    setIsLoading(true)

    try {
      // Загружаем с ограничением параллелизма
      const concurrencyLimit = 5
      const results: string[] = []

      for (let i = 0; i < animes.length; i += concurrencyLimit) {
        const chunk = animes.slice(i, i + concurrencyLimit)
        const chunkPromises = chunk.map(anime =>
          getPoster(anime.id, anime.shikimoriUrl, anime.romajiName, anime.russianName)
        )
        
        const chunkResults = await Promise.all(chunkPromises)
        results.push(...chunkResults)
      }

      console.log(`[CoverProvider] Batch preload complete: ${results.length} posters`)
    } catch (error) {
      console.error('[CoverProvider] Error in batch preload:', error)
    } finally {
      setIsLoading(false)
    }
  }, [getPoster])

  const getFromCache = useCallback((animeId: string) => {
    const entry = cache[animeId]
    if (!entry) return null
    
    return {
      poster: entry.poster,
      backdrop: entry.backdrop
    }
  }, [cache])

  const clearCache = useCallback(() => {
    setCache({})
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(CACHE_KEY)
    }
    console.log('[CoverProvider] Cache cleared')
  }, [])

  const value: CoverContextValue = {
    getPoster,
    getBackdrop,
    preloadBatch,
    getFromCache,
    clearCache,
    isLoading
  }

  return <CoverContext.Provider value={value}>{children}</CoverContext.Provider>
}

export function useCover() {
  const ctx = useContext(CoverContext)
  if (!ctx) throw new Error("useCover must be used within CoverProvider")
  return ctx
}

function generateFallbackPoster(title: string): string {
  const hash = title.split('').reduce((acc, char) => char.charCodeAt(0) + ((acc << 5) - acc), 0)
  const index = Math.abs(hash) % 4
  const letter = title.slice(0, 1).toUpperCase()
  
  const styles = [
    { bg: '#1a0505', textColor: '#fed7aa', accentColor: '#ea580c' },
    { bg: '#020617', textColor: '#bfdbfe', accentColor: '#3b82f6' },
    { bg: '#1e1b4b', textColor: '#e9d5ff', accentColor: '#8b5cf6' },
    { bg: '#18181b', textColor: '#e4e4e7', accentColor: '#22c55e' }
  ]
  
  const style = styles[index]
  const svg = `
    <svg width="400" height="600" viewBox="0 0 400 600" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="${style.bg}"/>
      <text x="50%" y="40%" font-family="sans-serif" font-weight="900" font-size="300" fill="${style.accentColor}" text-anchor="middle" dominant-baseline="middle" opacity="0.1">${letter}</text>
      <text x="50%" y="55%" font-family="sans-serif" font-size="24" fill="${style.textColor}" text-anchor="middle" font-weight="bold">${title}</text>
      <text x="50%" y="580" font-family="sans-serif" font-size="12" fill="${style.textColor}" opacity="0.6" text-anchor="middle">ANIME COLLECTION</text>
    </svg>
  `
  
  // Клиентский аналог Buffer.from(svg).toString('base64')
  const base64 = typeof window !== 'undefined' 
    ? window.btoa(unescape(encodeURIComponent(svg))) 
    : Buffer.from(svg).toString('base64');
  return `data:image/svg+xml;base64,${base64}`
}
