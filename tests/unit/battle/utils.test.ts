import { describe, expect, it } from "vitest"
import {
  getCardRole,
  getCardProvision,
  getCardBasePower,
  computeDeckSynergies,
  getDeckPowerModifier,
  getKNBBonusMultiplier,
  calculateCardPowerOnZone,
  getTerritoryBuff,
  buildAutoDeck,
} from "@/app/battle/utils"
import {
  DECK_SIZE,
  PROVISION_LIMIT,
  SYNERGY_VALUES,
  SYNERGY_TOTAL_CAP,
  SYNERGY_TOTAL_FLOOR,
  LEADER_AURA_VALUE,
  LIGHT_STEP_THRESHOLD,
} from "@/app/battle/config"
import type { Card, DeckContext, ZoneCard } from "@/app/battle/types"
import { makeBattleCard, makeVanguard, makeGuard, makeTrickster } from "../../fixtures/cards"
import { makeZoneCard, sampleDeck } from "../../fixtures/battle"

describe("getCardRole", () => {
  it("picks vanguard when ATK dominates", () => {
    expect(getCardRole(makeVanguard())).toBe("vanguard")
  })

  it("picks guard when HP/DEF dominate", () => {
    expect(getCardRole(makeGuard())).toBe("guard")
  })

  it("picks trickster when SPD/LUCK dominate", () => {
    expect(getCardRole(makeTrickster())).toBe("trickster")
  })

  it("normalizes HP by 8 so raw HP does not always win", () => {
    const card = makeBattleCard({
      stats: { hp: 80, atk: 20, def: 5, spd: 5, luck: 5 },
    })
    expect(getCardRole(card)).toBe("vanguard")
  })
})

describe("getCardProvision", () => {
  it("trash can cost 0", () => {
    const trash = makeBattleCard({
      rarity: "trash",
      stats: { hp: 40, atk: 10, def: 10, spd: 10, luck: 10 },
    })
    expect(getCardProvision(trash)).toBeGreaterThanOrEqual(0)
  })

  it("higher rarity costs more than trash on average stats", () => {
    const avg = (rarity: Card["rarity"]) =>
      getCardProvision(
        makeBattleCard({
          rarity,
          stats: { hp: 160, atk: 40, def: 40, spd: 40, luck: 40 },
        }),
      )
    expect(avg("omnipotent")).toBeGreaterThan(avg("common"))
  })

  it("clamps variance to +/- 2 around base", () => {
    const weakEpic = getCardProvision(
      makeBattleCard({ rarity: "epic", stats: { hp: 8, atk: 1, def: 1, spd: 1, luck: 1 } }),
    )
    const strongEpic = getCardProvision(
      makeBattleCard({ rarity: "epic", stats: { hp: 800, atk: 100, def: 100, spd: 100, luck: 100 } }),
    )
    expect(weakEpic).toBeGreaterThanOrEqual(1)
    expect(strongEpic - weakEpic).toBeLessThanOrEqual(4)
  })
})

describe("getCardBasePower", () => {
  it("is a weighted sum of stats", () => {
    const card = makeBattleCard({ stats: { hp: 10, atk: 10, def: 10, spd: 10, luck: 10 } })
    expect(getCardBasePower(card)).toBe(Math.round(10 * 0.4 + 10 * 0.5 + 10 * 0.4 + 10 * 0.4 + 10 * 0.3))
  })
})

describe("KNB matchups", () => {
  it("standard: vanguard > trickster, guard > vanguard, trickster > guard", () => {
    expect(getKNBBonusMultiplier("vanguard", "trickster")).toBe(0.5)
    expect(getKNBBonusMultiplier("guard", "vanguard")).toBe(0.5)
    expect(getKNBBonusMultiplier("trickster", "guard")).toBe(0.5)
    expect(getKNBBonusMultiplier("vanguard", "guard")).toBe(0)
    expect(getKNBBonusMultiplier("vanguard", "vanguard")).toBe(0)
  })

  it("reverse flips the triangle", () => {
    expect(getKNBBonusMultiplier("trickster", "vanguard", true)).toBe(0.5)
    expect(getKNBBonusMultiplier("vanguard", "guard", true)).toBe(0.5)
    expect(getKNBBonusMultiplier("guard", "trickster", true)).toBe(0.5)
    expect(getKNBBonusMultiplier("vanguard", "trickster", true)).toBe(0)
  })
})

