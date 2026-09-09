import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  AnalyticsEvent,
  DEFAULT_UMAMI_ORIGIN,
  UMAMI_SCRIPT_TAG_ID,
  getUmamiDomains,
  getUmamiOrigin,
  getUmamiScriptUrl,
  getUmamiTag,
  getUmamiWebsiteId,
  identifyUser,
  isAnalyticsActive,
  isAnalyticsConfigured,
  loadAnalyticsScript,
  normalizeEventName,
  sanitizeEventData,
  trackEvent,
  trackPageview,
  sanitizeAnalyticsUrl,
  unloadAnalyticsScript,
} from "@/lib/analytics"

const WEBSITE_ID = "11111111-2222-3333-4444-555555555555"

function scriptTag() {
  return document.getElementById(UMAMI_SCRIPT_TAG_ID) as HTMLScriptElement | null
}

/** Имитируем завершение загрузки script.js (в тестах он не скачивается). */
function markScriptLoaded() {
  scriptTag()?.dispatchEvent(new Event("load"))
}

beforeEach(() => {
  const append = document.head.appendChild.bind(document.head)
  vi.spyOn(document.head, "appendChild").mockImplementation(<T extends Node>(node: T): T => {
    if (node instanceof HTMLScriptElement) node.type = "application/json" // inert; manually emit load/error
    return append(node)
  })
  vi.stubEnv("NEXT_PUBLIC_UMAMI_WEBSITE_ID", WEBSITE_ID)
  vi.stubEnv("NEXT_PUBLIC_UMAMI_URL", "")
  vi.stubEnv("NEXT_PUBLIC_UMAMI_SCRIPT_PATH", "")
  vi.stubEnv("NEXT_PUBLIC_UMAMI_DOMAINS", "")
  vi.stubEnv("NEXT_PUBLIC_UMAMI_TAG", "")
  unloadAnalyticsScript()
  scriptTag()?.remove()
  delete window.umami
})

afterEach(() => {
  unloadAnalyticsScript()
  scriptTag()?.remove()
  delete window.umami
})

describe("конфигурация из env", () => {
  it("аналитика выключена без NEXT_PUBLIC_UMAMI_WEBSITE_ID", () => {
    vi.stubEnv("NEXT_PUBLIC_UMAMI_WEBSITE_ID", "")
    expect(getUmamiWebsiteId()).toBe("")
    expect(isAnalyticsConfigured()).toBe(false)
  })

  it("включена, когда website id задан", () => {
    expect(getUmamiWebsiteId()).toBe(WEBSITE_ID)
    expect(isAnalyticsConfigured()).toBe(true)
  })

  it("по умолчанию использует self-hosted Umami и /script.js", () => {
    expect(getUmamiOrigin()).toBe(DEFAULT_UMAMI_ORIGIN)
    expect(getUmamiScriptUrl()).toBe(`${DEFAULT_UMAMI_ORIGIN}/script.js`)
  })

  it("принимает хост с протоколом, без протокола и с мусором", () => {
    vi.stubEnv("NEXT_PUBLIC_UMAMI_URL", "https://analytics.example.com")
    expect(getUmamiOrigin()).toBe("https://analytics.example.com")

    vi.stubEnv("NEXT_PUBLIC_UMAMI_URL", "analytics.example.com/")
    expect(getUmamiOrigin()).toBe("https://analytics.example.com")

    vi.stubEnv("NEXT_PUBLIC_UMAMI_URL", "не url")
    expect(getUmamiOrigin()).toBe(DEFAULT_UMAMI_ORIGIN)
  })

  it("путь к трекеру можно переименовать (TRACKER_SCRIPT_NAME)", () => {
    vi.stubEnv("NEXT_PUBLIC_UMAMI_SCRIPT_PATH", "au.js")
    expect(getUmamiScriptUrl()).toBe(`${DEFAULT_UMAMI_ORIGIN}/au.js`)
  })

  it("домены и тег берутся из env", () => {
    vi.stubEnv("NEXT_PUBLIC_UMAMI_DOMAINS", "weeb-x.com, www.weeb-x.com")
    vi.stubEnv("NEXT_PUBLIC_UMAMI_TAG", "production")
    expect(getUmamiDomains()).toBe("weeb-x.com, www.weeb-x.com")
    expect(getUmamiTag()).toBe("production")
  })
})

describe("normalizeEventName", () => {
  it("приводит имя к snake_case и режет до 50 символов", () => {
    expect(normalizeEventName("Gacha Roll!")).toBe("gacha_roll")
    expect(normalizeEventName("  click--link ")).toBe("click_link")
    expect(normalizeEventName("a".repeat(80))).toHaveLength(50)
    expect(normalizeEventName("   ")).toBe("")
  })
})

