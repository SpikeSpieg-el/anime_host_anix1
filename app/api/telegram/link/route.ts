import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

const CODE_PATTERN = /^[A-HJ-NP-Z2-9]{8}$/

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseServiceKey) return null
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

async function getAuthenticatedUser(request: Request) {
  const authHeader = request.headers.get("authorization")
  if (!authHeader?.startsWith("Bearer ")) return null

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnonKey) return null

  const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey)
  const { data, error } = await supabaseAuth.auth.getUser(authHeader.substring(7))
  if (error || !data?.user) return null
  return data.user
}

/** GET — статус привязки текущего пользователя */
export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser(request)
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const supabaseAdmin = getSupabaseAdmin()
    if (!supabaseAdmin) {
      return NextResponse.json({ success: false, error: "Server configuration error" }, { status: 500 })
    }

    const { data, error } = await supabaseAdmin
      .from("telegram_links")
      .select("telegram_username, linked_at, notifications_enabled")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle()

    if (error) {
      console.error("[telegram/link] GET failed:", error)
      return NextResponse.json({ success: false, error: "Failed to load link" }, { status: 500 })
    }

    const row = data as {
      telegram_username?: string | null
      linked_at?: string | null
      notifications_enabled?: boolean
    } | null

    return NextResponse.json({
      success: true,
      linked: Boolean(row),
      telegramUsername: row?.telegram_username ?? null,
      linkedAt: row?.linked_at ?? null,
      notificationsEnabled: row?.notifications_enabled ?? true,
    })
  } catch (error) {
    console.error("[telegram/link] GET error:", error)
    return NextResponse.json({ success: false, error: "Internal error" }, { status: 500 })
  }
}

/** POST — подтвердить код и привязать аккаунт */
export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser(request)
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    let code: unknown
    try {
      const body = await request.json()
      code = body?.code
    } catch {
      return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 })
    }

    if (typeof code !== "string" || !CODE_PATTERN.test(code.trim().toUpperCase())) {
      return NextResponse.json({ success: false, error: "Invalid code format" }, { status: 400 })
    }

    const supabaseAdmin = getSupabaseAdmin()
    if (!supabaseAdmin) {
      return NextResponse.json({ success: false, error: "Server configuration error" }, { status: 500 })
    }

    const normalized = code.trim().toUpperCase()

    const { data: codeData, error: findError } = await supabaseAdmin
      .from("telegram_link_codes")
      .select("id, telegram_id, telegram_username, status, expires_at")
      .eq("code", normalized)
      .eq("status", "pending")
      .limit(1)
      .maybeSingle()

    if (findError) {
      console.error("[telegram/link] code lookup failed:", findError)
      return NextResponse.json({ success: false, error: "Failed to verify code" }, { status: 500 })
    }

    if (!codeData) {
      return NextResponse.json(
        { success: false, error: "Code not found or already used" },
        { status: 404 },
      )
    }

    if (new Date(codeData.expires_at) < new Date()) {
      await supabaseAdmin
        .from("telegram_link_codes")
        .update({ status: "expired" })
        .eq("id", codeData.id)
        .eq("status", "pending")

      return NextResponse.json({ success: false, error: "Code has expired" }, { status: 410 })
    }

    // Потребляем код
    const { data: consumed, error: consumeError } = await supabaseAdmin
      .from("telegram_link_codes")
      .update({
        status: "linked",
        user_id: user.id,
        linked_at: new Date().toISOString(),
      })
      .eq("id", codeData.id)
      .eq("status", "pending")
      .select("id")

    if (consumeError || !consumed || consumed.length === 0) {
      return NextResponse.json(
        { success: false, error: "Code not found or already used" },
        { status: 409 },
      )
    }

    // Удаляем старые привязки
    await supabaseAdmin
      .from("telegram_links")
      .delete()
      .or(`telegram_id.eq.${codeData.telegram_id},user_id.eq.${user.id}`)

    // Создаем новую запись
    const { error: linkError } = await supabaseAdmin.from("telegram_links").insert({
      telegram_id: codeData.telegram_id,
      chat_id: codeData.telegram_id,
      telegram_username: codeData.telegram_username ?? null,
      user_id: user.id,
      notifications_enabled: true,
      linked_at: new Date().toISOString(),
    })

    if (linkError) {
      console.error("[telegram/link] link insert failed:", linkError)
      return NextResponse.json({ success: false, error: "Failed to link account" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      telegramUsername: codeData.telegram_username ?? null,
    })
  } catch (error) {
    console.error("[telegram/link] POST error:", error)
    return NextResponse.json({ success: false, error: "Internal error" }, { status: 500 })
  }
}

/** DELETE — отвязать Telegram от текущего аккаунта */
export async function DELETE(request: Request) {
  try {
    const user = await getAuthenticatedUser(request)
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const supabaseAdmin = getSupabaseAdmin()
    if (!supabaseAdmin) {
      return NextResponse.json({ success: false, error: "Server configuration error" }, { status: 500 })
    }

    const { error } = await supabaseAdmin
      .from("telegram_links")
      .delete()
      .eq("user_id", user.id)

    if (error) {
      console.error("[telegram/link] DELETE failed:", error)
      return NextResponse.json({ success: false, error: "Failed to unlink account" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[telegram/link] DELETE error:", error)
    return NextResponse.json({ success: false, error: "Internal error" }, { status: 500 })
  }
}