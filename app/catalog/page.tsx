import { Navbar } from "@/components/layout/navbar"
import { CatalogPageWrapper } from "@/components/catalog/catalog-page-wrapper"
import { CatalogFilters } from "@/lib/shikimori"
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { Footer } from "@/components/layout/footer"
import { ScrollToTop } from "@/components/layout/scroll-to-top"
import type { Metadata } from "next"

async function getUserProfile() {
  try {
    const cookieStore = await cookies()
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    
    if (!supabaseUrl || !supabaseAnonKey) return null
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          cookie: cookieStore.toString()
        }
      }
    })
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    
    const { data: profile } = await supabase
      .from('profiles')
      .select('allow_nsfw_search')
      .eq('id', user.id)
      .single()
    
    return profile
  } catch {
    return null
  }
}

interface CatalogPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

// Вспомогательная функция для перевода типов контента в читаемый вид
function getKindLabel(kind?: string) {
  if (!kind) return ""
  switch (kind) {
    case "tv": return "аниме-сериалы"
    case "movie": return "полнометражные аниме фильмы"
    case "ova": return "OVA"
    case "ona": return "ONA"
    case "special": return "спешлы"
    default: return kind
  }
}

export async function generateMetadata({
  searchParams,
}: CatalogPageProps): Promise<Metadata> {
  const params = await searchParams
  
  const search = typeof params.search === 'string' ? params.search : undefined
  const genre = typeof params.genre === 'string' 
    ? (params.genre.includes(',') ? params.genre.split(',').join(', ') : params.genre) 
    : undefined
  const year = typeof params.year === 'string' 
    ? (params.year.includes(',') ? params.year.split(',').join(', ') : params.year) 
    : undefined
  const kind = typeof params.kind === 'string' ? params.kind : undefined

  const kindLabel = getKindLabel(kind)

  // По умолчанию для общего каталога
  let title = "Каталог аниме — Смотреть аниме онлайн бесплатно в HD | Weebx"
  let description = "Большой каталог аниме на Weebx. Удобный поиск и фильтры по жанрам, годам и типам. Смотрите любимые аниме онлайн бесплатно в хорошем качестве с русской озвучкой!"

  // Динамические заголовки под поисковые интенты
  if (search) {
    title = `Смотреть «${search}» онлайн бесплатно в HD — Поиск аниме на Weebx`
    description = `Результаты поиска по запросу «${search}». Смотрите ${search} и похожие аниме онлайн бесплатно в хорошем качестве на Weebx.`
  } else if (genre && year) {
    title = `Смотреть аниме ${genre} ${year} года онлайн бесплатно в HD — Weebx`
    description = `Каталог аниме в жанре ${genre} за ${year} год. Смотрите лучшие ${kindLabel || "аниме"} ${year} года онлайн в хорошем качестве с русской озвучкой.`
  } else if (genre) {
    title = `Аниме в жанре ${genre} смотреть онлайн бесплатно в HD — Weebx`
    description = `Смотреть ${kindLabel || "аниме"} в жанре ${genre} онлайн бесплатно. Лучшие тайтлы ${genre} с русской озвучкой в хорошем качестве в каталоге Weebx.`
  } else if (year) {
    title = `Смотреть аниме ${year} года онлайн бесплатно — Каталог Weebx`
    description = `Лучшие ${kindLabel || "аниме"} ${year} года. Смотрите популярные новинки и выходившие тайтлы ${year} года онлайн бесплатно на Weebx.`
  } else if (kind) {
    title = `Смотреть ${kindLabel} онлайн бесплатно в HD — Каталог Weebx`
    description = `Каталог: ${kindLabel} онлайн. Лучшие тайтлы в хорошем качестве с русской озвучкой на Weebx.`
  }

  // Динамические ключевые слова под фильтр
  const dynamicKeywords = [
    search ? `смотреть ${search} онлайн` : "",
    search ? `${search} аниме бесплатно` : "",
    search ? `${search} weebx` : "",
    genre ? `смотреть аниме ${genre}` : "",
    genre ? `аниме ${genre} онлайн` : "",
    genre ? `аниме ${genre} бесплатно` : "",
    year ? `аниме ${year} смотреть онлайн` : "",
    year ? `аниме ${year} года` : "",
    genre && year ? `аниме ${genre} ${year}` : "",
    "смотреть аниме",
    "аниме онлайн",
    "каталог аниме",
    "аниме бесплатно",
    "смотреть бесплатно аниме",
    "аниме в хорошем качестве",
    "аниме с русской озвучкой",
    "weebx",
    "weeb-x",
    "weebx каталог",
  ].filter(Boolean)

  // Формируем правильный Canonical URL без мусорных сервисных параметров
  const canonicalUrl = "https://weeb-x.com/catalog"

  return {
    title,
    description,
    keywords: dynamicKeywords,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title,
      description,
      type: "website",
      url: canonicalUrl,
      siteName: "Weebx",
      locale: "ru_RU",
      images: [{ url: "https://weeb-x.com/og-image.png", width: 1200, height: 630, alt: "Weebx — каталог аниме" }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
    robots: {
      index: true, // Разрешаем индексировать страницы фильтров для привлечения поискового трафика!
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-snippet": -1,
        "max-image-preview": "large",
      },
    },
  }
}

