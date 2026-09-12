/**
 * Серверный слой между резолвером и API-роутами /api/animdl/*:
 * превращает «сырые» источники в JSON с подписанными прокси-ссылками.
 */

import { createSignedProxyUrl } from "@/lib/animdl/proxy-url"
import {
  sanitizeFilename,
  type EpisodeSources,
} from "@/lib/animdl/resolve"

const PROXY_TTL_SECONDS = 12 * 3600

export interface ApiQuality {
  label: string
  kind: "hls" | "mp4"
  /** Для воспроизведения в плеере (без Content-Disposition). */
  playUrl: string
  /** Для скачивания (mp4 — attachment; hls — переписанный плейлист). */
  downloadUrl: string | null
  height?: number
}

export interface ApiSubtitle {
  lang: string
  label: string
  url: string
}

export interface ApiTorrent {
  id: number
  quality: string
  series: string
  size: string
  seeders: number
  leechers: number
  url: string
  magnet: string | null
}

export function episodeBaseName(title: string, episode: number): string {
  return sanitizeFilename(`${title} — серия ${episode}`)
}

export function buildApiQualities(
  sources: EpisodeSources,
  episode: number,
): ApiQuality[] {
  return sources.qualities.map((quality) => {
    const base = episodeBaseName(sources.matchedTitle || "anime", episode)

    if (quality.kind === "mp4") {
      return {
        label: quality.label,
        kind: "mp4" as const,
        playUrl: createSignedProxyUrl("file", quality.url, quality.referer, {
          ttlSeconds: PROXY_TTL_SECONDS,
        }),
        downloadUrl: createSignedProxyUrl("file", quality.url, quality.referer, {
          ttlSeconds: PROXY_TTL_SECONDS,
          download: true,
          filename: `${base} (${quality.label}).mp4`,
        }),
        height: quality.height,
      }
    }

    return {
      label: quality.label,
      kind: "hls" as const,
      playUrl: createSignedProxyUrl("hls", quality.url, quality.referer, {
        ttlSeconds: PROXY_TTL_SECONDS,
      }),
      // Плейлист, переписанный прокси, открывается в VLC/yt-dlp/animdl:
      // все сегменты внутри тоже идут через наш прокси с Referer.
      downloadUrl: createSignedProxyUrl("hls", quality.url, quality.referer, {
        ttlSeconds: PROXY_TTL_SECONDS,
        download: true,
        filename: `${base} (${quality.label}).m3u8`,
      }),
      height: quality.height,
    }
  })
}

export function buildApiSubtitles(sources: EpisodeSources): ApiSubtitle[] {
  return sources.subtitles.map((subtitle) => ({
    lang: subtitle.lang,
    label: subtitle.label,
    url: createSignedProxyUrl("file", subtitle.url, subtitle.referer, {
      ttlSeconds: PROXY_TTL_SECONDS,
    }),
  }))
}

export function buildApiTorrents(sources: EpisodeSources): ApiTorrent[] {
  return sources.torrents.slice(0, 8).map((torrent) => ({
    id: torrent.id,
    quality: torrent.quality,
    series: torrent.series,
    size: torrent.sizeString,
    seeders: torrent.seeders,
    leechers: torrent.leechers,
    url: createSignedProxyUrl("torrent", torrent.torrentUrl, "https://www.anilibria.tv/", {
      ttlSeconds: PROXY_TTL_SECONDS,
      download: true,
      filename: sanitizeFilename(
        `anilibria-${torrent.id} ${torrent.quality}.torrent`,
      ),
    }),
    magnet: torrent.magnet,
  }))
}
