"use server"
import { upgradeShikimoriUrl } from "@/lib/shikimori/utils"

interface AnimeUpdateData {
  id: string
  title: string
  poster: string
  episodesCurrent: number // Текущее кол-во вышедших серий
  episodesTotal: number // Всего запланировано
  status: string // ongoing, released, anons
}

/**
 * Получает актуальные данные о сериях для списка ID.
 * Использует REST API Shikimori v1 (GraphQL endpoint больше не доступен).
 */
export async function getFreshAnimeData(ids: string[]): Promise<AnimeUpdateData[]> {
  if (!ids || ids.length === 0) return []
  try {
    const uniqueIds = Array.from(new Set(ids))

    // Shikimori limit: 50 IDs per request. Batch into chunks.
    const BATCH_SIZE = 50
    const batches: string[][] = []
    for (let i = 0; i < uniqueIds.length; i += BATCH_SIZE) {
      batches.push(uniqueIds.slice(i, i + BATCH_SIZE))
    }

    const results: AnimeUpdateData[] = []

    for (const batch of batches) {
      const idsParam = batch.join(",")

      const response = await fetch(`https://shikimori.one/api/animes?ids=${idsParam}&limit=50`, {
        headers: {
          "User-Agent": "AnixStream/1.0",
        },
        next: { revalidate: 600 }, // Кешируем на 10 минут, чтобы не спамить API
      })

      if (!response.ok) {
        console.error("Failed to fetch fresh anime data:", response.status, response.statusText)
        continue // Skip failed batch, keep results from other batches
      }

      const data = await response.json()
      if (!Array.isArray(data)) {
        console.error("Unexpected response from Shikimori:", data)
        continue
      }

      // Преобразуем ответ в наш формат
      results.push(...data.map((anime: any) => {
        const status = anime.status
        const episodesAired = anime.episodes_aired || 0
        const episodesTotal = anime.episodes || 0

        // Shikimori часто не сразу обновляет episodes_aired для только что вышедших онгоингов.
        // Если статус 'ongoing' но episodes_aired = 0, считаем что вышла минимум 1 серия.
        const episodesCurrent = (status === 'ongoing' && episodesAired === 0) ? 1 : episodesAired

        const rawPoster = anime.image?.original || ''
        const isPlaceholder = ['missing', 'stub', 'placeholder', 'default'].some(s => rawPoster.toLowerCase().includes(s))

        return {
          id: String(anime.id),
          title: anime.russian || anime.name,
          poster: isPlaceholder ? '' : upgradeShikimoriUrl(rawPoster),
          episodesCurrent,
          episodesTotal,
          status,
        }
      }))
    }

    return results
  } catch (error) {
    console.error("Error in getFreshAnimeData:", error)
    return []
  }
}
