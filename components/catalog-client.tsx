'use client'

import { useState, useEffect } from 'react'
import { AnimeCard } from './anime-card'
import { fetchAnimeData } from '@/app/catalog/actions'
import { Anime, CatalogFilters, GENRES_MAP } from '@/lib/shikimori'
import { Button } from './ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Input } from './ui/input'
import { Search, Filter, Loader2 } from 'lucide-react'

const ORDER_OPTIONS = [
  { value: 'popularity', label: 'Популярные' },
  { value: 'aired_on', label: 'Новинки' },
  { value: 'ranked', label: 'Рейтинг' },
]

const STATUS_OPTIONS = [
  { value: '', label: 'Все статусы' },
  { value: 'ongoing', label: 'Онгоинги' },
  { value: 'released', label: 'Вышедшие' },
  { value: 'anons', label: 'Анонсы' },
]

const KIND_OPTIONS = [
  { value: '', label: 'Все типы' },
  { value: 'tv', label: 'ТВ сериал' },
  { value: 'movie', label: 'Фильм' },
  { value: 'ova', label: 'OVA' },
  { value: 'ona', label: 'ONA' },
  { value: 'special', label: 'Спешл' },
]

const YEAR_OPTIONS = [
  { value: '', label: 'Все годы' },
  { value: '2025', label: '2025' },
  { value: '2024', label: '2024' },
  { value: '2023', label: '2023' },
  { value: '2022', label: '2022' },
  { value: '2021', label: '2021' },
  { value: '2020', label: '2020' },
]

