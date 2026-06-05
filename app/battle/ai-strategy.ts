import { Card, CardRole, BattleZone, TerritoryModifier, ZoneCard } from "./types"
import { getCardRole, getCardBasePower, calculateCardPowerOnZone } from "./utils"

// ==========================================
// AI DIFFICULTY LEVELS
// ==========================================

export type AIDifficulty = "easy" | "normal" | "hard" | "expert" | "master"

export interface AIDifficultyConfig {
  name: string
  // Strategic thinking: how well AI evaluates zones and modifiers
  strategicThinking: number // 0-1
  // Risk tolerance: how likely AI is to play risky secret cards
  riskTolerance: number // 0-1
  // Bluffing: how likely AI is to bluff with secret cards
  bluffingChance: number // 0-1
  // Adaptation: how well AI adapts to player's previous moves
  adaptationRate: number // 0-1
  // Error chance: probability of making suboptimal moves
  errorChance: number // 0-1
}

export const AI_DIFFICULTY_CONFIGS: Record<AIDifficulty, AIDifficultyConfig> = {
  easy: {
    name: "Легкий",
    strategicThinking: 0.2,
    riskTolerance: 0.3,
    bluffingChance: 0.1,
    adaptationRate: 0.1,
    errorChance: 0.4,
  },
  normal: {
    name: "Нормальный",
    strategicThinking: 0.5,
    riskTolerance: 0.5,
    bluffingChance: 0.3,
    adaptationRate: 0.4,
    errorChance: 0.2,
  },
  hard: {
    name: "Сложный",
    strategicThinking: 0.7,
    riskTolerance: 0.6,
    bluffingChance: 0.5,
    adaptationRate: 0.6,
    errorChance: 0.1,
  },
  expert: {
    name: "Эксперт",
    strategicThinking: 0.85,
    riskTolerance: 0.7,
    bluffingChance: 0.6,
    adaptationRate: 0.8,
    errorChance: 0.05,
  },
  master: {
    name: "Мастер",
    strategicThinking: 0.95,
    riskTolerance: 0.8,
    bluffingChance: 0.7,
    adaptationRate: 0.9,
    errorChance: 0.02,
  },
}

// ==========================================
// AI DECISION CONTEXT
// ==========================================

export interface AIDecisionContext {
  // AI's current hand
  aiHand: Card[]
  // Current battle zones
  zones: BattleZone[]
  // Current round (1, 2, or 3)
  currentRound: number
  // Cards AI has already placed this round
  aiPlacedThisRound: { cardId: string; zoneId: string; isSecret: boolean }[]
  // Cards player has placed this round (AI only sees OPEN cards)
  playerPlacedThisRound: { cardId: string; zoneId: string; isSecret: boolean }[]
  // AI difficulty
  difficulty: AIDifficulty
  // Player's deck composition (for adaptation)
  playerDeckComposition?: {
    roleDistribution: Record<CardRole, number>
    averagePower: number
    highPowerCards: number
  }
}

// ==========================================
// CARD EVALUATION
// ==========================================

export interface CardEvaluation {
  card: Card
  baseScore: number
  zoneScores: Map<string, number> // zoneId -> score
  bestZoneId: string | null
  bestScore: number
  recommendedAsSecret: boolean
  reasoning: string[]
}

export class AIStrategy {
  private difficulty: AIDifficulty
  private config: AIDifficultyConfig
  private memory: Map<string, any> = new Map() // AI memory for adaptation

  constructor(difficulty: AIDifficulty = "normal") {
    this.difficulty = difficulty
    this.config = AI_DIFFICULTY_CONFIGS[difficulty]
  }

  // ==========================================
  // MAIN DECISION FUNCTION
  // ==========================================

