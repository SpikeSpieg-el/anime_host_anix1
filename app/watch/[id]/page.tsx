import { notFound, permanentRedirect } from "next/navigation"
import { Navbar } from "@/components/layout/navbar"
import { getAnimeById, getAnimeFranchise, type Anime } from "@/lib/shikimori"
import dynamic from "next/dynamic"
import { WatchPageHeaderSkeleton, PlayerSkeleton, EpisodeSelectorSkeleton, TextSkeleton } from "@/components/shared/skeleton"
import type { Metadata } from "next"
import { BreadcrumbStructuredData } from "@/components/seo/structured-data"
import { getSchemaPosterUrl } from "@/lib/shikimori/images"
import { cleanAnimeTitle, getWatchPath, getWatchSegment, parseWatchParam, safeDecodeSegment } from "@/lib/seo/watch-url"
import { safeSerializeJson } from "@/lib/seo/safe-json"
import { isNoIndexAnime } from "@/lib/hentai-detector"

/**
 * Поля russian/english/japanese/kind теперь реально приходят из transformAnime
 * (см. Anime в lib/shikimori/types.ts). Раньше они объявлялись здесь через
 * `as ExtendedAnime`, но в объекте отсутствовали — из-за этого alternateName
 * содержал только русское название, а @type всегда был TVSeries.
 */
type ExtendedAnime = Anime

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

/**
 * Страховочный редирект на канонический ЧПУ-адрес.
 *
 * Основную работу делает middleware (настоящий HTTP 301). Сюда доходят только
 * запросы с устаревшим slug, которого ещё нет в кэше middleware. Из-за
 * app/loading.tsx страница к этому моменту уже стримится с кодом 200, поэтому
 * Next.js сможет лишь вставить <meta http-equiv="refresh" content="0;url=...">.
 * permanentRedirect (в отличие от redirect) даёт задержку 0 — поисковики считают
 * такой refresh постоянным; вдобавок на странице есть <link rel="canonical">.
 */
