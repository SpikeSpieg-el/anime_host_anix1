import { NextRequest, NextResponse } from 'next/server'

// Нормализуем BASE_URL, убирая слэш на конце
const rawBaseUrl = process.env.AI_API_BASE_URL || 'http://127.0.0.1:1239/v1'
const API_BASE_URL = rawBaseUrl.replace(/\/+$/, '')
const API_KEY = process.env.AI_API_KEY || ''
const DEFAULT_MODEL = process.env.AI_MODEL || 'google/gemma-4-e4b'

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
    
    if (!response.ok) {
      console.log(`[AI Generate] Models endpoint returned status ${response.status}, using default model: ${DEFAULT_MODEL}`)
      return DEFAULT_MODEL
    }
    
    const data = await response.json()
    const models = data.data || data.models || []
    
    if (models.length === 0) {
      return DEFAULT_MODEL
    }
    
    const modelIds = models.map((m: any) => typeof m === 'string' ? m : m.id)
    console.log('[AI Generate] Available models from API:', modelIds)

    if (modelIds.includes(DEFAULT_MODEL)) {
      return DEFAULT_MODEL
    }
    
    return modelIds[0] || DEFAULT_MODEL
  } catch (error) {
    console.log('[AI Generate] Error fetching models, using default:', error)
    return DEFAULT_MODEL
  }
}

const TOOLS = [
  {
    type: "function",
    function: {
      name: "search_anime",
      description: "Поиск аниме в базе Shikimori по критериям (жанры, год, рейтинг)",
      parameters: {
        type: "object",
        properties: {
          genres: {
            type: "array",
            items: { type: "string" },
            description: "Список жанров для поиска (например: ['Экшен', 'Фэнтези'])"
          },
          year: {
            type: "string",
            description: "Год выпуска или диапазон (например: '2023' или '2023,2024')"
          },
          minRating: {
            type: "number",
            description: "Минимальный рейтинг (по умолчанию 7.5)"
          },
          limit: {
            type: "number",
            description: "Количество результатов (по умолчанию 20)"
          }
        },
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "web_search",
      description: "Поиск информации в интернете для проверки актуальных данных об аниме",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Поисковый запрос"
          },
          numResults: {
            type: "number",
            description: "Количество результатов (по умолчанию 5)"
          }
        },
        required: ["query"]
      }
    }
  }
]

