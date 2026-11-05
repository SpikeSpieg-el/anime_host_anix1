import type { NewsFeedItem } from '@/lib/news/types'

/**
 * Последний рубеж для ленты новостей.
 *
 * Если Shikimori, Jikan/MAL и Supabase недоступны одновременно, агрегатор
 * отдаёт этот снимок вместо пустой страницы. Это реальные материалы, которые
 * уже были опубликованы на сайте, поэтому ссылки и обложки остаются рабочими.
 * Лента честно помечает такой режим в интерфейсе («последние сохранённые
 * новости»), чтобы старые материалы не выглядели как свежие.
 *
 * Снимок не обновляется автоматически: это аварийный буфер, а не источник
 * новостей. Как только внешние API отвечают, он не используется.
 */
export interface FallbackNewsItem extends NewsFeedItem {
  comments: number
  htmlBody?: string
}

const shikimoriImage = (path: string): string =>
  `https://img.weeb-x.com/proxy?url=${encodeURIComponent(`https://shikimori.io${path}`)}`

export const FALLBACK_NEWS: FallbackNewsItem[] = [
  {
    id: '649546',
    title: 'Манга «Owari no Seraph» подходит к концу',
    excerpt:
      'Стало известно, что манга «Последний Серафим» завершится 4 декабря 2026 года. В 2015 году по манге вышло аниме, разделённое на две части. Продолжение анонсировано не было.',
    imageUrl: shikimoriImage(
      '/system/user_images_h/preview/ea012fa5708efeb13064b57b/79b32c357f10d1df2036beab17ef845a0c0c4deb365e98fce94b6c4ff6a01160.jpg',
    ),
    date: '05.11.2026',
    dateTimestamp: Date.UTC(2026, 10, 5),
    author: 'Amad0~',
    comments: 61,
    url: 'https://shikimori.one/forum/news/649546',
    source: 'shikimori',
    htmlBody:
      '<p>Стало известно, что манга «Последний Серафим» завершится 4 декабря 2026 года. В 2015 году по манге вышло аниме, разделённое на две части. Продолжение анонсировано не было.</p>',
  },
  {
    id: '649348',
    title: 'Анонс фильма-приквела аниме «Bocchi the Rock!»',
    excerpt:
      'Анонсирован фильм-приквел аниме. Об этом сообщил официальный аккаунт проекта.',
    imageUrl: shikimoriImage(
      '/system/user_images_h/preview/994b09684411000c6348a53b/2b398da11410e79b985d3db61b427e66247d81c51eac2f4bfcafccdba355b93c.jpg',
    ),
    date: '05.11.2026',
    dateTimestamp: Date.UTC(2026, 10, 5, 12),
    author: 'LayGGS',
    comments: 65,
    url: 'https://shikimori.one/forum/news/649348',
    source: 'shikimori',
    htmlBody:
      '<p>Анонсирован фильм-приквел аниме. Об этом сообщил официальный аккаунт проекта.</p>',
  },
  {
    id: '649313',
    title:
      'Анонс, год и сезон премьеры аниме-экранизации манги «Shibatsuki Bukken»',
    excerpt:
      'По манге «Shibatsuki Bukken» (Квартира с сиба-ину) анонсировали аниме-сериал. Премьера летом 2027 года.',
    imageUrl:
      'https://img.weeb-x.com/proxy?url=https%3A%2F%2Fimg.youtube.com%2Fvi%2F0wbcheQlF-w%2Fhqdefault.jpg',
    date: '04.11.2026',
    dateTimestamp: Date.UTC(2026, 10, 4),
    author: 'Gidura',
    comments: 12,
    url: 'https://shikimori.one/forum/news/649313',
    source: 'shikimori',
    htmlBody:
      '<p>По манге «Shibatsuki Bukken» (Квартира с сиба-ину) анонсировали аниме-сериал. Премьера летом 2027 года.</p>',
  },
  {
    id: '649251',
    title:
      'Анонсирована комедийная манга спин-офф «Ужин в доме Сакико-тян» по франшизе BanG Dream! Ave Mujica',
    excerpt:
      'Франшиза BanG Dream! пополнится комедийной мангой-спин-оффом. Официальный аккаунт проекта анонсировал запуск новой комедийной манги.',
    imageUrl: shikimoriImage(
      '/system/user_images_h/preview/7fd0e43308e4a6e819839652/a8819d9a2bdc081fbd82020841c579df4eac730ddcfacf7889c6b753dabec603.jpg',
    ),
    date: '03.11.2026',
    dateTimestamp: Date.UTC(2026, 10, 3),
    author: 'Eto_Kruto',
    comments: 8,
    url: 'https://shikimori.one/forum/news/649251',
    source: 'shikimori',
    htmlBody:
      '<p>Франшиза BanG Dream! пополнится комедийной мангой-спин-оффом. Официальный аккаунт проекта анонсировал запуск новой комедийной манги.</p>',
  },
  {
    id: 'custom-8e67991a-84f9-4127-86e9-d59674b6903d',
    title: 'Киберпанк: Бегущие по краю 2',
    excerpt: 'Вышло аниме, уже доступно на сайте.',
    date: '20.10.2026',
    dateTimestamp: Date.UTC(2026, 9, 20),
    author: 'Редакция Weebx',
    comments: 0,
    url: 'https://weeb-x.com/news/custom-8e67991a-84f9-4127-86e9-d59674b6903d-kiberpank-begushchie-po-krayu-2',
    source: 'custom',
    htmlBody: '<p>Вышло аниме, уже доступно на сайте.</p>',
  },
  {
    id: 'custom-1da06755-f573-4d55-981b-1eae0ca9c419',
    title: 'Первый запуск и новые баннеры',
    excerpt:
      'Большое обновление баннеров: Спайк Шпигель, Табакошка, Баннер Новичка и Онгоинги! Обзор активных баннеров на сайте.',
    imageUrl:
      'https://img.weeb-x.com/proxy?url=https%3A%2F%2Fraw.githubusercontent.com%2FSpikeSpieg-el%2Fimg_past%2Fmain%2Fimg%2F1212121212.png',
    date: '31.07.2026',
    dateTimestamp: Date.UTC(2026, 6, 31),
    author: 'Редакция Weebx',
    comments: 0,
    url: 'https://weeb-x.com/news/custom-1da06755-f573-4d55-981b-1eae0ca9c419-pervyy-zapusk-i-novye-bannery',
    source: 'custom',
    htmlBody:
      '<p>Большое обновление баннеров: Спайк Шпигель, Табакошка, Баннер Новичка и Онгоинги! Обзор активных баннеров на сайте.</p>',
  },
]

export function getFallbackNewsById(id: string): FallbackNewsItem | null {
  return FALLBACK_NEWS.find((item) => item.id === id) ?? null
}
