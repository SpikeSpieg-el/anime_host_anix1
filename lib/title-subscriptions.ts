/**
 * Подписки на тайтлы (`title_subscriptions`) — правила и тексты.
 *
 * Зачем это отдельно от `translation-alerts.ts`
 * ---------------------------------------------
 * В проекте выросли ДВЕ разные сущности, и обе назывались «уведомлением»:
 *
 *   1. `translation_alerts` — «жду конкретную серию/озвучку этого тайтла».
 *      Её можно было создать только плашкой внутри плеера, то есть только
 *      когда контента прямо сейчас нет. Для нормального тайтла подписаться
 *      было негде.
 *   2. Уведомления о новых сериях — неявные, список тайтлов строился как
 *      `watch_history ∪ bookmarks`. Отписаться от них было нельзя, включить
 *      тоже: человек получал уведомления о тайтлах, которые он когда-то
 *      смотрел, и не мог это прекратить.
 *
 * Этот модуль вводит одну явную сущность вместо двух неявных: подписка на
 * тайтл с двумя независимыми каналами. Модуль намеренно чистый — без React,
 * Supabase и Node-API — потому что его читают и клиентские компоненты, и
 * серверные роуты, и телеграм-бот из того же монорепозитория.
 */

import { getWatchPath } from "@/lib/seo/watch-url"

/* ------------------------------------------------------------------ */
/* Типы                                                                */
/* ------------------------------------------------------------------ */

/** Каналы подписки. Независимы: можно ждать серию, не ожидая озвучки. */
export interface TitleSubscription {
  /** ID тайтла (в Weebx совпадает с shikimori_id). */
  animeId: string
  animeTitle: string
  poster?: string | null
  /** «Напиши, когда выйдет следующая серия». */
  notifyNewEpisodes: boolean
  /** «Напиши, когда появится озвучка». */
  notifyDub: boolean
  /**
   * Сколько серий человек видел на момент подписки. Точка отсчёта: без неё
   * подписка на давно вышедший тайтл мгновенно дала бы ложное «вышла 12».
   */
  baselineEpisode: number
  /**
   * Какую серию уже отправили в уведомлении. Без неё уведомление о той же
   * серии приходило бы повторно при каждой проверке.
   */
  lastNotifiedEpisode?: number | null
}

/**
 * Откуда взялась подписка.
 *
 * Справочная величина: по ней ничего не ветвится. Иначе «перенесённое
 * миграцией» пришлось бы отличать от «созданного человеком» во всех местах,
 * где принимается решение, — а сегодня это нужно только для разбора поломок.
 */
export type SubscriptionSource = "manual" | "bookmark" | "watch_history" | "translation_alert"

/** Что человек хочет получать по конкретному тайтлу. */
export interface SubscriptionChannels {
  notifyNewEpisodes: boolean
  notifyDub: boolean
}

/* ------------------------------------------------------------------ */
/* Константы                                                           */
/* ------------------------------------------------------------------ */

/**
 * localStorage-ключ намерений гостя.
 *
 * Гость нажал «Следить за тайтлом» → сохраняем намерение до входа. Хранится
 * в localStorage, а не в sessionStorage: подтверждение почты может занять
 * сутки, и человек вернётся в другой вкладке или вообще в другой день.
 */
export const PENDING_SUBSCRIPTIONS_STORAGE_KEY = "weebx_pending_title_subscriptions"

/** Сколько дней держим намерение гостя. */
export const PENDING_SUBSCRIPTION_TTL_MS = 30 * 24 * 60 * 60 * 1000

/** Сколько намерений максимум храним (защита от разрастания). */
export const PENDING_SUBSCRIPTIONS_LIMIT = 20

/** Сколько подписок показывать в списке настроек. */
export const MAX_SUBSCRIPTIONS_LIST = 100

/** Имя события: подписки изменились, колокольчик и плашки должны перечитать. */
export const SUBSCRIPTIONS_CHANGED_EVENT = "title-subscriptions-changed"

/** Query-параметр, которым сайт зовёт бота подписаться на конкретный тайтл. */
export const SUBSCRIBE_DEEP_LINK_PARAM = "sub"

