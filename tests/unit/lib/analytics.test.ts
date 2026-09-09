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
  vi.stubEnv("NEXT_PUBLIC_UMAMI_WEBSITE_ID", WEBSITE_ID)
  vi.stubEnv("NEXT_PUBLIC_UMAMI_URL", "")
  vi.stubEnv("NEXT_PUBLIC_UMAMI_SCRIPT_PATH", "")
  vi.stubEnv("NEXT_PUBLIC_UMAMI_DOMAINS", "")
  vi.stubEnv("NEXT_PUBLIC_UMAMI_TAG", "")
  unloadAnalyticsScript()
  delete window.umami
})

afterEach(() => {
  unloadAnalyticsScript()
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

  it("вставляет трекер с data-website-id и Web Vitals", () => {
    loadAnalyticsScript()
    const tag = scriptTag()
    expect(tag).not.toBeNull()
    expect(tag?.src).toBe(`${DEFAULT_UMAMI_ORIGIN}/script.js`)
    expect(tag?.getAttribute("data-website-id")).toBe(WEBSITE_ID)
    expect(tag?.getAttribute("data-performance")).toBe("true")
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

  it("unload убирает трекер из DOM", () => {
    loadAnalyticsScript()
    expect(scriptTag()).not.toBeNull()
    unloadAnalyticsScript()
    expect(scriptTag()).toBeNull()
    expect(isAnalyticsActive()).toBe(false)
  })
})

describe("trackEvent", () => {
  it("копит события до загрузки трекера и отправляет их после", () => {
    const track = vi.fn()
    window.umami = { track }

    loadAnalyticsScript()
    expect(isAnalyticsActive()).toBe(false)

    trackEvent("Gacha Roll!", { rarity: "UR", price: 1.234567 })
    expect(track).not.toHaveBeenCalled()

    markScriptLoaded()
    expect(isAnalyticsActive()).toBe(true)
    expect(track).toHaveBeenCalledTimes(1)
    expect(track).toHaveBeenCalledWith("gacha_roll", { rarity: "UR", price: 1.2346 })
  })

  it("шлёт события напрямую, когда трекер уже активен", () => {
    const track = vi.fn()
    window.umami = { track }
    loadAnalyticsScript()
    markScriptLoaded()

    trackEvent(AnalyticsEvent.MARKET_BUY, { listing_id: "abc" })
    expect(track).toHaveBeenCalledWith("market_buy", { listing_id: "abc" })
  })

  it("ничего не делает, если аналитика не настроена", () => {
    vi.stubEnv("NEXT_PUBLIC_UMAMI_WEBSITE_ID", "")
    const track = vi.fn()
    window.umami = { track }
    loadAnalyticsScript()
    markScriptLoaded()

    trackEvent(AnalyticsEvent.CLICK, { label: "test" })
    expect(track).not.toHaveBeenCalled()
  })

  it("после отзыва согласия события не уходят", () => {
    const track = vi.fn()
    window.umami = { track }
    loadAnalyticsScript()
    markScriptLoaded()

    unloadAnalyticsScript()
    trackEvent(AnalyticsEvent.CLICK, { label: "test" })
    expect(track).not.toHaveBeenCalled()
  })

  it("переживает трекер без track()", () => {
    window.umami = {} as never
    loadAnalyticsScript()
    expect(() => trackEvent(AnalyticsEvent.CLICK)).not.toThrow()
  })
})

describe("identifyUser", () => {
  it("ждёт загрузки трекера и отправляет identify", () => {
    const identify = vi.fn()
    window.umami = { track: vi.fn(), identify }

    loadAnalyticsScript()
    identifyUser("supabase:user-1", { plan: "free" })
    expect(identify).not.toHaveBeenCalled()

    markScriptLoaded()
    expect(identify).toHaveBeenCalledWith("supabase:user-1", { plan: "free" })
  })

  it("no-op без id и без настроенной аналитики", () => {
    const identify = vi.fn()
    window.umami = { track: vi.fn(), identify }
    loadAnalyticsScript()
    markScriptLoaded()

    identifyUser("")
    expect(identify).not.toHaveBeenCalled()

    vi.stubEnv("NEXT_PUBLIC_UMAMI_WEBSITE_ID", "")
    identifyUser("supabase:user-2")
    expect(identify).not.toHaveBeenCalled()
  })
})
