import { Card, BattleZone, CardRole, ZoneCard } from "../types"
import { getCardRole, getCardBasePower, calculateCardPowerOnZone } from "../utils"
import { MAX_CARDS_PER_SIDE } from "../config"
import { getAdaptedAIConfig } from "./adaptive-learning"
import {
  evaluateBoard,
  evaluateMove,
  simulatePlacement,
  buildOpponentProfile,
  getStrategicHints,
  OpponentProfile,
  StrategicHint,
} from "./board-evaluation"

// ============================================================================
// КОНФИГУРАЦИЯ AI
// ============================================================================

export interface AIConfig {
  enableLogging?: boolean
  logLevel?: "none" | "basic" | "detailed" | "verbose"
  strategy?: "random" | "power" | "strategic" | "adaptive" | "chess_like"
  aggressiveness?: number // 0-1, выше = более агрессивный
  defensiveness?: number // 0-1, выше = более защитный
  bluffChance?: number // 0-1, шанс сыграть слабую карту секретно
  decisionQuality?: number // 0-1, вероятность выбрать лучшее тактическое решение
  mistakeChance?: number // 0-1, вероятность намеренно неидеального выбора
  userId?: string // ID пользователя для адаптивного обучения
  counterRolePriority?: { vanguard: number; guard: number; trickster: number }
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
  reasons.push(`Базовая сила (+${basePower})`)

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

// ============================================================================
// ШАХМАТНО-ПОДОБНАЯ СТРАТЕГИЯ (CHESS-LIKE)
// ============================================================================
// Аналог шахматного бота: 1-ply lookahead с board-level эвристикой.
// Оценивает всю позицию до и после хода, учитывает темп, контроль зон,
// информационное преимущество и модель оппонента.
// ============================================================================

export class ChessLikeStrategy extends AIStrategy {
  private opponentProfile: OpponentProfile | undefined
  private moveHistory: Array<{ round: number; cardName: string; zoneId: string; isSecret: boolean }> = []
  private roundHistory: Array<{
    round: number
    playerActions: { zoneId: string; cardName: string; isSecret: boolean }[]
  }> = []

