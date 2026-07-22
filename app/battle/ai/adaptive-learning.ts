import { Card } from "../types"
import { supabase } from "@/lib/supabase"
import { getCardProvision } from "../utils"

// ============================================================================
// ТИПЫ ДЛЯ СИСТЕМЫ АДАПТАЦИИ
// ============================================================================

export interface PlayerCardUsage {
  cardId: string
  cardName: string
  anime: string
  rarity: string
  role: string
  usageCount: number
  lastUsed: number
  winRate: number
  totalBattles: number
  wins: number
}

export interface PlayerPlaystyle {
  favoriteCards: PlayerCardUsage[]
  preferredRoles: Record<string, number> // { vanguard: 5, guard: 3, trickster: 2 }
  preferredRarities: Record<string, number> // { legendary: 3, epic: 5, ... }
  avgProvisionCost: number
  // RPS-based: what roles the player prefers (0-1 each, normalized)
  rolePreference: { vanguard: number; guard: number; trickster: number }
  // Which counter-roles AI should prioritize (0-1 each)
  counterRolePriority: { vanguard: number; guard: number; trickster: number }
  // How often player uses secret cards as bluff (0-1)
  bluffTendency: number
  totalBattles: number
  lastBattleDate: number
}

export interface AIAdaptationConfig {
  enableAdaptiveLearning: boolean
  adaptationStrength: number // 0-1, насколько сильно адаптируется (0.3 = слабо, 0.8 = сильно)
  minBattlesForAdaptation: number // минимальное количество битв для начала адаптации
  counterFavoriteCards: boolean // выбирать карты против любимых карт игрока
  adaptToPlaystyle: boolean // адаптировать агрессивность/защиту под стиль игрока
}

const DEFAULT_ADAPTATION_CONFIG: AIAdaptationConfig = {
  enableAdaptiveLearning: true,
  adaptationStrength: 0.5,
  minBattlesForAdaptation: 5,
  counterFavoriteCards: true,
  adaptToPlaystyle: true
}

// ============================================================================
// МЕНЕДЖЕР АДАПТАЦИИ AI
// ============================================================================

class AIAdaptiveLearning {
  private config: AIAdaptationConfig
  private playerPlaystyle: PlayerPlaystyle | null = null
  private storageKey: string

  constructor(userId: string, config: Partial<AIAdaptationConfig> = {}) {
    this.config = { ...DEFAULT_ADAPTATION_CONFIG, ...config }
    this.storageKey = `ai_adaptive_learning_${userId}`
    this.loadPlayerPlaystyle()
  }

  // Загрузка данных о стиле игры из localStorage
  private loadPlayerPlaystyle() {
    try {
      const stored = localStorage.getItem(this.storageKey)
      if (stored) {
        this.playerPlaystyle = JSON.parse(stored)
      }
    } catch (err) {
      console.error('[AI Adaptive Learning] Error loading playstyle:', err)
    }
  }

