import { notFound } from "next/navigation"
import Image from "next/image"
import { Navbar } from "@/components/navbar"
import { getAnimeById } from "@/lib/shikimori"
import { KodikPlayer } from "@/components/kodik-player"
import { HistoryTracker } from "@/components/history-tracker" // Импорт есть

export default async function WatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  
  // 1. Получаем данные с Shikimori
  const anime = await getAnimeById(id)

  if (!anime) return notFound()

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <Navbar />
      
      {/* --- ВАЖНО: Вставляем трекер сюда, чтобы история сохранялась --- */}
      <HistoryTracker anime={anime} />
      
      <div className="container mx-auto px-4 py-8">
        {/* Плеер */}
        <div className="mb-8">
           <h1 className="text-2xl md:text-3xl font-bold mb-4">{anime.title}</h1>
           
           {/* Вставляем плеер, который сам найдет видео по ID */}
           <KodikPlayer shikimoriId={anime.shikimoriId} title={anime.title} />
        </div>

        {/* Инфо */}
        <div className="flex flex-col md:flex-row gap-8">
           <div className="w-[200px] shrink-0 hidden md:block">
              <div className="aspect-[2/3] relative rounded-xl overflow-hidden border border-white/10">
                <Image src={anime.poster} fill alt={anime.title} className="object-cover" />
              </div>
           </div>
           
           <div className="flex-1">
              <div className="flex flex-wrap gap-2 mb-4">
                {anime.genres.map((g: string) => (
                  <span key={g} className="px-3 py-1 bg-zinc-800 rounded-full text-xs text-zinc-300 border border-zinc-700">
                    {g}
                  </span>
                ))}
              </div>
              <p className="text-zinc-400 leading-relaxed whitespace-pre-line text-lg">
                {anime.description}
              </p>
           </div>
        </div>
      </div>
    </div>
  )
}