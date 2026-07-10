import { MetadataRoute } from 'next'
import { getPopularNow, getPopularAlways, getOngoingList } from '@/lib/shikimori'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://weeb-x.com'

  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${baseUrl}/gacha`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/battle`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/catalog`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/manga`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/beginners`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.6,
    },
    {
      url: `${baseUrl}/news`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.6,
    },
    {
      url: `${baseUrl}/faq`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.5,
    },
    {
      url: `${baseUrl}/contacts`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.3,
    },
    {
      url: `${baseUrl}/terms`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.2,
    },
    {
      url: `${baseUrl}/dmca`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.2,
    },
  ]

  try {
    const [popularNow, popularAlways, ongoing] = await Promise.all([
      getPopularNow(50),
      getPopularAlways(50),
      getOngoingList(50),
    ])

    const seenIds = new Set<string>()
    const animePages: MetadataRoute.Sitemap = []

    for (const anime of [...popularNow, ...popularAlways, ...ongoing]) {
      if (!anime?.id || seenIds.has(anime.id)) continue
      seenIds.add(anime.id)
      animePages.push({
        url: `${baseUrl}/watch/${anime.id}`,
        lastModified: new Date(),
        changeFrequency: 'weekly',
        priority: 0.6,
      })
    }

    return [...staticPages, ...animePages]
  } catch {
    return staticPages
  }
}
