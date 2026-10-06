import { beforeEach, describe, expect, it, vi } from "vitest"
import { __resetWatchRedirectCache, doesWatchAnimeExist } from "@/lib/seo/watch-redirect"
import { transformAnime } from "@/lib/shikimori/transformers"
import { isAnimeSafe } from "@/lib/shikimori/utils"
import { isNoIndexAnime } from "@/lib/hentai-detector"
import { makeAnime, makeShikimoriAnime } from "../../fixtures/anime"

describe("doesWatchAnimeExist — честный 404 вместо мягкой 404", () => {
  beforeEach(() => __resetWatchRedirectCache())

  const notFoundFetch = () =>
    vi.fn(async () => new Response("{}", { status: 404 })) as unknown as typeof fetch

  const okFetch = (body: object) =>
    vi.fn(async () => new Response(JSON.stringify(body), { status: 200 })) as unknown as typeof fetch

  it("false, когда Shikimori отвечает 404", async () => {
    const fetchImpl = notFoundFetch()
    await expect(doesWatchAnimeExist("999999", false, fetchImpl)).resolves.toBe(false)
    // повторный вызов берётся из негативного кэша
    await expect(doesWatchAnimeExist("999999", false, fetchImpl)).resolves.toBe(false)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it("true для существующего тайтла", async () => {
    const fetchImpl = okFetch({ russian: "Наруто", name: "Naruto" })
    await expect(doesWatchAnimeExist("20", false, fetchImpl)).resolves.toBe(true)
  })

  it("null при сетевой ошибке — страницу не блокируем", async () => {
    const failing = vi.fn(async () => {
      throw new Error("network")
    }) as unknown as typeof fetch
    await expect(doesWatchAnimeExist("20", false, failing)).resolves.toBeNull()
  })

  it("при холодном кэше и наличии slug'а не тормозит ответ, а греет кэш в фоне", async () => {
    const fetchImpl = okFetch({ russian: "Наруто" })
    const tasks: Promise<unknown>[] = []
    await expect(
      doesWatchAnimeExist("20", true, fetchImpl, (t) => tasks.push(t)),
    ).resolves.toBeNull()
    await Promise.all(tasks)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    // после прогрева кэша ответ уже определённый
    await expect(doesWatchAnimeExist("20", true, fetchImpl)).resolves.toBe(true)
  })
})

describe("transformAnime — поля для SEO-разметки /watch", () => {
  it("прокидывает english / japanese / kind в результат", async () => {
    const anime = await transformAnime(
      makeShikimoriAnime({ english: "Attack on Titan", japanese: "進撃の巨人", kind: "movie" }),
      false,
      true,
    )
    expect(anime.english).toBe("Attack on Titan")
    expect(anime.japanese).toBe("進撃の巨人")
    // именно из kind берётся @type: Movie vs TVSeries в JSON-LD
    expect(anime.kind).toBe("movie")
  })

  it("прокидывает строковый рейтинг Shikimori и флаг NSFW", async () => {
    const safe = await transformAnime(makeShikimoriAnime({ rating: "pg_13" }), false, true)
    expect(safe.shikimoriRating).toBe("pg_13")
    expect(safe.isNsfw).toBe(false)

    const nsfw = await transformAnime(makeShikimoriAnime({ rating: "rx" }), false, true)
    expect(nsfw.isNsfw).toBe(true)
  })

  it("не падает, если у жанра нет russian/name", async () => {
    const broken = makeShikimoriAnime({
      genres: [{ id: 5 } as any, { id: 1, name: "Action", russian: "Экшен" }],
    })
    await expect(transformAnime(broken, false, true)).resolves.toBeTruthy()
  })
})

describe("isAnimeSafe — фильтр NSFW для sitemap", () => {
  it("отбраковывает r_plus / rx / x", () => {
    expect(isAnimeSafe(makeShikimoriAnime({ rating: "r_plus" }))).toBe(false)
    expect(isAnimeSafe(makeShikimoriAnime({ rating: "rx" }))).toBe(false)
    expect(isAnimeSafe(makeShikimoriAnime({ rating: "x" }))).toBe(false)
  })

  it("отбраковывает жанры 12/33/34", () => {
    expect(isAnimeSafe(makeShikimoriAnime({ genres: [{ id: 12, name: "Hentai", russian: "Хентай" }] }))).toBe(false)
    expect(isAnimeSafe(makeShikimoriAnime({ genres: [{ id: 33, name: "Erotica", russian: "Эротика" }] }))).toBe(false)
  })

  it("пропускает обычные тайтлы", () => {
    expect(isAnimeSafe(makeShikimoriAnime({ rating: "r" }))).toBe(true)
  })
})

describe("isNoIndexAnime — 18+ не идут в индекс", () => {
  it("noindex для NSFW-тайтла", () => {
    expect(isNoIndexAnime(makeAnime({ isNsfw: true }))).toBe(true)
    expect(isNoIndexAnime(makeAnime({ shikimoriRating: "rx" }))).toBe(true)
  })

  it("обычные тайтлы индексируются", () => {
    expect(isNoIndexAnime(makeAnime())).toBe(false)
    expect(isNoIndexAnime(makeAnime({ isNsfw: false, shikimoriRating: "pg_13" }))).toBe(false)
  })
})
