'use client'

import { useState, useEffect, useCallback, useRef, useTransition } from 'react'
import { createPortal } from 'react-dom'
import { AnimeCard } from '@/components/shared/anime-card'
import { GridSkeleton } from '@/components/shared/skeleton'
import type { Anime, CatalogFilters } from '@/lib/shikimori'
import { RandomAnimeModal } from '@/components/catalog/random-anime-modal'
import { GENRES_MAP } from '@/lib/shikimori'
import { fetchAnimeData } from '@/app/catalog/actions'
import { fetchRandomAnime } from '@/app/catalog/actions/get-random-anime'
import { saveCatalogFilters } from '@/lib/catalog-preferences'
import { Button } from '@/components/ui/button'
import { MultiSelect } from '@/components/ui/multi-select'
import { Input } from '@/components/ui/input'
import { 
  Search, 
  SlidersHorizontal, 
  Loader2, 
  X, 
  RotateCcw, 
  LayoutGrid, 
  Grid3x3, 
  Table, 
  ArrowLeft, 
  Sparkles,
  Check
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useAuth } from '@/components/auth/auth-provider'

const ORDER_OPTIONS = [
  { value: 'popularity', label: 'Популярные' },
  { value: 'aired_on', label: 'Новинки' },
  { value: 'ranked', label: 'Рейтинг' },
]

const STATUS_OPTIONS = [
  { value: 'all', label: 'Все' },
  { value: 'ongoing', label: 'Онгоинг' },
  { value: 'released', label: 'Вышел' },
  { value: 'anons', label: 'Анонс' },
]

const KIND_OPTIONS = [
  { value: 'all', label: 'Все' },
  { value: 'tv', label: 'ТВ Сериал' },
  { value: 'movie', label: 'Фильм' },
  { value: 'ova', label: 'OVA' },
  { value: 'ona', label: 'ONA' },
  { value: 'special', label: 'Спешл' },
]

const YEAR_OPTIONS = [
  { value: 'all', label: 'Все годы' },
  { value: '2026', label: '2026' },
  { value: '2025', label: '2025' },
  { value: '2024', label: '2024' },
  { value: '2023', label: '2023' },
  { value: '2022', label: '2022' },
  { value: '2021', label: '2021' },
  { value: '2020', label: '2020' },
  { value: '2000s', label: '2000-е' },
  { value: '1990s', label: '1990-е' },
  { value: 'older', label: 'Раньше 1990' },
]

const SCORE_OPTIONS = [
  { value: 'all', label: 'Любой' },
  { value: '9', label: '9★+' },
  { value: '8', label: '8★+' },
  { value: '7', label: '7★+' },
  { value: '6', label: '6★+' },
]

