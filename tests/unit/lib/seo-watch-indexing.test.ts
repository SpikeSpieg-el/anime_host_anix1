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

describe("совместимость защиты плеера и индексации тайтлов", () => {
  it("страницы /watch недостижимы для фильтра сканеров (проверка смотрит только на плеер)", async () => {
    // Защита от сканеров живёт в трёх роутах: /embed/[token],
    // /api/player/session, /api/player/translations. Страница /watch в этот
    // список НЕ входит — иначе робот не смог бы прочитать ни title, ни
    // JSON-LD. Тест фиксирует границу, чтобы её не расширили случайно.
    const { readFileSync } = await import("node:fs")
    const files = [
      "app/embed/[token]/route.ts",
      "app/api/player/session/route.ts",
      "app/api/player/translations/route.ts",
    ]
    for (const file of files) {
      expect(readFileSync(file, "utf8")).toContain("isCrawlerRequest")
    }

    // А на самой странице тайтла такой проверки быть не должно.
    const watchPage = readFileSync("app/watch/[id]/page.tsx", "utf8")
    expect(watchPage).not.toContain("isCrawlerRequest")
  })

  it("боты из BOT_UA_PATTERNS остаются заблокированными для плеера", async () => {
    const { isCrawlerRequest } = await import("@/lib/player-protect")
    const h = (ua: string) => new Headers({ "user-agent": ua })
    for (const ua of [
      "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
      "Mozilla/5.0 (compatible; YandexBot/3.0; +http://yandex.com/bots)",
      "curl/8.0",
      "python-requests/2.31",
    ]) {
      expect(isCrawlerRequest(h(ua)), ua).toBe(true)
    }
    // Реальный браузер проходит
    expect(
      isCrawlerRequest(
        h("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"),
      ),
    ).toBe(false)
  })

  it("чёрный список IP не должен закрывать robots.txt и sitemap.xml", async () => {
    // Бан подсети (/24, /64) не должен иметь возможности отрезать робота
    // от инфраструктуры поиска: middleware обязан иметь исключения.
    const middleware = (await import("node:fs")).readFileSync("middleware.ts", "utf8")
    expect(middleware).toContain("IP_BLOCKLIST_EXEMPT_PATHS")
    expect(middleware).toContain('"/robots.txt"')
    expect(middleware).toContain('"/sitemap.xml"')
    // И эта проверка должна стоять в условии блокировки по IP
    expect(middleware).toMatch(/!isAdminSurface\(pathname\)\s*&&\s*!IP_BLOCKLIST_EXEMPT_PATHS\.includes\(pathname\)/)
  })
})
