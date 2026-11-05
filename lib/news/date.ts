/**
 * Работа с датами новостей.
 *
 * Источники (Shikimori, Jikan/MAL, custom_news) отдают дату строкой
 * «ДД.ММ.ГГГГ». На сервере и в браузере она должна разбираться одинаково,
 * поэтому:
 *  - разбор строки со точками идёт через UTC (new Date('YYYY-MM-DD') и
 *    getUTC* геттеры), иначе в часовом поясе UTC−5 «05.11.2026» превращается
 *    в 4 ноября и лента начинает группировать новости по вчерашнему числу;
 *  - «Сегодня/Вчера» считаются по Москве (UTC+3) — это целевая аудитория
 *    сайта, и на сервере, и на клиенте получается один и тот же результат
 *    (значит, нет рассинхрона гидратации).
 */

const DATE_KEY_RE = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/

const pad = (value: number): string => String(value).padStart(2, '0')

/** Разбирает «ДД.ММ.ГГГГ» (или ISO-строку) в UTC-метку. 0 — если разобрать нельзя. */
export function parseNewsTimestamp(date: string | undefined | null): number {
  if (!date) return 0

  const keyMatch = DATE_KEY_RE.exec(date.trim())
  if (keyMatch) {
    const [, day, month, year] = keyMatch
    return new Date(`${year}-${month}-${day}T00:00:00Z`).getTime() || 0
  }

  const parsed = new Date(date).getTime()
  return Number.isFinite(parsed) ? parsed : 0
}

/** Ключ группировки «ДД.ММ.ГГГГ» в UTC — стабилен между сервером и клиентом. */
export function getNewsDateKey(date: string | number | undefined | null): string {
  if (typeof date === 'number' && date > 0) {
    const parsed = new Date(date)
    return `${pad(parsed.getUTCDate())}.${pad(parsed.getUTCMonth() + 1)}.${parsed.getUTCFullYear()}`
  }

  const keyMatch = DATE_KEY_RE.exec(String(date ?? '').trim())
  if (keyMatch) {
    const [, day, month, year] = keyMatch
    return `${pad(Number(day))}.${pad(Number(month))}.${year}`
  }

  const timestamp = parseNewsTimestamp(typeof date === 'string' ? date : undefined)
  if (!timestamp) return ''
  const parsed = new Date(timestamp)
  return `${pad(parsed.getUTCDate())}.${pad(parsed.getUTCMonth() + 1)}.${parsed.getUTCFullYear()}`
}

/** Дата для <time datetime="YYYY-MM-DD"> (без времени, чтобы не зависеть от TZ). */
export function newsDateToIsoDate(date: string | number | undefined | null): string | undefined {
  const timestamp = typeof date === 'number' ? date : parseNewsTimestamp(date)
  if (!timestamp) return undefined
  const parsed = new Date(timestamp)
  return `${parsed.getUTCFullYear()}-${pad(parsed.getUTCMonth() + 1)}-${pad(parsed.getUTCDate())}`
}

/** Полная ISO-метка для schema.org (datePublished / dateModified). */
export function newsDateToIso(date: string | number | undefined | null): string | undefined {
  const timestamp = typeof date === 'number' ? date : parseNewsTimestamp(date)
  return timestamp > 0 ? new Date(timestamp).toISOString() : undefined
}

/** Ключ «ДД.ММ.ГГГГ» для Москвы — сдвиг на 3 часа, без перехода на летнее время. */
export function getMoscowDateKey(offsetDays = 0): string {
  const shifted = new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000)
  return `${pad(shifted.getUTCDate())}.${pad(shifted.getUTCMonth() + 1)}.${shifted.getUTCFullYear()}`
}

/**
 * Подпись для разделителя дат: «Сегодня», «Вчера» или «5 ноября 2026».
 * Время указано по UTC, чтобы подпись не зависела от часового пояса.
 */
export function formatNewsDateLabel(date: string | number | undefined | null): string {
  const key = getNewsDateKey(date)
  if (!key) return 'Без даты'

  if (key === getMoscowDateKey(0)) return 'Сегодня'
  if (key === getMoscowDateKey(-1)) return 'Вчера'

  const timestamp = parseNewsTimestamp(key)
  if (!timestamp) return key

  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(timestamp))
}

/** «1 новость», «2 новости», «12 новостей» — для счётчика в разделителе дат. */
export function pluralizeNews(count: number): string {
  const mod10 = Math.abs(count) % 10
  const mod100 = Math.abs(count) % 100
  if (mod10 === 1 && mod100 !== 11) return `${count} новость`
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${count} новости`
  return `${count} новостей`
}
