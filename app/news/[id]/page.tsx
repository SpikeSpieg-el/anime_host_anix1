import { getAnimeById } from "@/lib/shikimori"
import { getAggregatedNewsById } from "@/lib/news/aggregator"
import { Navbar } from "@/components/layout/navbar"
import { Footer } from "@/components/layout/footer"
import { notFound } from "next/navigation"
import { Calendar, User, MessageSquare, Newspaper, ExternalLink, Globe } from "lucide-react"
import type { Metadata } from "next"
import { BackButton } from "./back-button"
import { LinkedAnimeCard } from "./linked-anime-card"
import { TranslateButton } from "./translate-button"
import { getProxiedSrc } from "@/lib/image-loader"
import type { LinkedAnime } from "@/lib/shikimori/types"

interface Props {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const news = await getAggregatedNewsById(id)
  if (!news) return { title: "Новость не найдена — Weebx" }
  const cleanDescription = news.excerpt.replace(/\[.*?\]/g, "").replace(/<[^>]+>/g, "").slice(0, 160)
  return {
    title: `${news.title} — Weebx`,
    description: cleanDescription,
    alternates: {
      canonical: `https://weeb-x.com/news/${id}`,
    },
    openGraph: {
      title: news.title,
      description: cleanDescription,
      url: `https://weeb-x.com/news/${id}`,
      type: "article",
      siteName: "Weebx",
      locale: "ru_RU",
      images: news.imageUrl ? [{ url: news.imageUrl }] : [],
    },
    twitter: {
      card: "summary_large_image",
      title: news.title,
      description: cleanDescription,
      images: news.imageUrl ? [news.imageUrl] : [],
    },
  }
}

interface AnimeLinkInfo {
  id: number
  name: string
  russian: string
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
}

function parseAnimeDataAttrs(html: string): AnimeLinkInfo[] {
  const result: AnimeLinkInfo[] = []
  const seen = new Set<number>()
  const regex = /data-attrs="([^"]+)"/g
  let match
  while ((match = regex.exec(html)) !== null) {
    try {
      const decoded = decodeHtmlEntities(match[1])
      const attrs = JSON.parse(decoded)
      if (attrs.type === 'anime' && attrs.id && !seen.has(attrs.id)) {
        seen.add(attrs.id)
        result.push({ id: attrs.id, name: attrs.name || '', russian: attrs.russian || '' })
      }
    } catch {}
  }
  return result
}

