import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { NextRequest, NextResponse } from "next/server"
import webpush from "web-push"
import { getAnimeTranslationsResult, type KodikTranslation } from "@/lib/kodik"
import {
  ALERT_MIN_RECHECK_INTERVAL_MS,
  ALERT_TRANSLATIONS_TTL_MS,
  MAX_ALERTS_PER_CHECK,
  buildAlertNotification,
  isAlertDueForRecheck,
  mapAlertRow,
  resolveTranslationAlert,
  type TranslationAlert,
  type TranslationAlertRow,
} from "@/lib/translation-alerts"
import { createRateLimiter, getClientIP } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"
// Kodik + Shikimori + рассылка пушей по нескольким ожиданиям — не быстро.
export const maxDuration = 60

/**
 * POST /api/alerts/check
 *
 * Разбирает «ожидания озвучки» (public.translation_alerts) пользователя:
 * спрашивает Kodik, не появилась ли нужная серия, и если появилась —
 *   1. кладёт строку в episode_updates (колокольчик на сайте),
 *   2. шлёт web-push на все устройства пользователя,
 *   3. помечает ожидание закрытым (notified_at).
 *
 * Это вторая половина воронки с плашки «Скоро / Озвучка не найдена»: раньше
 * кнопка «Уведомить меня» сохраняла только push-подписку браузера, а список
 * проверяемых тайтлов строился из закладок и истории просмотров. У тайтла без
 * озвучки истории нет и в закладки его кладут не все → уведомление не приходило
 * никогда. Теперь ожидание хранится отдельно и проверяется независимо от них.
 *
 * GET /api/alerts/check — список активных ожиданий (для состояния плашки).
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

/** Клиент проверяет ожидания сам, но не чаще раза в ~10 минут на пользователя. */
const checkLimiter = createRateLimiter({ interval: 10 * 60_000, maxRequests: 12 })

/** Сколько озвучек проверяем параллельно — Kodik не любит шквал запросов. */
const KODIK_CONCURRENCY = 3

interface AuthContext {
  userId: string
  admin: SupabaseClient
}

async function authenticate(request: NextRequest): Promise<AuthContext | null> {
  const authHeader = request.headers.get("authorization")
  if (!authHeader?.startsWith("Bearer ")) return null
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null

  const token = authHeader.substring(7)
  const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data, error } = await supabaseAuth.auth.getUser(token)
  if (error || !data?.user?.id) return null

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY || SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  return { userId: data.user.id, admin }
}

/* ------------------------------------------------------------------ */
/* Кэш озвучек Kodik (в рамках процесса)                               */
/* ------------------------------------------------------------------ */

interface CachedTranslations {
  at: number
  value: KodikTranslation[]
  ok: boolean
}

const translationsCache = new Map<string, CachedTranslations>()

/**
 * Список озвучек тайтла с коротким кэшем.
 * Пустой ответ тоже кэшируем: у «ожидающих» тайтлов озвучки нет почти всегда,
 * и долбить Kodik одним и тем же запросом по нескольку раз за проверку незачем.
 * Сбой (ok=false) НЕ кэшируем — иначе окно сбоя заблокирует проверки на 10 минут.
 */
async function getTranslationsCached(
  animeId: string,
  title?: string | null,
  now: number = Date.now(),
): Promise<{ translations: KodikTranslation[]; ok: boolean }> {
  const cached = translationsCache.get(animeId)
  if (cached && now - cached.at < ALERT_TRANSLATIONS_TTL_MS) {
    return { translations: cached.value, ok: cached.ok }
  }

  const { translations: value, ok } = await getAnimeTranslationsResult(animeId, title || undefined)
  if (ok) {
    translationsCache.set(animeId, { at: now, value, ok })
  }

  // Кэш не должен расти бесконечно: выбрасываем самое старое.
  if (translationsCache.size > 500) {
    const oldestKey = translationsCache.keys().next().value
    if (oldestKey !== undefined) translationsCache.delete(oldestKey)
  }

  return { translations: value, ok }
}

/* ------------------------------------------------------------------ */
/* Shikimori: сколько всего серий запланировано (для текста пуша)      */
/* ------------------------------------------------------------------ */

interface ShikimoriTotals {
  episodesCurrent: number
  episodesTotal: number
  status: string
}

