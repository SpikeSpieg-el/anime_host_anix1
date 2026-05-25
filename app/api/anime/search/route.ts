import { NextRequest, NextResponse } from 'next/server'
import { searchAnime } from '@/lib/shikimori'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const query = searchParams.get('q') || ''
    const allowNsfw = searchParams.get('allowNsfw') === 'true'

    if (!query.trim()) {
      return NextResponse.json({ results: [] })
    }

    const results = await searchAnime(query, allowNsfw, false)

    return NextResponse.json({ results })
  } catch (error) {
    console.error('Search API error:', error)
    return NextResponse.json(
      { error: 'Failed to search anime', results: [] },
      { status: 500 }
    )
  }
}
