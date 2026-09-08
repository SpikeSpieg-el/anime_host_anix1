import { describe, expect, it, vi, afterEach } from "vitest"
import { getDismantleValue, type Rarity } from "@/types/gacha"
import {
  computeMinListingPrice,
  computeMaxListingPrice,
  RARITY_ORDER,
} from "@/lib/market-floor"
import {
  computeMinListingPrice as computeMinImproved,
  computeMaxListingPrice as computeMaxImproved,
  validatePrice,
} from "@/lib/market-floor-improved"
import { ALL_RARITIES, makeMarketCard } from "../../fixtures/cards"

describe("market floor (classic)", () => {
  it("never prices below spin cost (50)", () => {
    const cheap = makeMarketCard("trash", { stats: { hp: 0, atk: 0, def: 0, spd: 0, luck: 0 } })
    expect(computeMinListingPrice(cheap as any, [])).toBeGreaterThanOrEqual(50)
  })

  it("min price grows with rarity", () => {
    const prices = ALL_RARITIES.map((r) => computeMinListingPrice(makeMarketCard(r) as any, []))
    for (let i = 1; i < prices.length; i++) {
      expect(prices[i]).toBeGreaterThanOrEqual(prices[i - 1])
    }
  })

  it("main character bonus increases min price", () => {
    const base = computeMinListingPrice(makeMarketCard("epic") as any, [])
    const main = computeMinListingPrice(makeMarketCard("epic", { isMainCharacter: true }) as any, [])
    expect(main).toBe(base + getDismantleValue("epic"))
  })

  it("max is at least min and capped", () => {
    const card = makeMarketCard("omnipotent", {
      stats: { hp: 100, atk: 100, def: 100, spd: 100, luck: 100 },
      isMainCharacter: true,
    })
    const min = computeMinListingPrice(card as any, [])
    const max = computeMaxListingPrice(card as any, [])
    expect(max).toBeGreaterThanOrEqual(min)
    expect(max).toBeLessThanOrEqual(15_000_000)
  })

  it("formula matches documented pieces", () => {
    const card = makeMarketCard("rare")
    const rarityIdx = RARITY_ORDER.indexOf("rare")
    const dismantle = getDismantleValue("rare")
    const statSum = 50 + 40 + 30 + 20 + 10
    const expected = Math.max(50, dismantle * 8 + Math.floor(statSum * 0.3) + rarityIdx * 25)
    expect(computeMinListingPrice(card as any, [])).toBe(expected)
  })
})

describe("market floor (improved)", () => {
  it("min matches classic simplified formula", () => {
    const card = makeMarketCard("legendary", { isMainCharacter: true })
    expect(computeMinImproved(card as any)).toBe(computeMinListingPrice(card as any, []))
  })

  it("max uses tighter 50x / 5M cap", () => {
    const card = makeMarketCard("omnipotent", {
      stats: { hp: 100, atk: 100, def: 100, spd: 100, luck: 100 },
    })
    const min = computeMinImproved(card as any)
    const max = computeMaxImproved(card as any)
    expect(max).toBe(Math.max(min, Math.min(Math.floor(min * 50), 5_000_000)))
  })

  it("validatePrice rejects below min and above max", () => {
    const card = makeMarketCard("epic")
    const min = computeMinImproved(card as any)
    const max = computeMaxImproved(card as any)
    expect(validatePrice(min - 1, card as any).isValid).toBe(false)
    expect(validatePrice(max + 1, card as any).isValid).toBe(false)
    expect(validatePrice(min, card as any).isValid).toBe(true)
    expect(validatePrice(max, card as any).isValid).toBe(true)
  })
})
