import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  GUEST_HOOK_COPY,
  GUEST_HOOK_EVENTS,
  GUEST_HOOK_SESSION_CAP,
  GuestHookId,
  canShowGuestHook,
  consumeGuestHookAuthSource,
  dismissGuestHook,
  isCookieConsentDecided,
  isOngoingStatus,
  markGuestHookShown,
  openAuthFromGuestHook,
  requestGuestHook,
  resetGuestHookState,
  setGuestHookAuthSource,
  setGuestHookToastVisibility,
  trackGuestHook,
} from "@/lib/guest-hooks"
import { AnalyticsEvent, loadAnalyticsScript, unloadAnalyticsScript, UMAMI_SCRIPT_TAG_ID } from "@/lib/analytics"

const WEBSITE_ID = "11111111-2222-3333-4444-555555555555"

function mockTracker() {
  const payloads: Record<string, unknown>[] = []
  const track = vi.fn((build: unknown) => {
    payloads.push(
      (build as (base: Record<string, unknown>) => Record<string, unknown>)({
        website: WEBSITE_ID,
        hostname: "localhost",
        screen: "1920x1080",
        language: "ru",
      }),
    )
    return Promise.resolve()
  })
  window.umami = { track, identify: vi.fn(() => Promise.resolve()) }
  return { track, payloads }
}

async function drain() {
  for (let i = 0; i < 40; i++) await Promise.resolve()
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_UMAMI_WEBSITE_ID", WEBSITE_ID)
  vi.stubEnv("NEXT_PUBLIC_UMAMI_URL", "")
  vi.stubEnv("NEXT_PUBLIC_UMAMI_DOMAINS", "")
  localStorage.clear()
  sessionStorage.clear()
  resetGuestHookState()
  unloadAnalyticsScript()
  document.getElementById(UMAMI_SCRIPT_TAG_ID)?.remove()
  delete window.umami
})

afterEach(() => {
  unloadAnalyticsScript()
  document.getElementById(UMAMI_SCRIPT_TAG_ID)?.remove()
  delete window.umami
  resetGuestHookState()
})

describe("GUEST_HOOK_COPY", () => {
  it("содержит все 5 крючков с CTA", () => {
    for (const id of Object.values(GuestHookId)) {
      const copy = GUEST_HOOK_COPY[id]
      expect(copy.badge.length).toBeGreaterThan(0)
      expect(copy.title.length).toBeGreaterThan(0)
      expect(copy.description.length).toBeGreaterThan(0)
      expect(copy.cta.length).toBeGreaterThan(0)
    }
  })

  it("стартовый пак упоминает 10 000 монет", () => {
    expect(GUEST_HOOK_COPY[GuestHookId.STARTER_PACK].title).toMatch(/10\s*000/)
  })
})

describe("isOngoingStatus", () => {
  it("распознаёт ongoing / Ongoing / currently_airing", () => {
    expect(isOngoingStatus("Ongoing")).toBe(true)
    expect(isOngoingStatus("ongoing")).toBe(true)
    expect(isOngoingStatus("currently_airing")).toBe(true)
    expect(isOngoingStatus("Completed")).toBe(false)
    expect(isOngoingStatus(null)).toBe(false)
  })
})

describe("frequency control", () => {
  it("разрешает показ по умолчанию", () => {
    expect(canShowGuestHook(GuestHookId.STARTER_PACK)).toBe(true)
  })

  it("блокирует после dismiss на 24ч", () => {
    dismissGuestHook(GuestHookId.CHIBI_REWARDS, Date.now())
    expect(canShowGuestHook(GuestHookId.CHIBI_REWARDS, Date.now())).toBe(false)
    expect(canShowGuestHook(GuestHookId.CHIBI_REWARDS, Date.now() + 25 * 60 * 60 * 1000)).toBe(true)
  })

  it("лимитирует число разных крючков в сессии и не повторяет уже показанный", () => {
    const ids = Object.values(GuestHookId)
    for (let i = 0; i < GUEST_HOOK_SESSION_CAP; i++) {
      markGuestHookShown(ids[i])
    }
    // Новый крючок сверх cap — нельзя
    const next = ids[GUEST_HOOK_SESSION_CAP]
    expect(canShowGuestHook(next)).toBe(false)
    // Уже показанный в сессии — тоже нельзя (anti-spam)
    expect(canShowGuestHook(ids[0])).toBe(false)
  })
})

describe("auth source attribution", () => {
  it("set/consume round-trip", () => {
    setGuestHookAuthSource(GuestHookId.TITLE_DECK, "exit_intent")
    expect(consumeGuestHookAuthSource()).toEqual({
      hook_id: GuestHookId.TITLE_DECK,
      trigger: "exit_intent",
    })
    expect(consumeGuestHookAuthSource()).toBeNull()
  })
})

