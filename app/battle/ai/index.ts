import { Card, BattleZone, CardRole } from "../types"
import { getCardRole, getCardBasePower, calculateCardPowerOnZone } from "../utils"
import { MAX_CARDS_PER_SIDE } from "../config"
import { getAdaptedAIConfig } from "./adaptive-learning"

// ============================================================================
// КОНФИГУРАЦИЯ AI
// ============================================================================

export interface AIConfig {
  enableLogging?: boolean
  logLevel?: "none" | "basic" | "detailed" | "verbose"
  strategy?: "random" | "power" | "strategic" | "adaptive"
  aggressiveness?: number // 0-1, выше = более агрессивный
  defensiveness?: number // 0-1, выше = более защитный
  bluffChance?: number // 0-1, шанс сыграть слабую карту секретно
  decisionQuality?: number // 0-1, вероятность выбрать лучшее тактическое решение
  mistakeChance?: number // 0-1, вероятность намеренно неидеального выбора
  userId?: string // ID пользователя для адаптивного обучения
}

export const DEFAULT_AI_CONFIG: AIConfig = {
  enableLogging: true,
  logLevel: "detailed",
  strategy: "adaptive",
  aggressiveness: 0.6,
  defensiveness: 0.4,
  bluffChance: 0.3
}

// ============================================================================
// КОНТЕКСТ ПРИНЯТИЯ РЕШЕНИЙ AI
// ============================================================================

export interface AIDecisionContext {
  hand: Card[]
  deck: Card[]
  zones: BattleZone[]
  round: number
  cardsPlacedThisRound: number
  opponentPlacements: Array<{ zoneId: string; isSecret: boolean }>
  config: AIConfig
}

export interface AICardDecision {
  card: Card
  zoneId: string
  isSecret: boolean
  reasoning: string
  confidence: number // 0-1
}

// ============================================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ОЦЕНКИ (БЕЗ ЖУЛЬНИЧЕСТВА)
// ============================================================================

/**
 * Оценивает полезность конкретной карты для определенной зоны.
 * Не заглядывает в закрытые карты игрока и его руку.
 */
