"use server"
interface AnimeUpdateData {
id: string
title: string
episodesCurrent: number // Текущее кол-во вышедших эпизодов
episodesTotal: number // Всего запланировано
status: string // ongoing, released, anons
}
/**
Получает актуальные данные о сериях для списка ID.
Использует GraphQL Shikimori для минимизации трафика.
*/
export async function getFreshAnimeData(ids: string[]): Promise<AnimeUpdateData[]> {
if (!ids || ids.length === 0) return []
try {
// Ограничение Shikimori на длину запроса, разбиваем если слишком много ID,
// но для примера берем первые 50 (обычно этого хватает для истории)
const uniqueIds = Array.from(new Set(ids)).slice(0, 50).join(",")

// Используем GraphQL для получения точных данных о эпизодах
const response = await fetch("https://shikimori.one/api/graphql", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "User-Agent": "AnixStream/1.0",
  },
  body: JSON.stringify({
    query: `
      query($ids: String) {
        animes(ids: $ids, limit: 50, order: id) {
          id
          russian
          name
          episodes
          episodesAired
          status
        }
      }
    `,
    variables: {
      ids: uniqueIds,
    },
  }),
  next: { revalidate: 600 }, // Кешируем на 10 минут, чтобы не спамить API
})

if (!response.ok) {
  console.error("Failed to fetch fresh anime data:", response.statusText)
  return []
}

const json = await response.json()

if (json.errors) {
  console.error("GraphQL Errors:", json.errors)
  return []
}

// Преобразуем ответ в наш формат
return json.data.animes.map((anime: any) => ({
  id: String(anime.id),
  title: anime.russian || anime.name,
  // episodesAired - это точное число вышедших серий для онгоингов
  // Если episodesAired 0 (бывает у анонсов), берем 0
  episodesCurrent: anime.episodesAired || 0,
  episodesTotal: anime.episodes || 0,
  status: anime.status,
}))
} catch (error) {
console.error("Error in getFreshAnimeData:", error)
return []
}
}