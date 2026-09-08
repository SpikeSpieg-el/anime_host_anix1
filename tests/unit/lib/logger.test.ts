import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import { createLogger, loggers, logger } from "@/lib/logger"

describe("logger", () => {
  const spies: Array<ReturnType<typeof vi.spyOn>> = []

  beforeEach(() => {
    spies.push(vi.spyOn(console, "debug").mockImplementation(() => {}))
    spies.push(vi.spyOn(console, "info").mockImplementation(() => {}))
    spies.push(vi.spyOn(console, "warn").mockImplementation(() => {}))
    spies.push(vi.spyOn(console, "error").mockImplementation(() => {}))
  })

  afterEach(() => {
    spies.splice(0).forEach((s) => s.mockRestore())
  })

  it("exposes named loggers", () => {
    expect(loggers.auth).toBeTruthy()
    expect(loggers.api).toBeTruthy()
    expect(logger).toBeTruthy()
  })

  it("createLogger uses custom namespace", () => {
    const custom = createLogger("gacha")
    custom.warn("hello")
    expect(console.warn).toHaveBeenCalled()
    const msg = String((console.warn as any).mock.calls[0][0])
    expect(msg).toContain("[gacha]")
    expect(msg).toContain("hello")
  })

  it("redacts sensitive keys", () => {
    const custom = createLogger("auth")
    custom.warn("login", { password: "secret", token: "abc", username: "neo" })
    const msg = String((console.warn as any).mock.calls[0][0])
    expect(msg).toContain("[REDACTED]")
    expect(msg).not.toContain("secret")
    expect(msg).toContain("neo")
  })

  it("serializes Error objects with name/message", () => {
    const custom = createLogger("api")
    custom.error("fail", new Error("boom"))
    const msg = String((console.error as any).mock.calls[0][0])
    expect(msg).toContain("boom")
  })

  it("debug/info are skipped in production", () => {
    const original = process.env.NODE_ENV
    process.env.NODE_ENV = "production"
    const prod = createLogger("prod")
    prod.debug("nope")
    prod.info("nope")
    expect(console.debug).not.toHaveBeenCalled()
    expect(console.info).not.toHaveBeenCalled()
    prod.warn("still")
    expect(console.warn).toHaveBeenCalled()
    process.env.NODE_ENV = original
  })
})
