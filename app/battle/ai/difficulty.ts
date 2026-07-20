export interface AILearningRecord {
  battles?: number | null
  wins?: number | null
  losses?: number | null
  consecutive_wins?: number | null
}

export interface AdaptiveAIInput {
  playerLevel: number
  dungeonDifficulty: number
  player: AILearningRecord | null
  global: AILearningRecord | null
}

export interface AdaptiveAIProfile {
  decisionQuality: number
  mistakeChance: number
  aggressiveness: number
  defensiveness: number
  counterPickStrength: number
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

const valueOrZero = (value?: number | null) => Number.isFinite(value) ? Number(value) : 0

export function getAdaptiveAIProfile(input: AdaptiveAIInput): AdaptiveAIProfile {
  const playerBattles = valueOrZero(input.player?.battles)
  const playerWins = valueOrZero(input.player?.wins)
  const winStreak = valueOrZero(input.player?.consecutive_wins)
  const globalBattles = valueOrZero(input.global?.battles)
  const globalWins = valueOrZero(input.global?.wins)
  const globalWinRate = globalBattles > 0 ? globalWins / globalBattles : 0.5
  const earlyStage = input.playerLevel <= 5 && input.dungeonDifficulty <= 2
  const farmingPressure = clamp((playerBattles - 4) / 12, 0, 1) * clamp(playerWins / Math.max(playerBattles, 1), 0, 1)
  const streakPressure = clamp((winStreak - 2) / 6, 0, 1)
  const globalCorrection = globalBattles >= 20 ? clamp((globalWinRate - 0.55) * 0.7, -0.12, 0.12) : 0
  const stagePressure = clamp((input.dungeonDifficulty - 1) * 0.055, 0, 0.32)
  const beginnerHelp = earlyStage ? 0.28 : 0
  const decisionQuality = clamp(0.52 + stagePressure + farmingPressure * 0.24 + streakPressure * 0.12 + globalCorrection - beginnerHelp, 0.22, 0.94)
  const mistakeChance = clamp(0.36 - decisionQuality * 0.29 + (earlyStage ? 0.13 : 0), 0.05, 0.45)

  return {
    decisionQuality,
    mistakeChance,
    aggressiveness: clamp(0.46 + decisionQuality * 0.38 + farmingPressure * 0.08, 0.35, 0.9),
    defensiveness: clamp(0.3 + decisionQuality * 0.34 + streakPressure * 0.1, 0.25, 0.85),
    counterPickStrength: clamp((playerBattles >= 5 ? 0.2 : 0) + farmingPressure * 0.55 + streakPressure * 0.15, 0, 0.85),
  }
}