  // Сохранение данных о стиле игры в localStorage
  private savePlayerPlaystyle() {
    if (!this.playerPlaystyle) return
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.playerPlaystyle))
    } catch (err) {
      console.error('[AI Adaptive Learning] Error saving playstyle:', err)
    }
  }

  // Сохранение данных о стиле игры в Supabase
  private async savePlayerPlaystyleToDB(userId: string) {
    if (!this.playerPlaystyle) return

    try {
      const { error } = await supabase
        .from('ai_learning_stats')
        .upsert({
          user_id: userId,
          total_battles: this.playerPlaystyle.totalBattles,
          last_battle_date: new Date(this.playerPlaystyle.lastBattleDate).toISOString(),
          favorite_cards: this.playerPlaystyle.favoriteCards,
          preferred_roles: this.playerPlaystyle.preferredRoles,
          preferred_rarities: this.playerPlaystyle.preferredRarities,
          avg_provision_cost: this.playerPlaystyle.avgProvisionCost,
          role_preference: this.playerPlaystyle.rolePreference,
          counter_role_priority: this.playerPlaystyle.counterRolePriority,
          bluff_tendency: this.playerPlaystyle.bluffTendency,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        })

      if (error) {
        console.error('[AI Adaptive Learning] Error saving to DB:', error)
      } else {
        console.log('[AI Adaptive Learning] Successfully saved to DB')
      }
    } catch (err) {
      console.error('[AI Adaptive Learning] Exception saving to DB:', err)
    }
  }

  // Обновление статистики после битвы
  async recordBattle(
    playerCards: Card[],
    playerWon: boolean,
    playerDeck: Card[],
    userId?: string,
    hiddenCardCount: number = 0,
    totalDeployedCount: number = 0
  ) {
    if (!this.config.enableAdaptiveLearning) return

    const now = Date.now()
    
    // Инициализация если нет данных
    if (!this.playerPlaystyle) {
      this.playerPlaystyle = {
        favoriteCards: [],
        preferredRoles: { vanguard: 0, guard: 0, trickster: 0 },
        preferredRarities: {},
        avgProvisionCost: 0,
        rolePreference: { vanguard: 0.33, guard: 0.33, trickster: 0.34 },
        counterRolePriority: { vanguard: 0.33, guard: 0.33, trickster: 0.34 },
        bluffTendency: 0.5,
        totalBattles: 0,
        lastBattleDate: now
      }
    }

    const playstyle = this.playerPlaystyle!
    playstyle.totalBattles++
    playstyle.lastBattleDate = now

    // Exponential decay factor — old data loses ~8% weight per battle
    // After 10 battles, old data retains ~46% of its weight
    const DECAY = 0.92

    // Apply decay to all existing role/rarity counts before adding new data
    const roleKeys = Object.keys(playstyle.preferredRoles)
    roleKeys.forEach(r => {
      if (playstyle.preferredRoles[r] > 0) {
        playstyle.preferredRoles[r] = playstyle.preferredRoles[r] * DECAY
      }
    })
    const rarityKeys = Object.keys(playstyle.preferredRarities)
    rarityKeys.forEach(r => {
      if (playstyle.preferredRarities[r] > 0) {
        playstyle.preferredRarities[r] = playstyle.preferredRarities[r] * DECAY
      }
    })

    // Обновляем статистику для каждой карты в колоде
    playerDeck.forEach(card => {
      const existing = playstyle.favoriteCards.find(fc => fc.cardId === card.uniqueId)
      
      if (existing) {
        existing.usageCount = existing.usageCount * DECAY + 1
        existing.lastUsed = now
        existing.totalBattles++
        if (playerWon) existing.wins++
        existing.winRate = existing.wins / existing.totalBattles
      } else {
        playstyle.favoriteCards.push({
          cardId: card.uniqueId,
          cardName: card.name,
          anime: card.anime,
          rarity: card.rarity,
          role: card.role || 'unknown',
          usageCount: 1,
          lastUsed: now,
          winRate: playerWon ? 1 : 0,
          totalBattles: 1,
          wins: playerWon ? 1 : 0
        })
      }

      // Обновляем предпочтения по ролям (with decay already applied above)
      const role = card.role || 'unknown'
      playstyle.preferredRoles[role] = (playstyle.preferredRoles[role] || 0) + 1

      // Обновляем предпочтения по редкости (with decay already applied above)
      playstyle.preferredRarities[card.rarity] = (playstyle.preferredRarities[card.rarity] || 0) + 1
    })

    // Вычисляем средний provision cost
    const totalProvision = playerDeck.reduce((sum, c) => sum + (c.provisionCost || getCardProvision(c)), 0)
    playstyle.avgProvisionCost = totalProvision / playerDeck.length

    // RPS-based role preference (normalized 0-1)
    const totalRoleUsage = Object.values(playstyle.preferredRoles).reduce((a, b) => a + b, 0)
    if (totalRoleUsage > 0) {
      const vanguardRatio = (playstyle.preferredRoles.vanguard || 0) / totalRoleUsage
      const guardRatio = (playstyle.preferredRoles.guard || 0) / totalRoleUsage
      const tricksterRatio = (playstyle.preferredRoles.trickster || 0) / totalRoleUsage

      playstyle.rolePreference = {
        vanguard: vanguardRatio,
        guard: guardRatio,
        trickster: tricksterRatio
      }

      // Counter-pick: if player prefers X, AI should prioritize counter-role
      // RPS: guard beats vanguard, trickster beats guard, vanguard beats trickster
      playstyle.counterRolePriority = {
        guard: vanguardRatio,       // player likes vanguard → AI needs guard
        trickster: guardRatio,      // player likes guard → AI needs trickster
        vanguard: tricksterRatio    // player likes trickster → AI needs vanguard
      }
    }

    // Update bluff_tendency based on actual hidden card usage
    // bluffRatio = hidden cards / total deployed cards (0 = never bluffs, 1 = always hidden)
    if (totalDeployedCount > 0) {
      const battleBluffRatio = hiddenCardCount / totalDeployedCount
      // Exponential moving average: blend old tendency with new battle data
      playstyle.bluffTendency = playstyle.bluffTendency * DECAY + battleBluffRatio * (1 - DECAY + 0.08)
      playstyle.bluffTendency = Math.max(0.05, Math.min(0.95, playstyle.bluffTendency))
    }

    // Сортируем любимые карты по частоте использования
    playstyle.favoriteCards.sort((a, b) => b.usageCount - a.usageCount)

    // Сохраняем в localStorage
    this.savePlayerPlaystyle()

    // Сохраняем в Supabase если есть userId
    if (userId) {
      await this.savePlayerPlaystyleToDB(userId)
    }
  }

  // Получить адаптированную конфигурацию AI
  getAdaptedAIConfig(): Partial<{ aggressiveness: number; defensiveness: number; bluffChance: number; counterRolePriority: { vanguard: number; guard: number; trickster: number } }> {
    if (!this.config.enableAdaptiveLearning || !this.playerPlaystyle) {
      return {}
    }

    const playstyle = this.playerPlaystyle
    const adaptation = this.config.adaptationStrength

    // Недостаточно данных для адаптации
    if (playstyle.totalBattles < this.config.minBattlesForAdaptation) {
      return {}
    }

    const adaptedConfig: Partial<{ aggressiveness: number; defensiveness: number; bluffChance: number; counterRolePriority: { vanguard: number; guard: number; trickster: number } }> = {}

    // Pass counter-role priority to AI config
    if (this.config.adaptToPlaystyle) {
      adaptedConfig.counterRolePriority = playstyle.counterRolePriority
    }

    // Bluff chance: normalized 0-1 based on player's trickster preference
    // High trickster preference = player bluffs more = AI should also bluff more to stay unpredictable
    adaptedConfig.bluffChance = Math.min(1, 0.2 + playstyle.rolePreference.trickster * adaptation)

    // Aggressiveness/defensiveness: keep as zone-placement heuristics
    // but base them on how much the player invests in each zone (provision cost)
    // rather than role assumptions
    const highProvision = playstyle.avgProvisionCost > 4
    if (highProvision) {
      // Player uses expensive cards → AI should be more defensive (spread to win 2 zones)
      adaptedConfig.aggressiveness = Math.max(0.3, 0.6 - adaptation * 0.2)
      adaptedConfig.defensiveness = Math.min(0.8, 0.4 + adaptation * 0.2)
    } else {
      // Player uses cheap cards → AI can be more aggressive (overpower)
      adaptedConfig.aggressiveness = Math.min(0.8, 0.6 + adaptation * 0.1)
      adaptedConfig.defensiveness = Math.max(0.3, 0.4 - adaptation * 0.1)
    }

    return adaptedConfig
  }

  // Получить список карт для контр-пика против любимых карт игрока
  getCounterPickSuggestions(playerFavoriteCards: PlayerCardUsage[]): string[] {
    if (!this.config.counterFavoriteCards || playerFavoriteCards.length === 0) {
      return []
    }

    // Получаем топ-3 любимые карты игрока
    const topFavorites = playerFavoriteCards.slice(0, 3)
    const counterRoles: string[] = []

    topFavorites.forEach(fav => {
      // КНБ контр-пики
      if (fav.role === 'vanguard') counterRoles.push('guard') // Страж > Авангард
      if (fav.role === 'guard') counterRoles.push('trickster') // Плут > Страж
      if (fav.role === 'trickster') counterRoles.push('vanguard') // Авангард > Плут
    })

    return counterRoles
  }

  // Получить статистику для отладки
  getPlaystyleStats(): PlayerPlaystyle | null {
    return this.playerPlaystyle
  }

  // Сброс статистики (для тестирования)
  resetStats() {
    this.playerPlaystyle = null
    localStorage.removeItem(this.storageKey)
  }

  // Загрузка данных о стиле игры из Supabase
  async loadPlayerPlaystyleFromDB(userId: string): Promise<PlayerPlaystyle | null> {
    try {
      const { data, error } = await supabase
        .from('ai_learning_stats')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle()

      if (error) {
        console.error('[AI Adaptive Learning] Error loading playstyle from DB:', error)
        return null
      }

      if (data) {
        const playstyle: PlayerPlaystyle = {
          favoriteCards: data.favorite_cards || [],
          preferredRoles: data.preferred_roles || { vanguard: 0, guard: 0, trickster: 0 },
          preferredRarities: data.preferred_rarities || {},
          avgProvisionCost: Number(data.avg_provision_cost) || 0,
          rolePreference: data.role_preference || { vanguard: 0.33, guard: 0.33, trickster: 0.34 },
          counterRolePriority: data.counter_role_priority || { vanguard: 0.33, guard: 0.33, trickster: 0.34 },
          bluffTendency: Number(data.bluff_tendency) || 0.5,
          totalBattles: data.total_battles || 0,
          lastBattleDate: data.last_battle_date ? new Date(data.last_battle_date).getTime() : Date.now()
        }
        
        this.playerPlaystyle = playstyle
        this.savePlayerPlaystyle() // Синхронизируем с localStorage
        return playstyle
      }
    } catch (err) {
      console.error('[AI Adaptive Learning] Exception loading playstyle from DB:', err)
    }
    return null
  }
}

