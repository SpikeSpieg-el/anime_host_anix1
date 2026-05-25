"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { TVAnimeCard } from './tv-anime-card'
import { TVVoiceSearch } from './tv-voice-search'
import { TVLayout } from './tv-layout'
import type { Anime } from '@/lib/shikimori'

interface TVHomePageProps {
  popularNow: Anime[]
  ongoingAnime: Anime[]
}

export function TVHomePage({ popularNow, ongoingAnime }: TVHomePageProps) {
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
    router.push(`/anime/${id}`)
  }

  const displayAnime = isSearching ? searchResults : popularNow

  return (
    <TVLayout>
      <div className="space-y-8">
        <div className="flex flex-col items-center gap-6 mb-12">
          <h1 className="text-5xl font-bold text-center">Weeb.X TV</h1>
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
          </div>
        )}

        {!isSearching && (
          <>
            <section>
              <h2 className="text-3xl font-bold mb-6">Популярное сейчас</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                {popularNow.slice(0, 10).map((anime) => (
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
              <h2 className="text-3xl font-bold mb-6">Онгоинги</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                {ongoingAnime.slice(0, 10).map((anime) => (
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

        {isSearching && searchResults.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
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
    </TVLayout>
  )
}
