import { Card, BattleZone, ZoneCard, CardRole } from "../types"
import { getCardRole, getCardBasePower, calculateCardPowerOnZone } from "../utils"
import { MAX_CARDS_PER_SIDE } from "../config"
import { AIConfig } from "./index"

// ============================================================================
// ШАХМАТНО-ПОДОБНАЯ ОЦЕНКА ДОСКИ (BOARD EVALUATION)
// ============================================================================
// Аналог шахматной функции оценки: оценивает всю позицию целиком,
// а не отдельные ходы. Учитывает контроль зон, темп, угрозы,
// скрытые карты противника и остаток раундов.
// ============================================================================

export interface BoardEvaluation {
  score: number
  zoneScores: ZoneScore[]
  threats: string[]
  tempo: number
  zoneControl: number
  materialBalance: number
  infoAdvantage: number
}

export interface ZoneScore {
  zoneId: string
  aiPower: number
  estimatedPlayerPower: number
  diff: number
  status: "winning" | "losing" | "contested" | "empty"
  weight: number
  isDecided: boolean
}

export interface OpponentProfile {
  preferredZones: Record<string, number>
  roleFrequency: Record<CardRole, number>
  bluffFrequency: number
  avgCardPower: number
  secretPlacementRate: number
  totalObservations: number
}

// ============================================================================
// 1. ОЦЕНКА ОТДЕЛЬНОЙ ЗОНЫ (аналог piece-square evaluation)
// ============================================================================

export function evaluateZone(
  zone: BattleZone,
  round: number,
  maxRounds: number = 3,
  opponentProfile?: OpponentProfile
): ZoneScore {
  const aiPower = zone.aiCards.reduce((sum, c) => sum + c.powerAfterModifier, 0)

  let playerPower = 0
  zone.playerCards.forEach(zc => {
    if (zc.isSecret) {
      let estimate = 85 + round * 15
      if (opponentProfile && opponentProfile.avgCardPower > 0) {
        estimate = Math.round(opponentProfile.avgCardPower * 0.7 + round * 10)
      }
      playerPower += estimate
    } else {
      playerPower += zc.powerAfterModifier
    }
  })

  const diff = aiPower - playerPower

  let status: ZoneScore["status"] = "contested"
  if (zone.aiCards.length === 0 && zone.playerCards.length === 0) {
    status = "empty"
  } else if (diff > 30) {
    status = "winning"
  } else if (diff < -30) {
    status = "losing"
  }

  const isDecided =
    (status === "winning" && diff > 150) ||
    (status === "losing" && diff < -150)

  // Вес зоны: в поздних раундах спорные зоны важнее
  let weight = 1.0
  if (status === "contested" && zone.aiCards.length + zone.playerCards.length > 0) {
    weight = 1.0 + (round / maxRounds) * 0.5
  }
  if (isDecided) {
    weight *= 0.3
  }
  if (status === "empty" && round >= maxRounds - 1) {
    weight *= 0.5
  }

  return {
    zoneId: zone.id,
    aiPower,
    estimatedPlayerPower: playerPower,
    diff,
    status,
    weight,
    isDecided,
  }
}

// ============================================================================
// 2. ПОЛНАЯ ОЦЕНКА ДОСКИ (аналог chess position evaluation)
// ============================================================================

