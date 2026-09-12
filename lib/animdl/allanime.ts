/**
 * TypeScript-порт провайдера AllAnime из animdl
 * (https://github.com/justfoolingaround/animdl — animdl/core/codebase/providers/allanime).
 *
 * Пайплайн animdl воспроизведён один в один:
 *   1. Поиск тайтла через GraphQL (`shows`).
 *   2. Эпизод через GraphQL (`episode`) → sourceUrls.
 *   3. sourceUrls с префиксом `--` дешифруются XOR-ом с однобайтовым ключом 56.
 *   4. Относительные ссылки (`/...`) разворачиваются через `clock.json`
 *      на хосте `episodeIframeHead` (получается из `getVersion`).
 *   5. Из ответа достаются прямые mp4 (rawUrls.vids), HLS (link / portData.streams)
 *      и субтитры.
 */

const ALLANIME_SITE = process.env.ALLANIME_SITE_URL || "https://allanime.to/"
const ALLANIME_API_ENDPOINT = process.env.ALLANIME_API_URL || "https://api.allanime.day/api"

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"

/** XOR-ключ из animdl (one_digit_symmetric_xor(56, ...)). */
export const ALLANIME_XOR_KEY = 56

export type AllAnimeTranslationType = "sub" | "dub" | "raw"

export interface AllAnimeShow {
  _id: string
  name: string
  nativeName?: string | null
  availableEpisodesDetail: Record<string, string[]>
}

export interface AllAnimeSubtitle {
  lang: string
  label?: string
  url: string
}

export interface AllAnimeSource {
  sourceName: string
  /** "mp4" — прямая ссылка на файл, "hls" — плейлист m3u8. */
  kind: "mp4" | "hls"
  url: string
  height?: number
  subtitles: AllAnimeSubtitle[]
  priority: number
}

export interface AllAnimeEpisodeInfo {
  episodeString: string
  notes?: string | null
  sources: AllAnimeSource[]
}

const SEARCH_GQL = `\
query(
        $search: SearchInput
        $limit: Int
        $page: Int
        $translationType: VaildTranslationTypeEnumType
        $countryOrigin: VaildCountryOriginEnumType
    ) {
    shows(
        search: $search
        limit: $limit
        page: $page
        translationType: $translationType
        countryOrigin: $countryOrigin
    ) {
        pageInfo {
            total
        }
        edges {
            _id
            name
            nativeName
            availableEpisodesDetail
        }
    }
}`

const EPISODE_GQL = `\
query ($showId: String!, $translationType: VaildTranslationTypeEnumType!, $episodeString: String!) {
    episode(
        showId: $showId
        translationType: $translationType
        episodeString: $episodeString
    ) {
        episodeString
        notes
        sourceUrls
    }
}`

/** Хэш persisted-запроса из animdl (fallback при rate-limit обычного запроса). */
const EPISODE_PERSISTED_HASH =
  "0ac09728ee9d556967c1a60bbcf55a9f58b4112006d09a258356aeafe1c33889"

function gqlHeaders(): Record<string, string> {
  return {
    Referer: ALLANIME_SITE,
    "User-Agent": BROWSER_UA,
    Accept: "application/json",
  }
}

interface GqlEnvelope {
  data?: Record<string, unknown> | null
  errors?: unknown
}

async function fetchGqlRaw(
  query: string,
  variables: Record<string, unknown>,
  extensions?: Record<string, unknown>,
): Promise<GqlEnvelope> {
  const params = new URLSearchParams({
    variables: JSON.stringify(variables),
  })
  if (extensions) {
    params.set("extensions", JSON.stringify(extensions))
  } else {
    params.set("query", query)
  }

  const response = await fetch(`${ALLANIME_API_ENDPOINT}?${params}`, {
    headers: gqlHeaders(),
    signal: AbortSignal.timeout(12_000),
    cache: "no-store" as RequestCache,
  })

  if (!response.ok) {
    throw new Error(`AllAnime API HTTP ${response.status}`)
  }

  return (await response.json()) as GqlEnvelope
}

/**
 * Повторение fetch_gql из animdl: обычный запрос, а при ошибке —
 * повтор через persistedQuery с хэшем из исходников animdl.
 */
