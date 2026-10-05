/**
 * Защита плеера от сканеров: шифрованные токены ссылок,
 * вычистка прямых ссылок из публичных ответов, фильтр ботов.
 */
import { afterEach, describe, expect, it, vi } from "vitest"
import {
  createPlayerToken,
  isCrawlerRequest,
  isCrossOriginReferer,
  isValidPlayerUrl,
  resolvePlayerToken,
  scrubSeasons,
} from "@/lib/player-protect"

const KODIK_URL = "https://kodikplayer.com/serial/123/abcdef/720p"

describe("player-protect: токены ссылок", () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it("создаёт токен, который расшифровывается обратно в ту же ссылку", () => {
    const token = createPlayerToken(KODIK_URL)
    expect(token).toBeTruthy()
    // Токен непрозрачный: ни домена, ни пути в нём не видно
    expect(token).not.toContain("kodik")
    expect(token).not.toContain("serial")
    expect(resolvePlayerToken(token!)).toBe(KODIK_URL)
  })

  it("принимает protocol-relative ссылки (//хост/...)", () => {
    const token = createPlayerToken("//aniqit.com/serial/5/hash/720p")
    expect(resolvePlayerToken(token!)).toBe("https://aniqit.com/serial/5/hash/720p")
  })

  it("не создаёт токен для постороннего домена", () => {
    expect(createPlayerToken("https://evil.example.com/serial/1")).toBeNull()
    expect(createPlayerToken("https://kodikplayer.com.evil.example/x")).toBeNull()
  })

  it("отклоняет мусор, подделку и пустые токены", () => {
    expect(resolvePlayerToken("")).toBeNull()
    expect(resolvePlayerToken("aaaa")).toBeNull()
    expect(resolvePlayerToken("не-токен")).toBeNull()

    const token = createPlayerToken(KODIK_URL)!
    // Подмена одного символа (целостность гарантирует GCM-тег)
    const tampered = (token[0] === "A" ? "B" : "A") + token.slice(1)
    expect(resolvePlayerToken(tampered)).toBeNull()
  })

  it("протухший токен не расшифровывается", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"))
    const token = createPlayerToken(KODIK_URL, 60)!

    // Внутри срока жизни — работает
    expect(resolvePlayerToken(token)).toBe(KODIK_URL)

    // После истечения — нет
    vi.setSystemTime(new Date("2026-01-01T00:02:00Z"))
    expect(resolvePlayerToken(token)).toBeNull()
  })

  it("токены одноразовые по виду: два токена на одну ссылку различаются", () => {
    const a = createPlayerToken(KODIK_URL)!
    const b = createPlayerToken(KODIK_URL)!
    expect(a).not.toBe(b)
  })
})

describe("player-protect: очистка публичных ответов", () => {
  it("оставляет номера серий, но вычищает прямые ссылки", () => {
    const scrubbed = scrubSeasons({
      "1": {
        link: "//kodikplayer.com/serial/1/hash/720p",
        episodes: {
          "1": "//kodikplayer.com/serial/1/hash/720p/1",
          "2": "//kodikplayer.com/serial/1/hash/720p/2",
        },
      },
      "2": null,
    })

    expect(scrubbed).toEqual({
      "1": { episodes: { "1": "", "2": "" } },
      "2": { episodes: {} },
    })
    expect(JSON.stringify(scrubbed)).not.toContain("kodik")
  })

  it("пустые сезоны остаются пустыми", () => {
    expect(scrubSeasons(undefined)).toBeUndefined()
    expect(scrubSeasons(null)).toBeUndefined()
    expect(scrubSeasons({})).toEqual({})
  })
})

describe("player-protect: валидация доменов плеера", () => {
  it("разрешает известные домены и поддомены", () => {
    expect(isValidPlayerUrl("https://kodikplayer.com/x")).toBe(true)
    expect(isValidPlayerUrl("https://aniqit.com/x")).toBe(true)
    expect(isValidPlayerUrl("https://anivod.com/x")).toBe(true)
    expect(isValidPlayerUrl("https://kodik.info/x")).toBe(true)
    expect(isValidPlayerUrl("https://cdn.kodik.info/x")).toBe(true)
  })

  it("отклоняет посторонние и похожие домены", () => {
    expect(isValidPlayerUrl("https://example.com/x")).toBe(false)
    expect(isValidPlayerUrl("https://kodikplayer.com.attacker.ru/x")).toBe(false)
    expect(isValidPlayerUrl("не ссылка")).toBe(false)
  })
})

describe("player-protect: фильтр ботов", () => {
  function headers(init: Record<string, string>): Headers {
    return new Headers(init)
  }

  it("пропускает обычные браузеры", () => {
    const chrome =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    const safari =
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
    expect(isCrawlerRequest(headers({ "user-agent": chrome }))).toBe(false)
    expect(isCrawlerRequest(headers({ "user-agent": safari }))).toBe(false)
  })

  it("запрос вообще без User-Agent блокируется (браузер так не ходит)", () => {
    expect(isCrawlerRequest(headers({}))).toBe(true)
  })

  it("блокирует краулеров, сканеров и HTTP-клиенты", () => {
    const bots = [
      "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
      "Mozilla/5.0 (compatible; YandexBot/3.0; +http://yandex.com/bots)",
      "Mozilla/5.0 (compatible; SemrushBot/7~bl; +http://www.semrush.com/bot.html)",
      "Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)",
      "curl/8.5.0",
      "python-requests/2.31.0",
      "Go-http-client/1.1",
      "Mozilla/5.0 (X11; Linux x86_64) HeadlessChrome/120.0",
      "Mozilla/5.0 (compatible; GPTBot/1.0; +https://openai.com/gptbot)",
    ]
    for (const ua of bots) {
      expect(isCrawlerRequest(headers({ "user-agent": ua })), ua).toBe(true)
    }
  })

  it("блокирует превью-режимы по служебным заголовкам", () => {
    const chrome =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    expect(isCrawlerRequest(headers({ "user-agent": chrome, "x-purpose": "preview" }))).toBe(true)
    expect(isCrawlerRequest(headers({ "user-agent": chrome, "purpose": "preview" }))).toBe(true)
  })
})

describe("player-protect: проверка Referer", () => {
  const SELF_URL = "http://0.0.0.0:3000/embed/token123" // bind-адрес сервера
  const HOST = { host: "weeb-x.com" }

  it("пустой Referer допустим (приватные режимы)", () => {
    expect(isCrossOriginReferer(null, new Headers(HOST), SELF_URL)).toBe(false)
  })

  it("свой Referer допустим (хост берётся из Host-заголовка, а не из request.url)", () => {
    expect(
      isCrossOriginReferer("https://weeb-x.com/watch/21-one-piece", new Headers(HOST), SELF_URL)
    ).toBe(false)
  })

  it("чужой Referer блокируется", () => {
    expect(
      isCrossOriginReferer("https://pirate-site.net/page", new Headers(HOST), SELF_URL)
    ).toBe(true)
  })

  it("учитывает x-forwarded-host за прокси", () => {
    const behindProxy = new Headers({ host: "internal", "x-forwarded-host": "weeb-x.com" })
    expect(isCrossOriginReferer("https://weeb-x.com/watch/1", behindProxy, SELF_URL)).toBe(false)
    expect(isCrossOriginReferer("https://evil.net/x", behindProxy, SELF_URL)).toBe(true)
  })
})
