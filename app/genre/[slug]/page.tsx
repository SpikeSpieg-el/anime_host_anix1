import type { Metadata } from "next"
import { cache } from "react"
import { notFound } from "next/navigation"
import Link from "next/link"
import { cookies } from "next/headers"
import { createClient } from "@supabase/supabase-js"
import { Navbar } from "@/components/layout/navbar"
import { Footer } from "@/components/layout/footer"
import { ScrollToTop } from "@/components/layout/scroll-to-top"
import { AnimeCard } from "@/components/shared/anime-card"
import { PageBreadcrumbs } from "@/components/shared/page-breadcrumbs"
import { GenreCarousel } from "@/components/genre/genre-carousel"
import { getAnimeCatalog } from "@/lib/shikimori"
import type { Anime } from "@/lib/shikimori"
import { safeSerializeJson } from "@/lib/seo/safe-json"
import { getWatchPath } from "@/lib/seo/watch-url"
import {
  GENRE_LANDINGS,
  INDEXABLE_GENRE_LANDINGS,
  buildGenreDescription,
  buildGenreTitle,
  getGenreLanding,
  getGenrePath,
} from "@/lib/seo/genre-landings"
import type { GenreLanding } from "@/lib/seo/genre-landings"

// Результаты зависят от allow_nsfw_search в профиле пользователя.
export const dynamic = "force-dynamic"

// Только 40 жанров из GENRES_MAP. Без этого Next.js нарисовал бы страницу
// для любого мусорного slug'а (/genre/aaaaaaaa), и роботы обходили бы паутину
// адресов, которых в sitemap нет.
export const dynamicParams = false

const SITE_URL = "https://weeb-x.com"
const PAGE_SIZE = 24

async function canShowAdultGenres(): Promise<boolean> {
  try {
    const cookieStore = await cookies()
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !anonKey) return false

    const supabase = createClient(url, anonKey, {
      global: { headers: { cookie: cookieStore.toString() } },
    })
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return false

    const { data: profile } = await supabase
      .from("profiles")
      .select("allow_nsfw_search")
      .eq("id", user.id)
      .single()
    return profile?.allow_nsfw_search === true
  } catch {
    return false
  }
}

/**
 * Первый экран жанра. React.cache мемоизирует выборку на время рендера, иначе
 * generateMetadata и сам page сходили бы в Shikimori дважды.
 */
const getGenreAnimes = cache(async (genreName: string, allowNsfw = false): Promise<Anime[]> =>
  getAnimeCatalog({
    genre: genreName,
    page: 1,
    limit: PAGE_SIZE,
    order: 'popularity',
    // Гостям/профилям с безопасным поиском adult-контент отфильтровываем.
    allowNsfw,
  }).catch((error) => {
    console.error('[genre] не удалось получить список для', genreName, error)
    return []
  }),
)

