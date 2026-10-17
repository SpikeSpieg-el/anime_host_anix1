/**
 * «Ожидание озвучки» — подписка на КОНКРЕТНЫЙ тайтл, а не на push вообще.
 *
 * Зачем это нужно
 * ---------------
 * На странице тайтла без озвучки плеер показывает плашку «Скоро / Озвучка не
 * найдена» с кнопкой «Уведомить меня». Раньше эта кнопка делала только
 * `usePushNotifications().subscribe()` — то есть сохраняла в
 * `push_subscriptions` факт «этот браузер умеет получать пуши», и НИКАК не
 * связывала пользователя с аниме.
 *
 * Дальше поиск новых серий в `episode-updates-provider` строил список
 * проверяемых тайтлов из `watch_history` ∪ `bookmarks`. У тайтла без озвучки
 * историю создать невозможно физически, а в закладки пользователь догадывался
 * нажать не всегда → уведомление не приходило никогда. Воронка «зарегистрируйся
 * и мы напомним» обещала то, что система не могла выполнить.
 *
 * Плюс сама проверка шла по `episodes_aired` из Shikimori, а не по наличию
 * озвучки в Kodik: «появилась озвучка» не детектировалась в принципе, а для
 * онгоинга с уже вышедшими сериями прилетало мгновенное ложное «вышла серия 12».
 *
 * Как теперь
 * ----------
 * 1. Клик по «Уведомить меня» (плашка в плеере) ИЛИ по «Следить за
 *    тайтлом» (шапка страницы тайтла) создаёт строку в `translation_alerts`
 *    (user_id + anime_id + какую серию ждём + сколько серий было известно на
 *    момент подписки). Это и есть гарантия доставчи — она не зависит ни от
 *    закладок, ни от истории просмотров.
 * 2. `POST /api/alerts/check` (дёргается провайдером с троттлингом) проверяет
 *    Kodik по каждому ожиданию и, как только нужная серия появилась в любой
 *    озвучке/субтитрах, шлёт web-push и кладёт строку в `episode_updates`
 *    (колокольчик на сайте).
 *
 * Одна система на обе кнопки
 * ---------------------------
 * Раньше это были две независимые сущности: плашка писала в
 * `translation_alerts`, а «Следить за тайтлом» — только в
 * `title_subscriptions`, где флаг `notify_dub` не обрабатывал никто на сайте
 * (только телеграм-бот). Кнопка обещала «серии и озвучка», а озвучку с сайта
 * не присылал никогда. Теперь обе кнопки заводят ОДНО и то же ожидание в
 * `translation_alerts`, а серии остаются отдельным каналом `title_subscriptions`.
 *
 * Что именно считается «озвучка вышла»
 * ------------------------------------
 * Не «вышла конкретная озвучка», а «нужная серия появилась ХОТЬ В ОДНОЙ».
 * У тайтла может быть три озвучки, и все три отстают на серию; как только
 * любая догонит — человек получит уведомление. Поэтому в тексте пуша
 * название озвучки не называется (см. `buildAlertNotification`).
 *
 * Модуль намеренно чистый (без React, Supabase и Node-API): правила разбираются
 * и на сервере, и в тестах.
 */

import {
  getTranslationMaxEpisode,
  isEpisodeAvailableInTranslation,
  type KodikSeasonsMap,
} from "@/lib/kodik-player-logic"
import { getWatchPath } from "@/lib/seo/watch-url"

/* ------------------------------------------------------------------ */
/* Типы                                                                */
/* ------------------------------------------------------------------ */

