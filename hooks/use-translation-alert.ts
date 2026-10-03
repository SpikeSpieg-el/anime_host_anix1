"use client"

/**
 * Состояние «я жду озвучку этого тайтла» (public.translation_alerts).
 *
 * Хук нужен плашке «Скоро / Озвучка не найдена»: именно запись здесь, а не
 * push-подписка браузера, гарантирует, что уведомление о появлении озвучки
 * действительно придёт. Push — только способ доставки; если пользователь его
 * запретил, ожидание всё равно живёт и показывается в колокольчике на сайте.
 *
 * Ожидание привязано к аккаунту, поэтому для гостей хук ничего не делает:
 * их кнопка сначала открывает регистрацию (воронка), а после входа подписка
 * создаётся автоматически.
 */

import { useCallback, useEffect, useRef, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/components/auth/auth-provider"
import {
  ALERTS_RESOLVED_EVENT,
  mapAlertRow,
  toAlertRow,
  type TranslationAlert,
} from "@/lib/translation-alerts"

export interface UseTranslationAlertResult {
  /** Активное ожидание по этому тайтлу (null — не подписан). */
  alert: TranslationAlert | null
  /** Загружено ли состояние из БД (чтобы не мигать кнопкой). */
  loaded: boolean
  /** Идёт запрос (подписка/отписка/чтение). */
  loading: boolean
  error: string | null
  /** Создать/обновить ожидание. */
  subscribe: (alert: TranslationAlert) => Promise<boolean>
  /** Отменить ожидание. */
  unsubscribe: () => Promise<boolean>
  /** Перечитать состояние из БД. */
  refresh: () => Promise<void>
}

export function useTranslationAlert(animeId?: string | null): UseTranslationAlertResult {
  const { user } = useAuth()
  const [alert, setAlert] = useState<TranslationAlert | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const userId = user?.id ?? null
  const requestRef = useRef(0)

  const refresh = useCallback(async () => {
    if (!userId || !animeId) {
      setAlert(null)
      setLoaded(true)
      return
    }

    const requestId = ++requestRef.current
    try {
      const { data, error: readError } = await supabase
        .from("translation_alerts")
        .select("*")
        .eq("user_id", userId)
        .eq("anime_id", String(animeId))
        .limit(1)

      if (requestId !== requestRef.current) return

      if (readError) {
        // Таблица может отсутствовать до применения миграции — не роняем UI,
        // но и не врём пользователю, что он подписан.
        console.warn("[translation-alert] read failed:", readError.message)
        setAlert(null)
        setLoaded(true)
        return
      }

      const rows = Array.isArray(data) ? data : []
      // Ожидание с notified_at уже закрыто (уведомление отправлено) — не показываем.
      const active = rows.find((row: any) => !row?.notified_at) ?? null
      setAlert(active ? mapAlertRow(active) : null)
      setLoaded(true)
    } catch (e) {
      if (requestId !== requestRef.current) return
      console.warn("[translation-alert] refresh error:", e)
      setAlert(null)
      setLoaded(true)
    }
  }, [userId, animeId])

  useEffect(() => {
    if (!userId || !animeId) {
      setAlert(null)
      setLoaded(false)
      return
    }
    refresh()
  }, [userId, animeId, refresh])

  // Сервер закрыл ожидание (озвучка появилась) — синхронизируем плашку.
  useEffect(() => {
    const handler = () => {
      refresh()
    }
    window.addEventListener(ALERTS_RESOLVED_EVENT, handler)
    window.addEventListener("auth-synced", handler)
    return () => {
      window.removeEventListener(ALERTS_RESOLVED_EVENT, handler)
      window.removeEventListener("auth-synced", handler)
    }
  }, [refresh])

  const subscribe = useCallback(
    async (next: TranslationAlert): Promise<boolean> => {
      if (!userId) {
        setError("not-logged-in")
        return false
      }
      if (!animeId) {
        setError("no-anime-id")
        return false
      }

      const requestId = ++requestRef.current
      setLoading(true)
      setError(null)
      try {
        const { error: writeError } = await supabase.from("translation_alerts").upsert(
          {
            ...toAlertRow(userId, { ...next, animeId: String(animeId) }),
            // Повторная подписка возобновляет ожидание, даже если прошлое
            // уже было закрыто отправленным уведомлением.
            notified_at: null,
            last_checked_at: null,
          },
          { onConflict: "user_id,anime_id" },
        )

        if (requestId !== requestRef.current) return false

        if (writeError) {
          console.error("[translation-alert] subscribe failed:", writeError.message)
          setError(writeError.message)
          return false
        }

        // `next` уже доменная модель — нормализуем только id тайтла.
        setAlert({ ...next, animeId: String(animeId), episode: Math.max(1, Math.floor(next.episode) || 1) })
        setLoaded(true)
        return true
      } catch (e) {
        console.error("[translation-alert] subscribe error:", e)
        setError("unknown")
        return false
      } finally {
        if (requestId === requestRef.current) setLoading(false)
      }
    },
    [userId, animeId],
  )

  const unsubscribe = useCallback(async (): Promise<boolean> => {
    if (!userId || !animeId) return false

    const requestId = ++requestRef.current
    setLoading(true)
    setError(null)
    try {
      const { error: deleteError } = await supabase
        .from("translation_alerts")
        .delete()
        .eq("user_id", userId)
        .eq("anime_id", String(animeId))

      if (requestId !== requestRef.current) return false

      if (deleteError) {
        console.error("[translation-alert] unsubscribe failed:", deleteError.message)
        setError(deleteError.message)
        return false
      }

      setAlert(null)
      return true
    } catch (e) {
      console.error("[translation-alert] unsubscribe error:", e)
      setError("unknown")
      return false
    } finally {
      if (requestId === requestRef.current) setLoading(false)
    }
  }, [userId, animeId])

  return { alert, loaded, loading, error, subscribe, unsubscribe, refresh }
}
