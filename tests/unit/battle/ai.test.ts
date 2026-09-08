import { describe, expect, it } from "vitest"
import { getAdaptiveAIProfile } from "@/app/battle/ai/difficulty"
import {
  evaluateZone,
  evaluateBoard,
  simulatePlacement,
  evaluateMove,
  buildOpponentProfile,
  getStrategicHints,
} from "@/app/battle/ai/board-evaluation"
import { createAI, createAIDecisionContext, DEFAULT_AI_CONFIG } from "@/app/battle/ai"
import { MAX_CARDS_PER_SIDE } from "@/app/battle/config"
import { makeVanguard, makeGuard, makeTrickster, makeBattleCard } from "../../fixtures/cards"
import { makeEmptyZone, makeThreeZones, makeZoneCard } from "../../fixtures/battle"

describe("getAdaptiveAIProfile", () => {
  it("helps beginners (low level, easy dungeon)", () => {
    const profile = getAdaptiveAIProfile({
      playerLevel: 1,
      dungeonDifficulty: 1,
      player: { battles: 0, wins: 0, losses: 0, consecutive_wins: 0 },
      global: null,
    })
    expect(profile.decisionQuality).toBeLessThan(0.6)
    expect(profile.mistakeChance).toBeGreaterThan(0.1)
    expect(profile.decisionQuality).toBeGreaterThanOrEqual(0.22)
    expect(profile.mistakeChance).toBeLessThanOrEqual(0.45)
  })

  it("gets sharper as player farms and streaks", () => {
    const beginner = getAdaptiveAIProfile({
      playerLevel: 1,
      dungeonDifficulty: 1,
      player: null,
      global: null,
    })
    const veteran = getAdaptiveAIProfile({
      playerLevel: 30,
      dungeonDifficulty: 7,
      player: { battles: 40, wins: 35, losses: 5, consecutive_wins: 8 },
      global: { battles: 100, wins: 70, losses: 30 },
    })
    expect(veteran.decisionQuality).toBeGreaterThan(beginner.decisionQuality)
    expect(veteran.counterPickStrength).toBeGreaterThan(beginner.counterPickStrength)
  })

  it("treats non-finite records as zero", () => {
    const profile = getAdaptiveAIProfile({
      playerLevel: 10,
      dungeonDifficulty: 3,
      player: { battles: Number.NaN, wins: undefined, losses: null, consecutive_wins: null },
      global: { battles: Number.NaN },
    })
    expect(Number.isFinite(profile.decisionQuality)).toBe(true)
    expect(profile.aggressiveness).toBeGreaterThanOrEqual(0.35)
  })
})

describe("board evaluation", () => {
  it("marks empty zones and contested/winning/losing by diff", () => {
    const empty = evaluateZone(makeEmptyZone("a"), 1)
    expect(empty.status).toBe("empty")

    const winningZone = makeEmptyZone("w")
    winningZone.aiCards = [makeZoneCard(makeVanguard(), { powerAfterModifier: 200, isPlayer: false })]
    winningZone.playerCards = [makeZoneCard(makeGuard(), { powerAfterModifier: 10 })]
    expect(evaluateZone(winningZone, 1).status).toBe("winning")

    const losingZone = makeEmptyZone("l")
    losingZone.aiCards = [makeZoneCard(makeVanguard(), { powerAfterModifier: 10, isPlayer: false })]
    losingZone.playerCards = [makeZoneCard(makeGuard(), { powerAfterModifier: 200 })]
    expect(evaluateZone(losingZone, 1).status).toBe("losing")
  })

  it("evaluateBoard returns finite score and zone scores", () => {
    const zones = makeThreeZones()
    zones[0].aiCards = [makeZoneCard(makeVanguard(), { powerAfterModifier: 120, isPlayer: false })]
    const board = evaluateBoard(zones, 1, 3, 4, 4)
    expect(Number.isFinite(board.score)).toBe(true)
    expect(board.zoneScores).toHaveLength(3)
  })

  it("simulatePlacement adds a card to the chosen side", () => {
    const zones = makeThreeZones()
    const next = simulatePlacement(makeVanguard(), "mid", true, zones, true)
    expect(next.find((z) => z.id === "mid")?.aiCards).toHaveLength(1)
    expect(next.find((z) => z.id === "left")?.aiCards).toHaveLength(0)
    expect(next.find((z) => z.id === "mid")?.aiCards[0].isSecret).toBe(true)
  })

  it("evaluateMove rejects missing or full zones", () => {
    const zones = makeThreeZones()
    const cfg = { ...DEFAULT_AI_CONFIG, enableLogging: false }
    const missing = evaluateMove(makeVanguard(), "nope", false, {
      zones,
      hand: [makeVanguard()],
      deck: [],
      round: 1,
      maxRounds: 3,
      config: cfg,
    })
    expect(missing.score).toBe(-9999)

    const full = makeEmptyZone("full")
    full.aiCards = Array.from({ length: MAX_CARDS_PER_SIDE }, (_, i) =>
      makeZoneCard(makeVanguard({ uniqueId: `f${i}` }), { isPlayer: false }),
    )
    const blocked = evaluateMove(makeVanguard(), "full", false, {
      zones: [full],
      hand: [makeVanguard()],
      deck: [],
      round: 1,
      maxRounds: 3,
      config: cfg,
    })
    expect(blocked.score).toBe(-9999)
  })
})

