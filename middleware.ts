import { NextResponse } from "next/server"
import type { NextFetchEvent, NextRequest } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { doesWatchAnimeExist, getWatchRedirectPath } from "@/lib/seo/watch-redirect"
import { isValidAdminRequestOrigin } from "@/lib/admin-origin"
import { getClientIp, ipMatchesTarget, parseBlocklistEnv } from "@/lib/ip-block"

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

// Paths that are exempt from security headers (like X-Frame-Options: DENY).
// /embed/ — отдельная страница плеера: она проксирует внешний видеоплеер
// и должна позволять встраивание в iframe на нашем же сайте.
const SECURITY_HEADERS_EXEMPT_PATHS = [
  "/embed/",
]

// Paths that are API routes (for header checks)
const API_PATH_PREFIX = "/api/"

// Umami (self-hosted analytics in Coolify): the browser must be allowed to load
// the tracker script (<umami>/script.js) and to POST events to the same origin.
// Значение по умолчанию совпадает с DEFAULT_UMAMI_ORIGIN в lib/analytics.ts,
// поэтому достаточно задать только NEXT_PUBLIC_UMAMI_WEBSITE_ID.
// ВАЖНО: эти заголовки выставляет middleware, и они перекрывают заголовки из
// next.config.mjs — править нужно оба места.
const UMAMI_ORIGIN = (() => {
  const DEFAULT_ORIGIN = "https://analytics.weeb-x.com"
  const raw = process.env.NEXT_PUBLIC_UMAMI_URL
  if (!raw) return DEFAULT_ORIGIN
  try {
    const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
    return new URL(withScheme).origin
  } catch {
    return DEFAULT_ORIGIN
  }
})()

const PVP_SERVER_ORIGIN = (() => {
  const raw = process.env.NEXT_PUBLIC_PVP_SERVER_URL
  if (!raw) return ''
  try {
    const url = new URL(raw)
    // Add both https and wss for WebSocket connections
    return `${url.origin} wss://${url.host}`
  } catch {
    return ''
  }
})()

const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "1; mode=block",
  // strict-origin-when-cross-origin вместо no-referrer: Umami берёт referrer
  // из document.referrer, а no-referrer всегда отдаёт пустую строку —
  // отчёт «Источники» в аналитике был бы пустым. Внешним сайтам при этом
  // уходит только origin (https://weeb-x.com), без полного URL.
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  "Content-Security-Policy": [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""} ${UMAMI_ORIGIN}`,
    // Google Fonts are declared in app/layout.tsx. Keep the source in both
    // style-src and style-src-elem because some browsers do not treat the
    // fallback from style-src consistently for <link rel="stylesheet">.
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "style-src-elem 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: blob: https: http:",
    "font-src 'self' data: https://fonts.gstatic.com",
    `connect-src 'self' https://*.supabase.co https://nhost.weebx.duckdns.org:8443 wss://nhost.weebx.duckdns.org:8443 ${UMAMI_ORIGIN} /stats https://shikimori.one https://shikimori.io https://*.shikimori.one https://*.shikimori.io ${PVP_SERVER_ORIGIN}`,
    "frame-src 'self' https: http:",
    "media-src 'self' https: http: blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; "),
}

// Headers to strip (tech stack disclosure)
const STRIP_HEADERS = [
  "X-Powered-By",
  "X-Nextjs-Prerender",
  "X-Matched-Path",
]

function isAdminSurface(pathname: string): boolean {
  return pathname === "/admin" || pathname.startsWith("/admin/") ||
    pathname === "/api/admin" || pathname.startsWith("/api/admin/")
}

/* ------------------------------------------------------------------ */
/* Чёрный список IP (сканеры антипиратских систем, паразитные боты)    */
/* ------------------------------------------------------------------ */
/* Список живёт в двух местах:                                        */
/*  - env BLOCKED_IPS (через запятую) — аварийный, действует мгновенно; */
/*  - таблица Supabase ip_bans — управляется из админ-панели.           */
/* База опрашивается не чаще раза в полминуты (кэш в памяти); если она  */
/* недоступна — работаем с тем, что есть, посетителей не роняем.       */
/* ------------------------------------------------------------------ */

