import { safeSerializeJson } from "@/lib/seo/safe-json"
import { getNewsPath } from "@/lib/seo/news-url"
import { stripHtml } from "@/lib/news/text"
import type { NewsFeedItem } from "@/lib/news/types"

interface StructuredDataProps {
  type:
    | 'organization'
    | 'website'
    | 'breadcrumb'
    | 'faq'
    | 'video'
    | 'webapp'
    | 'collection'
    | 'news'
  data: Record<string, any>
}

export function StructuredData({ type, data }: StructuredDataProps) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: safeSerializeJson(data) }}
    />
  )
}

export function OrganizationStructuredData() {
  const organizationData: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': 'https://weeb-x.com/#organization',
    name: 'Weebx',
    alternateName: ['Weeb-X', 'weeb x', 'WeebX', 'weeb-x', 'weeb-x.com', 'weebx.com', 'Weeb X', 'WEEB-X', 'Weeb.X'],
    url: 'https://weeb-x.com',
    logo: 'https://weeb-x.com/icon.svg',
    description: 'Аниме-стриминговая платформа с гача-крутками и PvP-ареной',
    email: 'support@weeb-x.com',
    contactPoint: [
      {
        '@type': 'ContactPoint',
        contactType: 'customer support',
        email: 'support@weeb-x.com',
        availableLanguage: ['Russian'],
      },
      {
        '@type': 'ContactPoint',
        contactType: 'legal',
        email: 'dmca@weeb-x.com',
        availableLanguage: ['Russian', 'English'],
      },
    ],
    sameAs: [
      'https://t.me/Weebix',
      'https://vk.ru/WeebX_official',
      'https://www.youtube.com/@WeebX_official',
      'https://www.instagram.com/weebx_official/',
      'https://www.tiktok.com/@weebx_official',
    ],
  }

  return <StructuredData type="organization" data={organizationData} />
}

export function WebSiteStructuredData() {
  const websiteData: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': 'https://weeb-x.com/#website',
    name: 'Weebx',
    alternateName: ['Weeb-X', 'weeb x', 'WeebX', 'weeb-x', 'weeb-x.com', 'weebx.com', 'Weeb X', 'WEEB-X', 'Weeb.X'],
    url: 'https://weeb-x.com',
    description: 'Аниме-стриминговая платформа с гача-крутками и PvP-ареной',
    inLanguage: 'ru-RU',
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: 'https://weeb-x.com/catalog?search={search_term_string}',
      },
      'query-input': 'required name=search_term_string',
    },
  }

  return <StructuredData type="website" data={websiteData} />
}

interface BreadcrumbItem {
  name: string
  url: string
}

export function BreadcrumbStructuredData({ items }: { items: BreadcrumbItem[] }) {
  const breadcrumbData: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  }

  return <StructuredData type="breadcrumb" data={breadcrumbData} />
}

interface FAQItem {
  question: string
  answer: string
}

export function FAQStructuredData({ items }: { items: FAQItem[] }) {
  const faqData: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  }

  return <StructuredData type="faq" data={faqData} />
}

interface VideoObjectData {
  name: string
  description?: string
  thumbnailUrl?: string
  uploadDate?: string
  contentUrl: string
  duration?: string
  genre?: string[]
  rating?: number
  episodeNumber?: number
}

export function VideoObjectStructuredData(data: VideoObjectData) {
  const videoData: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: data.name,
    contentUrl: data.contentUrl,
    uploadDate: data.uploadDate || new Date().toISOString(),
  }

  if (data.description) videoData.description = data.description
  if (data.thumbnailUrl) videoData.thumbnailUrl = data.thumbnailUrl
  if (data.duration) videoData.duration = data.duration
  if (data.genre && data.genre.length) videoData.genre = data.genre
  if (data.rating) videoData.ratingValue = data.rating
  if (data.episodeNumber) {
    videoData['@type'] = ['VideoObject', 'TVEpisode']
    videoData.episodeNumber = data.episodeNumber
  }

  return <StructuredData type="video" data={videoData} />
}

interface WebApplicationData {
  name: string
  url: string
  description?: string
  applicationCategory?: string
  operatingSystem?: string
  offers?: string
}

export function WebApplicationStructuredData(data: WebApplicationData) {
  const appData: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: data.name,
    url: data.url,
    applicationCategory: data.applicationCategory || 'Game',
    operatingSystem: data.operatingSystem || 'Any',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'RUB',
    },
  }

  if (data.description) appData.description = data.description

  return <StructuredData type="webapp" data={appData} />
}

interface CollectionPageData {
  name: string
  description?: string
  url: string
  items: NewsFeedItem[]
}

/**
 * Разметка страницы-списка новостей.
 *
 * CollectionPage + ItemList описывают ленту как набор материалов, а не как
 * «страницу с картинками»: поисковик понимает, что это регулярно обновляемый
 * список новостей, и видит ссылки на каждую карточку.
 */
export function CollectionPageStructuredData({ name, description, url, items }: CollectionPageData) {
  const data: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name,
    url,
    inLanguage: 'ru-RU',
    ...(description ? { description } : {}),
    isPartOf: {
      '@type': 'WebSite',
      '@id': 'https://weeb-x.com/#website',
      name: 'Weebx',
      url: 'https://weeb-x.com',
    },
    mainEntity: {
      '@type': 'ItemList',
      name: 'Последние новости аниме',
      numberOfItems: items.length,
      itemListOrder: 'https://schema.org/ItemListOrderDescending',
      itemListElement: items.map((item, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        url: `https://weeb-x.com${getNewsPath(item.id, item.title)}`,
        name: stripHtml(item.title),
      })),
    },
  }

  return <StructuredData type="collection" data={data} />
}

interface NewsArticleSchemaData {
  headline: string
  description?: string
  image: string[]
  datePublished: string
  dateModified: string
  authorName: string
  authorType?: 'Person' | 'Organization'
  section?: string
  keywords?: string[]
  url: string
  inLanguage?: string
}

/**
 * NewsArticle для страницы новости.
 *
 * До этого на /news/[id] была только BreadcrumbList. NewsArticle даёт
 * поисковикам дату публикации, автора, обложку и раздел — это то, что нужно
 * для расширенных сниппетов и для попадания в «Новости» Google.
 */
export function NewsArticleStructuredData(data: NewsArticleSchemaData) {
  const article: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: data.headline,
    ...(data.description ? { description: data.description } : {}),
    image: data.image,
    datePublished: data.datePublished,
    dateModified: data.dateModified,
    author: {
      '@type': data.authorType ?? 'Person',
      name: data.authorName,
    },
    publisher: {
      '@type': 'Organization',
      '@id': 'https://weeb-x.com/#organization',
      name: 'Weebx',
      url: 'https://weeb-x.com',
      logo: {
        '@type': 'ImageObject',
        url: 'https://weeb-x.com/icon.svg',
      },
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': data.url,
    },
    url: data.url,
    inLanguage: data.inLanguage ?? 'ru-RU',
    isAccessibleForFree: true,
    ...(data.section ? { articleSection: data.section } : {}),
    ...(data.keywords && data.keywords.length > 0 ? { keywords: data.keywords } : {}),
  }

  return <StructuredData type="news" data={article} />
}
