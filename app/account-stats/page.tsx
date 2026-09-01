"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import {
  History,
  Clock,
  Eye,
  PlayCircle,
  Dices,
  Trophy,
  Bookmark,
  BarChart3,
  Activity,
  RefreshCw,
  ArrowLeft,
  ChevronRight,
  LogIn,
  Search,
  Film,
  Sparkles,
  Flame,
  CheckCircle2
} from "lucide-react"
import { Navbar } from "@/components/layout/navbar"
import { ScrollToTop } from "@/components/layout/scroll-to-top"
import { Footer } from "@/components/layout/footer"
import { useAccountStats, type AccountStats } from "@/components/providers/account-stats-provider"
import { activityRecorder } from "@/components/providers/account-stats-recorder"
import { useHistory } from "@/components/providers/history-provider"
import { useAuth } from "@/components/auth/auth-provider"
import { AuthModal } from "@/components/auth/auth-modal"
import { cn } from "@/lib/utils"

// ---------- Вспомогательные функции форматирования ----------

/** Форматирует миллисекунды в компактный вид: "1д 5ч", "2ч 34м", "45с" */
function formatDuration(ms: number): string {
  if (!ms || ms <= 0) return "0м"
  const totalSeconds = Math.floor(ms / 1000)
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  const parts: string[] = []
  if (days > 0) parts.push(`${days}д`)
  if (hours > 0) parts.push(`${hours}ч`)
  if (minutes > 0 && days === 0) parts.push(`${minutes}м`)
  if (parts.length === 0 && seconds > 0) parts.push(`${seconds}с`)

  return parts.join(" ") || "0м"
}

/** Строка детальной информации о сессии */
function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground dark:text-zinc-500">{label}</span>
      <span className="font-medium text-foreground dark:text-zinc-200">{value}</span>
    </div>
  )
}

/** Форматирует число с разделителями */
function formatNumber(num: number | undefined | null): string {
  if (!num || num <= 0) return "0"
  return Math.round(num).toLocaleString("ru-RU")
}

/** Компактное время HH:MM:SS для заголовка строки журнала сессий */
function formatClock(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  return `${pad(h)}:${pad(m)}:${pad(s)}`
}

function pad(n: number): string {
  return String(n).padStart(2, "0")
}

/** Дата и время сессии */
function formatSessionTime(ts: number): string {
  try {
    const d = new Date(ts)
    return d.toLocaleString("ru-RU", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    })
  } catch {
    return "Недавно"
  }
}

/** Очистка URL постера */
function normalizePoster(value: string | undefined | null): string {
  const raw = (value ?? "").trim()
  if (!raw) return "/placeholder-anime.png"
  if (raw.startsWith("https//")) return `https://${raw.slice("https//".length)}`
  if (raw.startsWith("http//")) return `http://${raw.slice("http//".length)}`
  return raw
}

/** Склонение русских слов для чисел */
function pluralize(n: number, one: string, few: string, many: string): string {
  const abs = Math.abs(n) % 100
  const rem = abs % 10
  if (abs > 10 && abs < 20) return many
  if (rem > 1 && rem < 5) return few
  if (rem === 1) return one
  return many
}

// ---------- Компонент карточки статистики ----------

interface StatCardProps {
  icon: any
  label: string
  value: string | number
  sub: string
  accentColor?: string
  badge?: string
}

