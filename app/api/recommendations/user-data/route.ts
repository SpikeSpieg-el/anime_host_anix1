import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    // Получаем сессию пользователя
    const authHeader = request.headers.get('authorization')
    let userId = null

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7)
      const { data: { user }, error } = await supabase.auth.getUser(token)
      if (!error && user) {
        userId = user.id
      }
    }

    // Если пользователь авторизован, берем данные из Supabase
    if (userId) {
      // Получаем историю просмотров с деталями
      const { data: historyData, error: historyError } = await supabase
        .from('watch_history')
        .select('*')
        .eq('user_id', userId)
        .order('timestamp', { ascending: false })
        .limit(50)

      // Получаем закладки с деталями
      const { data: bookmarksData, error: bookmarksError } = await supabase
        .from('bookmarks')
        .select('anime_data, is_completed, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50)

      if (historyError || bookmarksError) {
        console.error('Error fetching user data:', historyError || bookmarksError)
        return NextResponse.json(
          { error: 'Failed to fetch user data' },
          { status: 500 }
        )
      }

      // Формируем enriched данные для каждого аниме из истории
      const enrichedHistory = await Promise.all(
        (historyData || []).map(async (item: any) => {
          try {
            // Получаем детальную информацию об аниме из Shikimori
            const response = await fetch(`https://shikimori.one/api/animes/${item.anime_id}`)
            if (response.ok) {
              const animeDetails = await response.json()
              const year = parseInt(animeDetails.aired_on?.split('-')[0] || animeDetails.released_on?.split('-')[0] || '0')
              const rating = animeDetails.score || 0
              
              // Фильтруем: исключаем посредственные старые аниме (2010-2022 с рейтингом ниже 7.5)
              // Оставляем: свежие (2023+), культовые старые (до 2010 с рейтингом 8.0+), и всё с высоким рейтингом
              const isFresh = year >= 2023
              const isClassic = year < 2010 && rating >= 8.0
              const isHighRated = rating >= 7.5
              
              if (!isFresh && !isClassic && !isHighRated) {
                // Пропускаем посредственные старые аниме
                return null
              }

              return {
                id: item.anime_id,
                title: item.title,
                poster: item.poster,
                timestamp: item.timestamp,
                episode: item.episode,
                episodesTotal: item.episodes_total,
                isArchived: item.is_archived,
                genres: animeDetails.genres?.map((g: any) => g.russian || g.name) || [],
                studios: animeDetails.studios?.map((s: any) => s.name) || [],
                rating: rating,
                year: year,
                kind: animeDetails.kind,
                duration: animeDetails.duration
              }
            }
          } catch (error) {
            console.warn(`Failed to fetch details for anime ${item.anime_id}:`, error)
          }
          
          // Возвращаем базовые данные если не удалось получить детали
          return {
            id: item.anime_id,
            title: item.title,
            poster: item.poster,
            timestamp: item.timestamp,
            episode: item.episode,
            episodesTotal: item.episodes_total,
            isArchived: item.is_archived
          }
        })
      ).then(results => results.filter(Boolean)) // Удаляем null значения

      // Формируем enriched данные для закладок
      const enrichedBookmarks = await Promise.all(
        (bookmarksData || []).map(async (item: any) => {
          const anime = item.anime_data
          try {
            // Получаем детальную информацию из Shikimori
            const response = await fetch(`https://shikimori.one/api/animes/${anime.id}`)
            if (response.ok) {
              const animeDetails = await response.json()
              const year = parseInt(animeDetails.aired_on?.split('-')[0] || animeDetails.released_on?.split('-')[0] || '0')
              const rating = animeDetails.score || 0
              
              // Фильтруем: исключаем посредственные старые аниме (2010-2022 с рейтингом ниже 7.5)
              // Оставляем: свежие (2023+), культовые старые (до 2010 с рейтингом 8.0+), и всё с высоким рейтингом
              const isFresh = year >= 2023
              const isClassic = year < 2010 && rating >= 8.0
              const isHighRated = rating >= 7.5
              
              if (!isFresh && !isClassic && !isHighRated) {
                // Пропускаем посредственные старые аниме
                return null
              }

              return {
                ...anime,
                isCompleted: item.is_completed,
                createdAt: item.created_at,
                genres: animeDetails.genres?.map((g: any) => g.russian || g.name) || [],
                studios: animeDetails.studios?.map((s: any) => s.name) || [],
                rating: rating,
                year: year,
                kind: animeDetails.kind,
                duration: animeDetails.duration
              }
            }
          } catch (error) {
            console.warn(`Failed to fetch details for bookmark ${anime.id}:`, error)
          }
          
          return {
            ...anime,
            isCompleted: item.is_completed,
            createdAt: item.created_at
          }
        })
      ).then(results => results.filter(Boolean)) // Удаляем null значения

      // Анализируем предпочтения пользователя
      const allAnime = [...enrichedHistory, ...enrichedBookmarks]
      const genreFrequency: Record<string, number> = {}
      const studioFrequency: Record<string, number> = {}
      const kindFrequency: Record<string, number> = {}
      let totalRating = 0
      let ratedCount = 0

      allAnime.forEach(anime => {
        // Подсчет жанров
        if (anime.genres) {
          anime.genres.forEach((genre: string) => {
            genreFrequency[genre] = (genreFrequency[genre] || 0) + 1
          })
        }

        // Подсчет студий
        if (anime.studios) {
          anime.studios.forEach((studio: string) => {
            studioFrequency[studio] = (studioFrequency[studio] || 0) + 1
          })
        }

        // Подсчет типа (kind)
        if (anime.kind) {
          kindFrequency[anime.kind] = (kindFrequency[anime.kind] || 0) + 1
        }

        // Подсчет рейтинга
        if (anime.rating) {
          totalRating += anime.rating
          ratedCount++
        }
      })

      // Топ жанры
      const topGenres = Object.entries(genreFrequency)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([genre]) => genre)

      // Топ студии
      const topStudios = Object.entries(studioFrequency)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([studio]) => studio)

      // Предпочитаемые типы
      const preferredKinds = Object.entries(kindFrequency)
        .sort((a, b) => b[1] - a[1])
        .map(([kind]) => kind)

      // Средний рейтинг просмотренного
      const avgRating = ratedCount > 0 ? (totalRating / ratedCount).toFixed(1) : null

      return NextResponse.json({
        success: true,
        data: {
          history: enrichedHistory,
          bookmarks: enrichedBookmarks,
          preferences: {
            topGenres,
            topStudios,
            preferredKinds,
            avgRating,
            totalWatched: enrichedHistory.length,
            totalBookmarks: enrichedBookmarks.length,
            completedCount: enrichedBookmarks.filter((b: any) => b.isCompleted).length
          }
        }
      })
    }

    // Если не авторизован, возвращаем пустые данные
    return NextResponse.json({
      success: true,
      data: {
        history: [],
        bookmarks: [],
        preferences: {
          topGenres: [],
          topStudios: [],
          preferredKinds: [],
          avgRating: null,
          totalWatched: 0,
          totalBookmarks: 0,
          completedCount: 0
        }
      }
    })

  } catch (error) {
    console.error('Error in user-data API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
