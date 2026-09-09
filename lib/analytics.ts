/**
 * Consent-gated Umami client. We own pageviews and DOM events: the deployed
 * v3.0.3 tracker misses popstate and cannot uninstall its automatic listeners.
 * Keep one manual-mode tracker per document; never collect before consent.
 * NEXT_PUBLIC_UMAMI_* must be supplied at Next.js BUILD time (see docs).
 */

/** Значения, которые Umami умеет хранить в `data` события. */
export type UmamiEventDataValue = string | number | boolean | null

export type UmamiEventData = Record<
  string,
  UmamiEventDataValue | UmamiEventDataValue[] | unknown
>

/** Минимальный контракт глобального `window.umami`, который создаёт script.js. */
export interface UmamiTrackerLike {
  track: (name?: unknown, data?: unknown) => unknown
  identify?: (id: unknown, data?: unknown) => unknown
  getSession?: () => unknown
}

declare global {
  interface Window {
    umami?: UmamiTrackerLike
    weebxBeforeSend?: (type: string, payload: Record<string, unknown>) => Record<string, unknown> | false
  }
}

/** Домен Umami по умолчанию (наш self-hosted инстанс в Coolify). */
export const DEFAULT_UMAMI_ORIGIN = "https://analytics.weeb-x.com"

/** id единственного тега трекера в ручном режиме. */
export const UMAMI_SCRIPT_TAG_ID = "umami-script"

/** Ограничения самого Umami: строка ≤ 500 символов, ≤ 50 свойств у объекта. */
const MAX_STRING_LENGTH = 500
const MAX_DATA_KEYS = 50
/** Имя события обрезается Umami после 50 символов — режем заранее. */
const MAX_EVENT_NAME_LENGTH = 50
/** События, пришедшие до загрузки трекера, держим в небольшой очереди. */
const MAX_QUEUED_EVENTS = 30

type EventContext = { url: string; title: string; referrer: string; id?: string }
type QueuedEvent =
  | { kind: "event"; name?: string; data?: UmamiEventData; context: EventContext }
  | { kind: "identify"; id: string; data?: UmamiEventData }

const queue: QueuedEvent[] = []
let scriptLoaded = false
let consentGranted = false
let identity = ""
let lastPageUrl = ""
let previousPageUrl = ""
let sending = false

/* -------------------------------------------------------------------------- */
/* Конфигурация из env (читаем лениво, но статическими выражениями —           */
/* иначе Next.js не подставит значения в клиентский бандл).                    */
/* -------------------------------------------------------------------------- */

function normalizeOrigin(raw: string): string {
  if (!raw) return DEFAULT_UMAMI_ORIGIN
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
  try {
    return new URL(withScheme).origin
  } catch {
    return DEFAULT_UMAMI_ORIGIN
  }
}

/** Хост Umami с протоколом и без слэша в конце. */
export function getUmamiOrigin(): string {
  return normalizeOrigin(process.env.NEXT_PUBLIC_UMAMI_URL || DEFAULT_UMAMI_ORIGIN)
}

/** data-website-id. Пустая строка = аналитика не настроена. */
export function getUmamiWebsiteId(): string {
  return process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID || ""
}

/** Путь к трекеру: `/script.js`, если Umami не переименовывали. */
export function getUmamiScriptPath(): string {
  const raw = process.env.NEXT_PUBLIC_UMAMI_SCRIPT_PATH || "/script.js"
  return raw.startsWith("/") ? raw : `/${raw}`
}

/** Хосты, на которых разрешён сбор (data-domains). */
export function getUmamiDomains(): string {
  return process.env.NEXT_PUBLIC_UMAMI_DOMAINS || ""
}

/** Метка окружения (data-tag). */
export function getUmamiTag(): string {
  return process.env.NEXT_PUBLIC_UMAMI_TAG || ""
}

/** Полный URL трекера, который вставляется в `<script src>`. */
export function getUmamiScriptUrl(): string {
  // Используем проксированный путь для обхода блокировщиков рекламы
  if (process.env.NODE_ENV === 'production') {
    return '/stats/tracker.js'
  }
  return `${getUmamiOrigin()}${getUmamiScriptPath()}`
}