function StatCard({ icon: Icon, label, value, sub, accentColor = "text-orange-500", badge }: StatCardProps) {
  return (
    <div className="group relative bg-background/70 dark:bg-zinc-900/60 backdrop-blur-xl border border-border/60 dark:border-zinc-800/80 rounded-2xl sm:rounded-3xl p-4 sm:p-5 transition-all duration-300 hover:border-orange-500/40 hover:shadow-lg hover:shadow-orange-500/5">
      <div className="flex items-center justify-between mb-3.5">
        <div className={cn("inline-flex p-2.5 rounded-xl sm:rounded-2xl bg-orange-500/10 border border-orange-500/20 transition-transform duration-300 group-hover:scale-110")}>
          <Icon className={cn("w-5 h-5 sm:w-6 sm:h-6", accentColor)} />
        </div>
        {badge && (
          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20">
            {badge}
          </span>
        )}
      </div>
      <div className="space-y-1">
        <p className="text-muted-foreground text-[11px] sm:text-xs font-semibold uppercase tracking-wider truncate">
          {label}
        </p>
        <div className="flex items-baseline gap-1.5 sm:gap-2 flex-wrap">
          <p className="text-xl sm:text-2xl lg:text-3xl font-black text-foreground dark:text-white tracking-tight">
            {value}
          </p>
          <span className="text-[11px] sm:text-xs font-medium text-muted-foreground dark:text-zinc-400">
            {sub}
          </span>
        </div>
      </div>
    </div>
  )
}

// ---------- Полоса прогресса ----------

function StatBar({ label, value, max, icon: Icon }: { label: string; value: number; max: number; icon?: any }) {
  const percent = max > 0 ? Math.min(Math.max((value / max) * 100, 2), 100) : 0

  return (
    <div className="space-y-1.5 p-3 sm:p-3.5 rounded-xl sm:rounded-2xl bg-secondary/30 dark:bg-zinc-900/40 border border-border/40 dark:border-zinc-800/60">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {Icon && <Icon className="w-4 h-4 text-orange-500 shrink-0" />}
          <span className="text-xs sm:text-sm font-semibold text-foreground dark:text-zinc-200 truncate">{label}</span>
        </div>
        <span className="text-xs font-bold text-foreground dark:text-zinc-300 shrink-0">{value.toLocaleString("ru-RU")}</span>
      </div>
      <div className="h-2 w-full bg-secondary dark:bg-zinc-800/80 rounded-full overflow-hidden border border-border/30 dark:border-zinc-800">
        <div 
          className="h-full bg-gradient-to-r from-orange-500 to-amber-500 rounded-full transition-all duration-700 ease-out" 
          style={{ width: `${percent}%` }} 
        />
      </div>
    </div>
  )
}

// ---------- Скелетоны ----------

function StatCardSkeleton() {
  return (
    <div className="relative bg-background/50 dark:bg-zinc-900/40 backdrop-blur-xl border border-border/60 dark:border-zinc-800 rounded-2xl sm:rounded-3xl p-5 animate-pulse">
      <div className="w-11 h-11 rounded-2xl bg-zinc-800/40 mb-4" />
      <div className="space-y-2">
        <div className="h-3.5 w-24 bg-zinc-800/40 rounded-md" />
        <div className="h-7 w-28 bg-zinc-800/60 rounded-md" />
      </div>
    </div>
  )
}

// ---------- Основной компонент ----------

