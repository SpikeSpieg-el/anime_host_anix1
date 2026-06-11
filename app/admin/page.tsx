"use client"

import { useEffect, useState, useTransition } from "react"
import { Users, Eye, Bookmark, User, Search, LogOut, Lock, Brain, Sword, Shield } from "lucide-react"
import Image from "next/image"
import { ScrollToTop } from "@/components/layout/scroll-to-top"
import { Footer } from "@/components/layout/footer"
import { adminLogin, adminLogout, checkAdminAuth, getAdminUsers } from "./actions"

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

export default function AdminPage() {
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

  useEffect(() => {
    checkAdminAuth().then((authenticated) => {
      setIsAuthenticated(authenticated)
      if (authenticated) {
        fetchUsers()
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
            <p className="text-muted-foreground">Manage users and view activity</p>
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
      </div>

      <ScrollToTop />
      <Footer />
    </div>
  )
}