/* ------------------------------------------------------------------ */
/* Мелкие утилиты                                                      */
/* ------------------------------------------------------------------ */

/** «серия / серии / серий» для числительного. */
export function pluralEpisodes(count: number): string {
  const mod10 = count % 10
  const mod100 = count % 100
  if (mod10 === 1 && mod100 !== 11) return "серия"
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "серии"
  return "серий"
}

function toNonNegativeInt(value: unknown): number {
  const parsed = typeof value === "string" ? Number(value.trim()) : value
  if (typeof parsed !== "number" || !Number.isFinite(parsed)) return 0
  return Math.max(0, Math.floor(parsed))
}

/* ------------------------------------------------------------------ */
/* Сборка подписки                                                     */
/* ------------------------------------------------------------------ */

/**
 * Подписка с безопасными значениями по умолчанию.
 *
 * Дефолт — ждать и серий, и озвучки: человек нажал кнопку «слежу за
 * тайтлом», а не выбирал один канал из двух. Если переданные каналы оба
 * выключены, подписка всё равно получает `notify_new_episodes`: лучше
 * лишнее уведомление, чем подписка в БД, которая ничего не обещает.
 */
export function buildSubscription(input: {
  animeId: string | number
  animeTitle?: string | null
  poster?: string | null
  baselineEpisode?: number | null
  notifyNewEpisodes?: boolean
  notifyDub?: boolean
}): TitleSubscription | null {
  const animeId = String(input?.animeId ?? "").trim()
  if (!animeId) return null

  const rawNew = input?.notifyNewEpisodes !== false
  const rawDub = input?.notifyDub !== false

  return {
    animeId,
    animeTitle: String(input?.animeTitle || "").trim() || `Аниме #${animeId}`,
    poster: input?.poster ?? null,
    // Подписка без каналов — не подписка. Включаем серии по умолчанию.
    notifyNewEpisodes: rawNew || !rawDub,
    notifyDub: rawDub,
    baselineEpisode: Math.max(0, Math.floor(Number(input?.baselineEpisode)) || 0),
  }
}

/** Подписка активна, если на неё есть хоть один канал. */
export function isSubscribed(subscription: TitleSubscription | null | undefined): boolean {
  return Boolean(subscription && (subscription.notifyNewEpisodes || subscription.notifyDub))
}

/**
 * Что человек увидит в подписи кнопки: одним словом про то, что он ждёт.
 * `null`, если подписки нет.
 */
export function subscriptionSummary(subscription: TitleSubscription | null | undefined): string | null {
  if (!subscription) return null
  if (subscription.notifyNewEpisodes && subscription.notifyDub) return "серии и озвучка"
  if (subscription.notifyNewEpisodes) return "новые серии"
  if (subscription.notifyDub) return "озвучка"
  return null
}

/* ------------------------------------------------------------------ */
/* Маппинг строки БД                                                   */
/* ------------------------------------------------------------------ */

export interface TitleSubscriptionRow {
  id?: string
  user_id?: string
  anime_id: string
  anime_title?: string | null
  poster?: string | null
  notify_new_episodes?: boolean | null
  notify_dub?: boolean | null
  source?: string | null
  baseline_episode?: number | null
  last_notified_episode?: number | null
  last_checked_at?: string | null
  created_at?: string | null
  updated_at?: string | null
}

/**
 * Строка `title_subscriptions` → доменная модель.
 *
 * Терпимо к мусору в БД: `notify_*` приходят nullable (старые строки до
 * добавления колонок), и `false` там — осмысленное значение, поэтому
 * различаем «нет значения» и «выключено».
 */
export function mapSubscriptionRow(
  row: Partial<TitleSubscriptionRow> | null | undefined,
): TitleSubscription | null {
  const animeId =
    row?.anime_id !== undefined && row?.anime_id !== null ? String(row.anime_id).trim() : ""
  if (!animeId) return null

  const notifyNewEpisodes = row?.notify_new_episodes !== false
  const notifyDub = row?.notify_dub !== false

  return {
    animeId,
    animeTitle: String(row?.anime_title || "").trim() || `Аниме #${animeId}`,
    poster: row?.poster ?? null,
    notifyNewEpisodes,
    notifyDub,
    baselineEpisode: toNonNegativeInt(row?.baseline_episode),
    lastNotifiedEpisode:
      row?.last_notified_episode === null || row?.last_notified_episode === undefined
        ? null
        : toNonNegativeInt(row.last_notified_episode),
  }
}

