import { getDismantleValue, type Rarity } from "@/types/gacha"

/** Минимум полей карты для расчёта пола цены (совместимо с Card из гачи). */
export type CardForMarketFloor = {
  rarity: Rarity
  stats: { hp: number; atk: number; def: number; spd: number; luck: number }
  isMainCharacter?: boolean
}

const RARITY_ORDER = [
  "trash", "common", "uncommon", "rare", "super_rare", "epic",
  "mythic", "legendary", "ancient", "divine", "transcendent", "omnipotent",
] as const

/**
 * Доля «общего скора» коллекции без учёта выставляемой карты (как на странице гачи).
 */
function collectionOverallScore(cards: CardForMarketFloor[]): number {
  if (cards.length === 0) return 0

  const rarityScoreByRarity: Record<Rarity, number> = {
    trash: 0, common: 10, uncommon: 20, rare: 32, super_rare: 45, epic: 60,
    mythic: 72, legendary: 82, ancient: 90, divine: 95, transcendent: 98, omnipotent: 100,
  }

  let totalPower = 0
  const totalStats = { hp: 0, atk: 0, def: 0, spd: 0, luck: 0 }

  cards.forEach((card) => {
    totalPower += card.stats.hp + card.stats.atk + card.stats.def + card.stats.spd + card.stats.luck
    totalStats.hp += card.stats.hp
    totalStats.atk += card.stats.atk
    totalStats.def += card.stats.def
    totalStats.spd += card.stats.spd
    totalStats.luck += card.stats.luck
  })

  const n = cards.length
  const avgRarity = Math.round(
    cards.reduce((acc, c) => acc + (rarityScoreByRarity[c.rarity] ?? 0), 0) / n
  )
  const avgPower = totalPower / n
  const powerScore = Math.max(0, Math.min(Math.round((avgPower / 500) * 100), 100))
  return Math.round(avgRarity * 0.55 + powerScore * 0.45)
}

/**
 * Вычисляет множитель на основе количества высокоредких карт в коллекции.
 */
function computeRarityMultiplier(cards: CardForMarketFloor[]): number {
  const rarityCounts: Record<Rarity, number> = {
    trash: 0, common: 0, uncommon: 0, rare: 0, super_rare: 0, epic: 0,
    mythic: 0, legendary: 0, ancient: 0, divine: 0, transcendent: 0, omnipotent: 0,
  }

  cards.forEach(card => {
    rarityCounts[card.rarity]++
  })

  let multiplier = 1.0

  // Множители за каждые 50 карт определённой редкости
  multiplier += Math.floor(rarityCounts.omnipotent / 50) * 2.5
  multiplier += Math.floor(rarityCounts.transcendent / 50) * 2.0
  multiplier += Math.floor(rarityCounts.divine / 50) * 1.5
  multiplier += Math.floor(rarityCounts.ancient / 50) * 1.2
  multiplier += Math.floor(rarityCounts.legendary / 50) * 1.0
  multiplier += Math.floor(rarityCounts.mythic / 50) * 0.8
  multiplier += Math.floor(rarityCounts.epic / 50) * 0.5
  multiplier += Math.floor(rarityCounts.super_rare / 50) * 0.3
  multiplier += Math.floor(rarityCounts.rare / 50) * 0.2

  // Дополнительные множители за остатки (бонус за неполные 50)
  if (rarityCounts.omnipotent % 50 >= 25) multiplier += 1.2
  else if (rarityCounts.omnipotent % 50 >= 10) multiplier += 0.5

  if (rarityCounts.transcendent % 50 >= 25) multiplier += 1.0
  else if (rarityCounts.transcendent % 50 >= 10) multiplier += 0.4

  if (rarityCounts.divine % 50 >= 25) multiplier += 0.8
  else if (rarityCounts.divine % 50 >= 10) multiplier += 0.3

  if (rarityCounts.ancient % 50 >= 25) multiplier += 0.6
  else if (rarityCounts.ancient % 50 >= 10) multiplier += 0.25

  if (rarityCounts.legendary % 50 >= 25) multiplier += 0.5
  else if (rarityCounts.legendary % 50 >= 10) multiplier += 0.2

  if (rarityCounts.mythic % 50 >= 25) multiplier += 0.4
  else if (rarityCounts.mythic % 50 >= 10) multiplier += 0.15

  // Мусорные карты не дают множитель
  // Обычные и необычные не дают множитель

  return Math.max(1.0, multiplier)
}

const SPIN_COST = 50

/**
 * УПРОЩЕННАЯ формула минимальной цены:
 * - Базовая цена от dismantle value
 * - Умеренный бонус за статы  
 * - Бонус за редкость
 * - Бонус за главного персонажа
 * - УБРАЛИ коллекционный бонус для равных условий
 */
export function computeMinListingPrice(card: CardForMarketFloor, sellerCollectionOther: CardForMarketFloor[]): number {
  const dismantle = getDismantleValue(card.rarity)
  const statSum =
    card.stats.hp + card.stats.atk + card.stats.def + card.stats.spd + card.stats.luck
  const rarityIdx = RARITY_ORDER.indexOf(card.rarity as (typeof RARITY_ORDER)[number])
  const safeIdx = rarityIdx < 0 ? 0 : rarityIdx

  // Упрощенная формула - убрали коллекционный бонус
  const base = dismantle * 8  // Увеличили базу для стабильности
  const statsBonus = Math.floor(statSum * 0.3)  // Сократили с 0.65 до 0.3
  const rarityBonus = safeIdx * 25  // Уменьшили с 35 до 25
  const mainCharBonus = card.isMainCharacter ? dismantle : 0  // Упростили

  return Math.max(SPIN_COST, base + statsBonus + rarityBonus + mainCharBonus)
}

/** Уменьшенные множители для более разумных потолков цен */
const MAX_PRICE_MULTIPLIER = 50
const ABSOLUTE_LISTING_PRICE_CAP = 5_000_000

/**
 * Максимальная цена лота: уменьшили множитель и абсолютный потолок
 */
export function computeMaxListingPrice(card: CardForMarketFloor, sellerCollectionOther: CardForMarketFloor[]): number {
  const min = computeMinListingPrice(card, sellerCollectionOther)
  const fromMin = Math.floor(min * MAX_PRICE_MULTIPLIER)
  return Math.max(min, Math.min(fromMin, ABSOLUTE_LISTING_PRICE_CAP))
}

export { RARITY_ORDER }
