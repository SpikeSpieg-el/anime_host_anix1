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
 *
 * Про `title_subscriptions`
 * -------------------------
 * Здесь и в подписке об одном и том же намерении — «я слежу за этим тайтлом»,
 * и раньше они были двумя независимыми сущностями, из-за чего расходились.
 * Поэтому любая запись и удаление ожидания дублируется в `title_subscriptions`
 * с каналом `notify_dub`: иначе плашка в плеере могла показать «подписан»,
 * а страница тайтла — «не слежу», и отписка от одной не трогала другую.
 *
 * `notify_new_episodes` здесь НЕ включается: кнопка «Уведомить меня» обещает
 * только озвучку, и включать сверху ещё и ожидание новых серий значило бы
 * расширять обещание без спроса. Канал серий включается кнопкой
 * «Следить за тайтлом» на странице тайтла и из бота.
 *
 * Про отписку
 * -----------
 * Отмена обязана снимать ровно то, что человек отменил:
 *   - других каналов нет   → строка `title_subscriptions` удаляется целиком;
 *   - серии остаются       → гасится ТОЛЬКО `notify_dub`;
 *   - подписки нет вовсе   → ничего не пишем.
 * Раньше третья и вторая ветки совпадали: строка с `notify_dub = true`
 * оставалась нетронутой, и кнопка на странице тайтла продолжала обещать
 * «серии и озвучка» после того, как человек уже отписался от озвучки.
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
import {
  SUBSCRIPTIONS_CHANGED_EVENT,
  mapSubscriptionRow,
  mergeSubscriptionChannels,
  toSubscriptionRow,
} from "@/lib/title-subscriptions"

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

        // Отражаем то же намерение в общем списке подписок.
        //
        // Именно чтение перед записью, а не слепой upsert: плашка обещает
        // только озвучку, и полная запись стёрла бы `notify_new_episodes` у
        // человека, который уже подписался на новые серии с этой страницы.
        // Ошибку здесь не поднимаем: ожидание озвучки уже записано, и оно
        // важнее косметики списка.
        const { data: existingRows } = await supabase
          .from("title_subscriptions")
          .select("notify_new_episodes, notify_dub")
          .eq("user_id", userId)
          .eq("anime_id", String(animeId))
          .limit(1)

        const existingRow = existingRows?.[0] ?? null

        // Строки нет — значит и обещания по сериям не было.
        //
        // Раньше здесь подставлялся синтетический ряд с `null` в колонках, а
        // `mapSubscriptionRow` читает `null` как «значение неизвестно» и
        // трактует его как `true`. В итоге первый же клик по «Уведомить меня»
        // в плеере молча включал ожидание новых серий: человек просил сообщить
        // про озвучку, а получал ещё и «вышла серия 13» на тайтл, за которым
        // не следил. Ровно то расширение обещания, которого плашка не делает.
        const existing = existingRow
          ? mapSubscriptionRow({
              anime_id: String(animeId),
              notify_new_episodes: existingRow.notify_new_episodes,
              notify_dub: existingRow.notify_dub,
            })
          : null

        const channels = mergeSubscriptionChannels(existing, {
          notifyNewEpisodes: false,
          notifyDub: true,
        })

        const { error: subscriptionError } = await supabase.from("title_subscriptions").upsert(
          {
            ...toSubscriptionRow(
              userId,
              {
                animeId: String(animeId),
                animeTitle: next.animeTitle,
                poster: next.poster ?? null,
                ...channels,
                baselineEpisode: next.baselineEpisode,
              },
              { source: "translation_alert" },
            ),
          },
          { onConflict: "user_id,anime_id" },
        )
        if (subscriptionError) {
          console.warn("[translation-alert] подписка не отражена в списке:", subscriptionError.message)
        }

        // `next` уже доменная модель — нормализуем только id тайтла.
        setAlert({ ...next, animeId: String(animeId), episode: Math.max(1, Math.floor(next.episode) || 1) })
        setLoaded(true)
        window.dispatchEvent(new CustomEvent(SUBSCRIPTIONS_CHANGED_EVENT))
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

      // Гасим и подписку, но только если её единственный канал — озвучка.
      //
      // «Отменить уведомление» на плашке обещает отменить ожидание озвучки.
      // Если человек дополнительно подписан на новые серии с этой страницы,
      // молча сносить и это было бы враньём — про серии он не говорил.
      const { data: existingRows } = await supabase
        .from("title_subscriptions")
        .select("notify_new_episodes")
        .eq("user_id", userId)
        .eq("anime_id", String(animeId))
        .limit(1)

      const keepsSeries = Boolean(existingRows?.[0]?.notify_new_episodes)
      const hasRow = Boolean(existingRows?.[0])

      if (!hasRow) {
        // Подписки на тайтл нет — трогать нечего. Раньше здесь всё равно
        // уходил DELETE в пустоту: плашка ждёт озвучку, а подписки на серии
        // могло и не быть вовсе.
      } else if (!keepsSeries) {
        // Других каналов нет — сносим строку целиком.
        const { error: subscriptionError } = await supabase
          .from("title_subscriptions")
          .delete()
          .eq("user_id", userId)
          .eq("anime_id", String(animeId))

        if (subscriptionError) {
          // Ожидание уже удалено, и это главное. Ошибку здесь не поднимаем:
          // человек нажал «отменить уведомление» и получил бы отказ, хотя всё
          // обещанное уже выполнено.
          console.warn("[translation-alert] подписка не убрана:", subscriptionError.message)
        }
      } else {
        // Подписка на серии остаётся, а вот обещание озвучки надо снять.
        //
        // Раньше здесь ничего не делалось: строка с `notify_dub = true`
        // оставалась как была, и кнопка «Следить за тайтлом» на странице
        // продолжала обещать «Уведомлю о: серии и озвучка» — хотя человек
        // только что отписался от озвучки и никаких уведомлений про неё
        // не хотел. Отписка обязана гасить ровно то, что снимает.
        const { error: updateError } = await supabase
          .from("title_subscriptions")
          .update({ notify_dub: false })
          .eq("user_id", userId)
          .eq("anime_id", String(animeId))

        if (updateError) {
          console.warn("[translation-alert] канал озвучки не выключен:", updateError.message)
        }
      }

      // Событие в обеих ветках: кнопка на странице тайтла перечитывает
      // подписку по нему, и без него подпись «серии и озвучка» зависла бы.
      window.dispatchEvent(new CustomEvent(SUBSCRIPTIONS_CHANGED_EVENT))

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
