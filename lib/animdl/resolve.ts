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
  let playback: AniLibriaPlayback | null = null
  try {
    playback = await findAniLibriaPlayback([title, originalTitle || ""], episode)
  } catch {
    return null
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

export async function resolveEpisodeSources(params: {
  title: string
  originalTitle?: string | null
  episode: number
}): Promise<EpisodeSources | null> {
  const episode = Math.max(1, Math.floor(params.episode))
  const key = cacheKey({ ...params, episode })

  const cached = sourcesCache.get(key)
  if (cached) {
    return cached.providerLabel ? cached : null
  }

  // 1. AniLibria — русская озвучка.
  try {
    const fromAnilibria = await resolveFromAnilibria(
      params.title,
      params.originalTitle ?? null,
      episode,
    )
    if (fromAnilibria) {
      sourcesCache.set(key, fromAnilibria)
      return fromAnilibria
    }
  } catch {
    // падаем дальше по цепочке
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
        sourcesCache.set(key, fromAllAnime)
        return fromAllAnime
      }
    } catch {
      // пробуем следующий вариант перевода
    }
  }

  // Ничего не нашли — кешируем негативный результат ненадолго,
  // чтобы не долбить источники на каждый клик.
  sourcesCache.set(key, NEGATIVE_CACHE_PLACEHOLDER, { ttl: 60_000 })
  return null
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
