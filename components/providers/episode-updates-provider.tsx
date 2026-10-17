"use client"

import React, { createContext, useCallback, useContext, useEffect, useState, useRef } from "react"
import { getFreshAnimeData } from "@/app/actions/get-fresh-anime-data"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/components/auth/auth-provider"
import { getWatchPath } from "@/lib/seo/watch-url"
import {
  ALERTS_CHECK_THROTTLE_MS,
  ALERTS_LAST_CHECK_KEY,
  ALERTS_RESOLVED_EVENT,
  mapAlertRow,
  shouldRunAlertsCheck,
  type TranslationAlert,
} from "@/lib/translation-alerts"
import {
  hasNewEpisode,
  isStaleSubscriptionUpdate,
  keepLiveSubscriptionUpdates,
  mapSubscriptionRow,
  type TitleSubscription,
  type TitleSubscriptionRow,
} from "@/lib/title-subscriptions"

export interface EpisodeUpdate {
  animeId: string
  animeTitle: string
  poster?: string
  oldEpisode: number
  newEpisode: number
  totalEpisodes?: number
  updatedAt: string
  /**
   * Кто записал уведомление.
   *
   * `shikimori` — браузер, «вышла новая серия» по episodes_aired.
   * `dub` — сервер или бот, «появилась озвучка» по Kodik, и `new_episode`
   * там означает сколько серий доступно в материале.
   *
   * Числа эти несопоставимы: для одного и того же тайтла Kodik может показать
   * 12 серий, а Shikimori — 3 вышло. Именно поэтому клинер не имеет права
   * перезаписывать запись с `source: 'dub'` своим числом.
   */
  source: EpisodeUpdateSource
}

/** Источник уведомления. См. `episode_updates.source`. */
export type EpisodeUpdateSource = "shikimori" | "dub"

interface EpisodeUpdatesContextValue {
  updates: EpisodeUpdate[]
  checkAnimeUpdates: (force?: boolean) => void
  /**
   * Проверить «ожидания озвучки» (translation_alerts) через сервер.
   * Нужна отдельно от checkAnimeUpdates: онгоинги ищутся по episodes_aired
   * из Shikimori, а появления озвучки там не видно в принципе.
   */
  checkTranslationAlerts: (force?: boolean) => void
  clearUpdate: (id: string) => void
  clearAllUpdates: () => void
  mounted: boolean
  isChecking: boolean
}

const EpisodeUpdatesContext = createContext<EpisodeUpdatesContextValue | null>(null)

interface AlertsState {
  /** Ожидания, которые ещё не закрыты (уведомление не отправлено). */
  active: TranslationAlert[]
}

const EPISODE_UPDATES_KEY = "episode_updates_v1"
const LAST_CHECK_KEY = "last_episode_check_ts"
const BOOKMARK_SNAPSHOT_KEY = "bookmarks_snapshot_v1"
const UPDATE_EVENT = "episode_updates_changed"

