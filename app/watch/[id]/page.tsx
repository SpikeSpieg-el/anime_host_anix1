import { notFound } from "next/navigation"
import { Navbar } from "@/components/layout/navbar"
import { getAnimeById, getAnimeFranchise } from "@/lib/shikimori"
import dynamic from "next/dynamic"
import { WatchPageHeaderSkeleton, PlayerSkeleton, EpisodeSelectorSkeleton, TextSkeleton } from "@/components/shared/skeleton"
import type { Metadata } from "next"

const WatchPageLayoutWrapper = dynamic(() => import("@/components/watch/watch-page-layout-wrapper").then(mod => ({ default: mod.WatchPageLayoutWrapper })), {
  loading: () => (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <div className="container mx-auto px-4 py-8 space-y-6">
        <WatchPageHeaderSkeleton />
        <PlayerSkeleton />
        <EpisodeSelectorSkeleton />
        <div className="space-y-3">
          <TextSkeleton lines={8} />
        </div>
      </div>
    </div>
  )
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
  const title = `${anime.title}${episodeText} — Weeb-X`
  const description = anime.description 
    ? `${anime.description.slice(0, 160)}${anime.description.length > 160 ? "..." : ""}`
    : `Смотреть ${anime.title} онлайн в хорошем качестве. ${anime.year} • ${anime.genres.join(", ")} • Рейтинг: ${anime.rating}`

  const canonicalUrl = `https://weeb-x.com/watch/${id}${episode ? `?episode=${episode}` : ""}`

  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title,
      description,
      type: "video.tv_show",
      url: canonicalUrl,
      images: [
        {
          url: anime.poster,
          width: 400,
          height: 600,
          alt: anime.title,
        },
      ],
      siteName: "Weeb-X",
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
    <WatchPageLayoutWrapper
      anime={anime}
      initialEpisode={Number.isFinite(episode) && (episode as number) > 0 ? (episode as number) : undefined}
      watchOrder={watchOrder}
    />
  )
}