function sanitizeShikimoriHtml(html: string, animePosters: Map<number, string>): string {
  let result = html

  // 1. Replace anime links that have data-attrs with rich cards.
  // Also consume any quote characters («», "", '', etc.) directly wrapping the link,
  // since the result is rendered as a standalone card, not inline quoted text.
  result = result.replace(
    /[«»"“”'‘’]?<a([^>]*?)data-attrs="([^"]+)"([^>]*?)>([\s\S]*?)<\/a>[«»"“”'‘’]?/g,
    (fullMatch, _before, attrsRaw, _after, inner) => {
      try {
        const attrs = JSON.parse(decodeHtmlEntities(attrsRaw))
        if (attrs.type === 'anime' && attrs.id) {
          const id = attrs.id
          const nameEn = attrs.name || ''
          const nameRu = attrs.russian || ''
          const poster = animePosters.get(id)
          const posterHtml = poster
            ? `<img src="${getProxiedSrc(poster)}" alt="${nameRu || nameEn}" class="news-anime-poster" loading="lazy" />`
            : `<div class="news-anime-poster-placeholder"></div>`
          return `<a href="/watch/${id}" class="news-anime-card">${posterHtml}<span class="news-anime-titles"><span class="name-ru">${nameRu}</span><span class="name-en">${nameEn}</span></span></a>`
        }
        if (attrs.type === 'person' && attrs.id) {
          const name = attrs.russian || attrs.name || ''
          return `<a href="https://shikimori.one/people/${attrs.id}" target="_blank" rel="noopener noreferrer" class="news-person-badge">${name}</a>`
        }
        if (attrs.type === 'character' && attrs.id) {
          const name = attrs.russian || attrs.name || ''
          return `<a href="https://shikimori.one/characters/${attrs.id}" target="_blank" rel="noopener noreferrer" class="news-character-badge">${name}</a>`
        }
      } catch {}
      return fullMatch
    }
  )

  // 2. Convert remaining Shikimori anime links (without data-attrs) to internal routes
  result = result.replace(
    /href="https?:\/\/shikimori\.(one|me|org|io)\/animes\/([\w-]+)"/g,
    (_m, _domain, slug) => {
      const id = slug.split('-')[0]
      return `href="/watch/${id}"`
    }
  )
  result = result.replace(
    /href="\/animes\/([\w-]+)"/g,
    (_m, slug) => {
      const id = slug.split('-')[0]
      return `href="/watch/${id}"`
    }
  )

  // 3. Style studio links as badges
  result = result.replace(
    /<a([^>]*?)href="(?:https?:\/\/shikimori\.(?:one|me|org|io))?\/animes\/studio\/([^"]+)"([^>]*?)>([\s\S]*?)<\/a>/g,
    (_full, _before, studio, _after, inner) => {
      const name = inner.replace(/<[^>]+>/g, '').trim()
      return `<a href="https://shikimori.one/animes/studio/${studio}" target="_blank" rel="noopener noreferrer" class="news-studio-badge">${name}</a>`
    }
  )

  // 4. Convert Shikimori manga links to internal /manga/ID routes
  result = result.replace(
    /href="https?:\/\/shikimori\.(one|me|org|io)\/mangas\/([\w-]+)"/g,
    (_m, _domain, slug) => {
      const id = slug.split('-')[0]
      return `href="/manga/${id}"`
    }
  )
  result = result.replace(
    /href="\/mangas\/([\w-]+)"/g,
    (_m, slug) => {
      const id = slug.split('-')[0]
      return `href="/manga/${id}"`
    }
  )

  // 5. Convert other relative Shikimori links to absolute external
  result = result.replace(
    /href="\/((?!animes\/)(?!mangas\/)(?!news\/)[^"]+)"/g,
    'href="https://shikimori.one/$1" target="_blank" rel="noopener noreferrer"'
  )
  result = result.replace(
    /href="((?!https?:\/\/)(?!\/)(?!#)[^"]+)"/g,
    'href="https://shikimori.one$1" target="_blank" rel="noopener noreferrer"'
  )

  // 6. Fix remaining absolute shikimori links
  result = result.replace(
    /href="https?:\/\/shikimori\.(one|me|org|io)\/((?!animes\/)(?!mangas\/)[^"]+)"/g,
    'href="https://shikimori.one/$2" target="_blank" rel="noopener noreferrer"'
  )

  // 7. Convert relative image src to absolute shikimori URLs
  result = result.replace(/src="\/\//g, 'src="https://')
  result = result.replace(/src="([^"]*img\.youtube\.com[^"]*)"/g, (_m, url) => {
    return `src="${url.replace('img.youtube.com', 'i.ytimg.com')}"`
  })
  result = result.replace(/src="\/([^"]+)"/g, 'src="https://shikimori.one/$1"')
  result = result.replace(/src="((?!https?:\/\/)[^"]+)"/g, 'src="https://shikimori.one$1"')

  // 8. YouTube/Vimeo links stay as plain links (no embedded player)
  // Already handled by general link styling above

  // 9. Embed direct video file links as <video> tags
  result = result.replace(
    /<a[^>]*href="([^"]*\.(?:mp4|webm|ogg|mov)(?:\?[^"]*)?)"[^>]*>([^<]*)<\/a>/gi,
    (_fullMatch, url) => {
      return `<div class="news-video-embed"><video controls preload="metadata"><source src="${url}"></video></div>`
    }
  )

  // 10. Make all remaining external links open in new tab
  result = result.replace(
    /<a(?![^>]*target=)([^>]*href="https?:\/\/[^"]+")/g,
    '<a$1 target="_blank" rel="noopener noreferrer"'
  )

  // 11. Remove BBCode remnants
  result = result.replace(/\[.*?\]/g, "")

  return result
}

