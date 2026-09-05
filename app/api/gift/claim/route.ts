import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import type { Card } from "@/app/gacha/types"

const TOKEN_PATTERN = /^[A-Za-z0-9]{32}$/

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) return null

  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

function cardInsertPayload(userId: string, card: Card) {
  return {
    user_id: userId,
    unique_id: card.uniqueId,
    serial_id: card.serialId || String(card.characterId),
    name: card.name,
    anime: card.anime,
    rarity: card.rarity,
    image_url: card.imageUrl,
    original_url: card.originalUrl,
    fallback_urls: card.fallbackUrls || [],
    score: card.score || 0,
    shiki_id: card.shikiId,
    character_id: card.characterId,
    stats_hp: card.stats?.hp || 0,
    stats_atk: card.stats?.atk || 0,
    stats_def: card.stats?.def || 0,
    stats_spd: card.stats?.spd || 0,
    stats_luck: card.stats?.luck || 0,
    is_main_character: card.isMainCharacter || false,
    pack_id: card.packId || null,
    pack_name: card.packName || null,
    frame_modifier: card.frameModifier || null,
    coating_modifier: card.coatingModifier || null,
    is_art_blacklisted: card.isArtBlacklisted || false,
    image_layers: card.imageLayers || null,
    art_position: card.artPosition || null,
  }
}

export async function POST(request: Request) {
  try {
    const authorization = request.headers.get("authorization")
    const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : null
    const giftToken = (await request.json()).token?.trim()

    if (!token || !giftToken || !TOKEN_PATTERN.test(giftToken)) {
      return NextResponse.json({ error: "Invalid gift claim request" }, { status: 400 })
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    const supabaseAdmin = getAdminClient()

    if (!url || !anonKey || !supabaseAdmin) {
      return NextResponse.json({ error: "Gift claiming is not configured" }, { status: 500 })
    }

    const supabaseAuth = createClient(url, anonKey)
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: giftTokenRow, error: claimError } = await supabaseAdmin
      .from("gift_card_tokens")
      .select("payload")
      .eq("token", giftToken)
      .gt("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .maybeSingle()

    if (claimError) {
      console.error("Gift token claim error:", claimError)
      return NextResponse.json({ error: "Failed to claim gift token" }, { status: 500 })
    }

    if (!giftTokenRow?.payload) {
      return NextResponse.json({ error: "Gift token not found or expired" }, { status: 404 })
    }

    const card = giftTokenRow.payload as Card

    const { data: existingCard } = await supabaseAdmin
      .from("user_cards")
      .select("id")
      .eq("user_id", user.id)
      .eq("unique_id", card.uniqueId)
      .maybeSingle()

    if (existingCard) {
      return NextResponse.json({ success: true, alreadyClaimed: true })
    }

    const { error: claimInsertError } = await supabaseAdmin
      .from("gift_card_claims")
      .insert({
        token: giftToken,
        user_id: user.id,
        card_unique_id: card.uniqueId,
      })

    if (claimInsertError?.code === "23505") {
      return NextResponse.json({ success: true, alreadyClaimed: true })
    }

    if (claimInsertError) {
      console.error("Gift claim tracking error:", claimInsertError)
      return NextResponse.json({ error: "Failed to track gift claim" }, { status: 500 })
    }

    const { error: insertError } = await supabaseAdmin
      .from("user_cards")
      .insert(cardInsertPayload(user.id, card))

    if (insertError) {
      await supabaseAdmin
        .from("gift_card_claims")
        .delete()
        .eq("token", giftToken)
        .eq("user_id", user.id)
      console.error("Gift card insert error:", insertError)
      return NextResponse.json({ error: "Failed to add gift card" }, { status: 500 })
    }

    return NextResponse.json({ success: true, alreadyClaimed: false, card })
  } catch (error) {
    console.error("Gift card claim error:", error)
    return NextResponse.json({ error: "Invalid gift claim request" }, { status: 400 })
  }
}