export function evaluateBoard(
  zones: BattleZone[],
  round: number,
  maxRounds: number,
  aiHandSize: number,
  aiDeckSize: number,
  opponentProfile?: OpponentProfile
): BoardEvaluation {
  const zoneScores = zones.map(z => evaluateZone(z, round, maxRounds, opponentProfile))

  // --- Контроль зон (аналог "king safety" + "center control") ---
  let zoneControl = 0
  zoneScores.forEach(zs => {
    if (zs.status === "winning") zoneControl += 100 * zs.weight
    else if (zs.status === "losing") zoneControl -= 100 * zs.weight
    else if (zs.status === "contested") {
      // В спорных зонах каждый пункт разницы ценнее
      zoneControl += zs.diff * 0.5 * zs.weight
    }
  })

  // --- Материальный баланс (сила на доске) ---
  let materialBalance = 0
  zoneScores.forEach(zs => {
    materialBalance += zs.diff * zs.weight
  })

  // --- Темп (аналог "development" в шахматах) ---
  // Раунд 1: важно не выкладывать сильные карты сразу
  // Раунд 2: нужно контролировать спорные зоны
  // Раунд 3: нужно максимизировать силу
  let tempo = 0
  const isEndgame = round >= maxRounds
  const isOpening = round === 1

  if (isOpening) {
    // В начале: бонус за сохранение сильных карт на потом
    // Штраф за перекоммит в одну зону
    zones.forEach(zone => {
      if (zone.aiCards.length >= 2) tempo -= 20
    })
    // Бонус за распределение по зонам
    const zonesWithCards = zones.filter(z => z.aiCards.length > 0).length
    tempo += zonesWithCards * 15
  } else if (isEndgame) {
    // В эндшпиле: бонус за максимальную силу
    zoneScores.forEach(zs => {
      if (zs.status !== "winning") {
        tempo += zs.aiPower * 0.1
      }
    })
    // Штраф за карты в руке (не успеем разыграть)
    tempo -= aiHandSize * 25
  } else {
    // Мидгейм: баланс
    const contested = zoneScores.filter(zs => zs.status === "contested")
    tempo += contested.length * 10
  }

  // --- Информационное преимущество (скрытые карты) ---
  // Скрытые карты дают информационное преимущество
  let infoAdvantage = 0
  zones.forEach(zone => {
    const aiSecrets = zone.aiCards.filter(c => c.isSecret).length
    const playerSecrets = zone.playerCards.filter(c => c.isSecret).length
    infoAdvantage += (aiSecrets - playerSecrets) * 15
  })

  // --- Угрозы (аналог "hanging pieces") ---
  const threats: string[] = []
  zoneScores.forEach(zs => {
    if (zs.status === "losing" && !zs.isDecided) {
      threats.push(`Проигрываем зону ${zs.zoneId} (${zs.diff.toFixed(0)})`)
    }
  })

  // --- Запас карт (аналог "material in hand") ---
  const reserveFactor = (aiHandSize + aiDeckSize) * 2

  const score =
    zoneControl * 1.0 +
    materialBalance * 0.3 +
    tempo * 0.8 +
    infoAdvantage * 0.5 +
    reserveFactor

  return {
    score,
    zoneScores,
    threats,
    tempo,
    zoneControl,
    materialBalance,
    infoAdvantage,
  }
}

// ============================================================================
// 3. СИМУЛЯЦИЯ ХОДА (1-ply lookahead — аналог chess move simulation)
// ============================================================================

export function simulatePlacement(
  card: Card,
  zoneId: string,
  isSecret: boolean,
  zones: BattleZone[],
  isAI: boolean = true
): BattleZone[] {
  return zones.map(zone => {
    if (zone.id !== zoneId) return { ...zone }

    const newCard: ZoneCard = {
      card,
      isSecret,
      wasSecret: isSecret,
      powerAfterModifier: getCardBasePower(card),
      placementOrder: isAI ? zone.aiCards.length : zone.playerCards.length,
      isPlayer: !isAI,
    }

    return {
      ...zone,
      aiCards: isAI ? [...zone.aiCards, newCard] : zone.aiCards,
      playerCards: !isAI ? [...zone.playerCards, newCard] : zone.playerCards,
    }
  })
}

// ============================================================================
// 4. ОЦЕНКА ОДНОГО ХОДА (board eval before vs after)
// ============================================================================

