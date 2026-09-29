import { NextResponse } from "next/server"
import { getMarketAuth, getSupabaseAdmin } from "@/app/api/market/_auth"
import {
  computeMaxListingPrice,
  computeMinListingPrice,
  computeSuggestedListingPrice,
  explainCardValue,
  getFairCardValue,
  getInstantSellPrice,
  getNetProceeds,
  type CardForMarketFloor,
} from "@/lib/market-floor"
import { MARKET_TAX_RATE, PRICE_DISCOVERY_WINDOW_DAYS } from "@/lib/economy"

type SalesRow = { price: number }

function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? Math.round((sorted[mid - 1] + sorted[mid]) / 2) : sorted[mid]
}

/**
 * Рекомендуемая цена лота.
 *
 * Цену определяет НЕ формула, а реальные продажи такой же редкости за последние
 * 14 дней: медиана сделок смешивается со справедливой ценой, и чем больше
 * сделок — тем сильнее рынок тянет цену вниз/вверх. Формула отвечает только за
 * границы (min/max), чтобы никто не выставил лот за 1 монету или за миллион.
 */
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

    const economyCard: CardForMarketFloor = {
      rarity: card.rarity,
      stats: card.stats,
      isMainCharacter: card.isMainCharacter,
      frameModifier: card.frameModifier,
      coatingModifier: card.coatingModifier,
    }

    const minPrice = computeMinListingPrice(economyCard)
    const maxPrice = computeMaxListingPrice(economyCard)
    const fairPrice = getFairCardValue(economyCard)
    const instantSellPrice = getInstantSellPrice(economyCard)

    // Медиана реальных продаж этой редкости за окно PRICE_DISCOVERY_WINDOW_DAYS
    let medianPrice: number | null = null
    let sampleCount = 0
    const supabaseAdmin = getSupabaseAdmin()
    if (supabaseAdmin) {
      const since = new Date(Date.now() - PRICE_DISCOVERY_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString()
      const { data } = await supabaseAdmin
        .from("market_sales_history")
        .select("price")
        .eq("rarity", card.rarity)
        .gte("sold_at", since)
        .limit(200)

      const prices = ((data || []) as SalesRow[]).map((row) => Number(row.price)).filter((p) => Number.isFinite(p) && p > 0)
      sampleCount = prices.length
      if (sampleCount > 0) {
        medianPrice = median(prices)
      }
    }

    const suggestedPrice = computeSuggestedListingPrice(economyCard, medianPrice, sampleCount)

    return NextResponse.json({
      minPrice,
      maxPrice,
      suggestedPrice,
      fairPrice,
      instantSellPrice,
      instantSellNet: getNetProceeds(instantSellPrice),
      marketTaxRate: MARKET_TAX_RATE,
      netAtSuggested: getNetProceeds(suggestedPrice),
      marketData: {
        medianPrice,
        sampleCount,
        windowDays: PRICE_DISCOVERY_WINDOW_DAYS,
      },
      priceExplanation: explainCardValue(economyCard),
    })
  } catch (error) {
    console.error("[market/suggested-price POST]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
