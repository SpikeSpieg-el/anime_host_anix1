import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/shikimori/mirror", () => ({
  toActiveShikimoriOrigin: (url: string) => url,
  noteShikimoriFailure: vi.fn(),
  maybeRefreshShikimoriMirror: vi.fn(),
}))

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules() })

describe("Shikimori watch refresh", () => {
  it("bypasses both cache layers and deduplicates repeated fresh reads", async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ episodes_aired: 9 })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ episodes_aired: 10 })))
    vi.stubGlobal("fetch", fetch)
    const { shikimoriJson } = await import("@/lib/shikimori/client")
    const url = "https://shikimori.one/api/animes/61469"
    const init = { next: { revalidate: 600 } }
    const opts = { fallback: null, ttlMs: 600_000, staleTtlMs: 86_400_000 }
    expect(await shikimoriJson(url, init, opts)).toEqual({ episodes_aired: 9 })
    const [first, second] = await Promise.all([
      shikimoriJson(url, init, { ...opts, bypassCache: true }),
      shikimoriJson(url, init, { ...opts, bypassCache: true }),
    ])
    expect(first).toEqual({ episodes_aired: 10 })
    expect(second).toEqual(first)
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(fetch.mock.calls[1][1]).toMatchObject({ cache: "no-store", next: { revalidate: 0 } })
    expect(await shikimoriJson(url, init, { ...opts, bypassCache: true })).toEqual(first)
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(await shikimoriJson(url, init, opts)).toEqual(first)
  })

  it("does not let an older in-flight request overwrite the fresh result", async () => {
    let resolveOld!: (response: Response) => void
    const oldResponse = new Promise<Response>(resolve => { resolveOld = resolve })
    const fetch = vi.fn().mockReturnValueOnce(oldResponse)
      .mockResolvedValueOnce(new Response(JSON.stringify({ episodes_aired: 10 })))
    vi.stubGlobal("fetch", fetch)
    const { shikimoriJson } = await import("@/lib/shikimori/client")
    const url = "https://shikimori.one/api/animes/61469"
    const opts = { fallback: null, ttlMs: 600_000, staleTtlMs: 86_400_000 }
    const old = shikimoriJson(url, {}, opts)
    await Promise.resolve()
    const fresh = await shikimoriJson(url, {}, { ...opts, bypassCache: true })
    resolveOld(new Response(JSON.stringify({ episodes_aired: 9 })))
    await old
    expect(await shikimoriJson(url, {}, opts)).toEqual(fresh)
    expect(fresh).toEqual({ episodes_aired: 10 })
  })

  it("does not pretend a failed fresh request was successful", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response("", { status: 503 }))
    vi.stubGlobal("fetch", fetch)
    const { shikimoriJson } = await import("@/lib/shikimori/client")
    expect(await shikimoriJson("https://shikimori.one/api/animes/42", {}, { fallback: null, bypassCache: true })).toBeNull()
  })
})
