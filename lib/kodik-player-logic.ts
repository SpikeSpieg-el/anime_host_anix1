/**
 * Чистая логика плеера Kodik (без React, без DOM).
 *
 * Здесь живут два набора правил, которые раньше были зашиты прямо в
 * `components/watch/kodik-player.tsx` и давали два заметных бага:
 *
 *  1. Плашка «Следующая серия» вылезала в самом начале видео —
 *     событие `...ended` от преролла и «мусорные» postMessage-сообщения
 *     принимались за конец серии без проверки времени воспроизведения.
 *  2. Кнопка вела на несуществующую серию — Shikimori отдаёт, например,
 *     12 серий, а в конкретной озвучке их только 5.
 *
 * Вынесено в отдельный модуль, чтобы правила можно было покрыть тестами.
 */

/* ------------------------------------------------------------------ */
/* Доступность серий                                                   */
/* ------------------------------------------------------------------ */

export interface KodikSeasonLite {
  link?: string
  episodes?: Record<string, string> | null
}

export type KodikSeasonsMap = Record<string, KodikSeasonLite> | null | undefined

export interface KodikTranslationEpisodes {
  seasons?: KodikSeasonsMap
  episodesCount?: number | null
}

function toPositiveInt(value: unknown): number | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim()
    if (!trimmed) return undefined
    const parsed = Number(trimmed)
    return Number.isFinite(parsed) ? toPositiveInt(parsed) : undefined
  }
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined
  const int = Math.floor(value)
  return int > 0 ? int : undefined
}

function seasonEpisodeNumbers(season: KodikSeasonLite | null | undefined): number[] {
  const episodes = season?.episodes
  if (!episodes || typeof episodes !== "object") return []

  const numbers: number[] = []
  for (const key of Object.keys(episodes)) {
    const num = toPositiveInt(key)
    if (num !== undefined) numbers.push(num)
  }
  return numbers
}

/**
 * Максимальный номер серии в материале Kodik.
 *
 * Плеер нумерует серии внутри сезона (`?season=2&episode=5`), поэтому:
 *  - если сезон известен — берём максимум именно по нему;
 *  - если неизвестен — максимум по всем сезонам материала
 *    (это уже сильно точнее, чем `episodes_count`, который Kodik отдаёт
 *    суммарно по всем сезонам).
 */
export function getMaxEpisodeFromSeasons(
  seasons: KodikSeasonsMap,
  season?: number | null
): number | undefined {
  if (!seasons || typeof seasons !== "object") return undefined

  const wantedSeason = toPositiveInt(season ?? undefined)
  const keys = wantedSeason !== undefined ? [String(wantedSeason)] : Object.keys(seasons)

  let max: number | undefined
  for (const key of keys) {
    const numbers = seasonEpisodeNumbers(seasons[key])
    for (const num of numbers) {
      if (max === undefined || num > max) max = num
    }
  }
  return max
}

/**
 * Сколько серий реально есть в выбранной озвучке.
 * Берём минимум из `seasons` и `episodes_count` — оба сигнала Kodik
 * периодически врёт по отдельности, вместе они надёжнее.
 */
export function getTranslationMaxEpisode(
  translation?: KodikTranslationEpisodes | null,
  season?: number | null
): number | undefined {
  if (!translation) return undefined

  const fromSeasons = getMaxEpisodeFromSeasons(translation.seasons, season)
  const fromCount = toPositiveInt(translation.episodesCount)

  if (fromSeasons === undefined) return fromCount
  if (fromCount === undefined) return fromSeasons
  return Math.min(fromSeasons, fromCount)
}

export interface MaxEpisodeSources {
  /** Граница выбранной озвучки (`seasons` + `episodes_count`). */
  translationMaxEpisode?: number
  /** Сколько серий реально вышло по данным Shikimori. */
  siteMaxEpisode?: number
}