function evaluateZoneCardCombo(
  card: Card,
  zone: BattleZone,
  isSecret: boolean,
  context: AIDecisionContext
): { score: number; reasoning: string } {
  const basePower = getCardBasePower(card)
  const role = getCardRole(card)
  const rarity = card.rarity
  let score = basePower
  let reasons: string[] = []

  const modId = zone.modifier.id

  // Проверка лимита карт на зоне
  const aiCardsInZone = zone.aiCards.length
  if (aiCardsInZone >= MAX_CARDS_PER_SIDE) {
    return { score: -9999, reasoning: `Зона заполнена (${aiCardsInZone}/${MAX_CARDS_PER_SIDE} карт)` }
  }

  // 1. УЧЕТ МОДИФИКАТОРОВ ЗОН
  
  // --- Reversal Gate (Врата парадокса: наименьшая сила побеждает) ---
  if (modId === "reversal_gate") {
    const invertedPower = Math.max(0, 350 - basePower)
    score = invertedPower
    reasons.push(`Врата парадокса (цель — минимум силы, оценка: +${invertedPower})`)
  } else {
    reasons.push(`Базовая сила (+${basePower})`)
  }

  // --- Классовые ринги и баффы ---
  if (modId === "vanguard_ring" && role === "vanguard") {
    score += 150
    reasons.push("Авангардный ринг (+150 за роль Авангард)")
  }
  if (modId === "fortress_gate" && role === "guard") {
    score += 150
    reasons.push("Железная цитадель (+150 за роль Страж)")
  }
  if (modId === "speed_valley" && role === "trickster") {
    score += 150
    reasons.push("Долина Ветров (+150 за роль Плут)")
  }

  // --- Редкости карт ---
  if (modId === "trash_revolution") {
    if (rarity === "trash" || rarity === "common") {
      score += basePower * 3
      reasons.push("Восстание низов (+300% силы для Мусор/Обычная)")
    } else {
      score -= 50
      reasons.push("Восстание низов (штраф для высоких редкостей)")
    }
  }
  if (modId === "golden_cage") {
    if (rarity === "divine" || rarity === "transcendent" || rarity === "omnipotent") {
      score -= basePower * 0.4
      reasons.push("Золотая клетка (-40% силы для Божественных/Трансцендентных/Всемогущих)")
    }
  }
  if (modId === "balanced_force") {
    if (rarity === "epic" || rarity === "super_rare" || rarity === "rare") {
      score += 100
      reasons.push("Идеальный баланс (+100 для Эпических/Сверхредких/Редких)")
    }
  }
  if (modId === "black_market") {
    if (rarity === "uncommon" || rarity === "rare") {
      score += 120
      reasons.push("Черный рынок (+120 для Необычных/Редких)")
    }
  }
  if (modId === "god_domain" && rarity === "omnipotent") {
    score += basePower
    reasons.push("Обитель богов (удвоение базовой силы)")
  }
  if (modId === "fools_gold") {
    if (rarity === "legendary" || rarity === "mythic") {
      score -= (basePower - 20)
      reasons.push("Золото дураков (сила приравнена к Мусору)")
    }
  }

  // --- Скрытые механики ---
  if (isSecret) {
    if (modId === "shadow_step") {
      score += 100
      reasons.push("Теневой выпад (+100 при раскрытии)")
    }
    if (modId === "mirage_zone") {
      score += basePower
      reasons.push("Зона иллюзий (удвоение скрытой силы)")
    }
    if (modId === "ambush_point" && zone.aiCards.length === 1) {
      score += 120
      reasons.push("Точка засады (+120 за вторую скрытую карту)")
    }
    if (role === "trickster") {
      score += 30
      reasons.push("Плут в скрытом режиме (+30)")
    }
  } else {
    // Открытое размещение
    if (modId === "mirage_zone") {
      score -= basePower * 0.5
      reasons.push("Зона иллюзий (-50% силы открытой карты)")
    }
    if (modId === "first_strike" && zone.aiCards.length === 0) {
      score += 80
      reasons.push("Быстрый старт (+80 за первое открытое размещение)")
    }
  }

  // 2. ВЗАИМОДЕЙСТВИЕ РОЛЕЙ (КНБ) — БЕЗ КЛИЕНТСКОГО ЖУЛЬНИЧЕСТВА
  let rpsBonus = 0
  const isReverseRps = modId === "reverse_rps"
  const isNoRps = modId === "no_rps"
  const rpsMultiplier = modId === "double_rps" ? 2.0 : 1.0

  if (!isNoRps) {
    zone.playerCards.forEach(pc => {
      // Игнорируем закрытые (теневые) карты игрока для КНБ расчёта
      if (pc.isSecret) return

      const playerRole = getCardRole(pc.card)
      let wins = false
      let loses = false

      if (!isReverseRps) {
        // Стандарт: Авангард > Плут, Страж > Авангард, Плут > Страж
        if (role === "vanguard" && playerRole === "trickster") wins = true
        if (role === "guard" && playerRole === "vanguard") wins = true
        if (role === "trickster" && playerRole === "guard") wins = true

        if (role === "trickster" && playerRole === "vanguard") loses = true
        if (role === "vanguard" && playerRole === "guard") loses = true
        if (role === "guard" && playerRole === "trickster") loses = true
      } else {
        // Реверс: Плут > Авангард, Авангард > Страж, Страж > Плут
        if (role === "trickster" && playerRole === "vanguard") wins = true
        if (role === "vanguard" && playerRole === "guard") wins = true
        if (role === "guard" && playerRole === "trickster") wins = true

        if (role === "vanguard" && playerRole === "trickster") loses = true
        if (role === "guard" && playerRole === "vanguard") loses = true
        if (role === "trickster" && playerRole === "guard") loses = true
      }

      if (wins) rpsBonus += 60 * rpsMultiplier
      if (loses) rpsBonus -= 40 * rpsMultiplier
    })
  }

  if (rpsBonus !== 0) {
    score += rpsBonus
    reasons.push(`Сопоставление ролей с открытыми картами игрока (${rpsBonus > 0 ? '+' : ''}${rpsBonus})`)
  }

  // 3. СОБСТВЕННЫЕ СИНЕРГИИ В ЗОНЕ
  zone.aiCards.forEach(ac => {
    if (modId === "unity" && ac.card.anime === card.anime) {
      score += 150
      reasons.push(`Единство (+150 за одинаковое аниме с ${ac.card.name})`)
    }
    if (modId === "tactical_synergy" && getCardRole(ac.card) !== role) {
      score += 100
      reasons.push(`Тактический союз (+100 за разные роли с ${ac.card.name})`)
    }
  })

  // 4. ТАКТИКА ПОЗИЦИОНИРОВАНИЯ
  const aiCount = zone.aiCards.length
  const playerCount = zone.playerCards.length

  if (modId === "lonely_hero" && aiCount === 0 && playerCount === 2) {
    score += 200
    reasons.push("Одинокий боец (+200)")
  }
  if (modId === "duelist_honor" && aiCount === 0 && playerCount === 1) {
    score += 150
    reasons.push("Честь дуэлянта (+150 за ситуацию 1 на 1)")
  }

  return { score, reasoning: reasons.join(", ") }
}

