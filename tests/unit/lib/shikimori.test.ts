import { describe, expect, it } from "vitest"
import {
  normalizeShikimoriUrl,
  upgradeShikimoriUrl,
  transliterateRuToEn,
  containsCyrillic,
  generateSearchVariants,
  isAnimeSafe,
  generateArtPoster,
} from "@/lib/shikimori/utils"
import { transformAnimeCalendar, toLinkedAnimeFromShikimori, transformTopic } from "@/lib/shikimori/transformers"
import { BASE_URL, SITE_URL, GENRES_MAP, NSFW_GENRE_IDS } from "@/lib/shikimori/config"
import { makeShikimoriAnime } from "../../fixtures/anime"

describe("shikimori config", () => {
  it("points at official API", () => {
    expect(BASE_URL).toBe("https://shikimori.one/api")
    expect(SITE_URL).toBe("https://shikimori.one")
  })

  it("maps core russian genres to ids", () => {
    expect(GENRES_MAP["Экшен"]).toBe("1")
    expect(GENRES_MAP["Хентай"]).toBe("12")
    expect(NSFW_GENRE_IDS).toContain(12)
  })
})

describe("URL helpers", () => {
  it("normalizeShikimoriUrl fixes broken schemes and relatives", () => {
    expect(normalizeShikimoriUrl("https//cdn.example/a.jpg")).toBe("https://cdn.example/a.jpg")
    expect(normalizeShikimoriUrl("http//cdn.example/a.jpg")).toBe("http://cdn.example/a.jpg")
    expect(normalizeShikimoriUrl("//cdn.example/a.jpg")).toBe("https://cdn.example/a.jpg")
    expect(normalizeShikimoriUrl("/system/x.jpg")).toBe("https://shikimori.one/system/x.jpg")
    expect(normalizeShikimoriUrl("system/x.jpg")).toBe("https://shikimori.one/system/x.jpg")
    expect(normalizeShikimoriUrl("https://ok.com/a.jpg")).toBe("https://ok.com/a.jpg")
    expect(normalizeShikimoriUrl("")).toBe("")
  })

  it("upgradeShikimoriUrl replaces thumbnail paths", () => {
    expect(upgradeShikimoriUrl("/system/animes/x96/1.jpg")).toContain("/original/")
    expect(upgradeShikimoriUrl("/system/animes/preview/1.jpg")).toContain("/original/")
    expect(upgradeShikimoriUrl("")).toBe("")
  })
})

describe("transliteration / search variants", () => {
  it("transliterates russian", () => {
    expect(transliterateRuToEn("Наруто")).toBe("Naruto")
    expect(transliterateRuToEn("Атака титанов")).toBe("Ataka titanov")
  })

  it("detects cyrillic", () => {
    expect(containsCyrillic("Наруто")).toBe(true)
    expect(containsCyrillic("Naruto")).toBe(false)
  })

  it("adds latin variant for cyrillic queries", () => {
    const variants = generateSearchVariants("  Наруто ")
    expect(variants[0]).toBe("Наруто")
    expect(variants).toContain("Naruto")
  })

  it("does not duplicate latin queries", () => {
    expect(generateSearchVariants("Naruto")).toEqual(["Naruto"])
  })
})

describe("isAnimeSafe", () => {
  it("allows regular tv anime", () => {
    expect(isAnimeSafe(makeShikimoriAnime())).toBe(true)
  })

  it("blocks rx / x / r_plus ratings", () => {
    expect(isAnimeSafe(makeShikimoriAnime({ rating: "rx" }))).toBe(false)
    expect(isAnimeSafe(makeShikimoriAnime({ rating: "x" }))).toBe(false)
    expect(isAnimeSafe(makeShikimoriAnime({ rating: "r_plus" }))).toBe(false)
  })

  it("blocks nsfw genres by id or name", () => {
    expect(
      isAnimeSafe(
        makeShikimoriAnime({
          genres: [{ id: 12, name: "Hentai", russian: "Хентай" }],
        }),
      ),
    ).toBe(false)
    expect(
      isAnimeSafe(
        makeShikimoriAnime({
          genres: [{ id: 99, name: "erotica", russian: "эротика" }],
        }),
      ),
    ).toBe(false)
  })
})

describe("generateArtPoster", () => {
  it("returns a base64 svg data uri", () => {
    const poster = generateArtPoster("Cowboy Bebop")
    expect(poster.startsWith("data:image/svg+xml;base64,")).toBe(true)
    const svg = Buffer.from(poster.split(",")[1], "base64").toString("utf-8")
    expect(svg).toContain("<svg")
    expect(svg).toContain("Cowboy Bebop")
  })
})

describe("transformers", () => {
  it("transformAnimeCalendar maps status and strips bbcode", () => {
    const anime = transformAnimeCalendar(makeShikimoriAnime({ status: "ongoing" }))
    expect(anime.title).toBe("Атака титанов")
    expect(anime.originalTitle).toBe("Shingeki no Kyojin")
    expect(anime.status).toBe("Ongoing")
    expect(anime.description).not.toContain("[b]")
    expect(anime.year).toBe(2013)
    expect(anime.rating).toBe(8.5)
  })

  it("maps anons / released statuses", () => {
    expect(transformAnimeCalendar(makeShikimoriAnime({ status: "anons" })).status).toBe("Announcement")
    expect(transformAnimeCalendar(makeShikimoriAnime({ status: "released" })).status).toBe("Completed")
  })

  it("toLinkedAnimeFromShikimori keeps core fields", () => {
    const linked = toLinkedAnimeFromShikimori(makeShikimoriAnime())
    expect(linked).toMatchObject({ id: 16498, name: "Shingeki no Kyojin", russian: "Атака титанов" })
  })

  it("transformTopic extracts excerpt, image and linked anime", () => {
    const news = transformTopic({
      id: 42,
      topic_title: "Заголовок",
      body: "a".repeat(200),
      html_body: '<p><img src="/system/news/1.jpg"></p>',
      created_at: "2024-01-15T00:00:00Z",
      user: { nickname: "admin" },
      comments_count: 3,
      forum: { url: "/forum/news" },
      linked_type: "Anime",
      linked: { id: 1, name: "X", russian: "Икс" },
    })
    expect(news.id).toBe("42")
    expect(news.title).toBe("Заголовок")
    expect(news.excerpt.endsWith("...")).toBe(true)
    expect(news.imageUrl).toContain("shikimori.one")
    expect(news.author).toBe("admin")
    expect(news.linkedAnime?.id).toBe(1)
  })
})
