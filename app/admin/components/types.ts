export interface UserProfile {
  id: string
  username: string | null
  avatar_url: string | null
  updated_at: string | null
  allow_nsfw_search?: boolean
  email?: string
  created_at?: string
}

export interface WatchHistoryItem {
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

export interface BookmarkItem {
  id: string
  user_id: string
  anime_id: string
  anime_data: any
  created_at: string
}

export interface UserWithStats extends UserProfile {
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

export interface BattleAILocationMetric {
  dungeon_id: string
  battles: number
  wins: number
  losses: number
  total_turns: number
  updated_at: string
  playerWinRate: number
  aiWinRate: number
  avgTurns: number
  balanceStatus: "insufficient" | "balanced" | "player_advantage" | "ai_advantage"
}

export interface BattleAIFarmProfile {
  user_id: string
  dungeon_id: string
  battles: number
  wins: number
  losses: number
  consecutive_wins: number
  updated_at: string
  username: string | null
  avatar_url: string | null
  winRate: number
  riskLevel: "normal" | "medium" | "high"
}

export interface BattleAIDashboard {
  generatedAt: string
  summary: {
    totalBattles: number
    playerWinRate: number
    averageTurns: number
    activeLocations: number
    trackedProfiles: number
    highRiskProfiles: number
    balancedLocations: number
    insufficientLocations: number
    playerAdvantageLocations: number
    aiAdvantageLocations: number
  }
  locations: BattleAILocationMetric[]
  farmProfiles: BattleAIFarmProfile[]
}

export interface PvPRule {
  id: string
  name_ru: string
  description_ru: string
  is_active: boolean
  category: string
}

export interface PvPLocation {
  id: string
  name: string
  name_ru: string
  description: string
  description_ru: string
  is_active: boolean
  is_empty: boolean
  rules: { rule_id: string }[]
}

export interface PvPLog {
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
  player1: { username: string | null; avatar_url: string | null }
  player2: { username: string | null; avatar_url: string | null }
}

export interface SimpleUser {
  id: string
  username: string | null
  avatar_url: string | null
  email: string | null
  updated_at: string | null
  created_at: string | null
}

export interface Banner {
  id: string
  name: string
  description?: string | null
  image_url?: string | null
  promo_image_url?: string | null
  featured_anime_ids?: number[]
  boosted_rarity?: string | null
  price?: number | null
  color?: string | null
  start_date?: string | null
  end_date?: string | null
  is_active?: boolean
  sort_order?: number
  guaranteed_card_payload?: any | null
  guaranteed_card_pity?: number
  guaranteed_cards_pool?: any[] | null
  banner_type?: string
}

export interface BannerCard {
  id: string
  banner_id: string
  card_payload: any
  weight: number
  is_featured: boolean
  created_at?: string
}

export type MailType = "card_gift" | "coins" | "dust" | "event_reward" | "message"

export interface BattleBackground {
  id: string
  name: string
  image_url: string
  mode: 'pvp' | 'pve' | 'both'
  is_active: boolean
  sort_order: number
  scale: number
  position_x: number
  position_y: number
  opacity: number
  created_at?: string
}

export type AdminTab = 'users' | 'pvp' | 'ai_battle' | 'battle_logs' | 'cards' | 'mail' | 'events' | 'tutorial'

export interface TutorialSection {
  id: string
  title: string
  icon: React.ReactNode
  description: string
  steps: { title: string; detail: string }[]
  tips?: string[]
  warnings?: string[]
}
