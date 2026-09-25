/**
 * Единый источник правды для ЧПУ-адресов страниц аниме: /watch/{id}-{slug}.
 *
 * Модуль без зависимостей — его импортируют и серверные компоненты, и клиентские
 * карточки, и middleware (edge runtime). Любое изменение формата slug'а меняет
 * канонические URL всех страниц, поэтому правьте осторожно (и тесты рядом).
 */

const RU_TO_LAT: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo", ж: "zh",
  з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o",
  п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "kh", ц: "ts",
  ч: "ch", ш: "sh", щ: "shch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
}

/** Убирает вшитый в конец названия год: «Наруто (2002)» → «Наруто». */
export function cleanAnimeTitle(title: string | null | undefined): string {
  return (title || "").replace(/\s*\(\d{4}\)$/, "").trim()
}

/** Транслитерация + нормализация в slug: «Путешествие к бессмертию 5» → «puteshestvie-k-bessmertiyu-5». */
export function slugifyAnimeTitle(title: string | null | undefined): string {
  return cleanAnimeTitle(title)
    .toLowerCase()
    .split("")
    .map((char) => RU_TO_LAT[char] ?? char)
    .join("")
    .replace(/[^a-z0-9]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
}

/** decodeURIComponent, который не падает на «битых» последовательностях вроде «%E0». */
export function safeDecodeSegment(segment: string): string {
  try {
    return decodeURIComponent(segment)
  } catch {
    return segment
  }
}

/** Числовой ID из сегмента маршрута: «48820-devochka-...» → «48820». */
export function parseWatchParam(param: string): string {
  return safeDecodeSegment(param).split("-")[0]
}

/** Канонический сегмент маршрута: «48820-devochka-...» (или просто «48820», если slug пустой). */
export function getWatchSegment(id: string | number, title?: string | null): string {
  const slug = slugifyAnimeTitle(title)
  return slug ? `${id}-${slug}` : String(id)
}

/**
 * Относительная ссылка на страницу аниме в каноническом виде.
 * Всегда передавайте title, если он известен — иначе получится короткий URL,
 * который middleware отдаст через 301 (лишний редирект для пользователя и бота).
 */
export function getWatchPath(
  id: string | number,
  title?: string | null,
  episode?: number | string | null,
): string {
  const ep = episode !== undefined && episode !== null && `${episode}` !== "" ? Number(episode) : NaN
  const query = Number.isFinite(ep) && ep > 0 ? `?episode=${ep}` : ""
  return `/watch/${getWatchSegment(id, title)}${query}`
}