/**
 * Итоговая граница доступных серий.
 *
 * Берём самый строгий из известных сигналов: если Shikimori говорит
 * «12 серий», а в озвучке только 5 — вернём 5. Если ни один источник
 * ничего не знает — `undefined` (и кнопку показывать нельзя).
 */
export function resolveMaxEpisode(sources: MaxEpisodeSources): number | undefined {
  const candidates = [
    toPositiveInt(sources.translationMaxEpisode),
    toPositiveInt(sources.siteMaxEpisode),
  ].filter((value): value is number => value !== undefined)

  if (candidates.length === 0) return undefined
  return Math.min(...candidates)
}

/**
 * Есть ли следующая серия.
 *
 * Важно: при неизвестной границе возвращаем `false`.
 * Раньше тут стоял `return true` — из-за этого кнопка предлагала
 * перейти на серию, которой нет ни в озвучке, ни на сайте.
 */
export function hasNextEpisode(current: number, maxEpisode?: number): boolean {
  const currentNum = Number(current)
  if (!Number.isFinite(currentNum) || currentNum < 1) return false

  const max = toPositiveInt(maxEpisode)
  if (max === undefined) return false

  return currentNum + 1 <= max
}

/** Есть ли конкретная серия в озвучке (для авто-подбора другой озвучки). */
export function isEpisodeAvailableInTranslation(
  translation: KodikTranslationEpisodes | null | undefined,
  episode: number
): boolean {
  const ep = toPositiveInt(episode)
  if (ep === undefined) return false

  const max = getTranslationMaxEpisode(translation)
  if (max === undefined) return false

  return ep <= max
}

/**
 * Точно ли серии в озвучке НЕТ.
 * В отличие от `isEpisodeAvailableInTranslation`, при неизвестной границе
 * возвращает `false` — чтобы не переключать озвучку на пустом месте,
 * когда Kodik просто не отдал `seasons`/`episodes_count`.
 */
export function isEpisodeMissingFromTranslation(
  translation: KodikTranslationEpisodes | null | undefined,
  episode: number
): boolean {
  const ep = toPositiveInt(episode)
  if (ep === undefined) return false

  const max = getTranslationMaxEpisode(translation)
  if (max === undefined) return false

  return ep > max
}

/* ------------------------------------------------------------------ */
/* Показ плашки «Следующая серия»                                      */
/* ------------------------------------------------------------------ */

/**
 * До 60-й секунды серии эндинга не бывает — плашка не показывается,
 * даже если плеер прислал `ended` (так делает преролл-реклама).
 */
export const MIN_PROMPT_CURRENT_SEC = 60

/**
 * Эндинг не может начаться раньше 45% серии. Защищает от случая,
 * когда `duration` прилетел от рекламного видео, а не от серии.
 */
export const MIN_PROMPT_PROGRESS_RATIO = 0.45

/** Длительность короче этой считаем мусором (рекламный ролик, превью). */
export const MIN_TRUSTED_DURATION_SEC = 120

/** Авто-правило «последние 90 секунд» применяем только к нормальным сериям. */
export const MIN_DURATION_FOR_AUTO_PROMPT_SEC = 300

/** За сколько секунд до конца показываем плашку, если эндинг не размечен. */
export const AUTO_PROMPT_TAIL_SEC = 90

/** Насколько раньше начала эндинга «перемотка назад» гасит плашку. */
export const SEEK_BACK_TOLERANCE_SEC = 5

export interface EndingRange {
  start: number
  end?: number
}

