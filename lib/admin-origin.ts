/**
 * Validate the Origin header on state-changing admin requests.
 *
 * The public Host header is authoritative here; X-Forwarded-Host is deliberately
 * ignored because it is only trustworthy when a proxy is guaranteed to replace
 * it. X-Forwarded-Proto may be used by a TLS-terminating proxy, which must
 * overwrite that header rather than append client-supplied values.
 */
export function isValidAdminRequestOrigin(
  originHeader: string | null,
  headers: Headers,
  requestUrl: string,
  production = process.env.NODE_ENV === "production",
): boolean {
  if (!originHeader) return !production

  try {
    const origin = new URL(originHeader)
    // Browser Origin values are serialized origins (not URLs with paths, user
    // info, fragments, or non-web schemes). Reject "null" and malformed input.
    if (
      (origin.protocol !== "https:" && origin.protocol !== "http:") ||
      origin.origin !== originHeader
    ) {
      return false
    }

    const request = new URL(requestUrl)
    const host = (headers.get("host") || request.host).trim()
    if (!host || host.includes(",") || /[\s/@?#]/.test(host)) return false

    const forwardedProtocol = headers.get("x-forwarded-proto")
    let protocol = request.protocol
    if (forwardedProtocol !== null) {
      const normalized = forwardedProtocol.trim().toLowerCase()
      // Multiple or invalid values are ambiguous and fail closed. Configure the
      // trusted proxy to set one public-facing protocol value.
      if (!/^(https|http)$/.test(normalized)) return false
      protocol = `${normalized}:`
    }

    if (protocol !== "https:" && protocol !== "http:") return false
    if (production && protocol !== "https:") return false

    const target = new URL(`${protocol}//${host}`)
    if (target.pathname !== "/" || target.search || target.hash || target.username || target.password) {
      return false
    }

    return target.origin === origin.origin
  } catch {
    return false
  }
}
