import { NextRequest, NextResponse } from "next/server"
import { rateLimiters, getClientIP, createRateLimitResponse, addRateLimitHeaders } from "@/lib/rate-limit"

const ALLOWED_VIDEO_DOMAINS = [
  "kodik.cc",
  "kodik.info",
  "kodik.biz",
  "hentasis1.top",
  "videocdn.tv",
  "tractos-files.ru",
]

function isValidVideoUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(url)
    const domain = parsedUrl.hostname.replace(/^www\./, "")
    return ALLOWED_VIDEO_DOMAINS.some((allowed) => domain === allowed || domain.endsWith(`.${allowed}`))
  } catch {
    return false
  }
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url")

  if (!url) {
    return new NextResponse("Missing URL", { status: 400 })
  }

  // Validate URL against allowed domains
  if (!isValidVideoUrl(url)) {
    return new NextResponse("Invalid or unauthorized URL", { status: 403 })
  }

  // Rate limiting
  const clientIP = getClientIP(request)
  const rateLimitResult = rateLimiters.proxy.checkLimit(clientIP)

  if (!rateLimitResult.success) {
    return createRateLimitResponse(rateLimitResult.reset)
  }

  try {
    const range = request.headers.get("range")

    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer": "https://kodik.cc/",
        ...(range && { Range: range }),
      },
      signal: AbortSignal.timeout(30000), // 30 second timeout
    })

    if (!response.ok) {
      return new NextResponse(`Failed to fetch video: ${response.statusText}`, { status: response.status })
    }

    const headers = new Headers()
    response.headers.forEach((value, key) => {
      if (["content-length", "content-type", "content-range", "accept-ranges"].includes(key.toLowerCase())) {
        if (value && typeof value === "string" && !value.includes("\n") && !value.includes("\r")) {
          headers.set(key, value)
        }
      }
    })

    const proxyResponse = new NextResponse(response.body, {
      status: response.status,
      headers,
    })

    return addRateLimitHeaders(proxyResponse, rateLimitResult)

  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      return new NextResponse("Request timeout", { status: 504 })
    }
    return new NextResponse("Internal Server Error", { status: 500 })
  }
}