import { NextResponse } from "next/server"
import { getMarketAuth } from "@/app/api/market/_auth"
import { getInstantSellPrice, type EconomyCard } from "@/lib/economy"
import type { Rarity } from "@/types/gacha"

type CardRow = {
  unique_id: string
  rarity: Rarity
  stats_hp: number
  stats_atk: number
  stats_def: number
  stats_spd: number
  stats_luck: number
  is_main_character: boolean | null
  frame_modifier: string | null
  coating_modifier: string | null
}

function toEconomyCard(row: CardRow): EconomyCard {
  return {
    rarity: row.rarity,
    stats: {
      hp: row.stats_hp,
      atk: row.stats_atk,
      def: row.stats_def,
      spd: row.stats_spd,
      luck: row.stats_luck,
    },
    isMainCharacter: row.is_main_character ?? false,
    frameModifier: row.frame_modifier,
    coatingModifier: row.coating_modifier,
  }
}

// GET — цена мгновенной продажи для карты (безопасно: ничего не меняет)
export async function GET(request: Request) {
  const auth = await getMarketAuth(request)
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const url = new URL(request.url)
  const uniqueId = url.searchParams.get("uniqueId")
  if (!uniqueId) {
    return NextResponse.json({ error: "uniqueId required" }, { status: 400 })
  }

  const { user, supabaseAdmin } = auth
  const { data, error } = await supabaseAdmin
    .from("user_cards")
    .select("unique_id, rarity, stats_hp, stats_atk, stats_def, stats_spd, stats_luck, is_main_character, frame_modifier, coating_modifier")
    .eq("user_id", user.id)
    .eq("unique_id", uniqueId)
    .maybeSingle()

  if (error) {
    console.error("[market/instant-sell GET]", error)
    return NextResponse.json({ error: "Database error" }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ error: "Card not in collection" }, { status: 404 })
  }

  return NextResponse.json({ price: getInstantSellPrice(toEconomyCard(data as CardRow)) })
}

// POST — мгновенная продажа карты за монеты (70% справедливой цены)
export async function POST(request: Request) {
  const auth = await getMarketAuth(request)
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: { uniqueId?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const uniqueId = body.uniqueId
  if (!uniqueId || typeof uniqueId !== "string") {
    return NextResponse.json({ error: "uniqueId required" }, { status: 400 })
  }

  const { user, supabaseAdmin } = auth

  // Цену считает сервер по карте из инвентаря: клиент присылает только
  // идентификатор, подкрутить цену «на клиенте» нельзя.
  const { data, error: fetchErr } = await supabaseAdmin
    .from("user_cards")
    .select("unique_id, rarity, stats_hp, stats_atk, stats_def, stats_spd, stats_luck, is_main_character, frame_modifier, coating_modifier")
    .eq("user_id", user.id)
    .eq("unique_id", uniqueId)
    .maybeSingle()

  if (fetchErr) {
    console.error("[market/instant-sell POST] fetch", fetchErr)
    return NextResponse.json({ error: "Database error" }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ error: "Card not in collection" }, { status: 404 })
  }

  const price = getInstantSellPrice(toEconomyCard(data as CardRow))

  const { data: rpcData, error: rpcErr } = await supabaseAdmin.rpc("market_instant_sell", {
    p_seller_id: user.id,
    p_unique_id: uniqueId,
    p_price: price,
  })

  if (rpcErr) {
    console.error("[market/instant-sell POST] rpc", rpcErr)
    return NextResponse.json({ error: "Sell failed" }, { status: 500 })
  }

  const result = rpcData as { ok?: boolean; error?: string; price?: number }
  if (!result?.ok) {
    const status = result?.error === "card_not_found" ? 404 : 409
    return NextResponse.json({ error: result?.error || "sell_rejected" }, { status })
  }

  return NextResponse.json({ success: true, price: result.price ?? price })
}
