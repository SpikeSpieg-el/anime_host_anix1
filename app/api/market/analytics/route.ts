import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const rarity = searchParams.get('rarity')
    const frameModifier = searchParams.get('frameModifier')
    const coatingModifier = searchParams.get('coatingModifier')
    const days = parseInt(searchParams.get('days') || '7')

    // Получаем текущие лоты (предложение)
    let listingsQuery = supabase
      .from('market_listings')
      .select('rarity, frame_modifier, coating_modifier, price, stats_hp, stats_atk, stats_def, stats_spd, stats_luck')

    if (rarity) {
      listingsQuery = listingsQuery.eq('rarity', rarity)
    }
    if (frameModifier) {
      listingsQuery = listingsQuery.eq('frame_modifier', frameModifier)
    }
    if (coatingModifier) {
      listingsQuery = listingsQuery.eq('coating_modifier', coatingModifier)
    }

    const { data: listings, error: listingsError } = await listingsQuery

    if (listingsError) throw listingsError

    // Получаем продажи за период (спрос)
    const dateThreshold = new Date()
    dateThreshold.setDate(dateThreshold.getDate() - days)

    let salesQuery = supabase
      .from('market_sales_history')
      .select('rarity, frame_modifier, coating_modifier, price, stats_hp, stats_atk, stats_def, stats_spd, stats_luck, sold_at')
      .gte('sold_at', dateThreshold.toISOString())

    if (rarity) {
      salesQuery = salesQuery.eq('rarity', rarity)
    }
    if (frameModifier) {
      salesQuery = salesQuery.eq('frame_modifier', frameModifier)
    }
    if (coatingModifier) {
      salesQuery = salesQuery.eq('coating_modifier', coatingModifier)
    }

    const { data: sales, error: salesError } = await salesQuery

    if (salesError) throw salesError

    // Анализируем данные по редкости
    const raritySupply: Record<string, number> = {}
    const rarityDemand: Record<string, number> = {}
    const rarityAvgPrice: Record<string, number> = {}

    listings?.forEach((l: any) => {
      raritySupply[l.rarity] = (raritySupply[l.rarity] || 0) + 1
    })

    sales?.forEach((s: any) => {
      rarityDemand[s.rarity] = (rarityDemand[s.rarity] || 0) + 1
      if (!rarityAvgPrice[s.rarity]) {
        rarityAvgPrice[s.rarity] = 0
      }
      rarityAvgPrice[s.rarity] = (rarityAvgPrice[s.rarity] + s.price) / (rarityDemand[s.rarity])
    })

    // Анализируем данные по модификаторам
    const frameSupply: Record<string, number> = {}
    const frameDemand: Record<string, number> = {}
    const coatingSupply: Record<string, number> = {}
    const coatingDemand: Record<string, number> = {}

    listings?.forEach((l: any) => {
      if (l.frame_modifier) {
        frameSupply[l.frame_modifier] = (frameSupply[l.frame_modifier] || 0) + 1
      }
      if (l.coating_modifier) {
        coatingSupply[l.coating_modifier] = (coatingSupply[l.coating_modifier] || 0) + 1
      }
    })

    sales?.forEach((s: any) => {
      if (s.frame_modifier) {
        frameDemand[s.frame_modifier] = (frameDemand[s.frame_modifier] || 0) + 1
      }
      if (s.coating_modifier) {
        coatingDemand[s.coating_modifier] = (coatingDemand[s.coating_modifier] || 0) + 1
      }
    })

    // Рассчитываем индекс спроса/предложения для каждого параметра
    const calculateRatio = (demand: number, supply: number) => {
      if (supply === 0) return demand > 0 ? 10 : 0 // Если нет предложения, но есть спрос - высокий спрос
      return demand / supply
    }

    const rarityRatios: Record<string, number> = {}
    Object.keys(raritySupply).forEach(r => {
      rarityRatios[r] = calculateRatio(rarityDemand[r] || 0, raritySupply[r])
    })

    const frameRatios: Record<string, number> = {}
    Object.keys(frameSupply).forEach(f => {
      frameRatios[f] = calculateRatio(frameDemand[f] || 0, frameSupply[f])
    })

    const coatingRatios: Record<string, number> = {}
    Object.keys(coatingSupply).forEach(c => {
      coatingRatios[c] = calculateRatio(coatingDemand[c] || 0, coatingSupply[c])
    })

    return NextResponse.json({
      supply: {
        total: listings?.length || 0,
        byRarity: raritySupply,
        byFrameModifier: frameSupply,
        byCoatingModifier: coatingSupply
      },
      demand: {
        total: sales?.length || 0,
        byRarity: rarityDemand,
        byFrameModifier: frameDemand,
        byCoatingModifier: coatingDemand
      },
      ratios: {
        byRarity: rarityRatios,
        byFrameModifier: frameRatios,
        byCoatingModifier: coatingRatios
      },
      avgPrice: rarityAvgPrice,
      period: `${days} дней`
    })

  } catch (error) {
    console.error('[market/analytics GET]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