const BLOCKLIST_CACHE_TTL_MS = 30_000

let blocklistCache: { targets: string[]; fetchedAt: number } | null = null

async function getBlockedIpTargets(): Promise<string[]> {
  const envTargets = parseBlocklistEnv(process.env.BLOCKED_IPS)
  const now = Date.now()
  if (blocklistCache && now - blocklistCache.fetchedAt < BLOCKLIST_CACHE_TTL_MS) {
    return envTargets.length > 0
      ? [...envTargets, ...blocklistCache.targets]
      : blocklistCache.targets
  }

  let dbTargets: string[] = []
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (url && key) {
      const supabase = createClient(url, key)
      const { data, error } = await supabase
        .from("ip_bans")
        .select("target")
        .order("created_at", { ascending: false })
        .limit(5000)
      if (!error && Array.isArray(data)) {
        dbTargets = data
          .map((row) => (row as { target?: string }).target)
          .filter((target): target is string => Boolean(target))
      }
    }
  } catch (error) {
    // База легла — не класть вместе с ней сайт: остаёмся на кэше и env.
    console.error("[ip-blocklist] не удалось прочитать ip_bans:", error)
  }

  blocklistCache = { targets: dbTargets, fetchedAt: now }
  return envTargets.length > 0 ? [...envTargets, ...dbTargets] : dbTargets
}

function applySecurityHeaders(response: NextResponse, pathname = "") {
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(key, value)
  }
  for (const header of STRIP_HEADERS) {
    response.headers.delete(header)
  }

  if (isAdminSurface(pathname)) {
    response.headers.set("Cache-Control", "private, no-store, max-age=0, must-revalidate")
    response.headers.set("Pragma", "no-cache")
    response.headers.set("Referrer-Policy", "no-referrer")
    response.headers.set("Cross-Origin-Resource-Policy", "same-origin")
    response.headers.set("Cross-Origin-Opener-Policy", "same-origin")
    // Keep admin pages and APIs out of third-party frames. This is scoped here
    // because the public Kodik player proxy intentionally supports framing.
    response.headers.set(
      "Content-Security-Policy",
      `${SECURITY_HEADERS["Content-Security-Policy"]}; frame-ancestors 'none'`,
    )
  }
  if (process.env.NODE_ENV === "production") {
    response.headers.set("Strict-Transport-Security", "max-age=31536000")
  }
  return response
}