/**
 * Почему человек вообще завёл ожидание.
 *
 * Это не «что сейчас с контентом», а «откуда пришли» — потому что к моменту
 * проверки разницы уже не видно: Kodik отдаёт один и тот же список переводов,
 * а формулировка уведомления зависит именно от намерения.
 *
 * - `no-translations`  — озвучок/субтитров нет вовсе (плашка в плеере)
 * - `episode-not-ready`— ждём СЕРИЮ: человек упёрся в потолок Shikimori.
 *   Когда она появится, честно сказать «новая серия».
 * - `dub-behind`      — ждём ОЗВУЧКУ: озвучки есть, но отстают, и человек
 *   подписался на странице тайтла («Следить за тайтлом»). Появление серии в
 *   любой из них — это «озвучка стала доступна», а не «новая серия».
 */
export type TranslationAlertReason =
  | "no-translations"
  | "episode-not-ready"
  | "dub-behind"

/** Что именно случилось: нашлась озвучка, нашлись субтитры или вышла серия. */
export type AlertResolutionKind = "dub" | "subtitles" | "episode"

/** Минимальный набор полей озвучки Kodik, нужный для проверки доступности. */
export interface AlertTranslation {
  title?: string
  /** 'voice' (озвучка) | 'subtitles' (субтитры). */
  type?: string
  episodesCount?: number | null
  seasons?: KodikSeasonsMap
}

/** Подписка пользователя на ожидание контента по одному тайтлу. */
export interface TranslationAlert {
  /** ID тайтла (в Weebx совпадает с shikimori_id). */
  animeId: string
  animeTitle: string
  poster?: string | null
  /** Какую серию пользователь пытался открыть. */
  episode: number
  /**
   * Сколько серий было известно (по Shikimori) на момент подписки.
   * Нужно, чтобы не отправить мгновенное ложное «вышла серия N» и чтобы
   * колокольчик показал честный переход «было → стало».
   */
  baselineEpisode: number
  reason: TranslationAlertReason
}

export interface AlertResolution {
  resolved: boolean
  kind: AlertResolutionKind | null
  /** Серия, которую пользователь хотел посмотреть (>= 1). */
  wantedEpisode: number
  /** Сколько серий максимально доступно в найденной озвучке. */
  availableEpisode: number
  /** Название озвучки/субтитров, в которых нашлась серия. */
  translationTitle?: string
  /** Нашлось именно озвучкой (а не только субтитрами). */
  isVoice: boolean
}

/* ------------------------------------------------------------------ */
/* Константы                                                           */
/* ------------------------------------------------------------------ */

/**
 * Как часто клиент имеет право дёргать `/api/alerts/check`.
 *
 * Раньше было 15 минут — вдвое чаще, чем серверный гейт
 * ALERT_MIN_RECHECK_INTERVAL_MS (30 минут). Второй запрос из каждой пары
 * сервер отбивал как «ещё рано», так что клиентский троттлинг только зря
 * жег лимит 12 запросов / 10 минут и ходил в сеть без результата.
 *
 * Держим значение равным серверному гейту: реальная частота проверки и так
 * задаётся ALERT_MIN_RECHECK_INTERVAL_MS, а рассинхрон только добавлял
 * простаивающие запросы. Задержка уведомления от этого не меняется.
 */
export const ALERTS_CHECK_THROTTLE_MS = 30 * 60 * 1000

/** localStorage-ключ метки последней клиентской проверки ожиданий. */
export const ALERTS_LAST_CHECK_KEY = "last_translation_alerts_check_ts"

/** Сколько ожиданий сервер проверяет за один запрос (защита от таймаута). */
export const MAX_ALERTS_PER_CHECK = 10

/**
 * Серверный минимум между проверками ОДНОГО ожидания.
 * Клиентский троттлинг можно обойти — здесь упираемся в лимиты Kodik API.
 */
export const ALERT_MIN_RECHECK_INTERVAL_MS = 30 * 60 * 1000

/** TTL кэша списка озвучек внутри одного серверного процесса. */
export const ALERT_TRANSLATIONS_TTL_MS = 10 * 60 * 1000

