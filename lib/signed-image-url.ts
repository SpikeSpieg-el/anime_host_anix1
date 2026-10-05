export const SIGNED_IMAGE_URL_REFRESH_BUFFER_MS = 60_000

/**
 * Kitsu can return AWS SigV4 URLs that expire after a short period. Return the
 * expiry timestamp for these URLs, `null` for an unsigned/permanent URL, and
 * `0` for a signed URL whose expiry cannot be trusted.
 */
export function getSignedImageUrlExpiresAt(url: string): number | null {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }

  const entries = [...parsed.searchParams.entries()]
  const getParam = (name: string) =>
    entries.find(([key]) => key.toLowerCase() === name.toLowerCase())?.[1]
  const hasAwsSigningParams = entries.some(([key]) => key.toLowerCase().startsWith("x-amz-"))
  if (!hasAwsSigningParams) return null

  const signature = getParam("X-Amz-Signature")
  if (!signature) return 0

  const date = getParam("X-Amz-Date")
  const expiresInSeconds = Number(getParam("X-Amz-Expires"))
  const match = date?.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/)
  if (!match || !Number.isFinite(expiresInSeconds) || expiresInSeconds <= 0) {
    // If a URL is signed but its expiry cannot be parsed, don't cache it.
    return 0
  }

  const [year, month, day, hour, minute, second] = match.slice(1).map(Number)
  const signedAt = Date.UTC(year, month - 1, day, hour, minute, second)
  return Number.isFinite(signedAt) ? signedAt + expiresInSeconds * 1000 : 0
}

/** Whether a poster URL is still safe to use, with a small refresh buffer. */
export function isImageUrlFresh(
  url: string,
  now = Date.now(),
  refreshBufferMs = SIGNED_IMAGE_URL_REFRESH_BUFFER_MS,
): boolean {
  const expiresAt = getSignedImageUrlExpiresAt(url)
  return expiresAt === null || expiresAt > now + refreshBufferMs
}

/** Signed URLs must not be written to long-lived browser storage. */
export function isImageUrlSafeToPersist(url: string): boolean {
  return getSignedImageUrlExpiresAt(url) === null
}
