/**
 * Признаки обложки-заглушки.
 *
 * Важно отличать «картинка есть, но это серый прямоугольник Shikimori» от
 * «картинка не загрузилась»: первая отдаёт 200, поэтому onError не сработает
 * и восстановление надо запускать по виду URL.
 *
 * Пример, с которого всё началось: Steel Ball Run (id 61469) в API Shikimori
 * имеет `image.original = /assets/globals/missing_original.jpg`. На /watch
 * внешние источники отключены (экономия SSR), поэтому resolveBestPoster
 * возвращает `data:image/svg+xml;base64,…`.
 */
export function isPlaceholderPoster(url?: string | null): boolean {
  if (!url) return true
  const lower = url.toLowerCase()
  // Сгенерированная заглушка (generateArtPoster / generateFallbackPoster).
  if (lower.startsWith("data:")) return true
  if (lower.includes("/api/fallback-poster")) return true
  // Shikimori / прочие CDN: missing_original.jpg, placeholder.png, stub.webp…
  return ["missing", "stub", "placeholder", "default"].some((marker) => lower.includes(marker))
}

/** Стоит ли пробовать подобрать настоящую обложку через CoverProvider. */
export function shouldRecoverPoster(url?: string | null): boolean {
  return isPlaceholderPoster(url)
}
