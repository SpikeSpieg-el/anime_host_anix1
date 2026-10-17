import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { NextRequest, NextResponse } from "next/server"
import { toBool, toInt } from "@/lib/subscription-list"
import { upgradeShikimoriUrl } from "@/lib/shikimori/utils"
import { getAnimeTranslationsResult } from "@/lib/kodik"
import { dubEpisodeToWait } from "@/lib/translation-alerts"

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

export const dynamic = "force-dynamic"

/**
 * Список тайтлов, на которые человек ждёт уведомления.
 *
 * Данные лежат в двух таблицах, и именно их рассинхрон и портил обещания:
 * `title_subscriptions` хранит каналы (серии / озвучка), а `translation_alerts` —
 * конкретное ожидание озвучки с номером серии. Страница показывает их вместе,
 * чтобы человек видел ровно то, что проверка действительно будет делать.
 *
 * `translation_alerts` присоединяется слева: у тайтла может быть канал озвучки
 * без активного ожидания (пока оно не создано) и наоборот.
 */
export interface SubscriptionListItem {
  animeId: string
  animeTitle: string
  poster: string | null
  notifyNewEpisodes: boolean
  notifyDub: boolean
  /** Сколько серий человек уже знал про этот тайтл на момент подписки. */
  baselineEpisode: number
  /** Какую серию ждём по озвучке (null, если озвучка не запрошена). */
  wantedEpisode: number | null
  /** Сколько серий выйдет всего (null, если неизвестно). */
  episodesTotal: number | null
  /** Тайтл закончен: новых серий не будет. */
  isCompleted: boolean
  /** Когда сервер в последний раз спрашивал Kodik про этот тайтл. */
  lastCheckedAt: string | null
}

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

interface MissingMeta {
  title?: string
  poster?: string
  /** Сколько серий выйдет всего — нужно, чтобы понять, есть ли что ждать. */
  episodesTotal?: number | null
  /** Та��тл закончен: `episodes_aired === episodes`, `status: released`. */
  isCompleted?: boolean
}

/** Служебная заглушка вместо названия, которую пишет `buildSubscription`. */
function isPlaceholderTitle(value: unknown): boolean {
  const trimmed = typeof value === "string" ? value.trim() : ""
  return !trimmed || trimmed.startsWith("Аниме #")
}

function resolveTitle(
  stored: unknown,
  animeId: string,
  resolved: Map<string, MissingMeta>,
): string {
  if (!isPlaceholderTitle(stored)) return (stored as string).trim()
  return resolved.get(animeId)?.title || `Аниме #${animeId}`
}

/** Обложка: из подписки, а если там пусто — из Shikimori. */
function resolvePoster(
  stored: unknown,
  animeId: string,
  resolved: Map<string, MissingMeta>,
): string | null {
  const trimmed = typeof stored === "string" ? stored.trim() : ""
  if (trimmed && !isPlaceholderImage(trimmed)) return trimmed
  return resolved.get(animeId)?.poster ?? null
}

/** Заглушки Shikimori — валидный файл, а не 404. Показывать их незачем. */
function isPlaceholderImage(url: string): boolean {
  const lower = url.toLowerCase()
  return ["missing", "stub", "placeholder", "default"].some((s) => lower.includes(s))
}

/**
 * Название и обложка для подписок, у которых их нет в БД, одним батчем.
 *
 * Подписки заводятся годами, и у старых строк колонки заполнены частично:
 * у кого-то нет названия (тогда `buildSubscription` писал служебное
 * «Аниме #<id>»), у кого-то нет постера. На странице это читается как поломка,
 * хотя на самом деле данные есть и лежат в том же самом Shikimori, откуда
 * берутся все остальные обложки сайта.
 *
 * Один запрос на 50 тайтлов вместо 88 отдельных — поэтому батчем, а не
 * через `resolveBestPoster` с его четырьмя внешними API и задержками.
 * Кэш на час (обложка не меняется), пустой ответ не кэшируем.
 */