/** Заполнен ли `NEXT_PUBLIC_UMAMI_WEBSITE_ID` — главный рубильник аналитики. */
export function isAnalyticsConfigured(): boolean {
  return Boolean(getUmamiWebsiteId())
}

/** Трекер загружен и готов принимать события. */
export function isAnalyticsActive(): boolean {
  if (!isAnalyticsEnabled() || !scriptLoaded) return false
  return typeof window.umami?.track === "function"
}

/* -------------------------------------------------------------------------- */
/* Нормализация payload под ограничения Umami                                  */
/* -------------------------------------------------------------------------- */

/**
 * `Gacha Roll!` → `gacha_roll`, `click--link` → `click_link`.
 * Umami обрезает имена после 50 символов, поэтому режем заранее.
 */
export function normalizeEventName(name: string): string {
  return String(name || "")
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase()
    .slice(0, MAX_EVENT_NAME_LENGTH)
}

function toPrimitive(value: unknown): UmamiEventDataValue {
  if (value === null || value === undefined) return null
  const type = typeof value
  if (type === "string") return String(value).slice(0, MAX_STRING_LENGTH)
  if (type === "number") {
    const num = Number(value)
    // Umami хранит числа с точностью до 4 знаков.
    return Number.isFinite(num) ? Math.round(num * 10000) / 10000 : null
  }
  if (type === "boolean") return Boolean(value)
  if (value instanceof Date) return value.toISOString()
  return String(value).slice(0, MAX_STRING_LENGTH)
}

/**
 * Приводит произвольный payload к формату, который Umami примет без обрезки:
 * отбрасывает undefined/функции, режет строки, ограничивает число полей.
 */
export function sanitizeEventData(data?: UmamiEventData): UmamiEventData | undefined {
  if (!data || typeof data !== "object") return undefined

  const result: Record<string, UmamiEventDataValue> = {}
  let keys = 0

  for (const [rawKey, value] of Object.entries(data)) {
    if (keys >= MAX_DATA_KEYS) break
    if (value === undefined) continue

    const key = rawKey.slice(0, MAX_STRING_LENGTH)
    const type = typeof value

    if (type === "function" || type === "symbol") continue

    if (Array.isArray(value)) {
      result[key] = value
        .slice(0, MAX_DATA_KEYS)
        .map((item) => toPrimitive(item))
        .join(",")
        .slice(0, MAX_STRING_LENGTH)
    } else if (value !== null && type === "object") {
      try {
        result[key] = JSON.stringify(value).slice(0, MAX_STRING_LENGTH)
      } catch {
        continue
      }
    } else {
      result[key] = toPrimitive(value)
    }

    keys += 1
  }

  return keys > 0 ? (result as UmamiEventData) : undefined
}

/* -------------------------------------------------------------------------- */
/* Очередь событий до загрузки трекера                                         */
/* -------------------------------------------------------------------------- */

/** Strip secrets from links, OAuth callbacks and referrers. Only public query keys survive. */
export function sanitizeAnalyticsUrl(raw: string): string {
  if (!raw) return ""
  try {
    const base = typeof window === "undefined" ? "https://weeb-x.com" : window.location.origin
    const url = new URL(raw, base)
    if (!["http:", "https:"].includes(url.protocol)) return ""
    url.username = ""
    url.password = ""
    url.hash = ""
    url.pathname = url.pathname.replace(/^\/r\/[^/]+/, "/r/[code]")
    const allowed = /^(utm_(source|medium|campaign|term|content)|search|q|page|sort|genre|year|season|status|type|kind|score|episode)$/
    for (const key of [...url.searchParams.keys()]) {
      if (!allowed.test(key)) url.searchParams.delete(key)
    }
    return url.origin === base ? url.pathname + url.search : url.href
  } catch {
    return ""
  }
}

