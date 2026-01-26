import { Navbar } from "@/components/navbar"
import { CatalogClient } from "@/components/catalog-client"
import { CatalogFilters } from "@/lib/shikimori"
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
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

  let title = "Каталог аниме — Weeb.X"
  let description = "Откройте для себя тысячи аниме в нашем каталоге. Фильтруйте по жанрам, годам, рейтингам и находите свои любимые аниме."

  if (search) {
    title = `Поиск: ${search} — Weeb.X`
    description = `Результаты поиска по запросу "${search}". Найдите лучшие аниме по вашему запросу в высоком качестве.`
  } else if (genre) {
    title = `${genre} — Каталог аниме — Weeb.X`
    description = `Смотреть аниме в жанре ${genre} онлайн. Большой выбор аниме в жанре ${genre} в высоком качестве.`
  } else if (year) {
    title = `${year} — Каталог аниме — Weeb.X`
    description = `Аниме ${year} года. Смотрите лучшие аниме ${year} года онлайн в высоком качестве.`
  }

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      url: `/catalog${Object.keys(params).length > 0 ? '?' + new URLSearchParams(params as Record<string, string>).toString() : ''}`,
      images: [
        {
          url: "/og-image.svg",
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
      siteName: "Weeb.X",
      locale: "ru_RU",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["/og-image.svg"],
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
    allowNsfw
  }

  // Создаем уникальный ключ, чтобы React пересоздавал компонент при смене фильтров
  // Это гарантирует, что данные обновятся при переходе по ссылкам
  const clientKey = JSON.stringify(initialFilters)

  return (
    <main className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-0"> {/* Убрал padding, так как Navbar sticky */}
        <CatalogClient key={clientKey} initialFilters={initialFilters} />
      </div>
    </main>
  )
}