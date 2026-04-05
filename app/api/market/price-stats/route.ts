import { NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/app/api/market/_auth"
import type { Rarity } from "@/types/gacha"

interface PriceStats {
  rarity: Rarity
  count: number
  minPrice: number
  maxPrice: number
  avgPrice: number
  medianPrice: number
  priceRange: { min: number; max: number; avg: number }
}

interface MarketAnalysis {
  totalListings: number
  totalValue: number
  averagePrice: number
  priceByRarity: Record<Rarity, PriceStats>
  topCharacters: Array<{
    characterId: number
    characterName: string
    count: number
    avgPrice: number
  }>
  recentTrends: Array<{
    date: string
    avgPrice: number
    volume: number
  }>
}

export async function GET(request: Request) {
  const supabaseAdmin = getSupabaseAdmin()
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 })
  }

  try {
    // Получаем все текущие лоты
    const { data: listings, error } = await supabaseAdmin
      .from("market_listings")
      .select("*")
      .order("created_at", { ascending: false })

    if (error) {
      console.error("[market/price-stats GET]", error)
      return NextResponse.json({ error: "Failed to fetch listings" }, { status: 500 })
    }

    if (!listings || listings.length === 0) {
      return NextResponse.json({ 
        totalListings: 0,
        priceByRarity: {},
        topCharacters: [],
        recentTrends: []
      })
    }

    // Группируем по редкости
    const rarityGroups: Record<string, any[]> = {}
    const characterGroups: Record<number, any[]> = {}

    listings.forEach(listing => {
      const rarity = listing.rarity
      if (!rarityGroups[rarity]) rarityGroups[rarity] = []
      rarityGroups[rarity].push(listing)

      const charId = listing.character_id
      if (!characterGroups[charId]) characterGroups[charId] = []
      characterGroups[charId].push(listing)
    })

    // Вычисляем статистику по редкостям
    const priceByRarity: Record<Rarity, PriceStats> = {} as any
    const allRarities: Rarity[] = ["trash", "common", "uncommon", "rare", "super_rare", "epic", "mythic", "legendary", "ancient", "divine", "transcendent", "omnipotent"]

    allRarities.forEach(rarity => {
      const rarityListings = rarityGroups[rarity] || []
      const prices = rarityListings.map(l => l.price).sort((a, b) => a - b)
      
      if (prices.length > 0) {
        const minPrice = Math.min(...prices)
        const maxPrice = Math.max(...prices)
        const avgPrice = Math.round(prices.reduce((sum, p) => sum + p, 0) / prices.length)
        const medianPrice = prices[Math.floor(prices.length / 2)]

        priceByRarity[rarity] = {
          rarity,
          count: prices.length,
          minPrice,
          maxPrice,
          avgPrice,
          medianPrice,
          priceRange: { min: minPrice, max: maxPrice, avg: avgPrice }
        }
      } else {
        priceByRarity[rarity] = {
          rarity,
          count: 0,
          minPrice: 0,
          maxPrice: 0,
          avgPrice: 0,
          medianPrice: 0,
          priceRange: { min: 0, max: 0, avg: 0 }
        }
      }
    })

    // Топ персонажи
    const topCharacters = Object.entries(characterGroups)
      .map(([charId, listings]) => ({
        characterId: parseInt(charId),
        characterName: listings[0]?.name || 'Unknown',
        count: listings.length,
        avgPrice: Math.round(listings.reduce((sum, l) => sum + l.price, 0) / listings.length)
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    // Общая статистика
    const totalListings = listings.length
    const totalValue = listings.reduce((sum, l) => sum + l.price, 0)
    const averagePrice = Math.round(totalValue / totalListings)

    // Анализ ценовых диапазонов для каждой редкости
    const priceRanges: Record<Rarity, { min: number; max: number; avg: number }> = {} as any
    
    allRarities.forEach(rarity => {
      const stats = priceByRarity[rarity]
      if (stats.count > 0) {
        // Определяем разумные диапазоны на основе текущих данных
        const rangeMin = Math.max(50, Math.floor(stats.avgPrice * 0.5))
        const rangeMax = Math.ceil(stats.avgPrice * 2)
        priceRanges[rarity] = {
          min: rangeMin,
          max: rangeMax,
          avg: stats.avgPrice
        }
      } else {
        // Базовые значения на основе dismantle value
        const baseValue = getDismantleValue(rarity) * 10
        priceRanges[rarity] = {
          min: Math.max(50, baseValue),
          max: baseValue * 3,
          avg: baseValue
        }
      }
    })

    const analysis: MarketAnalysis = {
      totalListings,
      totalValue,
      averagePrice,
      priceByRarity,
      topCharacters,
      recentTrends: [] // TODO: Implement historical data
    }

    return NextResponse.json({
      ...analysis,
      priceRanges,
      recommendations: {
        simplifyFormula: true,
        removeCollectionBonus: true,
        adjustStatMultiplier: 0.3,
        baseMultiplier: 8
      }
    })

  } catch (error) {
    console.error("[market/price-stats] Unexpected error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// Вспомогательная функция для получения dismantle value
function getDismantleValue(rarity: Rarity): number {
  const values: Record<Rarity, number> = {
    trash: 5, common: 10, uncommon: 20, rare: 40, super_rare: 80, epic: 150,
    mythic: 300, legendary: 500, ancient: 800, divine: 1200, transcendent: 2000, omnipotent: 5000
  }
  return values[rarity] || 5
}
