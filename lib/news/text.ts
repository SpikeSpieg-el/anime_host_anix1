import type { AggregatedNewsItem } from '@/lib/news/aggregator'
import type { NewsFeedItem } from '@/lib/news/types'

export function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
}

/** Убирает BBCode-остатки Shikimori и HTML-теги, оставляя читаемый текст. */
export function stripHtml(str: string | undefined | null): string {
  if (!str) return ''
  return decodeHtmlEntities(str.replace(/\[.*?\]/g, '').replace(/<[^>]+>/g, ''))
    .replace(/\s+/g, ' ')
    .trim()
}

/** Полный текст новости для метаданных и schema.org. */
export function cleanNewsText(str: string | undefined | null): string {
  return stripHtml(str)
}

/**
 * Отдаёт в клиент только то, что рисует карточка ленты.
 * Без htmlBody/htmlFooter/linkedAnime, иначе сериализация новостей в RSC-пейлоад
 * раздувается на десятки килобайт на каждую карточку.
 */
export function toFeedItem(item: AggregatedNewsItem): NewsFeedItem {
  return {
    id: item.id,
    title: item.title,
    excerpt: item.excerpt,
    imageUrl: item.imageUrl,
    date: item.date,
    dateTimestamp: item.dateTimestamp,
    author: item.author,
    url: item.url,
    source: item.source,
    animeTitle: item.animeTitle,
    animeImage: item.animeImage,
  }
}
