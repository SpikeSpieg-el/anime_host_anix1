import { describe, expect, it, vi, afterEach } from "vitest"
import {
  calculateEnemyPower,
  calculateEnemyTeamPower,
  calculateTeamPower,
  calculateStaminaRefill,
  calculateLevelUp,
  type BattleCard,
  type BattleEnemy,
} from "@/lib/battle-engine"
import { ALL_RARITIES } from "../../fixtures/cards"

const stats = { hp: 100, atk: 50, def: 40, spd: 30, luck: 20 }

function enemy(tier: BattleEnemy["tier"], extra: Partial<BattleEnemy> = {}): BattleEnemy {
  return {
    id: "e1",
    name: "Enemy",
    nameRu: "Враг",
    level: 1,
    tier,
    stats,
    ...extra,
  }
}

function card(extra: Partial<BattleCard> = {}): BattleCard {
  return {
    uniqueId: "c1",
    name: "Hero",
    anime: "Test",
    rarity: "rare",
    imageUrl: "",
    stats,
    ...extra,
  }
}

describe("calculateEnemyPower", () => {
  it("uses formula hp + atk*2 + def + spd + luck, scaled by tier", () => {
    const base = 100 + 50 * 2 + 40 + 30 + 20 // 290
    expect(calculateEnemyPower(enemy("normal"))).toBe(Math.round(base * 1.0))
    expect(calculateEnemyPower(enemy("elite"))).toBe(Math.round(base * 1.5))
    expect(calculateEnemyPower(enemy("boss"))).toBe(Math.round(base * 2.0))
    expect(calculateEnemyPower(enemy("legendary"))).toBe(Math.round(base * 3.0))
  })
})

describe("calculateEnemyTeamPower", () => {
  it("returns F for empty team", () => {
    expect(calculateEnemyTeamPower([])).toMatchObject({
      totalPower: 0,
      avgPower: 0,
      rating: "F",
    })
  })

  it("aggregates powers and assigns rating by average", () => {
    const weak = enemy("normal", { stats: { hp: 10, atk: 1, def: 1, spd: 1, luck: 1 } })
    const result = calculateEnemyTeamPower([weak, weak])
    expect(result.totalPower).toBeGreaterThan(0)
    expect(result.avgPower).toBe(Math.round(result.totalPower / 2))
    expect(["F", "D", "C", "B", "A", "S", "SS", "SSS"]).toContain(result.rating)
  })

  it("SSS when average power is very high", () => {
    const beast = enemy("legendary", {
      stats: { hp: 400, atk: 200, def: 200, spd: 200, luck: 200 },
    })
    expect(calculateEnemyTeamPower([beast]).rating).toBe("SSS")
  })
})

describe("calculateTeamPower", () => {
  it("returns F for empty team", () => {
    expect(calculateTeamPower([])).toMatchObject({ totalPower: 0, rating: "F" })
  })

  it("applies rarity multipliers — omnipotent > trash", () => {
    const trash = calculateTeamPower([card({ rarity: "trash" })])
    const omnipotent = calculateTeamPower([card({ rarity: "omnipotent" })])
    expect(omnipotent.totalPower).toBeGreaterThan(trash.totalPower)
  })

  it("main character bonus is +15%", () => {
    const normal = calculateTeamPower([card({ isMainCharacter: false })])
    const main = calculateTeamPower([card({ isMainCharacter: true })])
    expect(main.totalPower).toBe(Math.round(normal.totalPower * 1.15))
  })

  it("covers every rarity without throwing", () => {
    for (const rarity of ALL_RARITIES) {
      const result = calculateTeamPower([card({ rarity })])
      expect(result.totalPower).toBeGreaterThan(0)
      expect(result.rating).toBeTruthy()
    }
  })
})

describe("calculateStaminaRefill", () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it("does not refill if no time passed", () => {
    vi.useFakeTimers()
    const now = new Date("2026-01-01T12:00:00Z")
    vi.setSystemTime(now)
    const result = calculateStaminaRefill(now.toISOString(), 5, 10)
    expect(result.stamina).toBe(5)
    expect(result.canRefill).toBe(false)
    expect(result.nextRefillMs).toBeGreaterThan(0)
  })

  it("refills 1 stamina per hour and caps at max", () => {
    vi.useFakeTimers()
    const last = new Date("2026-01-01T00:00:00Z")
    vi.setSystemTime(new Date("2026-01-01T03:00:00Z"))
    const result = calculateStaminaRefill(last.toISOString(), 5, 10)
    expect(result.stamina).toBe(8)
    expect(result.canRefill).toBe(true)
  })

  it("does not exceed max stamina", () => {
    vi.useFakeTimers()
    const last = new Date("2026-01-01T00:00:00Z")
    vi.setSystemTime(new Date("2026-01-02T00:00:00Z"))
    const result = calculateStaminaRefill(last.toISOString(), 8, 10)
    expect(result.stamina).toBe(10)
    expect(result.nextRefillMs).toBe(0)
  })
})

describe("calculateLevelUp", () => {
  it("does not level up when xp is below threshold", () => {
    const result = calculateLevelUp(50, 100, 1)
    expect(result.leveledUp).toBe(false)
    expect(result.newLevel).toBe(1)
    expect(result.newXp).toBe(50)
    expect(result.newMaxStamina).toBe(10)
  })

  it("levels up once and leftover xp remains", () => {
    const result = calculateLevelUp(150, 100, 1)
    expect(result.leveledUp).toBe(true)
    expect(result.newLevel).toBeGreaterThanOrEqual(2)
    expect(result.newXp).toBeGreaterThanOrEqual(0)
    expect(result.newXpToNext).toBe(Math.round(100 * Math.pow(1.3, result.newLevel - 1)))
  })

  it("caps multi-level jumps at 10 extra levels", () => {
    const result = calculateLevelUp(1_000_000, 1, 1)
    expect(result.leveledUp).toBe(true)
    expect(result.newLevel).toBeLessThanOrEqual(12)
  })

  it("increases max stamina every 5 levels", () => {
    expect(calculateLevelUp(0, 100, 4).newMaxStamina).toBe(10)
    expect(calculateLevelUp(0, 100, 5).newMaxStamina).toBe(11)
    const after = calculateLevelUp(999999, 1, 1)
    expect(after.newMaxStamina).toBe(10 + Math.floor(after.newLevel / 5))
  })
})