  /**
   * AI decides which card to play and where
   * Returns null if AI should not play a card (e.g., already played 2 cards)
   */
  public decideCardPlacement(context: AIDecisionContext): {
    cardId: string
    zoneId: string
    isSecret: boolean
  } | null {
    const { aiHand, aiPlacedThisRound, difficulty } = context

    // Check if AI can still play cards
    if (aiPlacedThisRound.length >= 2) {
      return null
    }

    // Update difficulty if changed
    if (difficulty !== this.difficulty) {
      this.difficulty = difficulty
      this.config = AI_DIFFICULTY_CONFIGS[difficulty]
    }

    // Evaluate all cards in hand
    const evaluations = this.evaluateCards(context)

    // Sort by best score
    evaluations.sort((a, b) => b.bestScore - a.bestScore)

    // Apply error chance based on difficulty
    if (Math.random() < this.config.errorChance) {
      // Make a suboptimal choice
      const randomIndex = Math.floor(Math.random() * Math.min(3, evaluations.length))
      const chosen = evaluations[randomIndex]
      if (!chosen) return null
      return {
        cardId: chosen.card.uniqueId,
        zoneId: chosen.bestZoneId || this.selectRandomZone(context),
        isSecret: chosen.recommendedAsSecret,
      }
    }

    // Choose best card
    const bestEvaluation = evaluations[0]
    if (!bestEvaluation) return null

    return {
      cardId: bestEvaluation.card.uniqueId,
      zoneId: bestEvaluation.bestZoneId || this.selectRandomZone(context),
      isSecret: bestEvaluation.recommendedAsSecret,
    }
  }

  // ==========================================
  // CARD EVALUATION
  // ==========================================

  private evaluateCards(context: AIDecisionContext): CardEvaluation[] {
    const { aiHand, zones, aiPlacedThisRound, playerPlacedThisRound } = context

    return aiHand.map(card => {
      const role = card.role || getCardRole(card)
      const basePower = getCardBasePower(card)
      const reasoning: string[] = []

      // Base score from card power
      let baseScore = basePower

      // Adjust for role synergy with current zones
      const zoneScores = new Map<string, number>()

      zones.forEach(zone => {
        let zoneScore = baseScore

        // Evaluate zone modifier
        const modifierBonus = this.evaluateZoneModifierForCard(card, zone.modifier, zone)
        zoneScore += modifierBonus

        if (modifierBonus > 0) {
          reasoning.push(`+${modifierBonus} от модификатора "${zone.modifier.nameRu}"`)
        }

        // Evaluate existing cards on zone (AI can only see OPEN cards)
        const existingAICards = zone.aiCards.filter(zc => !zc.isSecret)
        const existingPlayerCards = zone.playerCards.filter(zc => !zc.isSecret)

        // KNB advantage/disadvantage
        if (existingPlayerCards.length > 0) {
          const knbBonus = this.evaluateKNBAdvantage(role, existingPlayerCards, zone.modifier.id)
          zoneScore += knbBonus
          if (knbBonus > 0) {
            reasoning.push(`+${knbBonus} KNB преимущество`)
          } else if (knbBonus < 0) {
            reasoning.push(`${knbBonus} KNB недостаток`)
          }
        }

        // Zone control consideration
        if (zone.owner === "player" && existingPlayerCards.length > 0) {
          zoneScore += 30 // Bonus for contesting player-controlled zone
          reasoning.push("+30 за атаку зоны игрока")
        }

        // Placement order bonus
        const placementOrder = existingAICards.length
        if (placementOrder === 0) {
          // First card on zone - can be open or secret
          zoneScore += 10
          reasoning.push("+10 за первую карту на зоне")
        } else {
          // Second card - secret placement bonus
          zoneScore += 20
          reasoning.push("+20 за вторую карту на зоне")
        }

        zoneScores.set(zone.id, zoneScore)
      })

      // Find best zone
      let bestZoneId: string | null = null
      let bestScore = -Infinity

      zoneScores.forEach((score, zoneId) => {
        if (score > bestScore) {
          bestScore = score
          bestZoneId = zoneId
        }
      })

      // Determine if should be secret
      const isSecondCard = aiPlacedThisRound.length === 1
      const recommendedAsSecret = isSecondCard || this.shouldPlaySecret(card, context, bestZoneId)

      if (recommendedAsSecret) {
        reasoning.push("Рекомендуется как скрытая")
      }

      return {
        card,
        baseScore,
        zoneScores,
        bestZoneId,
        bestScore,
        recommendedAsSecret,
        reasoning,
      }
    })
  }

  // ==========================================
  // ZONE MODIFIER EVALUATION
  // ==========================================

