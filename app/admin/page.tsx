"use client"

import { useEffect, useState, useTransition } from "react"
import { Users, Eye, Bookmark, User, Search, LogOut, Lock, Brain, Sword, Shield, Map, Settings, Trash2, Plus, Check, X, History, Trophy } from "lucide-react"
import Image from "next/image"
import { ScrollToTop } from "@/components/layout/scroll-to-top"
import { Footer } from "@/components/layout/footer"
import { adminLogin, adminLogout, checkAdminAuth, getAdminUsers, getPvPRules, updatePvPRule, getPvPLocations, createPvPLocation, deletePvPLocation, getPvPLogs } from "./actions"

interface UserProfile {
  id: string
  username: string | null
  avatar_url: string | null
  updated_at: string | null
  allow_nsfw_search?: boolean
  email?: string
  created_at?: string
}

interface WatchHistoryItem {
  id: string
  user_id: string
  anime_id: string
  title: string
  poster: string | null
  timestamp: number
  episode?: number
  episodes_total?: number
  created_at: string
}

interface BookmarkItem {
  id: string
  user_id: string
  anime_id: string
  anime_data: any
  created_at: string
}

interface UserWithStats extends UserProfile {
  watchHistoryCount: number
  bookmarksCount: number
  lastActivity: string | null
  recentHistory: WatchHistoryItem[]
  recentBookmarks: BookmarkItem[]
  allHistory: WatchHistoryItem[]
  allBookmarks: BookmarkItem[]
  aiStats: {
    total_battles: number
    last_battle_date: string | null
    favorite_cards: any[]
    preferred_roles: Record<string, number>
    preferred_rarities: Record<string, number>
    avg_provision_cost: number
    aggressive_rating: number
    defensive_rating: number
  } | null
}

interface PvPRule {
  id: string
  name_ru: string
  description_ru: string
  is_active: boolean
  category: string
}

interface PvPLocation {
  id: string
  name: string
  name_ru: string
  description: string
  description_ru: string
  is_active: boolean
  is_empty: boolean
  rules: { rule_id: string }[]
}

