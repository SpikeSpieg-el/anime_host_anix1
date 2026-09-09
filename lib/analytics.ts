/**
 * Umami — self-hosted аналитика (поднимается в Coolify на https://analytics.weeb-x.com).
 *
 * Модуль не зависит от React, поэтому его можно импортировать из любых
 * клиентских компонентов, хуков и «чистых» модулей (например из
 * `account-stats-recorder.ts`). Все функции безопасны на сервере и до
 * загрузки трекера: они либо no-op, либо кладут событие во внутреннюю
 * очередь, которая уходит в Umami сразу после инициализации скрипта.
 *
 * Что делает сам трекер Umami (`/script.js` на нашем хосте):
 *   - присылает pageview при загрузке и автоматически на pushState /
 *     replaceState / popstate (SPA-навигация Next.js покрыта из коробки,
 *     вручную pageview слать НЕ нужно — будут дубли);
 *   - трекает клики по элементам с атрибутом `data-umami-event`;
 *   - шлёт Web Vitals (TTFB/FCP/LCP/CLS/INP) при `data-performance="true"`.
 *
 * Переменные окружения (задаются в Coolify → Environment Variables):
 *   NEXT_PUBLIC_UMAMI_WEBSITE_ID — data-website-id из Settings → Websites
 *                                  (без него аналитика выключена)
 *   NEXT_PUBLIC_UMAMI_URL        — опционально, по умолчанию https://analytics.weeb-x.com
 *   NEXT_PUBLIC_UMAMI_SCRIPT_PATH— опционально, по умолчанию /script.js
 *                                  (меняется вместе с TRACKER_SCRIPT_NAME в Umami)
 *   NEXT_PUBLIC_UMAMI_DOMAINS    — опционально, список хостов через запятую,
 *                                  на которых разрешён сбор (data-domains)
 *   NEXT_PUBLIC_UMAMI_TAG        — опционально, метка окружения (data-tag),
 *                                  например production / staging
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
  }
}

/** Домен Umami по умолчанию (наш self-hosted инстанс в Coolify). */
export const DEFAULT_UMAMI_ORIGIN = "https://analytics.weeb-x.com"

/** id тега со скриптом трекера — по нему находим и убираем его при отзыве согласия. */
export const UMAMI_SCRIPT_TAG_ID = "umami-script"

/** Ограничения самого Umami: строка ≤ 500 символов, ≤ 50 свойств у объекта. */
const MAX_STRING_LENGTH = 500
const MAX_DATA_KEYS = 50
/** Имя события обрезается Umami после 50 символов — режем заранее. */
const MAX_EVENT_NAME_LENGTH = 50
/** События, пришедшие до загрузки трекера, держим в небольшой очереди. */
const MAX_QUEUED_EVENTS = 30

type QueuedEvent =
  | { kind: "event"; name: string; data?: UmamiEventData }
  | { kind: "identify"; id: string; data?: UmamiEventData }

const queue: QueuedEvent[] = []
let scriptLoaded = false

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
  return `${getUmamiOrigin()}${getUmamiScriptPath()}`
}

/** Заполнен ли `NEXT_PUBLIC_UMAMI_WEBSITE_ID` — главный рубильник аналитики. */
export function isAnalyticsConfigured(): boolean {
  return Boolean(getUmamiWebsiteId())
}

