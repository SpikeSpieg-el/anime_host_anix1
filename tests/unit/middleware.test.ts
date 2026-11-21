import { afterEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { middleware } from "@/middleware"
import { __resetWatchRedirectCache } from "@/lib/seo/watch-redirect"

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  __resetWatchRedirectCache()
})

const GOOGLEBOT_UA = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"

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

describe("noindex-регресс: живые страницы не должны отдавать noindex роботу", () => {
  it("числовой /manga/{id} получает честный 404, а не «200 + noindex»", async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal("fetch", fetchSpy)
    const response = await middleware(new NextRequest("https://weeb-x.com/manga/96792"))
    expect(response.status).toBe(404)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("UUID MangaDex в /manga/ пропускается к странице", async () => {
    const response = await middleware(
      new NextRequest("https://weeb-x.com/manga/a1c7c817-4e59-43b7-9365-09675a149a6f"),
    )
    expect(response.status).toBe(200)
  })

  it("роботу при недоступном Shikimori — 503 + Retry-After вместо страницы с noindex", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 429 })))
    const request = new NextRequest("https://weeb-x.com/watch/64084-silneyshaya-vedma-v-mire-startovala", {
      headers: { "user-agent": GOOGLEBOT_UA },
    })
    const response = await middleware(request)
    expect(response.status).toBe(503)
    expect(response.headers.get("retry-after")).toBe("120")
  })

  it("человеку при недоступном Shikimori 503 не отдаём (адрес со slug'ом — без задержки)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 429 })))
    const response = await middleware(
      new NextRequest("https://weeb-x.com/watch/64084-silneyshaya-vedma-v-mire-startovala"),
    )
    expect(response.status).toBe(200)
  })

  it("роботу устаревший slug сразу отдаёт настоящий 301 (без meta refresh)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(
      JSON.stringify({ russian: "Сердечный треугольник: женское общежитие Садзанами" }),
      { status: 200 },
    )))
    const request = new NextRequest(
      "https://weeb-x.com/watch/4849-serdechnyy-treugol-nik-zhenskoe-obshchezhitie-sadzanami",
      { headers: { "user-agent": GOOGLEBOT_UA } },
    )
    const response = await middleware(request)
    expect(response.status).toBe(301)
    expect(response.headers.get("location")).toBe(
      "https://weeb-x.com/watch/4849-serdechnyy-treugolnik-zhenskoe-obshchezhitie-sadzanami",
    )
  })

  it("роботу несуществующий тайтл со slug'ом — честный 404", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 404 })))
    const request = new NextRequest("https://weeb-x.com/watch/99999999-net-takogo", {
      headers: { "user-agent": GOOGLEBOT_UA },
    })
    const response = await middleware(request)
    expect(response.status).toBe(404)
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

describe("www → apex редирект", () => {
  it("308-редиректит www на apex, сохраняя путь и query", async () => {
    const request = new NextRequest("https://www.weeb-x.com/catalog?genre=%D0%AD%D0%BA%D1%88%D0%B5%D0%BD")
    request.headers.set("host", "www.weeb-x.com")

    const response = await middleware(request)

    expect(response.status).toBe(308)
    expect(response.headers.get("location")).toBe(
      "https://weeb-x.com/catalog?genre=%D0%AD%D0%BA%D1%88%D0%B5%D0%BD",
    )
    expect(response.headers.get("cache-control")).toContain("public")
  })

  it("не трогает apex-домен", async () => {
    const request = new NextRequest("https://weeb-x.com/privacy")
    request.headers.set("host", "weeb-x.com")

    const response = await middleware(request)

    expect(response.status).toBe(200)
  })

  it("учитывает X-Forwarded-Host за прокси (внутренний origin)", async () => {
    // За Caddy request.url может быть http://localhost:3000 — судить о хосте
    // посетителя можно только по заголовкам.
    const request = new NextRequest("http://localhost:3000/news", {
      headers: { "x-forwarded-host": "www.weeb-x.com" },
    })

    const response = await middleware(request)

    expect(response.status).toBe(308)
    expect(response.headers.get("location")).toBe("https://weeb-x.com/news")
  })
})

describe("security headers hardening", () => {
  it("HSTS включает includeSubDomains, но не preload", async () => {
    vi.stubEnv("NODE_ENV", "production")
    const response = await middleware(new NextRequest("https://weeb-x.com/privacy"))

    const hsts = response.headers.get("strict-transport-security") ?? ""
    expect(hsts).toContain("includeSubDomains")
    expect(hsts).not.toContain("preload")
  })

  it("CSP не раскрывает внутренний DuckDNS-хост", async () => {
    const response = await middleware(new NextRequest("https://weeb-x.com/"))
    const csp = response.headers.get("content-security-policy") ?? ""

    expect(csp).not.toContain("duckdns")
    expect(csp).toContain("connect-src")
  })
})
