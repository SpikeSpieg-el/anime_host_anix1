import { NextRequest, NextResponse } from 'next/server'

const rawBaseUrl = process.env.AI_API_BASE_URL || 'http://127.0.0.1:1239/v1'
const API_BASE_URL = rawBaseUrl.replace(/\/+$/, '')
const API_KEY = process.env.AI_API_KEY || ''
const DEFAULT_MODEL = process.env.AI_MODEL || 'google/gemma-4-e2b'

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  }
  if (API_KEY) {
    headers['Authorization'] = `Bearer ${API_KEY}`
  }
  return headers
}

async function getAvailableModel(): Promise<string> {
  try {
    const headers: Record<string, string> = {}
    if (API_KEY) {
      headers['Authorization'] = `Bearer ${API_KEY}`
    }

    const response = await fetch(`${API_BASE_URL}/models`, { headers })
    if (!response.ok) return DEFAULT_MODEL
    
    const data = await response.json()
    const models = data.data || data.models || []
    if (models.length === 0) return DEFAULT_MODEL
    
    const modelIds = models.map((m: any) => typeof m === 'string' ? m : m.id)
    if (modelIds.includes(DEFAULT_MODEL)) return DEFAULT_MODEL
    return modelIds[0] || DEFAULT_MODEL
  } catch {
    return DEFAULT_MODEL
  }
}

