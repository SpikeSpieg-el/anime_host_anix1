"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import Link from "next/link"
import { Sparkles, Film, Timer, Hourglass, Loader2, AlertCircle, RefreshCcw, Bookmark, Star } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { searchAnime, type Anime } from "@/lib/shikimori"
import { useBookmarks } from "@/components/bookmarks-provider" // Убедитесь, что путь верный

// --- ТИПЫ ДАННЫХ ---
interface AiResponseItem {
  title: string
  reason: string
}

interface AiResponse {
  movie: AiResponseItem[]
  short: AiResponseItem[]
  long: AiResponseItem[]
}

interface EnrichedRecommendation extends Anime {
  reason: string
  category: 'movie' | 'short' | 'long'
}

export function AiAdvisor() {
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState<'idle' | 'analyzing' | 'searching' | 'done'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [recommendations, setRecommendations] = useState<EnrichedRecommendation[]>([])

  // Хук закладок
  const { isSaved, toggle } = useBookmarks()

  // Загрузка последнего состояния при монтировании
  useEffect(() => {
    const savedState = localStorage.getItem('ai-advisor-last-state')
    if (savedState) {
      try {
        const { recommendations: savedRecs, step: savedStep } = JSON.parse(savedState)
        if (savedRecs && savedRecs.length > 0) {
          setRecommendations(savedRecs)
          setStep(savedStep || 'done')
        }
      } catch (e) {
        console.error('Failed to load AI advisor state:', e)
      }
    }
  }, [])

  const handleGenerate = async () => {
    setLoading(true)
    setError(null)
    setStep('analyzing')
    setRecommendations([])

    try {
      // 1. Получаем историю просмотров
      const getWatchHistory = (): string[] => {
        try {
          const rawHistory = localStorage.getItem("watch-history")
          return rawHistory 
            ? JSON.parse(rawHistory)
                .filter((h: any) => h?.title)
                .map((h: any) => h.title.trim())
                .slice(0, 30)
            : []
        } catch {
          return []
        }
      }

      // 2. Получаем закладки
      const getBookmarks = (): string[] => {
        try {
          const rawBookmarks = localStorage.getItem("bookmarks_v1")
          return rawBookmarks 
            ? JSON.parse(rawBookmarks)
                .filter((b: any) => b?.title)
                .map((b: any) => b.title.trim())
                .slice(0, 30)
            : []
        } catch {
          return []
        }
      }

      const history = getWatchHistory()
      const bookmarks = getBookmarks()

      // 3. Отправляем запрос в AI
      const response = await fetch('http://192.168.0.16:5678/webhook/04d131f1-b6dd-4949-a178-284c42d9e0ff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          history: history.length > 0 ? history : [],
          bookmarks: bookmarks.length > 0 ? bookmarks : []
        })
      })

      if (!response.ok) {
        throw new Error(`Ошибка сервера: ${response.status} ${response.statusText}`)
      }
      
      const data: AiResponse = await response.json()
      
      // Валидация ответа AI
      if (!data || typeof data !== 'object') {
        throw new Error("Неверный формат ответа от нейросети")
      }

      const hasValidRecommendations = [data.movie, data.short, data.long].some(
        category => Array.isArray(category) && category.length > 0
      )

      if (!hasValidRecommendations) {
        throw new Error("Нейросеть не смогла подобрать рекомендации. Попробуйте изменить историю просмотров и повторить попытку.")
      }

      setStep('searching')

      // 4. Поиск аниме через Shikimori
      const processItem = async (item: AiResponseItem, category: 'movie' | 'short' | 'long'): Promise<EnrichedRecommendation | null> => {
        if (!item?.title?.trim()) return null
        
        try {
          const results = await searchAnime(item.title.trim())
          if (results?.length > 0) {
            return { ...results[0], reason: item.reason || '', category }
          }
        } catch (error) {
          console.warn(`Не удалось найти аниме: ${item.title}`, error)
        }
        return null
      }

      // Собираем промисы для поиска
      const searchPromises: Promise<EnrichedRecommendation | null>[] = []

      // Добавляем рекомендации по категориям с ограничением
      const addItemToSearch = (items: AiResponseItem[] | undefined, category: 'movie' | 'short' | 'long', maxItems: number) => {
        if (!Array.isArray(items)) return
        items.slice(0, maxItems).forEach(item => {
          searchPromises.push(processItem(item, category))
        })
      }

      addItemToSearch(data.movie, 'movie', 2)
      addItemToSearch(data.short, 'short', 2) 
      addItemToSearch(data.long, 'long', 2)

      const results = (await Promise.all(searchPromises)).filter(Boolean) as EnrichedRecommendation[]
      
      if (results.length === 0) {
        throw new Error("Не удалось найти рекомендуемые аниме в базе Shikimori. Попробуйте повторить запрос.")
      }

      setRecommendations(results)
      setStep('done')
      
      // Сохраняем успешное состояние
      localStorage.setItem('ai-advisor-last-state', JSON.stringify({
        recommendations: results,
        step: 'done',
        timestamp: Date.now()
      }))

    } catch (err) {
      console.error('AI Advisor Error:', err)
      const errorMessage = err instanceof Error ? err.message : "Произошла неизвестная ошибка при генерации рекомендаций"
      setError(errorMessage)
      setStep('idle')
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
      <div className="mb-8 last:mb-0 animate-in fade-in">
        <div className={`flex items-center gap-3 mb-4 pb-2 border-b border-white/5 ${accentColor}`}>
          {icon}
          <h3 className="text-lg font-bold tracking-wide text-white">{title}</h3>
        </div>
        
        {/* СЕТКА: 1 колонка на моб, 2 на ПК */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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

            {!loading && step === 'idle' && !error && (
              <div className="flex flex-col items-center justify-center py-10 text-center space-y-6">
                <div className="w-24 h-24 bg-zinc-900 rounded-full border border-zinc-800 flex items-center justify-center shadow-inner">
                   <Sparkles className="w-10 h-10 text-purple-500" />
                </div>
                <div className="max-w-md">
                   <h2 className="text-xl font-bold text-white mb-2">Персональные рекомендации</h2>
                   <p className="text-zinc-400 text-sm">
                     На основе вашей истории просмотров я подберу:
                     <br/>Фильм, короткий сериал и длинное аниме.
                   </p>
                </div>
                <Button 
                  onClick={handleGenerate} 
                  className="bg-purple-600 hover:bg-purple-700 text-white rounded-full px-8"
                >
                  <Sparkles className="mr-2 h-4 w-4" />
                  Подобрать
                </Button>
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
                   "Идеальный фильм на вечер", 
                   <Film className="w-5 h-5 text-blue-400" />, 
                   recommendations.filter(r => r.category === 'movie'),
                   "text-blue-400"
                 )}
                 
                 {renderSection(
                   "Короткие истории (до 13 серий)", 
                   <Timer className="w-5 h-5 text-green-400" />, 
                   recommendations.filter(r => r.category === 'short'),
                   "text-green-400"
                 )}
                 
                 {renderSection(
                   "Длинное приключение", 
                   <Hourglass className="w-5 h-5 text-orange-400" />, 
                   recommendations.filter(r => r.category === 'long'),
                   "text-orange-400"
                 )}
                 
                 <div className="pt-4 flex justify-center">
                    <Button variant="ghost" size="sm" onClick={handleGenerate} className="text-zinc-500 hover:text-white">
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