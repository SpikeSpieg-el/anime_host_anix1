import { MetadataRoute } from 'next'
import { createClient } from "@supabase/supabase-js"
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
import { getNewsPath } from "@/lib/seo/news-url"
import { INDEXABLE_GENRE_LANDINGS, getGenrePath } from '@/lib/seo/genre-landings'
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

/**
 * Пауза между страницами каталога, мс.
 *
 * Комментарий выше обещает последовательные запросы с паузой 200 мс, но код их
 * отправлял через Promise.all — 40 одновременных обращений к Shikimori. В логах
 * это выглядело как «Response status: 429 … No cache available, returning
 * fallback»: половина страниц молча возвращала по нулям, и sitemap терял
 * тысячи URL. Теперь запросы действительно последовательные.
 */
const CATALOG_PAGE_DELAY_MS = 200

/**
 * После скольких подряд пустых страниц «хвоста» прекращаем опрос.
 *
 * На работающем Shikimori страницы по популярности не пустые, а на сервере
 * сборки с недоступной сетью каждая страница «стоит» 15 с таймаута × 2 попытки
 * внутри shikimoriFetch (≈30 с). 40 страниц × 30 с = больше 20 минут:
 * страница /sitemap.xml упирается в лимит Next (300 с), Next пересобирает её
 * трижды и деплой падает целиком. Два подряд пустых ответа — почти наверняка
 * сеть/API мертвы, дальше добирать смысла нет.
 */
const MAX_CONSECUTIVE_CATALOG_FAILURES = 2

/**
 * Общий дедлайн (в мс) на весь сбор внешних данных для sitemap.
 *
 * Лимит сборки одной страницы в Next — 300 с. Дедлайн 120 с меньше лимита,
 * поэтому даже в наихудшем сценарии (сеть полностью недоступна) страница
 * успевает честно вернуться со статичной частью, а не обрывается по таймауту
 * с тремя попытками пересборки.
 */
const DATA_DEADLINE_MS = 120_000

/**
 * Сигнал-метка для Promise.race: дедлайн истёк. Строка выбрана так, чтобы
 * не пересекаться с типами самих данных (массивы/объекты).
 */
const DATA_DEADLINE_SIGNAL = 'data-collection-deadline' as const

/**
 * Флаг «дедлайн уже истёк» — его проверяет последовательный сбор страниц
 * каталога, чтобы не продолжать стучаться в мёртвый API после отработки
 * дедлайна у основного запроса.
 */
let doesDataDeadlineExceed = false