describe("computeDeckSynergies", () => {
  it("returns empty bonuses for empty deck", () => {
    expect(computeDeckSynergies([])).toMatchObject({
      active: [],
      globalBonus: 0,
      roleAdjust: { vanguard: 0, guard: 0, trickster: 0 },
    })
  })

  it("activates brotherhood for 2+ same anime", () => {
    const deck = [
      makeVanguard({ uniqueId: "1", anime: "Naruto" }),
      makeGuard({ uniqueId: "2", anime: "Naruto" }),
      makeTrickster({ uniqueId: "3", anime: "Bleach" }),
    ]
    const result = computeDeckSynergies(deck)
    expect(result.active.some((s) => s.id === "brotherhood")).toBe(true)
    expect(result.globalBonus).toBeGreaterThanOrEqual(SYNERGY_VALUES.brotherhoodPerCard)
  })

  it("activates role harmony when all 3 roles present", () => {
    const deck = [
      makeVanguard({ uniqueId: "1", anime: "A" }),
      makeGuard({ uniqueId: "2", anime: "B" }),
      makeTrickster({ uniqueId: "3", anime: "C" }),
    ]
    expect(computeDeckSynergies(deck).active.some((s) => s.id === "role_harmony")).toBe(true)
  })

  it("activates specialization for 4 of one role", () => {
    const deck = [
      makeVanguard({ uniqueId: "1" }),
      makeVanguard({ uniqueId: "2", name: "V2" }),
      makeVanguard({ uniqueId: "3", name: "V3" }),
      makeVanguard({ uniqueId: "4", name: "V4" }),
    ]
    const result = computeDeckSynergies(deck)
    expect(result.roleAdjust.vanguard).toBe(SYNERGY_VALUES.specializationSelf)
    expect(result.roleAdjust.guard).toBe(SYNERGY_VALUES.specializationOther)
    expect(result.roleAdjust.trickster).toBe(SYNERGY_VALUES.specializationOther)
  })
})

describe("getDeckPowerModifier", () => {
  it("adds leader aura to same-role cards and clamps", () => {
    const vanguard = makeVanguard({ uniqueId: "leader" })
    const other = makeVanguard({ uniqueId: "same" })
    const ctx: DeckContext = { deck: [vanguard, other], leaderId: "leader", formation: "aggression" }
    const bonus = getDeckPowerModifier(other, ctx, false)
    expect(bonus).toBeGreaterThanOrEqual(LEADER_AURA_VALUE)
    expect(bonus).toBeLessThanOrEqual(SYNERGY_TOTAL_CAP)
    expect(bonus).toBeGreaterThanOrEqual(SYNERGY_TOTAL_FLOOR)
  })
})

