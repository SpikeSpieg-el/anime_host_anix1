import { notFound } from "next/navigation"
import Image from "next/image"
import { Navbar } from "@/components/navbar"
import { getAnimeById } from "@/lib/shikimori"
import { WatchPageClient } from "@/components/watch-page-client"

export default async function WatchPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams?: Promise<{ episode?: string }>
}) {
  const { id } = await params
  const sp = searchParams ? await searchParams : undefined
  const episode = sp?.episode ? Number.parseInt(sp.episode, 10) : undefined

  const anime = await getAnimeById(id)

  if (!anime) return notFound()

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <Navbar />

      <div className="container mx-auto px-4 py-8">
        <WatchPageClient
          shikimoriId={anime.shikimoriId}
          title={anime.title}
          poster={anime.poster}
          totalEpisodes={anime.episodesTotal || 1}
          initialEpisode={Number.isFinite(episode) && (episode as number) > 0 ? (episode as number) : undefined}
        />

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