function createDataDeadline(): Promise<typeof DATA_DEADLINE_SIGNAL> {
  return new Promise((resolve) => {
    setTimeout(() => {
      doesDataDeadlineExceed = true
      resolve(DATA_DEADLINE_SIGNAL)
    }, DATA_DEADLINE_MS)
  })
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Одна страница каталога Shikimori (для «хвоста» карты сайта).
 *
 * Отличаем «страница пустая» от «страница не загрузилась»:
 * пустая ([]) = нормальный ответ API, null = ошибка сети/лимита.
 */
async function getCatalogPage(page: number): Promise<ShikimoriAnime[] | null> {
  try {
    const data = await shikimoriJson<ShikimoriAnime[] | null>(
      `${BASE_URL}/animes?limit=${CATALOG_PAGE_SIZE}&page=${page}&order=popularity&censored=true`,
      { next: { revalidate: 21600 } },
      { fallback: null },
    )
    if (data === null) return null
    return Array.isArray(data) ? data : []
  } catch {
    // Пропущенная страница = меньше URL, но не падение всего маршрута
    return null
  }
}

/**
 * «Хвост» карты сайта: страницы каталога строго по очереди.
 *
 * Последовательность — не для красоты: Shikimori режет лимит и на пачке
 * одновременных запросов отдаёт 429 без кэша, и страницы молча выпадают из
 * sitemap. При CATALOG_PAGES=40 это 40 запросов, то есть ~8 секунд на сборку.
 *
 * Если API недоступен (или истёк дедлайн), не долбим дальше: после
 * MAX_CONSECUTIVE_CATALOG_FAILURES подряд не пришедших страниц останавливаемся —
 * иначе сборка тратит по таймауту на каждую страницу зря.
 */
async function getCatalogPagesSequential(count: number): Promise<ShikimoriAnime[][]> {
  const pages: ShikimoriAnime[][] = []
  let consecutiveFailures = 0
  for (let index = 0; index < count; index++) {
    if (doesDataDeadlineExceed) {
      console.warn('[sitemap] Истёк дедлайн, прекращаем сбор страниц каталога')
      break
    }
    const pageData = await getCatalogPage(index + 1)
    if (pageData === null) {
      consecutiveFailures += 1
      if (consecutiveFailures >= MAX_CONSECUTIVE_CATALOG_FAILURES) {
        console.warn(`[sitemap] Shikimori не отвечает: ${consecutiveFailures} страницы подряд не пришли, отдаём собранное`)
        break
      }
    } else {
      consecutiveFailures = 0
      pages.push(pageData)
    }
    if (index < count - 1) await sleep(CATALOG_PAGE_DELAY_MS)
  }
  return pages
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

async function getNewsIds(): Promise<Array<{ id: string; title: string }>> {
  const items: Array<{ id: string; title: string }> = []
  const seen = new Set<string>()

  // Загружаем первые 5 страниц новостей (только Shikimori — Jikan слишком нестабилен для сборки)
  for (let page = 1; page <= 5; page++) {
    try {
      const pageItems = await getForumNewsPaginated(page, 12)
      for (const item of pageItems) {
        if (!seen.has(item.id)) {
          seen.add(item.id)
          items.push({ id: item.id, title: item.title })
        }
      }
      if (pageItems.length < 12) break
    } catch {
      break
    }
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (supabaseUrl && supabaseKey) {
    try {
      const supabase = createClient(supabaseUrl, supabaseKey)
      const { data, error } = await supabase
        .from("custom_news")
        .select("id,title")
        .eq("is_published", true)
        .order("created_at", { ascending: false })
        .limit(1000)

      if (!error && Array.isArray(data)) {
        items.push(...data.map((item) => ({ id: `custom-${item.id}`, title: item.title })))
      }
    } catch {
      // Sitemap can still include external news if the custom-news store is unavailable.
    }
  }

  return items
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
      // Хаб жанров: из него робот попадает на все 38 жанровых лендингов одной
      // перелинковкой, поэтому его приоритет выше, чем у обычных статичных
      // страниц вроде /faq.
      url: `${SITE_URL}/genre`,
      lastModified: NOW,
      changeFrequency: 'weekly',
      priority: 0.8,
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

  // --- Жанровые лендинги ---
  //
  // Без них в карте сайта не было ни одного адреса, написанного под жанровый
  // запрос («смотреть исекай»): /catalog?genre=... туда не попадает, а
  // страницы фильтров Google отбрасывал из-за чужого canonical.
  // 18+ жанры (indexable: false) в sitemap не кладутся — их страницы
  // отдают noindex, и робот лишь зря потратил бы краулинговый бюджет.
  // Блок вынесен до сетевого кода: лендинги не требуют сети (это константы
  // из lib/seo/genre-landings) и остаются в sitemap даже при откате на
  // статичный fallback.
  const genrePages: MetadataRoute.Sitemap = INDEXABLE_GENRE_LANDINGS.map(
    (genre) => ({
      url: `${SITE_URL}${getGenrePath(genre.slug)}`,
      lastModified: NOW,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    }),
  )

  try {
    // Common deadline: одна общая «точка истечения» на весь сбор внешних дан.
    // ОБЩИЙ дедлайн гарантирует, что страница /sitemap.xml соберётся быстрее
    // лимита Next (300 с) даже при полностью мёртвой сети, — деплой перестаёт
    // зависеть от доступности Shikimori.
    const dataDeadline = createDataDeadline()

    // Параллельно загружаем «витринные» данные.
    // getTopOfWeek убран: он возвращал ровно тот же закэшированный список,
    // что и getPopularNow (одинаковый URL запроса), то есть не добавлял ни одной
    // новой ссылки.
    const displayLists = Promise.all([
      getPopularNow(50),
      getPopularAlways(50),
      getOngoingList(50),
      getAnnouncements(50),
      getPopularMangaIds(100),
      getNewsIds(),
    ])

    const displayResult = await Promise.race([displayLists, dataDeadline])
    if (displayResult === DATA_DEADLINE_SIGNAL) {
      console.warn('[sitemap] Витринные данные не собраны за дедлайн, отдаём sitemap без динамической части')
      return [...staticPages, ...genrePages]
    }
    const [popularNow, popularAlways, ongoing, announcements, mangaList, newsIds] = displayResult

    // «Хвост» каталога — строго последовательно, с паузой. Одновременные
    // запросы к Shikimori упираются в 429, и страницы молча выпадают из
    // sitemap (см. getCatalogPagesSequential).
    const catalogResult = await Promise.race([
      getCatalogPagesSequential(CATALOG_PAGES),
      dataDeadline,
    ])
    if (catalogResult === DATA_DEADLINE_SIGNAL) {
      console.warn('[sitemap] Хвост каталога не собран за дедлайн, отдаём sitemap без динамической части')
      return [...staticPages, ...genrePages]
    }
    const catalogPages = catalogResult

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
      .map(({ id, title }) => ({
        url: `${SITE_URL}${getNewsPath(id, title)}`,
        lastModified: NOW,
        changeFrequency: 'monthly' as const,
        priority: 0.4,
      }))
      .filter((page) => isSitemapSafeUrl(page.url))

    // Next.js вставляет url в <loc> как есть, без XML-экранирования
    // (resolve-route-data.ts: `content += `<loc>${item.url}</loc>\n``), поэтому
    // экранируем сами: иначе один `&` в любом URL ломает весь файл.
    return [
      ...staticPages,
      ...genrePages,
      ...animePages,
      ...mangaPages,
      ...newsPages,
    ].map((entry) => ({
      ...entry,
      url: escapeXml(entry.url),
      images: entry.images?.map((image) => escapeXml(image)),
    }))
  } catch (error) {
    console.error('[sitemap] Error generating dynamic pages:', error)
    // Жанровые лендинги не зависят от сети — оставляем и в аварийном fallback
    return [...staticPages, ...genrePages]
  }
}