  private evaluateZoneModifierForCard(card: Card, modifier: TerritoryModifier, zone: BattleZone): number {
    const role = card.role || getCardRole(card)
    const basePower = getCardBasePower(card)
    let bonus = 0

    // Role-specific modifiers
    switch (modifier.id) {
      case "vanguard_ring":
        if (role === "vanguard") bonus += 150
        break
      case "fortress_gate":
        if (role === "guard") bonus += 150
        break
      case "speed_valley":
        if (role === "trickster") bonus += 150
        break
    }

    // Secret card modifiers
    if (modifier.id === "shadow_step") {
      bonus += 100 // AI knows it will play secret
    }
    if (modifier.id === "ambush_point") {
      bonus += 120
    }
    if (modifier.id === "mirage_zone") {
      bonus += basePower // Doubles power
    }

    // Rarity modifiers
    switch (modifier.id) {
      case "trash_revolution":
        if (card.rarity === "trash" || card.rarity === "common") bonus += basePower * 3
        break
      case "golden_cage":
        if (["divine", "transcendent", "omnipotent"].includes(card.rarity)) bonus -= basePower * 0.4
        break
      case "balanced_force":
        if (["epic", "super_rare", "rare"].includes(card.rarity)) bonus += 100
        break
      case "black_market":
        if (["uncommon", "rare"].includes(card.rarity)) bonus += 120
        break
    }

    // Position modifiers
    const existingAICards = zone.aiCards.length
    const existingPlayerCards = zone.playerCards.length

    if (modifier.id === "lonely_hero" && existingPlayerCards === 2 && existingAICards === 0) {
      bonus += 200
    }
    if (modifier.id === "duelist_honor" && existingPlayerCards === 1 && existingAICards === 0) {
      bonus += 150
    }

    return bonus
  }

  // ==========================================
  // KNB (ROCK-PAPER-SCISSORS) EVALUATION
  // ==========================================

  private evaluateKNBAdvantage(aiRole: CardRole, enemyCards: ZoneCard[], modifierId: string): number {
    let totalBonus = 0
    const reverseRPS = modifierId === "reverse_rps"
    const noRPS = modifierId === "no_rps"
    const doubleRPS = modifierId === "double_rps"

    if (noRPS) return 0

    enemyCards.forEach(enemyCard => {
      if (enemyCard.isSecret) {
        // AI cannot see secret cards - skip evaluation
        return
      }

      const enemyRole = enemyCard.card.role || getCardRole(enemyCard.card)
      const advantage = this.getKNBAdvantage(aiRole, enemyRole, reverseRPS)

      if (advantage > 0) {
        totalBonus += 50 * (doubleRPS ? 2 : 1)
      } else if (advantage < 0) {
        totalBonus -= 30 * (doubleRPS ? 2 : 1)
      }
    })

    return totalBonus
  }

  private getKNBAdvantage(attackerRole: CardRole, defenderRole: CardRole, reverse: boolean): number {
    if (!reverse) {
      // Vanguard > Trickster, Guard > Vanguard, Trickster > Guard
      if (attackerRole === "vanguard" && defenderRole === "trickster") return 1
      if (attackerRole === "guard" && defenderRole === "vanguard") return 1
      if (attackerRole === "trickster" && defenderRole === "guard") return 1
      if (attackerRole === "trickster" && defenderRole === "vanguard") return -1
      if (attackerRole === "vanguard" && defenderRole === "guard") return -1
      if (attackerRole === "guard" && defenderRole === "trickster") return -1
    } else {
      // Reverse: Trickster > Vanguard > Guard > Trickster
      if (attackerRole === "trickster" && defenderRole === "vanguard") return 1
      if (attackerRole === "vanguard" && defenderRole === "guard") return 1
      if (attackerRole === "guard" && defenderRole === "trickster") return 1
      if (attackerRole === "vanguard" && defenderRole === "trickster") return -1
      if (attackerRole === "guard" && defenderRole === "vanguard") return -1
      if (attackerRole === "trickster" && defenderRole === "guard") return -1
    }
    return 0
  }

  // ==========================================
  // SECRET CARD DECISION
  // ==========================================

