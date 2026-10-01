import { afterEach, describe, expect, it, vi } from "vitest"
import {
  ADMIN_SESSION_TTL_SECONDS,
  constantTimeStringEqual,
  consumeAdminTotp,
  createAdminSessionToken,
  getAdminAuthConfigurationError,
  isAdminTotpRequired,
  isValidAdminSession,
  verifyAdminTotp,
} from "@/lib/admin-auth"

afterEach(() => {
  vi.unstubAllEnvs()
})

function setDevCredentials() {
  vi.stubEnv("NODE_ENV", "test")
  vi.stubEnv("ADMIN_USERNAME", "admin")
  vi.stubEnv("ADMIN_PASSWORD", "test-password")
  vi.stubEnv("ADMIN_SESSION_SECRET", "")
  vi.stubEnv("ADMIN_TOTP_SECRET", "")
}

describe("signed admin sessions and MFA", () => {
  it("does not accept the old forgeable boolean cookie or v1 token", () => {
    setDevCredentials()
    expect(isValidAdminSession("true")).toBe(false)
    expect(isValidAdminSession("v1.9999999999.test-nonce_123.signature")).toBe(false)
    expect(isValidAdminSession(undefined)).toBe(false)
  })

  it("accepts an authentic short-lived session token and rejects it after expiry", () => {
    setDevCredentials()
    const now = Date.UTC(2026, 9, 1)
    const token = createAdminSessionToken(now, "test-nonce_123")
    expect(isValidAdminSession(token, now + 1000)).toBe(true)
    expect(isValidAdminSession(token, now + (ADMIN_SESSION_TTL_SECONDS + 1) * 1000)).toBe(false)
    expect(isValidAdminSession(token, now - 120_000)).toBe(false)
    expect(ADMIN_SESSION_TTL_SECONDS).toBe(30 * 60)
  })

  it("rejects tampered, overlong, and secret-rotated tokens", () => {
    setDevCredentials()
    const now = Date.UTC(2026, 9, 1)
    const token = createAdminSessionToken(now, "test-nonce_123")
    const changedSignature = `${token.slice(0, -1)}${token.endsWith("a") ? "b" : "a"}`

    expect(isValidAdminSession(changedSignature, now + 1000)).toBe(false)
    const [version, expiresAt, nonce] = token.split(".")
    expect(isValidAdminSession(`${version}.${Number(expiresAt) + 1000}.${nonce}.${"a".repeat(43)}`, now)).toBe(false)

    vi.stubEnv("ADMIN_PASSWORD", "rotated-password")
    expect(isValidAdminSession(token, now + 1000)).toBe(false)
  })

  it("prefers the dedicated session secret when configured", () => {
    setDevCredentials()
    vi.stubEnv("ADMIN_SESSION_SECRET", "separate-session-secret")
    const now = Date.UTC(2026, 9, 1)
    const token = createAdminSessionToken(now, "test-nonce_123")
    expect(isValidAdminSession(token, now + 1000)).toBe(true)
    vi.stubEnv("ADMIN_SESSION_SECRET", "rotated-secret")
    expect(isValidAdminSession(token, now + 1000)).toBe(false)
  })

  it("requires a strong session secret, strong password, and valid TOTP secret in production", () => {
    setDevCredentials()
    vi.stubEnv("NODE_ENV", "production")
    expect(getAdminAuthConfigurationError()).not.toBeNull()
    vi.stubEnv("ADMIN_PASSWORD", "long-production-password-123")
    vi.stubEnv("ADMIN_SESSION_SECRET", "s".repeat(32))
    expect(getAdminAuthConfigurationError()).not.toBeNull()
    vi.stubEnv("ADMIN_TOTP_SECRET", "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ")
    expect(getAdminAuthConfigurationError()).toBeNull()
    expect(isAdminTotpRequired()).toBe(true)
  })

  it("verifies RFC 6238 six-digit authenticator codes with limited clock drift", () => {
    const secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ"
    expect(verifyAdminTotp("287082", secret, 59_000)).toBe(true)
    expect(verifyAdminTotp("287082", secret, 30_000)).toBe(true)
    expect(verifyAdminTotp("287082", secret, 90_000)).toBe(false)
    expect(verifyAdminTotp("28708", secret, 59_000)).toBe(false)
    expect(verifyAdminTotp("287082", "not-base32", 59_000)).toBe(false)
  })

  it("rejects replay of an already consumed authenticator step within a process", () => {
    const secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ"
    expect(consumeAdminTotp("287082", secret, 59_000)).toBe(true)
    expect(consumeAdminTotp("287082", secret, 59_000)).toBe(false)
  })

  it("compares credentials without exposing string length or character position", () => {
    expect(constantTimeStringEqual("same-secret", "same-secret")).toBe(true)
    expect(constantTimeStringEqual("same-secret", "same-secreT")).toBe(false)
    expect(constantTimeStringEqual("short", "a much longer secret")).toBe(false)
  })
})
