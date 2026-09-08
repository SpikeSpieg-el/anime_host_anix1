import { describe, expect, it, vi, beforeEach } from "vitest"
import { createRateLimiter, getClientIP } from "@/lib/rate-limit"

describe("createRateLimiter", () => {
  it("allows requests under the limit and decrements remaining", () => {
    const limiter = createRateLimiter({ interval: 60_000, maxRequests: 3 })
    const id = `unit-${Math.random()}`
    const a = limiter.checkLimit(id)
    const b = limiter.checkLimit(id)
    const c = limiter.checkLimit(id)
    expect(a.success).toBe(true)
    expect(a.remaining).toBe(2)
    expect(b.remaining).toBe(1)
    expect(c.remaining).toBe(0)
  })

  it("blocks when maxRequests is reached", () => {
    const limiter = createRateLimiter({ interval: 60_000, maxRequests: 1 })
    const id = `block-${Math.random()}`
    expect(limiter.checkLimit(id).success).toBe(true)
    const blocked = limiter.checkLimit(id)
    expect(blocked.success).toBe(false)
    expect(blocked.remaining).toBe(0)
  })

  it("isolates identifiers", () => {
    const limiter = createRateLimiter({ interval: 60_000, maxRequests: 1 })
    expect(limiter.checkLimit("ip-a").success).toBe(true)
    expect(limiter.checkLimit("ip-b").success).toBe(true)
  })

  it("resets after the window", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"))
    const limiter = createRateLimiter({ interval: 1000, maxRequests: 1 })
    const id = `window-${Math.random()}`
    expect(limiter.checkLimit(id).success).toBe(true)
    expect(limiter.checkLimit(id).success).toBe(false)
    vi.setSystemTime(new Date("2026-01-01T00:00:01.050Z"))
    expect(limiter.checkLimit(id).success).toBe(true)
    vi.useRealTimers()
  })
})

describe("getClientIP", () => {
  function req(headers: Record<string, string>) {
    return {
      headers: {
        get: (key: string) => headers[key.toLowerCase()] ?? headers[key] ?? null,
      },
    } as any
  }

  it("prefers first x-forwarded-for hop", () => {
    expect(getClientIP(req({ "x-forwarded-for": "1.1.1.1, 2.2.2.2" }))).toBe("1.1.1.1")
  })

  it("falls back to x-real-ip", () => {
    expect(getClientIP(req({ "x-real-ip": "8.8.8.8" }))).toBe("8.8.8.8")
  })

  it("falls back to localhost", () => {
    expect(getClientIP(req({}))).toBe("127.0.0.1")
  })
})
