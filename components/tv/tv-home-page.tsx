"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { TVAnimeCard } from './tv-anime-card'
import { TVVoiceSearch } from './tv-voice-search'
import { TVLayout } from './tv-layout'
import type { Anime } from '@/lib/shikimori'
import { ChevronRight } from 'lucide-react'
import Link from 'next/link'

interface TVHomePageProps {
  popularNow: Anime[]
  popularAlways: Anime[]
  ongoingAnime: Anime[]
}

export function TVHomePage({ popularNow, popularAlways, ongoingAnime }: TVHomePageProps) {
  const router = useRouter()
  const [searchResults, setSearchResults] = useState<Anime[]>([])
  const [isSearching, setIsSearching] = useState(false)

  const handleSearch = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([])
      setIsSearching(false)
      return
    }

    setIsSearching(true)
    try {
      const response = await fetch(`/api/anime/search?q=${encodeURIComponent(query)}&limit=20`)
      const data = await response.json()
      setSearchResults(data.results || [])
    } catch (error) {
      console.error('Search error:', error)
      setSearchResults([])
    }
  }

  const handleAnimeSelect = (id: string) => {
    router.push(`/watch/${id}`)
  }

  return (
    <TVLayout>
      <div className="space-y-10">
        <div className="flex flex-col items-center gap-6 mb-8">
          <h1 className="text-5xl font-bold text-center">Weeb-X TV</h1>
          <TVVoiceSearch onSearch={handleSearch} />
        </div>

        {isSearching && (
          <div>
            <h2 className="text-3xl font-bold mb-6">
              Результаты поиска ({searchResults.length})
            </h2>
            {searchResults.length === 0 && (
              <p className="text-xl text-muted-foreground text-center py-12">
                Ничего не найдено
              </p>
            )}
            {searchResults.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                {searchResults.map((anime) => (
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
            )}
          </div>
        )}

        {!isSearching && (
          <>
            <section>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-3xl font-bold">Популярное сейчас</h2>
                <Link 
                  href="/catalog?order=popularity" 
                  className="flex items-center gap-2 text-primary hover:underline focus:ring-2 focus:ring-primary rounded px-3 py-2"
                >
                  Все <ChevronRight className="h-5 w-5" />
                </Link>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                {popularNow.slice(0, 12).map((anime) => (
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
            </section>

            <section>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-3xl font-bold">Онгоинги</h2>
                <Link 
                  href="/catalog?status=ongoing" 
                  className="flex items-center gap-2 text-primary hover:underline focus:ring-2 focus:ring-primary rounded px-3 py-2"
                >
                  Все <ChevronRight className="h-5 w-5" />
                </Link>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                {ongoingAnime.slice(0, 12).map((anime) => (
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
            </section>

            <section>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-3xl font-bold">Популярное всех времён</h2>
                <Link 
                  href="/catalog?order=ranked" 
                  className="flex items-center gap-2 text-primary hover:underline focus:ring-2 focus:ring-primary rounded px-3 py-2"
                >
                  Все <ChevronRight className="h-5 w-5" />
                </Link>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                {popularAlways.slice(0, 12).map((anime) => (
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
            </section>
          </>
        )}
      </div>
    </TVLayout>
  )
}
