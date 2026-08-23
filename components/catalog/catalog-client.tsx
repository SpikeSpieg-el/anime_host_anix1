'use client'

import { useState, useEffect, useCallback, useRef, useTransition } from 'react'
import { AnimeCard } from '@/components/shared/anime-card'
import { GridSkeleton } from '@/components/shared/skeleton'
import type { Anime, CatalogFilters } from '@/lib/shikimori'
import { RandomAnimeModal } from '@/components/catalog/random-anime-modal'
import { GENRES_MAP } from '@/lib/shikimori'
import { fetchAnimeData } from '@/app/catalog/actions'
import { fetchRandomAnime } from '@/app/catalog/actions/get-random-anime'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { MultiSelect } from '@/components/ui/multi-select'
import { Input } from '@/components/ui/input'
import { 
  Search, 
  Filter, 
  Loader2, 
  X, 
  RotateCcw, 
  LayoutGrid, 
  Grid3x3, 
  Table, 
  ArrowLeft, 
  Star,
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
  { value: 'all', label: 'Все статусы' },
  { value: 'ongoing', label: 'Онгоинги' },
  { value: 'released', label: 'Вышедшие' },
  { value: 'anons', label: 'Анонсы' },
]

const KIND_OPTIONS = [
  { value: 'all', label: 'Все типы' },
  { value: 'tv', label: 'ТВ сериал' },
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
  { value: 'all', label: 'Любой рейтинг' },
  { value: '9', label: 'От 9★' },
  { value: '8', label: 'От 8★' },
  { value: '7', label: 'От 7★' },
  { value: '6', label: 'От 6★' },
  { value: '5', label: 'От 5★' },
]