// ============================================================================
// КЛАССЫ СТРАТЕГИЙ AI
// ============================================================================

class AIStrategy {
  protected config: AIConfig
  
  constructor(config: AIConfig) {
    this.config = config
  }

  protected log(message: string, level: "basic" | "detailed" | "verbose" = "basic") {
    if (!this.config.enableLogging) return
    
    const levels = { none: 0, basic: 1, detailed: 2, verbose: 3 }
    if (levels[this.config.logLevel || "basic"] >= levels[level]) {
      console.log(`[AI Strategy] ${message}`)
    }
  }

  decideCard(context: AIDecisionContext): AICardDecision | null {
    throw new Error("Стратегия не реализована")
  }
}

function selectScoredCandidate<T extends { score: number }>(candidates: T[], config: AIConfig): T | undefined {
  if (candidates.length === 0) return undefined

  const decisionQuality = Math.min(1, Math.max(0, config.decisionQuality ?? 0.7))
  const mistakeChance = Math.min(1, Math.max(0, config.mistakeChance ?? 0.16))
  if (Math.random() < mistakeChance) {
    const firstNonOptimal = Math.min(candidates.length - 1, Math.floor(candidates.length * 0.35))
    return candidates[firstNonOptimal + Math.floor(Math.random() * (candidates.length - firstNonOptimal))]
  }

  if (Math.random() < decisionQuality) return candidates[0]

  const topChoices = Math.max(2, Math.ceil((1 - decisionQuality) * 6))
  return candidates[Math.floor(Math.random() * Math.min(topChoices, candidates.length))]
}

class RandomStrategy extends AIStrategy {
  decideCard(context: AIDecisionContext): AICardDecision | null {
    this.log("Использование случайной стратегии", "basic")
    
    if (context.hand.length === 0) return null
    
    // Фильтруем зоны, которые не заполнены
    const availableZones = context.zones.filter(zone => zone.aiCards.length < MAX_CARDS_PER_SIDE)
    if (availableZones.length === 0) return null
    
    const card = context.hand[Math.floor(Math.random() * context.hand.length)]
    const zone = availableZones[Math.floor(Math.random() * availableZones.length)]
    const isSecret = context.cardsPlacedThisRound === 1
    
    return {
      card,
      zoneId: zone.id,
      isSecret,
      reasoning: "Случайный выбор без анализа преимуществ",
      confidence: 0.2
    }
  }
}

