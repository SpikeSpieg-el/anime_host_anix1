import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { getNewsPath, getNewsSegment, parseNewsParam } from "@/lib/seo/news-url"
import { __resetNewsRedirectCache, getNewsRedirectPath } from "@/lib/seo/news-redirect"

describe("news-url", () => {
  it("uses a transliterated slug only for numeric news IDs", () => {
    expect(getNewsSegment("61990", "Киберпанк: Бегущие по краю 2")).toBe(
      "61990-kiberpank-begushchie-po-krayu-2",
    )
    expect(getNewsPath("custom-abc", "Заголовок")).toBe("/news/custom-abc")
    expect(getNewsPath("custom-01234567-89ab-cdef-0123-456789abcdef", "Редакционная новость"))
      .toBe("/news/custom-01234567-89ab-cdef-0123-456789abcdef-redaktsionnaya-novost")
  })

  it("parses numeric IDs from the canonical route", () => {
    expect(parseNewsParam("61990-kiberpank")).toBe("61990")
    expect(parseNewsParam("61990")).toBe("61990")
    expect(parseNewsParam("jikan-123-title")).toBe("jikan-123-title")
    expect(parseNewsParam("custom-01234567-89ab-cdef-0123-456789abcdef-zagolovok"))
      .toBe("custom-01234567-89ab-cdef-0123-456789abcdef")
  })
})

describe("news redirect middleware helper", () => {
  beforeEach(() => __resetNewsRedirectCache())
  afterEach(() => vi.unstubAllEnvs())

  it("redirects numeric news URLs and canonicalizes cached old slugs", async () => {
    const fetchImpl = vi.fn(async () => new Response(
      JSON.stringify({ topic_title: "Киберпанк: Бегущие по краю 2" }),
      { status: 200 },
    )) as unknown as typeof fetch

    await expect(getNewsRedirectPath("/news/61990", fetchImpl)).resolves.toBe(
      "/news/61990-kiberpank-begushchie-po-krayu-2",
    )
    await expect(
      getNewsRedirectPath("/news/61990-old-title", fetchImpl),
    ).resolves.toBe("/news/61990-kiberpank-begushchie-po-krayu-2")
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it("does not guess a slug when the lookup fails or the path is not numeric", async () => {
    const failed = vi.fn(async () => new Response("", { status: 429 })) as unknown as typeof fetch
    await expect(getNewsRedirectPath("/news/61990", failed)).resolves.toBeNull()
    await expect(getNewsRedirectPath("/news/custom-61990", failed)).resolves.toBeNull()
    await expect(getNewsRedirectPath("/news/61990/comments", failed)).resolves.toBeNull()
  })

  it("redirects a wrong slug immediately even with a cold cache", async () => {
    const fetchImpl = vi.fn(async () => new Response(
      JSON.stringify({ topic_title: "Тестовая новость" }),
      { status: 200 },
    )) as unknown as typeof fetch

    await expect(getNewsRedirectPath("/news/42-any-arbitrary-slug", fetchImpl)).resolves.toBe(
      "/news/42-testovaya-novost",
    )
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it("redirects custom editorial news IDs to their title slug", async () => {
    const uuid = "01234567-89ab-cdef-0123-456789abcdef"
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co")
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-anon-key")
    const fetchMock = vi.fn(async (_input: string | URL | Request) => new Response(
      JSON.stringify([{ id: uuid, title: "Редакционная новость" }]),
      { status: 200 },
    ))
    const fetchImpl = fetchMock as unknown as typeof fetch

    await expect(getNewsRedirectPath(`/news/custom-${uuid}`, fetchImpl)).resolves.toBe(
      `/news/custom-${uuid}-redaktsionnaya-novost`,
    )
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(String(fetchMock.mock.calls[0][0])).toContain("/rest/v1/custom_news?")
  })

  it("keeps the exact slug and redirects trailing-slash variants", async () => {
    const fetchImpl = vi.fn(async () => new Response(
      JSON.stringify({ topic_title: "Тестовая новость" }),
      { status: 200 },
    )) as unknown as typeof fetch

    await expect(getNewsRedirectPath("/news/42-testovaya-novost", fetchImpl)).resolves.toBeNull()
    await expect(getNewsRedirectPath("/news/42-testovaya-novost/", fetchImpl)).resolves.toBe(
      "/news/42-testovaya-novost",
    )
  })
})
