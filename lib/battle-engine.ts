// lib/battle-engine.ts - Utility functions for battle system
import { Rarity } from "@/types/gacha"

// ==========================================
// TYPES (for API compatibility)
// ==========================================

export interface BattleCard {
  uniqueId: string
  name: string
  anime: string
  rarity: Rarity
  imageUrl: string
  stats: {
    hp: number
    atk: number
    def: number
    spd: number
    luck: number
  }
  isMainCharacter?: boolean
}

export interface BattleEnemy {
  id: string
  name: string
  nameRu: string
  anime?: string
  imageUrl?: string
  level: number
  tier: "normal" | "elite" | "boss" | "legendary"
  stats: {
    hp: number
    atk: number
    def: number
    spd: number
    luck: number
  }
  specialAbility?: string
  specialDesc?: string
}

// ==========================================
// ENEMY POWER CALCULATION
// ==========================================

function getEnemyTierScale(tier: BattleEnemy["tier"]): number {
  const scales: Record<BattleEnemy["tier"], number> = {
    normal: 1.0,
    elite: 1.5,
    boss: 2.0,
    legendary: 3.0,
  }
  return scales[tier] || 1.0
}

export function calculateEnemyPower(enemy: BattleEnemy): number {
  const totalStats = enemy.stats.hp + enemy.stats.atk * 2 + enemy.stats.def + enemy.stats.spd + enemy.stats.luck
  const tierScale = getEnemyTierScale(enemy.tier)
  return Math.round(totalStats * tierScale)
}

export function calculateEnemyTeamPower(enemies: BattleEnemy[]): {
  totalPower: number
  avgPower: number
  rating: string
  ratingColor: string
} {
  if (enemies.length === 0) {
    return { totalPower: 0, avgPower: 0, rating: "F", ratingColor: "from-stone-500 to-stone-700" }
  }

  const powers = enemies.map(enemy => calculateEnemyPower(enemy))
  const totalPower = powers.reduce((sum, p) => sum + p, 0)
  const avgPower = Math.round(totalPower / enemies.length)

  let rating: string
  let ratingColor: string

  if (avgPower >= 800) { rating = "SSS"; ratingColor = "from-red-400 to-rose-600" }
  else if (avgPower >= 600) { rating = "SS"; ratingColor = "from-orange-400 to-red-500" }
  else if (avgPower >= 450) { rating = "S"; ratingColor = "from-amber-400 to-orange-500" }
  else if (avgPower >= 350) { rating = "A"; ratingColor = "from-yellow-400 to-amber-500" }
  else if (avgPower >= 250) { rating = "B"; ratingColor = "from-lime-400 to-green-500" }
  else if (avgPower >= 150) { rating = "C"; ratingColor = "from-blue-400 to-indigo-500" }
  else if (avgPower >= 80) { rating = "D"; ratingColor = "from-slate-400 to-slate-500" }
  else { rating = "F"; ratingColor = "from-stone-500 to-stone-700" }

  return { totalPower, avgPower, rating, ratingColor }
}

// ==========================================
// TEAM POWER CALCULATION
// ==========================================

function getRarityMultiplier(rarity: Rarity): number {
  const multipliers: Record<Rarity, number> = {
    trash: 0.5,
    common: 0.7,
    uncommon: 0.85,
    rare: 1.0,
    super_rare: 1.2,
    epic: 1.45,
    mythic: 1.7,
    legendary: 2.0,
    ancient: 2.4,
    divine: 2.8,
    transcendent: 3.3,
    omnipotent: 4.0,
  }
  return multipliers[rarity] || 1.0
}

function getMainCharBonus(isMainCharacter: boolean): number {
  return isMainCharacter ? 1.15 : 1.0
}

export function calculateTeamPower(cards: BattleCard[]): {
  totalPower: number
  avgPower: number
  rating: string
  ratingColor: string
} {
  if (cards.length === 0) {
    return { totalPower: 0, avgPower: 0, rating: "F", ratingColor: "from-stone-500 to-stone-700" }
  }

  const powers = cards.map(card => {
    const rarityMult = getRarityMultiplier(card.rarity)
    const mainCharMult = getMainCharBonus(card.isMainCharacter || false)
    const totalStats = card.stats.hp + card.stats.atk * 2 + card.stats.def + card.stats.spd + card.stats.luck
    return Math.round(totalStats * rarityMult * mainCharMult)
  })

  const totalPower = powers.reduce((sum, p) => sum + p, 0)
  const avgPower = Math.round(totalPower / cards.length)

  let rating: string
  let ratingColor: string

  if (avgPower >= 800) { rating = "SSS"; ratingColor = "from-white via-yellow-200 to-amber-500" }
  else if (avgPower >= 600) { rating = "SS"; ratingColor = "from-amber-400 to-orange-500" }
  else if (avgPower >= 450) { rating = "S"; ratingColor = "from-pink-400 to-rose-600" }
  else if (avgPower >= 350) { rating = "A"; ratingColor = "from-purple-500 to-pink-500" }
  else if (avgPower >= 250) { rating = "B"; ratingColor = "from-blue-400 to-cyan-500" }
  else if (avgPower >= 150) { rating = "C"; ratingColor = "from-emerald-400 to-teal-500" }
  else if (avgPower >= 80) { rating = "D"; ratingColor = "from-slate-400 to-slate-500" }
  else { rating = "F"; ratingColor = "from-stone-500 to-stone-700" }

  return { totalPower, avgPower, rating, ratingColor }
}

// ==========================================
// STAMINA CALCULATIONS
// ==========================================

export function calculateStaminaRefill(lastRefill: string, currentStamina: number, maxStamina: number): {
  stamina: number
  nextRefillMs: number
  canRefill: boolean
} {
  const lastTime = new Date(lastRefill).getTime()
  const now = Date.now()
  const elapsedMs = now - lastTime
  const staminaPerHour = 1
  const msPerStamina = (60 * 60 * 1000) / staminaPerHour // 1 stamina per hour
  const staminaToRegen = Math.floor(elapsedMs / msPerStamina)

  const newStamina = Math.min(maxStamina, currentStamina + staminaToRegen)
  const nextRefillMs = newStamina < maxStamina
    ? msPerStamina - (elapsedMs % msPerStamina)
    : 0
  const canRefill = staminaToRegen > 0

  return { stamina: newStamina, nextRefillMs, canRefill }
}

// ==========================================
// LEVEL UP SYSTEM
// ==========================================

export function calculateLevelUp(xp: number, xpToNext: number, currentLevel: number): {
  leveledUp: boolean
  newLevel: number
  newXp: number
  newXpToNext: number
  newMaxStamina: number
} {
  if (xp < xpToNext) {
    return {
      leveledUp: false,
      newLevel: currentLevel,
      newXp: xp,
      newXpToNext: xpToNext,
      newMaxStamina: 10 + Math.floor(currentLevel / 5),
    }
  }

  let remainingXp = xp - xpToNext
  let level = currentLevel + 1
  let xpToNextLevel = Math.round(100 * Math.pow(1.3, level - 1))
  let levelsGained = 1

  while (remainingXp >= xpToNextLevel) {
    remainingXp -= xpToNextLevel
    level++
    xpToNextLevel = Math.round(100 * Math.pow(1.3, level - 1))
    levelsGained++
    if (levelsGained > 10) break // Safety cap
  }

  return {
    leveledUp: true,
    newLevel: level,
    newXp: remainingXp,
    newXpToNext: xpToNextLevel,
    newMaxStamina: 10 + Math.floor(level / 5),
  }
}