class PowerStrategy extends AIStrategy {
  decideCard(context: AIDecisionContext): AICardDecision | null {
    this.log("Использование стратегии по силе", "basic")
    
    if (context.hand.length === 0) return null
    
    // Фильтруем зоны, которые не заполнены
    const availableZones = context.zones.filter(zone => zone.aiCards.length < MAX_CARDS_PER_SIDE)
    if (availableZones.length === 0) return null
    
    const sortedHand = [...context.hand].sort((a, b) => getCardBasePower(b) - getCardBasePower(a))
    const card = sortedHand[0]
    
    const zoneScores = availableZones.map(zone => ({
      zone,
      score: zone.playerCards.length + zone.aiCards.length
    }))
    zoneScores.sort((a, b) => a.score - b.score)
    const zone = zoneScores[0]?.zone || availableZones[0]
    
    const isSecret = context.cardsPlacedThisRound === 1
    
    return {
      card,
      zoneId: zone.id,
      isSecret,
      reasoning: `Наибольшая базовая сила (${getCardBasePower(card)}) в свободную зону`,
      confidence: 0.5
    }
  }
}

class StrategicStrategy extends AIStrategy {
  decideCard(context: AIDecisionContext): AICardDecision | null {
    this.log("Использование стратегической стратегии", "basic")
    
    if (context.hand.length === 0) return null
    
    const decisions: Array<{ card: Card; zoneId: string; isSecret: boolean; score: number; reasoning: string }> = []
    const isSecret = context.cardsPlacedThisRound === 1

    for (const card of context.hand) {
      for (const zone of context.zones) {
        const evalResult = evaluateZoneCardCombo(card, zone, isSecret, context)
        // Пропускаем решения с отрицательным баллом (зона заполнена)
        if (evalResult.score < 0) continue
        decisions.push({
          card,
          zoneId: zone.id,
          isSecret,
          score: evalResult.score,
          reasoning: evalResult.reasoning
        })
      }
    }
    
    decisions.sort((a, b) => b.score - a.score)
    const best = selectScoredCandidate(decisions, this.config)
    
    if (!best) return null
    
    const targetZoneName = context.zones.find(z => z.id === best.zoneId)?.nameRu || "Локация"
    this.log(`Стратегия выбрала: ${best.card.name} -> ${targetZoneName} (Секретно: ${best.isSecret})`, "detailed")
    
    return {
      card: best.card,
      zoneId: best.zoneId,
      isSecret: best.isSecret,
      reasoning: best.reasoning,
      confidence: Math.min(0.9, best.score / 1000)
    }
  }
}