/** Трекер загружен и готов принимать события. */
export function isAnalyticsActive(): boolean {
  if (typeof window === "undefined" || !scriptLoaded) return false
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

function enqueue(event: QueuedEvent): void {
  if (queue.length >= MAX_QUEUED_EVENTS) queue.shift()
  queue.push(event)
}

function flushQueue(): void {
  const tracker = typeof window !== "undefined" ? window.umami : undefined
  if (!tracker?.track) return

  while (queue.length > 0) {
    const event = queue.shift()
    if (!event) break
    try {
      if (event.kind === "identify") {
        if (typeof tracker.identify === "function") void tracker.identify(event.id, event.data)
      } else {
        void tracker.track(event.name, event.data)
      }
    } catch {
      /* аналитика не должна ломать приложение */
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Загрузка / выгрузка трекера (по согласию на cookies)                        */
/* -------------------------------------------------------------------------- */

export interface LoadAnalyticsOptions {
  /** data-domains: хосты, на которых разрешён сбор. Пусто = все. */
  domains?: string
  /** data-tag: метка окружения. */
  tag?: string
  /** data-performance: сбор Web Vitals. По умолчанию включён. */
  performance?: boolean
}

/**
 * Вставляет `<script src="{umami}/script.js" data-website-id="...">` в `<head>`.
 * Повторные вызовы безопасны: второй вызов просто ничего не делает.
 */
export function loadAnalyticsScript(options: LoadAnalyticsOptions = {}): void {
  if (typeof document === "undefined") return
  if (!isAnalyticsConfigured()) return
  if (document.getElementById(UMAMI_SCRIPT_TAG_ID)) {
    scriptLoaded = typeof window !== "undefined" && typeof window.umami?.track === "function"
    return
  }

  const script = document.createElement("script")
  script.id = UMAMI_SCRIPT_TAG_ID
  script.src = getUmamiScriptUrl()
  script.async = true
  script.defer = true
  script.setAttribute("data-website-id", getUmamiWebsiteId())

  const domains = options.domains ?? getUmamiDomains()
  if (domains) script.setAttribute("data-domains", domains)

  const tag = options.tag ?? getUmamiTag()
  if (tag) script.setAttribute("data-tag", tag)

  // Web Vitals (TTFB/FCP/LCP/CLS/INP) — полезно и дёшево.
  if (options.performance !== false) script.setAttribute("data-performance", "true")

  script.addEventListener("load", () => {
    scriptLoaded = true
    flushQueue()
  })
  script.addEventListener("error", () => {
    // Блокировщик рекламы или недоступный хост — молча живём дальше.
    scriptLoaded = false
  })

  document.head.appendChild(script)
}

/** Убирает трекер (пользователь отозвал согласие на аналитику). */
export function unloadAnalyticsScript(): void {
  scriptLoaded = false
  queue.length = 0
  if (typeof document === "undefined") return
  document.getElementById(UMAMI_SCRIPT_TAG_ID)?.remove()
  // Удаляем и сам объект трекера: иначе уже навешанные им слушатели
  // (авто-pageview на history API) продолжат слать данные, а повторная
  // загрузка скрипта задвоит pageview.
  if (typeof window !== "undefined") {
    try {
      delete window.umami
    } catch {
      /* ignore */
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Публичное API                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Отправляет именованное событие в Umami.
 *
 *   trackEvent("gacha_roll", { rarity: "UR", pack: "2024" })
 *
 * До загрузки трекера событие попадает в очередь, после — уходит сразу.
 * Если `NEXT_PUBLIC_UMAMI_WEBSITE_ID` не задан или пользователь не принял
 * аналитические cookie — это no-op.
 */
export function trackEvent(name: string, data?: UmamiEventData): void {
  const eventName = normalizeEventName(name)
  if (!eventName) return

  const payload = sanitizeEventData(data)

  if (typeof window === "undefined" || !isAnalyticsConfigured()) return

  if (!isAnalyticsActive()) {
    enqueue({ kind: "event", name: eventName, data: payload })
    return
  }

  try {
    void window.umami?.track(eventName, payload)
  } catch {
    /* аналитика не должна ломать приложение */
  }
}

/**
 * Ручной pageview. В App Router обычно НЕ нужен: трекер сам ловит
 * pushState/replaceState. Используется только для «виртуальных» страниц,
 * которых нет в URL (открытый модал, шаг мастера).
 */
export function trackPageview(url?: string, title?: string): void {
  if (typeof window === "undefined" || !isAnalyticsActive()) return
  try {
    void window.umami?.track({
      website: getUmamiWebsiteId(),
      url: url || window.location.pathname + window.location.search,
      title: title || document.title,
    })
  } catch {
    /* no-op */
  }
}

/**
 * Привязывает посетителя к стабильному внутреннему идентификатору
 * (UUID пользователя Supabase — без email и прочих PII).
 */
export function identifyUser(id: string, data?: UmamiEventData): void {
  if (typeof window === "undefined" || !isAnalyticsConfigured() || !id) return

  const payload = sanitizeEventData(data)

  if (!isAnalyticsActive()) {
    enqueue({ kind: "identify", id, data: payload })
    return
  }

  const identify = window.umami?.identify
  if (typeof identify !== "function") return
  try {
    void identify(id, payload)
  } catch {
    /* no-op */
  }
}

/**
 * Канонические имена событий. Держим в одном месте, чтобы в дашборде Umami
 * не расплодились `click` / `Click` / `click-button`.
 */
export const AnalyticsEvent = {
  CLICK: "click",
  FORM_SUBMIT: "form_submit",
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
} as const

export type AnalyticsEventName = (typeof AnalyticsEvent)[keyof typeof AnalyticsEvent]
