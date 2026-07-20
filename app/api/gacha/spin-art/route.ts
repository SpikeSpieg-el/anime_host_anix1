import { NextRequest, NextResponse } from 'next/server'
import { fetchHighQualityArt } from '@/app/gacha/art-sources'

// Функция для получения данных персонажа из Shikimori (включая English имя)
async function getCharacterData(characterId: number): Promise<{
  name: string
  russian: string | null
  enName: string | null
  animeName?: string
} | null> {
  try {
    const response = await fetch(`https://shikimori.one/api/characters/${characterId}`)
    if (!response.ok) return null
    const data = await response.json()
    
    // Пытаемся достать название аниме из первого связанного аниме персонажа
    let animeName = undefined;
    if (data.animes && data.animes.length > 0) {
      // Ищем аниме с самым высоким рейтингом или просто первое
      const mainAnime = data.animes.find((a: any) => a.roles?.includes('Main')) || data.animes[0];
      animeName = mainAnime.name || mainAnime.russian;
    }

    // Если аниме не найдено в аниме-списке, проверяем поле 'description' или другие источники,
    // но обычно Shikimori отдает список в 'animes'.

    return {
      name: data.name || '',
      russian: data.russian || null,
      enName: data.en_name || null,
      animeName
    }
  } catch (e) {
    console.error('[Spin Art] Error fetching character:', e)
    return null
  }
}

// Функция для генерации тегов из имени персонажа (как в art-sources.ts)
function generateSearchTags(characterName: string): string[] {
  const tags: string[] = []
  
  // Очищаем имя
  const cleanName = characterName.replace(/\([^)]*\)/g, '').trim()
  const parts = cleanName.toLowerCase().split(/\s+/)
  
  // Генерируем варианты тегов как в art-sources.ts
  if (parts.length >= 2) {
    tags.push(`${parts[parts.length - 1]}_${parts[0]}`) // lastname_firstname
    tags.push(parts.join('_')) // firstname_lastname
  } else {
    tags.push(parts[0])
  }
  
  return tags
}

// Основная функция поиска арта с fallback стратегией и повторными попытками
async function searchArtWithFallback(
  characterId: number, 
  ignoredUrls: string[],
  maxRetries: number = 3,
  customTags?: { booru?: string[], zerochan?: string[] }
): Promise<{
  url: string
  source: string
  tag: string
} | null> {
  // 1. Получаем данные персонажа из Shikimori
  const charData = await getCharacterData(characterId)
  if (!charData) return null
  
  const searchNames: string[] = []
  
  // 2. Приоритет: English имя если доступно
  if (charData.enName && charData.enName !== charData.name) {
    searchNames.push(charData.enName)
  }
  
  // 3. Добавляем оригинальное имя
  searchNames.push(charData.name)
  
  // 4. Добавляем русское имя если есть
  if (charData.russian && charData.russian !== charData.name) {
    searchNames.push(charData.russian)
  }
  
  // 5. Для каждого имени пробуем разные варианты поиска
  let allIgnoredUrls = [...ignoredUrls]
  
  for (let retry = 0; retry < maxRetries; retry++) {
    // Если переданы кастомные теги, используем их в первую очередь
    if (customTags) {
      const result = await fetchHighQualityArt(searchNames[0], allIgnoredUrls, true, customTags, charData.animeName)
      if (result && !allIgnoredUrls.includes(result.url)) {
        console.log(`[Spin Art] Found art for character ${characterId} using custom tags from ${result.source}`)
        return { url: result.url, source: result.source, tag: result.tag }
      }
    }

    for (const name of searchNames) {
      const result = await fetchHighQualityArt(name, allIgnoredUrls, true, undefined, charData.animeName)
      // Если обычный поиск не нашёл, пробуем с forceNew=true
      if (!result) continue
      // Проверяем, не забанен ли этот URL
      if (allIgnoredUrls.includes(result.url)) {
        console.log(`[Spin Art] Art ${result.url} is already ignored, continuing search...`)
        continue
      }
      console.log(`[Spin Art] Found exact-tag art for "${name}" from ${result.source}`)
      return { url: result.url, source: result.source, tag: result.tag }
    }
    
    // Если все попытки вернули забаненные URL, пробуем глубже
    if (retry < maxRetries - 1) {
      console.log(`[Spin Art] All attempts returned ignored URLs, retrying with deeper search...`)
      // forceNew=true уже делает глубокий поиск
    }
  }
  
  return null
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { characterId, blacklistedUrls = [], customTags } = body

    if (!characterId) {
      return NextResponse.json({ error: 'Missing characterId' }, { status: 400 })
    }

    console.log(`[Spin Art] Searching art for character ${characterId}, ignored count: ${blacklistedUrls.length}${customTags ? ', using custom tags' : ''}`)

    const result = await searchArtWithFallback(characterId, blacklistedUrls, 3, customTags)

    if (!result) {
      return NextResponse.json({ error: 'No art found for this character' }, { status: 404 })
    }

    return NextResponse.json({
      art: {
        url: result.url,
        source: result.source,
        tag: result.tag
      }
    })

  } catch (error) {
    console.error('[Spin Art] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
