import { NextRequest, NextResponse } from "next/server"
import {
  isCrawlerRequest,
  isCrossOriginReferer,
  resolvePlayerToken,
} from "@/lib/player-protect"

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
