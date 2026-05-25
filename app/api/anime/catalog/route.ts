import { NextRequest, NextResponse } from 'next/server'
import { getAnimeCatalog } from '@/lib/shikimori'
import type { CatalogFilters } from '@/lib/shikimori'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    
    const filters: CatalogFilters = {
      page: parseInt(searchParams.get('page') || '1'),
      limit: parseInt(searchParams.get('limit') || '24'),
      order: searchParams.get('order') || 'popularity',
      genre: searchParams.get('genre') || undefined,
      status: searchParams.get('status') || undefined,
      kind: searchParams.get('kind') || undefined,
      year: searchParams.get('year') || undefined,
      score: searchParams.get('score') || undefined,
      search: searchParams.get('search') || undefined,
      allowNsfw: searchParams.get('allowNsfw') === 'true',
      enableGenreFallback: false
    }

    const results = await getAnimeCatalog(filters)
    const limit = filters.limit || 24

    return NextResponse.json({
      results,
      hasMore: results.length >= limit
    })
  } catch (error) {
    console.error('Catalog API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch catalog', results: [] },
      { status: 500 }
    )
  }
}
