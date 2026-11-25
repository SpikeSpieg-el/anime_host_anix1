import { NextRequest, NextResponse } from 'next/server'
import { getAnimeCatalog } from '@/lib/shikimori'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const query = searchParams.get('q') || ''
    const allowNsfw = searchParams.get('allowNsfw') === 'true'
    // Подсказки в шапке просят больше 10 — уважаем limit (максимум 50,
    // столько отдаёт сам Shikimori за один запрос).
    const limitParam = Number(searchParams.get('limit'))
    const limit = Number.isFinite(limitParam) && limitParam > 0
      ? Math.min(Math.floor(limitParam), 50)
      : 10

    if (!query.trim()) {
      return NextResponse.json({ results: [] })
    }

    const results = await getAnimeCatalog({
      search: query,
      allowNsfw,
      limit,
      enableGenreFallback: false,
      disableExternalAPIs: false,
    })

    return NextResponse.json({ results })
  } catch (error) {
    console.error('Search API error:', error)
    return NextResponse.json(
      { error: 'Failed to search anime', results: [] },
      { status: 500 }
    )
  }
}
