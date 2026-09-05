"use client"

import React, { createContext, useContext, useCallback, useEffect, useState, useRef } from "react"

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
const CACHE_VERSION = "v3"
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000 // 7 дней

function isReusablePoster(poster: string): boolean {
  return Boolean(
    poster &&
    !poster.startsWith('data:') &&
    !/^https?:\/\/shikimori\.(one|io|org)\/animes\/\d+\/?(?:\?.*)?$/i.test(poster)
  )
}

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
        // Skip fallback and invalid Shikimori page URLs - they should be re-fetched
        if (!isReusablePoster(typedEntry.poster)) continue
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
    // Проверяем кэш (но не возвращаем data URI заглушки)
    const cached = cache[animeId]
    if (cached && isReusablePoster(cached.poster)) {
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
        
        const response = await fetch('/api/posters', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            animes: [{
              id: animeId,
              shikimoriUrl,
              romajiName,
              russianName
            }]
          })
        });

        if (!response.ok) throw new Error('API response not ok');
        const data = await response.json();
        const poster = data.posters?.[0]?.poster;
        if (!poster) throw new Error('No poster in response');

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
        
        const response = await fetch(`/api/backdrops?shikimoriId=${animeId}&disableExternalAPIs=${disableExternalAPIs}`)
        if (!response.ok) throw new Error('API response not ok');
        
        const data = await response.json()
        const backdrop = data.backdrop

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
    // Фильтруем те, которых нет в кэше и нет в активных запросах
    // Ограничиваем 30, чтобы не тратить лимит трансформаций на всё подряд
    const toFetch = animes.filter(anime => {
      const cached = cache[anime.id];
      // Don't skip invalid or data URI fallback posters - allow re-fetching
      if (cached && isReusablePoster(cached.poster)) return false;
      if (pendingRequestsRef.current.has(anime.id)) return false;
      return true;
    }).slice(0, 30);

    if (toFetch.length === 0) return;

    console.log(`[CoverProvider] Preloading batch of ${toFetch.length} posters (out of ${animes.length})`);
    setIsLoading(true);

    const deferredResolvers = new Map<string, (url: string) => void>();

    try {
      // Создаем promise для каждого anime, чтобы другие getPoster запросы во время загрузки могли его переиспользовать

      toFetch.forEach(anime => {
        const promise = new Promise<string>((resolve) => {
          deferredResolvers.set(anime.id, resolve);
        });
        pendingRequestsRef.current.set(anime.id, promise);
      });

      // Отправляем батч-запрос на сервер
      const response = await fetch('/api/posters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ animes: toFetch })
      });

      if (!response.ok) throw new Error('API response not ok');
      const data = await response.json();
      const results: Array<{ id: string; poster: string }> = data.posters || [];

      // Обновляем кэш одной пачкой
      const newCacheEntries: CoverCache = {};
      results.forEach(res => {
        const poster = res.poster;
        const sources: string[] = [];
        if (poster.includes('shikimori')) sources.push('shikimori');
        else if (poster.includes('kodik')) sources.push('kodik');
        else if (poster.includes('anilist')) sources.push('anilist');
        else if (poster.includes('myanimelist') || poster.includes('jikan')) sources.push('mal');
        else sources.push('fallback');

        newCacheEntries[res.id] = {
          poster,
          backdrop: cache[res.id]?.backdrop || null,
          timestamp: Date.now(),
          sources
        };

        // Разрешаем promise
        deferredResolvers.get(res.id)?.(poster);
      });

      // Если какие-то ID не вернулись в ответе, разрешаем их заглушкой
      toFetch.forEach(anime => {
        if (!newCacheEntries[anime.id]) {
          const fallback = generateFallbackPoster(anime.russianName || anime.romajiName || "Anime");
          newCacheEntries[anime.id] = {
            poster: fallback,
            backdrop: cache[anime.id]?.backdrop || null,
            timestamp: Date.now(),
            sources: ['fallback']
          };
          deferredResolvers.get(anime.id)?.(fallback);
        }
      });

      setCache(prev => ({
        ...prev,
        ...newCacheEntries
      }));

    } catch (error) {
      console.error('[CoverProvider] Error in batch preload:', error);
      // При ошибке разрешаем все ожидающие заглушками
      toFetch.forEach(anime => {
        const fallback = generateFallbackPoster(anime.russianName || anime.romajiName || "Anime");
        deferredResolvers.get(anime.id)?.(fallback);
      });
    } finally {
      setIsLoading(false);
      // Очищаем pending
      toFetch.forEach(anime => {
        pendingRequestsRef.current.delete(anime.id);
      });
    }
  }, [cache])

  const getFromCache = useCallback((animeId: string) => {
    const entry = cache[animeId]
    if (!entry) return null
    // Don't return data URI fallback as a "valid" cached poster
    if (entry.poster && entry.poster.startsWith('data:')) return null
    
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
