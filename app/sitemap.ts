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
import { getWatchPath } from "@/lib/seo/watch-url"
import { clampLastmod, escapeXml, isSitemapSafeUrl } from '@/lib/seo/sitemap-utils'

// Sitemap пересчитывается раз в 6 часов — lastModified стабилен внутри окна кэша
export const revalidate = 21600

const SITE_URL = 'https://weeb-x.com'

// Стабильная дата для статичных страниц (дата последнего обновления контента)
const STATIC_PAGES_DATE = new Date('2026-07-01')

// Текущая дата — для динамических страниц (фиксируется кэшем revalidate)
const NOW = new Date()

/**
 * Блоки <image:image> временно выключены.
 *
 * 1. Яндекс-валидатор исторически ругается на Google-пространство имён
 *    sitemap-image («Неизвестный тег image:image» / «Ошибка разбора… 1 элемент
 *    с ошибками») и в этом случае не читает файл целиком — в Вебмастере
 *    «Количество выявленных страниц 0».
 * 2. 92 из 161 постера отдаются редиректом shikimori.one → shikimori.io,
 *    а для <image:loc> нужен прямой URL изображения.
 *
 * Постеры и так видны роботам: они отдаются тегами <img> на страницах
 * /watch/*. Если Яндекс начнёт стабильно принимать image-блоки, флаг можно
 * вернуть в true — код ниже уже валидирует URL.
 */
const INCLUDE_IMAGES = false

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
      url: `${SITE_URL}/search`,
      lastModified: STATIC_PAGES_DATE,
      changeFrequency: 'weekly',
      priority: 0.6,
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

      const url = `${SITE_URL}${getWatchPath(anime.id, anime.title)}`
      // Битую запись в sitemap лучше не класть: Яндекс валидирует URL целиком
      // и на одном «неправильном» элементе не читает весь файл.
      if (!isSitemapSafeUrl(url)) {
        console.warn('[sitemap] skip unsafe anime url:', url)
        continue
      }

      const isOngoing = anime.status === 'ongoing'
      // lastModified не должен быть в будущем и не должен быть Invalid Date:
      // clampLastmod отдаёт null вместо мусорной даты.
      const lastMod = isOngoing
        ? NOW
        : clampLastmod(anime.airedOn, NOW) ?? NOW
      const images = INCLUDE_IMAGES && isSitemapSafeUrl(anime.poster) ? [anime.poster] : undefined

      animePages.push({
        url,
        lastModified: lastMod,
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
        lastModified: clampLastmod(manga.aired_on, NOW) ?? STATIC_PAGES_DATE,
        changeFrequency: 'weekly' as const,
        priority: 0.5,
      }))
      .filter((page) => isSitemapSafeUrl(page.url))

    // --- Страницы новостей ---
    const newsPages: MetadataRoute.Sitemap = newsIds
      .map((id) => ({
        url: `${SITE_URL}/news/${id}`,
        lastModified: NOW,
        changeFrequency: 'monthly' as const,
        priority: 0.4,
      }))
      .filter((page) => isSitemapSafeUrl(page.url))

    // Next.js вставляет url в <loc> как есть, без XML-экранирования
    // (resolve-route-data.ts: `content += `<loc>${item.url}</loc>\n``), поэтому
    // экранируем сами: иначе один `&` в любом URL ломает весь файл.
    return [...staticPages, ...animePages, ...mangaPages, ...newsPages].map((entry) => ({
      ...entry,
      url: escapeXml(entry.url),
      images: entry.images?.map((image) => escapeXml(image)),
    }))
  } catch (error) {
    console.error('[sitemap] Error generating dynamic pages:', error)
    return staticPages
  }
}