describe("territory modifiers", () => {
  const vanguard = makeVanguard()

  it("shadow_step adds +100 to secret cards", () => {
    const open = calculateCardPowerOnZone(vanguard, "shadow_step", [], [], true, false).power
    const secret = calculateCardPowerOnZone(vanguard, "shadow_step", [], [], true, true).power
    expect(secret - open).toBe(100)
  })

  it("vanguard_ring / fortress_gate / speed_valley add +150 to matching role", () => {
    expect(calculateCardPowerOnZone(makeVanguard(), "vanguard_ring").power).toBe(
      getCardBasePower(makeVanguard()) + 150,
    )
    expect(calculateCardPowerOnZone(makeGuard(), "fortress_gate").power).toBe(
      getCardBasePower(makeGuard()) + 150,
    )
    expect(calculateCardPowerOnZone(makeTrickster(), "speed_valley").power).toBe(
      getCardBasePower(makeTrickster()) + 150,
    )
    expect(calculateCardPowerOnZone(makeGuard(), "vanguard_ring").power).toBe(getCardBasePower(makeGuard()))
  })

  it("trash_revolution multiplies trash/common by 4", () => {
    const trash = makeBattleCard({ rarity: "trash", stats: { hp: 80, atk: 20, def: 10, spd: 10, luck: 10 } })
    const base = getCardBasePower(trash)
    expect(calculateCardPowerOnZone(trash, "trash_revolution").power).toBe(base * 4)
  })

  it("god_domain doubles omnipotent", () => {
    const god = makeBattleCard({ rarity: "omnipotent", stats: { hp: 80, atk: 90, def: 10, spd: 10, luck: 10 } })
    expect(calculateCardPowerOnZone(god, "god_domain").power).toBe(getCardBasePower(god) * 2)
  })

  it("no_rps disables matchup bonus", () => {
    const attacker = makeVanguard()
    const defender: ZoneCard[] = [makeZoneCard(makeTrickster(), { isPlayer: false })]
    const withRps = calculateCardPowerOnZone(attacker, "none", defender, [])
    const without = calculateCardPowerOnZone(attacker, "no_rps", defender, [])
    expect(withRps.roleMatchupBonus).toBeGreaterThan(0)
    expect(without.roleMatchupBonus).toBe(0)
  })

  it("lonely_hero +200 when 1v2", () => {
    const me = makeVanguard()
    const mine = [makeZoneCard(me)]
    const enemies = [makeZoneCard(makeGuard(), { isPlayer: false }), makeZoneCard(makeTrickster(), { isPlayer: false })]
    const power = calculateCardPowerOnZone(me, "lonely_hero", enemies, mine).power
    expect(power).toBeGreaterThanOrEqual(getCardBasePower(me) + 200)
  })

  it("getTerritoryBuff reports shadow_step secret bonus", () => {
    const buff = getTerritoryBuff(makeVanguard(), "shadow_step", true)
    expect(buff.value).toBe(100)
    expect(buff.description).toContain("100")
  })
})

describe("buildAutoDeck", () => {
  it("returns empty for no cards", () => {
    expect(buildAutoDeck([])).toEqual({ deck: [], leaderId: null, totalProvision: 0 })
  })

  it("uses all cards when collection is smaller than DECK_SIZE", () => {
    const cards = [makeVanguard(), makeGuard(), makeTrickster({ uniqueId: "tr-x" })]
    const result = buildAutoDeck(cards)
    expect(result.deck).toHaveLength(3)
    expect(result.leaderId).toBeTruthy()
  })

  it("never exceeds DECK_SIZE", () => {
    const cards = Array.from({ length: 20 }, (_, i) =>
      makeBattleCard({
        uniqueId: `c${i}`,
        rarity: i % 2 === 0 ? "common" : "rare",
        stats: { hp: 80, atk: 20 + i, def: 20, spd: 20, luck: 10 },
      }),
    )
    const result = buildAutoDeck(cards)
    expect(result.deck.length).toBeLessThanOrEqual(DECK_SIZE)
  })

  it("keeps requested cards in the deck", () => {
    const keep = makeGuard({ uniqueId: "keep-me", name: "Must Stay" })
    const others = Array.from({ length: 12 }, (_, i) =>
      makeVanguard({ uniqueId: `o${i}`, name: `O${i}`, stats: { hp: 80, atk: 99, def: 1, spd: 1, luck: 1 } }),
    )
    const result = buildAutoDeck([keep, ...others], [keep])
    expect(result.deck.some((c) => c.uniqueId === "keep-me")).toBe(true)
  })

  it("prefers filling a legal provision budget when possible", () => {
    const cheap = Array.from({ length: 12 }, (_, i) =>
      makeBattleCard({
        uniqueId: `cheap${i}`,
        rarity: "trash",
        stats: { hp: 40, atk: 5, def: 5, spd: 5, luck: 5 },
      }),
    )
    const result = buildAutoDeck(cheap)
    expect(result.deck.length).toBe(DECK_SIZE)
    expect(result.totalProvision).toBeGreaterThanOrEqual(0)
  })
})
