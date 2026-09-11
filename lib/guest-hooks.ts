/**
 * Контекстные «крючки» конверсии гостей → регистрация.
 * Связывают просмотр/навигацию с уникальными фичами Weebx (гача, PvP, уведомления).
 *
 * Частота: cooldown + session cap, чтобы не спамить и не перекрывать плеер.
 */

import { AnalyticsEvent, trackEvent, type UmamiEventData } from "@/lib/analytics"

/** Идентификаторы крючков — стабильные имена для Umami Goals / Funnels. */
export const GuestHookId = {
  STARTER_PACK: "starter_pack",
  CHIBI_REWARDS: "chibi_rewards",
  TITLE_DECK: "title_deck",
  ONGOING_BELL: "ongoing_bell",
  ARENA_MARKET: "arena_market",
} as const

export type GuestHookIdValue = (typeof GuestHookId)[keyof typeof GuestHookId]

export type GuestHookSurface = "banner" | "modal" | "chibi" | "gate"

export interface GuestHookCopy {
  badge: string
  title: string
  description: string
  cta: string
  /** Вторичная кнопка (обычно «Войти»). */
  secondaryCta?: string
}

/** Контент крючков (RU). */
export const GUEST_HOOK_COPY: Record<GuestHookIdValue, GuestHookCopy> = {
  [GuestHookId.STARTER_PACK]: {
    badge: "Стартовый бонус",
    title: "Забери 10 000 монет и стартовый пак",
    description:
      "Создай профиль за 10 секунд и получи приветственную валюту — хватит, чтобы выбить персонажей ранга Legendary или Omnipotent.",
    cta: "Забрать",
    secondaryCta: "Войти",
  },
  [GuestHookId.CHIBI_REWARDS]: {
    badge: "Награды за просмотр",
    title: "Эй, ты смотришь без наград!",
    description:
      "За каждую просмотренную серию начисляется пыль для крафта карт и немного монет для круток. Зарегистрируйся, чтобы опыт не сгорал впустую!",
    cta: "Начать копить награды",
    secondaryCta: "Войти",
  },
  [GuestHookId.TITLE_DECK]: {
    badge: "Коллекция тайтла",
    title: "Нравятся персонажи этого аниме?",
    description:
      "Собери их карточки в свою колоду из 8 карт и испытай связки в PvP-арене против других зрителей Weebx.",
    cta: "Собрать колоду",
    secondaryCta: "Войти",
  },
  [GuestHookId.ONGOING_BELL]: {
    badge: "Выход новых серий",
    title: "Не пропусти новую серию в любимой озвучке",
    description:
      "Этот тайтл ещё выходит. Авторизуйся, чтобы Weebx уведомил тебя сразу, как только выйдет следующий эпизод.",
    cta: "Включить уведомления",
    secondaryCta: "Войти",
  },
  [GuestHookId.ARENA_MARKET]: {
    badge: "Сезонная Арена",
    title: "Ворвись в карточные битвы Weebx",
    description:
      "Сражайся в PvP реального времени, продавай редкие карты на маркете и поднимайся из Бронзы в Грандмастер.",
    cta: "Создать профиль игрока",
    secondaryCta: "Войти",
  },
}

const DISMISS_STORAGE_KEY = "weebx_guest_hooks_dismissed"
const SESSION_SHOWN_KEY = "weebx_guest_hooks_session"
/** Cooldown после dismiss (мс) — 24 часа. */
export const GUEST_HOOK_COOLDOWN_MS = 24 * 60 * 60 * 1000
/** Максимум показов разных крючков за одну сессию вкладки. */
export const GUEST_HOOK_SESSION_CAP = 3

type DismissMap = Record<string, number>
type SessionMap = Record<string, number>