export function CatalogClient({ initialFilters }: { initialFilters?: CatalogFilters }) {
  const [animes, setAnimes] = useState<Anime[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [filters, setFilters] = useState<CatalogFilters>({
    page: 1,
    limit: 24,
    order: 'popularity',
    ...initialFilters
  })
  const [showFilters, setShowFilters] = useState(false)

  // Загрузка данных
  const loadData = async (page: number, isLoadMore = false) => {
    if (isLoadMore) {
      setLoadingMore(true)
    } else {
      setLoading(true)
      setAnimes([])
    }

    try {
      const result = await fetchAnimeData({
        ...filters,
        page
      })

      if (isLoadMore) {
        setAnimes(prev => [...prev, ...result.animes])
      } else {
        setAnimes(result.animes)
      }

      setHasMore(result.hasMore)
      setCurrentPage(page)
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }

  // Первоначальная загрузка
  useEffect(() => {
    loadData(1)
  }, [])

  // Применение фильтров
  const applyFilters = () => {
    setCurrentPage(1)
    setHasMore(true)
    loadData(1)
  }

  // Сброс фильтров
  const resetFilters = () => {
    const defaultFilters = {
      page: 1,
      limit: 24,
      order: 'popularity',
      genre: '',
      status: '',
      kind: '',
      year: '',
      search: ''
    }
    setFilters(defaultFilters)
    setCurrentPage(1)
    setHasMore(true)
    loadData(1)
  }

  // Загрузить еще
  const loadMore = () => {
    if (!loadingMore && hasMore) {
      loadData(currentPage + 1, true)
    }
  }

  // Обновление фильтра
  const updateFilter = (key: keyof CatalogFilters, value: string) => {
    setFilters(prev => ({
      ...prev,
      [key]: value || undefined,
      page: 1 // Сбрасываем страницу при изменении фильтров
    }))
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white pb-20">
      {/* Панель фильтров */}
      <div className="sticky top-0 bg-zinc-950 border-b border-zinc-800 z-10 p-4">
        <div className="container mx-auto">
          {/* Поиск и кнопка фильтров */}
          <div className="flex gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-400 w-4 h-4" />
              <Input
                placeholder="Поиск аниме..."
                value={filters.search || ''}
                onChange={(e) => updateFilter('search', e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    applyFilters()
                  }
                }}
                className="pl-10 bg-zinc-900 border-zinc-800 text-white placeholder-zinc-500"
              />
            </div>
            <Button
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
              className="border-zinc-800 text-white hover:bg-zinc-800"
            >
              <Filter className="w-4 h-4 mr-2" />
              Фильтры
            </Button>
            <Button
              onClick={applyFilters}
              disabled={loading}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Применить'}
            </Button>
          </div>

          {/* Расширенные фильтры */}
          {showFilters && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 p-4 bg-zinc-900 rounded-lg">
              {/* Сортировка */}
              <Select value={filters.order || 'popularity'} onValueChange={(value) => updateFilter('order', value)}>
                <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
                  <SelectValue placeholder="Сортировка" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-800 border-zinc-700">
                  {ORDER_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value} className="text-white hover:bg-zinc-700">
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Жанр */}
              <Select value={filters.genre || 'all'} onValueChange={(value) => updateFilter('genre', value === 'all' ? '' : value)}>
                <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
                  <SelectValue placeholder="Жанр" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-800 border-zinc-700 max-h-60">
                  <SelectItem value="all" className="text-white hover:bg-zinc-700">Все жанры</SelectItem>
                  {Object.entries(GENRES_MAP).map(([name, id]) => (
                    <SelectItem key={id} value={id} className="text-white hover:bg-zinc-700">
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Статус */}
              <Select value={filters.status || 'all'} onValueChange={(value) => updateFilter('status', value === 'all' ? '' : value)}>
                <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
                  <SelectValue placeholder="Статус" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-800 border-zinc-700">
                  {STATUS_OPTIONS.map(option => (
                    <SelectItem key={option.value || 'all'} value={option.value || 'all'} className="text-white hover:bg-zinc-700">
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Тип */}
              <Select value={filters.kind || 'all'} onValueChange={(value) => updateFilter('kind', value === 'all' ? '' : value)}>
                <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
                  <SelectValue placeholder="Тип" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-800 border-zinc-700">
                  {KIND_OPTIONS.map(option => (
                    <SelectItem key={option.value || 'all'} value={option.value || 'all'} className="text-white hover:bg-zinc-700">
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Год */}
              <Select value={filters.year || 'all'} onValueChange={(value) => updateFilter('year', value === 'all' ? '' : value)}>
                <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
                  <SelectValue placeholder="Год" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-800 border-zinc-700">
                  {YEAR_OPTIONS.map(option => (
                    <SelectItem key={option.value || 'all'} value={option.value || 'all'} className="text-white hover:bg-zinc-700">
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Сброс */}
              <Button
                variant="outline"
                onClick={resetFilters}
                className="border-zinc-700 text-white hover:bg-zinc-800"
              >
                Сбросить
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Контент */}
      <div className="container mx-auto px-4 py-8">
        {/* Заголовок и счетчик */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold border-l-4 border-orange-500 pl-4">
            Каталог аниме
          </h1>
          <span className="text-zinc-500 text-sm">
            Найдено: {animes.length}+ {loading && '(загрузка...)'}
          </span>
        </div>

        {/* Сетка аниме */}
        {loading && animes.length === 0 ? (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-y-8 gap-x-4">
              {animes.map((anime) => (
                <AnimeCard key={anime.id} anime={anime} />
              ))}
            </div>

            {/* Кнопка "Загрузить еще" */}
            {hasMore && animes.length > 0 && (
              <div className="mt-12 flex justify-center">
                <Button
                  onClick={loadMore}
                  disabled={loadingMore}
                  variant="outline"
                  className="px-6 py-2 bg-zinc-900 border border-zinc-800 rounded-full hover:bg-orange-600 hover:text-white hover:border-orange-600 transition text-sm font-medium"
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

            {/* Сообщение об отсутствии результатов */}
            {!loading && animes.length === 0 && (
              <div className="text-center py-20">
                <p className="text-zinc-500 text-lg">Аниме не найдено</p>
                <p className="text-zinc-600 text-sm mt-2">Попробуйте изменить параметры поиска или фильтры</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