/**
 * TTL того же кэша для ПУСТОГО списка озвучек — короче втрое.
 *
 * Кэш общий на процесс, поэтому отрицательный ответ отдаётся всем, кто ждёт
 * этот тайтл. Озвучка выходит в произвольный момент, и кэш пустого ответа на
 * 10 минут мог целиком съесть появление: один пользователь получил «озвучек
 * нет», вышел другой, его ждёт, а он получает тот же пустой список из кэша и
 * ждёт до истечения окна. Отрицательный ответ стареет быстрее положительного.
 */
export const ALERT_EMPTY_TRANSLATIONS_TTL_MS = 3 * 60 * 1000

/** Имя события: сервер разобрал ожидания, нужно обновить колокольчик/плашку. */
export const ALERTS_RESOLVED_EVENT = "translation-alerts-resolved"

/* ------------------------------------------------------------------ */
/* Мелкие утилиты                                                      */
/* ------------------------------------------------------------------ */

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

/** «серия / серии / серий» для числительного. */
export function pluralEpisodes(count: number): string {
  const mod10 = count % 10
  const mod100 = count % 100
  if (mod10 === 1 && mod100 !== 11) return "серия"
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "серии"
  return "серий"
}

/**
 * Пора ли клиенту идти проверять ожидания.
 * `lastCheckTs` — null/undefined, если проверки ещё не было (тогда пора).
 */
export function shouldRunAlertsCheck(
  lastCheckTs: number | string | null | undefined,
  now: number = Date.now(),
  throttleMs: number = ALERTS_CHECK_THROTTLE_MS,
): boolean {
  const last = Number(lastCheckTs)
  if (!Number.isFinite(last) || last <= 0) return true
  return now - last >= throttleMs
}

/** Можно ли уже перепроверять конкретное ожидание на сервере. */
export function isAlertDueForRecheck(
  lastCheckedAt: string | number | Date | null | undefined,
  now: number = Date.now(),
  minIntervalMs: number = ALERT_MIN_RECHECK_INTERVAL_MS,
): boolean {
  if (!lastCheckedAt) return true
  const ts =
    lastCheckedAt instanceof Date
      ? lastCheckedAt.getTime()
      : typeof lastCheckedAt === "number"
        ? lastCheckedAt
        : Date.parse(String(lastCheckedAt))
  if (!Number.isFinite(ts)) return true
  return now - ts >= minIntervalMs
}

/* ------------------------------------------------------------------ */
/* Главное правило: разбор ожидания                                    */
/* ------------------------------------------------------------------ */

function isVoiceTranslation(translation: AlertTranslation): boolean {
  // Kodik отдаёт type: 'voice' | 'subtitles' | 'multivoice'. Всё, что не
  // субтитры, считаем озвучкой — именно её ждёт пользователь на плашке.
  return (translation?.type || "voice") !== "subtitles"
}

/**
 * Разобралось ли ожидание.
 *
 * Правило одно и для «озвучки нет вовсе», и для «серия ещё не вышла»:
 * ожидание закрывается, когда нужная серия появилась ХОТЬ в одном переводе
 * Kodik. Приоритет — у озвучек (их ждали), субтитры тоже считаются
 * доступным контентом, но уведомление формулируется иначе.
 *
 * Важно: `episodes_aired` из Shikimori здесь намеренно не используется как
 * признак — он растёт и без русской озвучки, из-за чего старая логика
 * присылала «новую серию» сразу после подписки.
 */