async function fetchShikimoriTotals(ids: string[]): Promise<Record<string, ShikimoriTotals>> {
  const result: Record<string, ShikimoriTotals> = {}
  if (ids.length === 0) return result

  try {
    const response = await fetch(
      `https://shikimori.one/api/animes?ids=${ids.join(",")}&limit=50`,
      {
        headers: { "User-Agent": "Weebx/1.0 (translation-alerts)" },
        next: { revalidate: 600 },
        signal: AbortSignal.timeout?.(8000),
      },
    )
    if (!response.ok) return result

    const data = await response.json()
    if (!Array.isArray(data)) return result

    for (const anime of data) {
      const id = String(anime?.id ?? "")
      if (!id) continue
      result[id] = {
        episodesCurrent: Number(anime.episodes_aired) || 0,
        episodesTotal: Number(anime.episodes) || 0,
        status: String(anime.status || ""),
      }
    }
  } catch (error) {
    console.warn("[alerts/check] Shikimori totals failed:", error)
  }

  return result
}

/* ------------------------------------------------------------------ */
/* Пуш                                                                 */
/* ------------------------------------------------------------------ */

async function sendPush(
  admin: SupabaseClient,
  userId: string,
  notification: { title: string; body: string; url: string; tag: string },
): Promise<number> {
  const publicKey = process.env.VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  if (!publicKey || !privateKey) {
    // Пуш не настроен — но ожидание всё равно закрыто и запись в колокольчике
    // есть, поэтому молча возвращаем 0, а не роняем весь запрос.
    return 0
  }

  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("user_id", userId)

  if (!subs || subs.length === 0) return 0

  webpush.setVapidDetails("mailto:admin@weeb-x.com", publicKey, privateKey)

  const payload = JSON.stringify({
    title: notification.title,
    body: notification.body,
    data: { url: notification.url },
    tag: notification.tag,
  })

  let sent = 0
  const dead: string[] = []

  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload,
      )
      sent++
    } catch (err: any) {
      if (err?.statusCode === 410 || err?.statusCode === 404) {
        dead.push(sub.endpoint)
      }
    }
  }

  if (dead.length > 0) {
    await admin.from("push_subscriptions").delete().in("endpoint", dead)
  }

  return sent
}

/* ------------------------------------------------------------------ */
/* Параллельная обработка пулом                                        */
/* ------------------------------------------------------------------ */

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let cursor = 0

  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++
      results[index] = await worker(items[index])
    }
  })

  await Promise.all(runners)
  return results
}

/* ------------------------------------------------------------------ */
/* GET: активные ожидания                                              */
/* ------------------------------------------------------------------ */

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticate(request)
    if (!auth) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
    }

    const { data, error } = await auth.admin
      .from("translation_alerts")
      .select("*")
      .eq("user_id", auth.userId)
      .is("notified_at", null)
      .order("created_at", { ascending: false })
      .limit(100)

    if (error) {
      console.error("[alerts/check] GET failed:", error)
      return NextResponse.json({ ok: false, error: "Failed to load alerts" }, { status: 500 })
    }

    const alerts = (data || [])
      .map((row: TranslationAlertRow) => mapAlertRow(row))
      .filter((alert): alert is TranslationAlert => alert !== null)

    return NextResponse.json({ ok: true, alerts })
  } catch (error) {
    console.error("[alerts/check] GET error:", error)
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 })
  }
}

/* ------------------------------------------------------------------ */
/* POST: проверка ожиданий                                             */
/* ------------------------------------------------------------------ */

