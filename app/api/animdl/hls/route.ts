import { NextResponse } from "next/server"
import { getClientIP, createRateLimitResponse } from "@/lib/rate-limit"
import { createRateLimiter } from "@/lib/rate-limit"
import { verifyProxyRequest, createSignedProxyUrl } from "@/lib/animdl/proxy-url"
import { isHlsPlaylistContentType, rewriteHlsPlaylist } from "@/lib/animdl/hls"

export const dynamic = "force-dynamic"

// HLS-воспроизведение генерирует много запросов (сегменты по 2-6 секунд),
// поэтому отдельный «мягкий» лимитер, а не rateLimiters.proxy.
const hlsRateLimiter = createRateLimiter({ interval: 60_000, maxRequests: 900 })

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"

/** Абсолютный origin для переписанных ссылок (за reverse-proxy берём forwarded-заголовки). */
function getPublicOrigin(request: Request): string {
  const forwardedHost = request.headers.get("x-forwarded-host")
  const forwardedProto = request.headers.get("x-forwarded-proto")
  if (forwardedHost) {
    return `${forwardedProto || "https"}://${forwardedHost}`
  }
  return new URL(request.url).origin
}

/**
 * GET /api/animdl/hls?u=...&r=...&e=...&s=...[&dl=1&n=...]
 *
 * HLS-прокси: плейлисты переписываются так, что все сегменты и дочерние
 * плейлисты тоже идут через этот роут (с нужным Referer вверх по течению).
 * Благодаря этому браузерный плеер (hls.js) и внешние плееры (VLC)
 * играют стримы с hotlink-защитой.
 */
export async function GET(request: Request) {
  const clientIP = getClientIP(request as never)
  const limit = hlsRateLimiter.checkLimit(clientIP)
  if (!limit.success) {
    return createRateLimitResponse(limit.reset)
  }

  const target = verifyProxyRequest("hls", new URL(request.url).searchParams)
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

    const contentType = response.headers.get("content-type")
    const urlPath = new URL(target.url).pathname.toLowerCase()
    const isPlaylistByUrl =
      urlPath.endsWith(".m3u8") || urlPath.includes(".m3u8?")
    const isPlaylist =
      isHlsPlaylistContentType(contentType) ||
      (!contentType && isPlaylistByUrl) ||
      (isPlaylistByUrl && (!contentType || contentType.includes("text")))

    if (isPlaylist) {
      const manifest = await response.text()
      const origin = getPublicOrigin(request)

      // Если это плейлист по URL, но не по содержимому — он бинарный, не трогаем.
      if (manifest.includes("#EXTM3U")) {
        // Ссылки делаем абсолютными, чтобы плейлист работал и во внешних
        // плеерах (VLC / yt-dlp), скачавших его с нашего сайта.
        const rewritten = rewriteHlsPlaylist(manifest, target.url, (absoluteUrl) => {
          const relative = createSignedProxyUrl("hls", absoluteUrl, target.referer, {
            ttlSeconds: 6 * 3600,
          })
          return `${origin}${relative}`
        })

        return new NextResponse(rewritten, {
          status: 200,
          headers: {
            "Content-Type": "application/vnd.apple.mpegurl",
            "Cache-Control": "no-store",
            "Access-Control-Allow-Origin": "*",
          },
        })
      }

      return new NextResponse(manifest, {
        status: 200,
        headers: {
          "Content-Type": contentType || "application/octet-stream",
          "Cache-Control": "no-store",
        },
      })
    }

    // Бинарный сегмент — проксируем поток, сохраняя Range-семантику.
    const headers = new Headers()
    for (const key of ["content-type", "content-length", "content-range", "accept-ranges"]) {
      const value = response.headers.get(key)
      if (value && !value.includes("\n")) headers.set(key, value)
    }
    if (!headers.has("Content-Type")) {
      headers.set("Content-Type", "video/mp2t")
    }
    headers.set("Cache-Control", "private, max-age=3600")
    headers.set("Access-Control-Allow-Origin", "*")

    return new NextResponse(response.body, {
      status: response.status,
      headers,
    })
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      return NextResponse.json({ error: "upstream timeout" }, { status: 504 })
    }
    console.error("[api/animdl/hls] proxy failure:", error)
    return NextResponse.json({ error: "proxy failure" }, { status: 502 })
  }
}
