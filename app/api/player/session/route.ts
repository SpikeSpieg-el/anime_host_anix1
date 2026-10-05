import { NextRequest, NextResponse } from "next/server"
import { createPlayerToken, isCrawlerRequest } from "@/lib/player-protect"

export const dynamic = "force-dynamic"

/**
 * GET /api/player/session?shikimoriId=21&episode=3
 *
 * Упрощённый режим плеера (например, ТВ-режим): сервер сам собирает
 * ссылку «найти плеер по shikimoriID» и отдаёт её в виде нашего
 * зашифрованного адреса `/embed/<токен>`. Прямая внешняя ссылка
 * не появляется ни в ответе, ни в коде страницы.
 */
export async function GET(request: NextRequest) {
  if (isCrawlerRequest(request.headers)) {
    return NextResponse.json(
      { error: "Not Found" },
      { status: 404, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } }
    )
  }

  const { searchParams } = new URL(request.url)
  const shikimoriId = searchParams.get("shikimoriId")
  const episode = searchParams.get("episode")

  if (!shikimoriId || !/^\d+$/.test(shikimoriId)) {
    return NextResponse.json({ error: "Параметр shikimoriId обязателен" }, { status: 400 })
  }
  if (!episode || !/^\d+$/.test(episode) || Number(episode) < 1) {
    return NextResponse.json({ error: "Параметр episode обязателен" }, { status: 400 })
  }

  const playerUrl =
    `https://kodikplayer.com/find-player` +
    `?shikimoriID=${encodeURIComponent(shikimoriId)}` +
    `&episode=${encodeURIComponent(episode)}` +
    `&quality=720&no_ads=true&no_provider_ads=true` +
    `&block_blocked_countries=true&hide_selectors=true`

  const token = createPlayerToken(playerUrl)
  if (!token) {
    return NextResponse.json(
      { error: "Не удалось подготовить плеер" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    )
  }

  return NextResponse.json(
    { src: `/embed/${token}` },
    {
      headers: {
        // Токен живёт 48 часов, но ответ не кэшируем: пусть каждый
        // просмотр получает свежий.
        "Cache-Control": "no-store",
        "X-Robots-Tag": "noindex",
      },
    }
  )
}
