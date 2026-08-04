"use client"

import { useEffect, useState, useMemo } from "react"
import Link from "next/link"
import Image from "next/image"
import { Clock, History, Trash2, ArrowLeft, Archive, Search, X, AlertTriangle, Trash, CheckSquare, LayoutGrid, Grid3x3, List, Sparkles } from "lucide-react"
import { Navbar } from "@/components/layout/navbar"
import { Footer } from "@/components/layout/footer"
import { useEpisodeUpdates } from "@/hooks/use-episode-updates"
import { useHistory } from "@/components/providers/history-provider"
import { ScrollToTop } from "@/components/layout/scroll-to-top"
import { HistorySkeleton } from "@/components/shared/skeleton"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

function normalizePosterUrl(value: string): string {
  const raw = (value ?? "").trim()
  if (!raw) return raw

  if (raw.startsWith("https//")) return `https://${raw.slice("https//".length)}`
  if (raw.startsWith("http//")) return `http://${raw.slice("http//".length)}`

  if (raw.startsWith("https://shikimori.onehttps//")) {
    return `https://${raw.slice("https://shikimori.onehttps//".length)}`
  }
  if (raw.startsWith("https://shikimori.onehttp//")) {
    return `http://${raw.slice("https://shikimori.onehttp//".length)}`
  }

  return raw
}

