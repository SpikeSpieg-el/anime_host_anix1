"use server"
interface AnimeUpdateData {
  id: string
  title: string
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
    // Ограничение Shikimori на длину запроса — берем первые 50 ID
    const uniqueIds = Array.from(new Set(ids)).slice(0, 50).join(",")

    const response = await fetch(`https://shikimori.one/api/animes?ids=${uniqueIds}&limit=50`, {
      headers: {
        "User-Agent": "AnixStream/1.0",
      },
      next: { revalidate: 600 }, // Кешируем на 10 минут, чтобы не спамить API
    })

    if (!response.ok) {
      console.error("Failed to fetch fresh anime data:", response.status, response.statusText)
      return []
    }

    const data = await response.json()
    if (!Array.isArray(data)) {
      console.error("Unexpected response from Shikimori:", data)
      return []
    }

    // Преобразуем ответ в наш формат
    return data.map((anime: any) => ({
      id: String(anime.id),
      title: anime.russian || anime.name,
      // episodes_aired — точное число вышедших серий для онгоингов
      // Если 0 (бывает у анонсов или релизов), берем 0
      episodesCurrent: anime.episodes_aired || 0,
      episodesTotal: anime.episodes || 0,
      status: anime.status,
    }))
  } catch (error) {
    console.error("Error in getFreshAnimeData:", error)
    return []
  }
}
