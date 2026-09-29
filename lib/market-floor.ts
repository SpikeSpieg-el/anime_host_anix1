// lib/market-floor.ts
//
// Границы цены лота.
//
// Формула привязана к справедливой стоимости карты (lib/economy.ts), а та, в свою
// очередь, — к цене крутки. Старый вариант (разбор × 8 + статы × 0.3 + индекс × 25)
// давал EV карты ≈ 465 монет при цене крутки 50, то есть гача→маркет приносил
// ×9.3 и делал PvE/PvP бессмысленными.
//
// Второй аргумент (коллекция продавца) оставлен для совместимости сигнатуры,
// но намеренно НЕ влияет на цену: иначе монеты стягиваются к «богатым» коллекциям.

import {
  getFairCardValue,
  getInstantSellPrice,
  getMaxListingPrice as computeMaxFromEconomy,
  getMinListingPrice as computeMinFromEconomy,
  getSuggestedListingPrice,
  getNetProceeds,
  getCardValueBreakdown,
  RARITY_ORDER as ECONOMY_RARITY_ORDER,
  type EconomyCard,
} from "./economy"

export const RARITY_ORDER = ECONOMY_RARITY_ORDER

/** Минимум полей карты для расчёта границ цены (совместимо с Card из гачи). */
export type CardForMarketFloor = EconomyCard

/**
 * Минимальная цена лота: 60% от справедливой стоимости.
 * Ниже нельзя — это защита от слива карт «в ноль» и от гонки на дно цен.
 */
export function computeMinListingPrice(
  card: CardForMarketFloor,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _sellerCollectionOther: CardForMarketFloor[] = []
): number {
  return computeMinFromEconomy(card)
}

/**
 * Максимальная цена лота: 250% от справедливой стоимости.
 * Потолок нужен, чтобы одна удачная карта не улетала в астрономические числа
 * и не ломала рынок для остальных.
 */
export function computeMaxListingPrice(
  card: CardForMarketFloor,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _sellerCollectionOther: CardForMarketFloor[] = []
): number {
  return computeMaxFromEconomy(card)
}

/** Справедливая (100%) цена карты. */
export { getFairCardValue, getInstantSellPrice, getNetProceeds, getSuggestedListingPrice }

/**
 * Рекомендуемая цена лота: реальная медиана последних продаж,
 * смешанная со справедливой ценой (вес зависит от числа сделок).
 */
export function computeSuggestedListingPrice(
  card: CardForMarketFloor,
  medianPrice?: number | null,
  sampleCount = 0
): number {
  return getSuggestedListingPrice(card, medianPrice, sampleCount)
}

/**
 * Человекочитаемое объяснение цены — показывается в окне продажи,
 * чтобы игрок понимал, из чего складывается стоимость карты.
 */
export function explainCardValue(card: CardForMarketFloor): {
  base: string
  stats: string
  mainChar: string | null
  modifiers: string | null
  fair: number
} {
  const breakdown = getCardValueBreakdown(card)
  return {
    base: `База редкости: ${breakdown.base}`,
    stats:
      breakdown.statsBonus > 0
        ? `Статы (${breakdown.statSum}): +${breakdown.statsBonus}`
        : "Статы: без бонуса",
    mainChar: breakdown.mainBonus > 0 ? `Главный герой: +${breakdown.mainBonus}` : null,
    modifiers: breakdown.modifierBonus > 0 ? `Рамка/покрытие: +${breakdown.modifierBonus}` : null,
    fair: breakdown.fair,
  }
}
