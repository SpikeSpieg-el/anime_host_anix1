import { NextResponse } from "next/server"
import { getMarketAuth } from "@/app/api/market/_auth"
import { DAILY_REWARDS, DAILY_STREAK_LENGTH, getNextMilestone } from "@/lib/economy"

// GET — статус ежедневной награды: сколько дней в серии и что заберут завтра/сегодня
export async function GET(request: Request) {
  const auth = await getMarketAuth(request)
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { user, supabaseAdmin } = auth

  const { data, error } = await supabaseAdmin
    .from("user_daily_state")
    .select("last_claim_date, streak, total_claims, lifetime_coins")
    .eq("user_id", user.id)
    .maybeSingle()

  if (error) {
    console.error("[economy/daily GET]", error)
    return NextResponse.json({ error: "Database error" }, { status: 500 })
  }

  const today = new Date().toISOString().slice(0, 10)
  const lastClaim = data?.last_claim_date ?? null
  const streak = data?.streak ?? 0
  const claimedToday = lastClaim === today

  // Серия жива, если вчера была claimed; иначе она сбрасывается на 1-й день.
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const nextDay = claimedToday ? (streak % DAILY_STREAK_LENGTH) + 1 : lastClaim === yesterday ? (streak % DAILY_STREAK_LENGTH) + 1 : 1

  return NextResponse.json({
    claimedToday,
    streak,
    totalClaims: data?.total_claims ?? 0,
    lifetimeCoins: data?.lifetime_coins ?? 0,
    nextDay,
    nextReward: DAILY_REWARDS[nextDay - 1],
    schedule: DAILY_REWARDS,
  })
}

// POST — забрать ежедневную награду (серия из 7 дней)
export async function POST(request: Request) {
  const auth = await getMarketAuth(request)
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { user, supabaseAdmin } = auth

  const { data, error } = await supabaseAdmin.rpc("economy_claim_daily", { p_user_id: user.id })

  if (error) {
    console.error("[economy/daily POST] rpc", error)
    return NextResponse.json({ error: "Claim failed" }, { status: 500 })
  }

  const result = data as { ok?: boolean; error?: string; day?: number; coins?: number; dust?: number; streak?: number }
  if (!result?.ok) {
    if (result?.error === "already_claimed") {
      return NextResponse.json({ error: "already_claimed", streak: result.streak ?? 0 }, { status: 409 })
    }
    return NextResponse.json({ error: result?.error || "claim_rejected" }, { status: 409 })
  }

  return NextResponse.json({
    success: true,
    day: result.day,
    coins: result.coins,
    dust: result.dust,
    streak: result.streak,
  })
}

// PUT — забрать награды за вехи коллекции (10 / 25 / 50 / 100 / 200 карт)
export async function PUT(request: Request) {
  const auth = await getMarketAuth(request)
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { user, supabaseAdmin } = auth

  const { data: cards } = await supabaseAdmin
    .from("user_cards")
    .select("unique_id", { count: "exact", head: true })
    .eq("user_id", user.id)

  const cardCount = cards?.length ?? 0
  const next = getNextMilestone(cardCount)

  const { data, error } = await supabaseAdmin.rpc("economy_claim_milestone", {
    p_user_id: user.id,
    p_cards: next ? next.cards : cardCount,
  })

  if (error) {
    console.error("[economy/daily PUT] rpc", error)
    return NextResponse.json({ error: "Claim failed" }, { status: 500 })
  }

  const result = data as { ok?: boolean; error?: string; cards?: number; granted?: number; title?: string }
  if (!result?.ok) {
    return NextResponse.json({ error: result?.error || "claim_rejected", cards: cardCount }, { status: 409 })
  }

  return NextResponse.json({
    success: true,
    cards: result.cards ?? cardCount,
    coins: result.granted ?? 0,
    title: result.title ?? null,
  })
}
