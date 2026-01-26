import { notFound } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { Navbar } from "@/components/navbar"
import { getAnimeById, getAnimeFranchise } from "@/lib/shikimori"
import dynamic from "next/dynamic"
import type { Metadata } from "next"

const WatchPageClient = dynamic(() => import("@/components/watch-page-client").then(mod => ({ default: mod.WatchPageClient })), {
  loading: () => <div className="min-h-screen bg-background text-foreground flex items-center justify-center"><div className="text-muted-foreground">Загрузка плеера...</div></div>
})

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams?: Promise<{ episode?: string }>
}): Promise<Metadata> {
  const { id } = await params
  const sp = searchParams ? await searchParams : undefined
  const episode = sp?.episode ? Number.parseInt(sp.episode, 10) : undefined

  const anime = await getAnimeById(id, true)

  if (!anime) {
    return {
      title: "Аниме не найдено",
      description: "Запрошенное аниме не найдено",
    }
  }

  const episodeText = episode && episode > 0 ? ` (Серия ${episode})` : ""
  const title = `${anime.title}${episodeText} — Weeb.X`
  const description = anime.description 
    ? `${anime.description.slice(0, 160)}${anime.description.length > 160 ? "..." : ""}`
    : `Смотреть ${anime.title} онлайн в хорошем качестве. ${anime.year} • ${anime.genres.join(", ")} • Рейтинг: ${anime.rating}`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "video.tv_show",
      url: `/watch/${id}${episode ? `?episode=${episode}` : ""}`,
      images: [
        {
          url: anime.poster,
          width: 400,
          height: 600,
          alt: anime.title,
        },
      ],
      siteName: "Weeb.X",
      locale: "ru_RU",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [anime.poster],
    },
    other: {
      "og:video:type": "video.tv_show",
      "og:video:release_date": anime.airedOn || "",
      "og:video:tag": anime.genres,
      "og:video:actor": anime.title,
      "video:duration": anime.episodesTotal.toString(),
    },
  }
}

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

  const anime = await getAnimeById(id, true)

  if (!anime) return notFound()

  const franchise = await getAnimeFranchise(id)
  const watchOrder = franchise;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />

      <div className="container mx-auto px-4 py-8">
        <WatchPageClient
          anime={anime}
          initialEpisode={Number.isFinite(episode) && (episode as number) > 0 ? (episode as number) : undefined}
        />

        <div className="mt-8">
          <p className="text-zinc-400 leading-relaxed whitespace-pre-line text-lg">
            {anime.description}
          </p>
        </div>

        {watchOrder.length > 0 && (
          <div className="mt-10">
            <h2 className="text-xl md:text-2xl font-bold mb-4">Порядок просмотра</h2>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
              {watchOrder.map((item, index) => (
                item.isCurrent ? (
                  <div
                    key={item.id}
                    className="group block rounded-xl border border-orange-500/60 bg-secondary/40 p-2"
                  >
                    <div className="relative aspect-[2/3] overflow-hidden rounded-lg">
                      <Image src={item.poster} fill alt={item.title} className="object-cover" />
                      <div className="absolute top-2 left-2 rounded-md bg-black/70 px-2 py-1 text-[10px] font-bold text-white">
                        #{index + 1}
                      </div>
                    </div>

                    <div className="mt-2">
                      <div className="text-[11px] text-zinc-500">
                        {item.year ? item.year : ''}{item.kind ? (item.year ? ` • ${item.kind}` : item.kind) : ''}
                      </div>
                      <div className="text-sm font-semibold text-orange-500 line-clamp-2">
                        {item.title}
                      </div>
                    </div>
                  </div>
                ) : (
                  <Link
                    key={item.id}
                    href={`/watch/${item.id}`}
                    className="group block rounded-xl border border-border bg-secondary/40 p-2 transition hover:border-orange-500/40"
                  >
                    <div className="relative aspect-[2/3] overflow-hidden rounded-lg">
                      <Image src={item.poster} fill alt={item.title} className="object-cover transition-transform duration-300 group-hover:scale-105" />
                      <div className="absolute top-2 left-2 rounded-md bg-black/70 px-2 py-1 text-[10px] font-bold text-white">
                        #{index + 1}
                      </div>
                    </div>

                    <div className="mt-2">
                      <div className="text-[11px] text-zinc-500">
                        {item.year ? item.year : ''}{item.kind ? (item.year ? ` • ${item.kind}` : item.kind) : ''}
                      </div>
                      <div className="text-sm font-semibold text-white line-clamp-2 group-hover:text-orange-500 transition-colors">
                        {item.title}
                      </div>
                    </div>
                  </Link>
                )
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}