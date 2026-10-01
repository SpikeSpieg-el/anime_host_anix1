"use client"

import { useMemo, useState } from "react"
import { Eye, Bookmark, User, Search, Users, Brain, Sword, Shield, Filter, ArrowUpDown, X, Activity, Mail, ShieldAlert, ShieldCheck, Clock3, MapPin, Loader2, RefreshCw } from "lucide-react"
import Image from "next/image"
import type { UserActivityEvent, UserWithStats } from "./types"

/** Фильтр по активности пользователя. */
type ActivityFilter = "all" | "with_activity" | "with_history" | "with_bookmarks" | "with_battles" | "inactive"

/** Сортировка списка пользователей. */
type SortOption = "default" | "last_active" | "most_history" | "most_bookmarks" | "most_battles" | "username"

const ACTIVITY_FILTERS: { value: ActivityFilter; label: string }[] = [
  { value: "all", label: "Все пользователи" },
  { value: "with_activity", label: "Есть активность на сайте" },
  { value: "with_history", label: "Есть история просмотров" },
  { value: "with_bookmarks", label: "Есть сохранённое" },
  { value: "with_battles", label: "Есть битвы" },
  { value: "inactive", label: "Без активности" },
]

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "default", label: "По умолчанию" },
  { value: "last_active", label: "Сначала активные" },
  { value: "most_history", label: "Больше всего истории" },
  { value: "most_bookmarks", label: "Больше всего закладок" },
  { value: "most_battles", label: "Больше всего боёв" },
  { value: "username", label: "По имени (А→Я)" },
]

