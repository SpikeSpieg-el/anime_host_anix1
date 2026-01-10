'use client'

import { useState, useEffect, useCallback } from 'react'
import { AnimeCard } from '@/components/anime-card'
import type { Anime, CatalogFilters } from '@/lib/shikimori'
import { GENRES_MAP } from '@/lib/shikimori'
import { fetchAnimeData } from '@/app/catalog/actions'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Search, Filter, Loader2, X } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'

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
]

export function CatalogClient({ initialFilters }: { initialFilters: CatalogFilters }) {
  const router = useRouter()
  
  // Состояние
  const [animes, setAnimes] = useState<Anime[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  
  // Инициализируем фильтры из пропсов
  const [filters, setFilters] = useState<CatalogFilters>(initialFilters)
  const [showFilters, setShowFilters] = useState(false)

  // Функция загрузки данных
  const fetchAnimes = useCallback(async (currentFilters: CatalogFilters, isLoadMore = false) => {
    if (isLoadMore) {
      setLoadingMore(true)
    } else {
      setLoading(true)
    }

    try {
      const { animes: data, hasMore: nextHasMore } = await fetchAnimeData(currentFilters)

      if (isLoadMore) {
        setAnimes(prev => [...prev, ...data])
      } else {
        setAnimes(data)
      }

      setHasMore(nextHasMore)
    } catch (error) {
      console.error('Error fetching catalog:', error)
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [])

  // 1. Эффект при монтировании или изменении ключа (навигация из меню)
  useEffect(() => {
    setFilters(initialFilters)
    fetchAnimes(initialFilters, false)
    // Мы не добавляем fetchAnimes в зависимости, чтобы избежать циклов, 
    // так как он зависит от стейта через useCallback (если бы зависел).
    // Но здесь initialFilters меняется только при смене URL (спасибо key={clientKey} в page.tsx)
  }, [initialFilters])

  // Применение фильтров (обновляем URL)
  const applyFilters = () => {
    const params = new URLSearchParams()
    
    if (filters.order) params.set('sort', filters.order)
    if (filters.genre && filters.genre !== 'all') params.set('genre', filters.genre)
    if (filters.status && filters.status !== 'all') params.set('status', filters.status)
    if (filters.kind && filters.kind !== 'all') params.set('kind', filters.kind)
    if (filters.year && filters.year !== 'all') params.set('year', filters.year)
    if (filters.search) params.set('search', filters.search)

    router.push(`/catalog?${params.toString()}`)
  }

  // Обновление конкретного фильтра в стейте (не вызывает перезагрузку сразу)
  const updateFilter = (key: keyof CatalogFilters, value: string) => {
    setFilters(prev => ({
      ...prev,
      [key]: value === 'all' ? undefined : value,
      page: 1
    }))
  }

  // Загрузить еще
  const loadMore = () => {
    if (!loadingMore && hasMore) {
      const nextPage = (filters.page || 1) + 1
      const newFilters = { ...filters, page: nextPage }
      setFilters(newFilters)
      fetchAnimes(newFilters, true)
    }
  }

  // Очистка поиска
  const clearSearch = () => {
    updateFilter('search', '')
    // Можно сразу применить, если хотим
    const newFilters = { ...filters, search: undefined, page: 1 }
    setFilters(newFilters)
    // fetchAnimes(newFilters, false) // Опционально, если хотим без перезагрузки URL
    router.push('/catalog') // Лучше сбросить URL
  }

  return (
    <div className="min-h-screen pb-20">
      {/* Панель фильтров */}
      <div className="sticky top-16 bg-zinc-950/95 backdrop-blur border-b border-zinc-800 z-30 p-4">
        <div className="container mx-auto">
          {/* Верхняя строка: Поиск и кнопки */}
          <div className="flex flex-col md:flex-row gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-400 w-4 h-4" />
              <Input
                placeholder="Поиск по названию..."
                value={filters.search || ''}
                onChange={(e) => updateFilter('search', e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
                className="pl-10 bg-zinc-900 border-zinc-800 text-white placeholder-zinc-500 focus:ring-orange-500"
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
            
            <div className="flex gap-2">
                <Button
                variant="outline"
                onClick={() => setShowFilters(!showFilters)}
                className={`border-zinc-800 hover:bg-zinc-800 ${showFilters ? 'bg-zinc-800 text-white' : 'text-zinc-400'}`}
                >
                <Filter className="w-4 h-4 mr-2" />
                Фильтры
                </Button>
                <Button
                onClick={applyFilters}
                className="bg-orange-600 hover:bg-orange-700 text-white min-w-[120px]"
                disabled={loading && !loadingMore}
                >
                {loading && !loadingMore ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Применить'}
                </Button>
            </div>
          </div>

          {/* Сетка фильтров (раскрывающаяся) */}
          {showFilters && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 p-4 bg-zinc-900/50 rounded-lg border border-zinc-800 animate-in fade-in slide-in-from-top-2">
              <Select value={filters.order || 'popularity'} onValueChange={(v) => updateFilter('order', v)}>
                <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white"><SelectValue placeholder="Сортировка" /></SelectTrigger>
                <SelectContent className="bg-zinc-800 border-zinc-700">{ORDER_OPTIONS.map(o => <SelectItem key={o.value} value={o.value} className="text-white hover:bg-zinc-700 focus:bg-zinc-700">{o.label}</SelectItem>)}</SelectContent>
              </Select>

              <Select value={filters.genre || 'all'} onValueChange={(v) => updateFilter('genre', v)}>
                <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white"><SelectValue placeholder="Жанр" /></SelectTrigger>
                <SelectContent className="bg-zinc-800 border-zinc-700 max-h-60">
                    <SelectItem value="all" className="text-white">Все жанры</SelectItem>
                    {Object.entries(GENRES_MAP).map(([name, id]) => (
                        <SelectItem key={id} value={id} className="text-white hover:bg-zinc-700 focus:bg-zinc-700">{name}</SelectItem>
                    ))}
                </SelectContent>
              </Select>

              <Select value={filters.status || 'all'} onValueChange={(v) => updateFilter('status', v)}>
                <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white"><SelectValue placeholder="Статус" /></SelectTrigger>
                <SelectContent className="bg-zinc-800 border-zinc-700">{STATUS_OPTIONS.map(o => <SelectItem key={o.value} value={o.value} className="text-white hover:bg-zinc-700 focus:bg-zinc-700">{o.label}</SelectItem>)}</SelectContent>
              </Select>

              <Select value={filters.kind || 'all'} onValueChange={(v) => updateFilter('kind', v)}>
                <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white"><SelectValue placeholder="Тип" /></SelectTrigger>
                <SelectContent className="bg-zinc-800 border-zinc-700">{KIND_OPTIONS.map(o => <SelectItem key={o.value} value={o.value} className="text-white hover:bg-zinc-700 focus:bg-zinc-700">{o.label}</SelectItem>)}</SelectContent>
              </Select>

              <Select value={filters.year || 'all'} onValueChange={(v) => updateFilter('year', v)}>
                <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white"><SelectValue placeholder="Год" /></SelectTrigger>
                <SelectContent className="bg-zinc-800 border-zinc-700">{YEAR_OPTIONS.map(o => <SelectItem key={o.value} value={o.value} className="text-white hover:bg-zinc-700 focus:bg-zinc-700">{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
        </div>
      </div>

      {/* Список Аниме */}
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-white border-l-4 border-orange-500 pl-4">
            Результаты поиска
          </h1>
          <span className="text-zinc-500 text-sm">
             {loading && !loadingMore ? 'Загрузка...' : `Найдено: ${animes.length}`}
          </span>
        </div>

        {loading && !loadingMore ? (
          <div className="flex justify-center items-center py-40">
            <Loader2 className="w-10 h-10 animate-spin text-orange-500" />
          </div>
        ) : (
          <>
            {animes.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-4 gap-y-8">
                    {animes.map((anime) => (
                    <AnimeCard key={anime.id} anime={anime} />
                    ))}
                </div>
            ) : (
                <div className="text-center py-20 bg-zinc-900/30 rounded-lg border border-zinc-800 border-dashed">
                    <p className="text-zinc-400 text-lg font-medium">Ничего не найдено</p>
                    <p className="text-zinc-600 text-sm mt-2">Попробуйте изменить параметры поиска</p>
                    <Button variant="link" onClick={() => router.push('/catalog')} className="mt-4 text-orange-500">
                        Сбросить фильтры
                    </Button>
                </div>
            )}

            {/* Load More */}
            {hasMore && animes.length > 0 && (
              <div className="mt-12 flex justify-center">
                <Button
                  onClick={loadMore}
                  disabled={loadingMore}
                  variant="outline"
                  className="px-8 py-6 rounded-full bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800 hover:text-white hover:border-orange-500/50 transition-all"
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
          </>
        )}
      </div>
    </div>
  )
}