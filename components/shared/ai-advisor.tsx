"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import Link from "next/link"
import { Sparkles, Film, Timer, Hourglass, Loader2, AlertCircle, RefreshCcw, Bookmark, Star } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { searchAnime, type Anime } from "@/lib/shikimori"
import { useBookmarks } from "@/components/providers/bookmarks-provider"
import { useAuth } from "@/components/auth/auth-provider"
import { PreferenceSurvey } from "@/components/shared/preference-survey"

// --- ТИПЫ ДАННЫХ ---
interface AiResponseItem {
  title: string
  reason: string
}

interface AiResponse {
  title: string
  reason: string
  year: number
  episodes: number
}

interface EnrichedRecommendation extends Anime {
  reason: string
  category: 'movie' | 'short' | 'long'
}

export function AiAdvisor() {
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState<'survey' | 'analyzing' | 'searching' | 'done'>('survey')
  const [error, setError] = useState<string | null>(null)
  const [recommendations, setRecommendations] = useState<EnrichedRecommendation[]>([])
  const [preferenceData, setPreferenceData] = useState<any>(null)

  // Хуки
  const { isSaved, toggle } = useBookmarks()
  const { session } = useAuth()

  // Загрузка последнего состояния при монтировании
  useEffect(() => {
    const savedState = localStorage.getItem('ai-advisor-last-state')
    if (savedState) {
      try {
        const { recommendations: savedRecs, step: savedStep } = JSON.parse(savedState)
        if (savedRecs && savedRecs.length > 0) {
          setRecommendations(savedRecs)
          setStep('done')
        }
      } catch (e) {
        console.error('Failed to load AI advisor state:', e)
      }
    }
  }, [])

  const handleGenerate = async (surveyData?: any) => {
    setLoading(true)
    setError(null)
    setStep('analyzing')
    setRecommendations([])

    try {
      // 1. Получаем расширенные данные пользователя из API
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`
      }

      const userDataResponse = await fetch('/api/recommendations/user-data', { headers })
      if (!userDataResponse.ok) {
        throw new Error('Не удалось загрузить данные пользователя')
      }

      const userData = await userDataResponse.json()
      
      // Если данных нет, используем fallback на localStorage
      let historyTitles: string[] = []
      let bookmarkTitles: string[] = []
      let userPreferences = userData.data?.preferences

      if (userData.data?.history?.length > 0) {
        historyTitles = userData.data.history.map((h: any) => h.title)
      } else {
        // Fallback на localStorage
        try {
          const rawHistory = localStorage.getItem("watch-history")
          historyTitles = rawHistory 
            ? JSON.parse(rawHistory)
                .filter((h: any) => h?.title)
                .map((h: any) => h.title.trim())
                .slice(0, 30)
            : []
        } catch {
          historyTitles = []
        }
      }

      if (userData.data?.bookmarks?.length > 0) {
        bookmarkTitles = userData.data.bookmarks.map((b: any) => b.title)
      } else {
        // Fallback на localStorage
        try {
          const rawBookmarks = localStorage.getItem("bookmarks_v1")
          bookmarkTitles = rawBookmarks 
            ? JSON.parse(rawBookmarks)
                .filter((b: any) => b?.title)
                .map((b: any) => b.title.trim())
                .slice(0, 30)
            : []
        } catch {
          bookmarkTitles = []
        }
      }

      // 2. Формируем контекст для нейросети с данными анкеты
      const context = {
        history: userData.data?.history || [],
        bookmarks: userData.data?.bookmarks || [],
        preferences: userPreferences || {
          topGenres: [],
          topStudios: [],
          preferredKinds: [],
          avgRating: null,
          totalWatched: 0,
          totalBookmarks: 0,
          completedCount: 0
        },
        survey: surveyData || null // Добавляем данные анкеты
      }

      // 3. Создаем детальный prompt с учетом предпочтений пользователя и анкеты
      const buildPrompt = () => {
        const prefs = context.preferences
        const survey = context.survey
        const isNewUser = prefs.totalWatched === 0 && prefs.totalBookmarks === 0

        // Если есть данные анкеты, используем их для персонализации
        if (survey) {
          const genreMap: Record<string, string> = {
            "Экшен": "action",
            "Фэнтези": "fantasy",
            "Комедия": "comedy",
            "Драма": "drama",
            "Романтика": "romance",
            "Хоррор": "horror",
            "Научная фантастика": "sci_fi",
            "Повседневность": "slice_of_life",
            "Спорт": "sports",
            "Приключения": "adventure",
            "Мистика": "mystery",
            "Психологическое": "psychological"
          }

          const moodMap: Record<string, string> = {
            "exciting": "адреналиновый и драйвовый",
            "relaxing": "расслабляющий и уютный",
            "emotional": "эмоциональный и драматичный",
            "intellectual": "интеллектуальный и загадочный",
            "romantic": "романтичный",
            "dark": "мрачный"
          }

          const pacingMap: Record<string, string> = {
            "fast": "быстрый темп, экшен с первой минуты",
            "medium": "сбалансированный темп",
            "slow": "медленный, вдумчивый темп"
          }

          const artStyleMap: Record<string, string> = {
            "modern": "современная анимация (2020+)",
            "classic": "классический стиль (2000-2019)",
            "retro": "ретро стиль (90-е)",
            "any": "любой стиль"
          }

          const selectedGenres = survey.favoriteGenres?.map((g: string) => genreMap[g] || g).join(', ') || ''
          const selectedMood = moodMap[survey.mood] || survey.mood || ''
          const selectedPacing = pacingMap[survey.pacing] || survey.pacing || ''
          const selectedArtStyle = artStyleMap[survey.artStyle] || survey.artStyle || ''
          const selectedThemes = survey.themes?.join(', ') || ''

          return `Ты - эксперт по аниме с доступом к инструментам поиска. Твоя задача - подобрать ОДНО идеально подходящее аниме на основе детальной анкеты пользователя.

## Данные анкеты:
- Любимые жанры: ${selectedGenres}
- Желаемое настроение: ${selectedMood}
- Темп повествования: ${selectedPacing}
- Стиль анимации: ${selectedArtStyle}
- Интересующие темы: ${selectedThemes}

${context.history.length > 0 ? `
## История просмотров (${prefs.totalWatched} аниме):
${context.history.slice(0, 10).map((h: any) => `- ${h.title}`).join('\n')}
` : ''}

${context.bookmarks.length > 0 ? `
## Закладки (${prefs.totalBookmarks} аниме):
${context.bookmarks.slice(0, 10).map((b: any) => `- ${b.title}`).join('\n')}
` : ''}

## Инструменты поиска:
У тебя есть два инструмента:
1. search_anime - поиск в базе Shikimori по жанрам, году, рейтингу
2. web_search - поиск в интернете для проверки актуальных данных

## Процесс рекомендации:
1. Сначала используй search_anime с критериями из анкеты (жанры, год, рейтинг)
2. При необходимости используй web_search для проверки актуальных данных о рекомендованных аниме
3. Выбери ОДНО лучшее аниме из результатов поиска
4. Сформируй персонализированную рекомендацию

Ответ должен быть строго в формате JSON:
{
  "title": "название аниме",
  "reason": "детальное объяснение почему это идеально подходит под анкету",
  "year": 2023,
  "episodes": количество серий
}

КРИТИЧЕСКИЕ ПРАВИЛА (НАРУШЕНИЕ НЕДОПУСТИМО):
1. ТОЛЬКО ОДНО аниме в ответе
2. ТОЛЬКО аниме 2023, 2024 или 2025 года выпуска, которые УЖЕ ВЫШЛИ. Аниме-анонсы ЗАПРЕЩЕНЫ.
3. Рейтинг 7.5+ по Shikimori
4. Рекомендация должна быть МАКСИМАЛЬНО ПЕРСОНАЛИЗИРОВАНА - объясни, почему именно это аниме идеально подходит под выбранные жанры, настроение, темп и темы
5. Используй только ОСНОВНОЕ название аниме (не сезоны, не части, не арки)
6. Укажи точное количество серий
7. Если история/закладки есть - НЕ рекомендуй аниме, которые там уже есть
8. Учитывай предпочтение по формату (из анкеты) - если пользователь хочет быстрый темп, выбери короткое аниме или фильм
9. ОБЯЗАТЕЛЬНО используй инструменты поиска перед рекомендацией

Рекомендуй ТОЛЬКО ОДНО аниме, которое максимально соответствует всем критериям анкеты. Причина должна быть очень детальной и персонализированной.`
        }

        // Упрощенный prompt для новых пользователей без анкеты
        if (isNewUser) {
          return `Ты - эксперт по аниме с доступом к инструментам поиска. Пользователь только начинает смотреть аниме и у него нет истории просмотров. Твоя задача - предложить ОДНО лучшее аниме для старта.

## Инструменты поиска:
У тебя есть два инструмента:
1. search_anime - поиск в базе Shikimori по жанрам, году, рейтингу
2. web_search - поиск в интернете для проверки актуальных данных

## Процесс рекомендации:
1. Сначала используй search_anime для поиска популярных аниме 2023-2025 с высоким рейтингом
2. При необходимости используй web_search для проверки актуальных данных
3. Выбери ОДНО лучшее аниме для начинающего
4. Сформируй рекомендацию

Ответ должен быть строго в формате JSON:
{
  "title": "название аниме",
  "reason": "почему это хорошее начало для новичка",
  "year": 2023,
  "episodes": количество серий
}

КРИТИЧЕСКИЕ ПРАВИЛА (НАРУШЕНИЕ НЕДОПУСТИМО):
1. ТОЛЬКО ОДНО аниме в ответе
2. ТОЛЬКО аниме 2023, 2024 или 2025 года выпуска, которые УЖЕ ВЫШЛИ. Аниме-анонсы ЗАПРЕЩЕНЫ.
3. Рейтинг 7.5+ по Shikimori
4. Причина должна объяснять, почему это хорошее аниме для начинающего
5. Используй только ОСНОВНОЕ название аниме (не сезоны, не части, не арки)
6. Укажи точное количество серий
7. Выбери аниме, которое идеально подходит для первого знакомства с жанром (доступное, интересное, с понятным сюжетом)
8. ОБЯЗАТЕЛЬНО используй инструменты поиска перед рекомендацией

Рекомендуй ТОЛЬКО ОДНО аниме для старта.`
        }

        // Полный prompt для пользователей с данными
        let prompt = `Ты - эксперт по аниме с доступом к инструментам поиска. Твоя задача - подобрать ОДНО идеально подходящее аниме на основе детального анализа предпочтений пользователя.

## Данные пользователя:

### История просмотров (${prefs.totalWatched} аниме):
${context.history.slice(0, 15).map((h: any) => 
  `- ${h.title}${h.genres?.length ? ` [жанры: ${h.genres.join(', ')}]` : ''}${h.rating ? ` [рейтинг: ${h.rating}]` : ''}`
).join('\n')}

### Закладки (${prefs.totalBookmarks} аниме, завершено: ${prefs.completedCount}):
${context.bookmarks.slice(0, 15).map((b: any) => 
  `- ${b.title}${b.genres?.length ? ` [жанры: ${b.genres.join(', ')}]` : ''}${b.rating ? ` [рейтинг: ${b.rating}]` : ''}${b.isCompleted ? ' [ЗАВЕРШЕНО]' : ''}`
).join('\n')}

### Анализ предпочтений:
- Любимые жанры: ${prefs.topGenres.length ? prefs.topGenres.join(', ') : 'не определены'}
- Любимые студии: ${prefs.topStudios.length ? prefs.topStudios.join(', ') : 'не определены'}
- Предпочитаемые форматы: ${prefs.preferredKinds.length ? prefs.preferredKinds.join(', ') : 'не определены'}
- Средний рейтинг просмотренного: ${prefs.avgRating || 'нет данных'}
- Активность: просмотрено ${prefs.totalWatched}, в закладках ${prefs.totalBookmarks}, завершено ${prefs.completedCount}

## Инструменты поиска:
У тебя есть два инструмента:
1. search_anime - поиск в базе Shikimori по жанрам, году, рейтингу
2. web_search - поиск в интернете для проверки актуальных данных

## Процесс рекомендации:
1. Сначала используй search_anime с любимыми жанрами и рейтингом пользователя
2. При необходимости используй web_search для проверки актуальных данных о рекомендованных аниме
3. Выбери ОДНО лучшее аниме из результатов поиска
4. Сформируй персонализированную рекомендацию

Ответ должен быть строго в формате JSON:
{
  "title": "название аниме",
  "reason": "детальное объяснение почему понравится",
  "year": 2023,
  "episodes": количество серий
}

КРИТИЧЕСКИЕ ПРАВИЛА (НАРУШЕНИЕ НЕДОПУСТИМО):
1. ТОЛЬКО ОДНО аниме в ответе
2. ТОЛЬКО аниме 2023, 2024 или 2025 года выпуска, которые УЖЕ ВЫШЛИ. Аниме-анонсы ЗАПРЕЩЕНЫ.
3. Рейтинг не ниже ${prefs.avgRating ? Math.max(6, parseFloat(prefs.avgRating) - 1) : 7} по Shikimori
4. Рекомендация должна быть ПЕРСОНАЛИЗИРОВАНА - объясни, почему именно это аниме идеально подходит под историю и предпочтения
5. Используй только ОСНОВНОЕ название аниме (не сезоны, не части, не арки)
6. Укажи точное количество серий
7. НЕ рекомендуй аниме, которые уже есть в истории или закладках
8. Учитывай любимые жанры и студии пользователя
9. Если есть культовые шедевры до 2010 с рейтингом 8.0+, которые идеально подходят, рекомендуй их с объяснением эффекта удивления
10. ОБЯЗАТЕЛЬНО используй инструменты поиска перед рекомендацией

Рекомендуй ТОЛЬКО ОДНО аниме, которое максимально соответствует всем критериям. Причина должна быть очень детальной и персонализированной.`

        return prompt
      }

      // 4. Отправляем запрос через наш API endpoint
      // Очищаем userData от циклических ссылок перед отправкой
      const cleanUserData = userData.data ? {
        history: userData.data.history?.map((h: any) => ({
          id: h.id,
          title: h.title,
          genres: h.genres,
          rating: h.rating
        })) || [],
        bookmarks: userData.data.bookmarks?.map((b: any) => ({
          id: b.id,
          title: b.title,
          genres: b.genres,
          rating: b.rating
        })) || [],
        preferences: userData.data.preferences || {}
      } : null

      const response = await fetch('/api/recommendations/ai-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: buildPrompt(),
          surveyData: surveyData,
          userData: cleanUserData
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Ошибка генерации рекомендаций')
      }

      const result = await response.json()
      console.log('[AI Advisor] Raw API response:', result)

      const data: AiResponse = result.data
      console.log('[AI Advisor] Extracted data:', data)

      // Валидация ответа AI
      if (!data || typeof data !== 'object' || !data.title) {
        console.error('[AI Advisor] Invalid data structure:', data)
        throw new Error("Неверный формат ответа от нейросети. Ожидался объект с полем 'title'")
      }

      setStep('searching')

      // 4. Поиск аниме через Shikimori
      try {
        const results = await searchAnime(data.title.trim())
        if (!results || results.length === 0) {
          throw new Error(`Не удалось найти аниме "${data.title}" в базе Shikimori`)
        }

        const anime = results[0]
        const enrichedRecommendation: EnrichedRecommendation = {
          ...anime,
          reason: data.reason || '',
          category: anime.episodesCurrent <= 12 ? 'movie' : anime.episodesCurrent <= 26 ? 'short' : 'long'
        }

        setRecommendations([enrichedRecommendation])
        setStep('done')

        // Сохраняем успешное состояние
        localStorage.setItem('ai-advisor-last-state', JSON.stringify({
          recommendations: [enrichedRecommendation],
          step: 'done',
          timestamp: Date.now()
        }))
      } catch (error) {
        console.error('Ошибка поиска аниме:', error)
        throw new Error(`Не удалось найти рекомендуемое аниме: ${data.title}`)
      }

    } catch (err) {
      console.error('AI Advisor Error:', err)
      const errorMessage = err instanceof Error ? err.message : "Произошла неизвестная ошибка при генерации рекомендаций"
      setError(errorMessage)
      setStep('survey')
    } finally {
      setLoading(false)
    }
  }

  // --- РЕНДЕР КАРТОЧКИ (ОБНОВЛЕННЫЙ) ---
  const renderCard = (anime: EnrichedRecommendation, accentColor: string) => {
    const saved = isSaved(anime.id)

    return (
      <div 
        key={anime.id} 
        // ВАЖНО: sm:flex-row заставляет блоки встать в ряд на экранах шире мобильного.
        // min-h-[200px] задает минимальную высоту.
        className="group relative flex flex-col sm:flex-row bg-zinc-900/60 border border-white/10 hover:border-white/20 rounded-xl overflow-hidden transition-all duration-300 hover:bg-zinc-900"
      >
        {/* ЛЕВАЯ ЧАСТЬ: ПОСТЕР */}
        {/* w-full на мобильном, фиксированная w-[140px] на ПК */}
        <div className="relative w-full sm:w-[140px] shrink-0 aspect-[2/3] sm:aspect-auto sm:self-stretch bg-secondary">
           <Image
              src={anime.poster}
              alt={anime.title}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-105"
           />
           <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60" />

           {/* Кнопка закладки */}
           <div className="absolute top-2 left-2 z-10">
              <Button
                type="button"
                variant="secondary"
                size="icon-sm"
                className="h-8 w-8 bg-black/60 hover:bg-black/80 text-white border border-white/10 rounded-lg backdrop-blur-sm"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  toggle(anime)
                }}
              >
                <Bookmark className={`w-4 h-4 ${saved ? "fill-orange-500 text-orange-500" : "text-white"}`} />
              </Button>
           </div>

           {/* Рейтинг */}
           <div className="absolute bottom-2 left-2 flex items-center gap-1 z-10">
               <Star className="w-3 h-3 fill-yellow-500 text-yellow-500" />
               <span className="text-xs font-bold text-white shadow-black drop-shadow-md">{anime.rating}</span>
           </div>
           <Link href={`/watch/${anime.id}`} className="absolute inset-0 z-0" />
        </div>

        {/* ПРАВАЯ ЧАСТЬ: КОНТЕНТ */}
        {/* min-w-0 предотвращает сплющивание текста */}
        <div className="flex flex-col flex-1 p-3 sm:p-4 min-w-0">
           <div className="mb-2 sm:mb-3">
              <Link href={`/watch/${anime.id}`} className="hover:text-orange-400 transition-colors block">
                 <h4 className="font-bold text-white text-base sm:text-lg leading-tight truncate pr-2">{anime.title}</h4>
              </Link>
              <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500 mt-1">
                  <span className="bg-white/10 px-1.5 py-0.5 rounded text-zinc-300 capitalize font-medium">
                      {anime.quality || 'TV'}
                  </span>
                  <span>{anime.year}</span>
                  <span>•</span>
                  <span>{anime.episodesCurrent > 0 ? `${anime.episodesCurrent} Серия.` : 'Анонс'}</span>
              </div>
           </div>

           <div className="relative flex-1 bg-secondary/50 rounded-lg p-2.5 sm:p-3 border border-border flex flex-col min-h-[80px]">
              <div className="flex items-center gap-2 mb-1.5 shrink-0">
                  <Sparkles className={`w-3 h-3 ${accentColor}`} />
                  <span className={`text-[10px] font-bold uppercase tracking-widest ${accentColor} opacity-90`}>
                     Почему вам понравится:
                  </span>
              </div>
              <div className="overflow-y-auto custom-scrollbar pr-1">
                  <p className="text-sm text-zinc-300 leading-relaxed font-light">
                     {anime.reason}
                  </p>
              </div>
           </div>
           
           {/* Кнопка "Смотреть" для всех устройств */}
           <div className="mt-3 pt-3 border-t border-white/5 flex justify-end">
              <Link href={`/watch/${anime.id}`} className="text-xs font-bold text-white bg-white/10 px-3 py-1.5 rounded-full hover:bg-white/20 transition-colors">
                  Смотреть &rarr;
              </Link>
           </div>
        </div>
      </div>
    )
  }

  const renderSection = (title: string, icon: React.ReactNode, items: EnrichedRecommendation[], accentColor: string) => {
    if (items.length === 0) return null
    return (
      <div className="animate-in fade-in">
        <div className={`flex items-center gap-3 mb-4 pb-2 border-b border-white/5 ${accentColor}`}>
          {icon}
          <h3 className="text-lg font-bold tracking-wide text-white">{title}</h3>
        </div>
        
        {/* ОДНА РЕКОМЕНДАЦИЯ - крупная карточка */}
        <div className="max-w-2xl mx-auto">
          {items.map((anime) => renderCard(anime, accentColor))}
        </div>
      </div>
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <button className="w-full md:w-auto group relative overflow-hidden rounded-xl bg-gradient-to-br from-indigo-600 via-purple-600 to-orange-500 p-[1px] shadow-2xl transition-all hover:scale-[1.02] active:scale-95 outline-none">
          <div className="relative flex items-center justify-center md:justify-start gap-3 rounded-[11px] bg-secondary/90 px-6 py-4 backdrop-blur-sm transition-all group-hover:bg-secondary/80">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 shadow-lg shrink-0">
              <Sparkles className="h-5 w-5 text-white animate-pulse" />
            </div>
            <div className="text-left">
              <div className="text-sm font-bold text-white group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-indigo-400 group-hover:to-orange-400 transition-all">
                AI Подборка
              </div>
              <div className="text-[10px] text-zinc-400 hidden sm:block">
                Персонально для вас
              </div>
            </div>
          </div>
        </button>
      </DialogTrigger>

      {/* 
          ИСПРАВЛЕНИЕ:
          Добавлен класс sm:max-w-7xl, который перебивает стандартный sm:max-w-lg.
          Теперь окно будет еще шире на ПК.
      */}
      <DialogContent className="bg-background border text-foreground w-[95vw] sm:max-w-7xl md:max-w-7xl max-h-[85vh] p-0 gap-0 overflow-hidden flex flex-col shadow-2xl">
        
        <div className="flex-shrink-0 px-6 py-4 border-b border-border bg-secondary/80 backdrop-blur-xl z-10">
          <DialogHeader className="m-0 space-y-0">
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2 text-xl font-bold">
                <Sparkles className="text-purple-500 w-5 h-5" />
                <span>AI Ассистент</span>
              </DialogTitle>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setIsOpen(false)}
                className="h-8 w-8 text-zinc-400 hover:text-white hover:bg-white/10 rounded-lg"
              >
                ×
              </Button>
            </div>
          </DialogHeader>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar bg-background">
            {error && !loading && (
               <div className="flex flex-col items-center justify-center py-10 animate-in fade-in">
                  <AlertCircle className="w-10 h-10 text-red-500 mb-4" />
                  <p className="text-zinc-300 text-center mb-4">{error}</p>
                  <Button onClick={handleGenerate} variant="secondary">
                     <RefreshCcw className="w-4 h-4 mr-2" /> Повторить
                  </Button>
               </div>
            )}

            {!loading && step === 'survey' && !error && (
              <div className="p-4 md:p-6">
                <PreferenceSurvey
                  onComplete={(data) => {
                    setPreferenceData(data)
                    handleGenerate(data)
                  }}
                  onCancel={() => {
                    setIsOpen(false)
                    setStep('survey')
                  }}
                />
              </div>
            )}

            {loading && (
              <div className="flex flex-col items-center justify-center py-20 space-y-4">
                <Loader2 className="w-12 h-12 text-purple-500 animate-spin" />
                <p className="text-zinc-400 animate-pulse text-sm">
                  {step === 'analyzing' ? 'Анализирую ваши предпочтения...' : 'Ищу информацию об аниме...'}
                </p>
              </div>
            )}

            {step === 'done' && !loading && (
              <div className="space-y-6 pb-4">
                 {renderSection(
                   "Ваша персональная рекомендация",
                   <Sparkles className="w-5 h-5 text-purple-400" />,
                   recommendations,
                   "text-purple-400"
                 )}

                 <div className="pt-4 flex justify-center">
                    <Button variant="ghost" size="sm" onClick={() => setStep('survey')} className="text-zinc-500 hover:text-white">
                       <RefreshCcw className="w-3 h-3 mr-2" />
                       Попробовать снова
                    </Button>
                 </div>
              </div>
            )}
        </div>
      </DialogContent>
    </Dialog>
  )
}