describe("opponent model / hints", () => {
  it("buildOpponentProfile tracks preferred zones and secrets", () => {
    const profile = buildOpponentProfile(
      makeThreeZones(),
      [
        {
          round: 1,
          playerActions: [
            { zoneId: "left", cardName: "A", isSecret: true },
            { zoneId: "left", cardName: "B", isSecret: false },
          ],
        },
      ],
      [makeZoneCard(makeVanguard(), { powerAfterModifier: 80 })],
    )
    expect(profile.preferredZones.left).toBe(2)
    expect(profile.bluffFrequency).toBe(0.5)
    expect(profile.totalObservations).toBe(2)
  })

  it("getStrategicHints suggests all-in on final round contested zones", () => {
    const zones = makeThreeZones()
    zones[1].playerCards = [makeZoneCard(makeGuard(), { powerAfterModifier: 50 })]
    zones[1].aiCards = [makeZoneCard(makeVanguard(), { powerAfterModifier: 50, isPlayer: false })]
    const hints = getStrategicHints(zones, 3, 3, [makeVanguard(), makeGuard()])
    expect(hints.some((h) => h.type === "all_in")).toBe(true)
  })
})

describe("AIEngine public API", () => {
  it("createAI uses default config and can decide a card", () => {
    const ai = createAI({ enableLogging: false, strategy: "power", logLevel: "none" })
    expect(ai.getConfig().strategy).toBe("power")
    const hand = [
      makeBattleCard({ uniqueId: "weak", stats: { hp: 10, atk: 5, def: 5, spd: 5, luck: 5 } }),
      makeBattleCard({ uniqueId: "strong", stats: { hp: 80, atk: 90, def: 10, spd: 10, luck: 10 } }),
    ]
    const ctx = createAIDecisionContext(hand, [], makeThreeZones(), 1, ai.getConfig())
    const decision = ai.decideCard(ctx)
    expect(decision).not.toBeNull()
    expect(decision!.card.uniqueId).toBe("strong")
    expect(decision!.zoneId).toBeTruthy()
  })

  it("decideRound places up to two cards and does not reuse them", () => {
    const ai = createAI({ enableLogging: false, strategy: "power", logLevel: "none" })
    const hand = [makeVanguard({ uniqueId: "a" }), makeGuard({ uniqueId: "b" }), makeTrickster({ uniqueId: "c" })]
    const ctx = createAIDecisionContext(hand, [], makeThreeZones(), 1, ai.getConfig())
    const decisions = ai.decideRound(ctx)
    expect(decisions.length).toBe(2)
    expect(decisions[0].card.uniqueId).not.toBe(decisions[1].card.uniqueId)
    expect(ai.getDecisionHistory().length).toBe(2)
    ai.clearHistory()
    expect(ai.getDecisionHistory()).toEqual([])
  })

  it("returns null when hand is empty", () => {
    const ai = createAI({ enableLogging: false, strategy: "random", logLevel: "none" })
    const ctx = createAIDecisionContext([], [], makeThreeZones(), 1, ai.getConfig())
    expect(ai.decideCard(ctx)).toBeNull()
  })
})
