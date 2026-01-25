'use client'

import { useState, useEffect, useCallback } from 'react'
import { AnimeCard } from '@/components/anime-card'
import { GridSkeleton } from '@/components/skeleton'
import type { Anime, CatalogFilters } from '@/lib/shikimori'
import { GENRES_MAP } from '@/lib/shikimori'
import { fetchAnimeData } from '@/app/catalog/actions'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { MultiSelect } from '@/components/ui/multi-select'
import { Input } from '@/components/ui/input'
import { Search, Filter, Loader2, X, RotateCcw, LayoutGrid, Grid3x3, Table, ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useAuth } from '@/components/auth-provider'

// ... (Ваши константы OPTIONS остаются без изменений)
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
  }, [initialFilters, profile, fetchAnimes])

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY
      if (currentScrollY > lastScrollY && currentScrollY > 100) {
        setIsFilterPanelVisible(false)
      } else {
        setIsFilterPanelVisible(true)
      }
      setLastScrollY(currentScrollY)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [lastScrollY])

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

    router.push(`/catalog?${params.toString()}`)
  }

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
    router.push('/catalog')
  }

  const resetFilters = () => {
    const defaultFilters: CatalogFilters = {
      page: 1,
      limit: 24,
      order: 'popularity',
      search: ''
    }
    setFilters(defaultFilters)
    router.push('/catalog')
  }

  const handleGoBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back()
    } else {
      router.push('/')
    }
  }

  const gridClass = viewMode === 'compact' 
    ? "grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-2 sm:gap-4"
    : viewMode === 'table'
    ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4"
    : "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-x-4 gap-y-6 sm:gap-y-8"

  return (
    <div className="min-h-screen pb-16 sm:pb-20">
      <div className={cn(
        "sticky top-16 md:top-20 bg-background/95 backdrop-blur-md border-b z-25 px-3 py-3 sm:px-4 sm:py-4 transition-transform duration-300 ease-in-out shadow-sm border-border dark:bg-zinc-950/95 dark:border-zinc-800",
        isFilterPanelVisible ? "translate-y-0" : "-translate-y-full"
      )}>
        <div className="container mx-auto px-0 max-w-7xl">
          <div className="flex flex-col md:flex-row gap-3 md:gap-4">
            
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Поиск по названию..."
                value={filters.search || ''}
                onChange={(e) => updateFilter('search', e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
                className="h-10 sm:h-11 w-full text-sm sm:text-base pl-10 bg-secondary border-border text-foreground placeholder-muted-foreground focus:ring-1 focus:ring-primary focus:border-primary transition-all dark:bg-zinc-900 dark:border-zinc-800 dark:text-white dark:placeholder-zinc-500 dark:focus:ring-orange-500 dark:focus:border-orange-500"
              />
              {filters.search && (
                <button 
                  onClick={clearSearch}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 dark:text-zinc-500 dark:hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            
            <div className="flex gap-2 w-full md:w-auto">
              <div className="flex gap-2 flex-1 md:flex-none">
                <Button
                  variant="outline"
                  onClick={() => setShowFilters(!showFilters)}
                  className={cn(
                    "flex-1 md:flex-none border h-10 sm:h-11 text-sm sm:text-base transition-colors border-border dark:border-zinc-800",
                    showFilters 
                      ? "bg-secondary text-foreground dark:bg-zinc-800 dark:text-white dark:border-zinc-700" 
                      : "bg-transparent text-muted-foreground hover:bg-secondary hover:text-foreground dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
                  )}
                >
                  <Filter className="w-4 h-4 sm:mr-2" />
                  <span className="inline">Фильтры</span>
                </Button>
                
                <Button
                  variant="outline"
                  onClick={resetFilters}
                  className="border-border bg-transparent h-10 sm:h-11 w-10 sm:w-11 px-0 hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors dark:border-zinc-800 dark:hover:bg-zinc-800 dark:text-zinc-400 dark:hover:text-white"
                  disabled={loading && !loadingMore}
                  title="Сбросить все"
                >
                  <RotateCcw className="w-4 h-4" />
                </Button>
              </div>

              <Button
                onClick={applyFilters}
                className="bg-primary hover:bg-primary/90 text-primary-foreground h-10 sm:h-11 min-w-[100px] sm:min-w-[120px] text-sm sm:text-base font-medium dark:bg-orange-600 dark:hover:bg-orange-700"
                disabled={loading && !loadingMore}
              >
                {loading && !loadingMore ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Применить'}
              </Button>
            </div>
          </div>

          {/* ИСПРАВЛЕННАЯ СЕТКА ФИЛЬТРОВ */}
          {showFilters && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mt-3 sm:mt-4 p-3 sm:p-4 bg-secondary/80 rounded-xl border animate-in fade-in slide-in-from-top-2 border-border dark:bg-zinc-900/80 dark:border-zinc-800">
              
              {/* Первая строка: Одиночные селекты (Сортировка, Статус, Тип, Рейтинг) */}
              <div className="col-span-1">
                <Select value={filters.order || 'popularity'} onValueChange={(v) => updateFilter('order', v)}>
                  <SelectTrigger className="w-full bg-secondary border-border text-foreground h-10 dark:bg-zinc-800 dark:border-zinc-700 dark:text-white"><SelectValue placeholder="Сортировка" /></SelectTrigger>
                  <SelectContent className="bg-background border text-foreground z-50 dark:bg-zinc-800 dark:border-zinc-700 dark:text-white">
                    {ORDER_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="col-span-1">
                <Select value={filters.status || 'all'} onValueChange={(v) => updateFilter('status', v)}>
                  <SelectTrigger className="w-full bg-secondary border-border text-foreground h-10 dark:bg-zinc-800 dark:border-zinc-700 dark:text-white"><SelectValue placeholder="Статус" /></SelectTrigger>
                  <SelectContent className="bg-background border text-foreground z-50 dark:bg-zinc-800 dark:border-zinc-700 dark:text-white">
                    {STATUS_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="col-span-1">
                <Select value={filters.kind || 'all'} onValueChange={(v) => updateFilter('kind', v)}>
                  <SelectTrigger className="w-full bg-secondary border-border text-foreground h-10 dark:bg-zinc-800 dark:border-zinc-700 dark:text-white"><SelectValue placeholder="Тип" /></SelectTrigger>
                  <SelectContent className="bg-background border text-foreground z-50 dark:bg-zinc-800 dark:border-zinc-700 dark:text-white">
                    {KIND_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="col-span-1">
                <Select value={filters.score || 'all'} onValueChange={(v) => updateFilter('score', v)}>
                  <SelectTrigger className="w-full bg-secondary border-border text-foreground h-10 dark:bg-zinc-800 dark:border-zinc-700 dark:text-white"><SelectValue placeholder="Рейтинг" /></SelectTrigger>
                  <SelectContent className="bg-background border text-foreground z-50 dark:bg-zinc-800 dark:border-zinc-700 dark:text-white">
                    {SCORE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Вторая строка: Жанры и Годы на всю ширину (или половину на десктопе) */}
              {/* Обратите внимание: h-auto и min-h-10 вместо жесткого h-10 */}
              <div className="col-span-2">
                 <MultiSelect
                  options={[
                    { value: 'all', label: 'Все жанры' },
                    ...Object.entries(GENRES_MAP).map(([name, id]) => ({ value: id, label: name }))
                  ]}
                  selected={Array.isArray(filters.genre) ? filters.genre : (filters.genre && filters.genre !== 'all' ? [filters.genre] : [])}
                  onChange={(selected) => updateFilter('genre', selected.includes('all') ? [] : selected)}
                  placeholder="Жанры"
                  className="w-full bg-secondary border-border text-foreground min-h-[2.5rem] h-auto py-1 dark:bg-zinc-800 dark:border-zinc-700 dark:text-white" 
                />
              </div>

              <div className="col-span-2">
                <MultiSelect
                  options={YEAR_OPTIONS}
                  selected={Array.isArray(filters.year) ? filters.year : (filters.year && filters.year !== 'all' ? [filters.year] : [])}
                  onChange={(selected) => updateFilter('year', selected.includes('all') ? [] : selected)}
                  placeholder="Годы"
                  className="w-full bg-secondary border-border text-foreground min-h-[2.5rem] h-auto py-1 dark:bg-zinc-800 dark:border-zinc-700 dark:text-white"
                />
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

        {loading && !loadingMore ? (
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
                  disabled={loadingMore}
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
      </div>
    </div>
  )
}