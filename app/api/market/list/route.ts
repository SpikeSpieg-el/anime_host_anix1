import { NextResponse } from "next/server"
import { getMarketAuth } from "@/app/api/market/_auth"
import { computeMinListingPrice, computeMaxListingPrice } from "@/lib/market-floor"
import type { Rarity } from "@/types/gacha"

export async function POST(request: Request) {
  const auth = await getMarketAuth(request)
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: { uniqueId?: string; price?: number }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { uniqueId, price } = body
  if (!uniqueId || typeof uniqueId !== "string") {
    return NextResponse.json({ error: "uniqueId required" }, { status: 400 })
  }
  if (typeof price !== "number" || !Number.isFinite(price) || !Number.isInteger(price)) {
    return NextResponse.json({ error: "Integer price required" }, { status: 400 })
  }

  const { user, supabaseAdmin } = auth

  const { data: rows, error: fetchErr } = await supabaseAdmin
    .from("user_cards")
    .select("*")
    .eq("user_id", user.id)

  if (fetchErr) {
    console.error("[market/list POST] fetch cards", fetchErr)
    return NextResponse.json({ error: "Database error" }, { status: 500 })
  }

  const row = rows?.find((r) => r.unique_id === uniqueId)
  if (!row) {
    return NextResponse.json({ error: "Card not in collection" }, { status: 404 })
  }

  const cardFloor = {
    rarity: row.rarity as Rarity,
    stats: {
      hp: row.stats_hp,
      atk: row.stats_atk,
      def: row.stats_def,
      spd: row.stats_spd,
      luck: row.stats_luck,
    },
    isMainCharacter: row.is_main_character ?? false,
  }

  const others = (rows || [])
    .filter((r) => r.unique_id !== uniqueId)
    .map((r) => ({
      rarity: r.rarity as Rarity,
      stats: {
        hp: r.stats_hp,
        atk: r.stats_atk,
        def: r.stats_def,
        spd: r.stats_spd,
        luck: r.stats_luck,
      },
      isMainCharacter: r.is_main_character ?? false,
    }))

  const minPrice = computeMinListingPrice(cardFloor, others)
  const maxPrice = computeMaxListingPrice(cardFloor, others)

  if (price < minPrice) {
    return NextResponse.json(
      { error: "Price below minimum", minPrice, maxPrice },
      { status: 400 }
    )
  }

  if (price > maxPrice) {
    return NextResponse.json(
      { error: "Price above maximum", minPrice, maxPrice },
      { status: 400 }
    )
  }

  const { data: rpcData, error: rpcErr } = await supabaseAdmin.rpc("market_put_listing", {
    p_seller_id: user.id,
    p_unique_id: uniqueId,
    p_price: price,
    p_min_price: minPrice,
    p_max_price: maxPrice,
  })

  if (rpcErr) {
    console.error("[market/list POST] rpc", rpcErr)
    return NextResponse.json({ error: "Listing failed" }, { status: 500 })
  }

  const result = rpcData as {
    ok?: boolean
    error?: string
    min_price?: number
    max_price?: number
  }
  if (!result?.ok) {
    const err = result?.error || "listing_rejected"
    const code =
      err === "price_below_min" || err === "price_above_max" || err === "invalid_price_bounds"
        ? 400
        : 409
    return NextResponse.json(
      {
        error: err,
        minPrice: result?.min_price ?? minPrice,
        maxPrice: result?.max_price ?? maxPrice,
      },
      { status: code }
    )
  }

  return NextResponse.json({ success: true, minPrice, maxPrice })
}