export function resolveTranslationAlert(
  alert: Pick<TranslationAlert, "episode" | "reason">,
  translations: AlertTranslation[] | null | undefined,
): AlertResolution {
  const wantedEpisode = toPositiveInt(alert?.episode) ?? 1
  const base: AlertResolution = {
    resolved: false,
    kind: null,
    wantedEpisode,
    availableEpisode: wantedEpisode,
    isVoice: false,
  }

  if (!Array.isArray(translations) || translations.length === 0) return base

  const voice = translations.filter(isVoiceTranslation)
  const subtitles = translations.filter((t) => !isVoiceTranslation(t))

  const match =
    voice.find((t) => isEpisodeAvailableInTranslation(t, wantedEpisode)) ??
    subtitles.find((t) => isEpisodeAvailableInTranslation(t, wantedEpisode)) ??
    null

  if (!match) return base

  const isVoice = isVoiceTranslation(match)
  const maxInMatch = getTranslationMaxEpisode(match) ?? wantedEpisode
  const availableEpisode = Math.max(maxInMatch, wantedEpisode)

  // Только 'episode-not-ready' означает «человек ждал серию» — плашка в плеере
  // упёрлась в потолок Shikimori. Все остальные причины, включая 'dub-behind',
  // означают «ждал озвучку», и появление серии в любом переводе — это
  // «озвучка стала доступна».
  const kind: AlertResolutionKind =
    alert?.reason === "episode-not-ready"
      ? "episode"
      : isVoice
        ? "dub"
        : "subtitles"

  return {
    resolved: true,
    kind,
    wantedEpisode,
    availableEpisode,
    translationTitle: match.title || undefined,
    isVoice,
  }
}

/* ------------------------------------------------------------------ */
/* Какую серию ждать                                                    */
/* ------------------------------------------------------------------ */

/**
 * Номер серии, за которой стоит следить, если озвучка ещё не запрошена.
 *
 * Берём максимум по ВСЕМ озвучкам Kodik и прибавляем единицу: человек ждёт
 * первую серию, которой ещё нет ни в одной. Проверка ожидания срабатывает,
 * когда она появится хоть в одной из них, — ровно то поведение, которое
 * обещает кнопка.
 *
 * Почему не по Shikimori
 * ---------------------
 * `episodes_aired` Шики — это эфир в Японии, озвучка от него отстаёт на
 * недели. Пример: Шики говорит «3 серии вышло», в Kodik все три озвучки по
 * две. Ожидание «3 + 1 = 4» не сработало бы ещё очень долго, хотя человек
 * ждёт третью. Отсюда правило: точку отсчёта задаёт Kodik, а не Шики.
 *
 * Когда озвучек нет вовсе — ждём первую серию.
 */
export function nextDubEpisode(translations: AlertTranslation[] | null | undefined): number {
  let max = 0
  if (Array.isArray(translations)) {
    for (const translation of translations) {
      const value = getTranslationMaxEpisode(translation)
      if (value !== undefined && value > max) max = value
    }
  }
  return max + 1
}

/**
 * Сколько серий доступно прямо сейчас по объединению всех озвучек.
 * Та же база отсчёта, что и у `nextDubEpisode`, только без прибавления
 * единицы — это и есть `baseline_episode` для честного перехода «было → стало».
 */
export function currentDubEpisodes(translations: AlertTranslation[] | null | undefined): number {
  return Math.max(0, nextDubEpisode(translations) - 1)
}

/* ------------------------------------------------------------------ */
/* Тексты уведомлений                                                  */
/* ------------------------------------------------------------------ */

export interface AlertNotification {
  title: string
  body: string
  url: string
  tag: string
}

/**
 * Заголовок/текст пуша и ссылка на страницу тайтла.
 * Ссылка всегда ведёт на ТУ серию, которую пользователь хотел открыть, —
 * не на последнюю доступную (иначе он попадёт в середину сезона).
 */
