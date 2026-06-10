import { NextRequest, NextResponse } from 'next/server'

const API_BASE_URL = 'http://localhost:3264'
const API_KEY = 'Bearer sk-lm-mPGLv8PX:qSqGZHg7U0dZ9Ocg0KAR'

// Fetch available models from the API
async function getAvailableModel(): Promise<string> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/models`, {
      headers: {
        'Authorization': API_KEY
      }
    })
    
    if (!response.ok || response.status === 404) {
      console.log('[AI Generate] Models endpoint not available (404), using default model')
      return 'qwen3.5-plus'
    }
    
    const data = await response.json()
    const models = data.data || data.models || []
    
    if (models.length === 0) {
      console.log('[AI Generate] No models found, using default')
      return 'qwen3.5-plus'
    }
    
    // Prefer qwen models
    const preferredModel = models.find((m: any) => 
      m.id?.includes('qwen3.5-plus') || 
      m.id?.includes('qwen3.7-plus') ||
      m.id?.includes('qwen-max')
    )
    
    return preferredModel?.id || models[0]?.id || models[0] || 'qwen3.5-plus'
  } catch (error) {
    console.log('[AI Generate] Error fetching models, using default:', error)
    return 'qwen3.5-plus'
  }
}

// Tool definitions for the AI model
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

async function executeToolCall(toolCall: any) {
  const { name, arguments: args } = toolCall.function

  console.log('[AI Generate] Executing tool:', name, 'with args:', args)
  console.log('[AI Generate] Args type:', typeof args, 'Args stringified:', JSON.stringify(args))

  try {
    if (name === 'search_anime') {
      // Parse arguments if they're a string
      let parsedArgs = args
      if (typeof args === 'string') {
        try {
          parsedArgs = JSON.parse(args)
        } catch (e) {
          console.error('[AI Generate] Failed to parse args as JSON:', e)
        }
      }

      console.log('[AI Generate] Sending to search_anime:', parsedArgs)
      
      const response = await fetch('http://localhost:80/api/recommendations/search-anime', {
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
      // Parse arguments if they're a string
      let parsedArgs = args
      if (typeof args === 'string') {
        try {
          parsedArgs = JSON.parse(args)
        } catch (e) {
          console.error('[AI Generate] Failed to parse args as JSON:', e)
        }
      }

      console.log('[AI Generate] Sending to web_search:', parsedArgs)

      const response = await fetch('http://localhost:80/api/recommendations/web-search', {
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

    // Fetch available model from API
    const model = await getAvailableModel()
    console.log('[AI Generate] Using model:', model)

    // Отправляем запрос в LM Studio с таймаутом
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 300000) // 5 минут таймаута

    try {
      // First message with tools
      let messages = [
        {
          role: 'system',
          content: 'ТЫ ОБЯЗАН ОТВЕЧАТЬ ТОЛЬКО В ФОРМАТЕ JSON. Никакого текста вне JSON. Никаких объяснений, никаких вступлений, никаких завершающих фраз. Только чистый JSON объект.\n\n' + prompt + '\n\nУ тебя есть доступ к инструментам поиска. Используй их для проверки актуальных данных об аниме перед рекомендацией.'
        },
        {
          role: 'user',
          content: 'Порекомендуй аниме на основе моего профиля. Учитывай все детали из анкеты, истории и предпочтений. Сначала используй инструменты поиска для проверки актуальных данных. ОТВЕТЬ ТОЛЬКО JSON.'
        }
      ]

      let response = await fetch(`${API_BASE_URL}/api/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': API_KEY
        },
        body: JSON.stringify({
          model,
          messages,
          tools: TOOLS,
          tool_choice: 'auto',
          temperature: 0.7,
          max_tokens: 128000
        }),
        signal: controller.signal
      })

      if (!response.ok) {
        throw new Error(`Ошибка сервера: ${response.status} ${response.statusText}`)
      }

      let responseData = await response.json()
      let assistantMessage = responseData.choices?.[0]?.message

      // Handle tool calls
      let maxIterations = 3
      while (assistantMessage?.tool_calls && maxIterations > 0) {
        console.log('[AI Generate] Tool calls detected:', assistantMessage.tool_calls.length)

        // Execute all tool calls
        const toolResults = await Promise.all(
          assistantMessage.tool_calls.map(async (toolCall: any) => {
            const result = await executeToolCall(toolCall)
            return {
              tool_call_id: toolCall.id,
              role: 'tool',
              content: JSON.stringify(result)
            }
          })
        )

        // Add assistant message and tool results to conversation
        messages.push(assistantMessage)
        messages.push(...toolResults)

        // Get next response
        response = await fetch(`${API_BASE_URL}/api/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': API_KEY
          },
          body: JSON.stringify({
            model,
            messages,
            tools: TOOLS,
            tool_choice: 'auto',
            temperature: 0.7,
            max_tokens: 128000
          }),
          signal: controller.signal
        })

        if (!response.ok) {
          throw new Error(`Ошибка сервера: ${response.status} ${response.statusText}`)
        }

        responseData = await response.json()
        assistantMessage = responseData.choices?.[0]?.message
        maxIterations--
      }

      // If model still wants to call tools after max iterations, force it to respond
      if (assistantMessage?.tool_calls) {
        console.log('[AI Generate] Max iterations reached, forcing final response')
        messages.push({
          role: 'user',
          content: 'Ты использовал все доступные инструменты. Теперь сделай финальную рекомендацию. ОТВЕТЬ ТОЛЬКО ЧИСТЫЙ JSON без текста, без объяснений, без markdown. Только JSON объект с полями title, reason, year, episodes.'
        })

        response = await fetch(`${API_BASE_URL}/api/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': API_KEY
          },
          body: JSON.stringify({
            model,
            messages,
            tools: TOOLS,
            tool_choice: 'none', // Force no tool calls
            temperature: 0.7,
            max_tokens: 128000
          }),
          signal: controller.signal
        })

        if (!response.ok) {
          throw new Error(`Ошибка сервера: ${response.status} ${response.statusText}`)
        }

        responseData = await response.json()
        assistantMessage = responseData.choices?.[0]?.message
      }

      clearTimeout(timeoutId)

      // Парсим ответ от LM Studio
      const content = assistantMessage?.content
      if (!content) {
        throw new Error("Неверный формат ответа от нейросети")
      }

      console.log('[AI Generate] Raw response from LM Studio:', content)

      // Извлекаем JSON из ответа - убираем markdown и лишний текст
      let jsonContent = content
      
      // Убираем markdown code blocks
      jsonContent = jsonContent.replace(/```json\s*/g, '').replace(/```\s*/g, '')
      
      // Убираем возможные префиксы/суффиксы текста
      jsonContent = jsonContent.trim()
      
      // Находим JSON объект в тексте
      let jsonMatch = jsonContent.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        // Пробуем найти JSON массив
        jsonMatch = jsonContent.match(/\[\s*\{[\s\S]*\}\s*\]/)
      }
      
      if (!jsonMatch) {
        console.error('[AI Generate] Failed to extract JSON from response:', content)
        throw new Error("Не удалось найти JSON в ответе нейросети. Ответ: " + content.substring(0, 200) + "...")
      }

      jsonContent = jsonMatch[0]
      console.log('[AI Generate] Extracted JSON:', jsonContent)

      let data: any
      try {
        data = JSON.parse(jsonContent)
      } catch (parseError) {
        console.error('[AI Generate] JSON parse error:', parseError)
        console.error('[AI Generate] Failed JSON content:', jsonContent)
        throw new Error("Не удалось распарсить JSON из ответа нейросети")
      }

      // Валидация ответа для одной рекомендации
      if (!data || typeof data !== 'object' || !data.title) {
        console.error('[AI Generate] Invalid data structure:', data)
        throw new Error("Неверный формат ответа от нейросети. Ожидался объект с полем 'title'")
      }

      // Проверка, что аниме не в списке уже просмотренных
      const watchedTitles = userData?.history?.map((h: any) => h.title.toLowerCase()) || []
      const bookmarkTitles = userData?.bookmarks?.map((b: any) => b.title.toLowerCase()) || []
      const forbiddenTitles = [...watchedTitles, ...bookmarkTitles]
      
      if (forbiddenTitles.includes(data.title.toLowerCase())) {
        console.error('[AI Generate] Recommended anime is already watched/bookmarked:', data.title)
        throw new Error(`Нейросеть рекомендовала уже просмотренное аниме: ${data.title}. Попробуйте снова.`)
      }

      return NextResponse.json({
        success: true,
        data: data
      })

    } catch (innerErr) {
      clearTimeout(timeoutId)
      if ((innerErr as Error).name === 'AbortError') {
        throw new Error("Превышено время ожидания ответа от LM Studio (5 мин). Убедитесь, что сервер запущен на http://127.0.0.1:1234")
      }
      throw innerErr
    }

  } catch (error) {
    console.error('[AI Generate] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