  decideCard(context: AIDecisionContext): AICardDecision | null {
    this.log("Использование шахматно-подобной стратегии", "basic")

    if (context.hand.length === 0) return null

    const availableZones = context.zones.filter(z => z.aiCards.length < MAX_CARDS_PER_SIDE)
    if (availableZones.length === 0) return null

    const isSecret = context.cardsPlacedThisRound === 1
    const maxRounds = 3

    // 1. Обновляем модель оппонента на основе видимых карт и истории
    const playerVisibleCards: ZoneCard[] = []
    context.zones.forEach(z => z.playerCards.forEach(zc => playerVisibleCards.push(zc)))

    if (context.opponentPlacements.length > 0) {
      this.roundHistory = [
        ...this.roundHistory,
        {
          round: context.round,
          playerActions: context.opponentPlacements.map(p => ({
            zoneId: p.zoneId,
            cardName: "?",
            isSecret: p.isSecret,
          })),
        },
      ]
    }

    this.opponentProfile = buildOpponentProfile(
      context.zones,
      this.roundHistory,
      playerVisibleCards
    )

    this.log(
      `Модель оппонента: блеф=${(this.opponentProfile.bluffFrequency * 100).toFixed(0)}%, ` +
      `ср.сила=${this.opponentProfile.avgCardPower.toFixed(0)}, ` +
      `наблюдений=${this.opponentProfile.totalObservations}`,
      "detailed"
    )

    // 2. Получаем стратегические подсказки
    const hints = getStrategicHints(
      context.zones,
      context.round,
      maxRounds,
      context.hand,
      this.opponentProfile
    )

    if (hints.length > 0) {
      this.log(`Стратегические подсказки: ${hints.slice(0, 3).map(h => h.description).join("; ")}`, "detailed")
    }

    // 3. Оцениваем каждый возможный ход через 1-ply simulation
    const candidates: Array<{
      card: Card
      zoneId: string
      isSecret: boolean
      score: number
      reasoning: string
      hintBonus: number
    }> = []

    for (const card of context.hand) {
      for (const zone of availableZones) {
        const moveEval = evaluateMove(card, zone.id, isSecret, {
          zones: context.zones,
          hand: context.hand,
          deck: context.deck,
          round: context.round,
          maxRounds,
          opponentProfile: this.opponentProfile,
          config: this.config,
        })

        if (moveEval.score <= -9999) continue

        // 4. Применяем стратегические подсказки как бонус
        let hintBonus = 0
        hints.forEach(hint => {
          if (hint.zoneId === zone.id || hint.zoneId === "any") {
            switch (hint.type) {
              case "contest_zone":
                hintBonus += hint.priority
                break
              case "all_in":
                hintBonus += hint.priority * 1.2
                break
              case "secure_zone":
                hintBonus += hint.priority * 0.5
                break
              case "bluff_zone":
                if (isSecret) hintBonus += hint.priority
                break
              case "save_card":
                // Штраф за использование сильной карты
                if (getCardBasePower(card) > 150) hintBonus -= hint.priority
                break
            }
          }
        })

        // 5. Дополнительные эвристики

        // RPS контр-пик против видимых карт
        const cardRole = getCardRole(card)
        let rpsBonus = 0
        const visibleInZone = zone.playerCards.filter(zc => !zc.isSecret)
        visibleInZone.forEach(zc => {
          const playerRole = getCardRole(zc.card)
          if (
            (cardRole === "guard" && playerRole === "vanguard") ||
            (cardRole === "trickster" && playerRole === "guard") ||
            (cardRole === "vanguard" && playerRole === "trickster")
          ) {
            rpsBonus += 40
          }
        })

        // Адаптивный контр-пик из конфига
        const counterPriority = this.config.counterRolePriority
        if (counterPriority) {
          const priority = counterPriority[cardRole] ?? 0
          if (priority > 0.4) {
            rpsBonus += Math.round((priority - 0.33) * 50)
          }
        }

        const finalScore = moveEval.score + hintBonus + rpsBonus
        const allReasons = [...moveEval.reasoning]
        if (rpsBonus > 0) allReasons.push(`КНБ контр-пик +${rpsBonus}`)
        if (hintBonus > 0) allReasons.push(`Стратегический бонус +${hintBonus.toFixed(0)}`)

        candidates.push({
          card,
          zoneId: zone.id,
          isSecret,
          score: finalScore,
          reasoning: allReasons.join(", "),
          hintBonus,
        })
      }
    }

    // 6. Сортируем и выбираем лучший ход
    candidates.sort((a, b) => b.score - a.score)

    if (candidates.length === 0) {
      this.log("Нет валидных ходов, fallback на стратегическую стратегию", "basic")
      return new StrategicStrategy(this.config).decideCard(context)
    }

    // Логируем топ-3 кандидатов
    this.log(
      `Топ-3 ходов: ${candidates.slice(0, 3).map(c =>
        `${c.card.name}→${c.zoneId}(${c.score.toFixed(0)})`
      ).join(" | ")}`,
      "detailed"
    )

    const best = selectScoredCandidate(candidates, this.config)
    if (!best) {
      return new StrategicStrategy(this.config).decideCard(context)
    }

    const targetZoneName = context.zones.find(z => z.id === best.zoneId)?.nameRu || "Локация"
    this.log(
      `Шахматный выбор: ${best.card.name} → "${targetZoneName}" ` +
      `(оценка: ${best.score.toFixed(0)}, секретно: ${best.isSecret})`,
      "detailed"
    )

    // Сохраняем ход в историю
    this.moveHistory.push({
      round: context.round,
      cardName: best.card.name,
      zoneId: best.zoneId,
      isSecret: best.isSecret,
    })

    return {
      card: best.card,
      zoneId: best.zoneId,
      isSecret: best.isSecret,
      reasoning: `Шахматный анализ: ${best.reasoning}`,
      confidence: Math.min(0.95, Math.max(0.3, best.score / 800)),
    }
  }

