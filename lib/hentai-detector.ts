import type { Anime } from "@/lib/shikimori"

/**
 * Определяет 18+ контент для страницы /watch.
 *
 * История: здесь сравнивался `anime.rating`, но в Anime это ЧИСЛО (оценка
 * Shikimori, parseFloat(score)), а не строковый рейтинг вида "rx"/"r_plus".
 * Условие не выполнялось никогда, и хентай/этти уходили в обычную выдачу.
 *
 * Теперь сигналы разделены на два уровня:
 *
 *  - `anime.isHentai` (ставит transformAnime через isHentaiShikimoriAnime) —
 *    строгая проверка для ВЫБОРА ПЛЕЕРА: только рейтинг rx/x и жанры
 *    хентая/эротики/додзинси.
 *  - `anime.isNsfw` — широкий флаг (rx + r_plus + хентай-жанры). Он влияет
 *    на каталог/поиск/sitemap, но НЕ на выбор плеера.
 *
 * Почему r_plus больше не хентай: `r_plus` в Shikimori — это «этти»
 * (фан-сервис, лёгкая эротика), а не порно. Такие тайтлы лежат в Kodik.
 * Например «Даже у студсовета есть косяки!» (Seitokai ni mo Ana wa Aru, 61578)
 * имеет рейтинг r_plus — раньше он из-за этого показывал хентай-плеер.
 */
export function isHentaiContent(anime: Anime): boolean {
  // Основной сигнал: строгая классификация из transformAnime.
  // `typeof === 'boolean'` важен: у undefined нужно падать дальше, а не
  // возвращать false (старые кэши и объекты, собранные вручную в тестах).
  if (typeof anime.isHentai === "boolean") return anime.isHentai

  // ВАЖНО: anime.isNsfw здесь намеренно не проверяется — он включает r_plus.

  // Строка из hentaiRatings ниже не содержит r_plus: это рейтинг этти,
  // а не хентая. Хентай = rx (и устаревшее x).
  const hentaiRatings = ['rx', 'x', 'r18', '18+']

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

  const hentaiKeywords = ['hentai', 'хентай', 'erotica', 'эротика', 'додзинси', 'doujinshi']

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
 *
 * Здесь граница ШИРЕ, чем у isHentaiContent: noindex ставится и на r_plus
 * (этти) — в индекс такие страницы тоже не пускаем.
 */
export function isNoIndexAnime(anime: Anime): boolean {
  if (isHentaiContent(anime)) return true
  if (anime.isNsfw) return true

  const noIndexRatings = ['r_plus', 'r+']
  if (anime.shikimoriRating && noIndexRatings.includes(anime.shikimoriRating.toLowerCase())) {
    return true
  }

  return false
}
