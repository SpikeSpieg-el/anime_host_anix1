/**
 * Хелперы для безопасной генерации sitemap.xml.
 *
 * Важно: Next.js рендерит metadata-route (`app/sitemap.ts`) сам и подставляет
 * значения в разметку БЕЗ XML-экранирования (см.
 * next/src/build/webpack/loaders/metadata/resolve-route-data.ts:
 * `content += `<loc>${item.url}</loc>\n``). Поэтому любой «сырой» `&` в URL
 * постера или в названии мгновенно ломает весь файл целиком: Яндекс отвечает
 * «Ошибка разбора» и выявляет 0 страниц, хотя остальные 300 URL корректны.
 *
 * Здесь: (а) экранирование значений для XML и (б) отбраковка URL/дат, которые
 * не имеют смысла в карте сайта (пробелы, кириллица, битые %-escape, слишком
 * длинные адреса, даты из будущего).
 */

const XML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;',
}

/** Экранирует значение для вставки в текст XML-элемента. */
export function escapeXml(value: string | null | undefined): string {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => XML_ESCAPES[ch])
}

/**
 * Лимит длины URL. Валидатор Яндекса ругается уже на 1024 символа
 * (у Google лимит 2048), поэтому ориентируемся на более строгий.
 */
export const MAX_SITEMAP_URL_LENGTH = 1024

/**
 * Годится ли URL для sitemap: только абсолютный http(s), только ASCII,
 * без пробелов/кавычек/угловых скобок и с корректными %-последовательностями.
 */
export function isSitemapSafeUrl(value: string | null | undefined): boolean {
  if (!value) return false
  const url = String(value).trim()
  if (!url || url.length > MAX_SITEMAP_URL_LENGTH) return false
  // ASCII-only: кириллица и прочий юникод в URL должны быть percent-encoded.
  if (!/^[\x20-\x7E]+$/.test(url)) return false
  // Только http/https и есть хост.
  if (!/^https?:\/\/[^/\s]+/i.test(url)) return false
  // Управляющие символы, пробелы, кавычки, угловые скобки, бэкслеши.
  if (/[\s"'<>\\]/.test(url)) return false
  // Каждый % обязан открывать валидную escape-последовательность.
  if (/%(?![0-9A-Fa-f]{2})/.test(url)) return false
  return true
}

/**
 * Приводит lastModified к пригодной для sitemap дате:
 * — некорректные/пустые даты отбрасываются (иначе `toISOString()` бросает
 *   RangeError и весь маршрут отдаёт 500);
 * — дата из будущего подрезается до времени сборки (поисковики считают
 *   future-lastmod мусором).
 * Возвращает null, если дата непригодна — тогда тег просто не выводим.
 */
export function clampLastmod(
  value: Date | string | number | null | undefined,
  now: Date,
): Date | null {
  if (value === null || value === undefined || value === '') return null
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.getTime() > now.getTime() ? now : date
}
