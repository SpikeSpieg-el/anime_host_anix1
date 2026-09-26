import { describe, expect, it } from "vitest"
import { clampLastmod, escapeXml, isSitemapSafeUrl } from "@/lib/seo/sitemap-utils"

describe("escapeXml", () => {
  it("экранирует & — иначе один такой URL ломает весь sitemap", () => {
    expect(escapeXml("https://media.kitsu.app/anime/1/poster.jpg?w=225&h=350"))
      .toBe("https://media.kitsu.app/anime/1/poster.jpg?w=225&amp;h=350")
  })

  it("экранирует остальные спецсимволы XML и не падает на пустом значении", () => {
    expect(escapeXml("<script>alert('x')</script>"))
      .toBe("&lt;script&gt;alert(&apos;x&apos;)&lt;/script&gt;")
    expect(escapeXml('a"b')).toBe("a&quot;b")
    expect(escapeXml(null)).toBe("")
    expect(escapeXml(undefined)).toBe("")
  })
})

describe("isSitemapSafeUrl", () => {
  it("принимает реальные адреса сайта и постеров", () => {
    expect(isSitemapSafeUrl("https://weeb-x.com/watch/1735-naruto-uragannye-khroniki")).toBe(true)
    expect(isSitemapSafeUrl("https://shikimori.one/system/animes/original/1735.jpg?1711965662")).toBe(true)
    expect(isSitemapSafeUrl("https://weeb-x.com/manga/20?page=1&sort=name")).toBe(true)
  })

  it("отбраковывает относительные, неполные и юникод-адреса", () => {
    expect(isSitemapSafeUrl("/watch/1735")).toBe(false)
    expect(isSitemapSafeUrl("watch/1735")).toBe(false)
    expect(isSitemapSafeUrl("https://weeb-x.com/watch/ван-пис")).toBe(false)
    expect(isSitemapSafeUrl("https://weeb-x.com/watch/21 van pis")).toBe(false)
    expect(isSitemapSafeUrl("https://weeb-x.com/watch/1735\\naruto")).toBe(false)
    expect(isSitemapSafeUrl("")).toBe(false)
    expect(isSitemapSafeUrl(null)).toBe(false)
  })

  it("отбраковывает битые %-последовательности, но пропускает корректные", () => {
    expect(isSitemapSafeUrl("https://weeb-x.com/watch/%ZZ")).toBe(false)
    expect(isSitemapSafeUrl("https://weeb-x.com/watch/%2")).toBe(false)
    expect(isSitemapSafeUrl("https://weeb-x.com/watch/100%")).toBe(false)
    expect(isSitemapSafeUrl("https://weeb-x.com/watch/%20naruto")).toBe(true)
    expect(isSitemapSafeUrl("https://weeb-x.com/watch/%E0%B8%81")).toBe(true)
  })

  it("отбраковывает адреса длиннее лимита валидатора Яндекса", () => {
    expect(isSitemapSafeUrl(`https://weeb-x.com/watch/${"a".repeat(1024)}`)).toBe(false)
  })
})

describe("clampLastmod", () => {
  const now = new Date("2026-09-25T12:00:00.000Z")

  it("подрезает дату из будущего до времени сборки", () => {
    expect(clampLastmod("2028-01-01", now)?.toISOString()).toBe(now.toISOString())
  })

  it("оставляет прошедшие даты как есть", () => {
    expect(clampLastmod("2007-02-15", now)?.toISOString()).toBe("2007-02-15T00:00:00.000Z")
  })

  it("возвращает null вместо мусора (иначе toISOString бросает RangeError)", () => {
    expect(clampLastmod("не дата", now)).toBeNull()
    expect(clampLastmod(new Date("invalid"), now)).toBeNull()
    expect(clampLastmod(undefined, now)).toBeNull()
    expect(clampLastmod("", now)).toBeNull()
  })
})