export interface EndingPromptState {
  /** Последнее достоверное время воспроизведения серии, сек. */
  currentSec?: number | null
  /**
   * Сколько секунд прошло с начала просмотра (обычные часы).
   * Запасной вариант на случай, когда плеер вообще не присылает
   * время воспроизведения, — отличает конец серии от конца преролла.
   */
  watchedWallSec?: number | null
  /** Длительность серии, сек. */
  duration?: number | null
  /** Размеченный диапазон эндинга (из cuepoints/маркеров плеера). */
  endingRange?: EndingRange | null
  /** В DOM плеера активна кнопка «Пропустить эндинг». */
  domSkipActive?: boolean
  /** Плеер прислал событие окончания видео. */
  videoEnded?: boolean
  /** Видео сейчас воспроизводится (не на паузе). */
  isPlaying?: boolean
}

/** Длительность, которой можно доверять. */
export function trustedDuration(duration?: number | null): number | undefined {
  const value = Number(duration)
  if (!Number.isFinite(value)) return undefined
  if (value < MIN_TRUSTED_DURATION_SEC) return undefined
  return Math.floor(value)
}

/** Сколько секунд реального просмотра считаем достаточным подтверждением. */
export const MIN_PROMPT_WALL_SEC = MIN_PROMPT_CURRENT_SEC

/**
 * Временной гейт: дошли ли мы вообще до той части серии,
 * где эндинг физически возможен.
 */
export function isEndingPromptAllowed(state: EndingPromptState): boolean {
  const current = Number(state.currentSec)
  const hasCurrent = Number.isFinite(current) && current >= MIN_PROMPT_CURRENT_SEC

  const wall = Number(state.watchedWallSec)
  const hasWall = Number.isFinite(wall) && wall >= MIN_PROMPT_WALL_SEC

  // Нужно хоть какое-то подтверждение, что серия действительно идёт.
  // Без него любое ended-событие (преролл, чужой iframe) открывало плашку.
  if (!hasCurrent && !hasWall) return false

  // Если точное время серии известно — эндинг не может идти раньше 45%.
  const duration = trustedDuration(state.duration)
  if (duration !== undefined && hasCurrent && current < duration * MIN_PROMPT_PROGRESS_RATIO) {
    return false
  }

  return true
}

/**
 * Пора ли показывать «Следующую серию».
 *
 * Обязательны ОБА условия:
 *  1. пройден временной гейт (`isEndingPromptAllowed`);
 *  2. есть хотя бы один сигнал конца серии.
 */
export function isEndingReached(state: EndingPromptState): boolean {
  if (!isEndingPromptAllowed(state)) return false

  const current = Number(state.currentSec)
  const duration = trustedDuration(state.duration)

  // 1. Плеер сказал, что видео закончилось.
  if (state.videoEnded) return true

  // 2. В DOM плеера активна кнопка «Пропустить эндинг».
  if (state.domSkipActive) return true

  // 3. Досмотрели до размеченного начала эндинга.
  const range = state.endingRange
  if (range && range.start > 0 && current >= range.start) return true

  // 4. Эндиг не размечен — показываем за 90 секунд до конца.
  if (duration !== undefined && duration >= MIN_DURATION_FOR_AUTO_PROMPT_SEC) {
    const left = duration - current
    if (left >= 0 && left <= AUTO_PROMPT_TAIL_SEC && state.isPlaying !== false) return true
  }

  return false
}

/**
 * Пользователь перемотал назад (или время откатилось к началу после
 * «ended» от преролла) — плашку нужно снять, а флаг конца серии сбросить.
 */
export function isSeekedBackBeforeEnding(state: EndingPromptState): boolean {
  const current = Number(state.currentSec)
  if (!Number.isFinite(current)) return false

  // Кнопка «Пропустить эндинг» в DOM — живой сигнал, эндинг правда идёт.
  // А вот `videoEnded` тут учитывать НЕЛЬЗЯ: флаг мог остаться от
  // ended-события рекламного ролика, и тогда плашка не снялась бы никогда.
  if (state.domSkipActive) return false

  const duration = trustedDuration(state.duration)
  const threshold =
    state.endingRange && state.endingRange.start > 0
      ? state.endingRange.start - SEEK_BACK_TOLERANCE_SEC
      : duration !== undefined && duration >= MIN_DURATION_FOR_AUTO_PROMPT_SEC
      ? duration - AUTO_PROMPT_TAIL_SEC - 20
      : 0

  if (threshold <= 0) return false
  return current < threshold
}