export default function AccountStatsPage() {
  const { stats, isLoading, refresh } = useAccountStats()
  const { user } = useAuth()
  const { items: historyItems } = useHistory()

  const [mounted, setMounted] = useState(false)
  const [activeTab, setActiveTab] = useState<"overview" | "time" | "history" | "progress" | "activity">("overview")
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [expandedSessions, setExpandedSessions] = useState<Set<number>>(new Set())

  // Количество отображаемых элементов истории (стартуем с 6 или 12, по клику добавляем порцию)
  const HISTORY_PAGE_SIZE = 6
  const [visibleHistoryCount, setVisibleHistoryCount] = useState(HISTORY_PAGE_SIZE)
  const [isLoadingMoreHistory, setIsLoadingMoreHistory] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleManualRefresh = async () => {
    setIsRefreshing(true)
    try {
      if (refresh) await refresh()
    } finally {
      setTimeout(() => setIsRefreshing(false), 500)
    }
  }

  // Сортировка истории: гарантируем, что последние просмотренные идут первыми
  const sortedHistoryItems = useMemo(() => {
    if (!historyItems || historyItems.length === 0) return []
    return [...historyItems].sort((a: any, b: any) => {
      const timeA = new Date(a.updatedAt || a.watchedAt || a.timestamp || a.createdAt || 0).getTime()
      const timeB = new Date(b.updatedAt || b.watchedAt || b.timestamp || b.createdAt || 0).getTime()
      return timeB - timeA
    })
  }, [historyItems])

  const hasMoreHistory = sortedHistoryItems.length > visibleHistoryCount

  // Накапливаемый список: от 0 до visibleHistoryCount (список раскрывается вниз)
  const visibleHistoryItems = useMemo(() => {
    return sortedHistoryItems.slice(0, visibleHistoryCount)
  }, [sortedHistoryItems, visibleHistoryCount])

  const loadMoreHistory = useCallback(() => {
    if (isLoadingMoreHistory || !hasMoreHistory) return
    setIsLoadingMoreHistory(true)
    setTimeout(() => {
      setVisibleHistoryCount((prev) => prev + HISTORY_PAGE_SIZE)
      setIsLoadingMoreHistory(false)
    }, 200)
  }, [isLoadingMoreHistory, hasMoreHistory])

  // Безопасное получение списка сессий
  const sessions = useMemo(() => {
    try {
      if (typeof activityRecorder?.getSessionDurations === "function") {
        return activityRecorder
          .getSessionDurations()
          .map((s: { start: number; end: number }) => ({ start: s.start, end: s.end }))
          .sort((a: { start: number }, b: { start: number }) => b.start - a.start)
      }
    } catch (e) {
      console.error("Failed to load sessions:", e)
    }
    return []
  }, [])

  // По умолчанию раскрываем сессии после загрузки
  useEffect(() => {
    if (!sessions || sessions.length === 0) return
    const next = new Set(sessions.map((_, idx) => idx))
    setExpandedSessions(next)
  }, [sessions])

  // Агрегация прогресса по тайтлам из истории
  const progressByAnime = useMemo(() => {
    type ProgressItem = { 
      id: string
      title: string
      poster?: string
      episode: number
      episodesTotal: number
      count: number 
    }
    const map = new Map<string, ProgressItem>()

    for (const item of sortedHistoryItems || []) {
      if (!item?.id) continue
      const total = Number(item.episodesTotal) || 0
      const ep = Number(item.episode) || 0

      const existing = map.get(String(item.id)) ?? {
        id: String(item.id),
        title: item.title || "Аниме без названия",
        poster: item.poster,
        episode: 0,
        episodesTotal: total,
        count: 0,
      }

      if (total > 0) existing.episodesTotal = Math.max(existing.episodesTotal, total)
      if (ep > 0) existing.episode = Math.max(existing.episode, ep)
      if (!existing.poster && item.poster) existing.poster = item.poster
      existing.count += 1

      map.set(String(item.id), existing)
    }

    return Array.from(map.values())
      .map((v) => {
        const hasValidTotal = v.episodesTotal > 0
        const progress = hasValidTotal ? Math.min(v.episode / v.episodesTotal, 1) : 0
        return { ...v, progress }
      })
      .sort((a, b) => b.progress - a.progress || b.count - a.count)
  }, [sortedHistoryItems])

  // Разбивка по ключевым событиям
  const eventBreakdown = useMemo(() => {
    const s = (stats || {}) as AccountStats & { searches?: number }
    return [
      { key: "sessions", label: "Всего сессий", value: s.totalSessions ?? 0, icon: Activity },
      { key: "views", label: "Просмотры страниц", value: s.pageViews ?? 0, icon: Eye },
      { key: "watch", label: "Просмотры серий", value: s.watchEvents ?? 0, icon: PlayCircle },
      { key: "searches", label: "Поисковые запросы", value: s.searches ?? 0, icon: Search },
      { key: "gacha", label: "Прокрутки гачи", value: s.gachaRolls ?? 0, icon: Dices },
      { key: "battles", label: "Битвы персонажей", value: s.battlesStarted ?? 0, icon: Trophy },
      { key: "bookmarks", label: "Добавлено в закладки", value: s.bookmarksAdded ?? 0, icon: Bookmark },
    ]
  }, [stats])

  if (!mounted) return null

  // ---------- Неавторизованный пользователь ----------
  if (!user) {
    return (
      <main className="min-h-screen bg-background text-foreground pb-20 md:pb-24 relative flex flex-col justify-between">
        <Navbar />
        <div className="container mx-auto px-3 sm:px-4 pt-6 sm:pt-8 pb-12 relative z-10 max-w-5xl my-auto">
          <div className="mb-6">
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-secondary/60 hover:bg-secondary border border-border/60 text-muted-foreground hover:text-foreground font-medium rounded-xl transition-all dark:bg-zinc-900/60 dark:hover:bg-zinc-800 text-xs sm:text-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              На главную
            </Link>
          </div>

          <div className="flex flex-col items-center justify-center p-8 sm:p-14 text-center bg-card/60 dark:bg-zinc-900/40 backdrop-blur-2xl rounded-3xl border border-border/60 dark:border-zinc-800 shadow-2xl">
            <div className="p-4 bg-orange-500/10 border border-orange-500/20 rounded-3xl mb-6 ring-8 ring-orange-500/5">
              <BarChart3 className="w-10 h-10 sm:w-12 sm:h-12 text-orange-500" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground dark:text-white tracking-tight">
              Статистика аккаунта
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground dark:text-zinc-400 max-w-md mt-2.5 leading-relaxed">
              Войдите в свой профиль, чтобы отслеживать время просмотров, историю тайтлов, битвы и активность на платформе.
            </p>
            <button
              onClick={() => setShowAuthModal(true)}
              className="mt-7 inline-flex items-center gap-2.5 px-6 py-3 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold rounded-2xl transition-all shadow-lg shadow-orange-500/25 hover:scale-[1.02]"
            >
              <LogIn className="w-4 h-4" />
              Войти в аккаунт
            </button>
          </div>
          <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
        </div>
        <Footer />
      </main>
    )
  }

  // ---------- Экран загрузки ----------
  if (isLoading) {
    return (
      <main className="min-h-screen bg-background text-foreground pb-20 md:pb-24 relative">
        <Navbar />
        <div className="container mx-auto px-3 sm:px-4 pt-6 sm:pt-8 pb-12 relative z-10 max-w-7xl">
          <div className="mb-6 h-9 w-28 bg-zinc-800/40 rounded-xl animate-pulse" />
          <div className="flex items-center justify-between gap-4 mb-8">
            <div className="space-y-2">
              <div className="h-8 w-56 bg-zinc-800/60 rounded-xl animate-pulse" />
              <div className="h-4 w-40 bg-zinc-800/40 rounded-md animate-pulse" />
            </div>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <StatCardSkeleton key={i} />
            ))}
          </div>
        </div>
      </main>
    )
  }

  // Расчётные данные
  const totalMs = stats.totalTimeMs ?? 0
  const avgSessionMs = stats.avgSessionMs ?? 0
  const longestSessionMs = sessions.length > 0 ? Math.max(...sessions.map((s) => s.end - s.start)) : 0
  const totalSessionsCount = stats.totalSessions ?? 0

  return (
    <main className="min-h-screen bg-background text-foreground pb-20 md:pb-24 relative">
      <Navbar />

      <div className="container mx-auto px-3 sm:px-4 pt-6 sm:pt-8 pb-12 relative z-10 max-w-7xl">
        
        {/* Кнопка «Назад» */}
        <div className="mb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-secondary/50 hover:bg-secondary border border-border/50 text-muted-foreground hover:text-foreground font-medium rounded-xl transition-all dark:bg-zinc-900/50 dark:hover:bg-zinc-800 dark:border-zinc-800 text-xs sm:text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            На главную
          </Link>
        </div>

        {/* Шапка страницы */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-8">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-gradient-to-br from-orange-500/20 to-amber-500/10 border border-orange-500/20 rounded-2xl">
              <BarChart3 className="w-6 h-6 sm:w-7 sm:h-7 text-orange-500" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-foreground dark:text-white tracking-tight">
                Статистика аккаунта
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground dark:text-zinc-400 mt-0.5">
                {totalSessionsCount} {pluralize(totalSessionsCount, "сессия", "сессии", "сессий")} • {formatDuration(totalMs)} суммарно на сайте
              </p>
            </div>
          </div>

          <button
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="self-start sm:self-auto inline-flex items-center gap-2 px-4 py-2.5 bg-secondary/50 hover:bg-secondary border border-border/60 text-muted-foreground hover:text-foreground font-semibold rounded-xl transition-all dark:bg-zinc-900/50 dark:hover:bg-zinc-800 dark:border-zinc-800 text-xs sm:text-sm active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className={cn("w-4 h-4 text-orange-500 transition-transform duration-500", isRefreshing && "animate-spin")} />
            Обновить
          </button>
        </div>

        {/* Переключатель вкладок */}
        <div className="flex items-center gap-1.5 p-1.5 bg-secondary/40 dark:bg-zinc-900/60 backdrop-blur-xl border border-border/50 dark:border-zinc-800/80 rounded-2xl mb-6 sm:mb-8 overflow-x-auto no-scrollbar">
          {[
            { id: "overview", label: "Обзор", icon: BarChart3 },
            { id: "time", label: "Время", icon: Clock },
            { id: "history", label: "История", icon: History },
            { id: "progress", label: "Прогресс", icon: PlayCircle },
            { id: "activity", label: "Активность", icon: Activity },
          ].map((tab) => {
            const Icon = tab.icon
            const active = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                  "flex-1 min-w-[100px] sm:min-w-[110px] px-3.5 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all duration-200 shrink-0",
                  active
                    ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md shadow-orange-500/20 scale-[1.01]"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/50 dark:hover:bg-zinc-800/60"
                )}
              >
                <Icon className={cn("w-4 h-4", active ? "text-white" : "text-muted-foreground")} />
                <span>{tab.label}</span>
              </button>
            )
          })}
        </div>

        {/* ========================================================================= */}
        {/* ВКЛАДКА: ОБЗОР */}
        {/* ========================================================================= */}
        {activeTab === "overview" && (
          <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-300">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <StatCard icon={Activity} label="Всего сессий" value={formatNumber(stats.totalSessions)} sub="сессий" badge="Общее" />
              <StatCard icon={Clock} label="Время на сайте" value={formatDuration(totalMs)} sub="всего" badge="Время" />
              <StatCard icon={Eye} label="Просмотры страниц" value={formatNumber(stats.pageViews)} sub="просмотров" />
              <StatCard icon={PlayCircle} label="События просмотра" value={formatNumber(stats.watchEvents)} sub="событий" />
              <StatCard icon={Dices} label="Прокрутки гача" value={formatNumber(stats.gachaRolls)} sub="прокруток" />
              <StatCard icon={Trophy} label="Битвы персонажей" value={formatNumber(stats.battlesStarted)} sub="битв" />
              <StatCard icon={Bookmark} label="В закладках" value={formatNumber(stats.bookmarksAdded)} sub="тайтлов" />
              <StatCard icon={BarChart3} label="Средняя сессия" value={formatDuration(avgSessionMs)} sub="в среднем" />
            </div>

            <div className="bg-card/40 dark:bg-zinc-900/30 backdrop-blur-xl border border-border/50 dark:border-zinc-800/80 rounded-3xl p-4 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base sm:text-lg font-bold text-foreground dark:text-white flex items-center gap-2">
                  <Flame className="w-5 h-5 text-orange-500" />
                  Распределение активности
                </h2>
                <span className="text-xs text-muted-foreground font-medium">Всего действий: {formatNumber(eventBreakdown.reduce((acc, curr) => acc + curr.value, 0))}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                {eventBreakdown.slice(0, 6).map((item) => (
                  <StatBar 
                    key={item.key} 
                    label={item.label} 
                    value={item.value} 
                    icon={item.icon}
                    max={Math.max(...eventBreakdown.map((b) => b.value), 1)} 
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* ВКЛАДКА: ВРЕМЯ */}
        {/* ========================================================================= */}
        {activeTab === "time" && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
              <StatCard icon={Clock} label="Всего времени" value={formatDuration(totalMs)} sub="за всё время" />
              <StatCard icon={Activity} label="Средняя сессия" value={formatDuration(avgSessionMs)} sub="в среднем" />
              <StatCard icon={History} label="Самая долгая сессия" value={formatDuration(longestSessionMs)} sub="рекорд" />
            </div>

            <div className="bg-card/40 dark:bg-zinc-900/30 backdrop-blur-xl border border-border/50 dark:border-zinc-800/80 rounded-3xl p-4 sm:p-6">
              <h2 className="text-base sm:text-lg font-bold text-foreground dark:text-white mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5 text-orange-500" />
                Журнал последних сессий
              </h2>
              {sessions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                  <Clock className="w-10 h-10 mb-2 opacity-30 text-orange-500" />
                  <p className="text-sm font-medium">Сессии пока не зафиксированы</p>
                  <p className="text-xs mt-1 opacity-70">Проводите время на страницах сайта, чтобы они отобразились в списке</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1 custom-scrollbar">
                  {sessions.map((s, i) => {
                    if ((s.end - s.start) <= 0) return null
                    const duration = s.end - s.start
                    const isOpen = expandedSessions.has(i)
                    return (
                      <div key={i} className="rounded-xl bg-secondary/30 border border-border/40 dark:bg-zinc-900/40 dark:border-zinc-800/60 overflow-hidden">
                        <button
                          onClick={() => {
                            const next = new Set(expandedSessions)
                            if (next.has(i)) next.delete(i)
                            else next.add(i)
                            setExpandedSessions(next)
                          }}
                          className="flex items-center justify-between w-full p-3 sm:p-3.5 rounded-xl transition-colors hover:border-orange-500/30"
                        >
                          <div className="flex items-center gap-2.5">
                            <ChevronRight
                              size={16}
                              className={`text-muted-foreground dark:text-zinc-400 shrink-0 transition-transform duration-200 ${isOpen ? "rotate-90" : ""}`}
                            />
                            <span className="w-2 h-2 rounded-full bg-orange-500" />
                            <span className="text-xs sm:text-sm text-foreground/80 dark:text-zinc-300 font-medium">
                              {formatSessionTime(s.start)}
                            </span>
                          </div>
                          <span className="text-xs sm:text-sm font-bold text-orange-500 dark:text-orange-400">
                            {formatDuration(duration)}
                          </span>
                        </button>
                        {isOpen && (
                          <div className="px-3.5 pb-3 pt-1.5 pl-8 text-xs sm:text-sm space-y-1.5 border-t border-border/40 dark:border-zinc-800/60">
                            <DetailRow label="Начало" value={formatSessionTime(s.start)} />
                            <DetailRow label="Конец" value={formatSessionTime(s.end)} />
                            <DetailRow label="Длительность" value={formatDuration(duration)} />
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* ВКЛАДКА: ИСТОРИЯ */}
        {/* ========================================================================= */}
        {activeTab === "history" && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="bg-card/40 dark:bg-zinc-900/30 backdrop-blur-xl border border-border/50 dark:border-zinc-800/80 rounded-3xl p-4 sm:p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-base sm:text-lg font-bold text-foreground dark:text-white flex items-center gap-2">
                  <History className="w-5 h-5 text-orange-500" />
                  История просмотров ({sortedHistoryItems.length})
                </h2>
              </div>

              {sortedHistoryItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
                  <Film className="w-12 h-12 mb-3 opacity-30 text-orange-500" />
                  <p className="text-sm font-medium text-foreground dark:text-zinc-300">История пуста</p>
                  <p className="text-xs mt-1 max-w-xs opacity-70">
                    Начните смотреть аниме в плеере, и прогресс автоматически сохранится здесь
                  </p>
                  <Link
                    href="/catalog"
                    className="mt-4 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-semibold transition-all shadow-md shadow-orange-500/20"
                  >
                    Перейти в каталог
                  </Link>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
                    {visibleHistoryItems.map((item) => {
                      const total = item?.episodesTotal && item.episodesTotal > 0 ? item.episodesTotal : null
                      const progress = item?.episode && total ? Math.min(item.episode / total, 1) : null

                      return (
                        <div
                          key={item.id}
                          className="group relative bg-secondary/30 dark:bg-zinc-900/40 border border-border/50 dark:border-zinc-800/80 rounded-2xl overflow-hidden transition-all hover:border-orange-500/50 hover:shadow-lg flex flex-col"
                        >
                          <Link href={`/watch/${item.id}`} className="relative block aspect-[2/3] w-full overflow-hidden bg-zinc-900">
                            <Image
                              src={normalizePoster(item?.poster)}
                              alt={item.title || "Anime"}
                              fill
                              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                              className="object-cover transition-transform duration-300 group-hover:scale-105"
                            />
                            {item.episode && (
                              <div className="absolute top-2 right-2 px-2 py-0.5 rounded-lg bg-black/80 backdrop-blur-md text-[10px] font-bold text-white border border-white/10">
                                {item.episode} {total ? `/ ${total} эп.` : "эп."}
                              </div>
                            )}
                          </Link>

                          <div className="p-2.5 sm:p-3 flex-1 flex flex-col justify-between">
                            <div>
                              <Link
                                href={`/watch/${item.id}`}
                                className="block font-bold text-xs sm:text-sm text-foreground hover:text-orange-500 transition-colors line-clamp-1 dark:text-zinc-200"
                                title={item.title}
                              >
                                {item.title}
                              </Link>
                              <p className="text-[10px] sm:text-[11px] text-muted-foreground dark:text-zinc-500 mt-0.5">
                                {item.episode ? `Серия ${item.episode}` : "Смотреть"}
                              </p>
                            </div>

                            {progress !== null && (
                              <div className="w-full h-1.5 bg-secondary dark:bg-zinc-800 rounded-full overflow-hidden mt-2.5">
                                <div
                                  className="h-full bg-gradient-to-r from-orange-500 to-amber-500 rounded-full transition-all duration-300"
                                  style={{ width: `${(progress * 100).toFixed(0)}%` }}
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Кнопка «Показать ещё» */}
                  <div className="flex justify-center pt-8 pb-2">
                    {hasMoreHistory ? (
                      <button
                        onClick={loadMoreHistory}
                        disabled={isLoadingMoreHistory}
                        className="inline-flex items-center gap-2 px-6 py-2.5 bg-secondary/70 hover:bg-secondary border border-border/60 text-foreground font-semibold rounded-xl transition-all dark:bg-zinc-900/60 dark:hover:bg-zinc-800 dark:border-zinc-800 text-xs sm:text-sm active:scale-95 disabled:opacity-50 hover:border-orange-500/40"
                      >
                        {isLoadingMoreHistory ? (
                          <>
                            <RefreshCw className="w-4 h-4 text-orange-500 animate-spin" />
                            <span>Загрузка...</span>
                          </>
                        ) : (
                          <span>Показать ещё ({sortedHistoryItems.length - visibleHistoryCount})</span>
                        )}
                      </button>
                    ) : (
                      <p className="text-xs font-medium text-muted-foreground">
                        Вы просмотрели всю историю ({sortedHistoryItems.length})
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* ВКЛАДКА: ПРОГРЕСС */}
        {/* ========================================================================= */}
        {activeTab === "progress" && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="bg-card/40 dark:bg-zinc-900/30 backdrop-blur-xl border border-border/50 dark:border-zinc-800/80 rounded-3xl p-4 sm:p-6">
              <h2 className="text-base sm:text-lg font-bold text-foreground dark:text-white mb-5 flex items-center gap-2">
                <PlayCircle className="w-5 h-5 text-orange-500" />
                Прогресс по просмотренным тайтлам
              </h2>

              {progressByAnime.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
                  <PlayCircle className="w-12 h-12 mb-3 opacity-30 text-orange-500" />
                  <p className="text-sm font-medium text-foreground dark:text-zinc-300">Прогресс не зафиксирован</p>
                  <p className="text-xs mt-1 opacity-70">Смотрите серии в плеере, чтобы видеть степень завершенности тайтлов</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {progressByAnime.map((anime) => {
                    const isCompleted = anime.episodesTotal > 0 && anime.episode >= anime.episodesTotal
                    return (
                      <div
                        key={anime.id}
                        className="p-3 sm:p-4 rounded-2xl bg-secondary/30 dark:bg-zinc-900/40 border border-border/40 dark:border-zinc-800/60 hover:border-orange-500/30 transition-all flex items-center gap-3 sm:gap-4"
                      >
                        <div className="relative w-12 h-16 sm:w-14 sm:h-20 rounded-xl overflow-hidden bg-zinc-800 shrink-0">
                          <Image
                            src={normalizePoster(anime.poster)}
                            alt={anime.title}
                            fill
                            className="object-cover"
                          />
                        </div>

                        <div className="flex-1 min-w-0 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <Link
                              href={`/watch/${anime.id}`}
                              className="text-xs sm:text-sm font-bold text-foreground hover:text-orange-500 transition-colors truncate dark:text-zinc-200"
                            >
                              {anime.title}
                            </Link>
                            <span className="text-[11px] sm:text-xs font-semibold text-muted-foreground dark:text-zinc-400 shrink-0 flex items-center gap-1">
                              {isCompleted && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
                              {anime.episode} {anime.episodesTotal > 0 ? `/ ${anime.episodesTotal} сер.` : "сер."}
                            </span>
                          </div>

                          <div className="h-2 w-full bg-secondary dark:bg-zinc-800 rounded-full overflow-hidden">
                            <div
                              className={cn(
                                "h-full rounded-full transition-all duration-700",
                                isCompleted
                                  ? "bg-emerald-500"
                                  : "bg-gradient-to-r from-orange-500 to-amber-500"
                              )}
                              style={{ width: `${Math.max((anime.progress * 100), 2).toFixed(0)}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* ВКЛАДКА: АКТИВНОСТЬ */}
        {/* ========================================================================= */}
        {activeTab === "activity" && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="bg-card/40 dark:bg-zinc-900/30 backdrop-blur-xl border border-border/50 dark:border-zinc-800/80 rounded-3xl p-4 sm:p-6">
              <h2 className="text-base sm:text-lg font-bold text-foreground dark:text-white mb-5 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-orange-500" />
                Все категории активности
              </h2>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
                {eventBreakdown.map((item) => {
                  const Icon = item.icon
                  return (
                    <div
                      key={item.key}
                      className="bg-secondary/30 dark:bg-zinc-900/40 border border-border/40 dark:border-zinc-800/60 rounded-2xl p-4 flex flex-col justify-between hover:border-orange-500/30 transition-colors"
                    >
                      <div className="inline-flex p-2 rounded-xl bg-orange-500/10 border border-orange-500/20 mb-3 self-start">
                        <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-orange-500" />
                      </div>
                      <div>
                        <p className="text-xl sm:text-2xl font-black text-foreground dark:text-white">
                          {formatNumber(item.value)}
                        </p>
                        <p className="text-[11px] sm:text-xs font-medium text-muted-foreground dark:text-zinc-400 mt-0.5">
                          {item.label}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="space-y-3">
                {eventBreakdown.map((item) => (
                  <StatBar
                    key={item.key}
                    label={item.label}
                    value={item.value}
                    icon={item.icon}
                    max={Math.max(...eventBreakdown.map((b) => b.value), 1)}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

      </div>

      <ScrollToTop />
      <Footer />
    </main>
  )
}