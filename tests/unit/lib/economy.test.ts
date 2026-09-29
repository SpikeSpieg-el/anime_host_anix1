import { describe, expect, it } from "vitest"
import {
  ABSOLUTE_LISTING_PRICE_CAP,
  COLLECTION_MILESTONES,
  DAILY_REWARDS,
  DAILY_STREAK_LENGTH,
  EXPECTED_CARD_VALUE_PER_SPIN,
  EXPECTED_ROI_PER_SPIN,
  INSTANT_SELL_RATE,
  LISTING_MAX_RATE,
  LISTING_MIN_RATE,
  MARKET_TAX_RATE,
  MAX_HEALTHY_ROI,
  PVE_DAILY_COIN_CAP,
  RARITY_FAIR_VALUE,
  SPIN_COST,
  STARTING_COINS,
  getDailyReward,
  getFairCardValue,
  getInstantSellPrice,
  getMaxListingPrice,
  getMilestoneProgress,
  getMinListingPrice,
  getNetProceeds,
  getNextMilestone,
  getSuggestedListingPrice,
  type EconomyCard,
} from "@/lib/economy"
import { ALL_RARITIES } from "../../fixtures/cards"

// Распределение редкостей, посчитанное Монте-Карло по реальной формуле
// calculateRarityWithBoost (см. scripts/economy-report.mjs). Используется,
// чтобы проверить, что «гача сама по себе», а не «гача — печатный станок».
const RARITY_DISTRIBUTION: Record<string, number> = {
  trash: 0.2999,
  common: 0.1815,
  uncommon: 0.0924,
  rare: 0.2007,
  super_rare: 0.126,
  epic: 0.0619,
  mythic: 0.0314,
  legendary: 0.0053,
  ancient: 0.0007,
  divine: 0.0001,
}

const MAIN_CHARACTER_SHARE = 0.1
// Средняя сумма статов по редкости — по таблице generateStats в app/gacha/actions.ts
// (среднее базы × 5 статов × ~0.95 на вероятность нулевого стата).
const AVG_STAT_SUM: Record<string, number> = {
  trash: 71,
  common: 104,
  uncommon: 138,
  rare: 171,
  super_rare: 204,
  epic: 237,
  mythic: 271,
  legendary: 304,
  ancient: 342,
  divine: 390,
  transcendent: 423,
  omnipotent: 451,
}

function card(overrides: Partial<EconomyCard> = {}): EconomyCard {
  return {
    rarity: "rare",
    stats: { hp: 40, atk: 30, def: 25, spd: 20, luck: 15 },
    isMainCharacter: false,
    ...overrides,
  }
}

function expectedValuePerSpin(): number {
  let ev = 0
  for (const [rarity, share] of Object.entries(RARITY_DISTRIBUTION)) {
    const sum = AVG_STAT_SUM[rarity] ?? 150
    const stats = { hp: sum / 5, atk: sum / 5, def: sum / 5, spd: sum / 5, luck: sum / 5 }
    ev += share * getFairCardValue({ rarity: rarity as any, stats, isMainCharacter: false })
  }
  // 10% круток выдают главного героя — это +25% к цене карты
  return ev * (1 + MAIN_CHARACTER_SHARE * 0.25)
}

describe("экономика: главный инвариант", () => {
  it("гача самодостаточна: EV крутки близко к цене крутки, но не выше 1.3x", () => {
    const ev = expectedValuePerSpin()
    const roi = ev / SPIN_COST

    expect(roi).toBeGreaterThan(0.9) // гача не должна быть убыточной
    expect(roi).toBeLessThanOrEqual(MAX_HEALTHY_ROI) // и не должна печатать монеты
  })

  it("заявленная константа EV совпадает с расчётной", () => {
    const ev = expectedValuePerSpin()
    expect(Math.abs(ev - EXPECTED_CARD_VALUE_PER_SPIN)).toBeLessThan(6)
    expect(EXPECTED_ROI_PER_SPIN).toBeCloseTo(EXPECTED_CARD_VALUE_PER_SPIN / SPIN_COST, 5)
  })

  it("старая формула давала ROI ×9 — новая не может вернуться к этому", () => {
    // Старый пол: разбор × 8 + статы × 0.3 + индекс × 25 ≈ 465 монет карточки
    const OLD_MIN_PRICE_FOR_RARE =
      40 * 8 + Math.floor(180 * 0.3) + 3 * 25
    expect(OLD_MIN_PRICE_FOR_RARE / SPIN_COST).toBeGreaterThan(8)
    // Новая цена редкой карты в разы ниже старой
    expect(getFairCardValue(card({ rarity: "rare" })) * 4).toBeLessThan(OLD_MIN_PRICE_FOR_RARE)
  })
})

describe("экономика: цена карты", () => {
  it("справедливая цена растёт с редкостью", () => {
    const prices = ALL_RARITIES.map((rarity) => getFairCardValue(card({ rarity })))
    for (let i = 1; i < prices.length; i++) {
      expect(prices[i]).toBeGreaterThan(prices[i - 1])
    }
  })

  it("у каждой редкости есть заполненная таблица", () => {
    for (const rarity of ALL_RARITIES) {
      expect(RARITY_FAIR_VALUE[rarity]).toBeGreaterThan(0)
    }
  })

  it("статы и статус главного героя повышают цену", () => {
    const base = getFairCardValue(card())
    const betterStats = getFairCardValue(
      card({ stats: { hp: 80, atk: 70, def: 60, spd: 50, luck: 40 } })
    )
    const main = getFairCardValue(card({ isMainCharacter: true }))

    expect(betterStats).toBeGreaterThan(base)
    expect(main).toBeGreaterThan(base)
  })

  it("модификаторы добавляют цену, а пара — ещё и бонус", () => {
    const plain = getFairCardValue(card())
    const one = getFairCardValue(card({ frameModifier: "gold" }))
    const two = getFairCardValue(card({ frameModifier: "gold", coatingModifier: "holo" }))

    expect(one).toBeGreaterThan(plain)
    expect(two).toBeGreaterThan(one)
  })
})

