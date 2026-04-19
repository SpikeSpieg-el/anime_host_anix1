import { NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/app/api/market/_auth"
import type { Rarity } from "@/types/gacha"

export async function GET(request: Request) {
  const supabaseAdmin = getSupabaseAdmin()
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 })
  }

  try {
    const url = new URL(request.url)
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "50", 10) || 50, 200)
    const days = parseInt(url.searchParams.get("days") || "30", 10)

    const dateThreshold = new Date()
    dateThreshold.setDate(dateThreshold.getDate() - days)

    const { data: sales, error } = await supabaseAdmin
      .from("market_sales_history")
      .select("*")
      .gte("sold_at", dateThreshold.toISOString())
      .order("sold_at", { ascending: false })
      .limit(limit)

    if (error) {
      console.error("[market/sales-history GET]", error)
      return NextResponse.json({ error: "Failed to fetch sales history" }, { status: 500 })
    }

    const formattedSales = (sales || []).map((row) => ({
      saleId: row.id,
      listingId: row.listing_id,
      sellerId: row.seller_id,
      buyerId: row.buyer_id,
      price: row.price,
      soldAt: row.sold_at,
      card: {
        uniqueId: row.unique_id,
        serialId: row.serial_id,
        name: row.name,
        anime: row.anime,
        rarity: row.rarity as Rarity,
        stats: {
          hp: row.stats_hp,
          atk: row.stats_atk,
          def: row.stats_def,
          spd: row.stats_spd,
          luck: row.stats_luck,
        },
        isMainCharacter: row.is_main_character || false,
        frameModifier: row.frame_modifier,
        coatingModifier: row.coating_modifier,
      },
    }))

    return NextResponse.json({ sales: formattedSales })
  } catch (error) {
    console.error("[market/sales-history] Unexpected error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