export function generateStaticParams() {
  return GENRE_LANDINGS.map((genre) => ({ slug: genre.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const genre = getGenreLanding(slug)
  if (!genre) return {}

  const animes = await getGenreAnimes(genre.name)
  const title = buildGenreTitle(genre)
  const description = buildGenreDescription(genre, animes.length)
  const canonicalUrl = `${SITE_URL}${getGenrePath(genre.slug)}`

  return {
    title,
    description,
    alternates: {
      // SELF-canonical. Именно жёсткий canonical на /catalog убил все
      // жанровые тайтлы до этого — здесь он обязан указывать на себя.
      canonical: canonicalUrl,
    },
    openGraph: {
      title,
      description,
      type: "website",
      url: canonicalUrl,
      siteName: "Weebx",
      locale: "ru_RU",
      images: [
        {
          url: `${SITE_URL}/og-image.png`,
          width: 1200,
          height: 630,
          alt: `${genre.name} аниме — смотреть онлайн на Weebx`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [`${SITE_URL}/og-image.png`],
    },
    robots: genre.indexable
      ? {
          index: true,
          follow: true,
          "max-snippet": -1,
          "max-image-preview": "large",
          "max-video-preview": -1,
        }
      : { index: false, follow: false },
  }
}

function buildJsonLd(
  genre: GenreLanding,
  animes: Anime[],
  canonicalUrl: string,
  description: string,
) {
  const collectionPage = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "name": `Смотреть ${genre.name} аниме онлайн бесплатно`,
    "description": description,
    "url": canonicalUrl,
    inLanguage: "ru",
    isPartOf: {
      "@type": "WebSite",
      "name": "Weebx",
      "url": SITE_URL,
    },
  }

  // BreadcrumbList здесь НЕ строим: его отдаёт <PageBreadcrumbs/>. Две
  // одинаковые сущности на странице — это дубли разметки, которые Google
  // показывает как ошибку в отчёте о структурированных данных.
  // Здесь НЕ строим ItemList из VideoObject — это не потеря, а требование
  // Google, а не украшение.
  //
  // Требования к watch page (developers.google.com/search/docs/appearance/video):
  //   * «The video must be embedded on a watch page» — видео должно быть на
  //     отдельной странице просмотра;
  //   * «A video category page that lists multiple videos of equal prominence»
  //     прямо названа примером страницы, которая watch page НЕ является;
  //   * «to be eligible for video features, create a dedicated watch page for
  //     each video».
  //
  // Именно из-за этих VideoObject на странице жанра Google отдавал причину
  // «Видео находится не на странице просмотра». Плюс у них был thumbnailUrl
  // на сыром внешнем домене (shikimori.one/...), который Googlebot не может
  // скачать, — это давало ещё и «не удалось просканировать уменьшенное
  // изображение».
  //
  // Жанровая страница остаётся полноценной точкой входа: CollectionPage,
  // хлебные крошки и обычные ссылки на /watch. Видеоиндексацию обеспечивают
  // сами страницы /watch, где разметка VideoObject одна на страницу.
  // TVSeries, а не Movie: большинство позиций каталога — сериалы,
  // а не полнометражки. Поля name + url у TVSeries валидны и не требуют
  // ничего, чего у нас нет.
  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${genre.name} аниме на Weebx`,
    numberOfItems: animes.length,
    itemListElement: animes.map((anime, index) => ({
      "@type": "ListItem",
      position: index + 1,
      item: {
        "@type": "TVSeries",
        name: anime.title,
        url: `${SITE_URL}${getWatchPath(anime.id, anime.title)}`,
      },
    })),
  }

  return [collectionPage, itemList]
}

export default async function GenrePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const genre = getGenreLanding(slug)
  if (!genre) notFound()

  const allowNsfw = await canShowAdultGenres()
  const animes = await getGenreAnimes(genre.name, allowNsfw)
  const canonicalUrl = `${SITE_URL}${getGenrePath(genre.slug)}`
  const description = buildGenreDescription(genre, animes.length)
  const jsonLd = buildJsonLd(genre, animes, canonicalUrl, description)

  // Соседние жанры: взаимная перелинковка 38 страниц вместо 38 изолированных.
  const relatedGenres = INDEXABLE_GENRE_LANDINGS.filter(
    (item) => item.slug !== genre.slug,
  )

  return (
    <main className="min-h-screen bg-background text-foreground pb-20 md:pb-24 relative">
      {jsonLd.map((data, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: safeSerializeJson(data) }}
        />
      ))}

      {/* Dot Pattern Background — как на /catalog */}
      <div className="absolute inset-0 z-0 pointer-events-none opacity-[0.07]">
        <div className="bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:20px_20px]" />
      </div>

      <Navbar />

      <div className="relative z-10 px-3 pt-6 pb-12 sm:px-4 sm:pt-8 sm:pb-16">
        <div className="container mx-auto">
          {/* Хлебные крошки */}
          <PageBreadcrumbs
            className="mb-5"
            backFallback="/genre"
            items={[
              { label: "Главная", href: "/" },
              { label: "Жанры", href: "/genre" },
              { label: genre.name },
            ]}
          />

          <header className="mb-8">
            <h1 className="text-2xl md:text-4xl lg:text-5xl font-black text-foreground tracking-tight leading-tight dark:text-white">
              Смотреть {genre.name} аниме онлайн бесплатно
            </h1>
            <p className="mt-3 text-sm sm:text-base text-muted-foreground max-w-3xl leading-relaxed dark:text-zinc-400">
              {genre.hint.charAt(0).toUpperCase()}
              {genre.hint.slice(1)}. Смотрите {genre.name.toLowerCase()} аниме в хорошем
              качестве HD с русской озвучкой и субтитрами — бесплатно и без регистрации.
              {animes.length > 0 && ` В подборке ${animes.length} тайтлов`}, новые серии
              появляются регулярно.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link
                href={`/catalog?genre=${encodeURIComponent(genre.name)}`}
                className="inline-flex items-center rounded-lg bg-primary px-4 py-2 text-sm font-bold text-black transition-opacity hover:opacity-90 dark:bg-orange-500"
              >
                Все {genre.name.toLowerCase()} в каталоге
              </Link>
              <Link
                href="/genre"
                className="inline-flex items-center rounded-lg border border-border px-4 py-2 text-sm font-bold text-foreground transition-colors hover:border-primary/50 dark:border-white/10 dark:text-white"
              >
                Все жанры
              </Link>
            </div>
          </header>

          {/* Карточки рендерятся на сервере: в HTML сразу есть ссылки на
              /watch/*, Googlebot не обязан выполнять JS. */}
          {animes.length > 0 ? (
            <section aria-label={`Аниме в жанре ${genre.name}`}>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3 sm:gap-4">
                {animes.map((anime, i) => (
                  <AnimeCard key={anime.id} anime={anime} priority={i < 6} />
                ))}
              </div>

              <p className="mt-8 text-sm text-muted-foreground dark:text-zinc-500">
                Показаны первые {animes.length}.{' '}
                <Link
                  href={`/catalog?genre=${encodeURIComponent(genre.name)}`}
                  className="text-primary hover:underline font-semibold dark:text-orange-400"
                >
                  Открыть в каталоге
                </Link>{' '}
                — там есть сортировка по рейтингу, году и количеству серий.
              </p>
            </section>
          ) : (
            <p className="rounded-lg border border-border p-6 text-sm text-muted-foreground dark:border-white/10 dark:text-zinc-400">
              Не удалось загрузить подборку — список появится при следующем обновлении
              страницы. Тайтлы жанра всегда доступны в{' '}
              <Link href="/catalog" className="text-primary hover:underline dark:text-orange-400">каталоге</Link>.
            </p>
          )}

          {/* Перелинковка на остальные жанры */}
          {genre.indexable && (
            <section aria-label="Другие жанры" className="mt-12">
              <div className="mb-5 flex items-baseline justify-between gap-4">
                <h2 className="text-sm font-black uppercase tracking-widest text-foreground dark:text-white">
                  Другие жанры
                </h2>
                <Link
                  href="/genre"
                  className="text-xs font-semibold text-muted-foreground transition-colors hover:text-primary dark:text-zinc-500 dark:hover:text-orange-400"
                >
                  Все жанры
                </Link>
              </div>
              <GenreCarousel genres={relatedGenres} />
            </section>
          )}
        </div>
      </div>

      <ScrollToTop />
      <Footer />
    </main>
  )
}