export default async function CatalogPage({ searchParams }: CatalogPageProps) {
  const params = await searchParams
  
  // Извлекаем параметры и приводим их к строкам или массивам
  const genre = typeof params.genre === 'string' 
    ? (params.genre.includes(',') ? params.genre.split(',') : params.genre) 
    : undefined
  const sort = typeof params.sort === 'string' ? params.sort : undefined
  const status = typeof params.status === 'string' ? params.status : undefined
  const kind = typeof params.kind === 'string' ? params.kind : undefined
  const year = typeof params.year === 'string' 
    ? (params.year.includes(',') ? params.year.split(',') : params.year) 
    : undefined
  const score = typeof params.score === 'string' ? params.score : undefined
  const search = typeof params.search === 'string' ? params.search : undefined

  // Получаем настройку пользователя
  const profile = await getUserProfile()
  const allowNsfw = profile?.allow_nsfw_search || false

  // Формируем начальные фильтры
  const initialFilters: CatalogFilters = {
    page: 1,
    limit: 24,
    order: sort || 'popularity',
    genre,
    status,
    kind,
    year,
    score,
    search,
    allowNsfw,
    enableGenreFallback: false
  }

  // Создаем уникальный ключ для React при переходе по фильтрам
  const clientKey = JSON.stringify(initialFilters)

  // Schema.org разметка каталога (CollectionPage + BreadcrumbList)
  const collectionJsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "name": "Каталог аниме Weebx",
    "description": "Поиск и фильтрация аниме по жанрам, годам и рейтингу.",
    "url": "https://weeb-x.com/catalog",
    "isPartOf": {
      "@type": "WebSite",
      "name": "Weebx",
      "url": "https://weeb-x.com"
    }
  }

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": "Главная",
        "item": "https://weeb-x.com"
      },
      {
        "@type": "ListItem",
        "position": 2,
        "name": "Каталог",
        "item": "https://weeb-x.com/catalog"
      }
    ]
  }

  return (
    <main className="min-h-screen bg-background text-foreground pb-20 md:pb-24 relative">
      {/* Schema.org Микроразметка для поисковиков */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      {/* Dot Pattern Background */}
      <div className="absolute inset-0 z-0 pointer-events-none opacity-[0.07]">
        <div className="absolute inset-0 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:20px_20px]" />
      </div>

      <Navbar />
      <div className="pt-0 relative z-10">
        <CatalogPageWrapper key={clientKey} initialFilters={initialFilters} />
      </div>
      <ScrollToTop />
      <Footer />
    </main>
  )
}