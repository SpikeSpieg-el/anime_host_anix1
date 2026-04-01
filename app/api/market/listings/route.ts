import { NextResponse } from "next/server"
import { getMarketAuth, getSupabaseAdmin } from "@/app/api/market/_auth"
import type { Rarity } from "@/types/gacha"

export async function GET(request: Request) {
  const supabaseAdmin = getSupabaseAdmin()
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 })
  }

  const url = new URL(request.url)
  const mine = url.searchParams.get("mine") === "1"
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "60", 10) || 60, 120)

  const auth = await getMarketAuth(request)
  if (mine) {
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
  }

  let query = supabaseAdmin
    .from("market_listings")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit)

  if (mine && auth) {
    query = query.eq("seller_id", auth.user.id)
  }

  const { data, error } = await query

  if (error) {
    if (error.code === "PGRST116" || error.code === "42P01" || error.message?.includes("market_listings")) {
      return NextResponse.json({ listings: [], warning: "market_table_missing" })
    }
    console.error("[market/listings GET]", error)
    return NextResponse.json({ error: "Failed to load listings" }, { status: 500 })
  }

  const viewerId = auth?.user.id ?? null

  const listings = (data || []).map((row) => ({
    listingId: row.id,
    price: row.price,
    minPriceAtList: row.min_price_at_list,
    sellerId: row.seller_id,
    createdAt: row.created_at,
    isMine: viewerId !== null && row.seller_id === viewerId,
    card: {
      uniqueId: row.unique_id,
      serialId: row.serial_id,
      name: row.name,
      anime: row.anime,
      rarity: row.rarity as Rarity,
      imageUrl: row.image_url,
      originalUrl: row.original_url,
      fallbackUrls: row.fallback_urls || [],
      score: parseFloat(row.score?.toString() || "0"),
      shikiId: row.shiki_id,
      characterId: row.character_id,
      stats: {
        hp: row.stats_hp,
        atk: row.stats_atk,
        def: row.stats_def,
        spd: row.stats_spd,
        luck: row.stats_luck,
      },
      isMainCharacter: row.is_main_character || false,
      packId: row.pack_id || undefined,
      packName: row.pack_name || undefined,
      isArtBlacklisted: row.is_art_blacklisted || false,
    },
  }))

  return NextResponse.json({ listings })
}