/** Доменная модель → полезная нагрузка для upsert в `title_subscriptions`. */
export function toSubscriptionRow(
  userId: string,
  subscription: TitleSubscription,
  options?: { source?: SubscriptionSource },
): Record<string, unknown> {
  return {
    user_id: userId,
    anime_id: subscription.animeId,
    anime_title: subscription.animeTitle || null,
    poster: subscription.poster ?? null,
    notify_new_episodes: subscription.notifyNewEpisodes,
    notify_dub: subscription.notifyDub,
    source: options?.source ?? "manual",
    baseline_episode: Math.max(0, Math.floor(subscription.baselineEpisode) || 0),
    // Повторная подписка начинает отсчёт заново: человек явно сказал
    // «слежу», поэтому старый last_notified_episode не должен мешать новой
    // серии прийти в уведомление.
    last_notified_episode: null,
    last_checked_at: null,
  }
}

/* ------------------------------------------------------------------ */
/* Правила проверки                                                    */
/* ------------------------------------------------------------------ */

/**
 * Серверный минимум между проверками ОДНОЙ подписки.
 *
 * Аналог `ALERT_MIN_RECHECK_INTERVAL_MS` для ожиданий озвучки. Серии выходят
 * по расписанию аниме, а не по расписанию проверок, поэтому и полчаса здесь
 * — с большим запасом.
 */
export const SUBSCRIPTION_MIN_RECHECK_INTERVAL_MS = 30 * 60 * 1000

