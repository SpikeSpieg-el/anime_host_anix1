import { BASE_URL, HEADERS } from "@/lib/shikimori/config"
import { getNewsSegment } from "@/lib/seo/news-url"

const POSITIVE_TTL_MS = 12 * 60 * 60 * 1000
const NEGATIVE_TTL_MS = 10 * 60 * 1000
const MAX_CACHE_ENTRIES = 3000
const LOOKUP_TIMEOUT_MS = 3000

const cache = new Map<string, { segment: string | null; expiresAt: number }>()
const inflight = new Map<string, Promise<string | null | undefined>>()
const NUMERIC_NEWS_PATH_RE = /^\/news\/(\d+)(?:-([^/]*))?\/?$/
const CUSTOM_NEWS_PATH_RE = /^\/news\/(custom-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:-([^/]*))?\/?$/i

function remember(id: string, segment: string | null) {
  if (cache.size >= MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next().value
    if (oldest !== undefined) cache.delete(oldest)
  }
  cache.set(id, {
    segment,
    expiresAt: Date.now() + (segment ? POSITIVE_TTL_MS : NEGATIVE_TTL_MS),
  })
}

function getCachedSegment(id: string): string | null | undefined {
  const entry = cache.get(id)
  if (!entry) return undefined
  if (Date.now() > entry.expiresAt) {
    cache.delete(id)
    return undefined
  }
  return entry.segment
}

async function lookupSegment(id: string, fetchImpl: typeof fetch): Promise<string | null | undefined> {
  const cached = getCachedSegment(id)
  if (cached !== undefined) return cached

  const pending = inflight.get(id)
  if (pending) return pending

  const promise = (async () => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS)
    try {
      let url = `${BASE_URL}/topics/${id}`
      let headers: Record<string, string> = HEADERS
      const customId = /^custom-([0-9a-f-]{36})$/i.exec(id)?.[1]

      if (id.startsWith("custom-")) {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
        const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        if (!customId || !supabaseUrl || !supabaseKey) return undefined
        const query = new URLSearchParams({
          id: `eq.${customId}`,
          is_published: "eq.true",
          select: "id,title",
          limit: "1",
        })
        url = `${supabaseUrl.replace(/\/$/, "")}/rest/v1/custom_news?${query}`
        headers = { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
      }

      const response = await fetchImpl(url, { headers, signal: controller.signal })
      if (response.status === 404) {
        remember(id, null)
        return null
      }
      if (!response.ok) return undefined

      const data = await response.json()
      const title = customId
        ? (Array.isArray(data) ? data[0]?.title : null)
        : (data as { topic_title?: string | null })?.topic_title
      if (!title) {
        if (customId && Array.isArray(data)) {
          remember(id, null)
          return null
        }
        return undefined
      }
      const segment = getNewsSegment(id, title)
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

export async function getNewsRedirectPath(
  pathname: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string | null> {
  const match = NUMERIC_NEWS_PATH_RE.exec(pathname) ?? CUSTOM_NEWS_PATH_RE.exec(pathname)
  if (!match) return null

  const id = match[1]
  const currentSegment = pathname.replace(/^\/news\//, "").replace(/\/$/, "")
  const canonical = await lookupSegment(id, fetchImpl)
  if (!canonical) return null

  const hasTrailingSlash = pathname.endsWith("/")
  return canonical !== currentSegment || hasTrailingSlash ? `/news/${canonical}` : null
}

export function __resetNewsRedirectCache() {
  cache.clear()
  inflight.clear()
}
