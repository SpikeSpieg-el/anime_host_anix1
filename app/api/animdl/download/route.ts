import { NextResponse } from "next/server"
import { getClientIP, rateLimiters, createRateLimitResponse, addRateLimitHeaders } from "@/lib/rate-limit"
import { buildAnimdlCliCommand, resolveEpisodeSourcesDetailed } from "@/lib/animdl/resolve"
import {
  buildApiQualities,
  buildApiTorrents,
} from "@/lib/animdl/serve"

export const dynamic = "force-dynamic"

/**
 * GET /api/animdl/download?title=...&original=...&episode=1
 *
 * Варианты скачивания серии для кнопки «Скачать»:
 *  - mp4-файлы (attachment через /api/animdl/file);
 *  - HLS-плейлисты .m3u8 (открываются в VLC / yt-dlp / animdl);
 *  - торренты AniLibria (.torrent + magnet, русская озвучка);
 *  - готовая команда animdl CLI.
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
  const refresh = searchParams.get("refresh") === "1"

  if (!title && !originalTitle) {
    return NextResponse.json({ ok: false, reason: "title-required" }, { status: 400 })
  }
  if (!Number.isFinite(episode) || episode < 1) {
    return NextResponse.json({ ok: false, reason: "episode-invalid" }, { status: 400 })
  }

  try {
    const { sources, attempts } = await resolveEpisodeSourcesDetailed({
      title,
      originalTitle,
      episode,
      refresh,
    })

    if (!sources) {
      return addRateLimitHeaders(
        NextResponse.json({
          ok: false,
          reason: "not-found",
          attempts,
          cli: buildAnimdlCliCommand({ title, originalTitle, episode }),
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
          files: buildApiQualities(sources, episode),
          torrents: buildApiTorrents(sources),
          cli: buildAnimdlCliCommand({ title, originalTitle, episode }),
        },
        { headers: { "Cache-Control": "no-store" } },
      ),
      limit,
    )
  } catch (error) {
    console.error("[api/animdl/download] resolution failed:", error)
    return NextResponse.json(
      { ok: false, reason: "upstream-error" },
      { status: 502 },
    )
  }
}
