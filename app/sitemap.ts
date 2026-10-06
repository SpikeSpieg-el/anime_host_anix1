import { MetadataRoute } from 'next'
import {
  getPopularNow,
  getPopularAlways,
  getOngoingList,
  getAnnouncements,
  getForumNewsPaginated,
} from '@/lib/shikimori'
import { BASE_URL } from '@/lib/shikimori/config'
import { shikimoriJson } from '@/lib/shikimori/client'
import { getWatchPath } from "@/lib/seo/watch-url"
import { clampLastmod, escapeXml, isSitemapSafeUrl } from '@/lib/seo/sitemap-utils'
import { isAnimeSafe } from '@/lib/shikimori/utils'
import type { ShikimoriAnime } from '@/lib/shikimori/types'

// Sitemap пересчитывается раз в 6 часов — lastModified стабилен внутри окна кэша
export const revalidate = 21600

const SITE_URL = 'https://weeb-x.com'

/**
 * Сколько страниц каталога Shikimori (по 50 тайтлов) кладём в sitemap.
 *
 * РАНЬШЕ sitemap содержал только 4 «витринных» списка по 50 позиций
 * (популярное, вышедшее, онгоинги, анонсы), которые ещё и сильно пересекались
 * между собой — плюс getTopOfWeek(50) буквально вызывал getPopularNow(50) и
 * отдавал тот же самый закэшированный список. В итоге в карте сайта оказывалось
 * ~150-200 страниц /watch, тогда как отдать сайт может десятки тысяч.
 * Всё, что не попадало в эти списки, поисковики не находили вообще: каталог
 * (/catalog) рендерится на клиенте и в HTML не содержит ни одной ссылки на тайтл,
 * а пагинация закрыта в robots.txt (Disallow: /*?page=).
 *
 * Теперь добираем «хвост» постранично по популярности. Значение можно поднять
 * через переменную окружения SITEMAP_CATALOG_PAGES (например, до 200 = 10 000
 * тайтлов). Держите его таким, чтобы генерация укладывалась в разумное время:
 * запросы к Shikimori идут последовательно с паузой 200 мс.
 */
const CATALOG_PAGES = Math.max(
  0,
  Number.parseInt(process.env.SITEMAP_CATALOG_PAGES || '40', 10) || 0,
)

const CATALOG_PAGE_SIZE = 50

/** Одна страница каталога Shikimori (для «хвоста» карты сайта). */
async function getCatalogPage(page: number): Promise<ShikimoriAnime[]> {
  try {
    const data = await shikimoriJson<ShikimoriAnime[]>(
      `${BASE_URL}/animes?limit=${CATALOG_PAGE_SIZE}&page=${page}&order=popularity&censored=true`,
      { next: { revalidate: 21600 } },
      { fallback: [] },
    )
    return Array.isArray(data) ? data : []
  } catch {
    // Пропущенная страница = меньше URL, но не падение всего маршрута
    return []
  }
}

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
    // Параллельно загружаем все динамические данные.
    // getTopOfWeek убран: он возвращал ровно тот же закэшированный список,
    // что и getPopularNow (одинаковый URL запроса), то есть не добавлял ни одной
    // новой ссылки.
    const [popularNow, popularAlways, ongoing, announcements, mangaList, newsIds, ...catalogPages] =
      await Promise.all([
        getPopularNow(50),
        getPopularAlways(50),
        getOngoingList(50),
        getAnnouncements(50),
        getPopularMangaIds(100),
        getNewsIds(),
        ...Array.from({ length: CATALOG_PAGES }, (_, i) => getCatalogPage(i + 1)),
      ])

    // --- Страницы аниме ---
    const seenAnimeIds = new Set<string>()
    const animePages: MetadataRoute.Sitemap = []

    // Собираем карточки из двух источников: «витринные» списки (там есть
    // poster/status в форме Anime) и сырые страницы каталога Shikimori.
    type AnimeSitemapSource = {
      id: string
      title: string
      status?: string
      poster?: string
      airedOn?: string
      rating?: string
    }

    const sources: AnimeSitemapSource[] = [
      ...popularNow,
      ...popularAlways,
      ...ongoing,
      ...announcements,
    ].map((anime) => ({
      id: anime.id,
      title: anime.title,
      status: anime.status,
      poster: anime.poster,
      airedOn: anime.airedOn,
    }))

    for (const raw of catalogPages.flat()) {
      if (!raw?.id) continue
      sources.push({
        id: String(raw.id),
        title: raw.russian || raw.name || '',
        status: raw.status,
        airedOn: raw.aired_on || undefined,
        rating: raw.rating,
      })
    }

    const rawById = new Map<string, ShikimoriAnime>()
    for (const raw of catalogPages.flat()) {
      if (raw?.id) rawById.set(String(raw.id), raw)
    }

    for (const source of sources) {
      if (!source?.id || !source.title) continue
      if (seenAnimeIds.has(source.id)) continue

      // NSFW-тайтлы не анонсируем поисковикам: страницы остаются доступными,
      // но с noindex (см. generateMetadata в app/watch/[id]/page.tsx).
      const raw = rawById.get(source.id)
      if (raw && !isAnimeSafe(raw)) continue
      if (source.rating === 'rx' || source.rating === 'x' || source.rating === 'r_plus') continue

      seenAnimeIds.add(source.id)

      const url = `${SITE_URL}${getWatchPath(source.id, source.title)}`
      // Битую запись в sitemap лучше не класть: Яндекс валидирует URL целиком
      // и на одном «неправильном» элементе не читает весь файл.
      if (!isSitemapSafeUrl(url)) {
        console.warn('[sitemap] skip unsafe anime url:', url)
        continue
      }

      // ВАЖНО: transformAnime отдаёт статус с большой буквы ("Ongoing"),
      // а сырой Shikimori — с маленькой ("ongoing"). Раньше сравнение шло
      // только с 'ongoing', поэтому условие не срабатывало никогда: онгоинги
      // не получали changeFrequency: 'daily' и priority 0.8.
      const isOngoing = (source.status || '').toLowerCase() === 'ongoing'
      // lastModified не должен быть в будущем и не должен быть Invalid Date:
      // clampLastmod отдаёт null вместо мусорной даты.
      const lastMod = isOngoing
        ? NOW
        : clampLastmod(source.airedOn, NOW) ?? NOW
      const images = INCLUDE_IMAGES && source.poster && isSitemapSafeUrl(source.poster)
        ? [source.poster]
        : undefined

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
