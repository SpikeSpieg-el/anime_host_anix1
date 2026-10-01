import { describe, expect, it } from "vitest"
import { isValidAdminRequestOrigin } from "@/lib/admin-origin"

function requestHeaders(values: Record<string, string> = {}) {
  return new Headers({ host: "weeb-x.com", ...values })
}

describe("admin same-origin protection", () => {
  it("accepts the public HTTPS origin through a TLS-terminating proxy", () => {
    const headers = requestHeaders({
      "x-forwarded-proto": "https",
      // This header is not trusted for CSRF validation.
      "x-forwarded-host": "attacker.example",
    })

    expect(
      isValidAdminRequestOrigin(
        "https://weeb-x.com",
        headers,
        "http://internal-service:3000/admin",
        true,
      ),
    ).toBe(true)
  })

  it("does not let a spoofed forwarded host authorize a cross-origin request", () => {
    const headers = requestHeaders({
      "x-forwarded-proto": "https",
      "x-forwarded-host": "attacker.example",
    })

    expect(
      isValidAdminRequestOrigin(
        "https://attacker.example",
        headers,
        "http://internal-service:3000/admin",
        true,
      ),
    ).toBe(false)
  })

  it("rejects mismatched hosts, protocols, malformed origins, and ambiguous proxy headers", () => {
    const httpsHeaders = requestHeaders({ "x-forwarded-proto": "https" })
    expect(
      isValidAdminRequestOrigin(
        "https://evil.example",
        httpsHeaders,
        "http://internal-service/admin",
        true,
      ),
    ).toBe(false)
    expect(
      isValidAdminRequestOrigin(
        "http://weeb-x.com",
        httpsHeaders,
        "http://internal-service/admin",
        true,
      ),
    ).toBe(false)
    expect(
      isValidAdminRequestOrigin(
        "null",
        httpsHeaders,
        "http://internal-service/admin",
        true,
      ),
    ).toBe(false)
    expect(
      isValidAdminRequestOrigin(
        "https://weeb-x.com",
        requestHeaders({ "x-forwarded-proto": "https,http" }),
        "http://internal-service/admin",
        true,
      ),
    ).toBe(false)
  })

  it("requires Origin in production but preserves originless local development flows", () => {
    expect(
      isValidAdminRequestOrigin(null, requestHeaders({ "x-forwarded-proto": "https" }), "https://weeb-x.com/admin", true),
    ).toBe(false)
    expect(
      isValidAdminRequestOrigin(null, requestHeaders(), "http://localhost:3000/admin", false),
    ).toBe(true)
  })

  it("normalizes the target host and port using the effective request protocol", () => {
    expect(
      isValidAdminRequestOrigin(
        "http://localhost:3000",
        requestHeaders({ host: "localhost:3000" }),
        "http://localhost:3000/admin",
        false,
      ),
    ).toBe(true)
  })
})
