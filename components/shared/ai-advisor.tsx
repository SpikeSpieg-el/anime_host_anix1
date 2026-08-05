"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import Link from "next/link"
import { 
  Sparkles, 
  RefreshCcw, 
  Bookmark, 
  Star, 
  X, 
  Play, 
  Calendar, 
  Tv, 
  ThumbsUp,
  SlidersHorizontal,
  Search
} from "lucide-react"
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useBookmarks } from "@/components/providers/bookmarks-provider"
import { useAuth } from "@/components/auth/auth-provider"
import { PreferenceSurvey } from "@/components/shared/preference-survey"
import type { Anime } from "@/lib/shikimori"

interface EnrichedRecommendation extends Anime {
  reason: string
  category: 'movie' | 'short' | 'long'
}

export function AiAdvisor() {
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingText, setLoadingText] = useState("Анализирую ваши предпочтения...")
  const [step, setStep] = useState<'survey' | 'analyzing' | 'searching' | 'done'>('survey')
  const [error, setError] = useState<string | null>(null)
  const [recommendations, setRecommendations] = useState<EnrichedRecommendation[]>([])
  const [preferenceData, setPreferenceData] = useState<any>(null)

  const { isSaved, toggle } = useBookmarks()
  const { session } = useAuth()

  useEffect(() => {
    const savedState = localStorage.getItem('ai-advisor-last-state')
    if (savedState) {
      try {
        const { recommendations: savedRecs, preferenceData: savedPref } = JSON.parse(savedState)
        if (savedRecs && savedRecs.length > 0) {
          setRecommendations(savedRecs)
          if (savedPref) setPreferenceData(savedPref) 
          setStep('done')
        }
      } catch (e) {
        console.error('Failed to load AI advisor state:', e)
      }
    }
  }, [])

  useEffect(() => {
    if (!loading) return

    const texts = [
      "Изучаем вашу историю просмотров и закладки...",
      "Сопоставляем ваши предпочтения с базой аниме...",
      "Ищем редкие бриллианты 2023-2025 годов...",
      "Формулируем персональный отзыв для вас..."
    ]

    let index = 0
    const interval = setInterval(() => {
      index = (index + 1) % texts.length
      setLoadingText(texts[index])
    }, 2200)

    return () => clearInterval(interval)
  }, [loading])

  const handleGenerate = async (surveyData?: any) => {
    setLoading(true)
    setError(null)
    setStep('analyzing')
    setRecommendations([])

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`
      }

      const userDataResponse = await fetch('/api/recommendations/user-data', { headers })
      if (!userDataResponse.ok) {
        throw new Error('Не удалось загрузить данные пользователя')
      }

      const userData = await userDataResponse.json()
      const userPreferences = userData.data?.preferences

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
        survey: surveyData || null
      }

      // 📝 ФОРМИРОВАНИЕ ПОДРОБНОГО ПРОМПТА ИЗ АНКЕТЫ
      const buildPrompt = () => {
        const survey = context.survey

        if (survey) {
          const genreMap: Record<string, string> = {
            "Экшен": "Action",
            "Фэнтези": "Fantasy",
            "Комедия": "Comedy",
            "Драма": "Drama",
            "Романтика": "Romance",
            "Хоррор": "Horror",
            "Научная фантастика": "Sci-Fi",
            "Повседневность": "Slice of Life",
            "Спорт": "Sports",
            "Приключения": "Adventure",
            "Мистика": "Mystery",
            "Психологическое": "Psychological"
          }

          const moodMap: Record<string, string> = {
            "exciting": "Адреналиновый, экшен, динамичный",
            "relaxing": "Расслабляющий, уютный, милый, ламповый",
            "emotional": "Глубокая драма, слезовыжимательное, трогательное",
            "intellectual": "Загадочный, детектив, запутанный сюжет",
            "romantic": "Романтика, любовь, отношения",
            "dark": "Мрачный, хоррор, мистика, психологическое давление"
          }

          const pacingMap: Record<string, string> = {
            "fast": "Быстрый темп, бои или события с 1-й минуты",
            "medium": "Сбалансированный темп",
            "slow": "Медленный, размеренный, вдумчивый темп"
          }

          const artStyleMap: Record<string, string> = {
            "modern": "Современная рисовка (2020+)",
            "classic": "Классика (2000-2019)",
            "retro": "Ретро стилистика (90-е)",
            "any": "Любой стиль"
          }

          const selectedGenres = survey.favoriteGenres?.map((g: string) => genreMap[g] || g).join(', ') || 'Любой'
          const selectedMood = moodMap[survey.mood] || survey.mood || 'Любое'
          const selectedPacing = pacingMap[survey.pacing] || survey.pacing || 'Любой'
          const selectedArtStyle = artStyleMap[survey.artStyle] || survey.artStyle || 'Любой'
          const selectedThemes = survey.themes?.join(', ') || 'Любые'

          return `ЗАПРОС НА ПОДБОР АНИМЕ ПО АНКЕТЕ:
          - Любимые жанры: ${selectedGenres}
          - Желаемое настроение: ${selectedMood}
          - Темп повествования: ${selectedPacing}
          - Стиль анимации: ${selectedArtStyle}
          - Интересующие темы: ${selectedThemes}
                  
          КРИТИЧЕСКОЕ ПРАВИЛО: Подобери ОДНО аниме, которое ИДЕАЛЬНО соответствует указанным жанрам (${selectedGenres}) и настроению (${selectedMood}). Объясни в поле "reason", почему оно подходит.`
        }

        return `Подобери ОДНО отличное популярное аниме с высоким рейтингом.`
      }

      const cleanUserData = userData.data ? {
        history: userData.data.history?.map((h: any) => ({ id: h.id, title: h.title, genres: h.genres, rating: h.rating })) || [],
        bookmarks: userData.data.bookmarks?.map((b: any) => ({ id: b.id, title: b.title, genres: b.genres, rating: b.rating })) || [],
        preferences: userData.data.preferences || {}
      } : null

      const cleanSurveyData = surveyData ? {
        favoriteGenres: surveyData.favoriteGenres || [],
        mood: surveyData.mood || null,
        pacing: surveyData.pacing || null,
        artStyle: surveyData.artStyle || null,
        themes: surveyData.themes || []
      } : null

      setStep('searching')

      const response = await fetch('/api/recommendations/ai-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: buildPrompt(),
          surveyData: cleanSurveyData,
          userData: cleanUserData
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Ошибка генерации рекомендаций')
      }

      const result = await response.json()
      const enrichedRecommendation: EnrichedRecommendation = result.data

      if (!enrichedRecommendation || !enrichedRecommendation.title) {
        throw new Error("Неверный формат ответа от сервера")
      }

      setRecommendations([enrichedRecommendation])
      setStep('done')

      localStorage.setItem('ai-advisor-last-state', JSON.stringify({
        recommendations: [enrichedRecommendation],
        preferenceData: surveyData || preferenceData,
        step: 'done',
        timestamp: Date.now()
      }))

    } catch (err) {
      console.error('AI Advisor Error:', err)
      const errorMessage = err instanceof Error ? err.message : "Произошла ошибка при генерации подборки"
      setError(errorMessage)
      setStep('survey')
    } finally {
      setLoading(false)
    }
  }

  const renderHeroCard = (anime: EnrichedRecommendation) => {
    const isRealAnime = Number(anime.id) > 0
    const saved = isRealAnime ? isSaved(anime.id) : false
    const watchHref = isRealAnime ? `/watch/${anime.id}` : `/catalog?search=${encodeURIComponent(anime.title)}`

    return (
      <div className="relative group overflow-hidden rounded-2xl bg-zinc-900/80 border border-white/10 p-4 sm:p-6 shadow-2xl backdrop-blur-xl transition-all duration-300">
        <div className="absolute -top-20 -left-20 w-56 h-56 bg-purple-600/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -right-20 w-56 h-56 bg-orange-600/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col sm:flex-row gap-4 sm:gap-5 items-center sm:items-start">
          {/* ПОСТЕР */}
          <div className="relative w-36 sm:w-[170px] shrink-0 aspect-[2/3] rounded-xl overflow-hidden shadow-xl bg-gradient-to-br from-purple-900/60 to-zinc-900 border border-white/10 flex flex-col items-center justify-center mx-auto sm:mx-0">
            {anime.poster && anime.poster.trim() !== '' ? (
              <Image
                src={anime.poster}
                alt={anime.title}
                fill
                priority
                unoptimized
                className="object-cover transition-transform duration-500 group-hover:scale-105"
              />
            ) : (
              <div className="flex flex-col items-center justify-center p-3 text-center">
                <Sparkles className="w-8 h-8 text-purple-400 mb-2 animate-pulse shrink-0" />
                <span className="text-xs font-bold text-white line-clamp-3">{anime.title}</span>
              </div>
            )}
            
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />

            <div className="absolute top-2.5 left-2.5 bg-black/70 backdrop-blur-md px-2 py-1 rounded-lg border border-white/10 flex items-center gap-1">
              <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400 shrink-0" />
              <span className="text-xs font-bold text-white">{anime.rating}</span>
            </div>

            {isRealAnime && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault()
                  toggle(anime)
                }}
                className="absolute top-2.5 right-2.5 w-8 h-8 rounded-lg bg-black/70 backdrop-blur-md border border-white/10 flex items-center justify-center transition-transform active:scale-95 hover:bg-black"
              >
                <Bookmark className={`w-4 h-4 transition-colors ${saved ? "fill-orange-500 text-orange-500" : "text-white/80"}`} />
              </button>
            )}
          </div>

          {/* ОПИСАНИЕ И КНОПКИ */}
          <div className="flex-1 flex flex-col justify-between min-w-0 w-full h-full text-left">
            <div>
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-2">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] sm:text-xs font-semibold bg-purple-500/10 text-purple-300 border border-purple-500/20">
                  <ThumbsUp className="w-3 h-3 shrink-0" /> Персональный выбор
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] sm:text-xs font-medium bg-white/5 text-zinc-300 border border-white/10">
                  <Calendar className="w-3 h-3 text-zinc-400 shrink-0" /> {anime.year}
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] sm:text-xs font-medium bg-white/5 text-zinc-300 border border-white/10">
                  <Tv className="w-3 h-3 text-zinc-400 shrink-0" /> {anime.episodesCurrent > 0 ? `${anime.episodesCurrent} эп.` : 'Анонс'}
                </span>
              </div>

              <Link href={watchHref} className="inline-block group-hover:text-purple-400 transition-colors">
                <h3 className="text-lg sm:text-2xl font-bold text-white tracking-tight leading-snug">
                  {anime.title}
                </h3>
              </Link>

              <div className="mt-3 p-3 sm:p-4 rounded-xl bg-purple-950/20 border-l-4 border-purple-500 border-y border-r border-purple-500/10">
                <div className="flex items-center gap-1.5 text-xs font-bold text-purple-400 uppercase tracking-wider mb-1.5">
                  <Sparkles className="w-3.5 h-3.5 shrink-0" />
                  <span>Почему вам понравится:</span>
                </div>
                <p className="text-xs sm:text-sm text-zinc-200 leading-relaxed font-light">
                  {anime.reason}
                </p>
              </div>
            </div>

            <div className="mt-4 sm:mt-5 flex items-center justify-end pt-3 border-t border-white/5">
              <Link href={watchHref} className="w-full sm:w-auto">
                <Button className="w-full sm:w-auto bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-medium px-6 shadow-lg shadow-purple-600/25">
                  {isRealAnime ? <Play className="w-4 h-4 fill-current mr-2 shrink-0" /> : <Search className="w-4 h-4 mr-2 shrink-0" />}
                  {isRealAnime ? "Смотреть аниме" : "Искать аниме"}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <button className="w-full md:w-auto group relative overflow-hidden rounded-xl bg-gradient-to-br from-indigo-600 via-purple-600 to-orange-500 p-[1px] shadow-2xl transition-all hover:scale-[1.02] active:scale-95 outline-none">
          <div className="relative flex items-center justify-center md:justify-start gap-3 rounded-[11px] bg-zinc-950/90 px-5 py-3.5 backdrop-blur-sm transition-all group-hover:bg-zinc-950/75">
            <div className="relative flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 shadow-md shrink-0">
              <Sparkles className="h-4 w-4 text-white animate-pulse" />
            </div>
            <div className="text-left">
              <div className="text-sm font-bold text-white group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-indigo-400 group-hover:to-orange-400 transition-all">
                AI Подборка
              </div>
              <div className="text-[10px] text-zinc-400 hidden sm:block">
                Персональный подбор
              </div>
            </div>
          </div>
        </button>
      </DialogTrigger>

      <DialogContent className="bg-zinc-950 border border-white/10 text-foreground w-[95vw] sm:max-w-3xl max-h-[90vh] p-0 gap-0 overflow-hidden flex flex-col shadow-2xl rounded-2xl [&>button:last-child]:hidden">
        
        <div className="flex-shrink-0 px-4 sm:px-6 py-3.5 sm:py-4 border-b border-white/10 bg-zinc-900/50 backdrop-blur-xl flex items-center justify-between z-10">
          <DialogTitle className="flex items-center gap-2.5 text-base sm:text-lg font-semibold text-white">
            <div className="p-1.5 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400 shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <span>AI Советник по аниме</span>
          </DialogTitle>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setIsOpen(false)}
            className="h-8 w-8 text-zinc-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-3.5 sm:p-6 custom-scrollbar">
          {error && !loading && (
            <div className="flex flex-col items-center justify-center py-12 text-center animate-in fade-in px-2">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 mb-4 shrink-0">
                <X className="w-7 h-7 sm:w-8 sm:h-8" />
              </div>
              <h4 className="text-base sm:text-lg font-semibold text-white mb-2">Упс! Что-то пошло не так</h4>
              <p className="text-xs sm:text-sm text-zinc-400 max-w-md mb-6">{error}</p>
              <Button onClick={() => handleGenerate(preferenceData)} variant="secondary" className="bg-white/10 hover:bg-white/20 text-white border-none">
                <RefreshCcw className="w-4 h-4 mr-2 shrink-0" /> Попробовать снова
              </Button>
            </div>
          )}

          {!loading && step === 'survey' && !error && (
            <div className="animate-in fade-in duration-300">
              <PreferenceSurvey
                onComplete={(data) => {
                  setPreferenceData(data)
                  handleGenerate(data)
                }}
                onCancel={() => {
                  setIsOpen(false)
                }}
              />
            </div>
          )}

          {loading && (
            <div className="flex flex-col items-center justify-center py-16 space-y-4 animate-in fade-in px-4">
              <div className="relative flex items-center justify-center">
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full border-4 border-purple-500/20 border-t-purple-500 animate-spin" />
                <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-purple-400 absolute animate-pulse" />
              </div>
              <div className="text-center space-y-1">
                <p className="text-sm sm:text-base font-medium text-white">{loadingText}</p>
                <p className="text-xs text-zinc-500">Это займет всего пару секунд...</p>
              </div>
            </div>
          )}

          {step === 'done' && !loading && recommendations.length > 0 && (
            <div className="space-y-4 sm:space-y-6 animate-in fade-in zoom-in-95 duration-300">
              {renderHeroCard(recommendations[0])}

              {/* Адаптивный блок нижних кнопок */}
              <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-2">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setStep('survey')} 
                  className="w-full sm:w-auto text-zinc-400 hover:text-white hover:bg-white/5 transition-colors justify-center"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5 mr-2 shrink-0" />
                  <span>Изменить параметры анкеты</span>
                </Button>

                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => handleGenerate(preferenceData)} 
                  className="w-full sm:w-auto text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 transition-colors justify-center"
                >
                  <RefreshCcw className="w-3.5 h-3.5 mr-2 shrink-0" />
                  <span>Предложить другое аниме</span>
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}