function sanitizeShikimoriFooter(html: string): string {
  let result = html

  // Fix protocol-relative URLs and replace img.youtube.com with i.ytimg.com (more reliable CDN)
  result = result.replace(/src="\/\//g, 'src="https://')
  result = result.replace(/src="([^"]*img\.youtube\.com[^"]*)"/g, (_m, url) => {
    return `src="${url.replace('img.youtube.com', 'i.ytimg.com')}"`
  })
  result = result.replace(/src="\/([^"]+)"/g, 'src="https://shikimori.one/$1"')
  result = result.replace(/href="\/([^"]+)"/g, 'href="https://shikimori.one/$1"')

  // Remove standalone YouTube thumbnail imgs
  result = result.replace(/<img[^>]*src="[^"]*(?:img\.youtube\.com|i\.ytimg\.com)[^"]*"[^>]*>/gi, '')

  // Convert .b-video blocks to plain video links (YouTube label only if actually YouTube)
  const isYoutubeUrl = (url: string) => /(?:youtube\.com|youtu\.be)/i.test(url)
  result = result.replace(
    /<div[^>]*class="[^"]*b-video[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
    (_fullMatch, inner) => {
      const dataHrefMatch = inner.match(/data-href="([^"]+)"/)
      if (dataHrefMatch) {
        const url = dataHrefMatch[1].replace(/&amp;/g, '&')
        return isYoutubeUrl(url)
          ? `<a href="${url}" target="_blank" rel="noopener noreferrer" class="news-youtube-link">▶ Смотреть на YouTube</a>`
          : `<a href="${url}" target="_blank" rel="noopener noreferrer" class="news-video-link">▶ Смотреть видео</a>`
      }
      const hrefMatch = inner.match(/href="([^"]+)"/)
      if (hrefMatch) {
        const url = hrefMatch[1].replace(/&amp;/g, '&')
        return isYoutubeUrl(url)
          ? `<a href="${url}" target="_blank" rel="noopener noreferrer" class="news-youtube-link">▶ Смотреть на YouTube</a>`
          : `<a href="${url}" target="_blank" rel="noopener noreferrer" class="news-video-link">▶ Смотреть видео</a>`
      }
      const rawYt = inner.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{11})/)
      if (rawYt) {
        return `<a href="https://www.youtube.com/watch?v=${rawYt[1]}" target="_blank" rel="noopener noreferrer" class="news-youtube-link">▶ Смотреть на YouTube</a>`
      }
      return ''
    }
  )

  // Convert .b-image links to simple image displays
  result = result.replace(
    /<a[^>]*class="[^"]*b-image[^"]*"[^>]*>([\s\S]*?)<\/a>/gi,
    (_full, inner) => {
      const imgMatch = inner.match(/<img[^>]+src="([^"]+)"[^>]*>/)
      if (imgMatch) {
        return `<img src="${getProxiedSrc(imgMatch[1])}" class="news-footer-image" loading="lazy" />`
      }
      return ''
    }
  )

  // Remove wrapper divs
  result = result.replace(/<div[^>]*class="[^"]*b-shiki_wall[^"]*"[^>]*>([\s\S]*?)<\/div>/gi, '$1')
  result = result.replace(/<div[^>]*class="[^"]*to-process[^"]*"[^>]*>([\s\S]*?)<\/div>/gi, '$1')

  // Remove .marker spans
  result = result.replace(/<span[^>]*class="[^"]*marker[^"]*"[^>]*>[\s\S]*?<\/span>/gi, '')

  // Clean up empty divs
  result = result.replace(/<div[^>]*>\s*<\/div>/gi, '')

  return result.trim()
}

function getLinkedAnimePoster(linked: LinkedAnime): string | undefined {
  if (!linked.image) return undefined
  const img = linked.image
  const path = img.x96 || img.preview || img.original
  if (!path || path.includes('missing')) return undefined
  if (path.startsWith('http')) return path
  return `https://shikimori.one${path}`
}

function getStatusLabel(status?: string): string {
  switch (status) {
    case 'ongoing': return 'Онгоинг'
    case 'released': return 'Вышло'
    case 'anons': return 'Анонс'
    default: return ''
  }
}

function getKindLabel(kind?: string): string {
  switch (kind) {
    case 'tv': return 'TV'
    case 'movie': return 'Фильм'
    case 'ova': return 'OVA'
    case 'ona': return 'ONA'
    case 'special': return 'Спешл'
    case 'music': return 'Клип'
    default: return ''
  }
}

