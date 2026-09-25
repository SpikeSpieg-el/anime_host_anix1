import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  cleanAnimeTitle,
  getWatchPath,
  getWatchSegment,
  parseWatchParam,
  slugifyAnimeTitle,
} from "@/lib/seo/watch-url"
import { __resetWatchRedirectCache, getWatchRedirectPath } from "@/lib/seo/watch-redirect"

describe("watch-url", () => {
  it("транслитерирует русские названия так же, как раньше делал page.tsx", () => {
    expect(slugifyAnimeTitle("Путешествие к бессмертию 5")).toBe("puteshestvie-k-bessmertiyu-5")
    expect(slugifyAnimeTitle("Девочка-волшебница Мадока")).toBe("devochka-volshebnitsa-madoka")
    expect(slugifyAnimeTitle("  Щука: ёжик!  ")).toBe("shchuka-yozhik")
  })

  it("вырезает год в скобках в конце названия", () => {
    expect(cleanAnimeTitle("Наруто (2002)")).toBe("Наруто")
    expect(slugifyAnimeTitle("Наруто (2002)")).toBe("naruto")
  })

  it("строит канонический путь, в т.ч. с серией", () => {
    expect(getWatchPath("48820", "Девочка-волшебница")).toBe("/watch/48820-devochka-volshebnitsa")
    expect(getWatchPath(48820, "Девочка-волшебница", 3)).toBe("/watch/48820-devochka-volshebnitsa?episode=3")
    expect(getWatchPath("48820", "Девочка-волшебница", "abc")).toBe("/watch/48820-devochka-volshebnitsa")
    expect(getWatchPath("48820", "Девочка-волшебница", 0)).toBe("/watch/48820-devochka-volshebnitsa")
  })

  it("без названия (или с непереводимым) отдаёт короткий путь", () => {
    expect(getWatchSegment("5", "")).toBe("5")
    expect(getWatchSegment("5", "進撃の巨人")).toBe("5")
    expect(getWatchPath("5")).toBe("/watch/5")
  })

  it("достаёт ID из сегмента и не падает на битом percent-encoding", () => {
    expect(parseWatchParam("48820-devochka")).toBe("48820")
    expect(parseWatchParam("48820")).toBe("48820")
    expect(parseWatchParam("48820-%E0")).toBe("48820")
  })
})

describe("watch-redirect (middleware)", () => {
  beforeEach(() => __resetWatchRedirectCache())

  const okFetch = (body: object) =>
    vi.fn(async () => new Response(JSON.stringify(body), { status: 200 })) as unknown as typeof fetch

  it("короткий /watch/{id} → канонический путь с сохранением query", async () => {
    const fetchImpl = okFetch({ russian: "Путешествие к бессмертию 5", name: "Xian Ni 5" })
    await expect(getWatchRedirectPath("/watch/63240", "", fetchImpl)).resolves.toBe(
      "/watch/63240-puteshestvie-k-bessmertiyu-5",
    )
    await expect(getWatchRedirectPath("/watch/63240", "?episode=4", fetchImpl)).resolves.toBe(
      "/watch/63240-puteshestvie-k-bessmertiyu-5?episode=4",
    )
    // второй вызов — из кэша
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it("канонический адрес не редиректит и не ходит в сеть", async () => {
    const fetchImpl = okFetch({ russian: "Путешествие к бессмертию 5" })
    await expect(
      getWatchRedirectPath("/watch/63240-puteshestvie-k-bessmertiyu-5", "", fetchImpl),
    ).resolves.toBeNull()
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it("устаревший slug редиректит, если канон уже известен из кэша", async () => {
    const fetchImpl = okFetch({ russian: "Путешествие к бессмертию 5" })
    await getWatchRedirectPath("/watch/63240", "", fetchImpl)
    await expect(getWatchRedirectPath("/watch/63240-old-slug", "", fetchImpl)).resolves.toBe(
      "/watch/63240-puteshestvie-k-bessmertiyu-5",
    )
  })

  it("устаревший slug при холодном кэше: сразу не редиректит, но прогревает кэш в фоне", async () => {
    const fetchImpl = okFetch({ russian: "Путешествие к бессмертию 5" })
    const tasks: Promise<unknown>[] = []
    await expect(
      getWatchRedirectPath("/watch/63240-old-slug", "", fetchImpl, (t) => tasks.push(t)),
    ).resolves.toBeNull()
    expect(tasks).toHaveLength(1)
    await Promise.all(tasks)
    await expect(getWatchRedirectPath("/watch/63240-old-slug", "?episode=1", fetchImpl)).resolves.toBe(
      "/watch/63240-puteshestvie-k-bessmertiyu-5?episode=1",
    )
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it("использует name, если нет русского названия", async () => {
    const fetchImpl = okFetch({ russian: "", name: "Shingeki no Kyojin" })
    await expect(getWatchRedirectPath("/watch/16498", "", fetchImpl)).resolves.toBe(
      "/watch/16498-shingeki-no-kyojin",
    )
  })

  it("при ошибке Shikimori ничего не ломает — страница отрендерится как обычно", async () => {
    const failing = vi.fn(async () => {
      throw new Error("network")
    }) as unknown as typeof fetch
    await expect(getWatchRedirectPath("/watch/1", "", failing)).resolves.toBeNull()

    const rateLimited = vi.fn(async () => new Response("", { status: 429 })) as unknown as typeof fetch
    await expect(getWatchRedirectPath("/watch/2", "", rateLimited)).resolves.toBeNull()

    const notFound = vi.fn(async () => new Response("", { status: 404 })) as unknown as typeof fetch
    await expect(getWatchRedirectPath("/watch/3", "", notFound)).resolves.toBeNull()
  })

  it("не трогает чужие пути", async () => {
    const fetchImpl = okFetch({ russian: "x" })
    await expect(getWatchRedirectPath("/watch/abc", "", fetchImpl)).resolves.toBeNull()
    await expect(getWatchRedirectPath("/watch/1/extra", "", fetchImpl)).resolves.toBeNull()
    await expect(getWatchRedirectPath("/watchlist", "", fetchImpl)).resolves.toBeNull()
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})