export function buildAlertNotification(
  alert: Pick<TranslationAlert, "animeId" | "animeTitle" | "episode">,
  resolution: AlertResolution,
  totalEpisodes?: number | null,
): AlertNotification {
  const title = alert.animeTitle || `Аниме #${alert.animeId}`
  const total = toPositiveInt(totalEpisodes)
  const available = resolution.availableEpisode
  const wanted = resolution.wantedEpisode

  let head: string
  let body: string

  switch (resolution.kind) {
    case "dub": {
      head = `Weebx — появилась озвучка: ${title}`
      // Название конкретной озвучки намеренно НЕ называем. Ожидание
      // закрывается, когда серия появилась хоть в одной озвучке
      // (`resolveTranslationAlert` ищет через find по всем переводам), а
      // назвать одну конкретную — значит заявить, что именно она вышла.
      // Их может быть несколько, и какая именно догнала — неважно:
      // человек ждал серию, серия доступна.
      body = `${available} ${pluralEpisodes(available)} уже можно смотреть с озвучкой`
      break
    }
    case "subtitles": {
      head = `Weebx — появились субтитры: ${title}`
      body = `${wanted} ${pluralEpisodes(wanted)} уже доступна с субтитрами`
      break
    }
    case "episode": {
      head = `Weebx — новая серия: ${title}`
      body = `Вышла ${wanted} ${pluralEpisodes(wanted)}${total ? ` из ${total}` : ""}`
      break
    }
    default: {
      head = `Weebx — ${title}`
      body = `${wanted} ${pluralEpisodes(wanted)} уже доступна — можно смотреть`
    }
  }

  return {
    title: head,
    body,
    url: getWatchPath(alert.animeId, alert.animeTitle, wanted),
    tag: `translation-alert:${alert.animeId}`,
  }
}

/* ------------------------------------------------------------------ */
/* Отложенное намерение гостя                                          */
/* ------------------------------------------------------------------ */

/**
 * Гость нажал «Уведомить меня» → намерение нужно сохранить до момента входа.
 *
 * Храним в localStorage, а не в sessionStorage: регистрация может требовать
 * подтверждения почты, и пользователь вернётся в другой вкладке/через день.
 * Синхронизируется в аккаунт вместе с закладками и историей
 * (`syncLocalDataToAccount`), поэтому ожидание не теряется даже если вход
 * случился на другой странице.
 */
export const PENDING_ALERTS_STORAGE_KEY = "weebx_pending_translation_alerts"

/** Сколько дней держим намерение гостя. */
export const PENDING_ALERT_TTL_MS = 30 * 24 * 60 * 60 * 1000

/** Сколько намерений максимум храним (защита от разрастания). */
export const PENDING_ALERTS_LIMIT = 20

export interface PendingAlertIntent extends TranslationAlert {
  /** Когда гость нажал кнопку. По умолчанию — сейчас. */
  ts?: number
}

/** То же намерение, но уже записанное в localStorage (ts гарантированно есть). */
export interface StoredPendingAlert extends TranslationAlert {
  ts: number
}

type PendingAlertMap = Record<string, StoredPendingAlert>