async function fetchEpisodeGql(
  variables: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  try {
    const response = await fetchGqlRaw(EPISODE_GQL, variables)
    if (!response.errors && response.data) return response.data
  } catch {
    // падаем на persisted-запрос
  }

  const response = await fetchGqlRaw(EPISODE_GQL, variables, {
    persistedQuery: { version: 1, sha256Hash: EPISODE_PERSISTED_HASH },
  })
  if (response.errors || !response.data) return {}
  return response.data
}

export async function searchAllAnime(
  query: string,
  options: {
    translationType?: AllAnimeTranslationType
    limit?: number
    allowAdult?: boolean
  } = {},
): Promise<AllAnimeShow[]> {
  const limit = Math.min(Math.max(options.limit ?? 8, 1), 40)

  const data = await (async () => {
    const response = await fetchGqlRaw(
      SEARCH_GQL,
      {
        search: {
          allowAdult: options.allowAdult ?? false,
          allowUnknown: false,
          query,
        },
        limit,
        page: 1,
        ...(options.translationType ? { translationType: options.translationType } : {}),
        countryOrigin: "ALL",
      },
    )
    if (response.errors || !response.data) return {}
    return response.data
  })()

  const edges =
    ((data.shows as { edges?: unknown[] } | null)?.edges as
      | Record<string, unknown>[]
      | undefined) ?? []

  return edges
    .filter((edge): edge is Record<string, unknown> => Boolean(edge?._id))
    .map((edge) => ({
      _id: String(edge._id),
      name: String(edge.name ?? ""),
      nativeName: edge.nativeName ? String(edge.nativeName) : null,
      availableEpisodesDetail:
        (edge.availableEpisodesDetail as Record<string, string[]> | undefined) ?? {},
    }))
}

/**
 * Дешифровка ссылок AllAnime — побайтовый XOR с ключом 56 (см. animdl).
 */
export function decryptAllAnimeUrl(encoded: string): string {
  const bytes = Buffer.from(encoded, "hex")
  const decrypted = Buffer.alloc(bytes.length)
  for (let i = 0; i < bytes.length; i++) {
    decrypted[i] = bytes[i] ^ ALLANIME_XOR_KEY
  }
  return decrypted.toString("utf-8")
}

function toClockJsonUrl(apiEndpoint: string, sourcePath: string): string {
  // Точный аналог to_clock_json из animdl: последний сегмент пути
  // заменяется на clock.json, query сохраняется.
  const [pathPart, queryPart] = sourcePath.split("?")
  const segments = pathPart.split("/").filter(Boolean)
  if (segments.length > 0) {
    segments[segments.length - 1] = "clock.json"
  }
  const path = `/${segments.join("/")}`
  return `${apiEndpoint}${path}${queryPart ? `?${queryPart}` : ""}`
}

interface ClockLink {
  link?: string
  portData?: { streams?: { url?: string }[] }
  rawUrls?: {
    audios?: { url?: string }[]
    vids?: { height?: number | string; url?: string }[]
  }
  subtitles?: { src?: string; lang?: string; label?: string }[]
  priority?: number
}

interface ClockResponse {
  links?: ClockLink[]
}

let episodeIframeHeadCache: { value: string; expires: number } | null = null

async function getEpisodeIframeHead(): Promise<string> {
  if (episodeIframeHeadCache && episodeIframeHeadCache.expires > Date.now()) {
    return episodeIframeHeadCache.value
  }
  try {
    const response = await fetch(`${ALLANIME_SITE}getVersion`, {
      headers: gqlHeaders(),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    })
    const json = (await response.json()) as { episodeIframeHead?: string }
    const head = json.episodeIframeHead || ALLANIME_API_ENDPOINT
    episodeIframeHeadCache = { value: head, expires: Date.now() + 30 * 60_000 }
    return head
  } catch {
    return ALLANIME_API_ENDPOINT
  }
}