describe("Umami tracking", () => {
  it("шлёт guest_hook_view / cta / dismiss с hook_id", async () => {
    const append = document.head.appendChild.bind(document.head)
    vi.spyOn(document.head, "appendChild").mockImplementation(<T extends Node>(node: T): T => {
      if (node instanceof HTMLScriptElement) node.type = "application/json"
      return append(node)
    })

    const { payloads } = mockTracker()
    loadAnalyticsScript()
    document.getElementById(UMAMI_SCRIPT_TAG_ID)?.dispatchEvent(new Event("load"))

    trackGuestHook({
      hookId: GuestHookId.STARTER_PACK,
      action: "view",
      surface: "banner",
      trigger: "watch_first_episode",
      animeId: "123",
    })
    trackGuestHook({
      hookId: GuestHookId.STARTER_PACK,
      action: "cta",
      surface: "banner",
      trigger: "watch_first_episode",
    })
    trackGuestHook({
      hookId: GuestHookId.ONGOING_BELL,
      action: "dismiss",
      surface: "banner",
    })

    await drain()

    const names = payloads.map((p) => p.name)
    expect(names).toContain(AnalyticsEvent.GUEST_HOOK_VIEW)
    expect(names).toContain(AnalyticsEvent.GUEST_HOOK_CTA)
    expect(names).toContain(AnalyticsEvent.GUEST_HOOK_AUTH_OPEN)
    expect(names).toContain(AnalyticsEvent.GUEST_HOOK_DISMISS)

    const view = payloads.find((p) => p.name === AnalyticsEvent.GUEST_HOOK_VIEW)
    expect(view?.data).toMatchObject({
      hook_id: GuestHookId.STARTER_PACK,
      action: "view",
      surface: "banner",
      trigger: "watch_first_episode",
      anime_id: "123",
    })
  })

  it("openAuthFromGuestHook диспатчит open-auth-modal", () => {
    const handler = vi.fn()
    window.addEventListener("open-auth-modal", handler)
    openAuthFromGuestHook(GuestHookId.ARENA_MARKET, {
      mode: "register",
      trigger: "pvp_gate",
      surface: "gate",
    })
    expect(handler).toHaveBeenCalled()
    const evt = handler.mock.calls[0][0] as CustomEvent
    expect(evt.detail).toMatchObject({ mode: "register", hookId: GuestHookId.ARENA_MARKET })
    expect(consumeGuestHookAuthSource()?.hook_id).toBe(GuestHookId.ARENA_MARKET)
    window.removeEventListener("open-auth-modal", handler)
  })

  it("openGlobalModal:false не диспатчит глобальную модалку", () => {
    const handler = vi.fn()
    window.addEventListener("open-auth-modal", handler)
    openAuthFromGuestHook(GuestHookId.STARTER_PACK, {
      mode: "register",
      openGlobalModal: false,
    })
    expect(handler).not.toHaveBeenCalled()
    // source всё равно записан
    expect(consumeGuestHookAuthSource()?.hook_id).toBe(GuestHookId.STARTER_PACK)
    window.removeEventListener("open-auth-modal", handler)
  })
})

describe("UI coordination bus", () => {
  it("requestGuestHook диспатчит SHOW с detail", () => {
    const handler = vi.fn()
    window.addEventListener(GUEST_HOOK_EVENTS.SHOW, handler)
    requestGuestHook({
      hookId: GuestHookId.ONGOING_BELL,
      surface: "banner",
      trigger: "bookmark_ongoing",
      animeId: "42",
    })
    expect(handler).toHaveBeenCalledTimes(1)
    const evt = handler.mock.calls[0][0] as CustomEvent
    expect(evt.detail).toMatchObject({
      hookId: GuestHookId.ONGOING_BELL,
      surface: "banner",
      trigger: "bookmark_ongoing",
      animeId: "42",
    })
    window.removeEventListener(GUEST_HOOK_EVENTS.SHOW, handler)
  })

  it("setGuestHookToastVisibility шлёт TOAST_VISIBILITY с флагом", () => {
    const handler = vi.fn()
    window.addEventListener(GUEST_HOOK_EVENTS.TOAST_VISIBILITY, handler)
    setGuestHookToastVisibility(true)
    setGuestHookToastVisibility(false)
    expect(handler).toHaveBeenCalledTimes(2)
    expect((handler.mock.calls[0][0] as CustomEvent).detail).toEqual({ visible: true })
    expect((handler.mock.calls[1][0] as CustomEvent).detail).toEqual({ visible: false })
    window.removeEventListener(GUEST_HOOK_EVENTS.TOAST_VISIBILITY, handler)
  })

  it("isCookieConsentDecided: false без ключа, true после выбора", () => {
    expect(isCookieConsentDecided()).toBe(false)
    localStorage.setItem("cookie-consent-v1", JSON.stringify({ necessary: true }))
    expect(isCookieConsentDecided()).toBe(true)
  })
})
