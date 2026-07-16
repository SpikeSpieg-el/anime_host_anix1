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

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  const method = request.method

  // Only protect state-changing HTTP methods
  const isStateChangingMethod = ["POST", "PUT", "DELETE", "PATCH"].includes(method)

  if (!isStateChangingMethod) {
    return NextResponse.next()
  }

  // Check if path is exempt from CSRF (external integrations like Lampa)
  const isExempt = CSRF_EXEMPT_PATHS.some((path) => pathname.startsWith(path))
  if (isExempt) {
    const response = NextResponse.next()
    response.headers.set("Access-Control-Allow-Origin", "*")
    response.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
    response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization")
    return response
  }

  // Check if path requires CSRF protection
  const requiresCsrf = CSRF_PROTECTED_PATHS.some((path) => pathname.startsWith(path))

  if (!requiresCsrf) {
    return NextResponse.next()
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

  // Add security headers to all responses
  response.headers.set("X-Content-Type-Options", "nosniff")
  response.headers.set("X-Frame-Options", "DENY")
  response.headers.set("X-XSS-Protection", "1; mode=block")
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin")

  // CSP header - adjust based on your needs
  const cspDirectives = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://vercel.live https://assets.vercel.com",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https: http:",
    "font-src 'self' data:",
    "connect-src 'self' https://*.supabase.co https://*.vercel.app https://*.analytics.vercel.com",
    "frame-src 'self' https: http:",
    "media-src 'self' https: http: blob:",
  ]

  response.headers.set("Content-Security-Policy", cspDirectives.join("; "))

  return response
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
