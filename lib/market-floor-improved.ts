// lib/market-floor-improved.ts
//
// Совместимый слой над единой экономикой (lib/economy.ts + lib/market-floor.ts).
//
// Раньше здесь жила ВТОРАЯ копия формулы цены, которая со временем разошлась
// с market-floor.ts (разные коэффициенты и разные потолки). Две формулы на одну
// и ту же карту = два разных «правильных» цены в UI и в валидации API.
// Теперь обе точки входа смотрят в один источник истины.

import {
  computeMaxListingPrice,
  computeMinListingPrice,
  computeSuggestedListingPrice,
  explainCardValue,
  getFairCardValue,
  getInstantSellPrice,
  getNetProceeds,
  RARITY_ORDER,
  type CardForMarketFloor,
} from "./market-floor"

export {
  computeMinListingPrice,
  computeMaxListingPrice,
  computeSuggestedListingPrice,
  explainCardValue,
  getFairCardValue,
  getInstantSellPrice,
  getNetProceeds,
  RARITY_ORDER,
  type CardForMarketFloor,
}

/** Рекомендуемая цена с учётом медианы реальных продаж. */
export async function computeSuggestedPrice(
  card: CardForMarketFloor,
  marketMedian?: number | null,
  sampleCount = 0
): Promise<number> {
  return computeSuggestedListingPrice(card, marketMedian, sampleCount)
}

/** Диапазон цен для карты. */
export function getPriceRange(card: CardForMarketFloor, marketMedian?: number | null, sampleCount = 0): {
  min: number
  suggested: number
  max: number
  instantSell: number
  fair: number
} {
  return {
    min: computeMinListingPrice(card),
    suggested: computeSuggestedListingPrice(card, marketMedian, sampleCount),
    max: computeMaxListingPrice(card),
    instantSell: getInstantSellPrice(card),
    fair: getFairCardValue(card),
  }
}

/** Валидация цены лота по новым границам. */
export function validatePrice(price: number, card: CardForMarketFloor): {
  isValid: boolean
  error?: string
  minPrice: number
  maxPrice: number
} {
  const minPrice = computeMinListingPrice(card)
  const maxPrice = computeMaxListingPrice(card)

  if (price < minPrice) {
    return { isValid: false, error: `Цена ниже минимума (${minPrice.toLocaleString("ru-RU")} монет)`, minPrice, maxPrice }
  }
  if (price > maxPrice) {
    return { isValid: false, error: `Цена выше максимума (${maxPrice.toLocaleString("ru-RU")} монет)`, minPrice, maxPrice }
  }
  return { isValid: true, minPrice, maxPrice }
}