interface PvPLog {
  id: string
  player1_id: string
  player2_id: string
  winner_id: string | null
  player1_mmr_before: number
  player2_mmr_before: number
  player1_mmr_after: number
  player2_mmr_after: number
  player1_deck: any
  player2_deck: any
  battle_data: any
  duration_seconds: number
  created_at: string
  player1: { username: string; avatar_url: string }
  player2: { username: string; avatar_url: string }
}

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<'users' | 'pvp' | 'battle_logs'>('users')
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [authError, setAuthError] = useState("")
  const [isPending, startTransition] = useTransition()

  const [users, setUsers] = useState<UserWithStats[]>([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedUser, setSelectedUser] = useState<UserWithStats | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showAllHistory, setShowAllHistory] = useState(false)
  const [showAllBookmarks, setShowAllBookmarks] = useState(false)

  // PvP state
  const [pvpRules, setPvPRules] = useState<PvPRule[]>([])
  const [pvpLocations, setPvPLocations] = useState<PvPLocation[]>([])
  const [isPvPLoading, setIsPvPLoading] = useState(false)
  const [showAddLocation, setShowAddLocation] = useState(false)
  const [newLocation, setNewLocation] = useState({
    name: '',
    name_ru: '',
    description: '',
    description_ru: '',
    is_empty: false
  })
  const [selectedRuleIds, setSelectedRuleIds] = useState<string[]>([])

  // Battle Logs state
  const [pvpLogs, setPvPLogs] = useState<PvPLog[]>([])
  const [isLogsLoading, setIsLogsLoading] = useState(false)

  useEffect(() => {
    checkAdminAuth().then((authenticated) => {
      setIsAuthenticated(authenticated)
      if (authenticated) {
        fetchUsers()
        fetchPvPData()
        fetchPvPLogs()
      }
    })
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    startTransition(async () => {
      const formData = new FormData()
      formData.set("username", username)
      formData.set("password", password)
      
      const result = await adminLogin(formData)
      
      if (result?.error) {
        setAuthError(result.error)
      } else {
        setAuthError("")
        setIsAuthenticated(true)
        fetchUsers()
      }
    })
  }

  const handleLogout = async () => {
    await adminLogout()
    setIsAuthenticated(false)
    setUsers([])
  }

  const fetchUsers = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await getAdminUsers()
      setUsers(data)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to load users data"
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const fetchPvPData = async () => {
    try {
      setIsPvPLoading(true)
      const [rules, locations] = await Promise.all([
        getPvPRules(),
        getPvPLocations()
      ])
      setPvPRules(rules)
      setPvPLocations(locations)
    } catch (err) {
      console.error("Failed to fetch PvP data:", err)
    } finally {
      setIsPvPLoading(false)
    }
  }

  const fetchPvPLogs = async () => {
    try {
      setIsLogsLoading(true)
      const logs = await getPvPLogs()
      setPvPLogs(logs)
    } catch (err) {
      console.error("Failed to fetch PvP logs:", err)
    } finally {
      setIsLogsLoading(false)
    }
  }

  const handleToggleRule = async (id: string, currentStatus: boolean) => {
    try {
      await updatePvPRule(id, { is_active: !currentStatus })
      setPvPRules(prev => prev.map(r => r.id === id ? { ...r, is_active: !currentStatus } : r))
    } catch (err) {
      console.error("Failed to toggle rule:", err)
    }
  }

  const handleDeleteLocation = async (id: string) => {
    if (!confirm("Вы уверены, что хотите удалить эту локацию?")) return
    try {
      await deletePvPLocation(id)
      setPvPLocations(prev => prev.filter(l => l.id !== id))
    } catch (err) {
      console.error("Failed to delete location:", err)
    }
  }

  const handleCreateLocation = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const location = await createPvPLocation(newLocation, selectedRuleIds)
      setPvPLocations(prev => [location, ...prev])
      setShowAddLocation(false)
      setNewLocation({
        name: '',
        name_ru: '',
        description: '',
        description_ru: '',
        is_empty: false
      })
      setSelectedRuleIds([])
    } catch (err) {
      console.error("Failed to create location:", err)
    }
  }

  const filteredUsers = users.filter(user => 
    user.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.id.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never'
    return new Date(dateString).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-8">
        <div className="max-w-md w-full">
          <div className="bg-card border border-border rounded-lg p-8">
            <div className="text-center mb-8">
              <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Lock className="w-6 h-6 text-primary" />
              </div>
              <h1 className="text-2xl font-bold text-foreground mb-2">Admin Access</h1>
              <p className="text-muted-foreground">Enter credentials to access admin dashboard</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              {authError && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
                  {authError}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Username</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-3 py-2 bg-muted border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary text-foreground"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-muted border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary text-foreground"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isPending}
                className="w-full py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors font-medium disabled:opacity-50"
              >
                {isPending ? "Signing in..." : "Sign In"}
              </button>
            </form>
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-muted rounded w-48 mb-8"></div>
            <div className="grid gap-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-20 bg-muted rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">
            <p className="text-destructive">{error}</p>
            <button 
              onClick={fetchUsers}
              className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto p-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Admin Dashboard</h1>
            <div className="flex gap-4">
              <button
                onClick={() => setActiveTab('users')}
                className={`text-sm px-4 py-2 rounded-lg transition ${activeTab === 'users' ? 'bg-primary text-primary-foreground font-semibold' : 'text-muted-foreground hover:bg-muted'}`}
              >
                Users Management
              </button>
              <button
                onClick={() => setActiveTab('pvp')}
                className={`text-sm px-4 py-2 rounded-lg transition ${activeTab === 'pvp' ? 'bg-primary text-primary-foreground font-semibold' : 'text-muted-foreground hover:bg-muted'}`}
              >
                PvP Settings
              </button>
              <button
                onClick={() => setActiveTab('battle_logs')}
                className={`text-sm px-4 py-2 rounded-lg transition ${activeTab === 'battle_logs' ? 'bg-primary text-primary-foreground font-semibold' : 'text-muted-foreground hover:bg-muted'}`}
              >
                Battle Logs
              </button>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="text-sm text-muted-foreground">
              Total Users: {users.length}
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 bg-muted hover:bg-muted/80 rounded transition"
              disabled={isPending}
            >
              <LogOut size={16} />
              {isPending ? "Logging out..." : "Logout"}
            </button>
          </div>
        </div>

        {activeTab === 'users' ? (
          <>
            {/* Search */}
            <div className="mb-6">
              <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={20} />
                <input
                  type="text"
                  placeholder="Search users by username or ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-muted border border-border rounded focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            {/* Users Grid */}
            <div className="grid gap-6">
              {filteredUsers.map((user) => (
                <div key={user.id} className="bg-card border border-border rounded-lg p-6 hover:bg-card/80 transition">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-4">
                      {/* Avatar */}
                      <div className="relative">
                        {user.avatar_url ? (
                          <Image
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
                      
                      {/* User Info */}
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

                    {/* Stats */}
                    <div className="flex gap-6 text-sm">
                      <div className="text-center">
                        <div className="flex items-center gap-1 text-foreground font-semibold">
                          <Eye size={16} />
                          {user.watchHistoryCount}
                        </div>
                        <div className="text-xs text-muted-foreground">Watch History</div>
                      </div>
                      <div className="text-center">
                        <div className="flex items-center gap-1 text-foreground font-semibold">
                          <Bookmark size={16} />
                          {user.bookmarksCount}
                        </div>
                        <div className="text-xs text-muted-foreground">Bookmarks</div>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setSelectedUser(selectedUser?.id === user.id ? null : user)
                        setShowAllHistory(false)
                        setShowAllBookmarks(false)
                      }}
                      className="px-3 py-1 bg-primary text-primary-foreground text-sm rounded hover:bg-primary/90 transition"
                    >
                      {selectedUser?.id === user.id ? 'Hide Details' : 'View Details'}
                    </button>
                  </div>

                  {/* Detailed View */}
                  {selectedUser?.id === user.id && (
                    <div className="mt-6 pt-6 border-t border-border space-y-6">
                      {/* Recent Watch History */}
                      {(showAllHistory ? user.allHistory : user.recentHistory.slice(0, 5)).length > 0 && (
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="font-semibold text-foreground flex items-center gap-2">
                              <Eye size={16} />
                              Watch History {showAllHistory ? `(${user.allHistory.length})` : `(Recent 5)`}
                            </h4>
                            {user.allHistory.length > 5 && (
                              <button
                                onClick={() => setShowAllHistory(!showAllHistory)}
                                className="text-sm text-primary hover:text-primary/80 transition"
                              >
                                {showAllHistory ? 'Show Less' : `Show All (${user.allHistory.length})`}
                              </button>
                            )}
                          </div>
                          <div className="grid gap-2 max-h-96 overflow-y-auto">
                            {(showAllHistory ? user.allHistory : user.recentHistory.slice(0, 5)).map((item) => (
                              <div key={item.id} className="flex items-center gap-3 p-2 bg-muted/50 rounded hover:bg-muted/70 transition">
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

                      {/* Recent Bookmarks */}
                      {(showAllBookmarks ? user.allBookmarks : user.recentBookmarks.slice(0, 5)).length > 0 && (
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="font-semibold text-foreground flex items-center gap-2">
                              <Bookmark size={16} />
                              Bookmarks {showAllBookmarks ? `(${user.allBookmarks.length})` : `(Recent 5)`}
                            </h4>
                            {user.allBookmarks.length > 5 && (
                              <button
                                onClick={() => setShowAllBookmarks(!showAllBookmarks)}
                                className="text-sm text-primary hover:text-primary/80 transition"
                              >
                                {showAllBookmarks ? 'Show Less' : `Show All (${user.allBookmarks.length})`}
                              </button>
                            )}
                          </div>
                          <div className="grid gap-2 max-h-96 overflow-y-auto">
                            {(showAllBookmarks ? user.allBookmarks : user.recentBookmarks.slice(0, 5)).map((item) => (
                              <div key={item.id} className="flex items-center gap-3 p-2 bg-muted/50 rounded hover:bg-muted/70 transition">
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

                      {/* AI Learning Stats */}
                      {user.aiStats && user.aiStats.total_battles > 0 && (
                        <div>
                          <h4 className="font-semibold text-foreground flex items-center gap-2 mb-3">
                            <Brain size={16} />
                            AI Learning Statistics
                          </h4>
                          <div className="bg-muted/50 rounded-lg p-4 space-y-4">
                            {/* Basic Stats */}
                            <div className="grid grid-cols-2 gap-4">
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

                            {/* Playstyle Ratings */}
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                                  <Sword size={12} />
                                  Aggressive Rating
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
                                  Defensive Rating
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

                            {/* Preferred Roles */}
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

                            {/* Preferred Rarities */}
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

                            {/* Favorite Cards */}
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

                            {/* Avg Provision Cost */}
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
                <p className="text-muted-foreground">No users found matching your search</p>
              </div>
            )}
          </>
        ) : activeTab === 'pvp' ? (
          <div className="space-y-12">
            {/* PvP Rules Section */}
            <section>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <Settings size={24} className="text-primary" />
                  PvP Rules (Modifiers)
                </h2>
                <div className="text-sm text-muted-foreground">
                  {pvpRules.filter(r => r.is_active).length} active / {pvpRules.length} total
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {pvpRules.map((rule) => (
                  <div key={rule.id} className={`p-4 rounded-lg border transition ${rule.is_active ? 'bg-card border-primary/20' : 'bg-muted/50 border-transparent opacity-60'}`}>
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold text-sm">{rule.name_ru}</h3>
                      <button
                        onClick={() => handleToggleRule(rule.id, rule.is_active)}
                        className={`w-10 h-5 rounded-full relative transition-colors ${rule.is_active ? 'bg-primary' : 'bg-muted'}`}
                      >
                        <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${rule.is_active ? 'left-6' : 'left-1'}`} />
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{rule.description_ru}</p>
                    <div className="text-[10px] uppercase tracking-wider text-primary font-bold">{rule.category}</div>
                  </div>
                ))}
              </div>
            </section>

            {/* PvP Locations Section */}
            <section>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <Map size={24} className="text-primary" />
                  Custom Locations
                </h2>
                <button
                  onClick={() => setShowAddLocation(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition"
                >
                  <Plus size={18} />
                  Add Location
                </button>
              </div>

              {showAddLocation && (
                <div className="bg-card border border-primary/30 rounded-xl p-6 mb-8 shadow-xl">
                  <form onSubmit={handleCreateLocation} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1 uppercase">Name (Internal)</label>
                        <input
                          type="text"
                          required
                          value={newLocation.name}
                          onChange={(e) => setNewLocation({...newLocation, name: e.target.value})}
                          placeholder="e.g. leaf_village"
                          className="w-full px-3 py-2 bg-muted border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1 uppercase">Name (Russian)</label>
                        <input
                          type="text"
                          required
                          value={newLocation.name_ru}
                          onChange={(e) => setNewLocation({...newLocation, name_ru: e.target.value})}
                          placeholder="e.g. Деревня Листа"
                          className="w-full px-3 py-2 bg-muted border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary text-sm"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1 uppercase">Description (Internal)</label>
                        <textarea
                          required
                          value={newLocation.description}
                          onChange={(e) => setNewLocation({...newLocation, description: e.target.value})}
                          className="w-full px-3 py-2 bg-muted border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary text-sm h-20"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1 uppercase">Description (Russian)</label>
                        <textarea
                          required
                          value={newLocation.description_ru}
                          onChange={(e) => setNewLocation({...newLocation, description_ru: e.target.value})}
                          className="w-full px-3 py-2 bg-muted border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary text-sm h-20"
                        />
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 mb-4">
                      <input
                        type="checkbox"
                        id="is_empty"
                        checked={newLocation.is_empty}
                        onChange={(e) => setNewLocation({...newLocation, is_empty: e.target.checked})}
                      />
                      <label htmlFor="is_empty" className="text-sm cursor-pointer">Neutral Location (No rules)</label>
                    </div>

                    {!newLocation.is_empty && (
                      <div className="space-y-2">
                        <label className="block text-xs font-medium text-muted-foreground mb-1 uppercase">Select Rules (Max 1 per location usually)</label>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 max-h-48 overflow-y-auto p-2 border border-border rounded bg-muted/30">
                          {pvpRules.filter(r => r.is_active).map(rule => (
                            <div 
                              key={rule.id}
                              onClick={() => {
                                if (selectedRuleIds.includes(rule.id)) {
                                  setSelectedRuleIds(prev => prev.filter(id => id !== rule.id))
                                } else {
                                  setSelectedRuleIds(prev => [...prev, rule.id])
                                }
                              }}
                              className={`p-2 rounded text-[10px] cursor-pointer transition flex items-center justify-between ${selectedRuleIds.includes(rule.id) ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted-foreground/10'}`}
                            >
                              <span className="truncate">{rule.name_ru}</span>
                              {selectedRuleIds.includes(rule.id) && <Check size={10} />}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex justify-end gap-3 pt-4">
                      <button
                        type="button"
                        onClick={() => setShowAddLocation(false)}
                        className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-6 py-2 bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-primary/90 transition shadow-lg"
                      >
                        Create Location
                      </button>
                    </div>
                  </form>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {pvpLocations.map((loc) => (
                  <div key={loc.id} className="bg-card border border-border rounded-xl p-6 shadow-sm group">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-xl font-bold flex items-center gap-2">
                          {loc.name_ru}
                          {loc.is_empty && <span className="text-[10px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full uppercase tracking-tighter">Neutral</span>}
                        </h3>
                        <p className="text-sm text-muted-foreground italic">{loc.name}</p>
                      </div>
                      <button
                        onClick={() => handleDeleteLocation(loc.id)}
                        className="p-2 text-muted-foreground hover:text-destructive transition opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 size={20} />
                      </button>
                    </div>
                    <p className="text-sm mb-4 line-clamp-3">{loc.description_ru}</p>
                    
                    <div className="flex flex-wrap gap-2">
                      {loc.rules.map((ruleMapping: any) => {
                        const rule = pvpRules.find(r => r.id === ruleMapping.rule_id)
                        return (
                          <span key={ruleMapping.rule_id} className="text-[10px] bg-primary/10 text-primary border border-primary/20 px-2 py-1 rounded-md font-semibold">
                            {rule?.name_ru || ruleMapping.rule_id}
                          </span>
                        )
                      })}
                      {loc.rules.length === 0 && !loc.is_empty && (
                        <span className="text-[10px] text-destructive font-bold uppercase">No rules assigned</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <History size={24} className="text-primary" />
                PvP Battle Logs
              </h2>
              <button
                onClick={fetchPvPLogs}
                className="text-sm text-primary hover:underline"
                disabled={isLogsLoading}
              >
                Refresh
              </button>
            </div>

            {isLogsLoading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : (
              <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-6 py-4 font-semibold">Match ID / Time</th>
                      <th className="px-6 py-4 font-semibold">Player 1</th>
                      <th className="px-6 py-4 font-semibold">Player 2</th>
                      <th className="px-6 py-4 font-semibold">Winner</th>
                      <th className="px-6 py-4 font-semibold">Duration</th>
                      <th className="px-6 py-4 font-semibold">Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {pvpLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-muted/30 transition text-sm">
                        <td className="px-6 py-4">
                          <div className="font-mono text-[10px] text-muted-foreground mb-1 truncate max-w-[100px]">{log.id}</div>
                          <div className="text-xs">{formatDate(log.created_at)}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            {log.player1.avatar_url && (
                              <Image src={log.player1.avatar_url} alt="" width={24} height={24} className="rounded-full" />
                            )}
                            <div className="flex flex-col">
                              <span className="font-medium truncate max-w-[80px]">{log.player1.username || 'P1'}</span>
                              <span className="text-[10px] text-muted-foreground">{log.player1_mmr_before} → {log.player1_mmr_after}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            {log.player2.avatar_url && (
                              <Image src={log.player2.avatar_url} alt="" width={24} height={24} className="rounded-full" />
                            )}
                            <div className="flex flex-col">
                              <span className="font-medium truncate max-w-[80px]">{log.player2.username || 'P2'}</span>
                              <span className="text-[10px] text-muted-foreground">{log.player2_mmr_before} → {log.player2_mmr_after}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {log.winner_id ? (
                            <div className="flex items-center gap-1 text-emerald-500 font-bold">
                              <Trophy size={14} />
                              <span className="truncate max-w-[80px]">
                                {log.winner_id === log.player1_id ? (log.player1.username || 'P1') : (log.player2.username || 'P2')}
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">Draw</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-muted-foreground">
                          {log.duration_seconds}s
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            log.battle_data?.reason === 'complete' ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20' : 
                            log.battle_data?.reason === 'disconnect' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' :
                            'bg-muted text-muted-foreground'
                          }`}>
                            {log.battle_data?.reason || 'unknown'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {pvpLogs.length === 0 && (
                  <div className="py-12 text-center text-muted-foreground">
                    No battle logs found
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <ScrollToTop />
      <Footer />
    </div>
  )
}
