import { NextRequest, NextResponse } from 'next/server'
import { searchAnime } from '@/lib/shikimori/api'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { genres, year, mood, pacing, minRating = 7.5, limit = 20 } = body

    console.log('[Search Anime] Request params:', { genres, year, mood, pacing, minRating, limit })

    // Build search query from genres
    let searchQuery = ''
    if (genres && genres.length > 0) {
      searchQuery = genres.join(' ')
    }

    let results: any[] = []
    try {
      // Use searchAnime which is already proven to work
      results = await searchAnime(searchQuery, false, false)
      console.log('[Search Anime] Raw results count:', results.length)
    } catch (error) {
      console.error('[Search Anime] Error calling searchAnime:', error)
      results = []
    }

    // Filter by year
    if (year && year !== 'any') {
      const targetYears = Array.isArray(year) ? year.map(Number) : [Number(year)]
      results = results.filter(anime => {
        const animeYear = Number(anime.year)
        return targetYears.includes(animeYear)
      })
      console.log('[Search Anime] After year filter:', results.length)
    }

    // Filter by rating
    if (minRating && minRating > 0) {
      results = results.filter(anime => anime.rating >= minRating)
      console.log('[Search Anime] After rating filter:', results.length)
    }

    // Filter by mood (post-processing since Shikimori doesn't have mood filter)
    const moodKeywords: Record<string, string[]> = {
      "exciting": ["action", "adventure", "shounen"],
      "relaxing": ["slice_of_life", "comedy", "romance"],
      "emotional": ["drama", "romance"],
      "intellectual": ["mystery", "psychological"],
      "romantic": ["romance"],
      "dark": ["horror", "thriller", "psychological", "drama"]
    }

    if (mood && moodKeywords[mood]) {
      const keywords = moodKeywords[mood]
      console.log('[Search Anime] Filtering by mood:', mood, 'keywords:', keywords)
      results = results.filter(anime =>
        anime.genres.some((g: string) =>
          keywords.some(k => g.toLowerCase().includes(k))
        )
      )
      console.log('[Search Anime] After mood filter:', results.length)
    }

    // Filter by pacing (kind)
    if (pacing === 'fast') {
      results = results.filter(anime => anime.quality === 'Movie' || anime.episodesCurrent <= 12)
      console.log('[Search Anime] After pacing filter (fast):', results.length)
    }

    // Format results for AI
    const formattedResults = results.slice(0, limit).map(anime => ({
      id: anime.id,
      title: anime.title,
      russian: anime.originalTitle,
      year: anime.year,
      episodes: anime.episodesCurrent,
      rating: anime.rating,
      genres: anime.genres,
      kind: anime.quality,
      status: anime.status
    }))

    console.log(`[Search Anime] Final results: ${formattedResults.length} anime`)

    return NextResponse.json({
      success: true,
      data: formattedResults
    })

  } catch (error) {
    console.error('[Search Anime] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