function ensureCanonicalParam(id: string, cleanId: string, title: string, episode?: number) {
  const expectedParam = getWatchSegment(cleanId, title)
  if (safeDecodeSegment(id) !== expectedParam) {
    permanentRedirect(getWatchPath(cleanId, title, episode))
  }
  return expectedParam
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

  const cleanId = parseWatchParam(id)
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
  const mainTitle = cleanAnimeTitle(rawTitle)

  // Английское и японское названия — ключевые для запросов латиницей
  // («naruto», «attack on titan») и для alternateName в Schema.org.
  const englishTitle = cleanAnimeTitle(anime.english)
  const japaneseTitle = cleanAnimeTitle(anime.japanese)
  const altTitle = (englishTitle && englishTitle !== mainTitle ? englishTitle : '')
    || (japaneseTitle && japaneseTitle !== mainTitle ? japaneseTitle : '')
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
  const canonicalUrl = `${baseUrl}${getWatchPath(cleanId, rawTitle, episode)}`

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
    englishTitle ? `смотреть ${englishTitle} онлайн` : "",
    englishTitle ? `${englishTitle} смотреть аниме` : "",
    englishTitle ? `${englishTitle} online english sub` : "",
    japaneseTitle ? `${japaneseTitle} смотреть онлайн` : "",
    ...(anime.genres || []).map((g) => `аниме ${g.toLowerCase()}`),
    "weebx",
    "weeb-x",
  ].filter(Boolean)

  const keywords = [...new Set(rawKeywords)]

  // NSFW отдаём с noindex: страница доступна пользователям, но не поисковикам.
  const shouldNoIndex = isNoIndexAnime(anime)

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
    robots: shouldNoIndex
      ? { index: false, follow: true }
      : {
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

  const cleanId = parseWatchParam(id)

  // Запрашиваем аниме и комментарий редакции параллельно
  const [rawAnime, editorialReview] = await Promise.all([
    getAnimeById(cleanId, true),
    getEditorialReview(cleanId),
  ])

  if (!rawAnime) return notFound()

  const anime = rawAnime as ExtendedAnime
  
  // Очищаем вшитый год в скобках из названия
  const rawTitle = anime.russian || anime.title || ""
  const animeTitle = cleanAnimeTitle(rawTitle) || `Аниме #${cleanId}`

  // Страховка: обычно сюда уже приходит канонический адрес (301 из middleware).
  const expectedParam = ensureCanonicalParam(id, cleanId, rawTitle, episode)

  const franchise = await getAnimeFranchise(cleanId)
  const watchOrder = franchise

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://weeb-x.com"
  const contentUrl = `${baseUrl}/watch/${expectedParam}`

  // Английское/японское названия нужны и здесь — они идут в alternateName.
  const englishTitle = cleanAnimeTitle(anime.english)
  const japaneseTitle = cleanAnimeTitle(anime.japanese)

  const alternateNames = [englishTitle, japaneseTitle, anime.title]
    .filter((name): name is string => Boolean(name))
    .map((name) => cleanAnimeTitle(name))
    .filter((name, index, arr) => name && arr.indexOf(name) === index)

  const schemaType = anime.kind === "movie" ? "Movie" : "TVSeries"

  const jsonLd: Record<string, any> = {
    "@context": "https://schema.org",
    "@type": schemaType,
    "name": animeTitle,
    "alternateName": alternateNames,
    "image": getSchemaPosterUrl(anime.poster),
    "description": anime.description?.replace(/\[.*?\]/g, "").slice(0, 200) || `Смотреть аниме ${animeTitle} онлайн`,
    "genre": anime.genres,
    "inLanguage": "ru",
    "url": contentUrl,
  }

  if (anime.airedOn) {
    jsonLd["dateCreated"] = new Date(anime.airedOn).toISOString()
    jsonLd["datePublished"] = new Date(anime.airedOn).toISOString()
  }

  // aggregateRating СОЗНАТЕЛЬНО не выводим.
  //
  // Раньше здесь были ratingValue из Shikimori (чужая оценка, не наших
  // пользователей) и ratingCount, который просто выдумывался по формуле
  // `80 + (id % 120)`. Это прямое нарушение правил Google о спамной разметке
  // (Ratings must be genuine and come from your own users) и риск ручных санкций,
  // а вместе с ними — пропажи ВСЕХ расширенных сниппетов сайта.
  // Возвращайте блок только когда появится реальный счётчик оценок с сайта,
  // например: ratingCount: <число реальных оценок в Supabase>.

  // Добавляем микроразметку отзыва редакции для SEO Schema.org
  if (editorialReview) {
    jsonLd["review"] = {
      "@type": "Review",
      "author": {
        "@type": "Organization",
        "name": editorialReview.author || "Редакция Weebx",
      },
      "reviewBody": editorialReview.content,
      "datePublished": new Date(editorialReview.created_at).toISOString(),
      "dateModified": new Date(editorialReview.updated_at || editorialReview.created_at).toISOString(),
    }
  }

  const videoObject: Record<string, any> = {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    "name": episode ? `${animeTitle} - Серия ${episode}` : animeTitle,
    "description": anime.description?.replace(/\[.*?\]/g, "").slice(0, 200) || `Смотреть аниме ${animeTitle} онлайн`,
    "thumbnailUrl": getSchemaPosterUrl(anime.poster),
    "contentUrl": contentUrl,
    "uploadDate": anime.airedOn ? new Date(anime.airedOn).toISOString() : new Date().toISOString(),
    "inLanguage": "ru",
    "genre": anime.genres,
  }

  // embedUrl указывал на /embed/{id}, который закрыт в robots.txt
  // (Disallow: /embed/) и отдаёт X-Robots-Tag: noindex. Google не может
  // проверить такую ссылку и выбрасывает VideoObject целиком — видео
  // расширенные сниппеты не появлялись. Плеер живёт на самой странице /watch,
  // поэтому contentUrl выше достаточно; embedUrl вернём, если /embed/
  // когда-нибудь откроют для обхода (noindex-заголовок оставить можно).

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
        dangerouslySetInnerHTML={{ __html: safeSerializeJson(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeSerializeJson(videoObject) }}
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