/** Можно ли уже перепроверять конкретную подписку на сервере. */
export function isSubscriptionDueForCheck(
  lastCheckedAt: string | number | Date | null | undefined,
  now: number = Date.now(),
  minIntervalMs: number = SUBSCRIPTION_MIN_RECHECK_INTERVAL_MS,
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

/**
 * Вышла ли новая серия по подписке.
 *
 * Единственное правило: сообщаем, если Shikimori знает о серии ВЫШЕ той,
 * которую человек уже знает. Точка сравнения — максимум из `baseline`
 * (что видел на момент подписки) и `lastNotifiedEpisode` (что уже отправили).
 *
 * Второй максимум обязателен: без него уведомление о той же серии приходило бы
 * на каждой проверке, пока Shikimori не обновит счётчик. Проверка идёт раз в
 * полчаса, то есть спам был бы каждые полчаса.
 */
export function hasNewEpisode(subscription: TitleSubscription, episodesAired: number): boolean {
  const available = Math.floor(Number(episodesAired)) || 0
  if (available <= 0) return false

  const known = Math.max(
    toNonNegativeInt(subscription.baselineEpisode),
    toNonNegativeInt(subscription.lastNotifiedEpisode),
  )

  return available > known
}

/* ------------------------------------------------------------------ */
/* Отбор уведомлений для колокольчика                                  */
/* ------------------------------------------------------------------ */

/**
 * Кто записал уведомление. Совпадает со значением `episode_updates.source`.
 *
 * Числа в двух каналах несопоставимы: для одного и того же тайтла Kodik может
 * показать 12 серий, а Shikimori — 3 вышло. Именно поэтому «свою» и «чужую»
 * запись обязан уметь различать тот, кто их чистит.
 */
export type UpdateSource = "shikimori" | "dub"

/** Уведомление в колокольчике — ровно те поля, которые нужны для отбора. */
export interface EpisodeUpdateLike {
  animeId: string
  source: UpdateSource
}

/**
 * Устарела ли запись колокольчика из-за отписки.
 *
 * `checkedIds` — тайтлы с каналом `notify_new_episodes`, то есть ровно те,
 * которые браузер умеет проверять. Проверять их он может по Shikimori
 * (`episodes_aired`), и никаких других чисел у него нет.
 *
 * Поэтому устаревшим может быть ТОЛЬКО браузерное уведомление. Запись
 * `source: 'dub'` сюда не попадает по построению: у неё нет смысла в
 * `checkedIds` — она пришла от ожидания озвучки, и браузер про неё ничего не
 * знает. Раньше проверки источника не было, и уведомление об озвучке у
 * человека, подписавшегося ТОЛЬКО на озвучку из плеера, молча пропадало из
 * колокольчика целиком, хотя строка в БД оставалась.
 */
export function isStaleSubscriptionUpdate(
  update: EpisodeUpdateLike,
  checkedIds: Iterable<string>,
): boolean {
  if (update.source !== "shikimori") return false
  const validIds = new Set(Array.from(checkedIds, String))
  return !validIds.has(String(update.animeId))
}

/** Оставить в колокольчике то, что ещё имеет смысл. */
export function keepLiveSubscriptionUpdates<T extends EpisodeUpdateLike>(
  updates: T[],
  checkedIds: Iterable<string>,
): T[] {
  const ids = Array.from(checkedIds, String)
  return updates.filter((update) => !isStaleSubscriptionUpdate(update, ids))
}

/* ------------------------------------------------------------------ */
/* Слияние каналов                                                    */
/* ------------------------------------------------------------------ */

/**
 * Права каналов при повторном подписывании.
 *
 * Два места создают подписку с разными обещаниями: плашка в плеере обещает
 * только озвучку (`notify_dub`), а кнопка «Следить за тайтлом» — серии и
 * озвучку. Если каждое из них писало строку целиком, вторая запись стирала бы
 * канал первой: подписался на серии, потом открыл плеер и нажал «Уведомить
 * меня» — и ожидание новых серий молча отменялось.
 *
 * Правило простое: явная подписка не отменяется побочным действием.
 * Поэтому обещанное всегда остаётся, а добавиться может только новое.
 */
export function mergeSubscriptionChannels(
  existing: Pick<TitleSubscription, "notifyNewEpisodes" | "notifyDub"> | null | undefined,
  incoming: Pick<TitleSubscription, "notifyNewEpisodes" | "notifyDub">,
): Pick<TitleSubscription, "notifyNewEpisodes" | "notifyDub"> {
  return {
    notifyNewEpisodes: Boolean(existing?.notifyNewEpisodes) || Boolean(incoming.notifyNewEpisodes),
    notifyDub: Boolean(existing?.notifyDub) || Boolean(incoming.notifyDub),
  }
}

/* ------------------------------------------------------------------ */
/* Ссылки                                                              */
/* ------------------------------------------------------------------ */

/** Страница тайтла. */
export function getSubscriptionWatchPath(subscription: TitleSubscription): string {
  return getWatchPath(subscription.animeId, subscription.animeTitle)
}

/**
 * Ссылка на страницу с уже открытой кнопкой подписки.
 *
 * Сценарий: человек в боте нажал «подписаться», бот отдал deep-link на
 * сайт, чтобы подтвердить подписку кликом. Без этого параметра он попал бы
 * на обычную страницу тайтла и не понял бы, что от него ждут.
 */
export function getSubscriptionConfirmPath(subscription: TitleSubscription): string {
  return `${getWatchPath(subscription.animeId, subscription.animeTitle)}?${SUBSCRIBE_DEEP_LINK_PARAM}=1`
}

/**
 * Собрать deep-link на конкретный тайтл для телеграм-бота.
 *
 * `start`-параметр у Telegram ограничен 64 байтами, поэтому сюда попадает
 * только id тайтла: название пусть бот берёт из БД, у него оно уже есть.
 */
export function buildSubscribeStartPayload(animeId: string): string | null {
  const id = String(animeId ?? "").trim()
  if (!id || id.length > 32) return null
  return `sub_${id}`
}

/** Разобрать `start`-payload вида `sub_12345`. */
export function parseSubscribeStartPayload(
  payload: string | null | undefined,
): string | null {
  const value = String(payload ?? "").trim()
  if (!value.startsWith("sub_")) return null
  const id = value.slice(4).trim()
  return id || null
}

/* ------------------------------------------------------------------ */
/* Отложенное намерение гостя                                          */
/* ------------------------------------------------------------------ */

/**
 * Намерение гостя — то, что он нажал, до того как мы узнаем его аккаунт.
 *
 * Каналы и baseline здесь опциональны: `rememberPendingSubscription`
 * подставляет дефолты сам, а вызывающая сторона (плашка, карточка каталога,
 * deep-link от бота) передаёт то, что знает, а не полный набор ради
 * соответствия типу.
 */
export interface PendingSubscriptionIntent {
  animeId: string
  animeTitle?: string | null
  poster?: string | null
  notifyNewEpisodes?: boolean
  notifyDub?: boolean
  baselineEpisode?: number
  /** Когда гость нажал кнопку. По умолчанию — сейчас. */
  ts?: number
}

export type StoredPendingSubscription = TitleSubscription & { ts: number }

type PendingMap = Record<string, StoredPendingSubscription>

function readPendingMap(): PendingMap {
  if (typeof window === "undefined") return {}
  try {
    const raw = window.localStorage.getItem(PENDING_SUBSCRIPTIONS_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {}
    return parsed as PendingMap
  } catch {
    return {}
  }
}

function writePendingMap(map: PendingMap): void {
  if (typeof window === "undefined") return
  try {
    if (Object.keys(map).length === 0) {
      window.localStorage.removeItem(PENDING_SUBSCRIPTIONS_STORAGE_KEY)
      return
    }
    window.localStorage.setItem(PENDING_SUBSCRIPTIONS_STORAGE_KEY, JSON.stringify(map))
  } catch {
    /* private mode / quota */
  }
}

/** Запомнить намерение гостя (повторный клик по тайтлу перезаписывает). */
export function rememberPendingSubscription(intent: PendingSubscriptionIntent): void {
  if (typeof window === "undefined") return
  const animeId = String(intent?.animeId || "").trim()
  if (!animeId) return

  const map = readPendingMap()
  map[animeId] = {
    animeId,
    animeTitle: intent.animeTitle || `Аниме #${animeId}`,
    poster: intent.poster ?? null,
    notifyNewEpisodes: intent.notifyNewEpisodes !== false,
    notifyDub: intent.notifyDub !== false,
    // `?? 0` написан явно: `Math.floor(undefined)` даёт NaN, и без него
    // отсутствие значения молча зависело бы от того, что `NaN || 0` спасает.
    baselineEpisode: Math.max(0, Math.floor(intent.baselineEpisode ?? 0) || 0),
    ts: Number.isFinite(intent.ts) ? Number(intent.ts) : Date.now(),
  }

  // Свежие намерения важнее старых.
  const entries = Object.values(map).sort((a, b) => (b.ts || 0) - (a.ts || 0))
  const trimmed: PendingMap = {}
  entries.slice(0, PENDING_SUBSCRIPTIONS_LIMIT).forEach((entry) => {
    trimmed[entry.animeId] = entry
  })
  writePendingMap(trimmed)
}

/** Живые (не протухшие) намерения гостя. */
export function readPendingSubscriptions(now: number = Date.now()): StoredPendingSubscription[] {
  const map = readPendingMap()
  const alive = Object.values(map).filter(
    (intent) => Number.isFinite(intent?.ts) && now - intent.ts < PENDING_SUBSCRIPTION_TTL_MS,
  )

  // Протухшие вычищаем сразу, чтобы не тащить мусор в аккаунт.
  if (alive.length !== Object.keys(map).length) {
    const next: PendingMap = {}
    alive.forEach((intent) => {
      next[intent.animeId] = intent
    })
    writePendingMap(next)
  }

  return alive.sort((a, b) => (b.ts || 0) - (a.ts || 0))
}

/** Убрать намерение (после успешного сохранения подписки в аккаунт). */
export function clearPendingSubscription(animeId: string): void {
  if (typeof window === "undefined") return
  const map = readPendingMap()
  if (!(animeId in map)) return
  delete map[animeId]
  writePendingMap(map)
}

/** Убрать все намерения (после синхронизации при входе). */
export function clearPendingSubscriptions(animeIds?: string[]): void {
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