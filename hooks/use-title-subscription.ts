"use client"

/**
 * Состояние подписки на конкретный тайтл (`title_subscriptions`).
 *
 * Отличие от `useTranslationAlert`: подписка тут — про намерение человека
 * («слежу за этим тайтлом»), а не про ожидание конкретной серии. Поэтому
 * кнопка доступна на ЛЮБОМ тайтле, а не только там, где контента сейчас нет.
 *
 * Для гостя хук ничего не пишет: кнопка сначала открывает регистрацию, а
 * намерение подхватывается после входа (см. `rememberPendingSubscription`).
 */

import { useCallback, useEffect, useRef, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/components/auth/auth-provider"
import {
  SUBSCRIPTIONS_CHANGED_EVENT,
  buildSubscription,
  clearPendingSubscription,
  mapSubscriptionRow,
  toSubscriptionRow,
  type TitleSubscription,
} from "@/lib/title-subscriptions"

export interface UseTitleSubscriptionResult {
  /** Подписка по этому тайтлу (null — не подписан). */
  subscription: TitleSubscription | null
  /**
   * Известно ли состояние подписки.
   *
   * `false` ровно в двух случаях: идёт чтение из БД, или авторизация ещё
   * выясняется. Для гостя состояние известно точно — подписок у него нет,
   * они живут в аккаунте, — поэтому `loaded` у него `true`.
   *
   * Раньше здесь стояло «у гостя `loaded = false` навсегда», и кнопка,
   * считавшая себя занятой по `!loaded`, показывала вечный спиннер и не
   * реагировала на клик: гость не мог даже открыть регистрацию.
   */
  loaded: boolean
  /** Идёт запрос (подписка/отписка/чтение). */
  loading: boolean
  error: string | null
  /** Подписаться или обновить каналы. */
  subscribe: (input: SubscribeInput) => Promise<boolean>
  /** Отписаться от тайтла. */
  unsubscribe: () => Promise<boolean>
  /** Перечитать состояние из БД. */
  refresh: () => Promise<void>
}

export interface SubscribeInput {
  animeTitle?: string | null
  poster?: string | null
  /** С какой серии человек отстал на момент подписки. */
  baselineEpisode?: number
  notifyNewEpisodes?: boolean
  notifyDub?: boolean
}

export function useTitleSubscription(animeId?: string | null): UseTitleSubscriptionResult {
  // `authLoading` нужен, чтобы отличить «гость» от «ещё выясняем, гость ли».
  const { user, loading: authLoading } = useAuth()
  const [subscription, setSubscription] = useState<TitleSubscription | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const userId = user?.id ?? null
  const requestRef = useRef(0)

  const refresh = useCallback(async () => {
    if (!userId || !animeId) {
      setSubscription(null)
      setLoaded(true)
      return
    }

    const requestId = ++requestRef.current
    try {
      const { data, error: readError } = await supabase
        .from("title_subscriptions")
        .select("*")
        .eq("user_id", userId)
        .eq("anime_id", String(animeId))
        .limit(1)

      // Ответ устарел: его перезаписал более свежий запрос, и тот поставит
      // loaded сам. Раньше здесь был просто `return` — и если свежим запросом
      // оказывался не refresh (например, subscribe из обработчика события),
      // loaded оставался false навсегда, то есть кнопка зависала.
      if (requestId !== requestRef.current) return

      if (readError) {
        // Таблица может отсутствовать до применения миграции — не роняем UI,
        // но и не врём пользователю, что он подписан.
        console.warn("[title-subscription] read failed:", readError.message)
        setSubscription(null)
        setLoaded(true)
        return
      }

      const rows = Array.isArray(data) ? data : []
      setSubscription(rows.length > 0 ? mapSubscriptionRow(rows[0]) : null)
      setLoaded(true)
    } catch (e) {
      if (requestId !== requestRef.current) return
      console.warn("[title-subscription] refresh error:", e)
      setSubscription(null)
      setLoaded(true)
    }
  }, [userId, animeId])

  useEffect(() => {
    if (!animeId) {
      setSubscription(null)
      setLoaded(true)
      return
    }

    if (!userId) {
      setSubscription(null)
      // Гость: подписок нет, и это знание точное. Пока авторизация
      // выясняется — не знаем, гость это или вошедший, и показывать
      // «не подписан» рано: человек увидел бы мигание текста.
      setLoaded(!authLoading)
      return
    }

    refresh()
  }, [userId, animeId, authLoading, refresh])

  // Список подписок изменился в другом месте (карточка каталога, бот,
  // настройки) — плашка на странице тайтла обязана это увидеть.
  useEffect(() => {
    const handler = () => {
      refresh()
    }
    window.addEventListener(SUBSCRIPTIONS_CHANGED_EVENT, handler)
    window.addEventListener("auth-synced", handler)
    return () => {
      window.removeEventListener(SUBSCRIPTIONS_CHANGED_EVENT, handler)
      window.removeEventListener("auth-synced", handler)
    }
  }, [refresh])

  const subscribe = useCallback(
    async (input: SubscribeInput): Promise<boolean> => {
      if (!userId) {
        setError("not-logged-in")
        return false
      }
      if (!animeId) {
        setError("no-anime-id")
        return false
      }

      const next = buildSubscription({
        animeId: String(animeId),
        animeTitle: input.animeTitle,
        poster: input.poster,
        baselineEpisode: input.baselineEpisode,
        notifyNewEpisodes: input.notifyNewEpisodes,
        notifyDub: input.notifyDub,
      })
      if (!next) {
        setError("no-anime-id")
        return false
      }

      const requestId = ++requestRef.current
      setLoading(true)
      setError(null)
      try {
        const { error: writeError } = await supabase
          .from("title_subscriptions")
          .upsert(toSubscriptionRow(userId, next), { onConflict: "user_id,anime_id" })

        if (requestId !== requestRef.current) return false

        if (writeError) {
          console.error("[title-subscription] subscribe failed:", writeError.message)
          setError(writeError.message)
          return false
        }

        setSubscription(next)
        setLoaded(true)
        // Обещание выполнено: намерение гостя больше не нужно.
        clearPendingSubscription(next.animeId)
        // Колокольчик в шапке сайта и проверка ожиданий считают уведомления
        // по своим источникам, им нужно узнать про новую подписку.
        window.dispatchEvent(new CustomEvent(SUBSCRIPTIONS_CHANGED_EVENT))
        // `loading` снимаем здесь, а не в `finally` по сверке `requestId`.
        //
        // Обработчик этого же события зовёт `refresh()`, а тот увеличивает
        // `requestRef` — и сверка в `finally` всегда оказывалась ложной. В
        // результате `setLoading(false)` не выполнялся НИКОГДА: кнопка
        // навсегда оставалась в состоянии «Сохраняем...» и `disabled`, то
        // есть отписаться от тайтла прямо со страницы было невозможно.
        //
        // Снимать флаг должен тот, кто его поставил, а не «последний
        // победивший запрос»: иначе любое пересечение с refresh() навсегда
        // оставляет кнопку в spinner — ровно тот баг, что и был.
        setLoading(false)
        return true
      } catch (e) {
        if (requestId !== requestRef.current) return false
        console.error("[title-subscription] subscribe error:", e)
        setError("unknown")
        return false
      } finally {
        // Страховка для веток, где мы вышли раньше: успех снимает флаг сам.
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
        .from("title_subscriptions")
        .delete()
        .eq("user_id", userId)
        .eq("anime_id", String(animeId))

      if (requestId !== requestRef.current) return false

      if (deleteError) {
        console.error("[title-subscription] unsubscribe failed:", deleteError.message)
        setError(deleteError.message)
        return false
      }

      setSubscription(null)
      window.dispatchEvent(new CustomEvent(SUBSCRIPTIONS_CHANGED_EVENT))
      // Здесь `finally` ведёт себя так же, как в `subscribe`: событие выше
      // вызывает `refresh()`, тот увеличивает `requestRef`, и сверка
      // `requestId === requestRef.current` становится ложной — кнопка
      // осталась бы в «Сохраняем...» и `disabled`. Снимаем флаг у того, кто
      // его поставил.
      setLoading(false)
      return true
    } catch (e) {
      if (requestId !== requestRef.current) return false
      console.error("[title-subscription] unsubscribe error:", e)
      setError("unknown")
      return false
    } finally {
      if (requestId === requestRef.current) setLoading(false)
    }
  }, [userId, animeId])

  return { subscription, loaded, loading, error, subscribe, unsubscribe, refresh }
}