  private shouldPlaySecret(card: Card, context: AIDecisionContext, targetZoneId: string | null): boolean {
    const { zones, aiPlacedThisRound, playerPlacedThisRound } = context

    // Must play secret if it's the second card
    if (aiPlacedThisRound.length === 1) {
      return true
    }

    // Check target zone modifier
    if (targetZoneId) {
      const zone = zones.find(z => z.id === targetZoneId)
      if (zone) {
        // Strong secret modifiers
        if (["shadow_step", "ambush_point", "mirage_zone", "double_bluff"].includes(zone.modifier.id)) {
          return true
        }
      }
    }

    // Bluffing chance based on difficulty
    if (Math.random() < this.config.bluffingChance) {
      return true
    }

    // Risk tolerance
    if (Math.random() < this.config.riskTolerance) {
      return true
    }

    // High power cards are better as secret for surprise factor
    const basePower = getCardBasePower(card)
    if (basePower > 80 && Math.random() < 0.5) {
      return true
    }

    return false
  }

  // ==========================================
  // ZONE SELECTION
  // ==========================================

  private selectRandomZone(context: AIDecisionContext): string {
    const { zones } = context
    const availableZones = zones.map(z => z.id)
    return availableZones[Math.floor(Math.random() * availableZones.length)]
  }

  // ==========================================
  // ADAPTATION AND MEMORY
  // ==========================================

  /**
   * Update AI's memory based on round results
   * AI learns from player's patterns
   */
  public updateMemory(roundResult: {
    playerWon: boolean
    playerActions: { zoneId: string; cardName: string; isSecret: boolean }[]
    aiActions: { zoneId: string; cardName: string; isSecret: boolean }[]
  }) {
    // Track player's preferred zones
    roundResult.playerActions.forEach(action => {
      const key = `player_zone_preference_${action.zoneId}`
      const current = this.memory.get(key) || 0
      this.memory.set(key, current + 1)
    })

    // Track player's secret card usage
    const secretCount = roundResult.playerActions.filter(a => a.isSecret).length
    const key = "player_secret_usage"
    const current = this.memory.get(key) || 0
    this.memory.set(key, (current + secretCount) / 2)

    // Adapt strategy based on results
    if (roundResult.playerWon) {
      // Player won - increase adaptation
      this.config.adaptationRate = Math.min(1, this.config.adaptationRate + 0.05)
    }
  }

  /**
   * Get AI's prediction of player's next move
   * Based on memory and adaptation rate
   */
  public predictPlayerMove(context: AIDecisionContext): {
    likelyZoneId: string | null
    likelySecret: boolean
    confidence: number
  } {
    if (this.config.adaptationRate < 0.3) {
      // Low adaptation - random prediction
      return {
        likelyZoneId: this.selectRandomZone(context),
        likelySecret: Math.random() < 0.5,
        confidence: 0.2,
      }
    }

    // Find player's most preferred zone
    let maxPref = 0
    let likelyZoneId: string | null = null

    context.zones.forEach(zone => {
      const pref = this.memory.get(`player_zone_preference_${zone.id}`) || 0
      if (pref > maxPref) {
        maxPref = pref
        likelyZoneId = zone.id
      }
    })

    const secretUsage = this.memory.get("player_secret_usage") || 0.5
    const confidence = this.config.adaptationRate * 0.7

    return {
      likelyZoneId,
      likelySecret: secretUsage > 0.5,
      confidence,
    }
  }

  // ==========================================
  // UTILITY FUNCTIONS
  // ==========================================

  public getDifficulty(): AIDifficulty {
    return this.difficulty
  }

  public setDifficulty(difficulty: AIDifficulty) {
    this.difficulty = difficulty
    this.config = AI_DIFFICULTY_CONFIGS[difficulty]
  }

  public clearMemory() {
    this.memory.clear()
  }

  public getMemoryStats() {
    return {
      entries: this.memory.size,
      adaptationRate: this.config.adaptationRate,
      difficulty: this.difficulty,
    }
  }
}

// ==========================================
// FACTORY FUNCTION
// ==========================================

export function createAIStrategy(difficulty: AIDifficulty = "normal"): AIStrategy {
  return new AIStrategy(difficulty)
}
