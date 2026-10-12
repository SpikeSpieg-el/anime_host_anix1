import { describe, expect, it } from "vitest"
import {
  normalizeShikimoriUrl,
  upgradeShikimoriUrl,
  transliterateRuToEn,
  containsCyrillic,
  generateSearchVariants,
  isAnimeSafe,
  isHentaiShikimoriAnime,
  generateArtPoster,
} from "@/lib/shikimori/utils"
import { transformAnimeCalendar, toLinkedAnimeFromShikimori, transformTopic } from "@/lib/shikimori/transformers"
import {
  getSignedImageUrlExpiresAt,
  isImageUrlFresh,
  isImageUrlSafeToPersist,
} from "@/lib/signed-image-url"
import { BASE_URL, SITE_URL, GENRES_MAP, HENTAI_GENRE_IDS } from "@/lib/shikimori/config"
import { makeShikimoriAnime } from "../../fixtures/anime"

describe("shikimori config", () => {
  it("points at official API", () => {
    expect(BASE_URL).toBe("https://shikimori.one/api")
    expect(SITE_URL).toBe("https://shikimori.one")
  })

  it("maps core russian genres to ids", () => {
    expect(GENRES_MAP["Экшен"]).toBe("1")
    expect(GENRES_MAP["Хентай"]).toBe("12")
    expect(HENTAI_GENRE_IDS).toContain(12)
  })

  // Регресс: id 33 = «Яой», id 34 = «Юри» — это BL-жанры, а не NSFW.
  // Раньше они стояли в списке хентай-жанров, и любой яой/юри-тайтл уезжал
  // в хентай-плеер и получал noindex. Настоящие хентай-жанры Shikimori:
  // 12/59 (Hentai), 61 (Doujinshi), 539/540 (Erotica).
  it("не считает яой/юри хентайскими жанрами", () => {
    expect(HENTAI_GENRE_IDS).not.toContain(33)
    expect(HENTAI_GENRE_IDS).not.toContain(34)
    expect(HENTAI_GENRE_IDS).toEqual(expect.arrayContaining([12, 59, 61, 539, 540]))
  })
})

describe("signed poster URL expiry", () => {
  const signedUrl = "https://kitsu-production-media.s3.us-west-002.backblazeb2.com/anime/50021/poster_image/poster.jpg?X-Amz-Date=20261005T125040Z&X-Amz-Expires=900&X-Amz-Signature=test"

  it("computes the expiry from the SigV4 date and TTL", () => {
    expect(getSignedImageUrlExpiresAt(signedUrl)).toBe(Date.UTC(2026, 9, 5, 13, 5, 40))
  })

  it("returns null for permanent URLs and treats malformed signed URLs as uncachable", () => {
    expect(getSignedImageUrlExpiresAt("https://media.kitsu.app/anime/poster.jpg")).toBeNull()
    expect(getSignedImageUrlExpiresAt("https://example.com/poster.jpg?X-Amz-Signature=test")).toBe(0)
    expect(getSignedImageUrlExpiresAt("https://example.com/poster.jpg?X-Amz-Date=20261005T125040Z")).toBe(0)
  })

  it("stops reusing a poster shortly before its signed URL expires", () => {
    const expiresAt = getSignedImageUrlExpiresAt(signedUrl)!
    expect(isImageUrlFresh(signedUrl, expiresAt - 120_000)).toBe(true)
    expect(isImageUrlFresh(signedUrl, expiresAt - 30_000)).toBe(false)
    expect(isImageUrlFresh(signedUrl, expiresAt)).toBe(false)
  })

  it("allows permanent covers in persistent caches but never stores signed URLs", () => {
    expect(isImageUrlSafeToPersist(signedUrl)).toBe(false)
    expect(isImageUrlSafeToPersist("https://media.kitsu.app/anime/poster.jpg")).toBe(true)
    expect(isImageUrlSafeToPersist("https://example.com/poster.jpg?X-Amz-Signature=test")).toBe(false)
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

  // Яой/юри — не NSFW. Раньше их id (33/34) стояли в списке хентай-жанров.
  it("пропускает яой/юри", () => {
    expect(isAnimeSafe(makeShikimoriAnime({ genres: [{ id: 33, name: "Yaoi", russian: "Яой" }] }))).toBe(true)
    expect(isAnimeSafe(makeShikimoriAnime({ genres: [{ id: 34, name: "Yuri", russian: "Юри" }] }))).toBe(true)
  })
})

describe("isHentaiShikimoriAnime", () => {
  it("считает rx/x и хентай-жанры хентаем", () => {
    expect(isHentaiShikimoriAnime(makeShikimoriAnime({ rating: "rx" }))).toBe(true)
    expect(isHentaiShikimoriAnime(makeShikimoriAnime({ rating: "x" }))).toBe(true)
    expect(
      isHentaiShikimoriAnime(
        makeShikimoriAnime({ genres: [{ id: 59, name: "Hentai", russian: "Хентай" }] }),
      ),
    ).toBe(true)
    expect(
      isHentaiShikimoriAnime(
        makeShikimoriAnime({ genres: [{ id: 540, name: "Erotica", russian: "Эротика" }] }),
      ),
    ).toBe(true)
  })

  // Регресс на https://weeb-x.com/watch/61578-dazhe-u-studsoveta-est-kosyaki
  // «Даже у студсовета есть косяки!» = Seitokai ni mo Ana wa Aru, рейтинг r_plus.
  // Это этти, а не хентай: r_plus в hentai-плеер уводить нельзя.
  it("НЕ считает хентаем r_plus (этти)", () => {
    expect(isHentaiShikimoriAnime(makeShikimoriAnime({ rating: "r_plus" }))).toBe(false)
    expect(
      isHentaiShikimoriAnime(
        makeShikimoriAnime({
          rating: "r_plus",
          genres: [{ id: 9, name: "Ecchi", russian: "Этти" }],
        }),
      ),
    ).toBe(false)
  })

  it("НЕ считает хентаем яой/юри/этти", () => {
    expect(
      isHentaiShikimoriAnime(makeShikimoriAnime({ genres: [{ id: 33, name: "Yaoi", russian: "Яой" }] })),
    ).toBe(false)
    expect(
      isHentaiShikimoriAnime(makeShikimoriAnime({ genres: [{ id: 34, name: "Yuri", russian: "Юри" }] })),
    ).toBe(false)
    expect(
      isHentaiShikimoriAnime(makeShikimoriAnime({ genres: [{ id: 51, name: "Ecchi", russian: "Этти" }] })),
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