class AdaptiveStrategy extends AIStrategy {
  decideCard(context: AIDecisionContext): AICardDecision | null {
    this.log("Использование адаптивной стратегии", "basic")
    
    if (context.hand.length === 0) return null
    
    // 1. Честный анализ текущего состояния игры на поле боя (без жульничества)
    const zoneStates = context.zones.map(zone => {
      const aiPower = zone.aiCards.reduce((sum, c) => sum + c.powerAfterModifier, 0)
      
      // Честно рассчитываем примерную силу противника:
      // Складываем видимые карты + прогнозируем силу закрытых карт по формуле ожидаемой ценности раунда.
      let playerPower = 0
      zone.playerCards.forEach(zc => {
        if (zc.isSecret) {
          playerPower += 85 + context.round * 15 // Оценочная математическая сила скрытой карты
        } else {
          playerPower += zc.powerAfterModifier
        }
      })

      const diff = aiPower - playerPower
      let status: "winning" | "losing" | "contested" = "contested"
      if (diff > 25) status = "winning"
      else if (diff < -25) status = "losing"

      return {
        zone,
        aiPower,
        estimatedPlayerPower: playerPower,
        diff,
        status
      }
    })

    const winningZones = zoneStates.filter(z => z.status === "winning")
    const losingZones = zoneStates.filter(z => z.status === "losing")
    const contestedZones = zoneStates.filter(z => z.status === "contested")

    this.log(`Анализ зон: Лидируем: ${winningZones.length}, Отстаем: ${losingZones.length}, Спорные: ${contestedZones.length}`, "detailed")

    // Если уже лидируем в 1+ зонах, приоритизируем захват второй вместо укрепления первой
    const alreadyHaveWinningZone = winningZones.length >= 1

    const candidates: Array<{ card: Card; zoneId: string; score: number; reasoning: string }> = []
    const isSecret = context.cardsPlacedThisRound === 1

    for (const card of context.hand) {
      for (const zoneState of zoneStates) {
        const evaluation = evaluateZoneCardCombo(card, zoneState.zone, isSecret, context)
        // Пропускаем решения с отрицательным баллом (зона заполнена)
        if (evaluation.score < 0) continue
        let finalScore = evaluation.score

        // Оцениваем потенциальную силу карты в этой зоне
        const cardPotentialPower = evaluation.score
        
        // Если зона проигрывает, проверяем может ли эта карта перебить
        if (zoneState.status === "losing") {
          const gapToClose = Math.abs(zoneState.diff)
          
          // Если карта может потенциально закрыть разрыв (с учётом модификаторов)
          if (cardPotentialPower >= gapToClose * 0.8) {
            finalScore += 80 // Бонус за попытку перебить
            this.log(`Карта ${card.name} может перебить отставание в ${zoneState.zone.nameRu} (разрыв: ${gapToClose.toFixed(0)}, потенциал: ${cardPotentialPower.toFixed(0)})`, "detailed")
          } else {
            // Если не может перебить - штрафуем, чтобы выбрать другую зону
            finalScore -= 30
          }
          
          // Пытаемся отвоевать отстающую линию агрессивной атакой
          if (getCardRole(card) === "vanguard") {
            finalScore += 25 + 50 * (this.config.aggressiveness ?? 0.6)
          }
        } else if (zoneState.status === "winning") {
          // Если уже есть выигранная зона, штрафуем за укрепление ещё одной
          // Нужно захватить 2 зоны, а не укреплять одну
          if (alreadyHaveWinningZone) {
            finalScore -= 60 // Сильный штраф за "жадность" к одной зоне
            this.log(`Штраф за укрепление уже выигранной зоны ${zoneState.zone.nameRu} (нужна вторая зона)`, "detailed")
          } else if (getCardRole(card) === "guard") {
            finalScore += 35 * (this.config.defensiveness ?? 0.4)
          } else {
            // Первую выигранную зону можно укреплять, но без бонусов за роль
            // Все роли работают одинаково для защиты
          }
        } else {
          // Равный бой — повышаем значимость зоны для закрепления преимущества
          finalScore += 25
        }

        // Если зона сильно проигрывает (более 200) и у нас нет карты которая может перебрать
        // и есть другие зоны с меньшим отставанием - приоритизируем их
        if (zoneState.diff < -200 && cardPotentialPower < Math.abs(zoneState.diff) * 0.8) {
          const otherZonesWithLessLoss = zoneStates.filter(zs => 
            zs.zone.id !== zoneState.zone.id && zs.diff > zoneState.diff
          )
          if (otherZonesWithLessLoss.length > 0) {
            finalScore -= 50 // Штраф за попытку борьбы в безнадежной зоне
          }
        }

        candidates.push({
          card,
          zoneId: zoneState.zone.id,
          score: finalScore,
          reasoning: evaluation.reasoning
        })
      }
    }

    candidates.sort((a, b) => b.score - a.score)
    const bestCandidate = selectScoredCandidate(candidates, this.config)

    // Фолбэк на случай непредвиденных пустых результатов оценивания
    if (!bestCandidate) {
      return new StrategicStrategy(this.config).decideCard(context)
    }

    const targetZoneName = context.zones.find(z => z.id === bestCandidate.zoneId)?.nameRu || "Локация"
    this.log(`Адаптивный выбор: ${bestCandidate.card.name} -> "${targetZoneName}" (Оценка: ${bestCandidate.score.toFixed(0)})`, "detailed")

    return {
      card: bestCandidate.card,
      zoneId: bestCandidate.zoneId,
      isSecret,
      reasoning: `Адаптивный расчет: ${bestCandidate.reasoning}`,
      confidence: Math.min(0.95, bestCandidate.score / 1000)
    }
  }
}

// ============================================================================
// ДВИЖОК AI
// ============================================================================

export class AIEngine {
  private config: AIConfig
  private strategy: AIStrategy
  private decisionHistory: AICardDecision[] = []
  
  constructor(config: Partial<AIConfig> = {}) {
    this.config = { ...DEFAULT_AI_CONFIG, ...config }
    
    // Применяем адаптивную конфигурацию если указан userId
    if (this.config.userId) {
      const adaptedConfig = getAdaptedAIConfig(this.config.userId)
      this.config = { ...this.config, ...adaptedConfig }
    }
    
    this.strategy = this.createStrategy()
  }
  
