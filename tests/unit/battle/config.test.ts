import { describe, expect, it } from "vitest"
import {
  PROVISION_LIMIT,
  DECK_SIZE,
  MAX_CARDS_PER_SIDE,
  RARITY_PROVISION_BASE,
  RARITY_AVG_STATS,
  ROLE_CONFIG,
  SYNERGY_VALUES,
  SYNERGY_TOTAL_CAP,
  SYNERGY_TOTAL_FLOOR,
  LIGHT_STEP_THRESHOLD,
  ELITE_RARITIES,
  LEADER_AURA_VALUE,
  FORMATION_CONFIG,
  TERRITORY_MODIFIERS,
  TIER_CONFIG,
  THEME_CONFIG,
} from "@/app/battle/config"
import { ALL_RARITIES } from "../../fixtures/cards"

describe("CCG constants", () => {
  it("keeps deck construction limits stable", () => {
    expect(DECK_SIZE).toBe(8)
    expect(PROVISION_LIMIT).toBe(35)
    expect(MAX_CARDS_PER_SIDE).toBe(4)
    expect(LIGHT_STEP_THRESHOLD).toBeLessThanOrEqual(PROVISION_LIMIT)
  })

  it("has provision base and avg stats for every rarity", () => {
    for (const rarity of ALL_RARITIES) {
      expect(RARITY_PROVISION_BASE[rarity]).toBeGreaterThanOrEqual(0)
      expect(RARITY_AVG_STATS[rarity]).toBeGreaterThan(0)
    }
    expect(RARITY_PROVISION_BASE.trash).toBe(0)
    expect(RARITY_PROVISION_BASE.omnipotent).toBe(11)
  })

  it("defines three roles and three formations", () => {
    expect(Object.keys(ROLE_CONFIG).sort()).toEqual(["guard", "trickster", "vanguard"])
    expect(Object.keys(FORMATION_CONFIG).sort()).toEqual(["aggression", "balance", "defense"])
    expect(FORMATION_CONFIG.aggression.vanguard).toBe(15)
    expect(FORMATION_CONFIG.defense.guard).toBe(15)
    expect(LEADER_AURA_VALUE).toBe(10)
  })

  it("clamps synergy influence", () => {
    expect(SYNERGY_TOTAL_FLOOR).toBe(-15)
    expect(SYNERGY_TOTAL_CAP).toBe(25)
    expect(SYNERGY_VALUES.brotherhoodMinCards).toBe(2)
  })

  it("elite rarities start at epic", () => {
    expect(ELITE_RARITIES[0]).toBe("epic")
    expect(ELITE_RARITIES).toContain("omnipotent")
    expect(ELITE_RARITIES).not.toContain("rare")
  })

  it("territory modifiers have unique ids and russian names", () => {
    const ids = TERRITORY_MODIFIERS.map((m) => m.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.length).toBeGreaterThanOrEqual(20)
    for (const mod of TERRITORY_MODIFIERS) {
      expect(mod.nameRu.length).toBeGreaterThan(0)
      expect(mod.description.length).toBeGreaterThan(0)
    }
  })

  it("theme and tier configs cover known keys", () => {
    expect(THEME_CONFIG.dark_forest).toBeTruthy()
    expect(TIER_CONFIG.boss.label).toBe("Босс")
    expect(TIER_CONFIG.legendary.label).toBe("Легендарный")
  })
})