async function executeToolCall(toolCall: any, origin: string) {
  const { name, arguments: args } = toolCall.function

  console.log('[AI Generate] Executing tool:', name, 'with args:', args)

  try {
    let parsedArgs = args
    if (typeof args === 'string') {
      try {
        parsedArgs = JSON.parse(args)
      } catch (e) {
        console.error('[AI Generate] Failed to parse args as JSON:', e)
      }
    }

    if (name === 'search_anime') {
      const response = await fetch(`${origin}/api/recommendations/search-anime`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsedArgs)
      })
      const data = await response.json()
      if (!response.ok) {
        console.error('[AI Generate] search_anime error:', data.error)
        return { error: data.error || 'Search failed' }
      }
      return data.data || []
    }

    if (name === 'web_search') {
      const response = await fetch(`${origin}/api/recommendations/web-search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsedArgs)
      })
      const data = await response.json()
      if (!response.ok) {
        console.error('[AI Generate] web_search error:', data.error)
        return { error: data.error || 'Search failed' }
      }
      return data.data || []
    }

    throw new Error(`Unknown tool: ${name}`)
  } catch (error) {
    console.error('[AI Generate] Tool execution error:', error)
    return { error: error instanceof Error ? error.message : 'Tool execution failed' }
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { prompt, surveyData, userData } = body
    const origin = request.nextUrl.origin || 'http://localhost:3000'

    let profileContext: string[] = []
    
    if (surveyData && Object.keys(surveyData).length > 0) {
      profileContext.push(`ОТВЕТЫ ИЗ АНКЕТЫ ПРЕДПОЧТЕНИЙ:\n${JSON.stringify(surveyData, null, 2)}`)
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
      : 'Данные профиля и анкеты отсутствуют. Выбери популярное топовое аниме.'

    const fullPromptText = prompt
      ? `${prompt}\n\n${formattedContext}`
      : formattedContext

    const model = await getAvailableModel()
    console.log('[AI Generate] Using model:', model)

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 180000)

    try {
      let messages = [
        {
          role: 'system',
          content: 'ТЫ ОБЯЗАН ОТВЕЧАТЬ ТОЛЬКО В ФОРМАТЕ JSON. Никакого текста вне JSON.\n' +
            'ПРАВИЛО ДЛЯ НАЗВАНИЯ ("title"): Указывай РУССКОЕ НАЗВАНИЕ АНИМЕ как на Shikimori (например: "Провожающая в последний путь Фрирен" или Romaji "Sousou no Frieren", а НЕ только английский перевод).\n' +
            'Также ОБЯЗАТЕЛЬНО укажи поле "originalTitle" с Romaji/Японским названием (например: "Sousou no Frieren").\n\n' +
            'Пример формата:\n' +
            '{\n' +
            '  "title": "Провожающая в последний путь Фрирен",\n' +
            '  "originalTitle": "Sousou no Frieren",\n' +
            '  "reason": "Причина рекомендации...",\n' +
            '  "year": 2023,\n' +
            '  "episodes": 28\n' +
            '}\n\n' + fullPromptText
        },
        {
          role: 'user',
          content: 'Порекомендуй одно аниме. Поля "title" (русское название или Romaji) и "originalTitle" ОБЯЗАТЕЛЬНЫ. ОТВЕТЬ ТОЛЬКО JSON.'
        }
      ]

      let response = await fetch(`${API_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          model,
          messages,
          tools: TOOLS,
          tool_choice: 'auto',
          temperature: 0.7,
          max_tokens: 4096
        }),
        signal: controller.signal
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error(`[AI Generate] Error response (${response.status}):`, errorText)
        throw new Error(`Ошибка нейросети (${response.status}): ${errorText.substring(0, 150)}`)
      }

      let responseData = await response.json()
      let assistantMessage = responseData.choices?.[0]?.message

      // Handle tool calls
      let maxIterations = 3
      while (assistantMessage?.tool_calls && assistantMessage.tool_calls.length > 0 && maxIterations > 0) {
        console.log('[AI Generate] Tool calls detected:', assistantMessage.tool_calls.length)

        const toolResults = await Promise.all(
          assistantMessage.tool_calls.map(async (toolCall: any) => {
            const result = await executeToolCall(toolCall, origin)
            return {
              tool_call_id: toolCall.id,
              role: 'tool',
              content: JSON.stringify(result)
            }
          })
        )

        messages.push(assistantMessage)
        messages.push(...toolResults)

        response = await fetch(`${API_BASE_URL}/chat/completions`, {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify({
            model,
            messages,
            tools: TOOLS,
            tool_choice: 'auto',
            temperature: 0.7,
            max_tokens: 4096
          }),
          signal: controller.signal
        })

        if (!response.ok) {
          const errorText = await response.text()
          throw new Error(`Ошибка сервера при инструментах (${response.status}): ${errorText.substring(0, 150)}`)
        }

        responseData = await response.json()
        assistantMessage = responseData.choices?.[0]?.message
        maxIterations--
      }

      if (assistantMessage?.tool_calls && assistantMessage.tool_calls.length > 0) {
        console.log('[AI Generate] Max iterations reached, forcing final JSON response')
        messages.push({
          role: 'user',
          content: 'Сделай финальную рекомендацию СТРОГО в виде JSON объекта с русским названием в "title" и Romaji в "originalTitle".'
        })

        response = await fetch(`${API_BASE_URL}/chat/completions`, {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify({
            model,
            messages,
            temperature: 0.7,
            max_tokens: 4096
          }),
          signal: controller.signal
        })

        if (!response.ok) {
          const errorText = await response.text()
          throw new Error(`Ошибка сервера при финальном ответе (${response.status}): ${errorText.substring(0, 150)}`)
        }

        responseData = await response.json()
        assistantMessage = responseData.choices?.[0]?.message
      }

      clearTimeout(timeoutId)

      const content = assistantMessage?.content
      if (!content) {
        console.error('[AI Generate] Empty message content. Full message:', assistantMessage)
        throw new Error("Нейросеть вернула пустой ответ")
      }

      console.log('[AI Generate] Raw response content:', content)

      let jsonContent = content
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/g, '')
        .trim()

      let jsonMatch = jsonContent.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        jsonMatch = jsonContent.match(/\[\s*\{[\s\S]*\}\s*\]/)
      }

      if (!jsonMatch) {
        console.error('[AI Generate] Failed to locate JSON pattern in:', content)
        throw new Error("Нейросеть не вывела валидный JSON. Текст ответа: " + content.substring(0, 150))
      }

      jsonContent = jsonMatch[0]

      let data: any
      try {
        data = JSON.parse(jsonContent)
        if (Array.isArray(data)) {
          data = data[0]
        }
      } catch (parseError) {
        console.error('[AI Generate] JSON parse error:', parseError)
        console.error('[AI Generate] Invalid string:', jsonContent)
        throw new Error("Ошибка синтаксиса JSON в ответе нейросети")
      }

      if (!data || typeof data !== 'object' || !data.title || typeof data.title !== 'string') {
        console.error('[AI Generate] Invalid structure or title is null/empty:', data)
        throw new Error("Нейросеть не смогла сгенерировать название аниме.")
      }

      return NextResponse.json({
        success: true,
        data: data
      })

    } catch (innerErr) {
      clearTimeout(timeoutId)
      if ((innerErr as Error).name === 'AbortError') {
        throw new Error("Превышено время ожидания ответа от нейросети (3 мин)")
      }
      throw innerErr
    }

  } catch (error) {
    console.error('[AI Generate] Global error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}