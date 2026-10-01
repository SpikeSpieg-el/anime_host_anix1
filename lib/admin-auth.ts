import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto"

// __Host- cookies must be Secure, Path=/, and have no Domain attribute.
// Keep the non-prefixed name for local HTTP development only.
export const ADMIN_AUTH_COOKIE = process.env.NODE_ENV === "production"
  ? "__Host-anix_admin_session"
  : "admin_auth"
export const ADMIN_SESSION_TTL_SECONDS = 30 * 60

const TOKEN_VERSION = "v2"
const TOTP_PERIOD_SECONDS = 30
const TOTP_CODE_DIGITS = 6
const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"

function getSigningSecret(): string | null {
  const dedicatedSecret = process.env.ADMIN_SESSION_SECRET
  if (process.env.NODE_ENV === "production") {
    return dedicatedSecret && Buffer.byteLength(dedicatedSecret, "utf8") >= 32 ? dedicatedSecret : null
  }
  // A fallback keeps local development simple. Production must use a separate,
  // randomly generated secret and will fail closed without it.
  return dedicatedSecret || process.env.ADMIN_PASSWORD || null
}

function decodeBase32(secret: string): Buffer | null {
  const normalized = secret.trim().toUpperCase()
  if (!/^[A-Z2-7]{26,128}$/.test(normalized)) return null

  let buffer = 0
  let bits = 0
  const bytes: number[] = []
  for (const character of normalized) {
    const value = BASE32_ALPHABET.indexOf(character)
    if (value < 0) return null
    buffer = (buffer << 5) | value
    bits += 5
    if (bits >= 8) {
      bits -= 8
      bytes.push((buffer >> bits) & 0xff)
      buffer &= (1 << bits) - 1
    }
  }

  if (bytes.length < 16) return null
  return Buffer.from(bytes)
}

/** Configuration errors are deliberately generic to callers and detailed only in server logs. */
export function getAdminAuthConfigurationError(): string | null {
  const username = process.env.ADMIN_USERNAME?.trim()
  const password = process.env.ADMIN_PASSWORD
  if (!username || !password) return "ADMIN_USERNAME and ADMIN_PASSWORD must be configured"

  const totpSecret = process.env.ADMIN_TOTP_SECRET
  if (process.env.NODE_ENV === "production") {
    if (password.length < 16) return "ADMIN_PASSWORD must contain at least 16 characters in production"
    if (!getSigningSecret()) return "ADMIN_SESSION_SECRET must contain at least 32 bytes in production"
    if (!totpSecret || !decodeBase32(totpSecret)) return "ADMIN_TOTP_SECRET must be a valid Base32 secret in production"
  } else if (totpSecret && !decodeBase32(totpSecret)) {
    return "ADMIN_TOTP_SECRET is not a valid Base32 secret"
  }

  return null
}

export function isAdminTotpRequired(): boolean {
  return process.env.NODE_ENV === "production" || Boolean(process.env.ADMIN_TOTP_SECRET)
}

/** Compare secrets without revealing their length or first differing character. */
export function constantTimeStringEqual(actual: string, expected: string): boolean {
  const actualDigest = createHash("sha256").update(actual, "utf8").digest()
  const expectedDigest = createHash("sha256").update(expected, "utf8").digest()
  return timingSafeEqual(actualDigest, expectedDigest)
}

function generateTotp(secretBytes: Buffer, step: number): string {
  const counter = Buffer.alloc(8)
  counter.writeBigUInt64BE(BigInt(step))
  const digest = createHmac("sha1", secretBytes).update(counter).digest()
  const offset = digest[digest.length - 1] & 0x0f
  const binary = ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff)
  return String(binary % (10 ** TOTP_CODE_DIGITS)).padStart(TOTP_CODE_DIGITS, "0")
}

function matchingTotpStep(code: string, secret: string, nowMs: number): number | null {
  if (!/^\d{6}$/.test(code)) return null
  const key = decodeBase32(secret)
  if (!key) return null

  const currentStep = Math.floor(nowMs / 1000 / TOTP_PERIOD_SECONDS)
  const submitted = Buffer.from(code, "ascii")
  let matchedStep: number | null = null
  for (const step of [currentStep - 1, currentStep, currentStep + 1]) {
    if (step < 0) continue
    const candidate = Buffer.from(generateTotp(key, step), "ascii")
    const stepMatches = timingSafeEqual(candidate, submitted)
    if (stepMatches) matchedStep = step
  }
  return matchedStep
}

/** Verify a standard 6-digit authenticator-app TOTP (30-second period, ±1 step drift). */
export function verifyAdminTotp(code: string, secret: string, nowMs = Date.now()): boolean {
  return matchingTotpStep(code, secret, nowMs) !== null
}

let lastConsumedTotpStep = -1

/** Reject re-use of a TOTP step within this server process. */
export function consumeAdminTotp(code: string, secret: string, nowMs = Date.now()): boolean {
  const matchedStep = matchingTotpStep(code, secret, nowMs)
  if (matchedStep === null || matchedStep <= lastConsumedTotpStep) return false
  lastConsumedTotpStep = matchedStep
  return true
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url")
}

/** Create a tamper-proof, short-lived admin cookie value. Server-only. */
export function createAdminSessionToken(
  nowMs = Date.now(),
  nonce = randomBytes(16).toString("base64url"),
): string {
  if (getAdminAuthConfigurationError()) throw new Error("Admin security configuration is incomplete")
  const secret = getSigningSecret()
  if (!secret) throw new Error("Admin session signing secret is not configured")

  const expiresAt = Math.floor(nowMs / 1000) + ADMIN_SESSION_TTL_SECONDS
  const payload = `${TOKEN_VERSION}.${expiresAt}.${nonce}`
  return `${payload}.${sign(payload, secret)}`
}

/** Verify a signed, expiring admin session; old boolean cookies and v1 tokens are rejected. */
export function isValidAdminSession(token: unknown, nowMs = Date.now()): boolean {
  if (typeof token !== "string" || getAdminAuthConfigurationError()) return false

  const secret = getSigningSecret()
  if (!secret) return false

  const [version, expiresAtText, nonce, signature, ...extra] = token.split(".")
  if (
    extra.length > 0 ||
    version !== TOKEN_VERSION ||
    !/^\d+$/.test(expiresAtText || "") ||
    !/^[A-Za-z0-9_-]{8,64}$/.test(nonce || "") ||
    !/^[A-Za-z0-9_-]{43}$/.test(signature || "")
  ) {
    return false
  }

  const nowSeconds = Math.floor(nowMs / 1000)
  const expiresAt = Number(expiresAtText)
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= nowSeconds) return false
  if (expiresAt > nowSeconds + ADMIN_SESSION_TTL_SECONDS + 60) return false

  const payload = `${version}.${expiresAtText}.${nonce}`
  const expected = Buffer.from(sign(payload, secret), "base64url")
  const actual = Buffer.from(signature, "base64url")
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}
