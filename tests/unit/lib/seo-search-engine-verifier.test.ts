import { describe, it, expect, beforeEach } from "vitest"
import {
  hasCrawlerUserAgent,
  getVerifiedCrawler,
  resetVerifiedCrawlerCache,
  isGooglebot,
} from "@/lib/seo/search-engine-verifier"

function headers(entries: Record<string, string>): Headers {
  return new Headers(entries)
}

describe("search-engine-verifier", () => {
  beforeEach(() => {
    resetVerifiedCrawlerCache()
  })

  describe("hasCrawlerUserAgent", () => {
    it("принимает основной Googlebot", () => {
      expect(
        hasCrawlerUserAgent(
          headers({
            "user-agent":
              "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
          })
        )
      ).toBe(true)
    })

    it("принимает специализированных краулеров Google", () => {
      // Googlebot-Image и Googlebot-Video приходят отдельными строками и
      // наследуют "googlebot" — проверка должна быть по вхождению подстроки,
      // а не по точному равенству.
      expect(
        hasCrawlerUserAgent(headers({ "user-agent": "Googlebot-Image/1.0" }))
      ).toBe(true)
      expect(
        hasCrawlerUserAgent(headers({ "user-agent": "Googlebot-Video/1.0" }))
      ).toBe(true)
    })

    it("принимает Яндекс-краулеров", () => {
      expect(
        hasCrawlerUserAgent(
          headers({ "user-agent": "Mozilla/5.0 (compatible; YandexBot/3.0)" })
        )
      ).toBe(true)
      expect(
        hasCrawlerUserAgent(headers({ "user-agent": "YandexImages/3.0" }))
      ).toBe(true)
    })

    it("отклоняет обычный браузер", () => {
      expect(
        hasCrawlerUserAgent(
          headers({
            "user-agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36",
          })
        )
      ).toBe(false)
    })

    it("отклоняет запрос без User-Agent", () => {
      expect(hasCrawlerUserAgent(headers({}))).toBe(false)
    })
  })

  describe("getVerifiedCrawler", () => {
    it("не делает DNS-запрос для обычного браузера и возвращает null", async () => {
      // Браузерный UA не проходит первый фильтр, поэтому проверка
      // завершается синхронно, без обращения к DNS.
      const result = await getVerifiedCrawler(
        headers({
          "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/140.0",
          "x-real-ip": "203.0.113.10",
        })
      )
      expect(result).toBeNull()
    })

    it("возвращает null, если у краулера не определяется IP", async () => {
      // Без адреса проверить PTR невозможно. Fail-closed: лучше не выдать
      // доступ, чем выдать его кому попало.
      const result = await getVerifiedCrawler(
        headers({ "user-agent": "Mozilla/5.0 (compatible; Googlebot/2.1)" })
      )
      expect(result).toBeNull()
    })

    it("возвращает null для некорректного адреса", async () => {
      const result = await getVerifiedCrawler(
        headers({
          "user-agent": "Mozilla/5.0 (compatible; Googlebot/2.1)",
          "x-real-ip": "не-ip",
        })
      )
      expect(result).toBeNull()
    })

    it("читает адрес из X-Forwarded-For, а не только из X-Real-IP", async () => {
      const result = await getVerifiedCrawler(
        headers({
          "user-agent": "Mozilla/5.0 (compatible; Googlebot/2.1)",
          "x-forwarded-for": "198.51.100.7, 10.0.0.1",
        })
      )
      // Адрес валидный и распознан, но PTR-записи для него нет —
      // результат обязан быть null, а не "true по умолчанию".
      expect(result).toBeNull()
    })
  })

  describe("isGooglebot", () => {
    it("различает Googlebot и Яндекс", () => {
      expect(isGooglebot("googlebot")).toBe(true)
      expect(isGooglebot("yandexbot")).toBe(false)
      expect(isGooglebot(null)).toBe(false)
    })
  })
})