describe("sanitizeEventData", () => {
  it("возвращает undefined для пустого payload", () => {
    expect(sanitizeEventData()).toBeUndefined()
    expect(sanitizeEventData({ a: undefined })).toBeUndefined()
  })

  it("режет длинные строки до 500 символов", () => {
    const result = sanitizeEventData({ title: "x".repeat(900) })
    expect(String(result?.title)).toHaveLength(500)
  })

  it("округляет числа до 4 знаков и отбрасывает NaN", () => {
    const result = sanitizeEventData({ price: 12.3456789, broken: Number.NaN })
    expect(result?.price).toBe(12.3457)
    expect(result?.broken).toBeNull()
  })

  it("склеивает массивы и сериализует объекты", () => {
    const result = sanitizeEventData({ list: ["a", 2, true], meta: { nested: 1 } })
    expect(result?.list).toBe("a,2,true")
    expect(result?.meta).toBe('{"nested":1}')
  })

  it("ограничивает payload 50 полями", () => {
    const payload: Record<string, number> = {}
    for (let i = 0; i < 80; i += 1) payload[`key_${i}`] = i
    expect(Object.keys(sanitizeEventData(payload) ?? {})).toHaveLength(50)
  })
})

describe("loadAnalyticsScript", () => {
  it("ничего не вставляет без website id", () => {
    vi.stubEnv("NEXT_PUBLIC_UMAMI_WEBSITE_ID", "")
    loadAnalyticsScript()
    expect(scriptTag()).toBeNull()
  })

  it("вставляет трекер с data-website-id в ручном режиме", () => {
    loadAnalyticsScript()
    const tag = scriptTag()
    expect(tag).not.toBeNull()
    expect(tag?.src).toBe(`${DEFAULT_UMAMI_ORIGIN}/script.js`)
    expect(tag?.getAttribute("data-website-id")).toBe(WEBSITE_ID)
    expect(tag?.getAttribute("data-performance")).toBeNull()
    expect(tag?.getAttribute("data-auto-track")).toBe("false")
    expect(tag?.getAttribute("data-before-send")).toBe("weebxBeforeSend")
    expect(tag?.getAttribute("data-domains")).toBeNull()
  })

  it("прокидывает data-domains и data-tag", () => {
    vi.stubEnv("NEXT_PUBLIC_UMAMI_DOMAINS", "weeb-x.com")
    vi.stubEnv("NEXT_PUBLIC_UMAMI_TAG", "staging")
    loadAnalyticsScript()
    const tag = scriptTag()
    expect(tag?.getAttribute("data-domains")).toBe("weeb-x.com")
    expect(tag?.getAttribute("data-tag")).toBe("staging")
  })

  it("повторный вызов не дублирует тег", () => {
    loadAnalyticsScript()
    loadAnalyticsScript()
    expect(document.querySelectorAll(`#${UMAMI_SCRIPT_TAG_ID}`)).toHaveLength(1)
  })

  it("unload выключает отправку, сохраняя singleton", () => {
    loadAnalyticsScript()
    expect(scriptTag()).not.toBeNull()
    unloadAnalyticsScript()
    expect(scriptTag()).not.toBeNull()
    expect(isAnalyticsActive()).toBe(false)
  })
})

// Match the real tracker callback contract (object overload does NOT merge defaults).
function mockTracker() {
  const payloads: Record<string, unknown>[] = []
  const track = vi.fn((build: unknown) => {
    payloads.push((build as (base: Record<string, unknown>) => Record<string, unknown>)({ website: WEBSITE_ID, hostname: "localhost", screen: "1920x1080", language: "ru" }))
    return Promise.resolve()
  })
  const identify = vi.fn(() => Promise.resolve())
  window.umami = { track, identify }
  return { track, identify, payloads }
}
async function drain() {
  for (let i = 0; i < 50; i++) await Promise.resolve()
}