async function fetchMissingMeta(ids: string[]): Promise<Map<string, MissingMeta>> {
  const result = new Map<string, MissingMeta>()
  if (ids.length === 0) return result

  const parsed = ids
    .map((id) => Number.parseInt(id, 10))
    .filter((id) => Number.isInteger(id) && id > 0)
  if (parsed.length === 0) return result

  // Shikimori берёт максимум 50 id за раз, а подписок бывает и за сотню:
  // режем на чанки, иначе молча осталось бы 38 непрочитанных тайтлов.
  const CHUNK = 50
  for (let start = 0; start < parsed.length; start += CHUNK) {
    const chunk = parsed.slice(start, start + CHUNK)
    try {
      const response = await fetch(
        `https://shikimori.one/api/animes?ids=${chunk.join(",")}&limit=${chunk.length}`,
        {
          headers: { "User-Agent": "Weebx/1.0" },
          next: { revalidate: 3600 },
          signal: AbortSignal.timeout(8000),
        },
      )
      if (!response.ok) continue

      const data = await response.json()
      if (!Array.isArray(data)) continue

      for (const item of data) {
        const id = String(item?.id ?? "")
        if (!id) continue

        const title = (item?.russian || item?.name || "").trim()
        const rawImage = item?.image?.original || item?.image?.large || ""
        const poster = rawImage && !isPlaceholderImage(rawImage)
          ? upgradeShikimoriUrl(`https://shikimori.one${rawImage}`)
          : undefined

        const total = Number(item?.episodes)
        const aired = Number(item?.episodes_aired)
        const episodesTotal = Number.isFinite(total) && total > 0 ? Math.floor(total) : null
        const isCompleted =
          Boolean(episodesTotal) &&
          Number.isFinite(aired) &&
          Math.floor(aired) >= (episodesTotal as number)

        if (title || poster || episodesTotal !== null) {
          result.set(id, {
            title: title || undefined,
            poster,
            episodesTotal,
            isCompleted,
          })
        }
      }
    } catch (error) {
      // Название и обложка — косметика. Не роняем из-за них весь список:
      // лучше часть тайтлов без метаданных, чем пустая страница.
      console.warn("[subscriptions] не удалось дочитать метаданные:", error)
    }
  }

  return result
}

/**
 * Сколько серий уже вышло по Shikimori — точка отсчёта для канала серий.
 *
 * Ноль в такой роли врёт: подписка на давно вышедший тайл немедленно
 * сообщила бы «вышла серия 12». Ошибка здесь не должна ломать включение
 * канала — тогда берётся 0, и хуже одно лишнее уведомление, чем отказ
 * переключателя.
 */
async function fetchAiredEpisodes(animeId: string): Promise<number | null> {
  try {
    const response = await fetch(
      `https://shikimori.one/api/animes/${encodeURIComponent(animeId)}`,
      {
        headers: { "User-Agent": "Weebx/1.0" },
        next: { revalidate: 3600 },
        signal: AbortSignal.timeout(8000),
      },
    )
    if (!response.ok) return null
    const data = await response.json()
    const aired = Number(data?.episodes_aired)
    return Number.isFinite(aired) && aired > 0 ? Math.floor(aired) : 0
  } catch (error) {
    console.warn("[subscriptions] не удалось узнать число вышедших серий:", error)
    return null
  }
}

/** Сколько серий выйдет всего; null, если неизвестно или тайтл ещё считается. */
async function fetchEpisodesTotal(animeId: string): Promise<number | null> {
  try {
    const response = await fetch(
      `https://shikimori.one/api/animes/${encodeURIComponent(animeId)}`,
      {
        headers: { "User-Agent": "Weebx/1.0" },
        next: { revalidate: 3600 },
        signal: AbortSignal.timeout(8000),
      },
    )
    if (!response.ok) return null
    const data = await response.json()
    const total = Number(data?.episodes)
    return Number.isFinite(total) && total > 0 ? Math.floor(total) : null
  } catch (error) {
    console.warn("[subscriptions] не удалось узнать число серий:", error)
    return null
  }
}

