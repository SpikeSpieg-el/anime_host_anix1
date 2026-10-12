import { NextRequest, NextResponse } from "next/server"
import {
  isCrawlerRequest,
  isCrossOriginReferer,
  resolvePlayerToken,
} from "@/lib/player-protect"
import { createRateLimiter, getRateLimitKey } from "@/lib/rate-limit"

/**
 * Short-lived, opaque player link: /embed/<token>.
 *
 * Do not fetch and rewrite the provider's HTML here. The player relies on its
 * original origin for API/CORS checks, stream URLs and media referrers. Serving
 * that HTML under weeb-x.com can render the player chrome while silently
 * breaking the actual episode. After validating the request, redirect the
 * browser to the provider so the player runs on its expected origin.
 *
 * The direct provider URL is still absent from the watch page and translations
 * API; this endpoint reveals it only after bot and hotlink checks (or when the
 * browser strips Referer for privacy).
 */
export const dynamic = "force-dynamic"

/** Query parameters the watch page is allowed to pass to the provider player. */
const ALLOWED_PARAMS = [
  "episode",
  "season",
  "country",
  "autoplay",
  "quality",
  "no_ads",
  "no_provider_ads",
  "hide_selectors",
  "translate",
] as const

const NO_STORE_HEADERS: Record<string, string> = {
  "Cache-Control": "private, no-store",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
  "Referrer-Policy": "strict-origin-when-cross-origin",
}

function notFound(): NextResponse {
  // Don't reveal whether the token, referer, or user agent caused the rejection.
  return new NextResponse("Not Found", {
    status: 404,
    headers: {
      ...NO_STORE_HEADERS,
      "Content-Type": "text/plain; charset=utf-8",
    },
  })
}

/**
 * Предел на выдачу редиректов на плеер, по IP.
 *
 * Это вторая половина защиты, а не замена рейт-лимиту на списке озвучек:
 * получив токены, сканер дёргает `/embed/<токен>` пачкой и разбирает их на
 * прямые ссылки Kodik. Без предела и этот шаг проходил без помех —
 * замер до правки: 40 параллельных запросов, 40 редиректов на kodikplayer.com.
 *
 * Значение с запасом выше «человеческого» расхода: один зритель за сеанс
 * открывает единицы серий и переключает озвучки, а не десятки ссылок в минуту.
 */
const embedLimiter = createRateLimiter({ interval: 60_000, maxRequests: 40 })

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  // 1. Don't issue player redirects to known crawlers and scanners.
  if (isCrawlerRequest(request.headers)) return notFound()

  // 2. Block hotlinking from other sites. Empty referers remain allowed for
  //    privacy modes and browser extensions that strip this header.
  if (isCrossOriginReferer(request.headers.get("referer"), request.headers, request.url)) {
    return notFound()
  }

  // 3. Resolve and validate the encrypted, expiring token.
  const { token } = await params
  const target = resolvePlayerToken(token)
  if (!target) return notFound()

  // 4. Rate-limit the actual hand-off of provider URLs.
  //
  //    The limit sits AFTER token validation on purpose: a token is cheap to
  //    probe, but each successful resolve reveals a live provider URL. Keeping
  //    it here means the cap counts only the responses that actually leak.
  //
  //    Unknown client address → skip the limit. A shared fallback key would
  //    make every viewer on the site share one budget and break playback for
  //    all of them at once.
  const clientKey = getRateLimitKey(request)
  const limit = clientKey ? embedLimiter.checkLimit(clientKey) : null
  if (limit && !limit.success) {
    // 429, not 404: the caller here already proved the token is ours, so
    // pretending the token is bad would only confuse the real viewer.
    return new NextResponse("Too Many Requests", {
      status: 429,
      headers: {
        ...NO_STORE_HEADERS,
        "Retry-After": String(Math.ceil((limit.reset - Date.now()) / 1000)),
        "Content-Type": "text/plain; charset=utf-8",
      },
    })
  }

  // 4. Forward only playback options from the request; never let callers use
  //    this endpoint as an open redirect to an arbitrary URL.
  const playerUrl = new URL(target)
  for (const name of ALLOWED_PARAMS) {
    const value = request.nextUrl.searchParams.get(name)
    if (value !== null) playerUrl.searchParams.set(name, value)
  }

  const response = NextResponse.redirect(playerUrl, 302)
  for (const [name, value] of Object.entries(NO_STORE_HEADERS)) {
    response.headers.set(name, value)
  }
  return response
}
