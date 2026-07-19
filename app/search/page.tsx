import { Navbar } from "@/components/layout/navbar"
import { AnimeCard } from "@/components/shared/anime-card"
import { searchAnime, Anime } from "@/lib/shikimori"
import { SearchX } from "lucide-react"
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { ScrollToTop } from "@/components/layout/scroll-to-top"
import type { Metadata } from "next"
import { BreadcrumbStructuredData } from "@/components/seo/structured-data"

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

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ q: string }> }): Promise<Metadata> {
  const { q } = await searchParams
  const query = q || ""

  if (query) {
    const title = `Найти аниме «${query}» — смотреть онлайн | Weebx`
    const description = `Результаты поиска аниме по запросу «${query}». Смотри онлайн в HD с русской озвучкой на Weebx. Новинки, онгоинги, сериалы — всё в одном месте.`
    return {
      title,
      description,
      alternates: {
        canonical: `https://weeb-x.com/search?q=${encodeURIComponent(query)}`,
      },
      openGraph: {
        title,
        description,
        type: "website",
        url: `https://weeb-x.com/search?q=${encodeURIComponent(query)}`,
        siteName: "Weebx",
        locale: "ru_RU",
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
      },
    }
  }

  return {
    title: "Найти аниме — смотреть новинки и онгоинги онлайн | Weebx",
    description: "Ищи аниме сериалы на Weebx: новинки текущего года, онгоинги, что посмотреть на ночь. Следи за выходом новых серий, смотри онлайн в HD с русской озвучкой.",
    keywords: [
      "найти аниме",
      "смотреть аниме",
      "новинки аниме",
      "онгоинги аниме",
      "аниме сериалы",
      "что посмотреть аниме",
      "аниме на ночь",
      "аниме онлайн",
      "поиск аниме",
      "каталог аниме",
      "weebx поиск",
      "weeb x аниме",
      "следить за выходом аниме",
      "расписание аниме",
    ],
    alternates: {
      canonical: "https://weeb-x.com/search",
    },
    openGraph: {
      title: "Найти аниме — смотреть новинки и онгоинги онлайн | Weebx",
      description: "Ищи аниме сериалы на Weebx: новинки текущего года, онгоинги, что посмотреть на ночь. Следи за выходом новых серий, смотри онлайн в HD с русской озвучкой.",
      type: "website",
      url: "https://weeb-x.com/search",
      siteName: "Weebx",
      locale: "ru_RU",
    },
    twitter: {
      card: "summary_large_image",
      title: "Найти аниме — смотреть новинки и онгоинги онлайн | Weebx",
      description: "Ищи аниме сериалы: новинки, онгоинги, что посмотреть на ночь. Смотри онлайн в HD на Weebx.",
    },
  }
}

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q: string }> }) {
  const { q } = await searchParams
  const query = q || ""
  
  // Получаем настройку пользователя
  const profile = await getUserProfile()
  const allowNsfw = profile?.allow_nsfw_search || false
  
  // Делаем запрос к API
  const results: Anime[] = await searchAnime(query, allowNsfw, true)

  const pageTitle = query
    ? `Результаты поиска: "${query}"`
    : "Найти аниме — новинки, онгоинги, сериалы на ночь"

  return (
    <div className="min-h-screen bg-background text-foreground">
      <BreadcrumbStructuredData
        items={[
          { name: "Главная", url: "https://weeb-x.com" },
          { name: "Поиск аниме", url: "https://weeb-x.com/search" },
          ...(query ? [{ name: query, url: `https://weeb-x.com/search?q=${encodeURIComponent(query)}` }] : []),
        ]}
      />
      <Navbar />
      
      <div className="container mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
          {query ? (
            <>Результаты поиска: <span className="text-orange-500">"{query}"</span></>
          ) : (
            <>Найти аниме — <span className="text-orange-500">новинки, онгоинги, сериалы на ночь</span></>
          )}
        </h1>
        {!query && (
          <p className="text-muted-foreground mb-8 max-w-2xl">
            Ищи аниме сериалы по названию: новинки текущего года, онгоинги, что посмотреть на ночь.
            Следи за выходом новых серий и смотри онлайн в HD с русской озвучкой на Weebx.
          </p>
        )}
        {query && <div className="mb-8" />}

        {results.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
            {results.map((anime: Anime) => (
              <AnimeCard key={anime.id} anime={anime} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-zinc-500">
            <SearchX size={64} className="mb-4 opacity-50" />
            <p className="text-xl font-medium">Ничего не найдено</p>
            <p className="text-sm mt-2">Попробуйте изменить запрос или посмотри <a href="/catalog" className="text-orange-500 hover:underline">каталог аниме</a></p>
          </div>
        )}
      </div>

      <ScrollToTop />
    </div>
  )
}