export default function HistoryPage() {
  const { items: historyItems, clear, remove, isLoading, toggleArchived } = useHistory()
  
  const history = useMemo(() => {
    return historyItems.map((item: any) => ({
      ...item,
      poster: normalizePosterUrl(item?.poster)
    }))
  }, [historyItems])

  const [mounted, setMounted] = useState(false)
  const { updates } = useEpisodeUpdates()
  
  // Режимы и фильтры
  const [filterMode, setFilterMode] = useState<'all' | 'active' | 'archived'>('all')
  const [viewMode, setViewMode] = useState<'comfortable' | 'compact' | 'list'>('comfortable')
  const [searchQuery, setSearchQuery] = useState('')
  
  // Диалоги и выбор
  const [showClearDialog, setShowClearDialog] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showDeleteSelectedDialog, setShowDeleteSelectedDialog] = useState(false)
  const [isSelectionMode, setIsSelectionMode] = useState(false)

  // Фильтрация элементов по архиву и поисковому запросу
  const filteredHistory = useMemo(() => {
    return history.filter(item => {
      const matchesFilter = 
        filterMode === 'all' ? true :
        filterMode === 'archived' ? item.is_archived :
        !item.is_archived

      const matchesSearch = searchQuery.trim() === '' || 
        item.title.toLowerCase().includes(searchQuery.toLowerCase().trim())

      return matchesFilter && matchesSearch
    })
  }, [history, filterMode, searchQuery])

  const archivedCount = useMemo(() => history.filter(item => item.is_archived).length, [history])
  const activeCount = history.length - archivedCount

  const getUpdateInfo = (animeId: string) => {
    const update = updates.find(u => u.animeId === animeId)
    if (!update) return undefined

    const historyItem = history.find(h => h.id === animeId)
    if (!historyItem) return undefined

    return {
      newEpisode: update.newEpisode,
      totalEpisodes: update.totalEpisodes
    }
  }

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleConfirmClear = () => {
    clear()
    setShowClearDialog(false)
  }

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev)
      if (newSet.has(id)) {
        newSet.delete(id)
      } else {
        newSet.add(id)
      }
      return newSet
    })
  }

  const handleToggleSelectionMode = () => {
    if (isSelectionMode) {
      setIsSelectionMode(false)
      setSelectedIds(new Set())
    } else {
      setIsSelectionMode(true)
    }
  }

  const handleSelectAll = () => {
    const visibleIds = new Set(filteredHistory.map(item => item.id))
    if (selectedIds.size === visibleIds.size && [...selectedIds].every(id => visibleIds.has(id))) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(visibleIds)
    }
  }

  const handleConfirmDeleteSelected = () => {
    remove([...selectedIds])
    setSelectedIds(new Set())
    setShowDeleteSelectedDialog(false)
    setIsSelectionMode(false)
  }

  if (!mounted) return null

  if (isLoading) {
    return (
      <main className="min-h-screen bg-background text-foreground pb-20 md:pb-24 relative">
        <div className="absolute inset-0 z-0 pointer-events-none opacity-[0.07]">
          <div className="absolute inset-0 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:20px_20px]" />
        </div>

        <Navbar />
        <div className="container mx-auto px-4 pt-8 pb-12 relative z-10">
          <div className="mb-8">
            <div className="h-10 w-32 skeleton rounded-xl mb-4" />
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 skeleton rounded-full" />
              <div className="space-y-2">
                <div className="h-8 w-48 skeleton rounded" />
                <div className="h-4 w-64 skeleton rounded" />
              </div>
            </div>
          </div>
          <HistorySkeleton items={12} />
        </div>
      </main>
    )
  }

  const gridClass = viewMode === 'compact'
    ? "grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-2 sm:gap-3"
    : viewMode === 'list'
    ? "flex flex-col gap-2.5 sm:gap-3"
    : "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-x-4 gap-y-6 sm:gap-y-8"

  return (
    <main className="min-h-screen bg-background text-foreground pb-20 md:pb-24 relative">
      <div className="absolute inset-0 z-0 pointer-events-none opacity-[0.07]">
        <div className="absolute inset-0 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:20px_20px]" />
      </div>

      <Navbar />

      <div className="container mx-auto px-3 sm:px-4 pt-6 sm:pt-8 pb-12 relative z-10 max-w-7xl">
        {/* Кнопка Назад */}
        <div className="mb-6">
          <Link 
            href="/" 
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-secondary hover:bg-accent border border-border hover:border-primary text-muted-foreground hover:text-foreground font-medium rounded-xl transition-all dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:border-zinc-800 dark:hover:border-orange-500 dark:text-zinc-400 dark:hover:text-white text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            На главную
          </Link>
        </div>

        {/* Заголовок страницы и Статистика */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-orange-500/10 border border-orange-500/20 rounded-2xl dark:bg-orange-500/10">
              <History size={26} className="text-orange-500" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground dark:text-white">История просмотров</h1>
              <p className="text-xs sm:text-sm text-muted-foreground dark:text-zinc-400 mt-0.5">
                {history.length} {history.length === 1 ? 'аниме' : 'тайтлов'} сохранено в вашей коллекции
              </p>
            </div>
          </div>

          {/* Быстрые действия с историей */}
          {history.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={handleToggleSelectionMode}
                className={cn(
                  "inline-flex items-center gap-2 px-3 py-2 border font-medium rounded-xl transition-all text-xs sm:text-sm",
                  isSelectionMode
                    ? "bg-orange-500 text-black border-orange-500 font-semibold shadow-sm"
                    : "bg-secondary hover:bg-accent border-border text-muted-foreground hover:text-foreground dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:border-zinc-800 dark:text-zinc-300 dark:hover:text-white"
                )}
              >
                {isSelectionMode ? <X className="w-4 h-4" /> : <CheckSquare className="w-4 h-4" />}
                <span>{isSelectionMode ? "Отменить" : "Выбрать"}</span>
              </button>

              {isSelectionMode ? (
                selectedIds.size > 0 && (
                  <button
                    onClick={() => setShowDeleteSelectedDialog(true)}
                    className="inline-flex items-center gap-2 px-3.5 py-2 bg-destructive hover:bg-destructive/90 border border-destructive text-white font-medium rounded-xl transition-all text-xs sm:text-sm shadow-sm animate-in fade-in"
                  >
                    <Trash className="w-4 h-4" />
                    <span>Удалить ({selectedIds.size})</span>
                  </button>
                )
              ) : (
                <button
                  onClick={() => setShowClearDialog(true)}
                  className="inline-flex items-center gap-2 px-3 py-2 bg-secondary hover:bg-destructive/20 border border-border hover:border-destructive/50 text-muted-foreground hover:text-destructive font-medium rounded-xl transition-all dark:bg-zinc-900 dark:hover:bg-red-950/40 dark:border-zinc-800 dark:hover:border-red-500/50 dark:text-zinc-400 dark:hover:text-red-400 text-xs sm:text-sm"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Очистить всё</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* ПАНЕЛЬ ИНСТРУМЕНТОВ: Вкладки + Поиск + Вид просмотра */}
        {history.length > 0 && (
          <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between mb-6 bg-secondary/40 p-2 sm:p-2.5 rounded-2xl border border-border dark:bg-zinc-900/60 dark:border-zinc-800/80 backdrop-blur-sm">
            
            {/* Вкладки состояния (Все / Активные / Архив) */}
            <div className="flex items-center gap-1.5 bg-background/80 p-1 rounded-xl border border-border/80 dark:bg-zinc-950/80 dark:border-zinc-800 overflow-x-auto">
              <button
                onClick={() => setFilterMode('all')}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-1.5",
                  filterMode === 'all'
                    ? "bg-orange-500 text-black shadow-sm"
                    : "text-muted-foreground hover:text-foreground dark:text-zinc-400 dark:hover:text-white"
                )}
              >
                Все <span className="opacity-75 text-[10px] bg-black/10 dark:bg-white/20 px-1.5 py-0.2 rounded-full">{history.length}</span>
              </button>

              <button
                onClick={() => setFilterMode('active')}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-1.5",
                  filterMode === 'active'
                    ? "bg-orange-500 text-black shadow-sm"
                    : "text-muted-foreground hover:text-foreground dark:text-zinc-400 dark:hover:text-white"
                )}
              >
                Активные <span className="opacity-75 text-[10px] bg-black/10 dark:bg-white/20 px-1.5 py-0.2 rounded-full">{activeCount}</span>
              </button>

              <button
                onClick={() => setFilterMode('archived')}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-1.5",
                  filterMode === 'archived'
                    ? "bg-orange-500 text-black shadow-sm"
                    : "text-muted-foreground hover:text-foreground dark:text-zinc-400 dark:hover:text-white"
                )}
              >
                В архиве <span className="opacity-75 text-[10px] bg-black/10 dark:bg-white/20 px-1.5 py-0.2 rounded-full">{archivedCount}</span>
              </button>
            </div>

            {/* Поиск и Виды отображения */}
            <div className="flex items-center gap-2 justify-between md:justify-end">
              
              {/* Поиск по истории */}
              <div className="relative flex-1 md:w-60">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-3.5 h-3.5" />
                <Input
                  placeholder="Поиск по названию..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-9 pl-9 pr-8 text-xs bg-background border-border dark:bg-zinc-950 dark:border-zinc-800 rounded-xl"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Переключатель 3 видов просмотра */}
              <div className="flex items-center gap-1 bg-background/80 rounded-xl p-1 border border-border dark:bg-zinc-950/80 dark:border-zinc-800 flex-shrink-0">
                <button
                  onClick={() => setViewMode('comfortable')}
                  title="Комфортная сетка"
                  className={cn(
                    "p-1.5 rounded-lg transition-all",
                    viewMode === 'comfortable' 
                      ? "bg-secondary text-foreground shadow-sm dark:bg-zinc-800 dark:text-white" 
                      : "text-muted-foreground hover:text-foreground dark:text-zinc-500 dark:hover:text-zinc-300"
                  )}
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('compact')}
                  title="Компактная сетка"
                  className={cn(
                    "p-1.5 rounded-lg transition-all",
                    viewMode === 'compact' 
                      ? "bg-secondary text-foreground shadow-sm dark:bg-zinc-800 dark:text-white" 
                      : "text-muted-foreground hover:text-foreground dark:text-zinc-500 dark:hover:text-zinc-300"
                  )}
                >
                  <Grid3x3 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  title="Список"
                  className={cn(
                    "p-1.5 rounded-lg transition-all",
                    viewMode === 'list' 
                      ? "bg-secondary text-foreground shadow-sm dark:bg-zinc-800 dark:text-white" 
                      : "text-muted-foreground hover:text-foreground dark:text-zinc-500 dark:hover:text-zinc-300"
                  )}
                >
                  <List className="w-4 h-4" />
                </button>
              </div>

            </div>
          </div>
        )}

        {/* Панель массы выбора (Select All) */}
        {isSelectionMode && filteredHistory.length > 0 && (
          <div className="mb-4 p-3 bg-orange-500/10 border border-orange-500/20 rounded-xl flex items-center justify-between animate-in fade-in dark:bg-orange-500/10">
            <div className="flex items-center gap-3">
              <Checkbox
                id="select-all"
                checked={selectedIds.size === filteredHistory.length && filteredHistory.length > 0}
                onCheckedChange={handleSelectAll}
                className="data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500"
              />
              <label htmlFor="select-all" className="text-xs sm:text-sm font-medium cursor-pointer text-foreground dark:text-white">
                Выбрать все видимые ({filteredHistory.length})
              </label>
            </div>
            {selectedIds.size > 0 && (
              <button
                onClick={() => setSelectedIds(new Set())}
                className="text-xs text-orange-500 hover:underline font-medium"
              >
                Сбросить выбор ({selectedIds.size})
              </button>
            )}
          </div>
        )}

        {/* Пустое состояние */}
        {history.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="p-4 bg-secondary/50 rounded-full mb-4 dark:bg-zinc-900 border border-border dark:border-zinc-800">
              <History size={48} className="text-muted-foreground/60 dark:text-zinc-600" />
            </div>
            <h2 className="text-xl font-bold text-foreground mb-2 dark:text-zinc-300">История пуста</h2>
            <p className="text-sm text-muted-foreground/80 mb-6 max-w-sm dark:text-zinc-500">
              Начните смотреть аниме, чтобы прогресс просмотров автоматически сохранялся здесь
            </p>
            <Link
              href="/catalog"
              className="inline-flex items-center gap-2 px-6 py-3 bg-orange-500 hover:bg-orange-600 text-black font-bold rounded-xl transition-all shadow-md"
            >
              Перейти в каталог
              <ArrowLeft className="w-4 h-4 rotate-180" />
            </Link>
          </div>
        ) : filteredHistory.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center bg-secondary/20 rounded-2xl border border-dashed border-border dark:bg-zinc-900/20 dark:border-zinc-800">
            <Search className="w-10 h-10 text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground font-medium text-sm dark:text-zinc-400">Ничего не найдено</p>
            <p className="text-xs text-muted-foreground/60 mt-1 dark:text-zinc-600">Попробуйте изменить параметры фильтра или поисковый запрос</p>
          </div>
        ) : (
          /* ОТОБРАЖЕНИЕ КАРТОЧЕК */
          <div className={gridClass}>
            {filteredHistory.map((item: any) => {
              const total = item?.episodesTotal && item.episodesTotal > 0 ? item.episodesTotal : null
              const progress = item?.episode && total ? Math.min(item.episode / total, 1) : null
              const updateInfo = getUpdateInfo(item.id)
              const isCompleted = total && item.episode && item.episode >= total
              const isSelected = selectedIds.has(item.id)

              // 1. ВИД: СПИСОК (List view)
              if (viewMode === 'list') {
                return (
                  <div
                    key={item.id}
                    className={cn(
                      "group relative flex items-center gap-3 sm:gap-4 p-2.5 sm:p-3 rounded-2xl bg-secondary/40 border border-border transition-all dark:bg-zinc-900/50 dark:border-zinc-800/80 hover:border-orange-500/50 dark:hover:border-orange-500/40 shadow-sm",
                      item.is_archived && "opacity-60 bg-secondary/20 dark:bg-zinc-900/20",
                      isSelected && "ring-2 ring-orange-500 border-orange-500"
                    )}
                  >
                    {isSelectionMode && (
                      <div className="pl-1">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => handleToggleSelect(item.id)}
                          className="data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500"
                        />
                      </div>
                    )}

                    {/* Постер */}
                    <Link
                      href={item.episode ? `/watch/${item.id}?episode=${item.episode}` : `/watch/${item.id}`}
                      className="relative w-16 h-20 sm:w-20 sm:h-24 rounded-xl overflow-hidden flex-shrink-0 bg-secondary border border-border dark:bg-zinc-800 dark:border-zinc-800"
                    >
                      <Image
                        src={item.poster}
                        alt={item.title}
                        fill
                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Clock size={16} className="text-white" />
                      </div>
                    </Link>

                    {/* Инфо и прогресс */}
                    <div className="flex-1 min-w-0 flex flex-col justify-center gap-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link
                          href={item.episode ? `/watch/${item.id}?episode=${item.episode}` : `/watch/${item.id}`}
                          className="font-bold text-xs sm:text-sm text-foreground hover:text-orange-500 transition-colors truncate dark:text-zinc-200 dark:hover:text-orange-400"
                        >
                          {item.title}
                        </Link>
                        
                        {/* Бейдж новых серий */}
                        {updateInfo && !item.is_archived && (
                          <span className="bg-orange-500 text-black text-[9px] font-extrabold px-1.5 py-0.5 rounded-md shadow-xs animate-pulse flex items-center gap-1">
                            <Sparkles className="w-2.5 h-2.5" /> +{updateInfo.newEpisode - (item.episode || 0)} сер.
                          </span>
                        )}

                        {/* Бейдж Архива */}
                        {item.is_archived && (
                          <span className="bg-zinc-700 text-zinc-300 text-[9px] font-bold px-1.5 py-0.5 rounded-md">
                            В архиве
                          </span>
                        )}
                      </div>

                      {/* Текст просмотренной серии */}
                      <p className="text-[11px] text-muted-foreground dark:text-zinc-400">
                        {item.episode
                          ? `Просмотрено: ${item.episode}${total ? ` из ${total} сер.` : " сер."}`
                          : "Продолжить просмотр"}
                      </p>

                      {/* Прогресс-бар */}
                      {progress !== null && (
                        <div className="w-full max-w-md h-1.5 bg-border dark:bg-zinc-800 rounded-full overflow-hidden mt-1">
                          <div
                            className={cn(
                              "h-full transition-all duration-300 rounded-full",
                              isCompleted ? "bg-green-500" : "bg-orange-500"
                            )}
                            style={{ width: `${(progress * 100).toFixed(0)}%` }}
                          />
                        </div>
                      )}
                    </div>

                    {/* Кнопки действий */}
                    <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                      <button
                        onClick={() => toggleArchived(item.id)}
                        className={cn(
                          "p-2 rounded-xl transition-all",
                          item.is_archived
                            ? "bg-orange-500 text-black"
                            : "bg-secondary hover:bg-orange-500 hover:text-black text-muted-foreground dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-orange-500 dark:hover:text-black"
                        )}
                        title={item.is_archived ? 'Вернуть из архива' : 'Переместить в архив'}
                      >
                        <Archive className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => {
                          setSelectedIds(new Set([item.id]))
                          setShowDeleteSelectedDialog(true)
                        }}
                        className="p-2 rounded-xl bg-secondary hover:bg-destructive hover:text-white text-muted-foreground dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-red-600 dark:hover:text-white transition-all"
                        title="Удалить из истории"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )
              }

              // 2 & 3. ВИД: СЕТКА (Comfortable & Compact) - Исправлен aspect-[2/3] для телефонов!
              return (
                <div key={item.id} className={cn("relative group", isSelected && "ring-2 ring-orange-500 rounded-2xl")}>
                  {isSelectionMode && (
                    <div className="absolute top-2 left-2 z-20">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => handleToggleSelect(item.id)}
                        className="bg-background/80 backdrop-blur-sm data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                  )}

                  <Link
                    href={item.episode ? `/watch/${item.id}?episode=${item.episode}` : `/watch/${item.id}`}
                    className={cn("block", isSelectionMode && "pointer-events-none")}
                    onClick={(e) => {
                      if (isSelectionMode) {
                        e.preventDefault()
                        handleToggleSelect(item.id)
                      }
                    }}
                  >
                    {/* aspect-[2/3] делает обложку красивой и нормальной на смартфонах */}
                    <div className="relative aspect-[2/3] overflow-hidden rounded-2xl bg-secondary border border-border dark:bg-zinc-900 dark:border-zinc-800">
                      <Image
                        src={item.poster}
                        alt={item.title}
                        fill
                        className={cn(
                          "object-cover transition-transform duration-300 group-hover:scale-105",
                          item.is_archived ? "opacity-60" : "opacity-80 group-hover:opacity-100"
                        )}
                      />
                      
                      {/* Нижняя полоса прогресса */}
                      <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-black/40 overflow-hidden">
                        {progress !== null && (
                          <div
                            className={cn(
                              "h-full transition-all duration-300",
                              isCompleted ? "bg-green-500" : "bg-orange-500"
                            )}
                            style={{ width: `${(progress * 100).toFixed(0)}%` }}
                          />
                        )}
                      </div>

                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
                        <div className="bg-orange-500 p-2.5 rounded-full shadow-lg">
                          <Clock size={18} className="text-black" fill="currentColor" />
                        </div>
                      </div>
                      
                      {/* Бейдж новых серий */}
                      {updateInfo && !item.is_archived && (
                        <div className="absolute top-2 right-2 z-10">
                          <span className="bg-orange-500 text-black text-[9px] font-extrabold px-1.5 py-0.5 rounded-md shadow-sm animate-pulse block">
                            +{updateInfo.newEpisode - (item.episode || 0)} сер.
                          </span>
                        </div>
                      )}
                      
                      {/* Бейдж Архива */}
                      {item.is_archived && (
                        <div className="absolute top-2 left-2 z-10">
                          <span className="bg-zinc-800/90 text-zinc-300 text-[9px] font-bold px-1.5 py-0.5 rounded-md backdrop-blur-sm block">
                            В архиве
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="mt-2">
                      <h3 className={cn(
                        "text-xs font-bold truncate group-hover:text-orange-500 transition-colors dark:text-zinc-200 dark:group-hover:text-orange-400",
                        item.is_archived && "text-muted-foreground/60 dark:text-zinc-600"
                      )}>
                        {item.title}
                      </h3>
                      <p className={cn(
                        "text-[10px] dark:text-zinc-500 mt-0.5",
                        item.is_archived ? "text-muted-foreground/50 dark:text-zinc-600" : "text-muted-foreground"
                      )}>
                        {item.episode
                          ? `Серия ${item.episode}${total ? ` из ${total}` : ""}`
                          : "Продолжить"}
                      </p>
                    </div>
                  </Link>

                  {/* Кнопка архивации в угол карточки */}
                  <button
                    onClick={() => toggleArchived(item.id)}
                    className={cn(
                      "absolute top-2 right-2 p-1.5 rounded-xl shadow-md transition-all opacity-100 sm:opacity-0 sm:group-hover:opacity-100 z-10",
                      item.is_archived
                        ? "bg-orange-500 text-black"
                        : "bg-background/80 text-muted-foreground hover:bg-orange-500 hover:text-black dark:bg-zinc-900/80 dark:text-zinc-300 dark:hover:bg-orange-500 dark:hover:text-black backdrop-blur-sm"
                    )}
                    title={item.is_archived ? 'Вернуть из архива' : 'Переместить в архив'}
                  >
                    <Archive className="w-3.5 h-3.5" />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ДИАЛОГИ ПОДТВЕРЖДЕНИЯ */}
      <AlertDialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <AlertDialogContent className="max-w-[90vw] sm:max-w-md rounded-2xl">
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-destructive/10 rounded-xl">
                <AlertTriangle className="w-6 h-6 text-destructive" />
              </div>
              <AlertDialogTitle>Очистить историю?</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-left text-sm">
              Вы уверены, что хотите полностью очистить всю историю просмотров? Это действие нельзя отменить.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmClear}
              className="bg-destructive hover:bg-destructive/90 rounded-xl"
            >
              Очистить всё
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showDeleteSelectedDialog} onOpenChange={setShowDeleteSelectedDialog}>
        <AlertDialogContent className="max-w-[90vw] sm:max-w-md rounded-2xl">
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-destructive/10 rounded-xl">
                <AlertTriangle className="w-6 h-6 text-destructive" />
              </div>
              <AlertDialogTitle>
                Удалить {selectedIds.size} {selectedIds.size === 1 ? 'запись' : selectedIds.size < 5 ? 'записи' : 'записей'}?
              </AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-left text-sm">
              Выбранные тайтлы будут навсегда удалены из вашей истории просмотров.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDeleteSelected}
              className="bg-destructive hover:bg-destructive/90 rounded-xl"
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ScrollToTop />
      <Footer />
    </main>
  )
}