  private createStrategy(): AIStrategy {
    switch (this.config.strategy) {
      case "random":
        return new RandomStrategy(this.config)
      case "power":
        return new PowerStrategy(this.config)
      case "strategic":
        return new StrategicStrategy(this.config)
      case "adaptive":
        return new AdaptiveStrategy(this.config)
      default:
        return new AdaptiveStrategy(this.config)
    }
  }
  
  setConfig(config: Partial<AIConfig>) {
    this.config = { ...this.config, ...config }
    this.strategy = this.createStrategy()
  }
  
  getConfig(): AIConfig {
    return { ...this.config }
  }
  
  decideCard(context: AIDecisionContext): AICardDecision | null {
    this.logDecisionStart(context)
    
    const decision = this.strategy.decideCard(context)
    
    if (decision) {
      this.decisionHistory.push(decision)
      this.logDecision(decision)
    } else {
      this.log("Решение не принято — нет доступных карт в руке", "basic")
    }
    
    return decision
  }
  
  decideRound(context: AIDecisionContext): AICardDecision[] {
    const decisions: AICardDecision[] = []
    const roundContext = { ...context }
    
    this.log(`=== НАЧАЛО РАСЧЁТА РАУНДА ${context.round} ===`, "basic")
    
    for (let i = 0; i < 2; i++) {
      roundContext.cardsPlacedThisRound = i
      const decision = this.decideCard(roundContext)
      
      if (decision) {
        decisions.push(decision)
        // Исключаем карту из виртуальной руки для принятия второго решения
        roundContext.hand = roundContext.hand.filter(c => c.uniqueId !== decision.card.uniqueId)
      }
    }
    
    this.log(`=== РАСЧЁТ РАУНДА ${context.round} ЗАВЕРШЕН ===`, "basic")
    return decisions
  }
  
  getDecisionHistory(): AICardDecision[] {
    return [...this.decisionHistory]
  }
  
  clearHistory() {
    this.decisionHistory = []
  }
  
  private logDecisionStart(context: AIDecisionContext) {
    if (!this.config.enableLogging) return
    
    this.log(`--- Старт принятия решения ---`, "verbose")
    this.log(`Раунд: ${context.round}`, "verbose")
    this.log(`Размер руки: ${context.hand.length}`, "verbose")
    this.log(`Карта по счету в раунде: ${context.cardsPlacedThisRound + 1}`, "verbose")
    this.log(`Стратегия: ${this.config.strategy}`, "verbose")
  }
  
  private logDecision(decision: AICardDecision) {
    if (!this.config.enableLogging) return
    
    this.log(`--- Решение принято ---`, "verbose")
    this.log(`Карта: ${decision.card.name}`, "verbose")
    this.log(`Зона: ${decision.zoneId}`, "verbose")
    this.log(`Секретно: ${decision.isSecret}`, "verbose")
    this.log(`Обоснование: ${decision.reasoning}`, "verbose")
    this.log(`Уверенность: ${(decision.confidence * 100).toFixed(0)}%`, "verbose")
  }
  
  private log(message: string, level: "basic" | "detailed" | "verbose" = "basic") {
    if (!this.config.enableLogging) return
    
    const levels = { none: 0, basic: 1, detailed: 2, verbose: 3 }
    if (levels[this.config.logLevel || "basic"] >= levels[level]) {
      console.log(`[AI Engine] ${message}`)
    }
  }
}

// ============================================================================
// ФАБРИЧНЫЕ ФУНКЦИИ
// ============================================================================

export function createAI(config?: Partial<AIConfig>): AIEngine {
  return new AIEngine(config)
}

export function createAIDecisionContext(
  hand: Card[],
  deck: Card[],
  zones: BattleZone[],
  round: number,
  config: AIConfig
): AIDecisionContext {
  return {
    hand,
    deck,
    zones,
    round,
    cardsPlacedThisRound: 0,
    opponentPlacements: [],
    config
  }
}