export async function middleware(request: NextRequest, event?: NextFetchEvent) {
  const pathname = request.nextUrl.pathname
  const method = request.method

  // Чёрный список IP: сканерам и забаненным адресам отдаём обычный 404,
  // не раскрывая факт блокировки. Админку не трогаем, чтобы случайно не
  // запереть самих себя (там свой вход по паролю + TOTP + белый список).
  if (!isAdminSurface(pathname)) {
    const clientIp = getClientIp(request.headers)
    if (clientIp) {
      const targets = await getBlockedIpTargets()
      for (const target of targets) {
        if (ipMatchesTarget(clientIp, target)) {
          return new NextResponse("Not Found", { status: 404 })
        }
      }
    }
  }

  // SEO: /watch/{id} (и устаревшие slug'и) → 301 на канонический /watch/{id}-{slug}.
  // Делаем это здесь, а не в page.tsx: из-за loading.tsx страница успевает отдать
  // «200 OK» до redirect(), и Next.js подставляет лишь <meta refresh>, который
  // поисковики считают временным редиректом → дубли в индексе.
  // (app/loading.tsx оборачивает в Suspense ВСЕ страницы, так что это касается
  // любого redirect()/notFound() внутри page.tsx, не только /watch.)
  if ((method === "GET" || method === "HEAD") && pathname.startsWith("/watch/")) {
    const schedule = event ? (task: Promise<unknown>) => event.waitUntil(task) : undefined

    const redirectPath = await getWatchRedirectPath(
      pathname,
      request.nextUrl.search,
      fetch,
      schedule,
    )
    if (redirectPath) {
      const url = request.nextUrl.clone()
      const q = redirectPath.indexOf("?")
      url.pathname = q === -1 ? redirectPath : redirectPath.slice(0, q)
      url.search = q === -1 ? "" : redirectPath.slice(q)
      const response = NextResponse.redirect(url, 301)
      response.headers.set("Cache-Control", "public, max-age=3600")
      return applySecurityHeaders(response, pathname)
    }

    // Честный 404 для несуществующих тайтлов.
    //
    // В page.tsx этого не сделать: из-за app/loading.tsx заголовки уже ушли
    // со статусом 200, и notFound() оставляет только <meta robots=noindex> —
    // для Google это «мягкая 404». Middleware отвечает до рендера, поэтому
    // здесь статус настоящий. Результат запроса к Shikimori кэшируется
    // (POSITIVE/NEGATIVE TTL в lib/seo/watch-redirect.ts), так что
    // подавляющее большинство запросов обходится без сети.
    const watchMatch = /^\/watch\/(\d+)(?:-([^/]*))?\/?$/.exec(pathname)
    if (watchMatch) {
      const exists = await doesWatchAnimeExist(
        watchMatch[1],
        watchMatch[2] !== undefined,
        fetch,
        schedule,
      )
      if (exists === false) {
        const response = new NextResponse("Not Found", {
          status: 404,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        })
        // Негативный ответ не кэшируем надолго на CDN: тайтл может появиться.
        response.headers.set("Cache-Control", "public, max-age=600")
        return applySecurityHeaders(response, pathname)
      }
    }
  }

  // Check if path is exempt from security headers (like X-Frame-Options: DENY)
  const isSecurityHeadersExempt = SECURITY_HEADERS_EXEMPT_PATHS.some((path) => pathname.startsWith(path))
  if (isSecurityHeadersExempt) {
    return NextResponse.next()
  }

  // Admin form actions and future admin API mutations must be same-origin.
  // Fail closed in production when Origin is absent or malformed.
  const isStateChangingMethod = ["POST", "PUT", "DELETE", "PATCH"].includes(method)
  if (
    isAdminSurface(pathname) &&
    isStateChangingMethod &&
    !isValidAdminRequestOrigin(request.headers.get("origin"), request.headers, request.url)
  ) {
    return applySecurityHeaders(new NextResponse("Forbidden", { status: 403 }), pathname)
  }

  if (!isStateChangingMethod) {
    // Apply security headers even on GET requests
    return applySecurityHeaders(NextResponse.next(), pathname)
  }

  // Check if path is exempt from CSRF (external integrations like Lampa)
  const isExempt = CSRF_EXEMPT_PATHS.some((path) => pathname.startsWith(path))
  if (isExempt) {
    const response = NextResponse.next()
    response.headers.set("Access-Control-Allow-Origin", "*")
    response.headers.set("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
    response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization")
    return applySecurityHeaders(response, pathname)
  }

  // Check if path requires CSRF protection
  const requiresCsrf = CSRF_PROTECTED_PATHS.some((path) => pathname.startsWith(path))

  if (!requiresCsrf) {
    return applySecurityHeaders(NextResponse.next(), pathname)
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
      try {
        const originUrl = new URL(origin)
        if (originUrl.host !== host) {
          console.warn(`Cross-origin request from ${origin} to ${pathname}`)
        }
      } catch {
        console.warn(`Malformed Origin header on ${pathname}`)
      }
    }
  }

  const response = NextResponse.next()
  return applySecurityHeaders(response, pathname)
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
