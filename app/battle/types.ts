import { Rarity } from "@/types/gacha"

export interface Card {
  uniqueId: string
  name: string
  anime: string
  rarity: Rarity
  imageUrl: string
  stats: { hp: number; atk: number; def: number; spd: number; luck: number }
  isMainCharacter?: boolean
  score?: number
}

export interface Dungeon {
  id: string
  name: string
  name_ru: string
  description?: string
  theme: string
  difficulty: number
  required_level: number
  energy_cost: number
  coins_reward_base: number
  dust_reward_base: number
  xp_reward_base: number
  image_url?: string
  enemy_ids?: string[]
  is_daily?: boolean
}

export interface Enemy {
  id: string
  name: string
  name_ru: string
  anime?: string
  image_url?: string
  level: number
  tier: "normal" | "elite" | "boss" | "legendary"
  stats_hp: number
  stats_atk: number
  stats_def: number
  stats_spd: number
  stats_luck: number
  special_ability?: string
  special_desc?: string
}

export interface BattleProgress {
  level: number
  xp: number
  xp_to_next: number
  current_stamina: number
  max_stamina: number
  total_battles: number
  total_wins: number
  total_losses: number
  highest_dungeon_cleared: number
  daily_battles_today: number
  staminaRefillMs?: number
}

export interface BattleLog {
  id: string
  result: "win" | "loss"
  coins_earned: number
  dust_earned: number
  xp_earned: number
  battle_turns: number
  created_at: string
  battle_data?: {
    mvp?: { name: string; totalDamageDealt: number; anime: string }
  }
}