export function evaluateMove(
  card: Card,
  zoneId: string,
  isSecret: boolean,
  context: {
    zones: BattleZone[]
    hand: Card[]
    deck: Card[]
    round: number
    maxRounds: number
    opponentProfile?: OpponentProfile
    config: AIConfig
  }
): { score: number; reasoning: string[] } {
  const { zones, hand, deck, round, maxRounds, opponentProfile, config } = context

  // Проверка лимита карт
  const targetZone = zones.find(z => z.id === zoneId)
  if (!targetZone) return { score: -9999, reasoning: ["Зона не найдена"] }
  if (targetZone.aiCards.length >= MAX_CARDS_PER_SIDE) {
    return { score: -9999, reasoning: ["Зона заполнена"] }
  }

  // Доска ДО хода
  const beforeEval = evaluateBoard(
    zones,
    round,
    maxRounds,
    hand.length,
    deck.length,
    opponentProfile
  )

  // Доска ПОСЛЕ хода
  const simulatedZones = simulatePlacement(card, zoneId, isSecret, zones, true)
  const afterEval = evaluateBoard(
    simulatedZones,
    round,
    maxRounds,
    hand.length - 1,
    deck.length,
    opponentProfile
  )

  // Дельта = улучшение позиции
  const delta = afterEval.score - beforeEval.score
  const reasons: string[] = []

  // --- Анализ: что улучшил ход ---

  const zoneScoreAfter = afterEval.zoneScores.find(zs => zs.zoneId === zoneId)
  const zoneScoreBefore = beforeEval.zoneScores.find(zs => zs.zoneId === zoneId)

  if (zoneScoreAfter && zoneScoreBefore) {
    const diffChange = zoneScoreAfter.diff - zoneScoreBefore.diff
    if (diffChange > 0) {
      reasons.push(`Усиление зоны +${diffChange.toFixed(0)}`)
    }

    // Статус изменился
    if (zoneScoreBefore.status === "losing" && zoneScoreAfter.status === "contested") {
      reasons.push("Отыгрывание проигранной зоны")
    } else if (zoneScoreBefore.status === "contested" && zoneScoreAfter.status === "winning") {
      reasons.push("Перехват контроля зоны")
    } else if (zoneScoreBefore.status === "empty" && zoneScoreAfter.status === "winning") {
      reasons.push("Захват свободной зоны")
    }
  }

  // --- Бонус за скрытую карту (информационное преимущество) ---
  if (isSecret) {
    reasons.push("Скрытое размещение (информационное преимущество)")
    // Дополнительный бонус если у противника есть видимая карта
    const playerVisible = targetZone.playerCards.filter(c => !c.isSecret)
    if (playerVisible.length > 0) {
      const cardRole = getCardRole(card)
      playerVisible.forEach(pvc => {
        const playerRole = getCardRole(pvc.card)
        if (
          (cardRole === "guard" && playerRole === "vanguard") ||
          (cardRole === "trickster" && playerRole === "guard") ||
          (cardRole === "vanguard" && playerRole === "trickster")
        ) {
          reasons.push("Контр-пик скрытой картой")
        }
      })
    }
  }

  // --- Штраф за перекоммит в решённую зону ---
  if (zoneScoreAfter?.isDecided && zoneScoreBefore?.status === "winning") {
    reasons.push("Штраф: перекоммит в выигранную зону")
  }

  // --- Темп: сохранение сильных карт ---
  const cardPower = getCardBasePower(card)
  const avgHandPower = hand.length > 0
    ? hand.reduce((s, c) => s + getCardBasePower(c), 0) / hand.length
    : 0

  if (round === 1 && cardPower > avgHandPower * 1.4 && !isSecret) {
    reasons.push("Штраф темпа: слишком сильная карта в 1-м раунде")
  }

  if (round === maxRounds && cardPower < avgHandPower * 0.7) {
    reasons.push("Штраф: слабая карта в финальном раунде")
  }

  // --- Модификаторы конфига ---
  const aggressiveness = config.aggressiveness ?? 0.6
  const defensiveness = config.defensiveness ?? 0.4

  // Агрессивный AI: больше ценит перехват зон
  if (zoneScoreBefore?.status === "contested" && zoneScoreAfter?.status === "winning") {
    delta * (1 + aggressiveness * 0.3)
  }

  // Защитный AI: больше ценит удержание спорных зон
  if (zoneScoreBefore?.status === "losing") {
    delta * (1 + defensiveness * 0.3)
  }

  return { score: delta, reasoning: reasons }
}

// ============================================================================
// 5. ОПОНЕНТ-МОДЕЛИРОВАНИЕ (аналог opponent modeling in poker bots)
// ============================================================================

