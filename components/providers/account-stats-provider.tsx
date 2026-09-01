"use client"

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import { supabase, getAccountStats } from "@/lib/supabase"
import { useAuth } from "@/components/auth/auth-provider"
import type { ActivityEvent } from "./account-stats-recorder"
import { activityRecorder } from "./account-stats-recorder"

export type AccountStats = Record<string, any> & {
  totalSessions?: number
  totalTimeMs?: number
  pageViews?: number
  watchEvents?: number
  gachaRolls?: number
  battlesStarted?: number
  bookmarksAdded?: number
  marketActions?: number
  searches?: number
  avgSessionMs?: number
  lastVisitAt?: string | null
  firstVisitAt?: string | null
}

type AccountStatsContextValue = {
  stats: AccountStats
  isLoading: boolean
  recordActivity: (event: ActivityEvent) => void
  refresh: () => Promise<void>
  isGuest: boolean
}

const AccountStatsContext = createContext<AccountStatsContextValue | null>(null)

// Ключи localStorage, используемые для best-effort оценки статистики гостей.
const GUEST_STORAGE_KEYS = {
  bookmarksAdded: "bookmarks_v1",
  watchEvents: "watch-history",
  gachaRolls: "gacha-collection",
} as const

/** Читает длину коллекции из localStorage безопасно (всегда возвращает число). */
function safeGetLen(key: string): number {
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return 0
    const parsed = JSON.parse(raw)
    // Закладки/история — массивы, гача-коллекция — объект.
    if (Array.isArray(parsed)) return parsed.length
    return Object.keys(parsed).length
  } catch {
    return 0
  }
}

/** Строит best-effort статистику для гостей из recorder + localStorage. */
function buildGuestStats(): Record<string, any> {
  const totalMs = activityRecorder.getTotalTimeMs()
  const durations = activityRecorder.getSessionDurations()
  const totalSessions = durations.length
  const avgSessionMs = totalSessions > 0 ? Math.round(totalMs / totalSessions) : 0

  return {
    isGuest: true,
    totalTimeMs: totalMs,
    totalSessions,
    // Best-effort прокси: нет прямого ключа для pageViews, берем суммарное число взаимодействий.
    pageViews: safeGetLen("bookmarks_v1") + safeGetLen("watch-history"),
    watchEvents: safeGetLen("watch-history"),
    gachaRolls: safeGetLen("gacha-collection"),
    battlesStarted: 0,
    bookmarksAdded: safeGetLen("bookmarks_v1"),
    marketActions: 0,
    searches: 0,
    avgSessionMs,
    lastVisitAt: new Date().toISOString(),
    firstVisitAt: null, // Для гостей нет достоверного времени первого визита.
  }
}

export function AccountStatsProvider({ children }: { children: React.ReactNode }) {
  const [stats, setStats] = useState<AccountStatsContextValue["stats"]>({
    isGuest: true,
    totalTimeMs: 0,
    totalSessions: 0,
    pageViews: 0,
    watchEvents: 0,
    gachaRolls: 0,
    battlesStarted: 0,
    bookmarksAdded: 0,
    marketActions: 0,
    searches: 0,
    avgSessionMs: 0,
    lastVisitAt: null,
    firstVisitAt: null,
  })
  const [isLoading, setIsLoading] = useState(true)
  const isGuestRef = useRef(true)
  const abortControllerRef = useRef<AbortController | null>(null)
  const isMountedRef = useRef(false)
  const { user } = useAuth()

  // Перезагружаем статистику: auth-synced / anime-data-refreshed / mount.
  const refresh = useCallback(async () => {
    // Фиксируем гостевую сессию при монтировании / обновлении (время на сайте).
    activityRecorder.startSession()

    if (!isMountedRef.current) return

    setIsLoading(true)

    abortControllerRef.current?.abort()
    abortControllerRef.current = new AbortController()
    const signal = abortControllerRef.current.signal

    const timeoutId = setTimeout(() => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }, 5000)

    try {
      let merged: Record<string, any> = {}

      if (user) {
        isGuestRef.current = false
        console.log('[AccountStatsProvider] Fetching stats for user:', user.id)
        // Читаем строку account_stats из БД.
        const dbStats = await getAccountStats(user.id)
        console.log('[AccountStatsProvider] dbStats from DB:', dbStats)
        merged = { ...(dbStats ?? {}) } as Record<string, any>
        console.log('[AccountStatsProvider] merged stats:', merged)
      } else {
        isGuestRef.current = true
        // Гостевой fallback: время на сайте из recorder, остальное — из localStorage.
        const guest = buildGuestStats()
        merged = guest
      }

      if (signal.aborted) return

      setStats(merged as AccountStatsContextValue["stats"])
    } catch (err) {
      console.error("[AccountStatsProvider] refresh error:", err)
      // Failsafe: не ломаем UI — оставляем предыдущее состояние.
    } finally {
      clearTimeout(timeoutId)
      if (isMountedRef.current) setIsLoading(false)
    }
  }, [user])

  useEffect(() => {
    let isMounted = true
    isMountedRef.current = isMounted

    refresh()

    // Переподключение Supabase / повторный вход -> перезагружаем статистику.
    const handleSupabaseReconnect = () => refresh()
    window.addEventListener("supabase-reconnected", handleSupabaseReconnect)
    window.addEventListener("auth-synced", refresh)

    // Обновляем статистику при перезагрузке данных аниме.
    const handleAnimeDataRefreshed = () => refresh()
    window.addEventListener("anime-data-refreshed", handleAnimeDataRefreshed)

    // Обновляем статистику при изменении закладок, гача, боёв и т.д.
    const handleStatsUpdated = () => refresh()
    window.addEventListener("account-stats-updated", handleStatsUpdated)

    // Учёт времени на сайте: старт/стоп сессии по переключению вкладки.
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        activityRecorder.startSession()
      } else {
        activityRecorder.flushSession()
      }
    }
    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      isMounted = false
      isMountedRef.current = false
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
        abortControllerRef.current = null
      }
      window.removeEventListener("supabase-reconnected", handleSupabaseReconnect)
      window.removeEventListener("auth-synced", refresh)
      window.removeEventListener("anime-data-refreshed", handleAnimeDataRefreshed)
      window.removeEventListener("account-stats-updated", handleStatsUpdated)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [refresh])

  const value = useMemo<AccountStatsContextValue>(() => ({
    stats,
    isLoading,
    // Простая обёртка вызова — мемоизация не нужна, поэтому это обычный
    // arrow-функция (нельзя вызывать useCallback внутри useMemo).
    recordActivity: (event: ActivityEvent) => activityRecorder.recordActivity(event),
    refresh,
    isGuest: isGuestRef.current,
  }), [stats, isLoading, refresh])

  return <AccountStatsContext.Provider value={value}>{children}</AccountStatsContext.Provider>
}

export function useAccountStats() {
  const ctx = useContext(AccountStatsContext)
  if (!ctx) throw new Error("useAccountStats must be used within AccountStatsProvider")
  return ctx
}
