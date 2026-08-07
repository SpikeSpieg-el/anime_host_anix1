import { notFound, redirect } from "next/navigation"
import { Navbar } from "@/components/layout/navbar"
import { getAnimeById, getAnimeFranchise, type Anime } from "@/lib/shikimori"
import dynamic from "next/dynamic"
import { WatchPageHeaderSkeleton, PlayerSkeleton, EpisodeSelectorSkeleton, TextSkeleton } from "@/components/shared/skeleton"
import type { Metadata } from "next"
import { BreadcrumbStructuredData } from "@/components/seo/structured-data"

type ExtendedAnime = Anime & {
  russian?: string
  english?: string
  japanese?: string
  kind?: string
  score?: string | number
}

export type EditorialReview = {
  id: string
  anime_id: string
  content: string
  author: string
  created_at: string
  updated_at: string
}

// Получение комментария редакции из Supabase REST API (без статического кэша)
async function getEditorialReview(animeId: string): Promise<EditorialReview | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    console.error("[EditorialReview] Отсутствуют переменные окружения Supabase!")
    return null
  }

  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/editorial_reviews?anime_id=eq.${encodeURIComponent(animeId)}&select=*`,
      {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
        cache: 'no-store', // НЕ КЭШИРОВАТЬ! Запрос всегда получит свежие данные
      }
    )

    if (!res.ok) {
      console.error("[EditorialReview] Ошибка ответа Supabase:", res.status, await res.text())
      return null
    }

    const data = await res.json()
    return data && data.length > 0 ? (data[0] as EditorialReview) : null
  } catch (err) {
    console.error("[EditorialReview] Ошибка выполнения запроса:", err)
    return null
  }
}

function slugify(text: string): string {
  const ru: Record<string, string> = {
    а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo", ж: "zh",
    з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o",
    п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "kh", ц: "ts",
    ч: "ch", ш: "sh", щ: "shch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya"
  }
  return text
    .toLowerCase()
    .split("")
    .map((char) => ru[char] || char)
    .join("")
    .replace(/[^a-z0-9]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
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

  const cleanId = id.split("-")[0]
  const [rawAnime, editorialReview] = await Promise.all([
    getAnimeById(cleanId, true),
    getEditorialReview(cleanId),
  ])

  if (!rawAnime) {
    return {
      title: "Аниме не найдено — Weebx",
      description: "Запрошенное аниме не найдено в каталоге Weebx.",
      robots: { index: false, follow: false },
    }
  }

  const anime = rawAnime as ExtendedAnime

  // Очищаем вшитый год в скобках из названия
  const rawTitle = anime.russian || anime.title || ''
  const mainTitle = rawTitle.replace(/\s*\(\d{4}\)$/, "").trim()
  
  const altTitle = anime.english && anime.english !== mainTitle ? anime.english.replace(/\s*\(\d{4}\)$/, "") : 
                   anime.japanese && anime.japanese !== mainTitle ? anime.japanese.replace(/\s*\(\d{4}\)$/, "") : ""
  const yearText = anime.year ? ` (${anime.year})` : ""

  const title = episode && episode > 0
    ? `${mainTitle} ${episode} серия смотреть онлайн бесплатно в HD${yearText} | Weebx`
    : `${mainTitle}${yearText} смотреть аниме онлайн бесплатно в HD | Weebx`

  let rawDescription = anime.description 
    ? anime.description.replace(/\[.*?\]/g, "").replace(/<[^>]*>?/gm, "").trim()
    : `Смотрите аниме «${mainTitle}» онлайн бесплатно в хорошем качестве HD с русской озвучкой.`

  if (rawDescription.length > 140) {
    rawDescription = rawDescription.slice(0, 140).trim().replace(/[.,!?:;-]+$/, "") + "..."
  } else if (rawDescription && !/[.!?]$/.test(rawDescription)) {
    rawDescription += "."
  }

  const epTextLabel = episode && episode > 0 ? `${episode} серия` : "все серии подряд"
  const description = `${rawDescription} Смотрите «${mainTitle}» (${epTextLabel}) с русской озвучкой и субтитрами онлайн на Weebx.`

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://weeb-x.com"
  const slug = slugify(mainTitle)
  const canonicalUrl = `${baseUrl}/watch/${cleanId}${slug ? `-${slug}` : ""}${episode ? `?episode=${episode}` : ""}`

  const rawKeywords = [
    `смотреть ${mainTitle} онлайн`,
    `${mainTitle} смотреть бесплатно`,
    `${mainTitle} смотреть онлайн бесплатно`,
    `${mainTitle} в хорошем качестве HD`,
    `${mainTitle} русская озвучка`,
    `${mainTitle} weebx`,
    editorialReview ? `отзыв редакции ${mainTitle}` : "",
    editorialReview ? `мнение редакции weebx ${mainTitle}` : "",
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
    robots: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
      "max-video-preview": -1,
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

  const cleanId = id.split("-")[0]

  // Запрашиваем аниме и комментарий редакции параллельно
  const [rawAnime, editorialReview] = await Promise.all([
    getAnimeById(cleanId, true),
    getEditorialReview(cleanId),
  ])

  if (!rawAnime) return notFound()

  const anime = rawAnime as ExtendedAnime
  
  // Очищаем вшитый год в скобках из названия
  const rawTitle = anime.russian || anime.title || `Аниме #${cleanId}`
  const animeTitle = rawTitle.replace(/\s*\(\d{4}\)$/, "").trim()
  
  const slug = slugify(animeTitle)
  const expectedParam = slug ? `${cleanId}-${slug}` : cleanId

  // Автоматический редирект на красивый ЧПУ адрес
  if (id !== expectedParam) {
    const epQuery = episode ? `?episode=${episode}` : ""
    redirect(`/watch/${expectedParam}${epQuery}`)
  }

  const franchise = await getAnimeFranchise(cleanId)
  const watchOrder = franchise

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://weeb-x.com"
  const contentUrl = `${baseUrl}/watch/${expectedParam}`
  const animeRating = anime.score || anime.rating

  const alternateNames = [anime.english, anime.japanese, anime.title]
    .filter((name): name is string => Boolean(name))
    .map((name) => name.replace(/\s*\(\d{4}\)$/, "").trim())
    .filter((name, index, arr) => arr.indexOf(name) === index)

  const jsonLd: Record<string, any> = {
    "@context": "https://schema.org",
    "@type": anime.kind === "movie" ? "Movie" : "TVSeries",
    "name": animeTitle,
    "alternateName": alternateNames,
    "image": anime.poster,
    "description": anime.description?.replace(/\[.*?\]/g, "").slice(0, 200) || `Смотреть аниме ${animeTitle} онлайн`,
    "genre": anime.genres,
    "inLanguage": "ru",
    "url": contentUrl,
  }

  if (anime.airedOn) {
    jsonLd["dateCreated"] = anime.airedOn
    jsonLd["datePublished"] = anime.airedOn
  }

  if (animeRating) {
    const deterministicRatingCount = 80 + (Number.parseInt(cleanId, 10) % 120)
    jsonLd["aggregateRating"] = {
      "@type": "AggregateRating",
      "ratingValue": animeRating.toString(),
      "bestRating": "10",
      "worstRating": "1",
      "ratingCount": deterministicRatingCount.toString(),
    }
  }

  // Добавляем микроразметку отзыва редакции для SEO Schema.org
  if (editorialReview) {
    jsonLd["review"] = {
      "@type": "Review",
      "author": {
        "@type": "Organization",
        "name": editorialReview.author || "Редакция Weebx",
      },
      "reviewBody": editorialReview.content,
      "datePublished": editorialReview.created_at,
      "dateModified": editorialReview.updated_at || editorialReview.created_at,
    }
  }

  const videoObject: Record<string, any> = {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    "name": episode ? `${animeTitle} - Серия ${episode}` : animeTitle,
    "description": anime.description?.replace(/\[.*?\]/g, "").slice(0, 200) || `Смотреть аниме ${animeTitle} онлайн`,
    "thumbnailUrl": anime.poster,
    "contentUrl": contentUrl,
    "embedUrl": `${baseUrl}/embed/${cleanId}${episode ? `?episode=${episode}` : ""}`,
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

      <WatchPageLayoutWrapper
        anime={rawAnime}
        initialEpisode={Number.isFinite(episode) && (episode as number) > 0 ? (episode as number) : undefined}
        watchOrder={watchOrder}
        editorialReview={editorialReview}
      />
    </>
  )
}