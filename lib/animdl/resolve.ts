/**
 * Единый резолвер источников эпизода для запасного плеера и кнопки «Скачать».
 *
 * Цепочка (в порядке приоритета):
 *   1. AniLibria — русская озвучка, HLS (api v3).
 *   2. AllAnime (порт провайдера animdl) — dub.
 *   3. AllAnime — sub (субтитры).
 *
 * Результаты кешируются в памяти процесса на 10 минут, но подписанные
 * прокси-ссылки генерируются заново при каждом запросе (см. proxy-url.ts).
 */

import { LRUCache } from "lru-cache"
import {
  fetchAllAnimeEpisodeSources,
  findShowForEpisode,
  type AllAnimeSource,
} from "@/lib/animdl/allanime"
import {
  findAniLibriaPlayback,
  getAniLibriaTorrentDownloadUrl,
  normalizeTitleForMatch,
  type AniLibriaPlayback,
} from "@/lib/anilibria/api"

export type EpisodeProvider = "anilibria" | "allanime"

export interface RawQualitySource {
  label: string
  kind: "hls" | "mp4"
  url: string
  /** Referer, с которым CDN отдаёт файл. */
  referer: string
  height?: number
}

export interface RawSubtitleSource {
  lang: string
  label: string
  url: string
  referer: string
}

export interface RawTorrentOption {
  id: number
  quality: string
  series: string
  sizeString: string
  seeders: number
  leechers: number
  torrentUrl: string
  magnet: string | null
}

export interface EpisodeSources {
  provider: EpisodeProvider
  /** Метка источника для бейджа в плеере. */
  providerLabel: string
  /** true — русская озвучка; false — иностранный дубляж/субтитры. */
  ruDub: boolean
  matchedTitle: string
  qualities: RawQualitySource[]
  subtitles: RawSubtitleSource[]
  torrents: RawTorrentOption[]
  notes: string | null
  showId: string | null
  translationType: string | null
}

const ANILIBRIA_REFERER = "https://www.anilibria.tv/"

const sourcesCache = new LRUCache<string, EpisodeSources>({
  max: 500,
  ttl: 10 * 60_000,
})

function cacheKey(params: {
  title: string
  originalTitle?: string | null
  episode: number
}): string {
  const normalized = normalizeTitleForMatch(
    `${params.originalTitle || ""} ${params.title}`,
  )
  return `${normalized}:${params.episode}`
}

async function resolveFromAnilibria(
  title: string,
  originalTitle: string | null,
  episode: number,
): Promise<EpisodeSources | null> {
  let playback: AniLibriaPlayback | null
  try {
    playback = await findAniLibriaPlayback([title, originalTitle || ""], episode)
  } catch (error) {
    console.warn("[animdl] AniLibria lookup failed:", error)
    throw error instanceof Error ? error : new Error(String(error))
  }
  if (!playback || playback.qualities.length === 0) return null

  return {
    provider: "anilibria",
    providerLabel: "AniLibria",
    ruDub: true,
    matchedTitle: playback.title,
    qualities: playback.qualities.map((quality) => ({
      label: quality.label,
      kind: "hls" as const,
      url: quality.url,
      referer: ANILIBRIA_REFERER,
    })),
    subtitles: [],
    torrents: playback.torrents.map((torrent) => ({
      id: torrent.torrent_id,
      quality: torrent.quality?.string || "Torrent",
      series: torrent.series?.string || "",
      sizeString: formatBytes(torrent.total_size),
      seeders: torrent.seeders ?? 0,
      leechers: torrent.leechers ?? 0,
      torrentUrl: getAniLibriaTorrentDownloadUrl(torrent),
      magnet: torrent.magnet || null,
    })),
    notes: null,
    showId: String(playback.titleId),
    translationType: "ru",
  }
}

async function resolveFromAllAnime(
  title: string,
  originalTitle: string | null,
  episode: number,
  translationType: "dub" | "sub",
): Promise<EpisodeSources | null> {
  const queries = [originalTitle, title].filter(Boolean) as string[]
  const show = await findShowForEpisode(queries, episode, translationType)
  if (!show) return null

  const episodeInfo = await fetchAllAnimeEpisodeSources(
    show._id,
    episode,
    translationType,
  )
  if (!episodeInfo || episodeInfo.sources.length === 0) return null

  // Отбираем только прямые источники, дедуп по URL.
  const seen = new Set<string>()
  const qualities: RawQualitySource[] = []
  const subtitles: RawSubtitleSource[] = []
  const referer = process.env.ALLANIME_SITE_URL || "https://allanime.to/"

  for (const source of pickBestSources(episodeInfo.sources)) {
    if (seen.has(source.url)) continue
    seen.add(source.url)
    qualities.push({
      label: source.height ? `${source.height}p` : source.sourceName,
      kind: source.kind,
      url: source.url,
      referer,
      height: source.height,
    })
  }

  if (qualities.length === 0) return null

  const subtitleSeen = new Set<string>()
  for (const source of episodeInfo.sources) {
    for (const subtitle of source.subtitles) {
      if (subtitleSeen.has(subtitle.url)) continue
      subtitleSeen.add(subtitle.url)
      subtitles.push({
        lang: subtitle.lang || "en",
        label: subtitle.label || subtitle.lang || "Субтитры",
        url: subtitle.url,
        referer,
      })
    }
  }

  return {
    provider: "allanime",
    providerLabel: "AllAnime",
    ruDub: false,
    matchedTitle: show.name,
    qualities,
    subtitles,
    torrents: [],
    notes: episodeInfo.notes ?? null,
    showId: show._id,
    translationType,
  }
}

