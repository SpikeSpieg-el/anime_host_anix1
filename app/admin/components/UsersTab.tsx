"use client"

import { useMemo, useState } from "react"
import { Eye, Bookmark, User, Search, Users, Brain, Sword, Shield, Filter, ArrowUpDown, X } from "lucide-react"
import Image from "next/image"
import type { UserWithStats } from "./types"

/** Фильтр по активности пользователя. */
type ActivityFilter = "all" | "with_history" | "with_bookmarks" | "with_pvp" | "inactive"

/** Сортировка списка пользователей. */
type SortOption = "default" | "last_active" | "most_history" | "most_bookmarks" | "most_pvp" | "username"

const ACTIVITY_FILTERS: { value: ActivityFilter; label: string }[] = [
  { value: "all", label: "Все пользователи" },
  { value: "with_history", label: "Есть история просмотров" },
  { value: "with_bookmarks", label: "Есть закладки" },
  { value: "with_pvp", label: "Есть PvP-битвы" },
  { value: "inactive", label: "Без активности" },
]

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "default", label: "По умолчанию" },
  { value: "last_active", label: "Сначала активные" },
  { value: "most_history", label: "Больше всего истории" },
  { value: "most_bookmarks", label: "Больше всего закладок" },
  { value: "most_pvp", label: "Больше всего PvP-битв" },
  { value: "username", label: "По имени (А→Я)" },
]

function matchesActivityFilter(user: UserWithStats, filter: ActivityFilter): boolean {
  switch (filter) {
    case "with_history":
      return user.watchHistoryCount > 0
    case "with_bookmarks":
      return user.bookmarksCount > 0
    case "with_pvp":
      return (user.aiStats?.total_battles ?? 0) > 0
    case "inactive":
      return user.watchHistoryCount === 0 && user.bookmarksCount === 0 && (user.aiStats?.total_battles ?? 0) === 0
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
    case "most_pvp":
      return sorted.sort((a, b) => (b.aiStats?.total_battles ?? 0) - (a.aiStats?.total_battles ?? 0))
    case "username":
      return sorted.sort((a, b) => (a.username ?? "").localeCompare(b.username ?? "", "ru"))
    default:
      return users
  }
}

interface UsersTabProps {
  users: UserWithStats[]
  loading: boolean
  searchTerm: string
  onSearchChange: (value: string) => void
  selectedUser: UserWithStats | null
  onSelectUser: (user: UserWithStats) => void
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
  searchTerm,
  onSearchChange,
  selectedUser,
  onSelectUser,
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
              placeholder="Search users by username or ID..."
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

                <div>
                  <h3 className="font-semibold text-foreground">
                    {user.username || 'Unknown User'}
                  </h3>
                  <p className="text-sm text-muted-foreground font-mono">
                    ID: {user.id}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Last active: {formatDate(user.lastActivity)}
                  </p>
                </div>
              </div>

              <div className="flex gap-4 sm:gap-6 text-sm">
                <div className="text-center">
                  <div className="flex items-center gap-1 text-foreground font-semibold">
                    <Eye size={16} />
                    {user.watchHistoryCount}
                  </div>
                  <div className="text-[10px] sm:text-xs text-muted-foreground">History</div>
                </div>
                <div className="text-center">
                  <div className="flex items-center gap-1 text-foreground font-semibold">
                    <Bookmark size={16} />
                    {user.bookmarksCount}
                  </div>
                  <div className="text-[10px] sm:text-xs text-muted-foreground">Bookmarks</div>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => onSelectUser(user)}
                className="px-3 py-1 bg-primary text-primary-foreground text-sm rounded hover:bg-primary/90 transition"
              >
                {selectedUser?.id === user.id ? 'Hide Details' : 'View Details'}
              </button>
            </div>

            {selectedUser?.id === user.id && (
              <div className="mt-4 sm:mt-6 pt-4 sm:pt-6 border-t border-border space-y-4 sm:space-y-6">
                {(showAllHistory ? user.allHistory : user.recentHistory.slice(0, 5)).length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-semibold text-foreground flex items-center gap-2">
                        <Eye size={16} />
                        Watch History {showAllHistory ? `(${user.allHistory.length})` : `(Recent 5)`}
                      </h4>
                      {user.allHistory.length > 5 && (
                        <button
                          onClick={onToggleAllHistory}
                          className="text-sm text-primary hover:text-primary/80 transition"
                        >
                          {showAllHistory ? 'Show Less' : `Show All (${user.allHistory.length})`}
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
                              {item.episode ? `Episode ${item.episode}` : 'Started watching'} • {formatTimestamp(item.timestamp)}
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
                        Bookmarks {showAllBookmarks ? `(${user.allBookmarks.length})` : `(Recent 5)`}
                      </h4>
                      {user.allBookmarks.length > 5 && (
                        <button
                          onClick={onToggleAllBookmarks}
                          className="text-sm text-primary hover:text-primary/80 transition"
                        >
                          {showAllBookmarks ? 'Show Less' : `Show All (${user.allBookmarks.length})`}
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
                              Bookmarked on {formatDate(item.created_at)}
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
                      AI Learning Statistics
                    </h4>
                    <div className="bg-muted/50 rounded-lg p-4 space-y-4">
                      <div className="grid grid-cols-2 gap-3 sm:gap-4">
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Total Battles</p>
                          <p className="text-lg font-semibold text-foreground">{user.aiStats.total_battles}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Last Battle</p>
                          <p className="text-sm text-foreground">
                            {user.aiStats.last_battle_date ? formatDate(user.aiStats.last_battle_date) : 'Never'}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                        <div>
                          <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                            <Sword size={12} />
                            Aggressive
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
                            Defensive
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
                        <p className="text-xs text-muted-foreground mb-2">Preferred Roles</p>
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
                        <p className="text-xs text-muted-foreground mb-2">Preferred Rarities</p>
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
                          <p className="text-xs text-muted-foreground mb-2">Top Favorite Cards</p>
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
                                    WR: {(card.winRate * 100).toFixed(0)}%
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Average Provision Cost</p>
                        <p className="text-lg font-semibold text-foreground">{user.aiStats.avg_provision_cost.toFixed(1)}</p>
                      </div>
                    </div>
                  </div>
                )}

                {user.allHistory.length === 0 && user.allBookmarks.length === 0 && (!user.aiStats || user.aiStats.total_battles === 0) && (
                  <p className="text-center text-muted-foreground py-4">
                    No recent activity
                  </p>
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
              ? "No users found"
              : "No users found matching your search and filters"}
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