export async function GET(request: NextRequest) {
  const auth = await authenticate(request)
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: subs, error } = await auth.admin
    .from("title_subscriptions")
    .select("anime_id, anime_title, poster, notify_new_episodes, notify_dub, baseline_episode")
    .eq("user_id", auth.userId)

  if (error) {
    console.error("[subscriptions] title_subscriptions read failed:", error.message)
    return NextResponse.json({ error: "Failed to load subscriptions" }, { status: 500 })
  }

  const rows = Array.isArray(subs) ? subs : []
  if (rows.length === 0) {
    return NextResponse.json({ subscriptions: [] })
  }

  const { data: alerts, error: alertError } = await auth.admin
    .from("translation_alerts")
    .select("anime_id, episode, last_checked_at")
    .eq("user_id", auth.userId)
    // Закрытые ожидания (notified_at) в список не показываем: уведомление
    // уже пришло, ждать больше нечего.
    .is("notified_at", null)

  if (alertError) {
    console.error("[subscriptions] translation_alerts read failed:", alertError.message)
    return NextResponse.json({ error: "Failed to load expectations" }, { status: 500 })
  }

  const alertByAnime = new Map<string, { episode: number; lastCheckedAt: string | null }>()
  for (const alert of Array.isArray(alerts) ? alerts : []) {
    if (!alert?.anime_id) continue
    alertByAnime.set(String(alert.anime_id), {
      episode: toInt(alert.episode) || 1,
      lastCheckedAt: alert.last_checked_at ?? null,
    })
  }

  // У части подписок `anime_title` или `poster` пустые: их заводили раньше,
  // когда эти колонки ещё не заполнялись. Данные лежат в том же Shikimori,
  // откуда берутся обложки на остальных страницах сайта, — дочитываем батчем.
  const needsMeta = rows
    .filter(
      (row) =>
        isPlaceholderTitle(row.anime_title) ||
        !row.poster ||
        isPlaceholderImage(String(row.poster)) ||
        toBool(row.notify_dub),
    )
    .map((row) => String(row.anime_id))
  const resolvedMeta = await fetchMissingMeta(needsMeta)

  const subscriptions: SubscriptionListItem[] = rows
    .map((row) => {
      const animeId = String(row.anime_id)
      const alert = alertByAnime.get(animeId)
      return {
        animeId,
        animeTitle: resolveTitle(row.anime_title, animeId, resolvedMeta),
        poster: resolvePoster(row.poster, animeId, resolvedMeta),
        notifyNewEpisodes: toBool(row.notify_new_episodes),
        notifyDub: toBool(row.notify_dub),
        baselineEpisode: toInt(row.baseline_episode),
        // Канал озвучки без активного ожидания: ждать пока нечего, но и
        // обещание в интерфейсе есть — покажем «ждём 1 серию».
        // У завершённого тайтла ждать нечего: `nextDubEpisode` выдала бы
        // «13-ю серию» тайтла на 12 серий, и уведомление не пришло бы никогда.
        wantedEpisode: toBool(row.notify_dub)
          ? resolvedMeta.get(animeId)?.isCompleted
            ? null
            : (alert?.episode ?? 1)
          : null,
        episodesTotal: resolvedMeta.get(animeId)?.episodesTotal ?? null,
        isCompleted: Boolean(resolvedMeta.get(animeId)?.isCompleted),
        lastCheckedAt: alert?.lastCheckedAt ?? null,
      }
    })

  return NextResponse.json(
    { subscriptions },
    { headers: { "Cache-Control": "private, no-store" } },
  )
}

/**
 * Переключить каналы подписки.
 *
 * Один канал — это `title_subscriptions`. Оба канала — это ещё и строка в
 * `translation_alerts`: без неё проверка не знает, какую серию ждать и в каких
 * озвучках искать. Поэтому включение озвучки обязано создавать ожидание, иначе
 * интерфейс покажет «жду озвучку», а уведомление никогда не придёт.
 *
 * Точки отсчёта обязаны быть настоящими
 * --------------------------------------
 * Обе цифры берутся у провайдера, а не заводятся в ноль, иначе человек
 * получит мгновенное ложное уведомление:
 *
 *   - `baseline_episode` — сколько серий уже вышло в Shikimori. При нуле
 *     подписка на давно вышедший тайл сразу отстреливает «вышла серия 12»;
 *   - `episode` ожидания озвучки — следующая за тем, что уже есть в Kodik.
 *     При единице озвучка, где первая серия уже есть, закрывается немедленно.
 *
 * Это по одному запросу на явное действие человека (щелчок по тумблеру), а не
 * на каждую загрузку страницы — цена приемлемая.
 */
