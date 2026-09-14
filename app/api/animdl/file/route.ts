import { NextResponse } from "next/server"
import {
  addRateLimitHeaders,
  createRateLimitResponse,
  createRateLimiter,
  getClientIP,
} from "@/lib/rate-limit"
import { verifyProxyRequest } from "@/lib/animdl/proxy-url"

export const dynamic = "force-dynamic"

const fileRateLimiter = createRateLimiter({ interval: 60_000, maxRequests: 120 })

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"

function buildContentDisposition(kind: string, filename: string): string {
  const fallback = filename.replace(/[^\x20-\x7E]/g, "_").replace(/"/g, "'")
  return `${kind}; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`
}

/**
 * GET /api/animdl/file?u=...&r=...&e=...&s=...[&dl=1&n=...]
 *
 * Проксирует mp4-файлы, субтитры и сегменты с подстановкой Referer.
 * С dl=1 отдаёт файл как вложение (Content-Disposition: attachment).
 */
export async function GET(request: Request) {
  const clientIP = getClientIP(request as never)
  const limit = fileRateLimiter.checkLimit(clientIP)
  if (!limit.success) {
    return createRateLimitResponse(limit.reset)
  }

  const target = verifyProxyRequest("file", new URL(request.url).searchParams)
  if (!target) {
    return NextResponse.json({ error: "invalid or expired proxy signature" }, { status: 403 })
  }

  try {
    const range = request.headers.get("range")

    const response = await fetch(target.url, {
      headers: {
        "User-Agent": BROWSER_UA,
        Referer: target.referer,
        Accept: "*/*",
        ...(range && { Range: range }),
      },
      cache: "no-store",
      redirect: "follow",
      signal: AbortSignal.timeout(30_000),
    })

    if (!response.ok && response.status !== 206) {
      return NextResponse.json(
        { error: `upstream ${response.status}` },
        { status: response.status >= 500 ? 502 : response.status },
      )
    }

    const headers = new Headers()
    for (const key of ["content-type", "content-length", "content-range", "accept-ranges", "etag", "last-modified"]) {
      const value = response.headers.get(key)
      if (value && !value.includes("\n")) headers.set(key, value)
    }
    if (!headers.has("Content-Type")) {
      headers.set("Content-Type", "application/octet-stream")
    }

    if (target.download) {
      const filename = target.filename || "video.mp4"
      const isVtt = filename.endsWith(".vtt") || target.url.includes(".vtt")
      headers.set(
        "Content-Disposition",
        buildContentDisposition(isVtt ? "inline" : "attachment", filename),
      )
    }

    return addRateLimitHeaders(
      new NextResponse(response.body, { status: response.status, headers }),
      limit,
    )
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      return NextResponse.json({ error: "upstream timeout" }, { status: 504 })
    }
    console.error("[api/animdl/file] proxy failure:", error)
    return NextResponse.json({ error: "proxy failure" }, { status: 502 })
  }
}
