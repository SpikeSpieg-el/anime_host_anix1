import { NextResponse } from "next/server"
import { getMarketAuth } from "@/app/api/market/_auth"
import { STARTING_COINS } from "@/lib/economy"

/**
 * Абсолютный потолок баланса. Выше — это точно баг (раньше клиент мог
 * «починить» переполнение, подсунув серверу любую сумму).
 */
const MAX_SANE_BALANCE = 10_000_000
const CLAMPED_BALANCE = 1_000_000

/**
 * POST /api/coins/normalize
 *
 * Серверная «починка» баланса. Клиент больше не пишет монеты напрямую
 * (RLS на user_coins оставлен только на чтение) — он может только попросить
 * проверить баланс. Сумму определяет сервер: клиент не присылает никаких чисел.
 */
export async function POST(request: Request) {
  const auth = await getMarketAuth(request)
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { user, supabaseAdmin } = auth

  const { data, error } = await supabaseAdmin
    .from("user_coins")
    .select("coins")
    .eq("id", user.id)
    .maybeSingle()

  if (error) {
    console.error("[coins/normalize POST]", error)
    return NextResponse.json({ error: "Database error" }, { status: 500 })
  }

  if (!data) {
    // Записи нет (например, триггер не сработал) — выдаём стартовый бонус.
    const { data: created, error: insertError } = await supabaseAdmin
      .from("user_coins")
      .insert({ id: user.id, coins: STARTING_COINS })
      .select("coins")
      .single()

    if (insertError) {
      console.error("[coins/normalize POST] insert", insertError)
      return NextResponse.json({ error: "Database error" }, { status: 500 })
    }

    return NextResponse.json({ success: true, coins: created.coins, created: true, clamped: false })
  }

  if (data.coins > MAX_SANE_BALANCE) {
    const { data: fixed, error: updateError } = await supabaseAdmin
      .from("user_coins")
      .update({ coins: CLAMPED_BALANCE, updated_at: new Date().toISOString() })
      .eq("id", user.id)
      .select("coins")
      .single()

    if (updateError) {
      console.error("[coins/normalize POST] update", updateError)
      return NextResponse.json({ error: "Database error" }, { status: 500 })
    }

    return NextResponse.json({ success: true, coins: fixed.coins, created: false, clamped: true })
  }

  return NextResponse.json({ success: true, coins: data.coins, created: false, clamped: false })
}