interface ResolvedAlert {
  animeId: string
  animeTitle: string
  episode: number
  availableEpisode: number
  kind: string
  translationTitle?: string
  pushSent: number
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticate(request)
    if (!auth) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
    }

    const limitResult = checkLimiter.checkLimit(`alerts-check:${auth.userId}:${getClientIP(request)}`)
    if (!limitResult.success) {
      return NextResponse.json(
        { ok: false, error: "Too many requests", retryAfter: Math.ceil((limitResult.reset - Date.now()) / 1000) },
        { status: 429 },
      )
    }

    const now = Date.now()

    const { data: rows, error } = await auth.admin
      .from("translation_alerts")
      .select("*")
      .eq("user_id", auth.userId)
      .is("notified_at", null)
      // Сначала те, до которых давно не доходили (или не доходили вовсе).
      .order("last_checked_at", { ascending: true, nullsFirst: true })
      .limit(MAX_ALERTS_PER_CHECK)

    if (error) {
      console.error("[alerts/check] select failed:", error)
      return NextResponse.json({ ok: false, error: "Failed to load alerts" }, { status: 500 })
    }

    const allRows = (rows || []) as TranslationAlertRow[]
    // Клиентский троттлинг можно обойти — здесь упираемся в лимиты Kodik API.
    const dueRows = allRows.filter((row) => isAlertDueForRecheck(row.last_checked_at, now))

    if (dueRows.length === 0) {
      return NextResponse.json({
        ok: true,
        checked: 0,
        pending: allRows.length,
        resolved: [],
        nextCheckIn: ALERT_MIN_RECHECK_INTERVAL_MS,
      })
    }

    const outcomes = await mapWithConcurrency(dueRows, KODIK_CONCURRENCY, async (row) => {
      const alert = mapAlertRow(row)
      if (!alert || !row.id) return null

      const { translations, ok } = await getTranslationsCached(alert.animeId, alert.animeTitle, now)

      // Kodik не ответил — это не «озвучки нет». Отметку о проверке не ставим,
      // чтобы следующее окно проверки попробовало снова, а не ждало полчаса.
      if (!ok) return null

      const resolution = resolveTranslationAlert(alert, translations)

      // Отметку о проверке ставим в любом случае — иначе одно «вечное»
      // ожидание будет съедать весь лимит запросов к Kodik.
      await auth.admin
        .from("translation_alerts")
        .update({ last_checked_at: new Date(now).toISOString() })
        .eq("id", row.id)

      return resolution.resolved ? { alertId: row.id, alert, resolution } : null
    })

    const resolvedList = outcomes.filter(
      (item): item is {
        alertId: string
        alert: TranslationAlert
        resolution: ReturnType<typeof resolveTranslationAlert>
      } => item !== null,
    )

    const resolved: ResolvedAlert[] = []

    if (resolvedList.length > 0) {
      const totals = await fetchShikimoriTotals(resolvedList.map((item) => item.alert.animeId))

      for (const { alertId, alert, resolution } of resolvedList) {
        const shikimori = totals[alert.animeId]
        const totalEpisodes = shikimori?.episodesTotal || null
        const notification = buildAlertNotification(alert, resolution, totalEpisodes)

        // 1. Колокольчик на сайте: та же таблица, что и для онгоингов, поэтому
        //    уведомление видно на всех устройствах, а не только в этом браузере.
        const { error: updateError } = await auth.admin.from("episode_updates").upsert(
          {
            user_id: auth.userId,
            anime_id: alert.animeId,
            anime_title: alert.animeTitle,
            old_episode: Math.max(0, alert.baselineEpisode),
            new_episode: resolution.availableEpisode,
            total_episodes: totalEpisodes,
            updated_at: new Date(now).toISOString(),
          },
          { onConflict: "user_id,anime_id" },
        )
        if (updateError) {
          // Ожидание НЕ закрываем: следующая проверка попробует снова.
          // Иначе уведомление потерялось бы молча — ровно тот баг, который чиним.
          console.error("[alerts/check] episode_updates upsert failed:", updateError)
          continue
        }

        // 2. Закрываем ожидание ДО пуша: если рассылка упадёт, пользователь
        //    всё равно увидит серию в колокольчике, а повторных пушей не будет.
        const { error: closeError } = await auth.admin
          .from("translation_alerts")
          .update({ notified_at: new Date(now).toISOString() })
          .eq("id", alertId)
          .eq("user_id", auth.userId)
        if (closeError) {
          console.error("[alerts/check] close alert failed:", closeError)
        }

        // 3. Пуш на все устройства.
        let pushSent = 0
        try {
          pushSent = await sendPush(auth.admin, auth.userId, notification)
        } catch (pushError) {
          console.error("[alerts/check] push failed:", pushError)
        }

        resolved.push({
          animeId: alert.animeId,
          animeTitle: alert.animeTitle,
          episode: resolution.wantedEpisode,
          availableEpisode: resolution.availableEpisode,
          kind: resolution.kind || "episode",
          translationTitle: resolution.translationTitle,
          pushSent,
        })
      }
    }

    return NextResponse.json({
      ok: true,
      checked: dueRows.length,
      pending: allRows.length - resolved.length,
      resolved,
      nextCheckIn: ALERT_MIN_RECHECK_INTERVAL_MS,
    })
  } catch (error) {
    console.error("[alerts/check] POST error:", error)
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 })
  }
}
