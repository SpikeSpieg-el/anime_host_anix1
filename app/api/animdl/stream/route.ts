import { NextResponse } from "next/server"
import { getClientIP, rateLimiters, createRateLimitResponse, addRateLimitHeaders } from "@/lib/rate-limit"
import { resolveEpisodeSources } from "@/lib/animdl/resolve"
import {
  buildApiQualities,
  buildApiSubtitles,
  buildApiTorrents,
} from "@/lib/animdl/serve"
import { buildAnimdlCliCommand } from "@/lib/animdl/resolve"

export const dynamic = "force-dynamic"

/**
 * GET /api/animdl/stream?title=...&original=...&episode=1
 *
 * Резолвит источники эпизода для запасного плеера (AniLibria → AllAnime).
 * Ссылки уже подписаны и идут через наш HLS-прокси, поэтому плеер
 * играет их напрямую из браузера.
 */
export async function GET(request: Request) {
  const clientIP = getClientIP(request as never)
  const limit = rateLimiters.standard.checkLimit(clientIP)
  if (!limit.success) {
    return createRateLimitResponse(limit.reset)
  }

  const { searchParams } = new URL(request.url)
  const title = (searchParams.get("title") || "").trim()
  const originalTitle = (searchParams.get("original") || "").trim() || null
  const episode = Number(searchParams.get("episode") || "1")

  if (!title && !originalTitle) {
    return NextResponse.json({ ok: false, reason: "title-required" }, { status: 400 })
  }
  if (!Number.isFinite(episode) || episode < 1) {
    return NextResponse.json({ ok: false, reason: "episode-invalid" }, { status: 400 })
  }

  try {
    const sources = await resolveEpisodeSources({ title, originalTitle, episode })

    if (!sources) {
      return addRateLimitHeaders(
        NextResponse.json({
          ok: false,
          reason: "not-found",
          message:
            "Русский источник для этой серии не найден. Попробуйте основной плеер.",
        }),
        limit,
      )
    }

    return addRateLimitHeaders(
      NextResponse.json(
        {
          ok: true,
          provider: sources.provider,
          providerLabel: sources.providerLabel,
          ruDub: sources.ruDub,
          matchedTitle: sources.matchedTitle,
          notes: sources.notes,
          type: sources.qualities[0]?.kind ?? "hls",
          qualities: buildApiQualities(sources, episode),
          subtitles: buildApiSubtitles(sources),
          torrents: buildApiTorrents(sources),
          cli: buildAnimdlCliCommand({
            title,
            originalTitle,
            episode,
          }),
        },
        { headers: { "Cache-Control": "no-store" } },
      ),
      limit,
    )
  } catch (error) {
    console.error("[api/animdl/stream] resolution failed:", error)
    return NextResponse.json(
      { ok: false, reason: "upstream-error" },
      { status: 502 },
    )
  }
}