/** Consent and domain gate, including while script.js is still loading. */
export function isAnalyticsEnabled(): boolean {
  if (typeof window === "undefined" || !consentGranted || !isAnalyticsConfigured()) return false
  const domains = getUmamiDomains().split(",").map(value => value.trim()).filter(Boolean)
  if (domains.length && !domains.includes(window.location.hostname)) return false
  try {
    if (window.localStorage.getItem("umami.disabled")) return false
  } catch { /* storage can be unavailable */ }
  return true
}

function context(url?: string, title?: string): EventContext {
  return {
    url: sanitizeAnalyticsUrl(url ?? window.location.href),
    title: (title ?? document.title).slice(0, MAX_STRING_LENGTH),
    referrer: previousPageUrl || sanitizeAnalyticsUrl(document.referrer),
    id: identity || undefined,
  }
}

function enqueue(event: QueuedEvent): void {
  if (queue.length >= MAX_QUEUED_EVENTS) {
    const oldestEvent = queue.findIndex(item => item.kind === "event")
    queue.splice(Math.max(0, oldestEvent), 1)
  }
  queue.push(event)
  flushQueue()
}

// Serialize requests: the server's first response establishes the session cache.
// Concurrent identify/pageview requests can otherwise split a visitor's funnel.
function flushQueue(): void {
  if (sending || !isAnalyticsActive()) return
  const tracker = window.umami!
  const event = queue.shift()
  if (!event) return
  sending = true
  let result: unknown
  try {
    result = event.kind === "identify"
      ? tracker.identify?.(event.id, event.data)
      : tracker.track((base: Record<string, unknown>) => ({
          ...base,
          ...event.context,
          ...(event.name ? { name: event.name, data: event.data } : {}),
        }))
  } catch { /* analytics must not break the app */ }
  Promise.resolve(result).catch(() => {}).finally(() => {
    sending = false
    flushQueue()
  })
}

export interface LoadAnalyticsOptions {
  domains?: string
  tag?: string
}

/** Called only after explicit analytics consent. One tracker, no native listeners. */
export function loadAnalyticsScript(options: LoadAnalyticsOptions = {}): void {
  if (typeof document === "undefined" || !isAnalyticsConfigured()) return
  const resuming = !consentGranted && Boolean(document.getElementById(UMAMI_SCRIPT_TAG_ID))
  consentGranted = true
  // Also protects direct window.umami calls, not just our public API.
  window.weebxBeforeSend = (_type, payload) => {
    if (!isAnalyticsEnabled()) return false
    return {
      ...payload,
      url: sanitizeAnalyticsUrl(String(payload.url ?? "")),
      referrer: sanitizeAnalyticsUrl(String(payload.referrer ?? "")),
    }
  }
  if (document.getElementById(UMAMI_SCRIPT_TAG_ID)) {
    scriptLoaded = typeof window.umami?.track === "function"
    // Reset the old SDK identity/cache after any in-flight request settles.
    if (resuming) enqueue({ kind: "identify", id: "" })
    flushQueue()
    return
  }
  scriptLoaded = false
  const script = document.createElement("script")
  script.id = UMAMI_SCRIPT_TAG_ID
  script.src = getUmamiScriptUrl()
  script.async = true
  script.setAttribute("data-website-id", getUmamiWebsiteId())
  script.setAttribute("data-auto-track", "false")
  script.setAttribute("data-before-send", "weebxBeforeSend")
  // При использовании проксированного пути указываем локальный хост для API запросов
  if (process.env.NODE_ENV === 'production') {
    script.setAttribute("data-host-url", "/stats")
  }
  const domains = options.domains ?? getUmamiDomains()
  if (domains) script.setAttribute("data-domains", domains)
  const tag = options.tag ?? getUmamiTag()
  if (tag) script.setAttribute("data-tag", tag)
  script.addEventListener("load", () => {
    scriptLoaded = typeof window.umami?.track === "function"
    flushQueue()
  })
  script.addEventListener("error", () => {
    scriptLoaded = false
    script.remove() // a subsequent consent/load attempt can retry
    queue.length = 0
  })
  document.head.appendChild(script)
}