function parseClockLinks(
  sourceName: string,
  links: ClockLink[],
  priority: number,
): AllAnimeSource[] {
  const sources: AllAnimeSource[] = []
  const subtitles: AllAnimeSubtitle[] = []

  for (const streamData of links) {
    for (const subtitle of streamData.subtitles ?? []) {
      if (subtitle.src) {
        subtitles.push({
          lang: subtitle.lang || "en",
          label: subtitle.label,
          url: subtitle.src,
        })
      }
    }

    // Прямые mp4-дорожки (наилучший вариант для скачивания).
    if (streamData.rawUrls?.vids?.length) {
      for (const vid of streamData.rawUrls.vids) {
        if (!vid.url) continue
        const height = Number(vid.height) || undefined
        sources.push({
          sourceName,
          kind: "mp4",
          url: vid.url,
          height,
          subtitles: [],
          priority,
        })
      }
      continue
    }

    const url = streamData.link || streamData.portData?.streams?.[0]?.url
    if (url) {
      const isHls = url.includes(".m3u8")
      sources.push({
        sourceName,
        kind: isHls ? "hls" : "mp4",
        url,
        subtitles: [],
        priority,
      })
    }
  }

  // Субтитры относятся ко всему источнику — attaches to first source
  if (subtitles.length > 0 && sources.length > 0) {
    sources[0].subtitles = subtitles
  }

  return sources
}

/**
 * Возвращает нормализованные источники эпизода. Аналог extract_content из animdl,
 * но без распаковки embed-страниц (filemoon и т.п.) — только прямые mp4/HLS.
 */
export async function fetchAllAnimeEpisodeSources(
  showId: string,
  episode: number | string,
  translationType: AllAnimeTranslationType,
): Promise<AllAnimeEpisodeInfo | null> {
  const episodeString = String(episode)

  const data = await fetchEpisodeGql({
    showId,
    translationType,
    episodeString,
  })

  if (data.errors) return null

  const episodeInfo = (data.episode ?? null) as
    | { episodeString?: string; notes?: string; sourceUrls?: { sourceName?: string; sourceUrl?: string; priority?: number }[] }
    | null

  if (!episodeInfo?.sourceUrls?.length) return null

  const apiEndpoint = await getEpisodeIframeHead()

  const sorted = [...episodeInfo.sourceUrls].sort(
    (a, b) => (b.priority ?? 0) - (a.priority ?? 0),
  )

  const sources: AllAnimeSource[] = []

  for (const [index, source] of sorted.entries()) {
    let rawUrl = source.sourceUrl || ""
    if (!rawUrl) continue

    if (rawUrl.startsWith("--")) {
      try {
        rawUrl = decryptAllAnimeUrl(rawUrl.slice(2))
      } catch {
        continue
      }
    }

    if (rawUrl.startsWith("/")) {
      // Разворачиваем через clock.json (как в animdl).
      try {
        const clockUrl = toClockJsonUrl(apiEndpoint, rawUrl)
        const response = await fetch(clockUrl, {
          headers: { ...gqlHeaders(), Referer: ALLANIME_SITE },
          cache: "no-store",
          signal: AbortSignal.timeout(15_000),
        })
        const text = await response.text()
        if (text === "error" || text === "error no result") continue
        const json = JSON.parse(text) as ClockResponse
        if (!json.links?.length) continue
        sources.push(
          ...parseClockLinks(
            source.sourceName || "AllAnime",
            json.links,
            sorted.length - index,
          ),
        )
      } catch {
        continue
      }
    } else if (/^https?:\/\//.test(rawUrl)) {
      // Абсолютная ссылка: берём только если это явно файл/плейлист,
      // embed-страницы (filemoon и т.д.) пропускаем.
      const clean = rawUrl.split("#")[0]
      const isDirect = clean.includes(".m3u8") || clean.includes(".mp4")
      if (!isDirect) continue
      sources.push({
        sourceName: source.sourceName || "AllAnime",
        kind: clean.includes(".mp4") ? "mp4" : "hls",
        url: clean,
        subtitles: [],
        priority: sorted.length - index,
      })
    }
  }

  return {
    episodeString: episodeInfo.episodeString || episodeString,
    notes: episodeInfo.notes || null,
    sources,
  }
}

/**
 * Ищет тайтл и возвращает первый результат, у которого есть нужная серия
 * в нужном переводе. Запросы идут по очереди: ромадзи → русское название.
 */
export async function findShowForEpisode(
  queries: string[],
  episode: number,
  translationType: AllAnimeTranslationType,
): Promise<AllAnimeShow | null> {
  for (const query of queries) {
    if (!query) continue
    try {
      const shows = await searchAllAnime(query, {
        translationType,
        limit: 8,
      })
      const match =
        shows.find(
          (show) =>
            show.availableEpisodesDetail?.[translationType]?.includes(String(episode)),
        ) ?? null
      if (match) return match
    } catch {
      // источник может быть недоступен — пробуем следующий запрос
    }
  }
  return null
}
