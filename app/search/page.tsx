import { Navbar } from "@/components/navbar"
import { AnimeCard } from "@/components/anime-card"
import { searchAnime, Anime } from "@/lib/shikimori"
import { SearchX } from "lucide-react"

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q: string }> }) {
  const { q } = await searchParams
  const query = q || ""
  
  // Делаем запрос к API
  const results: Anime[] = await searchAnime(query)

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <Navbar />
      
      <div className="container mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold mb-8 flex items-center gap-2">
          Результаты поиска: <span className="text-orange-500">"{query}"</span>
        </h1>

        {results.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
            {results.map((anime: Anime) => (
              <AnimeCard key={anime.id} anime={anime} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-zinc-500">
            <SearchX size={64} className="mb-4 opacity-50" />
            <p className="text-xl font-medium">Ничего не найдено</p>
            <p className="text-sm mt-2">Попробуйте изменить запрос</p>
          </div>
        )}
      </div>
    </div>
  )
}