export function buildOpponentProfile(
  zones: BattleZone[],
  roundHistory: Array<{
    round: number
    playerActions: { zoneId: string; cardName: string; isSecret: boolean }[]
  }>,
  playerVisibleCards: ZoneCard[]
): OpponentProfile {
  const preferredZones: Record<string, number> = {}
  const roleFrequency: Record<CardRole, number> = {
    vanguard: 0,
    guard: 0,
    trickster: 0,
  }

  let totalCards = 0
  let secretCount = 0
  let totalPower = 0

  // Из истории ходов
  roundHistory.forEach(rh => {
    rh.playerActions.forEach(action => {
      preferredZones[action.zoneId] = (preferredZones[action.zoneId] || 0) + 1
      if (action.isSecret) secretCount++
      totalCards++
    })
  })

  // Из видимых карт на доске
  playerVisibleCards.forEach(zc => {
    const role = zc.card.role || getCardRole(zc.card)
    roleFrequency[role] = (roleFrequency[role] || 0) + 1
    totalPower += zc.powerAfterModifier
    if (zc.isSecret) secretCount++
  })

  return {
    preferredZones,
    roleFrequency,
    bluffFrequency: totalCards > 0 ? secretCount / totalCards : 0.5,
    avgCardPower: playerVisibleCards.length > 0 ? totalPower / playerVisibleCards.length : 100,
    secretPlacementRate: totalCards > 0 ? secretCount / totalCards : 0.5,
    totalObservations: totalCards,
  }
}

// ============================================================================
// 6. СТРАТЕГИЧЕСКИЕ ЭВРИСТИКИ (аналог chess opening principles)
// ============================================================================

export interface StrategicHint {
  type: "secure_zone" | "contest_zone" | "bluff_zone" | "save_card" | "all_in"
  zoneId: string
  priority: number
  description: string
}

export function getStrategicHints(
  zones: BattleZone[],
  round: number,
  maxRounds: number,
  hand: Card[],
  opponentProfile?: OpponentProfile
): StrategicHint[] {
  const hints: StrategicHint[] = []
  const zoneScores = zones.map(z => evaluateZone(z, round, maxRounds, opponentProfile))

  // 1. Если проигрываем зону и можем отыграться
  zoneScores.forEach(zs => {
    if (zs.status === "losing" && !zs.isDecided) {
      const gap = Math.abs(zs.diff)
      const canClose = hand.some(c => getCardBasePower(c) >= gap * 0.7)
      if (canClose) {
        hints.push({
          type: "contest_zone",
          zoneId: zs.zoneId,
          priority: 60 + (round / maxRounds) * 40,
          description: `Отыграть зону ${zs.zoneId} (отставание ${gap.toFixed(0)})`,
        })
      }
    }
  })

  // 2. Если лидируем в 2+ зонах — не усиливать третью
  const winningCount = zoneScores.filter(zs => zs.status === "winning").length
  if (winningCount >= 2) {
    hints.push({
      type: "save_card",
      zoneId: "any",
      priority: 30,
      description: "Лидируем в 2+ зонах — сохранить сильные карты",
    })
  }

  // 3. В финальном раунде — all-in на спорные зоны
  if (round >= maxRounds) {
    zoneScores.forEach(zs => {
      if (zs.status === "contested" || zs.status === "losing") {
        hints.push({
          type: "all_in",
          zoneId: zs.zoneId,
          priority: 80,
          description: `Финальный раунд: all-in на зону ${zs.zoneId}`,
        })
      }
    })
  }

  // 4. Блеф в пустую зону если у противника высокая частота блефа
  if (opponentProfile && opponentProfile.bluffFrequency > 0.6) {
    const emptyZones = zoneScores.filter(zs => zs.status === "empty")
    if (emptyZones.length > 0 && round < maxRounds) {
      hints.push({
        type: "bluff_zone",
        zoneId: emptyZones[0].zoneId,
        priority: 25,
        description: "Блеф в пустую зону (противник часто блефует)",
      })
    }
  }

  // 5. Контр-зона: если противник предпочитает определённую зону
  if (opponentProfile && opponentProfile.totalObservations >= 4) {
    const sortedZones = Object.entries(opponentProfile.preferredZones)
      .sort(([, a], [, b]) => b - a)
    if (sortedZones.length > 0 && sortedZones[0][1] >= 2) {
      const favZone = sortedZones[0][0]
      hints.push({
        type: "contest_zone",
        zoneId: favZone,
        priority: 35,
        description: `Контр-зона: противник предпочитает ${favZone}`,
      })
    }
  }

  return hints.sort((a, b) => b.priority - a.priority)
}