/* ------------------------------------------------------------------ */
/* Разбор сообщений плеера                                             */
/* ------------------------------------------------------------------ */

export function parseSeconds(val: any): number | undefined {
  if (typeof val === "number" && !isNaN(val)) {
    if (val < 0 || val > 86400) return undefined
    return Math.floor(val)
  }
  if (typeof val === "string") {
    const trimmed = val.trim()
    if (trimmed.includes(":")) {
      const parts = trimmed.split(":").map(Number)
      if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        const seconds = parts[0] * 60 + parts[1]
        if (seconds < 0 || seconds > 86400) return undefined
        return seconds
      }
      if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
        const seconds = parts[0] * 3600 + parts[1] * 60 + parts[2]
        if (seconds < 0 || seconds > 86400) return undefined
        return seconds
      }
    }
    const num = parseFloat(trimmed)
    if (!isNaN(num) && num >= 0 && num <= 86400) return Math.floor(num)
  }
  return undefined
}

/**
 * «Событие конца серии» vs «событие конца рекламного ролика».
 * Kodik шлёт ended-события и для прероллов — их принимать нельзя.
 */
export function isVideoEndedEvent(key: unknown): boolean {
  if (typeof key !== "string") return false
  const normalized = key.toLowerCase()

  if (!normalized.includes("end")) return false
  if (/(^|[_\-.])(ads?|preroll|postroll|midroll|commercial|reklama|trailer)([_\-.]|$)/.test(normalized)) {
    return false
  }

  return (
    normalized === "kodik_player_video_ended" ||
    normalized === "kodik_player_ended" ||
    normalized.endsWith("ended")
  )
}

export function extractEndingTimings(payload: any): EndingRange | null {
  if (!payload || typeof payload !== "object") return null

  // Исключаем события опенинга
  const typeStr = String(payload.type || payload.title || payload.name || "").toLowerCase()
  if (typeStr.includes("opening") || typeStr.includes("опенинг")) {
    return null
  }

  // 1. Прямые поля ending_start / ending_end
  const startDirect = parseSeconds(payload.ending_start ?? payload.endingStart)
  const endDirect = parseSeconds(payload.ending_end ?? payload.endingEnd)
  if (startDirect && startDirect > 60) {
    return { start: startDirect, end: endDirect }
  }

  // 2. Объект skip_buttons или skip (строго секция ending)
  const skip = payload.skip_buttons || payload.skipButtons || payload.skip
  if (skip?.ending) {
    const s = parseSeconds(skip.ending.start ?? skip.ending.time ?? skip.ending.from)
    const e = parseSeconds(skip.ending.end ?? skip.ending.to)
    if (s && s > 60) return { start: s, end: e }
  }

  // 3. Массивы cuepoints / chapters / markers
  const markers = payload.cuepoints || payload.chapters || payload.markers || payload.timings
  if (Array.isArray(markers)) {
    for (const item of markers) {
      const label = String(item.title || item.name || item.type || item.label || "").toLowerCase()
      if (label.includes("опенинг") || label.includes("opening")) {
        continue
      }
      if (label.includes("эндинг") || label.includes("ending") || label.includes("титр")) {
        const s = parseSeconds(item.time ?? item.start ?? item.value)
        const e = parseSeconds(item.end ?? (item.duration && s ? s + item.duration : undefined))
        if (s && s > 60) return { start: s, end: e }
      }
    }
  } else if (typeof markers === "object") {
    if (markers.ending) {
      const s = parseSeconds(markers.ending.start ?? markers.ending.time)
      const e = parseSeconds(markers.ending.end)
      if (s && s > 60) return { start: s, end: e }
    }
  }

  return null
}
