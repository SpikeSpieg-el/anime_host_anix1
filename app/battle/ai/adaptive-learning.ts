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
  aggressiveRating: number // 0-1, выше = чаще играет агрессивно
  defensiveRating: number // 0-1, выше = чаще играет защитно
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
          aggressive_rating: this.playerPlaystyle.aggressiveRating,
          defensive_rating: this.playerPlaystyle.defensiveRating,
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
    userId?: string
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
        aggressiveRating: 0.5,
        defensiveRating: 0.5,
        totalBattles: 0,
        lastBattleDate: now
      }
    }

    const playstyle = this.playerPlaystyle!
    playstyle.totalBattles++
    playstyle.lastBattleDate = now

    // Обновляем статистику для каждой карты в колоде
    playerDeck.forEach(card => {
      const existing = playstyle.favoriteCards.find(fc => fc.cardId === card.uniqueId)
      
      if (existing) {
        existing.usageCount++
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

      // Обновляем предпочтения по ролям
      const role = card.role || 'unknown'
      playstyle.preferredRoles[role] = (playstyle.preferredRoles[role] || 0) + 1

      // Обновляем предпочтения по редкости
      playstyle.preferredRarities[card.rarity] = (playstyle.preferredRarities[card.rarity] || 0) + 1
    })

    // Вычисляем средний provision cost
    const totalProvision = playerDeck.reduce((sum, c) => sum + (c.provisionCost || getCardProvision(c)), 0)
    playstyle.avgProvisionCost = totalProvision / playerDeck.length

    // Оцениваем агрессивность/защиту на основе ролей
    const totalRoleUsage = Object.values(playstyle.preferredRoles).reduce((a, b) => a + b, 0)
    if (totalRoleUsage > 0) {
      const vanguardRatio = (playstyle.preferredRoles.vanguard || 0) / totalRoleUsage
      const guardRatio = (playstyle.preferredRoles.guard || 0) / totalRoleUsage
      const tricksterRatio = (playstyle.preferredRoles.trickster || 0) / totalRoleUsage

      // Vanguard = агрессивный, Guard = защитный, Trickster = хитрый
      playstyle.aggressiveRating = vanguardRatio * 0.7 + tricksterRatio * 0.3
      playstyle.defensiveRating = guardRatio * 0.8 + tricksterRatio * 0.2
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
  getAdaptedAIConfig(): Partial<{ aggressiveness: number; defensiveness: number; bluffChance: number }> {
    if (!this.config.enableAdaptiveLearning || !this.playerPlaystyle) {
      return {}
    }

    const playstyle = this.playerPlaystyle
    const adaptation = this.config.adaptationStrength

    // Недостаточно данных для адаптации
    if (playstyle.totalBattles < this.config.minBattlesForAdaptation) {
      return {}
    }

    const adaptedConfig: Partial<{ aggressiveness: number; defensiveness: number; bluffChance: number }> = {}

    // Адаптируем агрессивность/защиту под стиль игрока
    if (this.config.adaptToPlaystyle) {
      // Если игрок агрессивный - бот становится более защитным
      // Если игрок защитный - бот становится более агрессивным
      adaptedConfig.aggressiveness = 0.6 + (0.4 - playstyle.aggressiveRating) * adaptation
      adaptedConfig.defensiveness = 0.4 + (0.6 - playstyle.defensiveRating) * adaptation
    }

    // Если игрок часто блефует (трюкач) - увеличиваем шанс блефа бота
    if (playstyle.preferredRoles.trickster > 0) {
      const tricksterRatio = playstyle.preferredRoles.trickster / playstyle.totalBattles
      adaptedConfig.bluffChance = 0.3 + tricksterRatio * adaptation * 0.5
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
  playerDeck: Card[]
) {
  const adaptive = getAdaptiveLearning(userId)
  await adaptive.recordBattle(playerCards, playerWon, playerDeck, userId)
}

export function getAdaptedAIConfig(userId: string): Partial<{ aggressiveness: number; defensiveness: number; bluffChance: number }> {
  const adaptive = getAdaptiveLearning(userId)
  return adaptive.getAdaptedAIConfig()
}
