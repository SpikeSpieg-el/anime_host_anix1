import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

async function getAuthenticatedUser(request: Request) {
  const authHeader = request.headers.get("authorization")
  if (!authHeader?.startsWith("Bearer ")) return null

  const token = authHeader.substring(7)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !anonKey || !serviceKey) return null

  const authClient = createClient(supabaseUrl, anonKey)
  const adminClient = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data, error } = await authClient.auth.getUser(token)
  if (error || !data.user) return null

  return { user: data.user, adminClient }
}

async function sendReferralEmail(to: string, username: string | null, createdAt: string) {
  const imageServiceUrl = process.env.IMAGE_SERVICE_URL
  const mailToken = process.env.MAIL_API_TOKEN

  const displayName = username || "Новый пользователь"
  const escapedName = displayName.replace(/[&<>"']/g, (character) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character] || character
  ))
  const html = `
    <div style="font-family:Arial,sans-serif;color:#18181b;line-height:1.6">
      <h2>Вам начислен реферальный бонус!</h2>
      <p>Пользователь <strong>${escapedName}</strong> зарегистрировался по вашей ссылке.</p>
      <p>На ваш аккаунт зачислено <strong>2000 монет</strong>.</p>
      <p style="color:#71717a;font-size:13px">Дата регистрации: ${new Date(createdAt).toLocaleString("ru-RU")}</p>
    </div>
  `
  const subject = "Вам начислен реферальный бонус — Weeb-X"
  const text = `Пользователь ${displayName} зарегистрировался по вашей ссылке. Вам начислено 2000 монет.`
  const resendApiKey = process.env.RESEND_API_KEY

  if (resendApiKey) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL || "Weeb-X <noreply@weeb-x.com>",
        to: [to],
        subject,
        html,
        text,
      }),
      signal: AbortSignal.timeout(10000),
    })
    if (response.ok) return
    console.error("[referrals] Resend email failed:", response.status, await response.text())
  }

  if (!imageServiceUrl || !mailToken) {
    throw new Error("Email service is not configured")
  }

  const response = await fetch(`${imageServiceUrl}/send-email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${mailToken}` },
    body: JSON.stringify({ to, subject, html, text }),
    signal: AbortSignal.timeout(10000),
  })
  if (!response.ok) {
    throw new Error(`Email service returned ${response.status}`)
  }
}

export async function POST(request: Request) {
  try {
    const authData = await getAuthenticatedUser(request)
    if (!authData) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { user, adminClient } = authData
    const { count, error: countError } = await adminClient
      .from("referrals")
      .select("id", { count: "exact", head: true })
      .eq("referrer_id", user.id)
    if (countError) throw countError

    const { data: pending, error: pendingError } = await adminClient
      .from("referrals")
      .select("id, referred_id, created_at")
      .eq("referrer_id", user.id)
      .is("email_notified_at", null)
      .order("created_at", { ascending: true })
    if (pendingError) throw pendingError

    const { data: referrerData, error: referrerError } = await adminClient.auth.admin.getUserById(user.id)
    if (referrerError) throw referrerError
    const referrerEmail = referrerData.user.email

    if (referrerEmail) {
      for (const referral of pending || []) {
        const { data: referredProfile, error: profileError } = await adminClient
          .from("profiles")
          .select("username")
          .eq("id", referral.referred_id)
          .maybeSingle()
        if (profileError) throw profileError

        await sendReferralEmail(referrerEmail, referredProfile?.username, referral.created_at)
        const { error: updateError } = await adminClient
          .from("referrals")
          .update({ email_notified_at: new Date().toISOString() })
          .eq("id", referral.id)
          .is("email_notified_at", null)
        if (updateError) throw updateError
      }
    }

    return NextResponse.json({ referralCount: count || 0 })
  } catch (error) {
    console.error("[referrals] Failed to process referral notifications:", error)
    return NextResponse.json({ error: "Failed to process referrals" }, { status: 500 })
  }
}