export default async function NewsItemPage({ params }: Props) {
  const { id } = await params
  const news = await getAggregatedNewsById(id)

  if (!news) notFound()

  const isJikan = news.source === 'jikan'

  // Parse anime IDs from data-attrs in htmlBody to fetch posters (Shikimori only)
  const animeLinks = !isJikan && news.htmlBody ? parseAnimeDataAttrs(news.htmlBody) : []
  const animePosters = new Map<number, string>()

  // Also include linked anime if present
  if (news.linkedAnime) {
    const linkedPoster = getLinkedAnimePoster(news.linkedAnime)
    if (linkedPoster) {
      animePosters.set(news.linkedAnime.id, linkedPoster)
    }
    if (!animeLinks.find(a => a.id === news.linkedAnime!.id)) {
      animeLinks.push({ id: news.linkedAnime.id, name: news.linkedAnime.name, russian: news.linkedAnime.russian })
    }
  }

  // Fetch posters for anime mentioned in the news body
  await Promise.all(
    animeLinks.map(async (link) => {
      if (animePosters.has(link.id)) return
      try {
        const anime = await getAnimeById(String(link.id))
        if (anime?.poster) {
          animePosters.set(link.id, anime.poster)
        }
      } catch {}
    })
  )

  const bodyHtml = news.htmlBody ? (isJikan ? news.htmlBody : sanitizeShikimoriHtml(news.htmlBody, animePosters)) : null
  const footerHtml = news.htmlFooter ? sanitizeShikimoriFooter(news.htmlFooter) : null
  const textBody = news.excerpt.replace(/\[.*?\]/g, "").replace(/<[^>]+>/g, "")

  const linked = news.linkedAnime
  const linkedPoster = linked ? getLinkedAnimePoster(linked) : undefined
  const kindLabel = linked ? getKindLabel(linked.kind) : ''
  const statusLabel = linked ? getStatusLabel(linked.status) : ''

  const sourceLabel = isJikan ? 'MAL' : 'Shikimori'
  const sourceUrl = news.url

  return (
    <main className="min-h-screen bg-background text-foreground relative">
      <Navbar />

      {/* Hero header */}
      <div className="relative w-full h-[38vh] min-h-[260px] max-h-[460px] overflow-hidden bg-zinc-950">
        {news.imageUrl ? (
          <img
            src={getProxiedSrc(news.imageUrl)}
            alt={news.title}
            className="absolute inset-0 w-full h-full object-cover scale-105 blur-[1px]"
          />
        ) : (
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.18),transparent_60%)]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-background/20" />
        <div className="absolute inset-0 bg-gradient-to-r from-background/40 via-transparent to-background/40" />

        <div className="absolute inset-0 flex flex-col justify-end">
          <div className="container mx-auto px-4 pb-6 sm:pb-8 max-w-4xl">
            <div className="mb-4">
              <BackButton />
            </div>

            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className="news-pill news-pill-accent">
                <Newspaper className="w-3.5 h-3.5" />
                Новость
              </span>
              <span className={`news-pill ${isJikan ? 'text-orange-400' : 'text-blue-400'}`}>
                <Globe className="w-3.5 h-3.5" />
                {sourceLabel}
              </span>
              <span className="news-pill">
                <Calendar className="w-3.5 h-3.5" />
                {news.date}
              </span>
              <span className="news-pill">
                <User className="w-3.5 h-3.5" />
                {news.author}
              </span>
              <span className="news-pill">
                <MessageSquare className="w-3.5 h-3.5" />
                {news.comments}
              </span>
            </div>

            <h1 data-news-title className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white leading-tight drop-shadow-[0_2px_12px_rgba(0,0,0,0.6)]">
              {news.title}
            </h1>
            {isJikan && (
              <div className="mt-3">
                <TranslateButton title={news.title} excerpt={textBody} htmlBody={bodyHtml || undefined} />
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 pt-6 sm:pt-8 pb-16 sm:pb-20 relative z-10 max-w-4xl">
        <article className="news-article-card">
          {bodyHtml ? (
            <>
              <div
                className="shikimori-news-body prose prose-invert max-w-none"
                dangerouslySetInnerHTML={{ __html: bodyHtml }}
              />
              {footerHtml && (
                <div
                  className="shikimori-news-footer mt-6"
                  dangerouslySetInnerHTML={{ __html: footerHtml }}
                />
              )}

              {/* Linked anime card */}
              {linked && (
                <div className="mt-8">
                  <LinkedAnimeCard
                    id={linked.id}
                    name={linked.name}
                    russian={linked.russian}
                    poster={linkedPoster}
                    kindLabel={kindLabel}
                    statusLabel={statusLabel}
                    episodes={linked.episodes}
                    score={linked.score}
                  />
                </div>
              )}

              <div className="mt-8 pt-6 border-t border-border/50 dark:border-zinc-800">
                <a
                  href={sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="news-source-link"
                >
                  <ExternalLink className="w-4 h-4" />
                  Открыть на {sourceLabel}
                </a>
              </div>
            </>
          ) : (
            <>
              {/* Jikan news: show anime image + excerpt */}
              {isJikan && news.animeImage && (
                <div className="mb-6 flex justify-center">
                  <img
                    src={getProxiedSrc(news.animeImage)}
                    alt={news.animeTitle || news.title}
                    className="max-h-80 rounded-xl object-contain"
                    loading="lazy"
                  />
                </div>
              )}
              <p className="news-excerpt-text text-muted-foreground leading-relaxed dark:text-zinc-300">
                {textBody}
              </p>
              {linked && (
                <div className="mt-8">
                  <LinkedAnimeCard
                    id={linked.id}
                    name={linked.name}
                    russian={linked.russian}
                    poster={linkedPoster}
                    kindLabel={kindLabel}
                    statusLabel={statusLabel}
                    episodes={linked.episodes}
                    score={linked.score}
                  />
                </div>
              )}
              <div className="mt-8 pt-6 border-t border-border/50 dark:border-zinc-800">
                <a
                  href={sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="news-source-link"
                >
                  <ExternalLink className="w-4 h-4" />
                  Открыть на {sourceLabel}
                </a>
              </div>
            </>
          )}
        </article>
      </div>

      <Footer />
    </main>
  )
}
