import { afterEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { middleware } from "@/middleware"

afterEach(() => {
  vi.unstubAllEnvs()
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
