/**
 * 301-редирект коротких/устаревших адресов /watch/{id} → /watch/{id}-{slug}.
 *
 * Зачем это в middleware, а не в page.tsx:
 * у /watch/[id] есть loading.tsx (Suspense), поэтому к моменту вызова redirect()
 * внутри страницы Next.js уже отправил заголовки «200 OK» и может сделать только
 * <meta http-equiv="refresh" content="1;url=...">. Яндекс считает такой refresh
 * ВРЕМЕННЫМ редиректом и показывает в выдаче самый короткий URL — отсюда дубли
 * /watch/48820 и /watch/48820-devochka-... в поиске.
 *
 * Middleware отвечает до рендера, поэтому здесь можно отдать настоящий 301.
 * Модуль совместим с edge runtime (только fetch + Map).
 */
import { BASE_URL, HEADERS } from "@/lib/shikimori/config"
import { getWatchSegment } from "@/lib/seo/watch-url"

type CacheEntry = { segment: string | null; expiresAt: number }

const POSITIVE_TTL_MS = 12 * 60 * 60 * 1000 // названия меняются крайне редко
const NEGATIVE_TTL_MS = 10 * 60 * 1000 // 404 от Shikimori — перепроверим позже
const MAX_CACHE_ENTRIES = 5000
const LOOKUP_TIMEOUT_MS = 3000

const segmentCache = new Map<string, CacheEntry>()
const inflight = new Map<string, Promise<string | null | undefined>>()

/** /watch/{id} или /watch/{id}-{slug}; всё остальное (вложенные пути и т.п.) не трогаем. */
const WATCH_PATH_RE = /^\/watch\/(\d+)(?:-([^/]*))?\/?$/

function remember(id: string, segment: string | null) {
  if (segmentCache.size >= MAX_CACHE_ENTRIES) {
    // Map хранит порядок вставки — выкидываем самую старую запись
    const oldest = segmentCache.keys().next().value
    if (oldest !== undefined) segmentCache.delete(oldest)
  }
  segmentCache.set(id, {
    segment,
    expiresAt: Date.now() + (segment ? POSITIVE_TTL_MS : NEGATIVE_TTL_MS),
  })
}

export function getCachedWatchSegment(id: string): string | null | undefined {
  const entry = segmentCache.get(id)
  if (!entry) return undefined
  if (Date.now() > entry.expiresAt) {
    segmentCache.delete(id)
    return undefined
  }
  return entry.segment
}

/**
 * Канонический сегмент для ID.
 * string — найден; null — аниме не существует; undefined — не удалось узнать (сеть/429).
 */
export async function lookupWatchSegment(
  id: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string | null | undefined> {
  const cached = getCachedWatchSegment(id)
  if (cached !== undefined) return cached

  const pending = inflight.get(id)
  if (pending) return pending

  const promise = (async () => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS)
    try {
      const res = await fetchImpl(`${BASE_URL}/animes/${id}`, {
        headers: HEADERS,
        signal: controller.signal,
      })
      if (res.status === 404) {
        remember(id, null)
        return null
      }
      if (!res.ok) return undefined
      const data = (await res.json()) as { russian?: string | null; name?: string | null }
      // Та же логика, что в transformAnime: title = russian || name
      const segment = getWatchSegment(id, data?.russian || data?.name || "")
      remember(id, segment)
      return segment
    } catch {
      return undefined
    } finally {
      clearTimeout(timer)
      inflight.delete(id)
    }
  })()

  inflight.set(id, promise)
  return promise
}

/**
 * Возвращает абсолютный путь (с query), на который нужно сделать 301, либо null.
 *
 * - /watch/{id}         → всегда проверяем (запрос в Shikimori, результат кэшируется);
 * - /watch/{id}-{slug}  → сверяем только с кэшем, чтобы не добавлять задержку к
 *   обычным просмотрам. При промахе кэша lookup запускается в фоне (`schedule`,
 *   в middleware это event.waitUntil) — следующий запрос с устаревшим slug уже
 *   получит 301. Первый же ответ — страница с canonical и <meta refresh=0>.
 */
export async function getWatchRedirectPath(
  pathname: string,
  search: string,
  fetchImpl: typeof fetch = fetch,
  schedule?: (task: Promise<unknown>) => void,
): Promise<string | null> {
  const match = WATCH_PATH_RE.exec(pathname)
  if (!match) return null

  const id = match[1]
  const hasSlugPart = match[2] !== undefined
  const currentSegment = pathname.replace(/^\/watch\//, "").replace(/\/$/, "")

  let canonical: string | null | undefined
  if (hasSlugPart) {
    canonical = getCachedWatchSegment(id)
    if (canonical === undefined && schedule) {
      schedule(lookupWatchSegment(id, fetchImpl).catch(() => undefined))
    }
  } else {
    canonical = await lookupWatchSegment(id, fetchImpl)
  }
  if (!canonical || canonical === currentSegment) return null

  return `/watch/${canonical}${search}`
}

/** Только для тестов. */
export function __resetWatchRedirectCache() {
  segmentCache.clear()
  inflight.clear()
}
