import { NextRequest, NextResponse } from "next/server"
import { getHeroRecommendation, getPopularNow } from "@/lib/shikimori"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const watchedRaw = searchParams.get("watched")
  const bookmarksRaw = searchParams.get("bookmarks")
  const excludeId = searchParams.get("excludeId")

  const watchedIds = watchedRaw ? watchedRaw.split(",").filter(Boolean) : []
  const bookmarkIds = bookmarksRaw ? bookmarksRaw.split(",").filter(Boolean) : []

  const filteredWatched = excludeId
    ? watchedIds.filter((id) => id !== excludeId)
    : watchedIds

  const popularAnime = await getPopularNow(20)
  const result = await getHeroRecommendation(filteredWatched, bookmarkIds, popularAnime)

  return NextResponse.json(result, {
    headers: { "Cache-Control": "no-store" },
  })
}
