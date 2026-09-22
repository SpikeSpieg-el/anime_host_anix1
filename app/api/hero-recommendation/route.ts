import { NextRequest, NextResponse } from "next/server"
import { getHeroRecommendation, getPopularNow } from "@/lib/shikimori"
import { supabase } from "@/lib/supabase"

export async function GET(request: NextRequest) {
  // Проверка авторизации
  const authHeader = request.headers.get('authorization')
  
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json(
      { error: 'Требуется авторизация' },
      { status: 401 }
    )
  }

  const token = authHeader.substring(7)
  const { data: { user }, error } = await supabase.auth.getUser(token)
  
  if (error || !user) {
    return NextResponse.json(
      { error: 'Неверный токен авторизации' },
      { status: 401 }
    )
  }

  const { searchParams } = new URL(request.url)
  const watchedRaw = searchParams.get("watched")
  const bookmarksRaw = searchParams.get("bookmarks")
  const excludeId = searchParams.get("excludeId")

  const watchedIds = watchedRaw ? watchedRaw.split(",").filter(Boolean) : []
  const bookmarkIds = bookmarksRaw ? bookmarksRaw.split(",").filter(Boolean) : []

  const filteredWatched = excludeId
    ? watchedIds.filter((id) => id !== excludeId)
    : watchedIds

  try {
    const popularAnime = await getPopularNow(20)
    const result = await getHeroRecommendation(filteredWatched, bookmarkIds, popularAnime)

    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    })
  } catch (error) {
    console.error('[HeroRecommendation] Error:', error)
    // Return fallback with null anime - client will handle this
    return NextResponse.json({ anime: null }, {
      headers: { "Cache-Control": "no-store" },
    })
  }
}