  // Сброс истории между битвами
  resetHistory() {
    this.moveHistory = []
    this.roundHistory = []
    this.opponentProfile = undefined
  }
}

export class AdaptiveStrategy extends AIStrategy {
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
    const counterRolePriority = this.config.counterRolePriority

    for (const card of context.hand) {
      for (const zoneState of zoneStates) {
        const evaluation = evaluateZoneCardCombo(card, zoneState.zone, isSecret, context)
        if (evaluation.score < 0) continue
        let finalScore = evaluation.score
        const cardRole = getCardRole(card)
        const reasons: string[] = [evaluation.reasoning]

        // RPS counter-pick: check visible player cards in this zone
        const visiblePlayerCards = zoneState.zone.playerCards.filter(zc => !zc.isSecret)
        let rpsCounterBonus = 0
        visiblePlayerCards.forEach(zc => {
          const playerRole = getCardRole(zc.card)
          // Does this card's role beat the player's visible card?
          if (cardRole === "guard" && playerRole === "vanguard") { rpsCounterBonus += 50; reasons.push("КНБ: страж бьёт авангарда") }
          if (cardRole === "trickster" && playerRole === "guard") { rpsCounterBonus += 50; reasons.push("КНБ: плут бьёт стража") }
          if (cardRole === "vanguard" && playerRole === "trickster") { rpsCounterBonus += 50; reasons.push("КНБ: авангард бьёт плута") }
        })

        // Apply adaptive counter-role priority bonus
        if (counterRolePriority) {
          const priority = counterRolePriority[cardRole] ?? 0
          if (priority > 0.4) {
            const adaptBonus = Math.round((priority - 0.33) * 60)
            rpsCounterBonus += adaptBonus
            if (adaptBonus > 0) reasons.push(`Адаптивный контр-пик +${adaptBonus}`)
          }
        }

        finalScore += rpsCounterBonus

        // Zone status logic — no role assumptions, just power-based
        if (zoneState.status === "losing") {
          const gapToClose = Math.abs(zoneState.diff)
          if (evaluation.score >= gapToClose * 0.8) {
            finalScore += 80
            this.log(`Карта ${card.name} может перебить отставание в ${zoneState.zone.nameRu} (разрыв: ${gapToClose.toFixed(0)}, потенциал: ${evaluation.score.toFixed(0)})`, "detailed")
          } else {
            finalScore -= 30
          }
        } else if (zoneState.status === "winning") {
          if (alreadyHaveWinningZone) {
            finalScore -= 60
            this.log(`Штраф за укрепление уже выигранной зоны ${zoneState.zone.nameRu} (нужна вторая зона)`, "detailed")
          }
        } else {
          finalScore += 25
        }

        // If zone is hopelessly lost, prefer other zones
        if (zoneState.diff < -200 && evaluation.score < Math.abs(zoneState.diff) * 0.8) {
          const otherZonesWithLessLoss = zoneStates.filter(zs =>
            zs.zone.id !== zoneState.zone.id && zs.diff > zoneState.diff
          )
          if (otherZonesWithLessLoss.length > 0) {
            finalScore -= 50
          }
        }

        candidates.push({
          card,
          zoneId: zoneState.zone.id,
          score: finalScore,
          reasoning: reasons.join(", ")
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
      case "chess_like":
        return new ChessLikeStrategy(this.config)
      default:
        return new ChessLikeStrategy(this.config)
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

export { recordPlayerBattle, syncPlaystyleFromDB, getAdaptedAIConfig } from "./adaptive-learning"
export {
  evaluateBoard,
  evaluateMove,
  simulatePlacement,
  buildOpponentProfile,
  getStrategicHints,
  type BoardEvaluation,
  type ZoneScore,
  type OpponentProfile,
  type StrategicHint,
} from "./board-evaluation"