/** Stop collecting immediately. An already in-flight HTTP request cannot be recalled. */
export function unloadAnalyticsScript(): void {
  consentGranted = false
  queue.length = 0
  identity = ""
  lastPageUrl = ""
  previousPageUrl = ""
  // Keep the singleton in manual mode. Removing a script cannot undo executed JS.
  // Do not release the send lock: re-consent must wait for the old response,
  // otherwise it can overwrite the new identity's session cache.
}

/** No pre-consent buffering; permitted events retain the URL/identity at event time. */
export function trackEvent(name: string, data?: UmamiEventData, url?: string): void {
  if (!isAnalyticsEnabled()) return
  const eventName = normalizeEventName(name)
  if (!eventName) return
  enqueue({ kind: "event", name: eventName, data: sanitizeEventData(data), context: context(url) })
}

/** Owned by AnalyticsWrapper, including initial, query-only and back/forward navigation. */
export function trackPageview(url?: string, title?: string): void {
  if (!isAnalyticsEnabled()) return
  const nextUrl = sanitizeAnalyticsUrl(url ?? window.location.href)
  if (nextUrl === lastPageUrl) return
  previousPageUrl = lastPageUrl
  lastPageUrl = nextUrl
  enqueue({ kind: "event", context: context(nextUrl, title) })
}

/** Supabase UUID is pseudonymous personal data, never email/password. Empty id resets logout. */
export function identifyUser(id: string, data?: UmamiEventData): void {
  if (!isAnalyticsEnabled() || id === identity) return
  identity = id
  enqueue({ kind: "identify", id, data: sanitizeEventData(data) })
}

/**
 * Канонические имена событий. Держим в одном месте, чтобы в дашборде Umami
 * не расплодились `click` / `Click` / `click-button`.
 */
export const AnalyticsEvent = {
  CLICK: "click",
  FORM_SUBMIT: "form_submit",
  CONTROL_CHANGE: "control_change",
  PLAYER_CHANGE: "player_change",
  CATALOG_FILTER: "catalog_filter",
  VIDEO_PLAY: "video_play",
  VIDEO_PAUSE: "video_pause",
  VIDEO_COMPLETE: "video_complete",
  VIDEO_PROGRESS: "video_progress",
  ENGAGEMENT: "engagement",
  SEARCH: "search_query",
  /** Алиас: весь поиск (каталог, навбар, манга) шлётся как `search_query`
   *  с полем `source`. Старое имя SEARCH оставлено для совместимости. */
  SEARCH_QUERY: "search_query",
  BOOKMARK_ADD: "bookmark_add",
  BOOKMARK_REMOVE: "bookmark_remove",
  HISTORY_CLEAR: "history_clear",
  HISTORY_REMOVE: "history_remove",
  EPISODE_PLAY: "episode_play",
  EPISODE_CHANGE: "episode_change",
  GACHA_ROLL: "gacha_roll",
  GACHA_CARD_REVEALED: "gacha_card_revealed",
  GACHA_DISMANTLE: "gacha_dismantle",
  GACHA_BULK_DISMANTLE: "gacha_bulk_dismantle",
  GACHA_PACK_OPEN: "gacha_pack_open",
  MARKET_BUY: "market_buy",
  MARKET_LIST: "market_list",
  MARKET_CANCEL: "market_cancel",
  INBOX_CLAIM: "inbox_claim",
  BATTLE_START: "battle_started",
  BATTLE_END: "battle_end",
  PVP_START: "pvp_started",
  PVP_END: "pvp_end",
  AUTH_SIGN_IN: "auth_sign_in",
  AUTH_SIGN_UP: "auth_sign_up",
  AUTH_SIGN_OUT: "auth_sign_out",
  AUTH_PASSWORD_RESET: "auth_password_reset",
  MANGA_CHAPTER_OPEN: "manga_chapter_open",
  GIFT_CARD_REDEEM: "gift_card_redeem",
  REFERRAL_COPY: "referral_copy",
  LAMPA_ACTIVATE: "lampa_activate",
  LAMPA_ACTIVATE_ERROR: "lampa_activate_error",
  GIFT_CARD_ALREADY_CLAIMED: "gift_card_already_claimed",
} as const

export type AnalyticsEventName = (typeof AnalyticsEvent)[keyof typeof AnalyticsEvent]
