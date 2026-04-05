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

const SPIN_COST = 50

/**
 * УПРОЩЕННАЯ формула минимальной цены:
 * - Базовая цена от dismantle value
 * - Умеренный бонус за статы
 * - Бонус за редкость
 * - Бонус за главного персонажа
 * - УБРАЛИ коллекционный бонус для равных условий
 */
export function computeMinListingPrice(card: CardForMarketFloor, sellerCollectionOther: CardForMarketFloor[] = []): number {
  const dismantle = getDismantleValue(card.rarity)
  const statSum = card.stats.hp + card.stats.atk + card.stats.def + card.stats.spd + card.stats.luck
  const rarityIdx = RARITY_ORDER.indexOf(card.rarity as (typeof RARITY_ORDER)[number])
  const safeIdx = rarityIdx < 0 ? 0 : rarityIdx

  // Упрощенная формула
  const base = dismantle * 8  // Увеличили базу для более стабильных цен
  const statsBonus = Math.floor(statSum * 0.3)  // Сократили бонус за статы с 0.65 до 0.3
  const rarityBonus = safeIdx * 25  // Уменьшили бонус за редкость с 35 до 25
  const mainCharBonus = card.isMainCharacter ? dismantle : 0  // Упростили бонус главного персонажа

  const totalPrice = base + statsBonus + rarityBonus + mainCharBonus
  
  return Math.max(SPIN_COST, totalPrice)
}

/**
 * НОВАЯ формула рекомендуемой цены на основе рыночных данных
 */
export async function computeSuggestedPrice(card: CardForMarketFloor, marketData?: any): Promise<number> {
  const minPrice = computeMinListingPrice(card)
  
  try {
    // Получаем рыночные данные
    const response = await fetch('/api/market/price-stats')
    const stats = await response.json()
    
    if (stats.priceByRarity && stats.priceByRarity[card.rarity]) {
      const rarityStats = stats.priceByRarity[card.rarity]
      
      // Если есть данные по этой редкости, используем среднюю цену
      if (rarityStats.count > 0) {
        const marketAvg = rarityStats.avgPrice
        
        // Рекомендуемая цена между минимумом и среднерыночной
        const suggested = Math.max(minPrice, Math.floor((minPrice + marketAvg) / 2))
        
        // Добавляем небольшой бонус за хорошие статы
        const statSum = card.stats.hp + card.stats.atk + card.stats.def + card.stats.spd + card.stats.luck
        const statBonus = Math.floor(statSum * 0.1)
        
        return suggested + statBonus
      }
    }
  } catch (error) {
    console.warn('Failed to fetch market data for suggested price:', error)
  }
  
  // Fallback: просто минимум + 20%
  return Math.floor(minPrice * 1.2)
}

/**
 * Обновленная формула максимальной цены
 */
export function computeMaxListingPrice(card: CardForMarketFloor, sellerCollectionOther: CardForMarketFloor[] = []): number {
  const min = computeMinListingPrice(card, sellerCollectionOther)
  
  // Уменьшили множитель с 97 до 50 для более разумных потолков
  const MAX_PRICE_MULTIPLIER = 50
  const ABSOLUTE_LISTING_PRICE_CAP = 5_000_000  // Уменьшили с 15M до 5M
  
  const fromMin = Math.floor(min * MAX_PRICE_MULTIPLIER)
  return Math.max(min, Math.min(fromMin, ABSOLUTE_LISTING_PRICE_CAP))
}

/**
 * Получить рекомендуемый диапазон цен для карты
 */
export async function getPriceRange(card: CardForMarketFloor): Promise<{
  min: number
  suggested: number
  max: number
  marketAvg?: number
}> {
  const min = computeMinListingPrice(card)
  const suggested = await computeSuggestedPrice(card)
  const max = computeMaxListingPrice(card)
  
  // Попробуем получить среднюю рыночную цену
  let marketAvg
  try {
    const response = await fetch('/api/market/price-stats')
    const stats = await response.json()
    if (stats.priceByRarity && stats.priceByRarity[card.rarity]) {
      marketAvg = stats.priceByRarity[card.rarity].avgPrice
    }
  } catch (error) {
    // Игнорируем ошибку
  }
  
  return { min, suggested, max, marketAvg }
}

/**
 * Валидация цены - проверяет, находится ли цена в разумных пределах
 */
export function validatePrice(
  price: number, 
  card: CardForMarketFloor, 
  sellerCollectionOther: CardForMarketFloor[] = []
): {
  isValid: boolean
  error?: string
  minPrice: number
  maxPrice: number
  suggestedPrice?: number
} {
  const minPrice = computeMinListingPrice(card, sellerCollectionOther)
  const maxPrice = computeMaxListingPrice(card, sellerCollectionOther)
  
  if (price < minPrice) {
    return {
      isValid: false,
      error: `Цена ниже минимума (${minPrice.toLocaleString()} монет)`,
      minPrice,
      maxPrice
    }
  }
  
  if (price > maxPrice) {
    return {
      isValid: false,
      error: `Цена выше максимума (${maxPrice.toLocaleString()} монет)`,
      minPrice,
      maxPrice
    }
  }
  
  return {
    isValid: true,
    minPrice,
    maxPrice
  }
}

// Экспортируем для совместимости
export { RARITY_ORDER }
