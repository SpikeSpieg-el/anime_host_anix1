"use client"

import { useTVMode } from '@/hooks/use-tv-mode'
import { TVWatchPage } from '@/components/tv/tv-watch-page'
import { Navbar } from '@/components/layout/navbar'
import { Footer } from '@/components/layout/footer'
import { WatchPageClient } from './watch-page-client'
import { WatchOrderSection } from './watch-order-section'
import { CoverProvider } from '@/components/providers/cover-provider'
import type { Anime, FranchiseItem } from '@/lib/shikimori'
import { PlayCircle, Tv, Film, Calendar, Star, Users, Info, Sparkles } from 'lucide-react'

function getEpisodeText(count: number): string {
  if (count === 1) return "Серия"
  const lastDigit = count % 10
  const lastTwoDigits = count % 100
  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) return "Серий"
  if (lastDigit === 1) return "Серия"
  if (lastDigit >= 2 && lastDigit <= 4) return "Серии"
  return "Серий"
}

function getStatusLabel(status?: string): string {
  switch (status) {
    case 'ongoing': return 'Онгоинг'
    case 'released': return 'Вышел'
    case 'anons': return 'Анонс'
    default: return ''
  }
}

function getKindLabel(kind?: string): string {
  switch (kind) {
    case 'tv': return 'TV Сериал'
    case 'movie': return 'Фильм'
    case 'ova': return 'OVA'
    case 'ona': return 'ONA'
    case 'special': return 'Спешл'
    case 'music': return 'Клип'
    default: return ''
  }
}

export interface EditorialReview {
  id: string
  anime_id: string
  content: string
  author: string
  created_at: string
  updated_at: string
}

