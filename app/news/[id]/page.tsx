import { getNewsById } from "@/lib/shikimori"
import { Navbar } from "@/components/layout/navbar"
import { Footer } from "@/components/layout/footer"
import { notFound } from "next/navigation"
import { Calendar, User, MessageSquare, Newspaper } from "lucide-react"
import type { Metadata } from "next"
import { BackButton } from "./back-button"

interface Props {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const news = await getNewsById(id)
  if (!news) return { title: "Новость не найдена — Weeb.X" }
  return {
    title: `${news.title} — Weeb.X`,
    description: news.excerpt.replace(/\[.*?\]/g, "").replace(/<[^>]+>/g, "").slice(0, 160),
    openGraph: {
      title: news.title,
      description: news.excerpt.replace(/\[.*?\]/g, "").replace(/<[^>]+>/g, "").slice(0, 160),
      images: news.imageUrl ? [{ url: news.imageUrl }] : [],
    },
  }
}

function sanitizeShikimoriHtml(html: string): string {
  return html
    .replace(/href="\/([^"]+)"/g, 'href="https://shikimori.one/$1" target="_blank" rel="noopener noreferrer"')
    .replace(/href="((?!https?:\/\/)(?!#)[^"]+)"/g, 'href="https://shikimori.one$1" target="_blank" rel="noopener noreferrer"')
    .replace(/src="\/([^"]+)"/g, 'src="https://shikimori.one/$1"')
    .replace(/src="((?!https?:\/\/)[^"]+)"/g, 'src="https://shikimori.one$1"')
    .replace(/\[.*?\]/g, "")
}

export default async function NewsItemPage({ params }: Props) {
  const { id } = await params
  const news = await getNewsById(id)

  if (!news) notFound()

  const bodyHtml = news.htmlBody ? sanitizeShikimoriHtml(news.htmlBody) : null
  const textBody = news.excerpt.replace(/\[.*?\]/g, "").replace(/<[^>]+>/g, "")

  return (
    <main className="min-h-screen bg-background text-foreground pb-20 md:pb-24 relative">
      <div className="absolute inset-0 z-0 pointer-events-none opacity-[0.07]">
        <div className="absolute inset-0 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:20px_20px]" />
      </div>

      <Navbar />

      <div className="container mx-auto px-4 pt-8 pb-12 relative z-10 max-w-4xl">
        <BackButton />

        <article className="bg-secondary/40 border rounded-2xl overflow-hidden dark:bg-zinc-900/60 dark:border-zinc-800">
          {news.imageUrl && (
            <div className="relative w-full h-56 sm:h-80 overflow-hidden bg-zinc-900">
              <img
                src={news.imageUrl}
                alt={news.title}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
            </div>
          )}

          <div className="p-5 sm:p-8">
            <div className="flex flex-wrap items-center gap-3 mb-4 text-xs sm:text-sm text-muted-foreground dark:text-zinc-500">
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                {news.date}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" />
                {news.author}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5" />
                {news.comments} комментариев
              </span>
              <span className="inline-flex items-center gap-1.5 ml-auto">
                <Newspaper className="w-3.5 h-3.5 text-blue-400" />
                <span className="text-blue-400 font-medium">Новость</span>
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold text-foreground dark:text-white leading-tight mb-6">
              {news.title}
            </h1>

            {bodyHtml ? (
              <div
                className="shikimori-news-body prose prose-invert max-w-none"
                dangerouslySetInnerHTML={{ __html: bodyHtml }}
              />
            ) : (
              <p className="text-muted-foreground leading-relaxed dark:text-zinc-300">
                {textBody}
              </p>
            )}
          </div>
        </article>
      </div>

      <Footer />
    </main>
  )
}
