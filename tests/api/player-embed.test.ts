import { NextRequest } from "next/server"
import { afterEach, describe, expect, it, vi } from "vitest"
import { GET } from "@/app/embed/[token]/route"
import { createPlayerToken } from "@/lib/player-protect"

const PLAYER_URL = "https://kodikplayer.com/serial/123/hash/720p?lang=ru"
const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"

function makeRequest(token: string, query = "", headers: Record<string, string> = {}) {
  const request = new NextRequest(`https://weeb-x.com/embed/${token}${query}`, {
    headers: { "user-agent": BROWSER_UA },
  })
  // happy-dom treats Referer as a forbidden Request header; set it on the
  // server-side request object the same way Next's runtime receives it.
  request.headers.set("referer", "https://weeb-x.com/watch/21-one-piece")
  for (const [name, value] of Object.entries(headers)) {
    request.headers.set(name, value)
  }
  return request
}

describe("/embed/[token] player route", () => {
  afterEach(() => vi.restoreAllMocks())

  it("redirects the browser to Kodik's origin instead of proxying its HTML", async () => {
    const token = createPlayerToken(PLAYER_URL)!
    const fetchSpy = vi.spyOn(globalThis, "fetch")
    const request = makeRequest(
      token,
      "?episode=4&quality=1080&country=JP&untrusted=https%3A%2F%2Fevil.example"
    )

    const response = await GET(request, { params: Promise.resolve({ token }) })

    expect(response.status).toBe(302)
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(response.headers.get("cache-control")).toBe("private, no-store")
    expect(response.headers.get("x-robots-tag")).toContain("noindex")

    const location = response.headers.get("location")
    expect(location).toBeTruthy()
    const redirectedUrl = new URL(location!)
    expect(redirectedUrl.origin).toBe("https://kodikplayer.com")
    expect(redirectedUrl.pathname).toBe("/serial/123/hash/720p")
    expect(redirectedUrl.searchParams.get("lang")).toBe("ru")
    expect(redirectedUrl.searchParams.get("episode")).toBe("4")
    expect(redirectedUrl.searchParams.get("quality")).toBe("1080")
    expect(redirectedUrl.searchParams.get("country")).toBe("JP")
    expect(redirectedUrl.searchParams.has("untrusted")).toBe(false)
  })

  it("does not issue redirects to crawlers or from another site", async () => {
    const token = createPlayerToken(PLAYER_URL)!

    const crawlerResponse = await GET(
      makeRequest(token, "", {
        "user-agent": "Mozilla/5.0 (compatible; Googlebot/2.1)",
      }),
      { params: Promise.resolve({ token }) }
    )
    expect(crawlerResponse.status).toBe(404)
    expect(crawlerResponse.headers.get("location")).toBeNull()

    const hotlinkResponse = await GET(
      makeRequest(token, "", { referer: "https://another-site.example/watch" }),
      { params: Promise.resolve({ token }) }
    )
    expect(hotlinkResponse.status).toBe(404)
    expect(hotlinkResponse.headers.get("location")).toBeNull()
  })
})
