/**
 * Утилиты для HLS-прокси: переписывание ссылок в m3u8 так, чтобы сегменты
 * и дочерние плейлисты тоже шли через /api/animdl/hls (с Referer).
 * Функция чистая и покрыта юнит-тестами.
 */

const URI_ATTRIBUTE_REGEX = /URI="([^"]+)"/g

/**
 * Переписывает плейлист: каждый URI (сегменты, дочерние плейлисты, ключи,
 * альтернативные дорожки, init-сегменты) резолвится против baseUrl и
 * оборачивается через переданный wrap().
 */
export function rewriteHlsPlaylist(
  manifest: string,
  baseUrl: string,
  wrap: (absoluteUrl: string) => string,
): string {
  const rewriteUri = (raw: string): string => {
    try {
      const absolute = new URL(raw, baseUrl).toString()
      return wrap(absolute)
    } catch {
      return raw
    }
  }

  return manifest
    .split("\n")
    .map((line) => {
      const trimmed = line.trim()
      if (!trimmed) return line

      if (trimmed.startsWith("#")) {
        // Теги с URI="...": EXT-X-KEY, EXT-X-MEDIA, EXT-X-MAP, EXT-X-I-FRAME-STREAM-INF и др.
        if (trimmed.includes('URI="')) {
          return trimmed.replace(URI_ATTRIBUTE_REGEX, (_match, uri: string) => {
            return `URI="${rewriteUri(uri)}"`
          })
        }
        return line
      }

      // Обычная строка = ссылка на сегмент или дочерний плейлист.
      return rewriteUri(trimmed)
    })
    .join("\n")
}

/**
 * Похоже ли это на m3u8-плейлист (по содержимому, когда CDN не ставит Content-Type).
 */
export function looksLikeHlsPlaylist(body: string): boolean {
  const head = body.slice(0, 512).trimStart()
  return head.startsWith("#EXTM3U") || head.startsWith("#EXT-X-")
}

/**
 * Похоже ли это на бинарный сегмент/файл (не плейлист) по Content-Type.
 */
export function isHlsPlaylistContentType(contentType: string | null): boolean {
  if (!contentType) return false
  const normalized = contentType.toLowerCase()
  return (
    normalized.includes("mpegurl") ||
    normalized.includes("vnd.apple") ||
    normalized.includes("playlist")
  )
}
