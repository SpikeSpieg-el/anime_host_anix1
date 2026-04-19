import { NextResponse } from "next/server"
import { getMarketAuth } from "@/app/api/market/_auth"
import { computeMinListingPrice, computeMaxListingPrice } from "@/lib/market-floor"
import type { Rarity } from "@/types/gacha"
import { getModifiersCost, applyModifierStats } from "@/components/card-modifiers"

export async function POST(request: Request) {
  const auth = await getMarketAuth(request)
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { card } = body

    if (!card || !card.rarity || !card.stats) {
      return NextResponse.json({ error: "Invalid card data" }, { status: 400 })
    }

    // Применяем бонусы модификаторов к статам
    const modifiedStats = applyModifierStats(
      card.stats,
      card.frameModifier,
      card.coatingModifier
    )

    // Вычисляем стоимость модификаторов
    const baseModifierCost = getModifiersCost(card.frameModifier, card.coatingModifier)
    let modifierCost = baseModifierCost
    let modifierBonus = 0
    
    // Бонус за наличие обоих модификаторов (+30% к стоимости модификаторов)
    if (card.frameModifier && card.coatingModifier) {
      modifierBonus = Math.floor(baseModifierCost * 0.3)
      modifierCost = baseModifierCost + modifierBonus
    }

    // Создаем объект карты с модифицированными статами для расчета цен
    const cardWithModifiers = {
      ...card,
      stats: modifiedStats
    }

    // Вычисляем базовые цены
    const minPrice = computeMinListingPrice(cardWithModifiers, [])
    const maxPrice = computeMaxListingPrice(cardWithModifiers, [])

    // Получаем рыночные данные для рекомендованной цены
    let suggestedPrice = minPrice
    let marketData = null

    try {
      const marketResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:80'}/api/market/price-stats`)
      if (marketResponse.ok) {
        marketData = await marketResponse.json()
        
        if (marketData.priceByRarity && marketData.priceByRarity[card.rarity]) {
          const rarityStats = marketData.priceByRarity[card.rarity]
          
          if (rarityStats.count > 0) {
            // Рекомендуемая цена на основе рыночной средней с учетом минимального порога
            const marketAvg = rarityStats.avgPrice
            
            // Для низких редкостей учитываем рыночную цену больше
            const rarityWeight = card.rarity === 'common' || card.rarity === 'uncommon' ? 0.8 : 0.6
            
            // Рекомендуемая цена ближе к рыночной для низких редкостей
            suggestedPrice = Math.max(minPrice, Math.floor(marketAvg * rarityWeight))
            
            // Добавляем бонус за хорошие статы (с учетом модификаторов)
            const statSum = modifiedStats.hp + modifiedStats.atk + modifiedStats.def + modifiedStats.spd + modifiedStats.luck
            const statBonus = Math.floor(statSum * 0.1)
            suggestedPrice += statBonus
          }
        }
      }
    } catch (error) {
      console.warn('Failed to fetch market data:', error)
      // Используем улучшенный fallback на основе редкости
      const rarityMultipliers: Record<Rarity, number> = {
        trash: 1.5,
        common: 2.0, 
        uncommon: 2.0,
        rare: 1.8,
        super_rare: 1.6,
        epic: 1.4,
        mythic: 1.3,
        legendary: 1.2,
        ancient: 1.2,
        divine: 1.1,
        transcendent: 1.1,
        omnipotent: 1.0
      }
      
      const multiplier = rarityMultipliers[card.rarity as Rarity] || 1.5
      suggestedPrice = Math.floor(minPrice * multiplier)
    }

    // Добавляем стоимость модификаторов к рекомендованной цене
    suggestedPrice += modifierCost

    const rarityArray = ["trash","common","uncommon","rare","super_rare","epic","mythic","legendary","ancient","divine","transcendent","omnipotent"]
    const statSum = modifiedStats.hp + modifiedStats.atk + modifiedStats.def + modifiedStats.spd + modifiedStats.luck

    return NextResponse.json({
      minPrice,
      maxPrice,
      suggestedPrice,
      marketData: {
        averagePrice: marketData?.priceByRarity?.[card.rarity]?.avgPrice,
        totalListings: marketData?.priceByRarity?.[card.rarity]?.count || 0
      },
      priceExplanation: {
        base: `База: ${getDismantleValue(card.rarity as Rarity)} × 8`,
        stats: `Статы: ${statSum} × 0.1`,
        rarity: `Редкость: ${rarityArray.indexOf(card.rarity)} × 25`,
        mainChar: card.isMainCharacter ? `Главный герой: +${getDismantleValue(card.rarity as Rarity)}` : null,
        modifiers: modifierCost > 0 ? `Модификаторы: +${modifierCost}${modifierBonus > 0 ? ` (+${modifierBonus})` : ''}` : null
      }
    })

  } catch (error) {
    console.error("[market/suggested-price POST]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

function getDismantleValue(rarity: Rarity): number {
  const values: Record<Rarity, number> = {
    trash: 5, common: 10, uncommon: 20, rare: 40, super_rare: 80, epic: 150,
    mythic: 300, legendary: 500, ancient: 800, divine: 1200, transcendent: 2000, omnipotent: 5000
  }
  return values[rarity] || 5
}