export async function PATCH(request: NextRequest) {
  const auth = await authenticate(request)
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const animeId = String(body?.animeId ?? "").trim()
  if (!animeId) {
    return NextResponse.json({ error: "animeId обязателен" }, { status: 400 })
  }

  const notifyNewEpisodes = body?.notifyNewEpisodes === true
  const notifyDub = body?.notifyDub === true

  const { data: existingRows, error: readError } = await auth.admin
    .from("title_subscriptions")
    .select("anime_title, poster, baseline_episode")
    .eq("user_id", auth.userId)
    .eq("anime_id", animeId)
    .limit(1)

  if (readError) {
    console.error("[subscriptions] read failed:", readError.message)
    return NextResponse.json({ error: "Failed to update" }, { status: 500 })
  }

  const existing = existingRows?.[0] ?? null

  // Точка отсчёта для канала серий: сколько уже вышло. Ноль был бы ложью и
  // дал бы мгновенное «вышла серия 12» на давно вышедшем тайле.
  const airedNow = notifyNewEpisodes ? await fetchAiredEpisodes(animeId) : null
  const baselineEpisode = existing
    ? toInt(existing.baseline_episode)
    : Math.max(airedNow ?? 0, 0)

  const { error: upsertError } = await auth.admin.from("title_subscriptions").upsert(
    {
      user_id: auth.userId,
      anime_id: animeId,
      anime_title: existing?.anime_title || body?.animeTitle || `Аниме #${animeId}`,
      poster: existing?.poster ?? body?.poster ?? null,
      notify_new_episodes: notifyNewEpisodes,
      notify_dub: notifyDub,
      baseline_episode: baselineEpisode,
      // `source` — справочная колонка для разбора поломок. Здесь подписку
      // создаёт сам человек через переключатель, а не плашка в плеере.
      source: "manual",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,anime_id" },
  )

  if (upsertError) {
    console.error("[subscriptions] upsert failed:", upsertError.message)
    return NextResponse.json({ error: "Failed to update" }, { status: 500 })
  }

  if (notifyDub) {
    // Какую серию ждать — решает Kodik: ждём первую, которой ещё нет ни в
    // одной озвучке. Единица в лоб закрыла бы ожидание сию секунду.
    const { translations, ok } = await getAnimeTranslationsResult(
      animeId,
      existing?.anime_title || body?.animeTitle || undefined,
    )

    // Сколько серий выйдет всего. У завершённого тайтла (episodes_aired ==
    // episodes, status released) новых серий не будет: «ждать 13-ю» в тайтле
    // на 12 серий — обещание, которое не сойдётся никогда, и озвучка отстать
    // от закончившегося не может. В этом случае ожидание не создаём вовсе,
    // а UI покажет, что ждать нечего.
    const total = await fetchEpisodesTotal(animeId)
    const wanted = ok ? dubEpisodeToWait(translations, total) : null
    const nothingToWait = total !== null && total > 0 && ok && wanted === null

    if (!nothingToWait) {
      const wantedEpisode = wanted ?? 1
      const { error: alertError } = await auth.admin.from("translation_alerts").upsert(
        {
          user_id: auth.userId,
          anime_id: animeId,
          anime_title: existing?.anime_title || body?.animeTitle || `Аниме #${animeId}`,
          poster: existing?.poster ?? body?.poster ?? null,
          episode: wantedEpisode,
          baseline_episode: toInt(existing?.baseline_episode) || wantedEpisode - 1,
          reason: ok && translations.length > 0 ? "dub-behind" : "no-translations",
          // Возобновляем ожидание: иначе повторное включение после закрытого
          // уведомления не заработает.
          notified_at: null,
          last_checked_at: null,
        },
        { onConflict: "user_id,anime_id" },
      )
      if (alertError) {
        console.error("[subscriptions] alert upsert failed:", alertError.message)
        return NextResponse.json({ error: "Failed to update" }, { status: 500 })
      }
    } else {
      // Старое ожидание (с «13-й серией» у завершённого тайтла) гасим.
      await auth.admin
        .from("translation_alerts")
        .delete()
        .eq("user_id", auth.userId)
        .eq("anime_id", animeId)
    }
  } else {
    // Озвучка выключена, но серии оставили — гасим только озвучку.
    const { error: alertError } = await auth.admin
      .from("translation_alerts")
      .delete()
      .eq("user_id", auth.userId)
      .eq("anime_id", animeId)
    if (alertError) {
      console.error("[subscriptions] alert delete failed:", alertError.message)
    }
  }

  return NextResponse.json({ ok: true, removed: false })
}

/** Отписаться от всех тайтлов разом. */
export async function DELETE(request: NextRequest) {
  const auth = await authenticate(request)
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const animeId = request.nextUrl.searchParams.get("animeId")?.trim()
  if (animeId) {
    const { error: subError } = await auth.admin
      .from("title_subscriptions")
      .delete()
      .eq("user_id", auth.userId)
      .eq("anime_id", animeId)
    if (subError) {
      console.error("[subscriptions] delete failed:", subError.message)
      return NextResponse.json({ error: "Failed to delete subscription" }, { status: 500 })
    }

    const { error: alertError } = await auth.admin
      .from("translation_alerts")
      .delete()
      .eq("user_id", auth.userId)
      .eq("anime_id", animeId)
    if (alertError) {
      console.error("[subscriptions] alert delete failed:", alertError.message)
    }

    return NextResponse.json({ ok: true })
  }

  const { error: subError } = await auth.admin
    .from("title_subscriptions")
    .delete()
    .eq("user_id", auth.userId)
  if (subError) {
    console.error("[subscriptions] delete all failed:", subError.message)
    return NextResponse.json({ error: "Failed to unsubscribe" }, { status: 500 })
  }

  // Ожидания озвучки обязаны уйти вместе с подписками: иначе проверка
  // продолжит обходить Kodik по тайтлам, от которых человек уже отписался.
  const { error: alertError } = await auth.admin
    .from("translation_alerts")
    .delete()
    .eq("user_id", auth.userId)
  if (alertError) {
    console.error("[subscriptions] delete all alerts failed:", alertError.message)
  }

  return NextResponse.json({ ok: true })
}