// ============================================================================
// ФАБРИЧНАЯ ФУНКЦИЯ
// ============================================================================

let adaptiveLearningInstance: AIAdaptiveLearning | null = null

export function getAdaptiveLearning(userId: string, config?: Partial<AIAdaptationConfig>): AIAdaptiveLearning {
  if (!adaptiveLearningInstance || adaptiveLearningInstance['storageKey'] !== `ai_adaptive_learning_${userId}`) {
    adaptiveLearningInstance = new AIAdaptiveLearning(userId, config)
  }
  return adaptiveLearningInstance
}

export async function recordPlayerBattle(
  userId: string,
  playerCards: Card[],
  playerWon: boolean,
  playerDeck: Card[],
  hiddenCardCount?: number,
  totalDeployedCount?: number
) {
  const adaptive = getAdaptiveLearning(userId)
  await adaptive.recordBattle(playerCards, playerWon, playerDeck, userId, hiddenCardCount ?? 0, totalDeployedCount ?? 0)
}

export function getAdaptedAIConfig(userId: string): Partial<{ aggressiveness: number; defensiveness: number; bluffChance: number; counterRolePriority: { vanguard: number; guard: number; trickster: number } }> {
  const adaptive = getAdaptiveLearning(userId)
  return adaptive.getAdaptedAIConfig()
}

export async function syncPlaystyleFromDB(userId: string): Promise<PlayerPlaystyle | null> {
  const adaptive = getAdaptiveLearning(userId)
  return await adaptive.loadPlayerPlaystyleFromDB(userId)
}
