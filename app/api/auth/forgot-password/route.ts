import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export async function POST(request: Request) {
  try {
    const { email } = await request.json()

    if (!email || !email.includes("@") || !email.includes(".")) {
      return NextResponse.json({ error: "Введите корректный email" }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("[forgot-password] Missing Supabase env vars:", { hasUrl: !!supabaseUrl, hasKey: !!supabaseServiceKey })
      return NextResponse.json({ error: `Server misconfigured: supabaseUrl=${!!supabaseUrl}, serviceKey=${!!supabaseServiceKey}` }, { status: 500 })
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // Generate a password recovery link via Supabase Admin API
    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: {
        redirectTo: `https://weeb-x.com/reset-password`,
      },
    })

    if (error) {
      console.error("[forgot-password] generateLink error:", error.message)
      // Don't leak whether email exists — return success for security
      return NextResponse.json({ success: true })
    }

    if (!data?.properties?.action_link) {
      console.error("[forgot-password] No action_link in response")
      return NextResponse.json({ error: "Failed to generate reset link" }, { status: 500 })
    }

    const resetLink = data.properties.action_link

    // Send email via coolify-image-service
    const imageServiceUrl = process.env.IMAGE_SERVICE_URL || "http://localhost:3100"
    const mailToken = process.env.MAIL_API_TOKEN

    if (!mailToken) {
      console.error("[forgot-password] MAIL_API_TOKEN not set. IMAGE_SERVICE_URL:", imageServiceUrl)
      return NextResponse.json({ error: `Email service not configured: IMAGE_SERVICE_URL=${imageServiceUrl}, MAIL_API_TOKEN=${!!mailToken}` }, { status: 500 })
    }

    const html = `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Восстановление пароля — Weeb-X</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Oxygen,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0b;min-height:100vh;">
<tr><td align="center" style="padding:40px 16px;">
<table role="presentation" width="500" cellpadding="0" cellspacing="0" style="max-width:500px;width:100%;background:#141416;border-radius:20px;overflow:hidden;border:1px solid rgba(255,255,255,0.06);box-shadow:0 0 40px rgba(249,115,22,0.05);">
<tr><td style="padding:36px 32px 28px;text-align:center;border-bottom:1px solid rgba(255,255,255,0.04);">
<table role="presentation" cellpadding="0" cellspacing="0" align="center"><tr>
<td style="padding-right:12px;vertical-align:middle;">
<svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
<rect width="40" height="40" rx="10" fill="#f97316"/>
<path d="M12 12h4.5l3.5 10 3.5-10h4.5l-5.5 16h-5L12 12z" fill="#fff"/>
<circle cx="30" cy="14" r="3" fill="#fff" opacity="0.9"/>
</svg>
</td>
<td style="vertical-align:middle;text-align:left;">
<h1 style="margin:0;color:#fff;font-size:22px;font-weight:800;letter-spacing:-0.5px;">Weeb-X</h1>
<p style="margin:2px 0 0;color:#71717a;font-size:12px;font-weight:500;letter-spacing:0.5px;text-transform:uppercase;">Аниме платформа</p>
</td>
</tr></table>
</td></tr>
<tr><td style="padding:36px 32px 16px;">
<h2 style="margin:0 0 8px;color:#fafafa;font-size:20px;font-weight:700;">Восстановление пароля</h2>
<p style="color:#a1a1aa;font-size:15px;line-height:1.65;margin:0 0 28px;">
Привет! Вы запросили сброс пароля для аккаунта <strong style="color:#e4e4e7;">${email}</strong>. Нажмите кнопку ниже, чтобы установить новый пароль.
</p>
<table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:8px 0 28px;">
<tr><td align="center">
<a href="${resetLink}" style="display:inline-block;padding:15px 40px;background:linear-gradient(135deg,#f97316,#ea580c);color:#fff;text-decoration:none;font-weight:700;font-size:16px;border-radius:14px;box-shadow:0 4px 20px rgba(249,115,22,0.3);letter-spacing:0.3px;">Сбросить пароль</a>
</td></tr>
</table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 0;">
<tr><td style="background:rgba(255,255,255,0.03);border-radius:12px;padding:16px 20px;border:1px solid rgba(255,255,255,0.04);">
<p style="margin:0 0 6px;color:#71717a;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Ссылка для сброса</p>
<p style="margin:0;color:#52525b;font-size:12px;line-height:1.5;word-break:break-all;">${resetLink}</p>
</td></tr>
</table>
</td></tr>
<tr><td style="padding:0 32px 20px;">
<p style="color:#71717a;font-size:13px;line-height:1.6;margin:0;padding:16px 0 0;border-top:1px solid rgba(255,255,255,0.04);">
Если вы не запрашивали сброс пароля — просто проигнорируйте это письмо. Ваш пароль останется без изменений.
</p>
</td></tr>
<tr><td style="padding:20px 32px 28px;border-top:1px solid rgba(255,255,255,0.04);background:rgba(0,0,0,0.15);">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr>
<td style="text-align:center;">
<p style="margin:0 0 8px;color:#52525b;font-size:12px;">Это автоматическое письмо, отвечать не нужно.</p>
<p style="margin:0;color:#3f3f46;font-size:11px;">© 2026 Weeb-X —weeb-x.com</p>
</td>
</tr>
</table>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`

    const text = `Weeb-X — Восстановление пароля\n\nВы запросили сброс пароля для аккаунта ${email}.\nПерейдите по ссылке для установки нового пароля:\n${resetLink}\n\nЕсли вы не запрашивали сброс, проигнорируйте это письмо.\n\n— Weeb-X,weeb-x.com`

    const mailResponse = await fetch(`${imageServiceUrl}/send-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${mailToken}`,
      },
      body: JSON.stringify({
        to: email,
        subject: "Восстановление пароля — Weeb-X",
        html,
        text,
      }),
    })

    if (!mailResponse.ok) {
      const mailErr = await mailResponse.text()
      console.error("[forgot-password] Mail service error:", mailResponse.status, mailErr)
      return NextResponse.json({ error: `Mail service error (${mailResponse.status}): ${mailErr}` }, { status: 500 })
    }

    console.log(`[forgot-password] Reset email sent to ${email}`)
    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error("[forgot-password] Error:", err?.message || err)
    return NextResponse.json({ error: `Internal error: ${err?.message || String(err)}` }, { status: 500 })
  }
}