function readPendingMap(): PendingAlertMap {
  if (typeof window === "undefined") return {}
  try {
    const raw = window.localStorage.getItem(PENDING_ALERTS_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {}
    return parsed as PendingAlertMap
  } catch {
    return {}
  }
}

function writePendingMap(map: PendingAlertMap): void {
  if (typeof window === "undefined") return
  try {
    if (Object.keys(map).length === 0) {
      window.localStorage.removeItem(PENDING_ALERTS_STORAGE_KEY)
      return
    }
    window.localStorage.setItem(PENDING_ALERTS_STORAGE_KEY, JSON.stringify(map))
  } catch {
    /* private mode / quota */
  }
}

/** Запомнить намерение гостя (повторный клик по тому же тайтлу перезаписывает). */
export function rememberPendingAlert(intent: PendingAlertIntent): void {
  if (typeof window === "undefined") return
  const animeId = String(intent?.animeId || "").trim()
  if (!animeId) return

  const map = readPendingMap()
  map[animeId] = {
    animeId,
    animeTitle: intent.animeTitle || "",
    poster: intent.poster ?? null,
    episode: Math.max(1, Math.floor(intent.episode) || 1),
    baselineEpisode: Math.max(0, Math.floor(intent.baselineEpisode) || 0),
    reason: intent.reason === "episode-not-ready" ? "episode-not-ready" : "no-translations",
    ts: Number.isFinite(intent.ts) ? Number(intent.ts) : Date.now(),
  }

  // Свежие намерения важнее старых.
  const entries = Object.values(map).sort((a, b) => (b.ts || 0) - (a.ts || 0))
  const trimmed: PendingAlertMap = {}
  entries.slice(0, PENDING_ALERTS_LIMIT).forEach((entry) => {
    trimmed[entry.animeId] = entry
  })
  writePendingMap(trimmed)
}

/** Живые (не протухшие) намерения гостя. */
export function readPendingAlerts(now: number = Date.now()): StoredPendingAlert[] {
  const map = readPendingMap()
  const alive = Object.values(map).filter(
    (intent) => Number.isFinite(intent?.ts) && now - intent.ts < PENDING_ALERT_TTL_MS,
  )

  // Протухшие вычищаем сразу, чтобы не тащить мусор в аккаунт.
  if (alive.length !== Object.keys(map).length) {
    const next: PendingAlertMap = {}
    alive.forEach((intent) => {
      next[intent.animeId] = intent
    })
    writePendingMap(next)
  }

  return alive.sort((a, b) => (b.ts || 0) - (a.ts || 0))
}

/** Убрать намерение (после успешного сохранения ожидания в аккаунт). */
export function clearPendingAlert(animeId: string): void {
  if (typeof window === "undefined") return
  const map = readPendingMap()
  if (!(animeId in map)) return
  delete map[animeId]
  writePendingMap(map)
}

/** Убрать все намерения (после синхронизации при входе). */
export function clearPendingAlerts(animeIds?: string[]): void {
  if (typeof window === "undefined") return
  if (!animeIds) {
    writePendingMap({})
    return
  }
  const map = readPendingMap()
  let changed = false
  animeIds.forEach((id) => {
    if (id in map) {
      delete map[id]
      changed = true
    }
  })
  if (changed) writePendingMap(map)
}

/* ------------------------------------------------------------------ */
/* Маппинг строки БД                                                   */
/* ------------------------------------------------------------------ */

export interface TranslationAlertRow {
  id?: string
  user_id?: string
  anime_id: string
  anime_title: string | null
  poster: string | null
  episode: number
  baseline_episode: number
  reason: string | null
  last_checked_at?: string | null
  notified_at?: string | null
  created_at?: string
}

function normalizeReason(value: unknown): TranslationAlertReason {
  return value === "episode-not-ready" ? "episode-not-ready" : "no-translations"
}

/** Строка `translation_alerts` → доменная модель (терпимо к мусору в БД). */
export function mapAlertRow(row: Partial<TranslationAlertRow> | null | undefined): TranslationAlert | null {
  const animeId = row?.anime_id !== undefined && row?.anime_id !== null ? String(row.anime_id).trim() : ""
  if (!animeId) return null

  return {
    animeId,
    animeTitle: String(row?.anime_title || "").trim() || `Аниме #${animeId}`,
    poster: row?.poster ?? null,
    episode: toPositiveInt(row?.episode) ?? 1,
    baselineEpisode: Math.max(0, Number(row?.baseline_episode) || 0),
    reason: normalizeReason(row?.reason),
  }
}

/** Доменная модель → полезная нагрузка для upsert в `translation_alerts`. */
export function toAlertRow(
  userId: string,
  alert: TranslationAlert,
): Omit<TranslationAlertRow, "id" | "last_checked_at" | "notified_at" | "created_at"> {
  return {
    user_id: userId,
    anime_id: String(alert.animeId),
    anime_title: alert.animeTitle || null,
    poster: alert.poster ?? null,
    episode: Math.max(1, Math.floor(alert.episode) || 1),
    baseline_episode: Math.max(0, Math.floor(alert.baselineEpisode) || 0),
    reason: alert.reason === "episode-not-ready" ? "episode-not-ready" : "no-translations",
  }
}
