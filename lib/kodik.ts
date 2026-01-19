export interface KodikEpisode {
  id: string
  episode: number
  season: number
  title: string
  translation: {
    id: string
    title: string
  }
}

export interface KodikAnime {
  id: string
  shikimori_id: number
  title: string
  other_title: string
  episodes: number
  poster: string
  episodes_list: KodikEpisode[]
}

const KODIK_API_BASE = 'https://kodikapi.com'

export async function getAnimeEpisodes(shikimoriId: string, title: string): Promise<KodikEpisode[]> {
  try {
    const response = await fetch(
      `${KODIK_API_BASE}/search?token=${process.env.KODIK_API_TOKEN}&shikimori_id=${shikimoriId}&title=${encodeURIComponent(title)}&types=anime,anime-serial&with_episodes=true&limit=1`
    )

    if (!response.ok) {
      console.error('Kodik API error:', response.status)
      return []
    }

    const data = await response.json()
    
    if (!data.results || data.results.length === 0) {
      return []
    }

    const anime = data.results[0]
    
    if (!anime.episodes_list || !Array.isArray(anime.episodes_list)) {
      return []
    }

    return anime.episodes_list
  } catch (error) {
    console.error('Error fetching episodes from Kodik:', error)
    return []
  }
}

export function getKodikPlayerUrl(shikimoriId: string, title: string, episode?: number): string {
  const baseUrl = '//kodik.cc/find-player'
  const params = new URLSearchParams({
    shikimoriID: shikimoriId,
    title: title,
    types: 'anime,anime-serial',
    block_blocked_countries: 'true',
    no_ads: 'true'
  })

  if (episode && episode > 0) {
    params.append('episode', String(episode))
  }

  return `${baseUrl}?${params.toString()}`
}