interface WatchPageLayoutWrapperProps {
  anime: Anime & {
    russian?: string
    english?: string
    japanese?: string
    kind?: string
    score?: string | number
    originalTitle?: string
  }
  initialEpisode?: number
  watchOrder: FranchiseItem[]
  editorialReview?: EditorialReview | null
}
// Парсер встроенного Markdown (жирный **, курсив *, код `)
function parseInlineMarkdown(text: string) {
  const parts = text.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`)/g)
  
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i} className="font-bold text-foreground">{part.slice(2, -2)}</strong>
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return <em key={i} className="italic text-foreground/90">{part.slice(1, -1)}</em>
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={i} className="px-2 py-0.5 mx-0.5 rounded-md bg-primary/15 text-primary text-xs font-mono font-semibold border border-primary/25">
          {part.slice(1, -1)}
        </code>
      )
    }
    return part
  })
}

// Построчный Markdown-парсер для идеального отображения статей редакции
export function FormattedEditorialContent({ content }: { content: string }) {
  if (!content) return null

  const rawLines = content.split("\n")
  const elements: React.ReactNode[] = []
  let i = 0

  while (i < rawLines.length) {
    const line = rawLines[i].trim()

    // Пропуск пустых строк
    if (!line) {
      i++
      continue
    }

    // 1. Блок Вердикта (содержит "Вердикт:" или "### Вердикт")
    if (line.toLowerCase().startsWith("вердикт") || line.toLowerCase().startsWith("### вердикт")) {
      const colonIndex = line.indexOf(":")
      const title = colonIndex !== -1 ? line.slice(0, colonIndex + 1).replace(/^#+\s*/, "") : "Вердикт редакции:"
      const verdictLines: string[] = []

      if (colonIndex !== -1 && line.slice(colonIndex + 1).trim()) {
        verdictLines.push(line.slice(colonIndex + 1).trim())
      }

      i++
      while (
        i < rawLines.length &&
        rawLines[i].trim() !== "" &&
        !rawLines[i].trim().startsWith("#") &&
        !rawLines[i].trim().startsWith("-")
      ) {
        verdictLines.push(rawLines[i].trim())
        i++
      }

      // Проверяем последнюю строчку — если это оценка (например "3 пустых призраков из 10" или "8/10")
      const lastLine = verdictLines.length > 0 ? verdictLines[verdictLines.length - 1] : ""
      const isScoreLine = /\d+\s*(из|\/)\s*\d+|^\d+\s+пустых|оценка/i.test(lastLine)

      const mainTextLines = isScoreLine ? verdictLines.slice(0, -1) : verdictLines
      const scoreText = isScoreLine ? lastLine : null

      elements.push(
        <div
          key={elements.length}
          className="mt-8 p-5 sm:p-6 rounded-2xl bg-gradient-to-r from-primary/20 via-primary/10 to-card/60 border border-primary/40 text-foreground shadow-xl relative overflow-hidden"
        >
          <div className="flex items-center gap-2 text-primary font-extrabold text-xs uppercase tracking-wider mb-3">
            <span className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />
            {title}
          </div>

          <div className="space-y-2 text-foreground/95 text-sm sm:text-base leading-relaxed">
            {mainTextLines.map((l, idx) => (
              <p key={idx}>{parseInlineMarkdown(l)}</p>
            ))}
          </div>

          {scoreText && (
            <div className="mt-4 pt-3 border-t border-primary/20 flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-primary/20 border border-primary/40 text-primary font-bold text-sm sm:text-base shadow-sm">
                <span>⭐</span> {parseInlineMarkdown(scoreText)}
              </span>
            </div>
          )}
        </div>
      )
      continue
    }

    // 2. Заголовки (# , ## , ### )
    if (line.startsWith("#")) {
      const level = line.match(/^#+/)?.[0].length || 1
      const text = line.replace(/^#+\s*/, "")

      if (level === 1) {
        elements.push(
          <h1 key={elements.length} className="text-2xl sm:text-3xl font-black text-foreground tracking-tight leading-snug mt-2 mb-4 bg-gradient-to-r from-foreground via-foreground to-primary bg-clip-text text-transparent">
            {parseInlineMarkdown(text)}
          </h1>
        )
      } else if (level === 2) {
        elements.push(
          <h2 key={elements.length} className="text-lg sm:text-2xl font-bold text-foreground mt-8 mb-3 pb-2 border-b border-border/50 flex items-center gap-2">
            <span className="w-2 h-5 bg-primary rounded-full shrink-0" />
            {parseInlineMarkdown(text)}
          </h2>
        )
      } else {
        elements.push(
          <h3 key={elements.length} className="text-base sm:text-lg font-bold text-foreground mt-6 mb-2 flex items-center gap-2 text-primary/90">
            <span className="text-primary">✦</span>
            {parseInlineMarkdown(text)}
          </h3>
        )
      }
      i++
      continue
    }

    // 3. Маркированный список (- Пункт или * Пункт)
    if (/^\s*[-*+]\s+/.test(line)) {
      const listItems: string[] = []
      while (i < rawLines.length && /^\s*[-*+]\s+/.test(rawLines[i])) {
        listItems.push(rawLines[i].replace(/^\s*[-*+]\s+/, ""))
        i++
      }

      elements.push(
        <ul key={elements.length} className="space-y-2.5 my-4 pl-1">
          {listItems.map((itemText, lIdx) => (
            <li key={lIdx} className="flex items-start gap-3 text-foreground/90">
              <span className="w-2 h-2 rounded-full bg-primary shrink-0 mt-2 shadow-sm shadow-primary/50" />
              <span className="leading-relaxed">{parseInlineMarkdown(itemText)}</span>
            </li>
          ))}
        </ul>
      )
      continue
    }

    // 4. Нумерованный список (1. Пункт)
    if (/^\s*\d+\.\s+/.test(line)) {
      const listItems: { num: string; text: string }[] = []
      while (i < rawLines.length && /^\s*\d+\.\s+/.test(rawLines[i])) {
        const num = rawLines[i].match(/^\s*(\d+)\.\s+/)?.[1] || `${listItems.length + 1}`
        const itemText = rawLines[i].replace(/^\s*\d+\.\s+/, "")
        listItems.push({ num, text: itemText })
        i++
      }

      elements.push(
        <ol key={elements.length} className="space-y-2.5 my-4 pl-1">
          {listItems.map((item, lIdx) => (
            <li key={lIdx} className="flex items-start gap-3 text-foreground/90">
              <span className="font-mono font-extrabold text-xs text-primary bg-primary/15 border border-primary/30 px-2.5 py-1 rounded-lg shrink-0 mt-0.5 shadow-sm">
                {item.num}
              </span>
              <span className="leading-relaxed">{parseInlineMarkdown(item.text)}</span>
            </li>
          ))}
        </ol>
      )
      continue
    }

    // 5. Цитаты (> Текст)
    if (line.startsWith(">")) {
      const quoteLines: string[] = []
      while (i < rawLines.length && rawLines[i].trim().startsWith(">")) {
        quoteLines.push(rawLines[i].trim().replace(/^>\s*/, ""))
        i++
      }

      elements.push(
        <blockquote
          key={elements.length}
          className="border-l-4 border-primary pl-4 py-3 my-6 italic text-muted-foreground text-sm sm:text-base bg-primary/5 rounded-r-2xl border-y border-r border-primary/10 shadow-inner"
        >
          {parseInlineMarkdown(quoteLines.join(" "))}
        </blockquote>
      )
      continue
    }

    // 6. Бэдж / Подзаголовок ("✦ Ироничный разбор...")
    if (elements.length <= 1 && (line.toLowerCase().includes("разбор") || line.toLowerCase().includes("эксклюзивный") || (line.length < 80 && !line.includes(".") && !line.includes(":")))) {
      elements.push(
        <div key={elements.length} className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-primary/15 border border-primary/30 text-primary text-xs font-semibold uppercase tracking-wider my-2 shadow-sm">
          {parseInlineMarkdown(line)}
        </div>
      )
      i++
      continue
    }

    // 7. Обычный абзац
    elements.push(
      <p key={elements.length} className="text-foreground/90 leading-relaxed my-2">
        {parseInlineMarkdown(line)}
      </p>
    )
    i++
  }

  return <div className="space-y-3 text-foreground/90 leading-relaxed text-sm sm:text-base">{elements}</div>
}

export function WatchPageLayoutWrapper({ 
  anime, 
  initialEpisode, 
  watchOrder,
  editorialReview 
}: WatchPageLayoutWrapperProps) {
  const { isTVMode, isLoading } = useTVMode()

  const statusLabel = getStatusLabel((anime as any).status)
  const kindLabel = getKindLabel(anime.kind)
  const episodesCurrent = anime.episodesCurrent || 0
  const episodesTotal = anime.episodesTotal || 0
  const score = typeof anime.score === 'number' ? anime.score.toFixed(2) : (anime.score?.toString() || '')

  const rawTitle = (anime as any).russian || anime.title || ''
  const animeTitle = rawTitle.replace(/\s*\(\d{4}\)$/, "").trim()
  const yearText = anime.year ? ` (${anime.year})` : ''

  const cleanDescription = anime.description 
    ? anime.description.replace(/\[.*?\]/g, "").replace(/<[^>]*>?/gm, "").trim()
    : null

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (isTVMode) {
    return <TVWatchPage anime={anime} initialEpisode={initialEpisode} />
  }

  // Грамотное формирование заголовка без дублирования слова "Редакция"
  const rawAuthor = editorialReview?.author || 'Weebx'
  const displayTitle = rawAuthor.toLowerCase().startsWith('редакция')
    ? rawAuthor
    : `Мнение редакции ${rawAuthor}`

  return (
    <main className="min-h-screen bg-background text-foreground pb-20 md:pb-24 relative">
      <div className="absolute inset-0 z-0 pointer-events-none opacity-[0.07]">
        <div className="absolute inset-0 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:20px_20px]" />
      </div>

      <Navbar />

      <div className="container mx-auto px-4 py-6 md:py-8 relative z-10 max-w-7xl">
        <WatchPageClient
          anime={anime}
          initialEpisode={initialEpisode}
        />

        <article 
          className="mt-8 p-5 md:p-7 rounded-2xl bg-card/30 border border-border/60 backdrop-blur-sm shadow-xl"
          itemScope 
          itemProp="about"
        >
          <header className="mb-5 border-b border-border/50 pb-4">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground mb-3 flex items-center gap-2" itemProp="name">
              <Info className="w-6 h-6 text-primary shrink-0" />
              {animeTitle}{yearText} — смотреть онлайн бесплатно в HD
            </h1>
            
            <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-muted-foreground">
              {kindLabel && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-secondary/80 border border-border/50 text-foreground font-medium">
                  {anime.kind === 'movie' ? <Film className="w-3.5 h-3.5 text-primary" /> : <Tv className="w-3.5 h-3.5 text-primary" />}
                  {kindLabel}
                </span>
              )}
              {statusLabel && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-secondary/80 border border-border/50 text-foreground font-medium">
                  <Calendar className="w-3.5 h-3.5 text-primary" />
                  {statusLabel}
                </span>
              )}
              {episodesTotal > 0 && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-secondary/80 border border-border/50 text-foreground font-medium">
                  <PlayCircle className="w-3.5 h-3.5 text-primary" />
                  {episodesCurrent}/{episodesTotal} {getEpisodeText(episodesTotal)}
                </span>
              )}
              {score && parseFloat(score) > 0 && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-secondary/80 border border-border/50 font-bold text-yellow-400">
                  <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
                  {score}
                </span>
              )}
            </div>
          </header>

          {cleanDescription && (
            <div className="mb-6" itemProp="description">
              <p className="text-muted-foreground leading-relaxed whitespace-pre-line text-base sm:text-lg">
                {cleanDescription}
              </p>
            </div>
          )}

          {anime.genres && anime.genres.length > 0 && (
            <div className="mb-6">
              <h2 className="text-xs uppercase tracking-wider font-bold text-foreground mb-3 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-primary" />
                Жанры:
              </h2>
              <ul className="flex flex-wrap gap-2">
                {anime.genres.map((genre) => (
                  <li key={genre}>
                    <a 
                      href={`/catalog?genre=${encodeURIComponent(genre)}`}
                      className="inline-block px-3.5 py-1.5 rounded-full bg-secondary/60 border border-border/80 text-muted-foreground hover:text-primary hover:border-primary/40 text-xs sm:text-sm font-medium transition-all"
                    >
                      {genre}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="pt-4 border-t border-border/50">
            <p className="text-xs sm:text-sm text-muted-foreground/80 leading-relaxed">
              <strong className="text-foreground">{animeTitle}{yearText}</strong> — смотреть аниме онлайн бесплатно в хорошем качестве HD на сайте Weebx. 
              Все серии с русской озвучкой и субтитрами доступны без регистрации.
              {(anime as any).originalTitle && (anime as any).originalTitle !== animeTitle ? ` Оригинальное название: ${(anime as any).originalTitle.replace(/\s*\(\d{4}\)$/, "")}.` : ''}
              {(anime as any).english && (anime as any).english !== animeTitle ? ` Английское название: ${(anime as any).english.replace(/\s*\(\d{4}\)$/, "")}.` : ''}
            </p>
          </div>
        </article>

        {/* МНЕНИЕ РЕДАКЦИИ WEEBX */}
        {editorialReview && (
          <section className="mt-8 p-5 md:p-8 rounded-2xl bg-gradient-to-br from-primary/10 via-card/50 to-card/30 border border-primary/30 backdrop-blur-md shadow-2xl relative overflow-hidden">
            <div className="flex items-center gap-3 mb-6 border-b border-primary/20 pb-4">
              <div className="w-10 h-10 rounded-xl bg-primary/20 border border-primary/40 flex items-center justify-center text-primary shrink-0 shadow-inner">
                <Sparkles className="w-5 h-5 text-primary" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg sm:text-xl font-bold text-foreground">
                    {displayTitle}
                  </h2>
                  <span className="text-[11px] bg-primary/20 text-primary px-2.5 py-0.5 rounded-full border border-primary/30 font-medium hidden sm:inline-block">
                    Официальный обзор
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Опубликовано: {new Date(editorialReview.updated_at || editorialReview.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              </div>
            </div>

            <FormattedEditorialContent content={editorialReview.content} />
          </section>
        )}

        <CoverProvider>
          <WatchOrderSection watchOrder={watchOrder} />
        </CoverProvider>
      </div>

      <Footer />
    </main>
  )
}