import { MetadataRoute } from 'next'
import {
  getPopularNow,
  getPopularAlways,
  getOngoingList,
  getTopOfWeek,
  getAnnouncements,
  getForumNewsPaginated,
} from '@/lib/shikimori'
import { BASE_URL } from '@/lib/shikimori/config'
import { shikimoriJson } from '@/lib/shikimori/client'

// Sitemap пересчитывается раз в 6 часов — lastModified стабилен внутри окна кэша
export const revalidate = 21600

const SITE_URL = 'https://weeb-x.com'

// Стабильная дата для статичных страниц (дата последнего обновления контента)
const STATIC_PAGES_DATE = new Date('2026-07-01')

// Текущая дата — для динамических страниц (фиксируется кэшем revalidate)
const NOW = new Date()

interface ShikimoriMangaListItem {
  id: number
  name: string
  russian: string
  kind: string
  score: string
  status: string
  aired_on?: string
}

async function getPopularMangaIds(limit = 100): Promise<ShikimoriMangaListItem[]> {
  try {
    const data = await shikimoriJson<ShikimoriMangaListItem[]>(
      `${BASE_URL}/mangas?limit=${limit}&order=popularity&censored=true`,
      { next: { revalidate: 21600 } },
      { fallback: [] }
    )
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

async function getNewsIds(): Promise<string[]> {
  const ids: string[] = []
  const seen = new Set<string>()

  // Загружаем первые 5 страниц новостей (только Shikimori — Jikan слишком нестабилен для сборки)
  for (let page = 1; page <= 5; page++) {
    try {
      const items = await getForumNewsPaginated(page, 12)
      for (const item of items) {
        if (!seen.has(item.id)) {
          seen.add(item.id)
          ids.push(item.id)
        }
      }
      if (items.length < 12) break
    } catch {
      break
    }
  }

  return ids
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      lastModified: NOW,
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${SITE_URL}/catalog`,
      lastModified: NOW,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/gacha`,
      lastModified: STATIC_PAGES_DATE,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/manga`,
      lastModified: NOW,
      changeFrequency: 'daily',
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/battle`,
      lastModified: STATIC_PAGES_DATE,
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/schedule`,
      lastModified: NOW,
      changeFrequency: 'daily',
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/news`,
      lastModified: NOW,
      changeFrequency: 'daily',
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/beginners`,
      lastModified: STATIC_PAGES_DATE,
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${SITE_URL}/faq`,
      lastModified: STATIC_PAGES_DATE,
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${SITE_URL}/help`,
      lastModified: STATIC_PAGES_DATE,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${SITE_URL}/pvp`,
      lastModified: STATIC_PAGES_DATE,
      changeFrequency: 'weekly',
      priority: 0.5,
    },
    {
      url: `${SITE_URL}/easter-eggs`,
      lastModified: STATIC_PAGES_DATE,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${SITE_URL}/contacts`,
      lastModified: STATIC_PAGES_DATE,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${SITE_URL}/terms`,
      lastModified: STATIC_PAGES_DATE,
      changeFrequency: 'yearly',
      priority: 0.2,
    },
    {
      url: `${SITE_URL}/dmca`,
      lastModified: STATIC_PAGES_DATE,
      changeFrequency: 'yearly',
      priority: 0.2,
    },
  ]

  try {
    // Параллельно загружаем все динамические данные
    const [popularNow, popularAlways, ongoing, topOfWeek, announcements, mangaList, newsIds] = await Promise.all([
      getPopularNow(50),
      getPopularAlways(50),
      getOngoingList(50),
      getTopOfWeek(50),
      getAnnouncements(50),
      getPopularMangaIds(100),
      getNewsIds(),
    ])

    // --- Страницы аниме ---
    const seenAnimeIds = new Set<string>()
    const animePages: MetadataRoute.Sitemap = []

    for (const anime of [...popularNow, ...popularAlways, ...ongoing, ...topOfWeek, ...announcements]) {
      if (!anime?.id || seenAnimeIds.has(anime.id)) continue
      seenAnimeIds.add(anime.id)

      const lastMod = anime.airedOn ? new Date(anime.airedOn) : NOW
      // Для онгоингов — чаще обновляется, для вышедших — реже
      const isOngoing = anime.status === 'ongoing'
      const images = anime.poster ? [anime.poster] : undefined

      animePages.push({
        url: `${SITE_URL}/watch/${anime.id}`,
        lastModified: isOngoing ? NOW : lastMod,
        changeFrequency: isOngoing ? 'daily' : 'weekly',
        priority: isOngoing ? 0.8 : 0.6,
        images,
      })
    }

    // --- Страницы манги ---
    const mangaPages: MetadataRoute.Sitemap = mangaList
      .filter((m) => m.id)
      .map((manga) => ({
        url: `${SITE_URL}/manga/${manga.id}`,
        lastModified: manga.aired_on ? new Date(manga.aired_on) : STATIC_PAGES_DATE,
        changeFrequency: 'weekly' as const,
        priority: 0.5,
      }))

    // --- Страницы новостей ---
    const newsPages: MetadataRoute.Sitemap = newsIds.map((id) => ({
      url: `${SITE_URL}/news/${id}`,
      lastModified: NOW,
      changeFrequency: 'monthly' as const,
      priority: 0.4,
    }))

    return [...staticPages, ...animePages, ...mangaPages, ...newsPages]
  } catch (error) {
    console.error('[sitemap] Error generating dynamic pages:', error)
    return staticPages
  }
}
