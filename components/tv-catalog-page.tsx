"use client"

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { TVLayout } from './tv-layout'
import { TVAnimeCard } from './tv-anime-card'
import { TVVoiceSearch } from './tv-voice-search'
import type { Anime } from '@/lib/shikimori'
import { ChevronLeft, ChevronRight, Filter } from 'lucide-react'

interface TVCatalogPageProps {
  allowNsfw?: boolean
}

export function TVCatalogPage({ allowNsfw = false }: TVCatalogPageProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [animeList, setAnimeList] = useState<Anime[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)

  const order = searchParams.get('order') || 'popularity'
  const genre = searchParams.get('genre') || ''
  const status = searchParams.get('status') || ''
  const search = searchParams.get('search') || ''

  useEffect(() => {
    loadAnime(1)
  }, [order, genre, status, search])

  const loadAnime = async (page: number) => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '24',
        order,
        ...(genre && { genre }),
        ...(status && { status }),
        ...(search && { search }),
        allowNsfw: allowNsfw.toString(),
      })

      const response = await fetch(`/api/anime/catalog?${params}`)
      const data = await response.json()
      
      if (page === 1) {
        setAnimeList(data.results || [])
      } else {
        setAnimeList(prev => [...prev, ...(data.results || [])])
      }
      
      setHasMore((data.results || []).length === 24)
      setCurrentPage(page)
    } catch (error) {
      console.error('Catalog error:', error)
      setAnimeList([])
    } finally {
      setIsLoading(false)
    }
  }

  const handleAnimeSelect = (id: string) => {
    router.push(`/watch/${id}`)
  }

  const handleSearch = (query: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (query) {
      params.set('search', query)
    } else {
      params.delete('search')
    }
    router.push(`/catalog?${params.toString()}`)
  }

  const handleFilterChange = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value) {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    params.delete('page')
    router.push(`/catalog?${params.toString()}`)
  }

  const loadMore = () => {
    if (!isLoading && hasMore) {
      loadAnime(currentPage + 1)
    }
  }

  const getTitle = () => {
    if (search) return `Поиск: ${search}`
    if (status === 'ongoing') return 'Онгоинги'
    if (order === 'ranked') return 'Популярное всех времён'
    if (order === 'popularity') return 'Популярное сейчас'
    return 'Каталог'
  }

  return (
    <TVLayout>
      <div className="space-y-8">
        <div className="flex flex-col gap-6">
          <h1 className="text-5xl font-bold">{getTitle()}</h1>
          <TVVoiceSearch onSearch={handleSearch} placeholder="Поиск в каталоге..." />
        </div>

        <div className="flex gap-4 flex-wrap">
          <button
            onClick={() => handleFilterChange('order', 'popularity')}
            className={`px-6 py-3 rounded-lg text-lg font-medium transition focus:ring-2 focus:ring-primary ${
              order === 'popularity' ? 'bg-primary text-primary-foreground' : 'bg-secondary hover:bg-secondary/80'
            }`}
          >
            Популярное
          </button>
          <button
            onClick={() => handleFilterChange('order', 'ranked')}
            className={`px-6 py-3 rounded-lg text-lg font-medium transition focus:ring-2 focus:ring-primary ${
              order === 'ranked' ? 'bg-primary text-primary-foreground' : 'bg-secondary hover:bg-secondary/80'
            }`}
          >
            Топ рейтинг
          </button>
          <button
            onClick={() => handleFilterChange('status', status === 'ongoing' ? '' : 'ongoing')}
            className={`px-6 py-3 rounded-lg text-lg font-medium transition focus:ring-2 focus:ring-primary ${
              status === 'ongoing' ? 'bg-primary text-primary-foreground' : 'bg-secondary hover:bg-secondary/80'
            }`}
          >
            Онгоинги
          </button>
        </div>

        {isLoading && currentPage === 1 ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary"></div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
              {animeList.map((anime) => (
                <TVAnimeCard
                  key={anime.id}
                  id={anime.id}
                  title={anime.title}
                  imageUrl={anime.poster}
                  episodesTotal={anime.episodesTotal}
                  rating={anime.rating}
                  onSelect={() => handleAnimeSelect(anime.id)}
                />
              ))}
            </div>

            {hasMore && (
              <div className="flex justify-center pt-8">
                <button
                  onClick={loadMore}
                  disabled={isLoading}
                  className="flex items-center gap-2 px-8 py-4 bg-primary hover:bg-primary/80 rounded-lg text-lg font-medium transition disabled:opacity-50 focus:ring-2 focus:ring-primary"
                >
                  {isLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      Загрузка...
                    </>
                  ) : (
                    <>
                      Загрузить ещё
                      <ChevronRight className="h-5 w-5" />
                    </>
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </TVLayout>
  )
}