export function CatalogClient({ initialFilters }: { initialFilters: CatalogFilters }) {
  const router = useRouter()
  const { profile } = useAuth()
  
  const [isPending, startTransition] = useTransition()
  
  const [animes, setAnimes] = useState<Anime[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  
  const normalizeGenre = (g: string | string[] | undefined): string | string[] | undefined => {
    if (!g || (Array.isArray(g) && g.length === 0) || g === 'all') return 'all';
    if (Array.isArray(g)) {
      return g.map(genre => {
        if (genre === 'all') return null;
        return GENRES_MAP[genre] || genre;
      }).filter((item): item is string => item !== null);
    }
    if (GENRES_MAP[g]) return GENRES_MAP[g];
    return g;
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
  
  const isInitialMount = useRef(true)
  const prevFiltersRef = useRef<CatalogFilters | null>(null)

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
    prevFiltersRef.current = updatedFilters
  }, [initialFilters, profile?.allow_nsfw_search, fetchAnimes])

  // Функция для применения фильтров по кнопке
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
  }

  useEffect(() => {
    if (isInitialMount.current) return
    
    const currentUrl = window.location.pathname + window.location.search
    const params = new URLSearchParams(currentUrl)
    
    const urlOrder = params.get('sort')
    const urlGenre = params.get('genre')
    const urlStatus = params.get('status')
    const urlKind = params.get('kind')
    const urlYear = params.get('year')
    const urlScore = params.get('score')
    const urlSearch = params.get('search')
    
    const hasUrlChanges = 
      (urlOrder && filters.order !== urlOrder) ||
      (urlGenre && JSON.stringify(filters.genre) !== JSON.stringify(urlGenre ? urlGenre.split(',') : [])) ||
      (urlStatus && filters.status !== urlStatus) ||
      (urlKind && filters.kind !== urlKind) ||
      (urlYear && JSON.stringify(filters.year) !== JSON.stringify(urlYear.split(',') || [])) ||
      (urlScore && filters.score !== urlScore) ||
      (urlSearch && filters.search !== urlSearch)
    
    if (!hasUrlChanges) return
    
    prevFiltersRef.current = { ...filters }
  }, [filters])

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY
      if (currentScrollY > lastScrollY && currentScrollY > 120) {
        setIsFilterPanelVisible(false)
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

  const hasActiveFilters = Boolean(
    filters.search || 
    (filters.genre && filters.genre !== 'all' && (!Array.isArray(filters.genre) || filters.genre.length > 0)) || 
    (filters.status && filters.status !== 'all') || 
    (filters.kind && filters.kind !== 'all') || 
    (filters.year && filters.year !== 'all' && (!Array.isArray(filters.year) || filters.year.length > 0)) || 
    (filters.score && filters.score !== 'all') || 
    (filters.order && filters.order !== 'popularity')
  )

  return (
    <div className={cn("min-h-screen pb-16 sm:pb-20 transition-opacity duration-200", isPending && "opacity-75 pointer-events-none")}>
      <div className={cn(
        "sticky top-16 md:top-20 bg-background/95 backdrop-blur-md border-b z-25 px-3 py-3 sm:px-4 sm:py-4 transition-transform duration-300 ease-in-out shadow-sm border-border dark:bg-zinc-950/95 dark:border-zinc-800",
        isFilterPanelVisible ? "translate-y-0" : "-translate-y-full"
      )}>
        <div className="container mx-auto px-0 max-w-7xl">
          <div className="flex flex-col md:flex-row gap-3 md:gap-4">

            {/* Поисковая строка */}
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4 pointer-events-none" />
              <Input
                placeholder="Поиск по названию..."
                value={filters.search || ''}
                onChange={(e) => updateFilter('search', e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') applyFilters()
                }}
                className="h-10 sm:h-11 w-full text-sm sm:text-base pl-10 pr-24 bg-secondary border-border text-foreground placeholder-muted-foreground focus:ring-1 focus:ring-primary focus:border-primary transition-all dark:bg-zinc-900 dark:border-zinc-800 dark:text-white dark:placeholder-zinc-500 dark:focus:ring-orange-500 dark:focus:border-orange-500 rounded-xl"
              />
              <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center gap-1.5">
                {filters.search && (
                  <button
                    onClick={clearSearch}
                    className="p-1 text-muted-foreground hover:text-foreground rounded dark:text-zinc-500 dark:hover:text-white"
                    type="button"
                    title="Очистить поиск"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
                <Button
                  size="sm"
                  onClick={applyFilters}
                  disabled={!hasActiveFilters}
                  className="h-7 sm:h-8 px-2.5 sm:px-3 text-xs font-medium bg-primary hover:bg-primary/90 text-white rounded-lg shadow-sm dark:bg-orange-500 dark:hover:bg-orange-600 disabled:opacity-40"
                  title="Применить поиск"
                >
                  Найти
                </Button>
              </div>
            </div>

            {/* Верхний ряд управляющих кнопок */}
            <div className="flex gap-2 w-full md:w-auto">
              <div className="flex gap-2 flex-1 md:flex-none">
                <Button
                  variant="outline"
                  onClick={() => setShowFilters(!showFilters)}
                  className={cn(
                    "flex-1 md:flex-none border h-10 sm:h-11 text-sm sm:text-base font-medium rounded-xl transition-all border-border dark:border-zinc-800",
                    showFilters
                      ? "bg-primary text-white border-primary dark:bg-orange-500 dark:border-orange-500 shadow-sm"
                      : "bg-secondary text-foreground hover:bg-secondary/80 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white"
                  )}
                >
                  <Filter className="w-4 h-4 mr-2" />
                  <span>Фильтры</span>
                </Button>

                <Button
                  variant="outline"
                  onClick={showRandomAnime}
                  className="border-border bg-secondary h-10 sm:h-11 w-10 sm:w-11 px-0 rounded-xl hover:bg-secondary/80 text-foreground transition-colors dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white"
                  title="Случайное аниме"
                >
                  <Star className="w-4 h-4" />
                </Button>

                <Button
                  variant="outline"
                  onClick={resetFilters}
                  className="border-border bg-secondary h-10 sm:h-11 w-10 sm:w-11 px-0 rounded-xl hover:bg-secondary/80 text-foreground transition-colors dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white disabled:opacity-50"
                  disabled={(loading || isPending) && !loadingMore}
                  title="Сбросить все"
                >
                  <RotateCcw className="w-4 h-4" />
                </Button>
              </div>

              {(loading || isPending) && !loadingMore && (
                <div className="flex items-center gap-2 px-3 sm:px-4 h-10 sm:h-11 bg-secondary/50 border border-border rounded-xl text-muted-foreground dark:bg-zinc-900/50 dark:border-zinc-800">
                  <Loader2 className="w-4 h-4 animate-spin text-primary dark:text-orange-500" />
                  <span className="text-xs sm:text-sm font-medium hidden sm:inline">Загрузка...</span>
                </div>
              )}
            </div>
          </div>

          {/* Блок расширенных фильтров */}
          {showFilters && (
            <div className="mt-3 sm:mt-4 p-3.5 sm:p-5 bg-secondary/90 dark:bg-zinc-900/95 rounded-2xl border border-border dark:border-zinc-800 shadow-md animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <div className="col-span-1">
                  <label className="text-[11px] font-medium text-muted-foreground dark:text-zinc-400 mb-1 block uppercase tracking-wider">
                    Сортировка
                  </label>
                  <Select value={filters.order || 'popularity'} onValueChange={(v: string) => updateFilter('order', v)}>
                    <SelectTrigger className="h-10 text-xs sm:text-sm bg-background border-border dark:bg-zinc-950 dark:border-zinc-800 dark:text-white rounded-xl">
                      <SelectValue placeholder="Сортировка" />
                    </SelectTrigger>
                    <SelectContent className="bg-background border-border dark:bg-zinc-950 dark:border-zinc-800">
                      {ORDER_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value} className="dark:text-white dark:focus:bg-zinc-800">{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="col-span-1">
                  <label className="text-[11px] font-medium text-muted-foreground dark:text-zinc-400 mb-1 block uppercase tracking-wider">
                    Статус
                  </label>
                  <Select value={filters.status || 'all'} onValueChange={(v: string) => updateFilter('status', v)}>
                    <SelectTrigger className="h-10 text-xs sm:text-sm bg-background border-border dark:bg-zinc-950 dark:border-zinc-800 dark:text-white rounded-xl">
                      <SelectValue placeholder="Статус" />
                    </SelectTrigger>
                    <SelectContent className="bg-background border-border dark:bg-zinc-950 dark:border-zinc-800">
                      {STATUS_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value} className="dark:text-white dark:focus:bg-zinc-800">{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="col-span-1">
                  <label className="text-[11px] font-medium text-muted-foreground dark:text-zinc-400 mb-1 block uppercase tracking-wider">
                    Тип
                  </label>
                  <Select value={filters.kind || 'all'} onValueChange={(v: string) => updateFilter('kind', v)}>
                    <SelectTrigger className="h-10 text-xs sm:text-sm bg-background border-border dark:bg-zinc-950 dark:border-zinc-800 dark:text-white rounded-xl">
                      <SelectValue placeholder="Тип" />
                    </SelectTrigger>
                    <SelectContent className="bg-background border-border dark:bg-zinc-950 dark:border-zinc-800">
                      {KIND_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value} className="dark:text-white dark:focus:bg-zinc-800">{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="col-span-1">
                  <label className="text-[11px] font-medium text-muted-foreground dark:text-zinc-400 mb-1 block uppercase tracking-wider">
                    Рейтинг
                  </label>
                  <Select value={filters.score || 'all'} onValueChange={(v: string) => updateFilter('score', v)}>
                    <SelectTrigger className="h-10 text-xs sm:text-sm bg-background border-border dark:bg-zinc-950 dark:border-zinc-800 dark:text-white rounded-xl">
                      <SelectValue placeholder="Рейтинг" />
                    </SelectTrigger>
                    <SelectContent className="bg-background border-border dark:bg-zinc-950 dark:border-zinc-800">
                      {SCORE_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value} className="dark:text-white dark:focus:bg-zinc-800">{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="col-span-1 sm:col-span-2">
                  <label className="text-[11px] font-medium text-muted-foreground dark:text-zinc-400 mb-1 block uppercase tracking-wider">
                    Жанры
                  </label>
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
                    className="w-full bg-background border-border text-foreground min-h-[2.5rem] rounded-xl dark:bg-zinc-950 dark:border-zinc-800 dark:text-white" 
                  />
                </div>

                <div className="col-span-1 sm:col-span-2">
                  <label className="text-[11px] font-medium text-muted-foreground dark:text-zinc-400 mb-1 block uppercase tracking-wider">
                    Год выпуска
                  </label>
                  <MultiSelect
                    options={YEAR_OPTIONS}
                    selected={Array.isArray(filters.year) ? filters.year : (filters.year && filters.year !== 'all' ? [filters.year] : [])}
                    onChange={(selected: string[]) => updateFilter('year', selected.includes('all') ? [] : selected)}
                    placeholder="Выберите годы"
                    className="w-full bg-background border-border text-foreground min-h-[2.5rem] rounded-xl dark:bg-zinc-950 dark:border-zinc-800 dark:text-white"
                  />
                </div>
              </div>

              {/* Панель кнопок применения/сброса */}
              <div className="mt-4 pt-3.5 sm:pt-4 border-t border-border/60 dark:border-zinc-800 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 sm:gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={resetFilters}
                  disabled={(loading || isPending) && !loadingMore}
                  className="w-full sm:w-auto h-10 px-4 text-xs sm:text-sm font-medium border-border/80 bg-background/80 hover:bg-background text-muted-foreground hover:text-foreground dark:border-zinc-800 dark:bg-zinc-950/80 dark:hover:bg-zinc-800 dark:text-zinc-400 dark:hover:text-white rounded-xl transition-all"
                >
                  <RotateCcw className="w-3.5 h-3.5 mr-2" />
                  Сбросить
                </Button>
                
                <Button
                  type="button"
                  onClick={applyFilters}
                  disabled={!hasActiveFilters}
                  className="w-full sm:w-auto h-10 px-6 text-xs sm:text-sm font-semibold bg-primary hover:bg-primary/90 text-white dark:bg-orange-500 dark:hover:bg-orange-600 rounded-xl shadow-md shadow-primary/20 dark:shadow-orange-500/20 transition-all"
                >
                  <Check className="w-4 h-4 mr-1.5" />
                  Применить фильтры
                </Button>
              </div>
            </div>
          )}

        </div>
      </div>

      <div className="container mx-auto px-3 sm:px-4 pt-4 sm:pt-6 max-w-7xl">
        <button
          onClick={handleGoBack}
          className="inline-flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 text-sm bg-secondary hover:bg-accent border border-border hover:border-border text-muted-foreground hover:text-foreground font-medium rounded-lg transition-all dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:border-zinc-800 dark:hover:border-zinc-700 dark:text-zinc-400 dark:hover:text-white"
        >
          <ArrowLeft className="w-4 h-4" />
          Назад
        </button>
      </div>

      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8 max-w-7xl">
        <div className="flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between mb-6">
          <div className="flex items-center justify-between w-full">
            <h1 className="text-xl sm:text-2xl font-bold text-foreground border-l-4 border-orange-500 pl-3 sm:pl-4 dark:text-white">
              Результаты
            </h1>
            
            <div className="flex items-center gap-1 bg-secondary rounded-lg p-1 border border-border ml-auto dark:bg-zinc-900 dark:border-zinc-800">
                <button
                   onClick={() => setViewMode('comfortable')}
                   className={cn(
                     "p-1.5 rounded-md transition-all",
                     viewMode === 'comfortable' 
                       ? "bg-background text-foreground shadow-sm dark:bg-zinc-800 dark:text-white" 
                       : "text-muted-foreground hover:text-foreground dark:text-zinc-500 dark:hover:text-zinc-300"
                   )}
                   title="Сетка"
                >
                   <LayoutGrid className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
                <button
                   onClick={() => setViewMode('compact')}
                   className={cn(
                     "p-1.5 rounded-md transition-all",
                     viewMode === 'compact' 
                       ? "bg-background text-foreground shadow-sm dark:bg-zinc-800 dark:text-white" 
                       : "text-muted-foreground hover:text-foreground dark:text-zinc-500 dark:hover:text-zinc-300"
                   )}
                   title="Компактно"
                >
                   <Grid3x3 className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
                <button
                   onClick={() => setViewMode('table')}
                   className={cn(
                     "p-1.5 rounded-md transition-all",
                     viewMode === 'table' 
                       ? "bg-background text-foreground shadow-sm dark:bg-zinc-800 dark:text-white" 
                       : "text-muted-foreground hover:text-foreground dark:text-zinc-500 dark:hover:text-zinc-300"
                   )}
                   title="Список"
                >
                   <Table className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
            </div>
          </div>
          
          {!loading && (
            <span className="text-muted-foreground text-xs sm:text-sm hidden sm:inline-block whitespace-nowrap dark:text-zinc-500">
              Найдено: {animes.length}
            </span>
          )}
        </div>

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
              <div className="mt-12 flex justify-center">
                <Button
                  onClick={loadMore}
                  disabled={loadingMore || isPending}
                  variant="outline"
                  className="px-6 py-4 sm:px-8 sm:py-6 h-auto text-sm sm:text-base rounded-full bg-secondary border-border text-muted-foreground hover:bg-accent hover:text-foreground hover:border-primary/50 transition-all w-full sm:w-auto dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white dark:hover:border-orange-500/50"
                >
                  {loadingMore ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Загрузка...
                    </>
                  ) : (
                    'Показать еще'
                  )}
                </Button>
              </div>
            )}

            {loadingMore && (
              <div className="mt-8">
                <GridSkeleton items={viewMode === 'compact' ? 8 : viewMode === 'table' ? 6 : 6} />
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 sm:py-24 bg-secondary/30 rounded-2xl border border-border border-dashed mx-auto max-w-2xl dark:bg-zinc-900/30 dark:border-zinc-800">
            <Search className="w-12 h-12 text-muted-foreground/50 mb-4 dark:text-zinc-700" />
            <p className="text-muted-foreground text-lg sm:text-xl font-medium text-center dark:text-zinc-400">Ничего не найдено</p>
            <p className="text-muted-foreground/70 text-sm mt-2 text-center max-w-xs sm:max-w-md dark:text-zinc-600">
              Попробуйте изменить параметры поиска или сбросить фильтры
            </p>
            <Button variant="link" onClick={resetFilters} className="mt-6 text-primary hover:text-primary/80 dark:text-orange-500 dark:hover:text-orange-400">
              Сбросить все фильтры
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