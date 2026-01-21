'use client'

import { useState, useEffect, useCallback } from 'react'
import { AnimeCard } from '@/components/anime-card'
import { AnimeCardSkeleton, GridSkeleton } from '@/components/skeleton'
import type { Anime, CatalogFilters } from '@/lib/shikimori'
import { GENRES_MAP } from '@/lib/shikimori'
import { fetchAnimeData } from '@/app/catalog/actions'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Search, Filter, Loader2, X, RotateCcw, LayoutGrid, Grid3x3, Table, ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

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
  
  const [animes, setAnimes] = useState<Anime[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [filters, setFilters] = useState<CatalogFilters>(initialFilters)
  const [showFilters, setShowFilters] = useState(false)
  
  // Состояние для режима отображения (comfortable = 2col, compact = 3col on mobile, table = tile table)
  const [viewMode, setViewMode] = useState<'comfortable' | 'compact' | 'table'>('comfortable')
  
  // Состояние для скрытия панели фильтров при скролле
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
    setFilters(initialFilters)
    fetchAnimes(initialFilters, false)
  }, [initialFilters, fetchAnimes])

  // Эффект для отслеживания скролла и скрытия/показа панели фильтров
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY
      
      // Скрываем панель при скролле вниз, показываем при скролле вверх
      if (currentScrollY > lastScrollY && currentScrollY > 100) {
        setIsFilterPanelVisible(false)
      } else {
        setIsFilterPanelVisible(true)
      }
      
      setLastScrollY(currentScrollY)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    
    return () => {
      window.removeEventListener('scroll', handleScroll)
    }
  }, [lastScrollY])

  const applyFilters = () => {
    const params = new URLSearchParams()
    if (filters.order) params.set('sort', filters.order)
    if (filters.genre && filters.genre !== 'all') params.set('genre', filters.genre)
    if (filters.status && filters.status !== 'all') params.set('status', filters.status)
    if (filters.kind && filters.kind !== 'all') params.set('kind', filters.kind)
    if (filters.year && filters.year !== 'all') params.set('year', filters.year)
    if (filters.score && filters.score !== 'all') params.set('score', filters.score)
    if (filters.search) params.set('search', filters.search)

    router.push(`/catalog?${params.toString()}`)
  }

  const updateFilter = (key: keyof CatalogFilters, value: string) => {
    setFilters(prev => ({
      ...prev,
      [key]: value === 'all' ? undefined : value,
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
      order: 'popularity'
    }
    setFilters(defaultFilters)
    router.push('/catalog')
  }

  const handleGoBack = () => {
    // Проверяем, есть ли история для возврата
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back()
    } else {
      // Если истории нет, переходим на главную
      router.push('/')
    }
  }

  // Стили сетки в зависимости от режима
  const gridClass = viewMode === 'compact' 
    ? "grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-2 sm:gap-4"
    : viewMode === 'table'
    ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4"
    : "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-x-4 gap-y-6 sm:gap-y-8"

  return (
    <div className="min-h-screen pb-16 sm:pb-20">
      {/* Панель управления */}
      <div className={cn(
        "sticky top-16 md:top-20 bg-zinc-950/95 backdrop-blur border-b border-zinc-800 z-30 px-3 py-3 sm:px-4 sm:py-4 transition-transform duration-300 ease-in-out",
        isFilterPanelVisible ? "translate-y-0" : "-translate-y-full"
      )}>
        <div className="container mx-auto px-0">
          <div className="flex flex-col md:flex-row gap-3 md:gap-4 mb-3 sm:mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-400 w-4 h-4" />
              <Input
                placeholder="Поиск по названию..."
                value={filters.search || ''}
                onChange={(e) => updateFilter('search', e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
                className="h-10 sm:h-11 text-sm sm:text-base pl-10 bg-zinc-900 border-zinc-800 text-white placeholder-zinc-500 focus:ring-orange-500"
              />
              {filters.search && (
                <button 
                  onClick={clearSearch}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-zinc-500 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            
            <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
              <div className="flex gap-2 flex-1">
                <Button
                  variant="outline"
                  onClick={() => setShowFilters(!showFilters)}
                  className={`border-zinc-800 hover:bg-zinc-800 ${showFilters ? 'bg-zinc-800 text-white' : 'text-zinc-400'} flex-1 text-sm sm:text-base`}
                >
                  <Filter className="w-4 h-4 mr-2" />
                  <span className="hidden sm:inline">Фильтры</span>
                  <span className="sm:hidden">Фильтры</span>
                </Button>
                
                {/* Кнопка сброса */}
                <Button
                  variant="outline"
                  onClick={resetFilters}
                  className="border-zinc-800 hover:bg-zinc-800 text-zinc-400 px-3 text-sm sm:text-base"
                  disabled={loading && !loadingMore}
                  title="Сбросить фильтры"
                >
                  <RotateCcw className="w-4 h-4" />
                </Button>
              </div>
              <Button
                onClick={applyFilters}
                className="bg-orange-600 hover:bg-orange-700 text-white min-w-[100px] sm:min-w-[120px] text-sm sm:text-base"
                disabled={loading && !loadingMore}
              >
                {loading && !loadingMore ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Применить'}
              </Button>
            </div>
          </div>

          {showFilters && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4 p-3 sm:p-4 bg-zinc-900/50 rounded-lg border border-zinc-800 animate-in fade-in slide-in-from-top-2 max-h-[70vh] overflow-y-auto">
              {/* Селекты фильтров ... (код селектов остается прежним) */}
              <Select value={filters.order || 'popularity'} onValueChange={(v) => updateFilter('order', v)}>
                <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white"><SelectValue placeholder="Сортировка" /></SelectTrigger>
                <SelectContent className="bg-zinc-800 border-zinc-700">
                  {ORDER_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>

              <Select value={filters.genre || 'all'} onValueChange={(v) => updateFilter('genre', v)}>
                <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white"><SelectValue placeholder="Жанр" /></SelectTrigger>
                <SelectContent className="bg-zinc-800 border-zinc-700 max-h-60">
                  <SelectItem value="all">Все жанры</SelectItem>
                  {Object.entries(GENRES_MAP).map(([name, id]) => (
                    <SelectItem key={id} value={id}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filters.status || 'all'} onValueChange={(v) => updateFilter('status', v)}>
                <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white"><SelectValue placeholder="Статус" /></SelectTrigger>
                <SelectContent className="bg-zinc-800 border-zinc-700">
                  {STATUS_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>

              <Select value={filters.kind || 'all'} onValueChange={(v) => updateFilter('kind', v)}>
                <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white"><SelectValue placeholder="Тип" /></SelectTrigger>
                <SelectContent className="bg-zinc-800 border-zinc-700">
                  {KIND_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>

              <Select value={filters.year || 'all'} onValueChange={(v) => updateFilter('year', v)}>
                <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white"><SelectValue placeholder="Год" /></SelectTrigger>
                <SelectContent className="bg-zinc-800 border-zinc-700">
                  {YEAR_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>

              <Select value={filters.score || 'all'} onValueChange={(v) => updateFilter('score', v)}>
                <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white"><SelectValue placeholder="Рейтинг (от)" /></SelectTrigger>
                <SelectContent className="bg-zinc-800 border-zinc-700">
                  {SCORE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </div>

      {/* Кнопка "Назад" над заголовком */}
      <div className="container mx-auto px-3 sm:px-4 pt-4 sm:pt-6">
        <button
          onClick={handleGoBack}
          className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-orange-500 text-zinc-400 hover:text-white font-medium rounded-xl transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          Назад
        </button>
      </div>

      {/* Основной контент */}
      <div className="container mx-auto px-3 sm:px-4 py-6 sm:py-8">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-6 sm:mb-8">
          <div className="flex items-center justify-between w-full sm:w-auto">
            <h1 className="text-xl sm:text-2xl font-bold text-white border-l-4 border-orange-500 pl-4">
              Результаты
            </h1>
            
            {/* ПЕРЕКЛЮЧАТЕЛЬ ВИДА (ТОЛЬКО НА ЭТОЙ СТРАНИЦЕ) */}
            <div className="flex items-center gap-1 bg-zinc-900 rounded-lg p-1 border border-zinc-800 ml-4">
                <button
                   onClick={() => setViewMode('comfortable')}
                   className={cn(
                     "p-1.5 rounded-md transition-all",
                     viewMode === 'comfortable' ? "bg-zinc-800 text-white shadow-sm" : "text-zinc-500 hover:text-zinc-300"
                   )}
                   title="Крупная сетка"
                >
                   <LayoutGrid className="w-5 h-5" />
                </button>
                <button
                   onClick={() => setViewMode('compact')}
                   className={cn(
                     "p-1.5 rounded-md transition-all",
                     viewMode === 'compact' ? "bg-zinc-800 text-white shadow-sm" : "text-zinc-500 hover:text-zinc-300"
                   )}
                   title="Компактная сетка"
                >
                   <Grid3x3 className="w-5 h-5" />
                </button>
                <button
                   onClick={() => setViewMode('table')}
                   className={cn(
                     "p-1.5 rounded-md transition-all",
                     viewMode === 'table' ? "bg-zinc-800 text-white shadow-sm" : "text-zinc-500 hover:text-zinc-300"
                   )}
                   title="Таблица плитками"
                >
                   <Table className="w-5 h-5" />
                </button>
            </div>
          </div>
          
          {!loading && (
            <span className="text-zinc-500 text-xs sm:text-sm sm:text-right hidden sm:inline-block">
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
                  className="px-5 py-3 text-sm sm:px-8 sm:py-4 sm:text-base rounded-full bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800 hover:text-white hover:border-orange-500/50 transition-all"
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
          <div className="text-center py-12 sm:py-20 bg-zinc-900/30 rounded-lg border border-zinc-800 border-dashed">
            <p className="text-zinc-400 text-base sm:text-lg font-medium">Ничего не найдено</p>
            <p className="text-zinc-600 text-sm mt-2">Попробуйте изменить параметры поиска</p>
            <Button variant="link" onClick={resetFilters} className="mt-4 text-orange-500">
              Сбросить фильтры
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}