// 🌐 ПОИСК В SHIKIMORI НА СЕРВЕРЕ (БЕЗ CORS ОГРАНИЧЕНИЙ)
async function searchShikimoriServer(title: string, originalTitle?: string): Promise<any | null> {
  const headers = {
    'User-Agent': 'Anix-Anime-Advisor/1.0 (Next.js Server)',
    'Accept': 'application/json'
  }

  const triedQueries = new Set<string>()

  const tryQuery = async (query: string) => {
    const q = query.trim()
    if (!q || q.length < 2 || triedQueries.has(q.toLowerCase())) return null
    triedQueries.add(q.toLowerCase())

    try {
      console.log(`[Shikimori Server Search] Поиск в базе: "${q}"`)
      const url = `https://shikimori.one/api/animes?search=${encodeURIComponent(q)}&limit=5`
      const res = await fetch(url, { headers })
      if (!res.ok) return null
      const items = await res.json()
      if (Array.isArray(items) && items.length > 0) {
        return items[0]
      }
    } catch (e) {
      console.error(`[Shikimori Server Search] Ошибка поиска для "${q}":`, e)
    }
    return null
  }

  // 1. Русский / прямой заголовок
  let anime = await tryQuery(title)
  if (anime) return anime

  // 2. Оригинальный заголовок (Romaji / English)
  if (originalTitle) {
    anime = await tryQuery(originalTitle)
    if (anime) return anime
  }

  // 3. Замена символа 'x' на '×'
  if (title.toLowerCase().includes('x')) {
    anime = await tryQuery(title.replace(/x/gi, '×'))
    if (anime) return anime
    anime = await tryQuery(title.replace(/x/gi, ' '))
    if (anime) return anime
  }

  // 4. Очистка от знаков препинания
  const cleanTitle = title.replace(/["'«»:-]/g, ' ').replace(/\s+/g, ' ').trim()
  if (cleanTitle) {
    anime = await tryQuery(cleanTitle)
    if (anime) return anime
  }

  // 5. Поиск по ключевому слову
  const extractWords = (str: string) => {
    const stopWords = new Set(['the', 'and', 'for', 'you', 'not', 'this', 'with', 'nous', 'или', 'для', 'как', 'что', 'про', 'под', 'нет', 'sama', 'san', 'kun', 'chan'])
    return str
      .replace(/[^a-zA-Zа-яА-Я0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length >= 3 && !stopWords.has(w.toLowerCase()))
      .sort((a, b) => b.length - a.length)
  }

  const words = Array.from(new Set([
    ...extractWords(title),
    ...(originalTitle ? extractWords(originalTitle) : [])
  ]))

  for (const word of words) {
    anime = await tryQuery(word)
    if (anime) return anime
  }

  return null
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { prompt, surveyData, userData } = body

    let profileContext: string[] = []
    
    if (surveyData && Object.keys(surveyData).length > 0) {
      profileContext.push(`ДАННЫЕ АНКЕТЫ ПРЕДПОЧТЕНИЙ:\n${JSON.stringify(surveyData, null, 2)}`)
    }
    
    if (userData) {
      if (userData.history && userData.history.length > 0) {
        const historyTitles = userData.history.map((h: any) => h.title).filter(Boolean).slice(0, 15)
        if (historyTitles.length > 0) {
          profileContext.push(`УЖЕ ПРОСМОТРЕННЫЕ АНИМЕ (НЕ РЕКОМЕНДУЙ ИХ): ${historyTitles.join(', ')}`)
        }
      }
      if (userData.bookmarks && userData.bookmarks.length > 0) {
        const bookmarkTitles = userData.bookmarks.map((b: any) => b.title).filter(Boolean).slice(0, 15)
        if (bookmarkTitles.length > 0) {
          profileContext.push(`АНИМЕ В ЗАКЛАДКАХ: ${bookmarkTitles.join(', ')}`)
        }
      }
    }

    const formattedContext = profileContext.length > 0 
      ? profileContext.join('\n\n')
      : 'Данные профиля отсутствуют. Выбери популярное топовое аниме.'

    const fullPromptText = prompt ? `${prompt}\n\n${formattedContext}` : formattedContext
    const model = await getAvailableModel()

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 180000)

    try {
      let messages = [
        {
          role: 'system',
          content: 'Ты - профессиональный AI-советник по аниме.\n' +
            'ТВОЯ ГЛАВНАЯ ЗАДАЧА: Подобрать ОДНО аниме, которое ТОЧНО соответствует запрошенным пользователем жанрам, настроению и темам.\n\n' +
            'ПРАВИЛА:\n' +
            '1. ОТВЕЧАЙ СТРОГО В ФОРМАТЕ JSON. Никакого текста вне JSON.\n' +
            '2. СТРОГО СОПОСТАВЛЯЙ подборку с анкетой! Никогда не выдавай "Атаку титанов", если пользователь выбрал романтику, хоррор, комедию или повседневность!\n' +
            '3. Поля "title" (русское название) и "originalTitle" (Romaji/English) ОБЯЗАТЕЛЬНЫ.\n\n' +
            'Формат JSON ответа:\n' +
            '{\n' +
            '  "title": "Название аниме на русском или Romaji",\n' +
            '  "originalTitle": "Original Title (English / Romaji)",\n' +
            '  "reason": "Детальное объяснение почему именно это аниме идеально подходит под указанные жанры и настроение...",\n' +
            '  "year": 2023,\n' +
            '  "episodes": 12\n' +
            '}'
        },
        {
          role: 'user',
          content: fullPromptText
        }
      ]

      let response = await fetch(`${API_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.7, // Вариативность ответов
          max_tokens: 4096
        }),
        signal: controller.signal
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Ошибка нейросети (${response.status}): ${errorText.substring(0, 150)}`)
      }

      let responseData = await response.json()
      let assistantMessage = responseData.choices?.[0]?.message
      clearTimeout(timeoutId)

      const content = assistantMessage?.content
      if (!content) {
        throw new Error("Нейросеть вернула пустой ответ")
      }

      let jsonContent = content
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/g, '')
        .trim()

      let jsonMatch = jsonContent.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new Error("Нейросеть не вывела валидный JSON.")
      }

      let aiData: any = JSON.parse(jsonMatch[0])
      if (Array.isArray(aiData)) aiData = aiData[0]

      if (!aiData || !aiData.title) {
        throw new Error("Нейросеть не смогла сгенерировать название аниме.")
      }

      // 🔍 СЕРВЕРНЫЙ ПОИСК В SHIKIMORI
      const shikimoriAnime = await searchShikimoriServer(aiData.title, aiData.originalTitle)

      let enrichedResult: any

      if (shikimoriAnime) {
        let posterUrl = ''
        if (shikimoriAnime.image?.original) {
          posterUrl = shikimoriAnime.image.original.startsWith('http')
            ? shikimoriAnime.image.original
            : `https://shikimori.one${shikimoriAnime.image.original}`
        }

        const episodes = shikimoriAnime.episodes_aired || shikimoriAnime.episodes || aiData.episodes || 12

        enrichedResult = {
          id: shikimoriAnime.id.toString(),
          shikimoriId: shikimoriAnime.id.toString(),
          title: shikimoriAnime.russian || shikimoriAnime.name || aiData.title,
          originalTitle: shikimoriAnime.name || aiData.originalTitle || aiData.title,
          poster: posterUrl,
          rating: shikimoriAnime.score ? shikimoriAnime.score.toString() : "8.5",
          year: shikimoriAnime.aired_on ? parseInt(shikimoriAnime.aired_on.slice(0, 4)) : (aiData.year || 2023),
          episodesCurrent: episodes,
          episodesTotal: shikimoriAnime.episodes || episodes,
          quality: shikimoriAnime.kind ? shikimoriAnime.kind.toUpperCase() : "TV",
          status: shikimoriAnime.status || "released",
          reason: aiData.reason || '',
          category: episodes <= 12 ? 'movie' : episodes <= 26 ? 'short' : 'long'
        }
      } else {
        const episodes = aiData.episodes || 12
        enrichedResult = {
          id: "0",
          shikimoriId: "0",
          title: aiData.title,
          originalTitle: aiData.originalTitle || aiData.title,
          poster: '',
          rating: "8.5+",
          year: aiData.year || 2023,
          episodesCurrent: episodes,
          episodesTotal: episodes,
          quality: "TV",
          status: "released",
          reason: aiData.reason || '',
          category: episodes <= 12 ? 'movie' : episodes <= 26 ? 'short' : 'long'
        }
      }

      return NextResponse.json({
        success: true,
        data: enrichedResult
      })

    } catch (innerErr) {
      clearTimeout(timeoutId)
      if ((innerErr as Error).name === 'AbortError') {
        throw new Error("Превышено время ожидания ответа от нейросети")
      }
      throw innerErr
    }

  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}