function numberValue(value: unknown): number {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

function hasRecordedActivity(user: UserWithStats): boolean {
  const stats = user.accountStats
  return user.watchHistoryCount > 0 || user.bookmarksCount > 0 || (user.aiStats?.total_battles ?? 0) > 0 ||
    numberValue(stats?.page_views) > 0 || numberValue(stats?.total_sessions) > 0 ||
    numberValue(stats?.total_time_ms) > 0 || numberValue(stats?.watch_time_ms) > 0 ||
    numberValue(stats?.gacha_rolls) > 0 || numberValue(stats?.battles_started) > 0 ||
    numberValue(stats?.market_actions) > 0 || numberValue(stats?.searches) > 0 ||
    numberValue(stats?.watch_events) > 0
}

function matchesActivityFilter(user: UserWithStats, filter: ActivityFilter): boolean {
  switch (filter) {
    case "with_activity":
      return hasRecordedActivity(user)
    case "with_history":
      return user.watchHistoryCount > 0
    case "with_bookmarks":
      return user.bookmarksCount > 0
    case "with_battles":
      return (user.aiStats?.total_battles ?? 0) > 0 || numberValue(user.accountStats?.battles_started) > 0
    case "inactive":
      return !hasRecordedActivity(user)
    case "all":
    default:
      return true
  }
}

function sortUsers(users: UserWithStats[], sort: SortOption): UserWithStats[] {
  if (sort === "default") return users
  const sorted = [...users]
  switch (sort) {
    case "last_active":
      return sorted.sort((a, b) => (b.lastActivity ?? "").localeCompare(a.lastActivity ?? ""))
    case "most_history":
      return sorted.sort((a, b) => b.watchHistoryCount - a.watchHistoryCount)
    case "most_bookmarks":
      return sorted.sort((a, b) => b.bookmarksCount - a.bookmarksCount)
    case "most_battles":
      return sorted.sort((a, b) => {
        const aBattles = Math.max(numberValue(a.aiStats?.total_battles), numberValue(a.accountStats?.battles_started))
        const bBattles = Math.max(numberValue(b.aiStats?.total_battles), numberValue(b.accountStats?.battles_started))
        return bBattles - aBattles
      })
    case "username":
      return sorted.sort((a, b) => (a.username ?? "").localeCompare(b.username ?? "", "ru"))
    default:
      return users
  }
}

function describeActivity(event: UserActivityEvent): string {
  const payload = event.payload ?? {}
  const animeId = payload.anime_id ? ` · ID аниме ${payload.anime_id}` : ""
  switch (event.event_type) {
    case "page_view": return `Открыл страницу ${payload.path || "сайта"}`
    case "page_leave": return "Завершил просмотр страницы"
    case "watch_start": return `Начал просмотр${animeId}${payload.episode ? ` · серия ${payload.episode}` : ""}`
    case "watch_end": return `Завершил просмотр${animeId}`
    case "bookmark_add": return `Добавил в сохранённое${animeId}`
    case "bookmark_remove": return `Убрал из сохранённого${animeId}`
    case "search_query": return `Поиск: ${payload.query || "запрос не сохранён"}`
    case "gacha_roll": return "Сделал прокрутку гачи"
    case "battle_started": return "Начал AI-битву"
    case "market_action": return "Действие на рынке"
    default: return event.event_type.replace(/_/g, " ")
  }
}

function formatDuration(milliseconds: unknown): string {
  const totalMinutes = Math.floor(Math.max(0, numberValue(milliseconds)) / 60_000)
  if (totalMinutes < 60) return `${totalMinutes} мин`
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return minutes ? `${hours} ч ${minutes} мин` : `${hours} ч`
}

interface UsersTabProps {
  users: UserWithStats[]
  loading: boolean
  onRefresh: () => void
  searchTerm: string
  onSearchChange: (value: string) => void
  selectedUser: UserWithStats | null
  onSelectUser: (user: UserWithStats) => void
  onOpenMail: (userId: string) => void
  onToggleUserBan: (user: UserWithStats) => void
  detailsLoadingUserId: string | null
  banLoadingUserId: string | null
  detailsError: string | null
  showAllHistory: boolean
  onToggleAllHistory: () => void
  showAllBookmarks: boolean
  onToggleAllBookmarks: () => void
  formatDate: (dateString: string | null) => string
  formatTimestamp: (timestamp: number) => string
}

export function UsersTab({
  users,
  loading,
  onRefresh,
  searchTerm,
  onSearchChange,
  selectedUser,
  onSelectUser,
  onOpenMail,
  onToggleUserBan,
  detailsLoadingUserId,
  banLoadingUserId,
  detailsError,
  showAllHistory,
  onToggleAllHistory,
  showAllBookmarks,
  onToggleAllBookmarks,
  formatDate,
  formatTimestamp,
}: UsersTabProps) {
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>("all")
  const [sortOption, setSortOption] = useState<SortOption>("default")

  const hasActiveFilters = activityFilter !== "all" || sortOption !== "default" || searchTerm.trim().length > 0

  const filteredUsers = useMemo(() => {
    const query = searchTerm.trim().toLowerCase()
    const bySearch = users.filter(user =>
      user.username?.toLowerCase().includes(query) ||
      user.email?.toLowerCase().includes(query) ||
      user.referrerDomain?.toLowerCase().includes(query) ||
      user.id.toLowerCase().includes(query)
    )
    const byActivity = bySearch.filter(user => matchesActivityFilter(user, activityFilter))
    return sortUsers(byActivity, sortOption)
  }, [users, searchTerm, activityFilter, sortOption])

  const resetFilters = () => {
    onSearchChange("")
    setActivityFilter("all")
    setSortOption("default")
  }

  const selectClass =
    "px-3 py-2 bg-muted border border-border rounded focus:outline-none focus:ring-2 focus:ring-primary text-sm text-foreground"

  return (
    <>
      <div className="mb-4 sm:mb-6 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={20} />
            <input
              type="text"
              placeholder="Поиск по имени, e-mail, источнику или ID..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-muted border border-border rounded focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5">
              <Filter size={14} className="text-muted-foreground" />
              <select
                value={activityFilter}
                onChange={(e) => setActivityFilter(e.target.value as ActivityFilter)}
                aria-label="Фильтр по активности"
                className={selectClass}
              >
                {ACTIVITY_FILTERS.map(f => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <ArrowUpDown size={14} className="text-muted-foreground" />
              <select
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value as SortOption)}
                aria-label="Сортировка пользователей"
                className={selectClass}
              >
                {SORT_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            <button
              onClick={onRefresh}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-foreground bg-muted/50 hover:bg-muted border border-border rounded transition disabled:opacity-60"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              Обновить список
            </button>

            {hasActiveFilters && (
              <button
                onClick={resetFilters}
                className="inline-flex items-center gap-1 px-2.5 py-2 text-xs text-muted-foreground hover:text-foreground bg-muted/50 hover:bg-muted border border-border rounded transition"
              >
                <X size={12} />
                Сбросить
              </button>
            )}
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Показано {filteredUsers.length} из {users.length} пользователей
        </p>
      </div>

      <div className="grid gap-3 sm:gap-4 md:gap-6">
        {filteredUsers.map((user) => (
          <div key={user.id} className="bg-card border border-border rounded-lg p-4 sm:p-6 hover:bg-card/80 transition">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4 mb-4">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="relative">
                  {user.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={user.avatar_url}
                      alt={user.username || 'User'}
                      width={48}
                      height={48}
                      className="rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center">
                      <User size={24} className="text-muted-foreground" />
                    </div>
                  )}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-foreground">
                      {user.username && !user.username.includes("@") ? user.username : user.email || user.username || "Без имени"}
                    </h3>
                    {user.is_banned && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-destructive/10 text-destructive border border-destructive/20">
                        Вход заблокирован
                      </span>
                    )}
                  </div>
                  {user.email && user.username && user.username !== user.email && (
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  )}
                  <p className="text-xs text-muted-foreground font-mono truncate" title={user.id}>ID: {user.id}</p>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-xs text-muted-foreground">
                    <span>Регистрация: {formatDate(user.created_at ?? user.updated_at)}</span>
                    <span>Последняя активность: {formatDate(user.lastActivity)}</span>
                    {user.last_sign_in_at && <span>Вход: {formatDate(user.last_sign_in_at)}</span>}
                  </div>
                  {user.referrerDomain && (
                    <p className="mt-1 text-xs text-sky-500 flex items-center gap-1.5">
                      <MapPin size={12} />Источник: <span className="font-mono">{user.referrerDomain}</span>
                    </p>
                  )}
                </div>
              </div>

              <div className="flex gap-4 sm:gap-6 text-sm shrink-0">
                <div className="text-center">
                  <div className="flex items-center gap-1 text-foreground font-semibold">
                    <Eye size={16} />{user.watchHistoryCount}
                  </div>
                  <div className="text-[10px] sm:text-xs text-muted-foreground">Просмотрено</div>
                </div>
                <div className="text-center">
                  <div className="flex items-center gap-1 text-foreground font-semibold">
                    <Bookmark size={16} />{user.bookmarksCount}
                  </div>
                  <div className="text-[10px] sm:text-xs text-muted-foreground">Сохранено</div>
                </div>
                <div className="text-center">
                  <div className="flex items-center gap-1 text-foreground font-semibold">
                    <Activity size={16} />{numberValue(user.accountStats?.page_views)}
                  </div>
                  <div className="text-[10px] sm:text-xs text-muted-foreground">Страниц</div>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => onSelectUser(user)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground text-sm rounded hover:bg-primary/90 transition"
              >
                {detailsLoadingUserId === user.id && <Loader2 size={14} className="animate-spin" />}
                {selectedUser?.id === user.id ? "Скрыть детали" : "Активность и данные"}
              </button>
              <button
                onClick={() => onOpenMail(user.id)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-muted text-foreground text-sm rounded hover:bg-muted/80 transition"
              >
                <Mail size={14} />Написать
              </button>
              {selectedUser?.id === user.id && (
                <button
                  onClick={() => onToggleUserBan(user)}
                  disabled={banLoadingUserId === user.id}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded border transition disabled:opacity-60 ${user.is_banned ? "border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10" : "border-destructive/30 text-destructive hover:bg-destructive/10"}`}
                >
                  {banLoadingUserId === user.id ? <Loader2 size={14} className="animate-spin" /> : user.is_banned ? <ShieldCheck size={14} /> : <ShieldAlert size={14} />}
                  {user.is_banned ? "Снять блокировку" : "Заблокировать вход"}
                </button>
              )}
            </div>

            {selectedUser?.id === user.id && (
              <div className="mt-4 sm:mt-6 pt-4 sm:pt-6 border-t border-border space-y-4 sm:space-y-6">
                {detailsLoadingUserId === user.id ? (
                  <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                    <Loader2 size={18} className="animate-spin" />Загружаем историю и журнал действий…
                  </div>
                ) : detailsError ? (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                    {detailsError}
                  </div>
                ) : user.detailsLoaded ? (
                  <>
                    <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-4">
                      <div className="flex items-center gap-2 font-semibold text-foreground">
                        <Activity size={17} className="text-primary" />Сводка активности
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {[
                          ["Сессии", numberValue(user.accountStats?.total_sessions)],
                          ["Страницы", numberValue(user.accountStats?.page_views)],
                          ["На сайте", formatDuration(user.accountStats?.total_time_ms)],
                          ["В плеере", formatDuration(user.accountStats?.watch_time_ms)],
                          ["Просмотры", user.watchHistoryCount],
                          ["Сохранено", user.bookmarksCount],
                          ["Прокрутки гачи", numberValue(user.accountStats?.gacha_rolls)],
                          ["Поиски", numberValue(user.accountStats?.searches)],
                        ].map(([label, value]) => (
                          <div key={String(label)} className="rounded-lg bg-background/70 border border-border/70 p-3">
                            <p className="text-[11px] text-muted-foreground">{label}</p>
                            <p className="mt-1 text-base font-semibold text-foreground">{value}</p>
                          </div>
                        ))}
                      </div>
                      {user.accountStatsAvailable === false && (
                        <p className="text-xs text-amber-500">Сводная статистика пока недоступна в базе (таблица account_stats не найдена).</p>
                      )}

                      <div className="grid sm:grid-cols-2 gap-3 text-sm">
                        <div className="rounded-lg bg-background/70 border border-border/70 p-3">
                          <p className="text-xs text-muted-foreground mb-1">Источник перехода при регистрации</p>
                          <p className="font-mono break-all text-foreground">{user.referrerDomain || "не сохранён"}</p>
                          {user.referralLandingPage && <p className="mt-1 text-xs text-muted-foreground">Первая страница: {user.referralLandingPage}</p>}
                        </div>
                        <div className="rounded-lg bg-background/70 border border-border/70 p-3">
                          <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><Clock3 size={12} />Первый / последний визит</p>
                          <p className="text-foreground">{formatDate(user.accountStats?.first_visit_at ?? null)}</p>
                          <p className="text-xs text-muted-foreground">Последний: {formatDate(user.accountStats?.last_visit_at ?? user.last_sign_in_at ?? null)}</p>
                        </div>
                      </div>
                      <p className="text-[11px] leading-relaxed text-muted-foreground">
                        Referrer — только подсказка из браузера: он может отсутствовать, быть изменён расширением или подделан. Сам по себе домен не подтверждает атаку. Источник сохраняется только для новых регистраций с согласием на аналитику.
                      </p>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-semibold text-foreground flex items-center gap-2">
                          <Activity size={16} />Журнал действий <span className="text-xs text-muted-foreground font-normal">({user.activityEventsCount ?? user.activityEvents?.length ?? 0})</span>
                        </h4>
                      </div>
                      {user.activityEventsAvailable === false ? (
                        <p className="text-sm text-amber-500 bg-amber-500/5 border border-amber-500/20 rounded-lg p-3">
                          Журнал не подключён: в Supabase не найдена таблица user_activity_events. После применения миграции события будут отображаться здесь.
                        </p>
                      ) : (user.activityEvents ?? []).length > 0 ? (
                        <div className="space-y-2 max-h-80 overflow-y-auto">
                          {(user.activityEvents ?? []).map((event) => (
                            <div key={event.id} className="flex items-start justify-between gap-3 rounded-lg bg-muted/50 p-3">
                              <p className="text-sm text-foreground break-words">{describeActivity(event)}</p>
                              <time className="shrink-0 text-[11px] text-muted-foreground">{formatDate(event.created_at)}</time>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground rounded-lg bg-muted/30 p-3">Записей активности пока нет. История просмотров и сохранённое ниже берутся напрямую из базы данных.</p>
                      )}
                    </div>

                {(showAllHistory ? user.allHistory : user.recentHistory.slice(0, 5)).length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-semibold text-foreground flex items-center gap-2">
                        <Eye size={16} />
                        История просмотров {showAllHistory ? `(${user.allHistory.length})` : `(последние 5)`}
                      </h4>
                      {user.allHistory.length > 5 && (
                        <button
                          onClick={onToggleAllHistory}
                          className="text-sm text-primary hover:text-primary/80 transition"
                        >
                          {showAllHistory ? 'Свернуть' : `Показать все (${user.allHistory.length})`}
                        </button>
                      )}
                    </div>
                    <div className="grid gap-2 max-h-80 sm:max-h-96 overflow-y-auto">
                      {(showAllHistory ? user.allHistory : user.recentHistory.slice(0, 5)).map((item) => (
                        <div key={item.id} className="flex items-center gap-2 sm:gap-3 p-2 bg-muted/50 rounded hover:bg-muted/70 transition">
                          {item.poster && (
                            <Image
                              src={item.poster}
                              alt={item.title}
                              width={32}
                              height={32}
                              className="rounded object-cover flex-shrink-0"
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{item.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {item.episode ? `Серия ${item.episode}` : 'Начал смотреть'} • {formatTimestamp(item.timestamp)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {(showAllBookmarks ? user.allBookmarks : user.recentBookmarks.slice(0, 5)).length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-semibold text-foreground flex items-center gap-2">
                        <Bookmark size={16} />
                        Сохранённое {showAllBookmarks ? `(${user.allBookmarks.length})` : `(последние 5)`}
                      </h4>
                      {user.allBookmarks.length > 5 && (
                        <button
                          onClick={onToggleAllBookmarks}
                          className="text-sm text-primary hover:text-primary/80 transition"
                        >
                          {showAllBookmarks ? 'Свернуть' : `Показать все (${user.allBookmarks.length})`}
                        </button>
                      )}
                    </div>
                    <div className="grid gap-2 max-h-80 sm:max-h-96 overflow-y-auto">
                      {(showAllBookmarks ? user.allBookmarks : user.recentBookmarks.slice(0, 5)).map((item) => (
                        <div key={item.id} className="flex items-center gap-2 sm:gap-3 p-2 bg-muted/50 rounded hover:bg-muted/70 transition">
                          {item.anime_data?.poster && (
                            <Image
                              src={item.anime_data.poster}
                              alt={item.anime_data?.title || 'Untitled'}
                              width={32}
                              height={32}
                              className="rounded object-cover flex-shrink-0"
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">
                              {item.anime_data?.title || 'Untitled'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Добавлено: {formatDate(item.created_at)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {user.aiStats && user.aiStats.total_battles > 0 && (
                  <div>
                    <h4 className="font-semibold text-foreground flex items-center gap-2 mb-3">
                      <Brain size={16} />
                      Статистика AI-битв
                    </h4>
                    <div className="bg-muted/50 rounded-lg p-4 space-y-4">
                      <div className="grid grid-cols-2 gap-3 sm:gap-4">
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Всего битв</p>
                          <p className="text-lg font-semibold text-foreground">{user.aiStats.total_battles}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Последняя битва</p>
                          <p className="text-sm text-foreground">
                            {user.aiStats.last_battle_date ? formatDate(user.aiStats.last_battle_date) : 'Нет данных'}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                        <div>
                          <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                            <Sword size={12} />
                            Атака
                          </p>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full bg-red-500 transition-all"
                                style={{ width: `${user.aiStats.aggressive_rating * 100}%` }}
                              />
                            </div>
                            <span className="text-sm font-medium text-foreground">
                              {(user.aiStats.aggressive_rating * 100).toFixed(0)}%
                            </span>
                          </div>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                            <Shield size={12} />
                            Защита
                          </p>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full bg-blue-500 transition-all"
                                style={{ width: `${user.aiStats.defensive_rating * 100}%` }}
                              />
                            </div>
                            <span className="text-sm font-medium text-foreground">
                              {(user.aiStats.defensive_rating * 100).toFixed(0)}%
                            </span>
                          </div>
                        </div>
                      </div>

                      <div>
                        <p className="text-xs text-muted-foreground mb-2">Предпочитаемые роли</p>
                        <div className="flex gap-2 flex-wrap">
                          {Object.entries(user.aiStats.preferred_roles).map(([role, count]) => (
                            count > 0 && (
                              <span key={role} className="px-2 py-1 bg-primary/20 text-primary text-xs rounded capitalize">
                                {role}: {count}
                              </span>
                            )
                          ))}
                        </div>
                      </div>

                      <div>
                        <p className="text-xs text-muted-foreground mb-2">Предпочитаемые редкости</p>
                        <div className="flex gap-2 flex-wrap">
                          {Object.entries(user.aiStats.preferred_rarities)
                            .sort(([, a], [, b]) => b - a)
                            .slice(0, 5)
                            .map(([rarity, count]) => (
                              <span key={rarity} className="px-2 py-1 bg-secondary/50 text-foreground text-xs rounded capitalize">
                                {rarity}: {count}
                              </span>
                            ))}
                        </div>
                      </div>

                      {user.aiStats.favorite_cards.length > 0 && (
                        <div>
                          <p className="text-xs text-muted-foreground mb-2">Любимые карты</p>
                          <div className="space-y-2 max-h-48 overflow-y-auto">
                            {user.aiStats.favorite_cards.slice(0, 5).map((card: any) => (
                              <div key={card.cardId} className="flex items-center justify-between p-2 bg-muted rounded">
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-foreground truncate">{card.cardName}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {card.anime} • {card.rarity} • {card.role}
                                  </p>
                                </div>
                                <div className="text-right ml-2">
                                  <p className="text-sm font-semibold text-foreground">{card.usageCount}x</p>
                                  <p className="text-xs text-muted-foreground">
                                    Победы: {(card.winRate * 100).toFixed(0)}%
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Средняя стоимость колоды</p>
                        <p className="text-lg font-semibold text-foreground">{user.aiStats.avg_provision_cost.toFixed(1)}</p>
                      </div>
                    </div>
                  </div>
                )}

                {user.allHistory.length === 0 && user.allBookmarks.length === 0 && (!user.aiStats || user.aiStats.total_battles === 0) && !hasRecordedActivity(user) && (
                  <p className="text-center text-muted-foreground py-4">
                    Пока нет сохранённого, истории просмотров или игровой активности.
                  </p>
                )}
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">Откройте детали пользователя, чтобы загрузить его историю, сохранённое и журнал событий.</p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {filteredUsers.length === 0 && !loading && (
        <div className="text-center py-12">
          <Users size={48} className="mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">
            {users.length === 0
              ? "Пользователей пока нет"
              : "По этим параметрам пользователи не найдены"}
          </p>
          {hasActiveFilters && users.length > 0 && (
            <button
              onClick={resetFilters}
              className="mt-3 px-4 py-2 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90 transition"
            >
              Сбросить фильтры
            </button>
          )}
        </div>
      )}
    </>
  )
}
