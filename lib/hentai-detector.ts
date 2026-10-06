import type { Anime } from "@/lib/shikimori"

/**
 * Определяет 18+ контент для страницы /watch.
 *
 * Раньше здесь сравнивался `anime.rating`, но в Anime это ЧИСЛО (оценка
 * Shikimori, parseFloat(score)), а не строковый рейтинг вида "rx"/"r_plus".
 * Условие не выполнялось никогда, и хентай/этти уходили в обычную выдачу.
 *
 * Теперь основной сигнал — `anime.isNsfw`, который выставляет transformAnime
 * на основе строкового рейтинга Shikimori и жанров 12/33/34 (см. isAnimeSafe).
 */
export function isHentaiContent(anime: Anime): boolean {
  if (anime.isNsfw) return true

  const hentaiRatings = ['rx', 'x', 'r_plus', 'r+', 'r18', '18+']

  // Строковый рейтинг Shikimori (основной сигнал после transformAnime).
  if (anime.shikimoriRating && hentaiRatings.includes(anime.shikimoriRating.toLowerCase())) {
    return true
  }

  // Совместимость: в Anime поле rating — это ЧИСЛО (оценка), поэтому сюда
  // попадает только если объект собран вручную (тесты, старые кэши), где
  // rating проставлен строковым рейтингом.
  if (typeof anime.rating === 'string') {
    if (hentaiRatings.includes((anime.rating as unknown as string).toLowerCase())) return true
  }

  const hentaiKeywords = ['hentai', 'хентай', 'erotica', 'эротика']

  // Проверяем жанры на наличие хентай-ключевых слов
  if (anime.genres) {
    const hasHentaiGenre = anime.genres.some(genre =>
      hentaiKeywords.some(keyword => (genre || '').toLowerCase().includes(keyword))
    )
    if (hasHentaiGenre) return true
  }

  // Проверяем название и описание
  const titleAndDesc = `${anime.title} ${anime.originalTitle} ${anime.description}`.toLowerCase()
  if (['hentai', 'хентай'].some(keyword => titleAndDesc.includes(keyword))) {
    return true
  }

  // Специальные ID для теста (совпадает с логикой выбора плеера)
  if (['10851'].includes(anime.id)) {
    return true
  }

  return false
}

/**
 * Помечать ли страницу тайтла как noindex.
 *
 * NSFW-тайтлы остаются доступными пользователям, но не попадают в поиск:
 * индексация 18+ страниц на общем домене роняет весь сайт в SafeSearch
 * и мешает ранжированию обычных тайтлов.
 */
export function isNoIndexAnime(anime: Anime): boolean {
  return isHentaiContent(anime)
}
