import { describe, expect, it } from "vitest"
import { getDismantleValue, type Rarity } from "@/types/gacha"
import {
  computeMinListingPrice,
  computeMaxListingPrice,
  computeSuggestedListingPrice,
  explainCardValue,
  getFairCardValue,
  getInstantSellPrice,
  RARITY_ORDER,
} from "@/lib/market-floor"
import {
  computeMinListingPrice as computeMinImproved,
  computeMaxListingPrice as computeMaxImproved,
  getPriceRange,
  validatePrice,
} from "@/lib/market-floor-improved"
import { ALL_RARITIES, makeMarketCard } from "../../fixtures/cards"

describe("границы лота", () => {
  it("минимальная цена не опускается ниже нуля и всегда положительна", () => {
    const cheap = makeMarketCard("trash", { stats: { hp: 0, atk: 0, def: 0, spd: 0, luck: 0 } })
    expect(computeMinListingPrice(cheap as any, [])).toBeGreaterThan(0)
  })

  it("минимальная цена растёт с редкостью", () => {
    const prices = ALL_RARITIES.map((r) => computeMinListingPrice(makeMarketCard(r) as any, []))
    for (let i = 1; i < prices.length; i++) {
      expect(prices[i]).toBeGreaterThanOrEqual(prices[i - 1])
    }
  })

  it("главный герой повышает минимальную цену", () => {
    const base = computeMinListingPrice(makeMarketCard("epic") as any, [])
    const main = computeMinListingPrice(makeMarketCard("epic", { isMainCharacter: true }) as any, [])
    expect(main).toBeGreaterThan(base)
  })

  it("максимум не меньше минимума и не выше абсолютного потолка", () => {
    const card = makeMarketCard("omnipotent", {
      stats: { hp: 100, atk: 100, def: 100, spd: 100, luck: 100 },
      isMainCharacter: true,
    })
    const min = computeMinListingPrice(card as any, [])
    const max = computeMaxListingPrice(card as any, [])
    expect(max).toBeGreaterThanOrEqual(min)
    expect(max).toBeLessThanOrEqual(500_000)
  })

  it("карта стоит заметно дороже разбора в пыль (иначе не торговать)", () => {
    for (const rarity of ["rare", "epic", "mythic", "legendary"] as Rarity[]) {
      const card = makeMarketCard(rarity)
      expect(getFairCardValue(card as any)).toBeGreaterThan(getDismantleValue(rarity) * 1.3)
    }
  })

  it("мгновенная продажа стоит как разбор в пыль, но сразу монетками", () => {
    // Смысл мгновенной продажи: получить монеты сейчас, не дожидаясь покупателя.
    // Поэтому она должна быть примерно равна разбору карты в пыль (70% цены),
    // но заметно дешевле рыночного лота — за это её и выбирают.
    for (const rarity of ["rare", "epic", "mythic", "legendary"] as Rarity[]) {
      const card = makeMarketCard(rarity)
      const instant = getInstantSellPrice(card as any)
      expect(instant).toBeGreaterThanOrEqual(getDismantleValue(rarity))
      expect(instant).toBeLessThan(getFairCardValue(card as any))
    }
  })
})

describe("ценообразование", () => {
  it("объяснение цены раскладывает её на слагаемые", () => {
    const card = makeMarketCard("epic", { isMainCharacter: true })
    const explanation = explainCardValue(card as any)
    expect(explanation.base).toContain("База редкости")
    expect(explanation.stats).toContain("Статы")
    expect(explanation.mainChar).toContain("Главный герой")
    expect(explanation.fair).toBe(getFairCardValue(card as any))
  })

  it("без сделок цена равна справедливой, сделок — подтягивают к медиане", () => {
    const card = makeMarketCard("rare")
    const fair = getFairCardValue(card as any)
    expect(computeSuggestedListingPrice(card as any, null, 0)).toBe(fair)

    const median = getFairCardValue(card as any) / 2
    const suggested = computeSuggestedListingPrice(card as any, median, 40)
    expect(suggested).toBeLessThan(fair)
    expect(suggested).toBeGreaterThanOrEqual(computeMinListingPrice(card as any, []))
  })
})

describe("совместимый слой (market-floor-improved)", () => {
  it("использует ту же формулу, что и основной модуль", () => {
    const card = makeMarketCard("legendary", { isMainCharacter: true })
    expect(computeMinImproved(card as any)).toBe(computeMinListingPrice(card as any, []))
    expect(computeMaxImproved(card as any)).toBe(computeMaxListingPrice(card as any, []))
  })

  it("getPriceRange отдаёт полный набор цен для UI", () => {
    const card = makeMarketCard("epic")
    const range = getPriceRange(card as any)
    expect(range.min).toBeLessThanOrEqual(range.suggested)
    expect(range.suggested).toBeLessThanOrEqual(range.max)
    expect(range.instantSell).toBeLessThanOrEqual(range.fair)
  })

  it("validatePrice отклоняет цены вне границ", () => {
    const card = makeMarketCard("epic")
    const min = computeMinImproved(card as any)
    const max = computeMaxImproved(card as any)
    expect(validatePrice(min - 1, card as any).isValid).toBe(false)
    expect(validatePrice(max + 1, card as any).isValid).toBe(false)
    expect(validatePrice(min, card as any).isValid).toBe(true)
    expect(validatePrice(max, card as any).isValid).toBe(true)
  })
})

describe("совместимость API", () => {
  it("порядок редкостей совпадает с игровым", () => {
    expect([...RARITY_ORDER]).toEqual(ALL_RARITIES)
  })
})