/**
 * Для воспроизведения приоритет: адаптивный HLS выше одиночного mp4,
 * внутри одного типа — выше приоритет из AllAnime (priority уже в порядке сортировки).
 */
function pickBestSources(sources: AllAnimeSource[]): AllAnimeSource[] {
  const hls = sources.filter((source) => source.kind === "hls")
  const mp4 = sources.filter((source) => source.kind === "mp4")
  return [...hls, ...mp4]
}

/** Диагностика одного шага цепочки (попадает в логи и в not-found ответ API). */
export interface ResolveAttempt {
  provider: EpisodeProvider
  translationType?: string
  query?: string
  ok: boolean
  /** "no-match" — источник жив, но тайтла/серии нет; иначе текст ошибки. */
  reason?: string
}

export interface ResolveResult {
  sources: EpisodeSources | null
  attempts: ResolveAttempt[]
}

export async function resolveEpisodeSourcesDetailed(params: {
  title: string
  originalTitle?: string | null
  episode: number
  /** true — игнорировать негативный кеш (кнопка «Обновить»). */
  refresh?: boolean
}): Promise<ResolveResult> {
  const episode = Math.max(1, Math.floor(params.episode))
  const key = cacheKey({ ...params, episode })
  const attempts: ResolveAttempt[] = []

  if (!params.refresh) {
    const cached = sourcesCache.get(key)
    if (cached) {
      return { sources: cached.providerLabel ? cached : null, attempts: [] }
    }
  }

  const cache = (sources: EpisodeSources | null) => {
    if (sources) {
      sourcesCache.set(key, sources)
    } else {
      // Негативный результат кешируем ненадолго, чтобы не долбить источники.
      sourcesCache.set(key, NEGATIVE_CACHE_PLACEHOLDER, { ttl: 60_000 })
    }
  }

  // 1. AniLibria — русская озвучка.
  try {
    const fromAnilibria = await resolveFromAnilibria(
      params.title,
      params.originalTitle ?? null,
      episode,
    )
    if (fromAnilibria) {
      attempts.push({ provider: "anilibria", query: params.title, ok: true })
      cache(fromAnilibria)
      return { sources: fromAnilibria, attempts }
    }
    attempts.push({
      provider: "anilibria",
      query: params.title,
      ok: false,
      reason: "no-match",
    })
  } catch (error) {
    attempts.push({
      provider: "anilibria",
      query: params.title,
      ok: false,
      reason: error instanceof Error ? error.message : String(error),
    })
  }

  // 2. AllAnime dub → 3. AllAnime sub.
  for (const translationType of ["dub", "sub"] as const) {
    try {
      const fromAllAnime = await resolveFromAllAnime(
        params.title,
        params.originalTitle ?? null,
        episode,
        translationType,
      )
      if (fromAllAnime) {
        attempts.push({
          provider: "allanime",
          translationType,
          query: fromAllAnime.matchedTitle,
          ok: true,
        })
        cache(fromAllAnime)
        return { sources: fromAllAnime, attempts }
      }
      attempts.push({
        provider: "allanime",
        translationType,
        query: params.originalTitle || params.title,
        ok: false,
        reason: "no-match",
      })
    } catch (error) {
      attempts.push({
        provider: "allanime",
        translationType,
        query: params.originalTitle || params.title,
        ok: false,
        reason: error instanceof Error ? error.message : String(error),
      })
    }
  }

  console.warn(
    "[animdl] цепочка источников пуста:",
    attempts.map(a => `${a.provider}${a.translationType ? `/${a.translationType}` : ""}: ${a.reason}`).join("; "),
  )
  cache(null)
  return { sources: null, attempts }
}

export async function resolveEpisodeSources(params: {
  title: string
  originalTitle?: string | null
  episode: number
  refresh?: boolean
}): Promise<EpisodeSources | null> {
  const { sources } = await resolveEpisodeSourcesDetailed(params)
  return sources
}

const NEGATIVE_CACHE_PLACEHOLDER: EpisodeSources = {
  provider: "anilibria" as EpisodeProvider,
  providerLabel: "",
  ruDub: false,
  matchedTitle: "",
  qualities: [],
  subtitles: [],
  torrents: [],
  notes: null,
  showId: null,
  translationType: null,
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return ""
  const units = ["Б", "КБ", "МБ", "ГБ", "ТБ"]
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / 1024 ** index
  const digits = value >= 10 || index === 0 || Number.isInteger(value) ? 0 : 1
  return `${value.toFixed(digits)} ${units[index]}`
}

/**
 * Готовая команда animdl CLI для ручной загрузки тайтла.
 */
export function buildAnimdlCliCommand(params: {
  title: string
  originalTitle?: string | null
  episode: number
  rangeEnd?: number
}): string {
  // animdl лучше всего ищет по латинице; если ромадзи нет — берём русское.
  const query = (params.originalTitle || params.title).replace(/"/g, "")
  const episodeArg =
    params.rangeEnd && params.rangeEnd > params.episode
      ? `${params.episode}-${params.rangeEnd}`
      : String(params.episode)
  return `animdl download "search:${query}" -e ${episodeArg} --quality best`
}

/**
 * Безопасное имя файла для Content-Disposition.
 */
export function sanitizeFilename(name: string): string {
  return (
    name
      .replace(/[\\/:*?"<>|]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 120) || "video"
  )
}