describe("экономика: границы рынка", () => {
  it("min ≤ fair ≤ max и мгновенная продажа ниже лота", () => {
    for (const rarity of ALL_RARITIES) {
      const c = card({ rarity })
      const min = getMinListingPrice(c)
      const fair = getFairCardValue(c)
      const max = getMaxListingPrice(c)
      const instant = getInstantSellPrice(c)

      expect(min).toBeLessThanOrEqual(fair)
      expect(fair).toBeLessThanOrEqual(max)
      expect(instant).toBeLessThanOrEqual(fair)
      expect(min).toBeGreaterThan(0)
    }
  })

  it("соотношения границ соответствуют настройкам экономики", () => {
    const c = card({ rarity: "epic" })
    const fair = getFairCardValue(c)
    expect(getMinListingPrice(c)).toBe(Math.round(fair * LISTING_MIN_RATE))
    expect(getMaxListingPrice(c)).toBe(Math.round(fair * LISTING_MAX_RATE))
    expect(getInstantSellPrice(c)).toBe(Math.round(fair * INSTANT_SELL_RATE))
  })

  it("потолок цены не даёт выставить астрономический лот", () => {
    const max = getMaxListingPrice(
      card({ rarity: "omnipotent", stats: { hp: 100, atk: 100, def: 100, spd: 100, luck: 100 } })
    )
    expect(max).toBeLessThanOrEqual(ABSOLUTE_LISTING_PRICE_CAP)
  })

  it("комиссия маркета забирает 8% и ни копейки продавцу не добавляет", () => {
    expect(MARKET_TAX_RATE).toBe(0.08)
    expect(getNetProceeds(100)).toBe(92)
    expect(getNetProceeds(0)).toBe(0)
  })
})

describe("экономика: ценообразование по реальным продажам", () => {
  it("без продаж цена равна справедливой", () => {
    const c = card({ rarity: "super_rare" })
    expect(getSuggestedListingPrice(c, null, 0)).toBe(getFairCardValue(c))
    expect(getSuggestedListingPrice(c, 10, 1)).toBe(getFairCardValue(c)) // выборки мало
  })

  it("медиана продаж тянет цену вниз и удерживает в границах лота", () => {
    const c = card({ rarity: "super_rare" })
    const min = getMinListingPrice(c)
    const max = getMaxListingPrice(c)

    const cheap = getSuggestedListingPrice(c, 20, 20)
    const expensive = getSuggestedListingPrice(c, 5000, 20)

    expect(cheap).toBeGreaterThanOrEqual(min)
    expect(cheap).toBeLessThan(getFairCardValue(c))
    expect(expensive).toBeGreaterThan(getFairCardValue(c))
    expect(expensive).toBeLessThanOrEqual(max)
  })
})

describe("экономика: воронка возврата", () => {
  it("стартовый бонус — это 40 круток, а не 200", () => {
    expect(STARTING_COINS / SPIN_COST).toBe(40)
    expect(STARTING_COINS).toBeLessThan(10_000)
  })

  it("ежедневная серия длится 7 дней и растёт", () => {
    expect(DAILY_STREAK_LENGTH).toBe(7)
    for (let day = 1; day <= 7; day++) {
      expect(getDailyReward(day).day).toBe(day)
      if (day > 1) {
        expect(getDailyReward(day).coins).toBeGreaterThan(getDailyReward(day - 1).coins)
      }
    }
    // 8-й день — цикл начинается заново
    expect(getDailyReward(8).day).toBe(1)
    expect(DAILY_REWARDS.reduce((sum, r) => sum + r.coins, 0)).toBe(1050)
  })

  it("вехи коллекции дают цель после первых 10 карт", () => {
    expect(getNextMilestone(0)?.cards).toBe(10)
    expect(getNextMilestone(10)?.cards).toBe(25)
    expect(getNextMilestone(250)).toBeNull()

    const progress = getMilestoneProgress(15)
    expect(progress.next?.cards).toBe(25)
    expect(progress.remaining).toBe(10)
    expect(progress.progress).toBeGreaterThan(0)
    expect(progress.progress).toBeLessThanOrEqual(1)
  })

  it("сумма вех не ломает экономику (≈10% дохода с 200 карт)", () => {
    const total = COLLECTION_MILESTONES.reduce((sum, m) => sum + m.coins, 0)
    // 200 карт ≈ 200 круток ≈ 12 000 монет дропа; вехи не должны давать больше 25%
    expect(total).toBeLessThan(200 * EXPECTED_CARD_VALUE_PER_SPIN * 0.25)
  })

  it("потолок дневного PvE-дохода ограничен", () => {
    expect(PVE_DAILY_COIN_CAP).toBeGreaterThan(0)
    // Даже при полном потолке PvE не заменяет гачу
    expect(PVE_DAILY_COIN_CAP).toBeLessThan(STARTING_COINS)
  })
})
