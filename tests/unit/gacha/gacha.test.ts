import { describe, expect, it } from "vitest"
import { rarityConfig, getDismantleValue, type Rarity } from "@/types/gacha"
import { RARITY_ORDER, statLabels, ART_BAN_LIMIT } from "@/app/gacha/config"
import {
  generateCardUniqueId,
  signCard,
  verifyCard,
  calculateCollectionRating,
  isPinterestUrl,
  getProxiedSrc,
  getOptimizedThumbSrc,
} from "@/app/gacha/utils"
import { ALL_RARITIES, makeGachaCard } from "../../fixtures/cards"

describe("rarity config", () => {
  it("has all 12 rarities with positive weights and labels", () => {
    expect(Object.keys(rarityConfig)).toHaveLength(12)
    expect([...RARITY_ORDER]).toEqual(ALL_RARITIES)
    let lastWeight = 0
    for (const rarity of ALL_RARITIES) {
      const cfg = rarityConfig[rarity]
      expect(cfg.weight).toBeGreaterThan(lastWeight)
      expect(cfg.label.length).toBeGreaterThan(0)
      lastWeight = cfg.weight
    }
  })

  it("dismantle values are monotonic and match known endpoints", () => {
    expect(getDismantleValue("trash")).toBe(5)
    expect(getDismantleValue("omnipotent")).toBe(5000)
    for (let i = 1; i < ALL_RARITIES.length; i++) {
      expect(getDismantleValue(ALL_RARITIES[i])).toBeGreaterThanOrEqual(
        getDismantleValue(ALL_RARITIES[i - 1]),
      )
    }
    expect(getDismantleValue("not-a-rarity" as Rarity)).toBe(5)
  })

  it("stat labels cover all five stats", () => {
    expect(Object.keys(statLabels).sort()).toEqual(["atk", "def", "hp", "luck", "spd"].sort())
    expect(ART_BAN_LIMIT).toBe(10)
  })
})

describe("card identity / integrity", () => {
  it("generateCardUniqueId includes character and pack prefix", () => {
    const id = generateCardUniqueId(17, "naruto")
    expect(id.startsWith("pack-naruto-17-")).toBe(true)
    expect(generateCardUniqueId(17).startsWith("random-17-")).toBe(true)
    expect(generateCardUniqueId(1)).not.toBe(generateCardUniqueId(1))
  })

  it("signCard / verifyCard round-trips and detects tampering", () => {
    const card = makeGachaCard()
    const signature = signCard(card)
    expect(verifyCard(card, signature)).toBe(true)
    expect(verifyCard({ ...card, rarity: "omnipotent" }, signature)).toBe(false)
    expect(verifyCard({ ...card, stats: { ...card.stats, atk: 999 } }, signature)).toBe(false)
  })
})

describe("calculateCollectionRating", () => {
  it("returns F / zeros for empty collection", () => {
    const rating = calculateCollectionRating([])
    expect(rating.grade).toBe("F")
    expect(rating.overallScore).toBe(0)
    expect(rating.totalPower).toBe(0)
    expect(rating.topCards).toEqual([])
  })

  it("computes averages and power score", () => {
    const cards = [
      makeGachaCard({ uniqueId: "a", rarity: "epic", stats: { hp: 100, atk: 100, def: 100, spd: 100, luck: 100 } }),
      makeGachaCard({ uniqueId: "b", rarity: "rare", stats: { hp: 50, atk: 50, def: 50, spd: 50, luck: 50 } }),
    ]
    const rating = calculateCollectionRating(cards)
    expect(rating.totalPower).toBe(750)
    expect(rating.stats.avgHp).toBe(75)
    expect(rating.rarityDistribution.epic).toBe(1)
    expect(rating.rarityDistribution.rare).toBe(1)
    expect(rating.topCards.length).toBeLessThanOrEqual(5)
    expect(rating.overallScore).toBeGreaterThan(0)
    expect(["F", "D", "C", "B", "A", "S", "S+"]).toContain(rating.grade)
  })

  it("S+ for omnipotent stacked collection", () => {
    const cards = Array.from({ length: 5 }, (_, i) =>
      makeGachaCard({
        uniqueId: `god-${i}`,
        rarity: "omnipotent",
        stats: { hp: 100, atk: 100, def: 100, spd: 100, luck: 100 },
      }),
    )
    const rating = calculateCollectionRating(cards)
    expect(rating.grade).toBe("S+")
    expect(rating.overallScore).toBeGreaterThanOrEqual(90)
  })
})

describe("image helpers", () => {
  it("detects pinterest urls", () => {
    expect(isPinterestUrl("https://i.pinimg.com/x.jpg")).toBe(true)
    expect(isPinterestUrl("https://pinimg.com/x.jpg")).toBe(true)
    expect(isPinterestUrl("https://shikimori.one/x.jpg")).toBe(false)
  })

  it("getProxiedSrc proxies pinterest and leaves others", () => {
    const pin = "https://i.pinimg.com/x.jpg"
    expect(getProxiedSrc(pin)).toBe(`/api/image-proxy?url=${encodeURIComponent(pin)}`)
    expect(getProxiedSrc("https://shikimori.one/x.jpg")).toBe("https://shikimori.one/x.jpg")
    expect(getProxiedSrc("")).toBe("")
  })

  it("getOptimizedThumbSrc uses next/image for non-pinterest", () => {
    const url = "https://cdn.example/a.jpg"
    expect(getOptimizedThumbSrc(url, 384, 60)).toBe(
      `/_next/image?url=${encodeURIComponent(url)}&w=384&q=60`,
    )
  })
})
