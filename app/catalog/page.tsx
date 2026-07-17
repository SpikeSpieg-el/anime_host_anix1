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

  let title = "Weeb-X — Смотреть аниме онлайн бесплатно. Топ тайтлы на русском"
  let description = "Смотри тысячи аниме онлайн в HD с русской озвучкой. Удобный каталог по жанрам, топ года и расписание новых серий. Бесплатно на Weeb-X!"

  if (search) {
    title = `Поиск: ${search} — Weeb-X`
    description = `Результаты поиска по запросу "${search}". Найдите лучшие аниме по вашему запросу в высоком качестве.`
  } else if (genre) {
    title = `${genre} — Каталог аниме — Weeb-X`
    description = `Смотреть аниме в жанре ${genre} онлайн. Большой выбор аниме в жанре ${genre} в высоком качестве.`
  } else if (year) {
    title = `${year} — Каталог аниме — Weeb-X`
    description = `Аниме ${year} года. Смотрите лучшие аниме ${year} года онлайн в высоком качестве.`
  }

  return {
    title,
    description,
    keywords: [
      "смотреть аниме",
      "аниме онлайн",
      "каталог аниме",
      "аниме бесплатно",
      "смотреть бесплатно аниме",
      "аниме онлайн бесплатно",
      "смотреть аниме без регистрации",
      "аниме по жанрам",
      "аниме жанры",
      "топ аниме",
      "популярное аниме",
      "новинки аниме",
      "лучшее аниме",
      "аниме в hd",
      "аниме на русском",
      "аниме с русской озвучкой",
      "аниме сериалы",
      "аниме фильмы",
      "полнометражные аниме",
      "онгоинги",
      "аниме сезон",
      "аниме все серии",
      "аниме 2026",
      "аниме 2025",
      "поиск аниме",
      "найти аниме",
      "сортировка аниме",
      "фильтры аниме",
      "аниме подборки",
      "аниме рейтинг",
      "anime online",
      "watch anime",
      "weebx",
      "weeb x",
      "WeebX",
      "Weeb-X",
      "weeb-x каталог",
      "weebx каталог",
      "weeb x аниме",
      "weebx аниме",
      "weeb x смотреть аниме",
      "weebx смотреть аниме",
      "weeb-x.com каталог",
    ],
    alternates: {
      canonical: `https://weeb-x.com/catalog${Object.keys(params).length > 0 ? '?' + new URLSearchParams(params as Record<string, string>).toString() : ''}`,
    },
    openGraph: {
      title,
      description,
      type: "website",
      url: `https://weeb-x.com/catalog${Object.keys(params).length > 0 ? '?' + new URLSearchParams(params as Record<string, string>).toString() : ''}`,
      siteName: "Weeb-X",
      locale: "ru_RU",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
    robots: {
      index: true,
      follow: true,
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

  // Создаем уникальный ключ, чтобы React пересоздавал компонент при смене фильтров
  // Это гарантирует, что данные обновятся при переходе по ссылкам
  const clientKey = JSON.stringify(initialFilters)

  return (
    <main className="min-h-screen bg-background text-foreground pb-20 md:pb-24 relative">
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