describe("delivery lifecycle", () => {
  it("never buffers before consent or after revocation, even on re-consent", async () => {
    const { payloads } = mockTracker()
    trackEvent("before_consent")
    loadAnalyticsScript()
    trackEvent("allowed")
    markScriptLoaded()
    await drain()
    unloadAnalyticsScript()
    trackEvent("after_revoke")
    loadAnalyticsScript()
    trackEvent("allowed_again")
    await drain()
    expect(payloads.map(p => p.name)).toEqual(["allowed", "allowed_again"])
    expect(document.querySelectorAll(`#${UMAMI_SCRIPT_TAG_ID}`)).toHaveLength(1)
  })

  it("queues permitted events and snapshots URLs before navigation", async () => {
    const { payloads } = mockTracker()
    loadAnalyticsScript()
    trackEvent("Gacha Roll!", { price: 1.234567 }, "/gacha")
    trackPageview("/catalog?token=secret&page=2")
    expect(payloads).toEqual([])
    markScriptLoaded()
    await drain()
    expect(payloads[0]).toMatchObject({ name: "gacha_roll", data: { price: 1.2346 }, url: "/gacha" })
    expect(payloads[1]).toMatchObject({ url: "/catalog?page=2", website: WEBSITE_ID, hostname: "localhost", screen: "1920x1080" })
    expect(payloads[1].name).toBeUndefined()
  })

  it("pageviews dedupe rerenders, but count query changes and returning to previous routes", async () => {
    const { payloads } = mockTracker()
    loadAnalyticsScript()
    markScriptLoaded()
    for (const url of ["/", "/", "/catalog", "/catalog?page=2", "/catalog", "/"]) trackPageview(url)
    await drain()
    expect(payloads.map(p => p.url)).toEqual(["/", "/catalog", "/catalog?page=2", "/catalog", "/"])
    expect(payloads[2].referrer).toBe("/catalog")
  })

  it("serializes identify before events and clears user on logout", async () => {
    const { payloads, identify } = mockTracker()
    loadAnalyticsScript()
    identifyUser("supabase:user-1")
    trackPageview("/profile")
    identifyUser("")
    trackEvent("guest_action")
    markScriptLoaded()
    await drain()
    expect(identify.mock.calls).toEqual([["supabase:user-1", undefined], ["", undefined]])
    expect(payloads[0].id).toBe("supabase:user-1")
    expect(payloads[1].id).toBeUndefined()
  })

  it("does not allow direct SDK sending after consent withdrawal", () => {
    loadAnalyticsScript()
    const payload = { url: "/?access_token=secret#private", referrer: "/?code=secret" }
    expect(window.weebxBeforeSend?.("event", payload)).toEqual({ url: "/", referrer: "/" })
    unloadAnalyticsScript()
    expect(window.weebxBeforeSend?.("event", payload)).toBe(false)
  })

  it("late script load cannot flush a revoked queue", async () => {
    const { payloads } = mockTracker()
    loadAnalyticsScript()
    trackEvent("must_drop")
    unloadAnalyticsScript()
    markScriptLoaded()
    await drain()
    expect(payloads).toEqual([])
    expect(isAnalyticsActive()).toBe(false)
  })

  it("respects domain allowlist and umami.disabled", async () => {
    const { payloads } = mockTracker()
    loadAnalyticsScript()
    markScriptLoaded()
    vi.stubEnv("NEXT_PUBLIC_UMAMI_DOMAINS", "production.example.com")
    trackEvent("wrong_domain")
    vi.stubEnv("NEXT_PUBLIC_UMAMI_DOMAINS", "")
    localStorage.setItem("umami.disabled", "1")
    trackEvent("disabled")
    await drain()
    expect(payloads).toEqual([])
  })

  it("survives rejected SDK promises and continues the queue", async () => {
    const { track, payloads } = mockTracker()
    track.mockImplementationOnce(() => Promise.reject(new Error("offline")))
    loadAnalyticsScript()
    markScriptLoaded()
    trackEvent("first")
    trackEvent("second")
    await drain()
    expect(payloads.map(p => p.name)).toEqual(["second"])
  })

  it("bounds a blocked tracker's queue", async () => {
    const { payloads } = mockTracker()
    loadAnalyticsScript()
    for (let i = 0; i < 40; i++) trackEvent(`event_${i}`)
    markScriptLoaded()
    for (let i = 0; i < 4; i++) await drain()
    expect(payloads).toHaveLength(30)
    expect(payloads[0].name).toBe("event_10")
  })

  it("re-consent waits for the previous request before resetting the session cache", async () => {
    const { track, identify, payloads } = mockTracker()
    let finish!: () => void
    track.mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve }))
    loadAnalyticsScript()
    markScriptLoaded()
    trackEvent("in_flight")
    unloadAnalyticsScript()
    trackEvent("discarded")
    loadAnalyticsScript()
    identifyUser("supabase:new-user")
    trackEvent("new_visit")
    expect(identify).not.toHaveBeenCalled()
    finish()
    await drain()
    expect(identify.mock.calls).toEqual([["", undefined], ["supabase:new-user", undefined]])
    expect(payloads.map(p => p.name)).toEqual(["new_visit"])
    expect(payloads[0].id).toBe("supabase:new-user")
  })

  it("allows retry after script load error", () => {
    loadAnalyticsScript()
    scriptTag()?.dispatchEvent(new Event("error"))
    expect(scriptTag()).toBeNull()
    loadAnalyticsScript()
    expect(scriptTag()).not.toBeNull()
  })
})

describe("URL privacy", () => {
  it("keeps public filters and UTM, strips secrets and fragments", () => {
    expect(sanitizeAnalyticsUrl("/catalog?search=naruto&page=2&utm_source=telegram&gift_card=SECRET#access_token=SECRET"))
      .toBe("/catalog?search=naruto&page=2&utm_source=telegram")
    expect(sanitizeAnalyticsUrl("https://example.com/callback?code=secret&email=private#token"))
      .toBe("https://example.com/callback")
    expect(sanitizeAnalyticsUrl("mailto:private@example.com")).toBe("")
    expect(sanitizeAnalyticsUrl("javascript:alert(1)")).toBe("")
  })
})
