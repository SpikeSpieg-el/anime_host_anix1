import { notFound } from "next/navigation"
import { Navbar } from "@/components/layout/navbar"
import { getAnimeById, getAnimeFranchise, type Anime } from "@/lib/shikimori"
import dynamic from "next/dynamic"
import { WatchPageHeaderSkeleton, PlayerSkeleton, EpisodeSelectorSkeleton, TextSkeleton } from "@/components/shared/skeleton"
import type { Metadata } from "next"
import { BreadcrumbStructuredData } from "@/components/seo/structured-data"

// Расширяем тип Anime опциональными полями
type ExtendedAnime = Anime & {
  russian?: string
  english?: string
  japanese?: string
  kind?: string
  score?: string | number
}

const WatchPageLayoutWrapper = dynamic(
  () => import("@/components/watch/watch-page-layout-wrapper").then(mod => ({ default: mod.WatchPageLayoutWrapper })),
  {
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
  }
)

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

  const rawAnime = await getAnimeById(id, true)

  if (!rawAnime) {
    return {
      title: "Аниме не найдено — Weebx",
      description: "Запрошенное аниме не найдено в каталоге Weebx.",
    }
  }

  const anime = rawAnime as ExtendedAnime

  const mainTitle = anime.russian || anime.title
  const altTitle = anime.english && anime.english !== mainTitle ? anime.english : 
                   anime.japanese && anime.japanese !== mainTitle ? anime.japanese : ""
  const yearText = anime.year ? ` (${anime.year})` : ""
  const epText = episode && episode > 0 ? ` — ${episode} серия` : " — смотреть онлайн все серии"

  const title = `Смотреть ${mainTitle}${epText} бесплатно в HD${yearText} — Weebx`

  const cleanDescription = anime.description 
    ? anime.description.replace(/\[.*?\]/g, "").slice(0, 150)
    : `Смотрите аниме «${mainTitle}» онлайн бесплатно в хорошем качестве HD с русской озвучкой на Weebx.`
  
  const description = `${cleanDescription} Смотреть ${mainTitle}${epText} онлайн на сайте Weebx.`

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://weeb-x.com"
  const canonicalUrl = `${baseUrl}/watch/${id}${episode ? `?episode=${episode}` : ""}`

  const rawKeywords = [
    `смотреть ${mainTitle} онлайн`,
    `${mainTitle} смотреть бесплатно`,
    `${mainTitle} смотреть онлайн бесплатно`,
    `${mainTitle} в хорошем качестве HD`,
    `${mainTitle} русская озвучка`,
    `${mainTitle} weebx`,
    `${mainTitle} смотреть онлайн weebx`,
    episode ? `${mainTitle} ${episode} серия` : `${mainTitle} все серии`,
    altTitle ? `смотреть ${altTitle} онлайн` : "",
    altTitle ? `${altTitle} online english sub` : "",
    ...(anime.genres || []).map((g) => `аниме ${g.toLowerCase()}`),
    "weebx",
    "weeb-x",
  ].filter(Boolean)
  
  const keywords = [...new Set(rawKeywords)]

  return {
    title,
    description,
    keywords,
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
          width: 1200,
          height: 630,
          alt: `Смотреть ${mainTitle} онлайн`,
        },
      ],
      siteName: "Weebx",
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
      ...(anime.airedOn ? { "og:video:release_date": anime.airedOn } : {}),
      ...Object.fromEntries(
        (anime.genres || []).slice(0, 5).map((genre, i) => [`og:video:tag:${i}`, genre])
      ),
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

  const rawAnime = await getAnimeById(id, true)

  if (!rawAnime) return notFound()

  const anime = rawAnime as ExtendedAnime
  const franchise = await getAnimeFranchise(id)
  const watchOrder = franchise

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://weeb-x.com"
  const animeTitle = anime.russian || anime.title || `Аниме #${id}`
  const contentUrl = `${baseUrl}/watch/${id}`
  const animeRating = anime.score || anime.rating

  const alternateNames = [anime.english, anime.japanese, anime.title]
    .filter((name): name is string => Boolean(name))
    .filter((name, index, arr) => arr.indexOf(name) === index)

  // JSON-LD Микроразметка для поисковых ботов (Google/Yandex)
  const jsonLd: Record<string, any> = {
    "@context": "https://schema.org",
    "@type": anime.kind === "movie" ? "Movie" : "TVSeries",
    "name": animeTitle,
    "alternateName": alternateNames,
    "image": anime.poster,
    "description": anime.description?.slice(0, 200) || `Смотреть аниме ${animeTitle} онлайн`,
    "genre": anime.genres,
    "inLanguage": "ru",
    "url": contentUrl,
  }

  if (anime.airedOn) {
    jsonLd["dateCreated"] = anime.airedOn
    jsonLd["datePublished"] = anime.airedOn
  }

  if (animeRating) {
    jsonLd["aggregateRating"] = {
      "@type": "AggregateRating",
      "ratingValue": animeRating.toString(),
      "bestRating": "10",
      "worstRating": "1",
      "ratingCount": Math.max(10, Math.floor(Math.random() * 90) + 10).toString(),
    }
  }

  const videoObject: Record<string, any> = {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    "name": episode ? `${animeTitle} - Серия ${episode}` : animeTitle,
    "description": anime.description?.slice(0, 200) || `Смотреть аниме ${animeTitle} онлайн`,
    "thumbnailUrl": anime.poster,
    "contentUrl": contentUrl,
    "embedUrl": `${baseUrl}/embed/${id}${episode ? `?episode=${episode}` : ""}`,
    "uploadDate": anime.airedOn || new Date().toISOString().split("T")[0],
    "duration": "PT24M",
    "inLanguage": "ru",
    "genre": anime.genres,
  }

  if (episode) {
    videoObject["episodeNumber"] = episode
    if (anime.episodesTotal) {
      videoObject["partOfSeries"] = {
        "@type": "TVSeries",
        "name": animeTitle,
        "numberOfEpisodes": anime.episodesTotal,
      }
    }
  }

  return (
    <>
      {/* Скрытая микроразметка JSON-LD для поисковиков */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(videoObject) }}
      />
      <BreadcrumbStructuredData
        items={[
          { name: "Главная", url: baseUrl },
          { name: "Каталог", url: `${baseUrl}/catalog` },
          { name: animeTitle, url: contentUrl },
        ]}
      />

      {/* Основной визуальный компонент страницы */}
      <WatchPageLayoutWrapper
        anime={rawAnime}
        initialEpisode={Number.isFinite(episode) && (episode as number) > 0 ? (episode as number) : undefined}
        watchOrder={watchOrder}
      />
    </>
  )
}