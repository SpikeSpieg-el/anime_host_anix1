export type NewsSource = 'shikimori' | 'jikan' | 'custom'

/**
 * Минимальная «ленточная» форма новости.
 *
 * Отдельный тип нужен, чтобы в клиентский банджл не попадали htmlBody /
 * htmlFooter / linkedAnime: они нужны только странице самой новости и весят
 * десятки килобайт на карточку. Список новостей и API бесконечной прокрутки
 * отдают только поля, которые реально рисуются в карточке.
 */
export interface NewsFeedItem {
  id: string
  title: string
  excerpt: string
  imageUrl?: string
  /** Дата в формате ДД.ММ.ГГГГ — так её отдают Shikimori, MAL и custom_news. */
  date: string
  /** UTC-метка публикации: сортировка и <time datetime>. */
  dateTimestamp: number
  author: string
  url: string
  source: NewsSource
  animeTitle?: string
  animeImage?: string
}

export interface NewsFeedPage {
  items: NewsFeedItem[]
  hasNextPage: boolean
  page: number
  limit: number
  /** true — источники недоступны, отдан последний сохранённый снимок. */
  isFallback?: boolean
}
