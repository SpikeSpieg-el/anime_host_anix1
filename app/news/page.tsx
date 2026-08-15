import { getAggregatedNews } from "@/lib/news/aggregator"
import { Navbar } from "@/components/layout/navbar"
import { Footer } from "@/components/layout/footer"
import Link from "next/link"
import { Newspaper, ArrowLeft, Calendar, User, MessageSquare, ArrowRight, Globe } from "lucide-react"
import { getProxiedSrc } from "@/lib/image-loader"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Новости аниме — Weebx",
  description: "Последние новости мира аниме. Анонсы, релизы, события.",
  keywords: [
    "новости аниме",
    "аниме новости",
    "анонсы аниме",
    "релизы аниме",
    "аниме события",
    "аниме индустрия",
    "свежие новости аниме",
    "новости манги",
    "аниме блог",
    "аниме статьи",
    "аниме мир",
    "последние аниме",
    "аниме афиша",
    "аниме премьеры",
    "anime news",
    "weebx",
    "weeb x",
    "WeebX",
    "Weeb-X",
    "weeb-x новости",
    "weebx новости",
    "weeb x новости аниме",
    "weeb-x.com новости",
  ],
  alternates: {
    canonical: "https://weeb-x.com/news",
  },
  openGraph: {
    title: "Новости аниме — Weebx",
    description: "Последние новости мира аниме. Анонсы, релизы, события.",
    type: "website",
    url: "https://weeb-x.com/news",
    siteName: "Weebx",
    locale: "ru_RU",
    images: [{ url: "https://weeb-x.com/og-image.png", width: 1200, height: 630, alt: "Weebx — новости аниме" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Новости аниме — Weebx",
    description: "Последние новости мира аниме. Анонсы, релизы, события.",
  },
}

export default async function NewsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const params = await searchParams
  const page = Math.max(1, parseInt(params.page || "1", 10))
  const limit = 12
  const { items: news, hasNextPage } = await getAggregatedNews(page, limit)

  return (
    <main className="min-h-screen bg-background text-foreground pb-20 md:pb-24 relative">
      <div className="absolute inset-0 z-0 pointer-events-none opacity-[0.07]">
        <div className="absolute inset-0 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:20px_20px]" />
      </div>

      <Navbar />

      <div className="container mx-auto px-4 pt-8 pb-12 relative z-10">
        <div className="mb-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-4 py-2 bg-secondary hover:bg-accent border border-border hover:border-primary text-muted-foreground hover:text-foreground font-medium rounded-xl transition-all mb-4 dark:bg-zinc-800 dark:hover:bg-zinc-800 dark:border-zinc-800 dark:hover:border-blue-500 dark:text-zinc-400 dark:hover:text-white"
          >
            <ArrowLeft className="w-4 h-4" />
            На главную
          </Link>

          <div className="flex items-center gap-3">
            <Newspaper size={28} className="text-blue-400" />
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold text-foreground dark:text-white">
                Новости аниме
              </h1>
              <p className="text-muted-foreground mt-1 dark:text-zinc-500">
                Главные события мира аниме
              </p>
            </div>
          </div>
        </div>

        {news.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Newspaper size={64} className="text-muted-foreground/50 mb-4 dark:text-zinc-800" />
            <h2 className="text-xl font-bold text-muted-foreground mb-2 dark:text-zinc-400">
              Новости временно недоступны
            </h2>
            <p className="text-muted-foreground/70 dark:text-zinc-600">
              Попробуйте обновить страницу позже
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {news.map((item) => (
              <Link
                key={item.id}
                href={`/news/${item.id}`}
                className="group flex flex-col h-full bg-secondary/40 border rounded-xl sm:rounded-2xl overflow-hidden hover:border-blue-500/50 transition-all hover:bg-secondary active:scale-[0.98] sm:hover:-translate-y-1 hover:shadow-xl hover:shadow-black/50 dark:bg-zinc-900/40 dark:border-zinc-800 dark:hover:border-blue-500/50 dark:hover:bg-zinc-900"
              >
                {item.imageUrl && (
                  <div className="relative w-full h-44 overflow-hidden bg-zinc-900 flex-shrink-0">
                    <img
                      src={getProxiedSrc(item.imageUrl)}
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                  </div>
                )}

                <div className="flex flex-col flex-1 p-4 sm:p-5">
                  <div className="flex items-center gap-2 mb-2 sm:mb-3 flex-wrap">
                    <span className="inline-flex items-center gap-1 text-[10px] sm:text-xs font-medium text-muted-foreground bg-secondary/50 px-2 py-1 rounded-md dark:text-zinc-500 dark:bg-zinc-800/50">
                      <Calendar className="w-3 h-3" />
                      {item.date}
                    </span>
                    <span className={`inline-flex items-center gap-1 text-[10px] sm:text-xs font-medium px-2 py-1 rounded-md ${
                      item.source === 'custom'
                        ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20 dark:bg-purple-500/15 dark:text-purple-400'
                        : item.source === 'jikan'
                        ? 'bg-orange-500/10 text-orange-400 dark:bg-orange-500/15 dark:text-orange-400'
                        : 'bg-blue-500/10 text-blue-400 dark:bg-blue-500/15 dark:text-blue-400'
                    }`}>
                      <Globe className="w-3 h-3" />
                      {item.source === 'custom' ? 'Weebx' : item.source === 'jikan' ? 'MAL' : 'Shikimori'}
                    </span>
                  </div>

                  <h3 className="font-bold text-sm sm:text-base text-foreground leading-snug mb-2 group-hover:text-blue-400 transition-colors line-clamp-2 sm:line-clamp-3 dark:text-zinc-100">
                    {item.title}
                  </h3>

                  {item.animeTitle && (
                    <p className="text-[11px] sm:text-xs font-medium text-blue-400/80 mb-1.5 line-clamp-1">
                      {item.animeTitle}
                    </p>
                  )}

                  <p className="text-xs sm:text-sm text-muted-foreground line-clamp-3 mb-3 sm:mb-4 flex-1 leading-relaxed dark:text-zinc-400">
                    {item.excerpt.replace(/\[.*?\]/g, "").replace(/<[^>]+>/g, "")}
                  </p>

                  <div className="flex items-center justify-between pt-3 sm:pt-4 border-t mt-auto dark:border-white/5">
                    <div className="flex items-center gap-2 text-[10px] sm:text-xs text-muted-foreground dark:text-zinc-500">
                      <User className="w-3 h-3" />
                      <span className="truncate max-w-[100px]">{item.author}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5 text-[10px] sm:text-xs font-medium text-muted-foreground dark:text-zinc-400">
                        <MessageSquare className="w-3 h-3" />
                        <span>{item.comments}</span>
                      </div>
                      <span className="inline-flex items-center gap-1 text-[10px] sm:text-xs font-medium text-blue-400 group-hover:gap-2 transition-all">
                        Читать
                        <ArrowRight className="w-3 h-3" />
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {news.length > 0 && (
          <div className="flex items-center justify-center gap-3 mt-10">
            {page > 1 && (
              <Link
                href={`/news?page=${page - 1}`}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-secondary hover:bg-accent border border-border hover:border-blue-500/50 text-muted-foreground hover:text-foreground font-medium rounded-xl transition-all dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:border-zinc-700 dark:text-zinc-400 dark:hover:text-white"
              >
                <ArrowLeft className="w-4 h-4" />
                Назад
              </Link>
            )}
            <span className="text-sm text-muted-foreground dark:text-zinc-500 px-3">
              Страница {page}
            </span>
            {hasNextPage && (
              <Link
                href={`/news?page=${page + 1}`}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-secondary hover:bg-accent border border-border hover:border-blue-500/50 text-muted-foreground hover:text-foreground font-medium rounded-xl transition-all dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:border-zinc-700 dark:text-zinc-400 dark:hover:text-white"
              >
                Вперёд
                <ArrowRight className="w-4 h-4" />
              </Link>
            )}
          </div>
        )}
      </div>

      <Footer />
    </main>
  )
}
