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
 *    строгая проверка для ВЫБОРА ПЛЕЕРА: решает СТРОКОВЫЙ рейтинг Shikimori.
 *    Непустой рейтинг ≠ rx/x — не хентай; жанровая эвристика работает
 *    только когда рейтинга нет вовсе.
 *  - `anime.isNsfw` — широкий флаг (rx + r_plus + хентай-жанры). Он влияет
 *    на каталог/поиск/sitemap, но НЕ на выбор плеера.
 *
 * Почему r_plus больше не хентай: `r_plus` в Shikimori — это «этти»
 * (фан-сервис, лёгкая эротика), а не порно. Такие тайтлы лежат в Kodik.
 * Например «Даже у студсовета есть косяки!» (Seitokai ni mo Ana wa Aru, 61578)
 * имеет рейтинг r_plus — раньше он из-за этого показывал хентай-плеер.
 * Второй случай той же болезни по жанру: «Маг-целитель: Новый старт»
 * (Redo of Healer, 40750) — r_plus + жанр «Эротика» (539). Жанр при
 * непустом рейтинге больше не перебивает рейтинг: тайтл есть в Kodik и
 * играет обычным плеером.
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
 * Граница шире, чем у isHentaiContent: noindex ставится и на этти. Но этти —
 * это НЕ любой r_plus. Shikimori ставит r_plus классике вроде «Ковбоя Бибопа»
 * и «Код Гиаса», и раньше вся она уходила в noindex (сотни адресов в отчёте
 * Search Console «Индексирование запрещено тегом noindex»). Теперь r_plus
 * закрывается только с жанром «Этти» или без разметки жанров — то же
 * правило, что в isAnimeSafe (anime.isNsfw), см. isEcchiRPlus.
 */
export function isNoIndexAnime(anime: Anime): boolean {
  if (isHentaiContent(anime)) return true

  // Основной сигнал — isNsfw из transformAnime (isAnimeSafe с тем же
  // правилом для r_plus). typeof важен: undefined → падаем на фолбэк.
  if (typeof anime.isNsfw === 'boolean') return anime.isNsfw

  // Фолбэк для объектов без isNsfw (старые кэши, ручная сборка): у Anime
  // жанры — русские названия, id в genreIds.
  const rating = (anime.shikimoriRating || '').toLowerCase()
  if (rating === 'r_plus' || rating === 'r+') {
    const genres = (anime.genres || []).filter(Boolean)
    if (genres.length === 0) return true
    return genres.some((g) => {
      const name = g.toLowerCase()
      return name === 'этти' || name === 'ecchi' || anime.genreIds?.[g] === 9
    })
  }

  return false
}
