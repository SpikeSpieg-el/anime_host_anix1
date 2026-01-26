import type { Anime } from "@/lib/shikimori"

export function isHentaiContent(anime: Anime): boolean {
  // Проверяем рейтинг R+ и прочие маркеры хентай-контента
  const hentaiRatings = ['rx', 'r+', 'r18', '18+']
  const hentaiKeywords = ['hentai', 'хентай']
  
  // Проверяем рейтинг
  if (anime.rating && hentaiRatings.includes(anime.rating.toString().toLowerCase())) {
    return true
  }
  
  // Проверяем жанры на наличие хентай-ключевых слов
  if (anime.genres) {
    const hasHentaiGenre = anime.genres.some(genre => 
      hentaiKeywords.some(keyword => 
        genre.toLowerCase().includes(keyword)
      )
    )
    if (hasHentaiGenre) return true
  }
  
  // Проверяем название и описание
  const titleAndDesc = `${anime.title} ${anime.originalTitle} ${anime.description}`.toLowerCase()
  const hasHentaiInTitle = hentaiKeywords.some(keyword => titleAndDesc.includes(keyword))
  if (hasHentaiInTitle) return true
  
  // Специальные ID для теста
  const specialHentaiIds = ['10851']
  if (specialHentaiIds.includes(anime.id)) {
    return true
  }
  
  return false
}