function readJson<T>(storage: Storage, key: string, fallback: T): T {
  try {
    const raw = storage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function writeJson(storage: Storage, key: string, value: unknown): void {
  try {
    storage.setItem(key, JSON.stringify(value))
  } catch {
    /* private mode / quota */
  }
}

/** Можно ли показывать крючок гостю (cooldown + session cap). */
export function canShowGuestHook(hookId: GuestHookIdValue, now = Date.now()): boolean {
  if (typeof window === "undefined") return false

  const dismissed = readJson<DismissMap>(localStorage, DISMISS_STORAGE_KEY, {})
  const lastDismiss = dismissed[hookId]
  if (typeof lastDismiss === "number" && now - lastDismiss < GUEST_HOOK_COOLDOWN_MS) {
    return false
  }

  const session = readJson<SessionMap>(sessionStorage, SESSION_SHOWN_KEY, {})
  // Уже показывали этот крючок в сессии — не спамим повторно
  if (session[hookId]) return false
  if (Object.keys(session).length >= GUEST_HOOK_SESSION_CAP) return false

  return true
}

/** Фиксируем показ в sessionStorage (для session cap). */
export function markGuestHookShown(hookId: GuestHookIdValue, now = Date.now()): void {
  if (typeof window === "undefined") return
  const session = readJson<SessionMap>(sessionStorage, SESSION_SHOWN_KEY, {})
  if (!session[hookId]) {
    session[hookId] = now
    writeJson(sessionStorage, SESSION_SHOWN_KEY, session)
  }
}

/** Dismiss → cooldown 24ч. */
export function dismissGuestHook(hookId: GuestHookIdValue, now = Date.now()): void {
  if (typeof window === "undefined") return
  const dismissed = readJson<DismissMap>(localStorage, DISMISS_STORAGE_KEY, {})
  dismissed[hookId] = now
  writeJson(localStorage, DISMISS_STORAGE_KEY, dismissed)
}

/** Сброс cooldown (для тестов / отладки). */
export function resetGuestHookState(hookId?: GuestHookIdValue): void {
  if (typeof window === "undefined") return
  if (!hookId) {
    try {
      localStorage.removeItem(DISMISS_STORAGE_KEY)
      sessionStorage.removeItem(SESSION_SHOWN_KEY)
    } catch {
      /* ignore */
    }
    return
  }
  const dismissed = readJson<DismissMap>(localStorage, DISMISS_STORAGE_KEY, {})
  delete dismissed[hookId]
  writeJson(localStorage, DISMISS_STORAGE_KEY, dismissed)
  const session = readJson<SessionMap>(sessionStorage, SESSION_SHOWN_KEY, {})
  delete session[hookId]
  writeJson(sessionStorage, SESSION_SHOWN_KEY, session)
}

export type GuestHookAction = "view" | "cta" | "dismiss" | "secondary_cta" | "auth_open"

export interface TrackGuestHookOptions {
  hookId: GuestHookIdValue
  action: GuestHookAction
  surface?: GuestHookSurface
  /** Точка контакта: watch, gacha, battle, bookmark, chibi, navbar… */
  trigger?: string
  animeId?: string
  animeTitle?: string
  animeStatus?: string
  extra?: UmamiEventData
}

/**
 * Единая точка трекинга крючков для Umami.
 * События:
 *  - guest_hook_view / guest_hook_cta / guest_hook_dismiss / guest_hook_auth_open
 * Всегда содержат hook_id — удобно фильтровать в Behavior → Events.
 */
export function trackGuestHook(options: TrackGuestHookOptions): void {
  const { hookId, action, surface, trigger, animeId, animeTitle, animeStatus, extra } = options

  const eventName =
    action === "view"
      ? AnalyticsEvent.GUEST_HOOK_VIEW
      : action === "dismiss"
        ? AnalyticsEvent.GUEST_HOOK_DISMISS
        : action === "auth_open" || action === "cta" || action === "secondary_cta"
          ? action === "auth_open"
            ? AnalyticsEvent.GUEST_HOOK_AUTH_OPEN
            : AnalyticsEvent.GUEST_HOOK_CTA
          : AnalyticsEvent.GUEST_HOOK_VIEW

  const data: UmamiEventData = {
    hook_id: hookId,
    action,
    ...(surface ? { surface } : {}),
    ...(trigger ? { trigger } : {}),
    ...(animeId ? { anime_id: animeId } : {}),
    ...(animeTitle ? { anime_title: animeTitle } : {}),
    ...(animeStatus ? { anime_status: animeStatus } : {}),
    ...extra,
  }

  trackEvent(eventName, data)

  // Дублируем CTA как auth_open для воронки «показ → клик → регистрация»
  if (action === "cta" || action === "secondary_cta") {
    trackEvent(AnalyticsEvent.GUEST_HOOK_AUTH_OPEN, {
      hook_id: hookId,
      action,
      ...(surface ? { surface } : {}),
      ...(trigger ? { trigger } : {}),
    })
  }
}

/** sessionStorage-ключ источника регистрации (подхватывается auth-modal). */
export const GUEST_HOOK_AUTH_SOURCE_KEY = "weebx_guest_hook_auth_source"

/** Запоминаем, с какого крючка открыли AuthModal — для auth_sign_up.hook_id. */
export function setGuestHookAuthSource(hookId: GuestHookIdValue, trigger?: string): void {
  if (typeof window === "undefined") return
  try {
    sessionStorage.setItem(
      GUEST_HOOK_AUTH_SOURCE_KEY,
      JSON.stringify({ hook_id: hookId, trigger: trigger ?? null, ts: Date.now() }),
    )
  } catch {
    /* ignore */
  }
}

export function consumeGuestHookAuthSource(): { hook_id: GuestHookIdValue; trigger?: string } | null {
  if (typeof window === "undefined") return null
  try {
    const raw = sessionStorage.getItem(GUEST_HOOK_AUTH_SOURCE_KEY)
    if (!raw) return null
    sessionStorage.removeItem(GUEST_HOOK_AUTH_SOURCE_KEY)
    const parsed = JSON.parse(raw) as { hook_id?: string; trigger?: string | null }
    if (!parsed?.hook_id) return null
    const valid = Object.values(GuestHookId).includes(parsed.hook_id as GuestHookIdValue)
    if (!valid) return null
    return {
      hook_id: parsed.hook_id as GuestHookIdValue,
      trigger: parsed.trigger ?? undefined,
    }
  } catch {
    return null
  }
}

/** Ongoing / онгоинг по статусу Shikimori (нормализованному). */
export function isOngoingStatus(status?: string | null): boolean {
  if (!status) return false
  const s = status.toLowerCase()
  return s === "ongoing" || s.includes("онгоинг") || s === "currently_airing"
}

/** CustomEvent имена для глобальной шины крючков. */
export const GUEST_HOOK_EVENTS = {
  SHOW: "weebx-guest-hook-show",
  OPEN_AUTH: "open-auth-modal",
} as const

export interface GuestHookShowDetail {
  hookId: GuestHookIdValue
  surface?: GuestHookSurface
  trigger?: string
  animeId?: string
  animeTitle?: string
  animeStatus?: string
  /** Принудительно (игнорирует session cap, но не cooldown dismiss). */
  force?: boolean
}

/** Показать крючок через глобальный провайдер. */
export function requestGuestHook(detail: GuestHookShowDetail): void {
  if (typeof window === "undefined") return
  window.dispatchEvent(new CustomEvent(GUEST_HOOK_EVENTS.SHOW, { detail }))
}

/**
 * Открыть AuthModal с источником-крючком.
 * @param opts.openGlobalModal — диспатч `open-auth-modal` (navbar).
 *   false, если компонент уже рендерит свой AuthModal.
 */
export function openAuthFromGuestHook(
  hookId: GuestHookIdValue,
  opts?: {
    mode?: "login" | "register"
    trigger?: string
    surface?: GuestHookSurface
    openGlobalModal?: boolean
  },
): void {
  const mode = opts?.mode ?? "register"
  const openGlobal = opts?.openGlobalModal !== false
  setGuestHookAuthSource(hookId, opts?.trigger)
  trackGuestHook({
    hookId,
    action: mode === "login" ? "secondary_cta" : "cta",
    surface: opts?.surface,
    trigger: opts?.trigger,
  })
  if (openGlobal && typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(GUEST_HOOK_EVENTS.OPEN_AUTH, {
        detail: { mode, hookId },
      }),
    )
  }
}