export function EpisodeUpdatesProvider({ children }: { children: React.ReactNode }) {
  const [updates, setUpdates] = useState<EpisodeUpdate[]>([])
  const [mounted, setMounted] = useState(false)
  const [isChecking, setIsChecking] = useState(false)
  const { user } = useAuth()

  const updatesRef = useRef<EpisodeUpdate[]>([])
  const isCheckingRef = useRef(false)
  const alertsCheckingRef = useRef(false)

  useEffect(() => {
    updatesRef.current = updates
  }, [updates])

  const updateSnapshot = useCallback((animeId: string, episodeNumber: number) => {
    try {
      const raw = localStorage.getItem(BOOKMARK_SNAPSHOT_KEY)
      const snapshot = raw ? JSON.parse(raw) : {}

      if (!snapshot[animeId] || snapshot[animeId] < episodeNumber) {
        snapshot[animeId] = episodeNumber
        localStorage.setItem(BOOKMARK_SNAPSHOT_KEY, JSON.stringify(snapshot))
      }
    } catch (e) {
      console.error("Snapshot update error", e)
    }
  }, [])

  const loadUpdates = useCallback(async () => {
    if (user) {
      const { data, error } = await supabase
        .from("episode_updates")
        .select("*")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })

      if (!error && data) {
        const mapped = data.map((row: any) => ({
          animeId: String(row.anime_id),
          animeTitle: row.anime_title,
          oldEpisode: row.old_episode,
          newEpisode: row.new_episode,
          totalEpisodes: row.total_episodes,
          updatedAt: row.updated_at,
          // Источник решает, можно ли этой записи вообще что-то делать
          // клинеру ниже. Без него «свои» и «чужие» выглядят одинаково, и
          // браузер затирал записи сервера.
          source: (row.source === "dub" ? "dub" : "shikimori") as EpisodeUpdateSource,
        }))
        setUpdates(mapped)
      } else {
        setUpdates([])
      }
    } else {
      const stored = localStorage.getItem(EPISODE_UPDATES_KEY)
      if (stored) {
        try {
          setUpdates(JSON.parse(stored))
        } catch {
          setUpdates([])
        }
      }
    }
  }, [user])

  /**
   * Активные ожидания озвучки пользователя (public.translation_alerts).
   *
   * Это отдельный от подписок список: на тайтл без озвучки нельзя ни
   * подписаться через историю (смотреть нечего), ни рассчитывать на
   * «догадался положить в закладки». Именно он гарантирует, что уведомление
   * о появлении озвучки действительно придёт.
   *
   * Раньше отсюда же возвращался `protectedIds` — список тайтлов, записи по
   * которым клинеру трогать нельзя. Он держался на окне в 30 дней и не
   * защищал ровно то, что требовалось: не удалить запись, а не перезаписать
   * её своим числом. Теперь это решает поле `source` в самой строке
   * уведомления, и список не нужен вовсе.
   */
  const fetchAlertsState = useCallback(async (): Promise<AlertsState> => {
    const empty: AlertsState = { active: [] }
    if (!user) return empty

    try {
      // Только ждущие: закрытые ожидания нужны были ради `protectedIds`,
      // а он удалён вместе с необходимостью в нём.
      const { data, error } = await supabase
        .from("translation_alerts")
        .select("*")
        .eq("user_id", user.id)
        .is("notified_at", null)
        .order("created_at", { ascending: false })
        .limit(200)

      if (error || !Array.isArray(data)) {
        // До применения миграции таблицы может не быть — не ломаем остальные проверки.
        if (error) console.warn("[EpisodeUpdates] translation_alerts read failed:", error.message)
        return empty
      }

      const active: TranslationAlert[] = []
      for (const row of data as any[]) {
        const alert = mapAlertRow(row)
        if (alert) active.push(alert)
      }

      return { active }
    } catch (e) {
      console.warn("[EpisodeUpdates] translation_alerts error:", e)
      return empty
    }
  }, [user])

  /**
   * Дёргает серверную проверку ожиданий (POST /api/alerts/check).
   * Сервер сам спрашивает Kodik, шлёт web-push и кладёт найденную серию в
   * episode_updates — здесь остаётся только подтянуть её в колокольчик.
   */
  const checkTranslationAlerts = useCallback(
    async (force?: boolean) => {
      if (typeof window === "undefined" || !user) return
      if (alertsCheckingRef.current) return
      alertsCheckingRef.current = true

      try {
        if (!force) {
          const lastCheck = localStorage.getItem(ALERTS_LAST_CHECK_KEY)
          if (!shouldRunAlertsCheck(lastCheck ? Number(lastCheck) : null)) return
        }

        const { active } = await fetchAlertsState()
        if (active.length === 0) {
          // Ждать нечего — не тратим ни свой запрос, ни лимиты Kodik.
          localStorage.setItem(ALERTS_LAST_CHECK_KEY, String(Date.now()))
          return
        }

        const { data: sessionData } = await supabase.auth.getSession()
        const token = sessionData?.session?.access_token
        if (!token) return

        const res = await fetch("/api/alerts/check", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({}),
        })

        if (!res.ok) {
          if (res.status === 429) return // серверный троттлинг — попробуем в следующий заход
          console.warn("[EpisodeUpdates] alerts check failed:", res.status)
          return
        }

        const data = await res.json().catch(() => null)
        localStorage.setItem(ALERTS_LAST_CHECK_KEY, String(Date.now()))

        const resolved = Array.isArray(data?.resolved) ? data.resolved : []
        if (resolved.length > 0) {
          // Сервер уже записал episode_updates — подтягиваем их в колокольчик
          // и сообщаем плашке «Скоро», что ожидание закрыто.
          await loadUpdates()
          window.dispatchEvent(
            new CustomEvent(ALERTS_RESOLVED_EVENT, { detail: { resolved } }),
          )
        }
      } catch (e) {
        console.warn("[EpisodeUpdates] alerts check error:", e)
      } finally {
        alertsCheckingRef.current = false
      }
    },
    [user, fetchAlertsState, loadUpdates],
  )

  const clearUpdate = useCallback(async (id: string) => {
    const target = updatesRef.current.find((u) => u.animeId === id)
    if (target) {
      updateSnapshot(id, target.newEpisode)
    }

    const newUpdates = updatesRef.current.filter((u) => u.animeId !== id)
    setUpdates(newUpdates)

    if (user) {
      const { error } = await supabase
        .from("episode_updates")
        .delete()
        .eq("user_id", user.id)
        .eq("anime_id", id)
      if (error) {
        console.error("Failed to delete episode update from DB:", error)
      }
    } else {
      localStorage.setItem(EPISODE_UPDATES_KEY, JSON.stringify(newUpdates))
    }

    window.dispatchEvent(new Event(UPDATE_EVENT))
  }, [user, updateSnapshot])

  const clearAllUpdates = useCallback(async () => {
    updatesRef.current.forEach((u) => updateSnapshot(u.animeId, u.newEpisode))

    setUpdates([])

    if (user) {
      const { error } = await supabase
        .from("episode_updates")
        .delete()
        .eq("user_id", user.id)
      if (error) {
        console.error("Failed to clear episode updates in DB:", error)
      }
    } else {
      localStorage.setItem(EPISODE_UPDATES_KEY, JSON.stringify([]))
    }

    window.dispatchEvent(new Event(UPDATE_EVENT))
  }, [user, updateSnapshot])

  const checkAnimeUpdates = useCallback(async (force?: boolean) => {
    if (typeof window === "undefined") return

    // Fix #3: Prevent concurrent execution
    if (isCheckingRef.current) return
    isCheckingRef.current = true

    // Throttle: once per 15 minutes unless forced
    if (!force) {
      const lastCheck = localStorage.getItem(LAST_CHECK_KEY)
      const now = Date.now()
      if (lastCheck && now - Number(lastCheck) < 15 * 60 * 1000) {
        isCheckingRef.current = false
        return
      }
    }

    setIsChecking(true)

    try {
      // Тайтлы, за которыми человек ЯВНО подписан на новые серии.
      //
      // Раньше здесь стояло `watch_history ∪ bookmarks`, и это была главная
      // причина, почему уведомлениями нельзя было управлять: подписки не
      // существовало как сущности, а тайтл попадал в проверку сам собой. Убрать
      // из закладок было мало — `watch_history` живёт вечно, и уведомления
      // продолжали приходить. Теперь список берётся из `title_subscriptions`
      // с каналом notify_new_episodes: подписался — получаешь, отписался —
      // нет. Закладки и история больше не являются триггером уведомлений.
      let idsToCheck: string[] = []
      type HistoryItem = { id: string; episode?: number }
      let watchHistory: HistoryItem[] = []
      /** Подписки по тайтлу: из них берётся точка отсчёта в hasNewEpisode. */
      const subscriptionsByAnime = new Map<string, TitleSubscription>()

      if (user) {
        const [historyRes, subsRes] = await Promise.all([
          supabase
            .from("watch_history")
            .select("anime_id, episode")
            .eq("user_id", user.id)
            .order("timestamp", { ascending: false })
            .limit(100),
          supabase
            .from("title_subscriptions")
            .select("*")
            .eq("user_id", user.id)
            .eq("notify_new_episodes", true)
            .limit(200),
        ])

        if (!historyRes.error && historyRes.data) {
          watchHistory = historyRes.data.map((row: { anime_id: string; episode: number | null }) => ({
            id: String(row.anime_id),
            episode: row.episode ?? 0,
          }))
        }

        // Таблицы может не быть до применения миграции. Тогда подписок нет,
        // и проверять нечего — но молча падать нельзя: это единственный путь
        // к уведомлениям, и ошибка должна быть видна в консоли.
        if (subsRes.error) {
          console.warn("[EpisodeUpdates] title_subscriptions read failed:", subsRes.error.message)
        } else if (subsRes.data) {
          for (const row of subsRes.data as TitleSubscriptionRow[]) {
            const subscription = mapSubscriptionRow(row)
            if (subscription) subscriptionsByAnime.set(subscription.animeId, subscription)
          }
          idsToCheck = Array.from(subscriptionsByAnime.keys())
        }
      } else {
        watchHistory = JSON.parse(localStorage.getItem("watch-history") || "[]")
        // У гостя подписок нет: они живут в аккаунте (кнопка предлагает вход,
        // намерение подхватывается после). Поэтому гостю эта проверка не
        // приносит ничего — и раньше не приносила: без аккаунта строки
        // `episode_updates` всё равно оставались в localStorage.
        idsToCheck = []
      }

      if (idsToCheck.length === 0) {
        isCheckingRef.current = false
        setIsChecking(false)
        return
      }

      const freshData = await getFreshAnimeData(idsToCheck)

      // Dispatch fresh anime data so BookmarksProvider can refresh stale bookmark entries
      if (freshData.length > 0) {
        const freshMap: Record<string, { status: string; episodesCurrent: number; episodesTotal: number; title: string }> = {}
        freshData.forEach((a) => {
          freshMap[String(a.id)] = {
            status: a.status,
            episodesCurrent: a.episodesCurrent,
            episodesTotal: a.episodesTotal,
            title: a.title,
          }
        })
        window.dispatchEvent(new CustomEvent("anime-data-refreshed", { detail: freshMap }))
      }

      const snapshotRaw = localStorage.getItem(BOOKMARK_SNAPSHOT_KEY)
      const snapshot = snapshotRaw ? JSON.parse(snapshotRaw) : {}

      let newUpdatesList = [...updatesRef.current]
      let hasChanges = false

      // Build a set of IDs returned from the API for quick lookup
      const freshIds = new Set(freshData.map((a) => String(a.id)))

      freshData.forEach((anime) => {
        const animeId = String(anime.id)
        const existingIdx = newUpdatesList.findIndex((u) => u.animeId === animeId)

        // Запись, которую записал не браузер. Такую нельзя ни перезаписать, ни
        // удалить: её числа (сколько серий доступно в Kodik) и её смысл
        // («появилась озвучка») клинер не вычисляет и вычислить не может.
        //
        // Раньше это регулировалось `protectedIds` — списком тайтлов из
        // `translation_alerts` с окном в 30 дней. Окно заканчивалось, и запись
        // снова становилась доступной затиранию. Поле `source` отвечает на тот
        // же вопрос точно и навсегда.
        const existing = existingIdx !== -1 ? newUpdatesList[existingIdx] : null
        if (existing && existing.source === "dub") return

        // Статус «released» больше не приговор: уведомление мог появиться,
        // пока тайтл был онгоингом, а завершился он уже после. Но и оставлять
        // его навсегда нельзя — иначе колокольчик вечно показывает то, что
        // человек давно посмотрел. Ршение: убираем, как раньше.
        if (anime.status !== "ongoing") {
          if (existingIdx !== -1) {
            newUpdatesList.splice(existingIdx, 1)
            hasChanges = true
          }
          return
        }

        // Точка отсчёта: сколько серий человек уже знает про этот тайтл.
        //
        // Раньше здесь бралась только история просмотров, из-за чего уведомления
        // приходили о сериях, которые человек не смотрел и не собирался. И
        // обратная проблема: подписавшись на давно вышедший тайтл, человек
        // мгновенно получал «вышла серия 12».
        //
        // Берём максимум из трёх источников, потому что они означают разное:
        //   baseline_episode  — что человек видел на момент подписки;
        //   last_notified     — что мы уже сообщали (иначе повтор);
        //   история/snapshot  — что он фактически досмотрел после подписки,
        //                       чтобы не слать «серия 4», которую он уже посмотрел.
        const subscription = subscriptionsByAnime.get(String(anime.id))
        const historyItem = watchHistory.find((h: HistoryItem) => String(h.id) === String(anime.id))

        let watchedEp = Math.max(
          subscription?.baselineEpisode ?? 0,
          subscription?.lastNotifiedEpisode ?? 0,
        )
        if (historyItem) {
          watchedEp = Math.max(watchedEp, historyItem.episode || 0)
        }
        if (snapshot[anime.id]) {
          watchedEp = Math.max(watchedEp, snapshot[anime.id])
        }

        // Само правило «вышла ли новая серия» — из lib/title-subscriptions,
        // тем же кодом, что крутит бот. Сравнение написано здесь и здесь
        // расходилось бы при первой же правке одного из двух мест.
        if (
          subscription &&
          hasNewEpisode({ ...subscription, baselineEpisode: watchedEp }, anime.episodesCurrent)
        ) {
          if (
            existingIdx === -1 ||
            newUpdatesList[existingIdx].newEpisode < anime.episodesCurrent ||
            !newUpdatesList[existingIdx].poster
          ) {
            const updateObj: EpisodeUpdate = {
              animeId: anime.id,
              animeTitle: anime.title,
              poster: anime.poster,
              oldEpisode: watchedEp,
              newEpisode: anime.episodesCurrent,
              totalEpisodes: anime.episodesTotal,
              updatedAt: new Date().toISOString(),
              source: "shikimori",
            }

            if (existingIdx !== -1) {
              newUpdatesList[existingIdx] = updateObj
            } else {
              newUpdatesList.push(updateObj)
            }
            hasChanges = true
          }
        } else if (existingIdx !== -1) {
          // Новой серии нет — уведомление потеряло смысл.
          newUpdatesList.splice(existingIdx, 1)
          hasChanges = true
        }
      })

      // Записи, которых нет в ответе Shikimori: тайтл мог удалиться или
      // запрос мог упасть. Убирать имеет смысл только при успешном ответе,
      // и только записи, которые записал сам браузер — записи сервера про
      // озвучку к Shikimori отношения не имеют.
      if (freshData.length > 0) {
        const isStaleFromApi = (update: EpisodeUpdate) =>
          update.source === "shikimori" &&
          idsToCheck.includes(String(update.animeId)) &&
          !freshIds.has(String(update.animeId))

        const staleFromApi = newUpdatesList.filter(isStaleFromApi)
        if (staleFromApi.length > 0) {
          newUpdatesList = newUpdatesList.filter((u) => !isStaleFromApi(u))
          hasChanges = true
        }
      }

      // Убираем всё, на что человек больше не подписан. Раньше здесь
      // подставлялся `protectedIds`, и это был последний оплот костыля:
      // чужую запись он защищал, но список «кем человек подписан» всё равно
      // строили не по подпискам.
      //
      // Правило живёт в `lib/title-subscriptions`, а не здесь: это единственное
      // место, где известно, что `idsToCheck` — тайтлы с каналом
      // `notify_new_episodes`, и что запись `source: 'dub'` в этом смысле
      // ничего общего с проверкой не имеет. Раньше проверки источника не
      // было вовсе, и уведомление об озвучке у человека, подписавшегося
      // ТОЛЬКО на озвучку, молча пропадало из колокольчика.
      const staleUpdates = newUpdatesList.filter((u) =>
        isStaleSubscriptionUpdate(u, idsToCheck),
      )
      if (staleUpdates.length > 0) {
        newUpdatesList = keepLiveSubscriptionUpdates(newUpdatesList, idsToCheck)
        hasChanges = true

        try {
          const snapshotRaw = localStorage.getItem(BOOKMARK_SNAPSHOT_KEY)
          if (snapshotRaw) {
            const snapshot = JSON.parse(snapshotRaw)
            let snapshotChanged = false
            staleUpdates.forEach((u) => {
              if (snapshot[u.animeId]) {
                delete snapshot[u.animeId]
                snapshotChanged = true
              }
            })
            if (snapshotChanged) {
              localStorage.setItem(BOOKMARK_SNAPSHOT_KEY, JSON.stringify(snapshot))
            }
          }
        } catch (e) {
          console.error("Snapshot cleanup error", e)
        }
      }

      if (hasChanges) {
        if (user) {
          // В БД пишем ТОЛЬКО свои записи. Записи с source='dub' в payload не
          // попадают намеренно: upsert по (user_id, anime_id) заменил бы строку
          // целиком и записал бы `new_episode` по episodes_aired Shikimori
          // поверх «12 серий доступно в Kodik» — то есть тихо испортил бы
          // ровно то уведомление, ради которого человек и подписался.
          const ownUpdates = newUpdatesList.filter((u) => u.source === "shikimori")

          const payload = ownUpdates.map((u) => ({
            user_id: user.id,
            anime_id: u.animeId,
            anime_title: u.animeTitle,
            old_episode: u.oldEpisode,
            new_episode: u.newEpisode,
            total_episodes: u.totalEpisodes,
            updated_at: u.updatedAt,
            source: "shikimori",
          }))

          // Удаляем тоже только свои: чужая запись, по которой клиент
          // случайно решил, что тайтла «больше нет», забрала бы у человека
          // уведомление о найденной озвучке.
          const ownIds = new Set(ownUpdates.map((u) => u.animeId))
          const toDelete = updatesRef.current
            .filter((u) => u.source === "shikimori" && !ownIds.has(u.animeId))
            .map((u) => u.animeId)

          if (toDelete.length > 0) {
            const { error: delError } = await supabase
              .from("episode_updates")
              .delete()
              .eq("user_id", user.id)
              .eq("source", "shikimori")
              .in("anime_id", toDelete)
            if (delError) {
              console.error("Failed to delete stale episode updates:", delError)
            }
          }
          if (payload.length > 0) {
            const { error: upsertError } = await supabase
              .from("episode_updates")
              .upsert(payload, { onConflict: "user_id, anime_id" })
            if (upsertError) {
              console.error("Failed to upsert episode updates:", upsertError)
            }
          }

          setUpdates(newUpdatesList)

          // Пуш шлём по своей находке, а не по «первой строке списка»:
          // раньше бралась newUpdatesList[0], и в уведомление могла попасть
          // чужая запись про озвучку с текстом «вышла серия N».
          const newOnly = ownUpdates.filter(
            (u) => !updatesRef.current.some((old) => old.animeId === u.animeId),
          )
          if (newOnly.length > 0) {
            for (const update of newOnly) {
              fetch("/api/push/send", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  userId: user.id,
                  title: `Weebx — Новая серия: ${update.animeTitle}`,
                  message: `Вышла серия ${update.newEpisode}${update.totalEpisodes ? ` из ${update.totalEpisodes}` : ""}`,
                  url: getWatchPath(update.animeId, update.animeTitle),
                }),
              }).catch((e) => console.warn("Push send failed:", e))
            }
          }
        } else {
          localStorage.setItem(EPISODE_UPDATES_KEY, JSON.stringify(newUpdatesList))
          setUpdates(newUpdatesList)
        }
      }

      localStorage.setItem(LAST_CHECK_KEY, String(Date.now()))
    } catch (e) {
      console.error("Check updates failed", e)
    } finally {
      setIsChecking(false)
      isCheckingRef.current = false
    }
  }, [user, fetchAlertsState])

  useEffect(() => {
    setMounted(true)
    loadUpdates()

    const handleStorage = (e: StorageEvent) => {
      if (e.key === EPISODE_UPDATES_KEY) loadUpdates()
    }
    const handleCustom = () => loadUpdates()
    const handleCheckNeeded = () => checkAnimeUpdates(true)

    const timer = setTimeout(() => checkAnimeUpdates(), 2000)
    // Ожидания озвучки проверяем чуть позже, чтобы не спорить за сеть с
    // онгоингами и не задерживать первый рендер.
    const alertsTimer = setTimeout(() => checkTranslationAlerts(), 3500)

    // Вернулся на вкладку — возможно, озвучка появилась час назад.
    const handleVisible = () => {
      if (document.visibilityState === "visible") checkTranslationAlerts()
    }
    const handleAuthSynced = () => checkTranslationAlerts(true)

    // Периодическая проверка, а не только по событию возврата на вкладку.
    // Раньше её не было вовсе: единственными триггерами были таймауты на
    // старте и `visibilitychange`. Вкладка, открытая и всё время активная
    // (ровно сценарий «смотрю серию, вышла озвучка»), не проверяла ожидания
    // ни разу, пока пользователь не переключился на другую вкладку.
    //
    // Период совпадает с клиентскими троттлингами обеих проверок, поэтому
    // лишних запросов интервал не создаёт — он просто даёт им повод
    // сработать. Скрытую вкладку пропускаем: браузер и так режет таймеры
    // в фоне, а `visibilitychange` вернёт проверку при возврате.
    const heartbeat = setInterval(() => {
      if (document.visibilityState !== "visible") return
      void checkAnimeUpdates()
      void checkTranslationAlerts()
    }, ALERTS_CHECK_THROTTLE_MS)

    window.addEventListener("storage", handleStorage)
    window.addEventListener(UPDATE_EVENT, handleCustom)
    window.addEventListener("episode-updates-check-needed" as any, handleCheckNeeded)
    window.addEventListener("visibilitychange", handleVisible)
    window.addEventListener("auth-synced", handleAuthSynced)

    return () => {
      clearTimeout(timer)
      clearTimeout(alertsTimer)
      clearInterval(heartbeat)
      window.removeEventListener("storage", handleStorage)
      window.removeEventListener(UPDATE_EVENT, handleCustom)
      window.removeEventListener("episode-updates-check-needed" as any, handleCheckNeeded)
      window.removeEventListener("visibilitychange", handleVisible)
      window.removeEventListener("auth-synced", handleAuthSynced)
    }
  }, [loadUpdates, checkAnimeUpdates, checkTranslationAlerts])

  const value: EpisodeUpdatesContextValue = {
    updates,
    checkAnimeUpdates,
    checkTranslationAlerts,
    clearUpdate,
    clearAllUpdates,
    mounted,
    isChecking,
  }

  return <EpisodeUpdatesContext.Provider value={value}>{children}</EpisodeUpdatesContext.Provider>
}

export function useEpisodeUpdatesContext() {
  const ctx = useContext(EpisodeUpdatesContext)
  if (!ctx) {
    throw new Error("useEpisodeUpdatesContext must be used within EpisodeUpdatesProvider")
  }
  return ctx
}
