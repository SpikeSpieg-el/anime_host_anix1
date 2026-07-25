import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

// Paths that require CSRF protection (state-changing operations)
const CSRF_PROTECTED_PATHS = [
  "/api/profile",
  "/api/bookmarks",
  "/api/history",
  "/api/admin",
]

// Paths that are exempt from CSRF checks (external app integrations with their own auth)
const CSRF_EXEMPT_PATHS = [
  "/api/lampa/",
]

// Paths that are API routes (for header checks)
const API_PATH_PREFIX = "/api/"

const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "1; mode=block",
  "Referrer-Policy": "no-referrer",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  "Content-Security-Policy": [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://vercel.live https://assets.vercel.com",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https: http:",
    "font-src 'self' data:",
    "connect-src 'self' https://*.supabase.co https://*.vercel.app https://*.analytics.vercel.com wss://*.vercel.app https://nhost.weebx.duckdns.org:8443 wss://nhost.weebx.duckdns.org:8443",
    "frame-src 'self' https: http:",
    "media-src 'self' https: http: blob:",
    "object-src 'none'",
    "base-uri 'self'",
  ].join("; "),
}

// Headers to strip (tech stack disclosure)
const STRIP_HEADERS = [
  "X-Powered-By",
  "X-Nextjs-Prerender",
  "X-Matched-Path",
]

function applySecurityHeaders(response: NextResponse) {
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(key, value)
  }
  for (const header of STRIP_HEADERS) {
    response.headers.delete(header)
  }
  return response
}

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  const method = request.method

  // Only protect state-changing HTTP methods
  const isStateChangingMethod = ["POST", "PUT", "DELETE", "PATCH"].includes(method)

  if (!isStateChangingMethod) {
    // Apply security headers even on GET requests
    return applySecurityHeaders(NextResponse.next())
  }

  // Check if path is exempt from CSRF (external integrations like Lampa)
  const isExempt = CSRF_EXEMPT_PATHS.some((path) => pathname.startsWith(path))
  if (isExempt) {
    const response = NextResponse.next()
    response.headers.set("Access-Control-Allow-Origin", "*")
    response.headers.set("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
    response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization")
    return applySecurityHeaders(response)
  }

  // Check if path requires CSRF protection
  const requiresCsrf = CSRF_PROTECTED_PATHS.some((path) => pathname.startsWith(path))

  if (!requiresCsrf) {
    return applySecurityHeaders(NextResponse.next())
  }

  // For API routes, check for required headers
  if (pathname.startsWith(API_PATH_PREFIX)) {
    const contentType = request.headers.get("content-type")
    const origin = request.headers.get("origin")
    const host = request.headers.get("host")

    // Check Content-Type for proper requests
    if (contentType && !contentType.includes("application/json")) {
      // Allow form submissions but log suspicious activity
      console.warn(`Suspicious request to ${pathname}: unexpected Content-Type: ${contentType}`)
    }

    // Check Origin header if present (for cross-origin requests)
    if (origin && host) {
      const originUrl = new URL(origin)
      if (originUrl.host !== host) {
        console.warn(`Cross-origin request from ${origin} to ${pathname}`)
        // In production, you might want to block this
        // return new NextResponse("Forbidden", { status: 403 })
      }
    }
  }

  const response = NextResponse.next()
  return applySecurityHeaders(response)
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public folder)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