export function CatalogClient({ initialFilters }: { initialFilters: CatalogFilters }) {
  const router = useRouter()
  const { profile } = useAuth()
  
  const [mounted, setMounted] = useState(false)
  const [isPending, startTransition] = useTransition()
  
  const [animes, setAnimes] = useState<Anime[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  
  const normalizeGenre = (g: string | string[] | undefined): string | string[] | undefined => {
    if (!g || (Array.isArray(g) && g.length === 0) || g === 'all') return 'all'
    if (Array.isArray(g)) {
      return g.map(genre => {
        if (genre === 'all') return null
        return GENRES_MAP[genre] || genre
      }).filter((item): item is string => item !== null)
    }
    if (GENRES_MAP[g]) return GENRES_MAP[g]
    return g
  }

  const [filters, setFilters] = useState<CatalogFilters>({
    ...initialFilters,
    genre: normalizeGenre(initialFilters.genre),
    allowNsfw: profile?.allow_nsfw_search || false
  })
  
  const [showFilters, setShowFilters] = useState(false)
  const [viewMode, setViewMode] = useState<'comfortable' | 'compact' | 'table'>('comfortable')
  const [isFilterPanelVisible, setIsFilterPanelVisible] = useState(true)
  const [lastScrollY, setLastScrollY] = useState(0)
  const [randomAnime, setRandomAnime] = useState<Anime | null>(null)
  const [showRandomModal, setShowRandomModal] = useState(false)

  // Монтирование для работы Portal на клиенте
  useEffect(() => {
    setMounted(true)
  }, [])

  // Закрытие по клавише Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showFilters) setShowFilters(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showFilters])

  // Блокировка прокрутки страницы при открытой панели
  useEffect(() => {
    if (showFilters) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [showFilters])

  useEffect(() => {
    saveCatalogFilters(filters)
  }, [filters])
  
  const isInitialMount = useRef(true)

  const fetchAnimes = useCallback(async (currentFilters: CatalogFilters, isLoadMore = false) => {
    if (isLoadMore) {
      setLoadingMore(true)
    } else {
      setLoading(true)
    }

    try {
      const result = await fetchAnimeData(currentFilters)
      if (isLoadMore) {
        setAnimes(prev => [...prev, ...result.animes])
      } else {
        setAnimes(result.animes)
      }
      setHasMore(result.hasMore)
    } catch (error) {
      console.error('Error fetching catalog:', error)
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [])

  useEffect(() => {
    const updatedFilters = {
      ...initialFilters,
      genre: normalizeGenre(initialFilters.genre),
      allowNsfw: profile?.allow_nsfw_search || false
    }
    setFilters(updatedFilters)
    fetchAnimes(updatedFilters, false)
    isInitialMount.current = false
  }, [initialFilters, profile?.allow_nsfw_search, fetchAnimes])

  const applyFilters = () => {
    const params = new URLSearchParams()
    if (filters.order) params.set('sort', filters.order)
    if (filters.genre && filters.genre !== 'all') {
      if (Array.isArray(filters.genre)) {
        if (filters.genre.length > 0) params.set('genre', filters.genre.join(','))
      } else {
        params.set('genre', filters.genre)
      }
    }
    if (filters.status && filters.status !== 'all') params.set('status', filters.status)
    if (filters.kind && filters.kind !== 'all') params.set('kind', filters.kind)
    if (filters.year && filters.year !== 'all') {
      if (Array.isArray(filters.year)) {
        if (filters.year.length > 0) params.set('year', filters.year.join(','))
      } else {
        params.set('year', filters.year)
      }
    }
    if (filters.score && filters.score !== 'all') params.set('score', filters.score)
    if (filters.search) params.set('search', filters.search)

    const newUrl = `/catalog?${params.toString()}`
    startTransition(() => {
      router.push(newUrl, { scroll: false })
    })
    setShowFilters(false)
  }

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY
      if (currentScrollY > lastScrollY && currentScrollY > 120) {
        setIsFilterPanelVisible(false)
        setShowFilters(false)
      } else {
        setIsFilterPanelVisible(true)
      }
      setLastScrollY(currentScrollY)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [lastScrollY])

  const updateFilter = (key: keyof CatalogFilters, value: string | string[]) => {
    setFilters(prev => ({
      ...prev,
      [key]: Array.isArray(value) ? (value.length === 0 ? undefined : value) : (value === 'all' ? undefined : value),
      page: 1
    }))
  }

  const loadMore = () => {
    if (!loadingMore && hasMore) {
      const nextPage = (filters.page || 1) + 1
      const newFilters = { ...filters, page: nextPage }
      setFilters(newFilters)
      fetchAnimes(newFilters, true)
    }
  }

  const clearSearch = () => {
    setFilters(prev => ({ ...prev, search: '', page: 1 }))
    startTransition(() => {
      router.push('/catalog', { scroll: false })
    })
  }

  const resetFilters = () => {
    const defaultFilters: CatalogFilters = {
      page: 1,
      limit: 24,
      order: 'popularity',
      search: ''
    }
    setFilters(defaultFilters)
    startTransition(() => {
      router.push('/catalog', { scroll: false })
    })
    setShowFilters(false)
  }

  const handleGoBack = () => {
    startTransition(() => {
      if (typeof window !== 'undefined' && window.history.length > 1) {
        router.back()
      } else {
        router.push('/')
      }
    })
  }

  const showRandomAnime = async () => {
    startTransition(async () => {
      const randomFilters: CatalogFilters = {
        page: 1,
        limit: 50,
        order: filters.order || 'popularity',
        search: filters.search || '',
        genre: filters.genre,
        status: filters.status,
        kind: filters.kind,
        year: filters.year,
        score: filters.score,
        allowNsfw: filters.allowNsfw
      }

      setShowFilters(false)
      const randomAnime = await fetchRandomAnime(randomFilters)
      if (randomAnime) {
        setRandomAnime(randomAnime)
        setShowRandomModal(true)
      }
    })
  }

  const gridClass = viewMode === 'compact' 
    ? "grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-2 sm:gap-4"
    : viewMode === 'table'
    ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4"
    : "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-x-4 gap-y-6 sm:gap-y-8"

  const activeFiltersCount = [
    Boolean(filters.search),
    Boolean(filters.genre && filters.genre !== 'all' && (!Array.isArray(filters.genre) || filters.genre.length > 0)),
    Boolean(filters.status && filters.status !== 'all'),
    Boolean(filters.kind && filters.kind !== 'all'),
    Boolean(filters.year && filters.year !== 'all' && (!Array.isArray(filters.year) || filters.year.length > 0)),
    Boolean(filters.score && filters.score !== 'all'),
    Boolean(filters.order && filters.order !== 'popularity')
  ].filter(Boolean).length

  return (
    <div className={cn("min-h-screen pb-20 sm:pb-20 transition-opacity duration-200", isPending && "opacity-75 pointer-events-none")}>
      
      {/* 1. Компактный верхний бар каталога */}
      <div className={cn(
        "sticky top-16 md:top-20 bg-background/85 dark:bg-zinc-950/85 backdrop-blur-xl border-b border-border/40 dark:border-zinc-800/60 z-30 px-3 py-2 transition-transform duration-300 ease-in-out shadow-xs",
        isFilterPanelVisible ? "translate-y-0" : "-translate-y-full"
      )}>
        <div className="container mx-auto px-0 max-w-7xl flex items-center gap-1.5 sm:gap-2.5">
          
          {/* Поле поиска */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-3.5 h-3.5 pointer-events-none" />
            <Input
              placeholder="Поиск по названию..."
              value={filters.search || ''}
              onChange={(e) => updateFilter('search', e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') applyFilters()
              }}
              className="h-9 text-xs pl-8.5 pr-14 bg-secondary/50 dark:bg-zinc-900/60 border-border/40 dark:border-zinc-800 text-foreground placeholder-muted-foreground rounded-xl"
            />
            <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
              {filters.search && (
                <button
                  onClick={clearSearch}
                  className="p-1 text-muted-foreground hover:text-foreground rounded-lg"
                  type="button"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
              {filters.search && (
                <button
                  onClick={applyFilters}
                  className="px-1.5 py-0.5 text-primary text-[11px] font-semibold"
                >
                  OK
                </button>
              )}
            </div>
          </div>

          {/* Кнопка фильтров */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              "h-9 px-3 rounded-xl text-xs font-medium border border-border/50 dark:border-zinc-800 transition-all gap-1.5 shrink-0",
              showFilters || activeFiltersCount > 0 
                ? "bg-primary text-white border-primary hover:bg-primary/90 shadow-xs" 
                : "bg-secondary/50 hover:bg-secondary text-foreground dark:bg-zinc-900/60 dark:hover:bg-zinc-800"
            )}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span className="hidden xs:inline">Фильтры</span>
            {activeFiltersCount > 0 && (
              <span className="inline-flex items-center justify-center min-w-[1rem] h-4 px-1 text-[9px] font-bold rounded-full bg-white text-primary dark:bg-zinc-950 dark:text-orange-400">
                {activeFiltersCount}
              </span>
            )}
          </Button>

          {/* Случайное аниме */}
          <Button
            variant="outline"
            size="sm"
            onClick={showRandomAnime}
            className="h-9 w-9 p-0 rounded-xl bg-secondary/50 border-border/50 dark:border-zinc-800 dark:bg-zinc-900/60 text-muted-foreground hover:text-foreground shrink-0"
            title="Случайное аниме"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          </Button>

          {/* Загрузка */}
          {(loading || isPending) && !loadingMore && (
            <div className="flex items-center text-xs text-muted-foreground shrink-0 px-1">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
            </div>
          )}

        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. ПРАВАЯ ПАНЕЛЬ ЧЕРЕЗ REACT PORTAL (ПЕРЕКРЫВАЕТ ШАПКУ И НАВБАР) */}
      {/* ========================================================================= */}
      {mounted && createPortal(
        <div 
          className={cn(
            "fixed inset-0 z-[99999] pointer-events-none transition-all duration-300",
            showFilters && "pointer-events-auto"
          )}
        >
          {/* Затемнение фона */}
          <div 
            onClick={() => setShowFilters(false)}
            className={cn(
              "fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity duration-300",
              showFilters ? "opacity-100" : "opacity-0 pointer-events-none"
            )}
          />

          {/* Сама правая панель */}
          <aside 
            className={cn(
              "fixed top-0 right-0 h-dvh w-[85vw] max-w-[340px] bg-zinc-950/98 backdrop-blur-2xl border-l border-zinc-800/80 shadow-2xl flex flex-col text-white transition-transform duration-300 ease-out",
              showFilters ? "translate-x-0" : "translate-x-full"
            )}
          >
            {/* Шапка боковой панели */}
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-zinc-800/80 shrink-0 bg-zinc-950">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-orange-500" />
                <span className="text-sm font-semibold tracking-wide text-white">Фильтры</span>
                {activeFiltersCount > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-orange-500/20 text-orange-400 font-bold">
                    {activeFiltersCount}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1">
                {activeFiltersCount > 0 && (
                  <button
                    onClick={resetFilters}
                    className="text-xs text-zinc-400 hover:text-white px-2 py-1 rounded-md transition-colors"
                  >
                    Сбросить
                  </button>
                )}
                <button
                  onClick={() => setShowFilters(false)}
                  className="p-1 text-zinc-400 hover:text-white rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Тело фильтра */}
            <div className="flex-1 overflow-y-auto px-4 py-3.5 space-y-3.5 text-xs custom-scrollbar">
              
              {/* СОРТИРОВКА */}
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">
                  Сортировка
                </span>
                <div className="grid grid-cols-3 gap-1.5 bg-zinc-900/90 p-1 rounded-xl border border-zinc-800/60">
                  {ORDER_OPTIONS.map(opt => {
                    const active = (filters.order || 'popularity') === opt.value
                    return (
                      <button
                        key={opt.value}
                        onClick={() => updateFilter('order', opt.value)}
                        className={cn(
                          "py-2 px-1 rounded-lg text-[11px] font-medium transition-all text-center truncate",
                          active 
                            ? "bg-zinc-800 text-white shadow-sm font-semibold ring-1 ring-zinc-700" 
                            : "text-zinc-400 hover:text-zinc-200"
                        )}
                      >
                        {opt.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* СТАТУС */}
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">
                  Статус
                </span>
                <div className="grid grid-cols-4 gap-1 bg-zinc-900/90 p-1 rounded-xl border border-zinc-800/60">
                  {STATUS_OPTIONS.map(opt => {
                    const active = (filters.status || 'all') === opt.value
                    return (
                      <button
                        key={opt.value}
                        onClick={() => updateFilter('status', opt.value)}
                        className={cn(
                          "py-2 px-1 rounded-lg text-[11px] font-medium transition-all text-center truncate",
                          active 
                            ? "bg-zinc-800 text-white shadow-sm font-semibold ring-1 ring-zinc-700" 
                            : "text-zinc-400 hover:text-zinc-200"
                        )}
                      >
                        {opt.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* ТИП */}
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">
                  Тип
                </span>
                <div className="grid grid-cols-3 gap-1.5 bg-zinc-900/90 p-1.5 rounded-xl border border-zinc-800/60">
                  {KIND_OPTIONS.map(opt => {
                    const active = (filters.kind || 'all') === opt.value
                    return (
                      <button
                        key={opt.value}
                        onClick={() => updateFilter('kind', opt.value)}
                        className={cn(
                          "py-2 px-1 rounded-lg text-[11px] font-medium transition-all text-center truncate",
                          active 
                            ? "bg-zinc-800 text-white shadow-sm font-semibold ring-1 ring-zinc-700" 
                            : "text-zinc-400 hover:text-zinc-200"
                        )}
                      >
                        {opt.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* ОЦЕНКА ОТ */}
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">
                  Оценка от
                </span>
                <div className="grid grid-cols-5 gap-1 bg-zinc-900/90 p-1 rounded-xl border border-zinc-800/60">
                  {SCORE_OPTIONS.map(opt => {
                    const active = (filters.score || 'all') === opt.value
                    return (
                      <button
                        key={opt.value}
                        onClick={() => updateFilter('score', opt.value)}
                        className={cn(
                          "py-2 px-0.5 rounded-lg text-[11px] font-medium transition-all text-center truncate",
                          active 
                            ? "bg-zinc-800 text-white shadow-sm font-semibold ring-1 ring-zinc-700" 
                            : "text-zinc-400 hover:text-zinc-200"
                        )}
                      >
                        {opt.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* ЖАНРЫ */}
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">
                  Жанры
                </span>
                <MultiSelect
                  options={[
                    { value: 'all', label: 'Все жанры' },
                    ...Object.entries(GENRES_MAP)
                      .filter(([_, id]) => profile?.allow_nsfw_search || id !== '12')
                      .map(([name, id]) => ({ value: id, label: name }))
                  ]}
                  selected={Array.isArray(filters.genre) ? filters.genre : (filters.genre && filters.genre !== 'all' ? [filters.genre] : [])}
                  onChange={(selected: string[]) => updateFilter('genre', selected.includes('all') ? [] : selected)}
                  placeholder="Выберите жанры"
                  className="w-full bg-zinc-900/90 border-zinc-800/80 text-zinc-200 min-h-[2.5rem] rounded-xl text-xs" 
                />
              </div>

              {/* ГОДЫ ВЫХОДА */}
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">
                  Годы выхода
                </span>
                <MultiSelect
                  options={YEAR_OPTIONS}
                  selected={Array.isArray(filters.year) ? filters.year : (filters.year && filters.year !== 'all' ? [filters.year] : [])}
                  onChange={(selected: string[]) => updateFilter('year', selected.includes('all') ? [] : selected)}
                  placeholder="Выберите годы"
                  className="w-full bg-zinc-900/90 border-zinc-800/80 text-zinc-200 min-h-[2.5rem] rounded-xl text-xs"
                />
              </div>

            </div>

            {/* Футер с кнопкой Применить */}
            <div className="p-4 border-t border-zinc-800/80 bg-zinc-950 shrink-0 pb-8 sm:pb-4">
              <Button
                type="button"
                onClick={applyFilters}
                className="w-full h-10 rounded-xl text-xs font-semibold bg-orange-500 hover:bg-orange-600 text-white shadow-md shadow-orange-500/20 transition-all"
              >
                <Check className="w-4 h-4 mr-1.5" />
                Применить
              </Button>
            </div>
          </aside>
        </div>,
        document.body
      )}

      {/* ========================================================================= */}
      {/* 3. ОСНОВНОЙ КОНТЕНТ СТРАНИЦЫ */}
      {/* ========================================================================= */}

      <div className="container mx-auto px-3 sm:px-4 pt-3 sm:pt-4 max-w-7xl">
        <button
          onClick={handleGoBack}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-secondary/50 hover:bg-secondary border border-border/40 text-muted-foreground hover:text-foreground font-medium rounded-lg transition-all dark:bg-zinc-900/50 dark:hover:bg-zinc-900"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Назад
        </button>
      </div>

      <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-5 max-w-7xl">
        
        {/* Заголовок и переключатель сетки */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-baseline gap-2">
            <h1 className="text-lg sm:text-xl font-bold text-foreground border-l-4 border-orange-500 pl-2.5 dark:text-white">
              Каталог
            </h1>
            {!loading && (
              <span className="text-muted-foreground text-xs hidden sm:inline-block">
                ({animes.length})
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-0.5 bg-secondary/50 dark:bg-zinc-900/60 p-0.5 rounded-lg border border-border/40 dark:border-zinc-800/60">
            <button
               onClick={() => setViewMode('comfortable')}
               className={cn(
                 "p-1.5 rounded-md transition-all",
                 viewMode === 'comfortable' 
                   ? "bg-background text-foreground shadow-xs dark:bg-zinc-800 dark:text-white" 
                   : "text-muted-foreground hover:text-foreground dark:text-zinc-500"
               )}
               title="Сетка"
            >
               <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
               onClick={() => setViewMode('compact')}
               className={cn(
                 "p-1.5 rounded-md transition-all",
                 viewMode === 'compact' 
                   ? "bg-background text-foreground shadow-xs dark:bg-zinc-800 dark:text-white" 
                   : "text-muted-foreground hover:text-foreground dark:text-zinc-500"
               )}
               title="Компактно"
            >
               <Grid3x3 className="w-3.5 h-3.5" />
            </button>
            <button
               onClick={() => setViewMode('table')}
               className={cn(
                 "p-1.5 rounded-md transition-all",
                 viewMode === 'table' 
                   ? "bg-background text-foreground shadow-xs dark:bg-zinc-800 dark:text-white" 
                   : "text-muted-foreground hover:text-foreground dark:text-zinc-500"
               )}
               title="Список"
            >
               <Table className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Список аниме */}
        {(loading || isPending) && !loadingMore ? (
          <GridSkeleton items={24} />
        ) : animes.length > 0 ? (
          <>
            <div className={gridClass}>
              {animes.map((anime) => (
                <AnimeCard 
                  key={anime.id} 
                  anime={anime} 
                  variant={viewMode === 'compact' ? 'compact' : viewMode === 'table' ? 'table' : 'default'}
                />
              ))}
            </div>

            {hasMore && (
              <div className="mt-8 flex justify-center">
                <Button
                  onClick={loadMore}
                  disabled={loadingMore || isPending}
                  variant="outline"
                  className="px-6 py-3 h-auto text-xs sm:text-sm rounded-full bg-secondary/50 border-border/50 text-muted-foreground hover:bg-secondary hover:text-foreground transition-all w-full sm:w-auto dark:bg-zinc-900/50"
                >
                  {loadingMore ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                      Загрузка...
                    </>
                  ) : (
                    'Показать еще'
                  )}
                </Button>
              </div>
            )}

            {loadingMore && (
              <div className="mt-6">
                <GridSkeleton items={viewMode === 'compact' ? 8 : viewMode === 'table' ? 6 : 6} />
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 bg-secondary/20 rounded-2xl border border-border/30 border-dashed mx-auto max-w-md dark:bg-zinc-900/20">
            <Search className="w-8 h-8 text-muted-foreground/40 mb-2" />
            <p className="text-foreground text-sm font-medium">Ничего не найдено</p>
            <p className="text-muted-foreground text-xs mt-1 text-center">
              Попробуйте изменить параметры или сбросить фильтры
            </p>
            <Button variant="link" onClick={resetFilters} className="mt-2 text-xs text-orange-500">
              Сбросить фильтры
            </Button>
          </div>
        )}

        {/* Модалка случайного аниме */}
        {showRandomModal && randomAnime && (
          <RandomAnimeModal 
            anime={randomAnime} 
            onClose={() => setShowRandomModal(false)} 
          />
        )}
      </div>
    </div>
  )
}