import { afterEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { middleware } from "@/middleware"

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

function postAdmin(origin?: string, extraHeaders: Record<string, string> = {}) {
  const request = new NextRequest("https://weeb-x.com/admin", {
    method: "POST",
    headers: { "x-forwarded-proto": "https", ...extraHeaders },
  })
  // The Request constructor treats Host/Origin as forbidden request headers;
  // Next's incoming middleware request does include them from the network.
  request.headers.set("host", "weeb-x.com")
  if (origin) request.headers.set("origin", origin)
  return request
}

describe("SEO canonical redirects", () => {
  it("returns a real 301 for a numeric watch ID before rendering", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(
      JSON.stringify({ russian: "Киберпанк: Бегущие по краю 2" }),
      { status: 200 },
    )))
    const request = new NextRequest("https://weeb-x.com/watch/61990?episode=2")
    const response = await middleware(request)

    expect(response.status).toBe(301)
    expect(response.headers.get("location")).toBe(
      "https://weeb-x.com/watch/61990-kiberpank-begushchie-po-krayu-2?episode=2",
    )
  })

  it("returns a real 301 for numeric news IDs with the canonical title slug", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(
      JSON.stringify({ topic_title: "Киберпанк: Бегущие по краю 2" }),
      { status: 200 },
    )))
    const request = new NextRequest("https://weeb-x.com/news/61990?from=home")
    const response = await middleware(request)

    expect(response.status).toBe(301)
    expect(response.headers.get("location")).toBe(
      "https://weeb-x.com/news/61990-kiberpank-begushchie-po-krayu-2?from=home",
    )
  })

  it("301-редиректит редакционную новость на canonical slug", async () => {
    const uuid = "01234567-89ab-cdef-0123-456789abcdef"
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co")
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-anon-key")
    vi.stubGlobal("fetch", vi.fn(async () => new Response(
      JSON.stringify([{ id: uuid, title: "Редакционная новость" }]),
      { status: 200 },
    )))
    const response = await middleware(new NextRequest(`https://weeb-x.com/news/custom-${uuid}`))

    expect(response.status).toBe(301)
    expect(response.headers.get("location")).toBe(
      `https://weeb-x.com/news/custom-${uuid}-redaktsionnaya-novost`,
    )
  })

  it("301-редиректит любой неправильный slug новости при холодном кэше", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(
      JSON.stringify({ topic_title: "Тестовая новость" }),
      { status: 200 },
    )))
    const request = new NextRequest("https://weeb-x.com/news/987654-совершенно-левый-slug")
    const response = await middleware(request)

    expect(response.status).toBe(301)
    expect(response.headers.get("location")).toBe(
      "https://weeb-x.com/news/987654-testovaya-novost",
    )
  })
})

describe("admin middleware protections", () => {
  it("rejects production mutations with a missing Origin and sends private security headers", async () => {
    vi.stubEnv("NODE_ENV", "production")
    const response = await middleware(postAdmin())

    expect(response.status).toBe(403)
    expect(response.headers.get("cache-control")).toContain("no-store")
    expect(response.headers.get("referrer-policy")).toBe("no-referrer")
    expect(response.headers.get("content-security-policy")).toContain("frame-ancestors 'none'")
    expect(response.headers.get("strict-transport-security")).toContain("max-age=31536000")
  })

  it("allows a matching origin but rejects a spoofed X-Forwarded-Host", async () => {
    vi.stubEnv("NODE_ENV", "production")
    const accepted = await middleware(postAdmin("https://weeb-x.com"))
    const rejected = await middleware(
      postAdmin("https://attacker.example", { "x-forwarded-host": "attacker.example" }),
    )

    expect(accepted.status).toBe(200)
    expect(rejected.status).toBe(403)
  })
})
