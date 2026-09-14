import { NextResponse } from "next/server"
import {
  createRateLimitResponse,
  createRateLimiter,
  getClientIP,
} from "@/lib/rate-limit"
import { verifyProxyRequest } from "@/lib/animdl/proxy-url"

export const dynamic = "force-dynamic"

const torrentRateLimiter = createRateLimiter({ interval: 60_000, maxRequests: 30 })

/**
 * GET /api/animdl/torrent?u=...&r=...&e=...&s=...&n=...
 *
 * Отдаёт .torrent-файл AniLibria как вложение (русская озвучка,
 * весь сезон в исходном качестве).
 */
export async function GET(request: Request) {
  const clientIP = getClientIP(request as never)
  const limit = torrentRateLimiter.checkLimit(clientIP)
  if (!limit.success) {
    return createRateLimitResponse(limit.reset)
  }

  const target = verifyProxyRequest("torrent", new URL(request.url).searchParams)
  if (!target) {
    return NextResponse.json({ error: "invalid or expired proxy signature" }, { status: 403 })
  }

  try {
    const response = await fetch(target.url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Referer: target.referer,
      },
      cache: "no-store",
      redirect: "follow",
      signal: AbortSignal.timeout(30_000),
    })

    if (!response.ok) {
      return NextResponse.json(
        { error: `upstream ${response.status}` },
        { status: response.status >= 500 ? 502 : response.status },
      )
    }

    const filename = (target.filename || "torrent.torrent").endsWith(".torrent")
      ? target.filename || "torrent.torrent"
      : `${target.filename || "torrent"}.torrent`

    return new NextResponse(response.body, {
      status: 200,
      headers: {
        "Content-Type": "application/x-bittorrent",
        "Content-Disposition": `attachment; filename="${filename.replace(/"/g, "")}"`,
        "Cache-Control": "no-store",
      },
    })
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      return NextResponse.json({ error: "upstream timeout" }, { status: 504 })
    }
    console.error("[api/animdl/torrent] proxy failure:", error)
    return NextResponse.json({ error: "proxy failure" }, { status: 502 })
  }
}
