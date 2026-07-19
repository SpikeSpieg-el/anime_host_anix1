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
<style>
@keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
@keyframes pulse-glow{0%,100%{opacity:0.4}50%{opacity:0.8}}
</style>
</head>
<body style="margin:0;padding:0;background:#08080a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Oxygen,sans-serif;-webkit-font-smoothing:antialiased;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#08080a;min-height:100vh;">
<tr><td align="center" style="padding:40px 16px;">

<table role="presentation" width="540" cellpadding="0" cellspacing="0" style="max-width:540px;width:100%;background:#111114;border-radius:24px;overflow:hidden;border:1px solid rgba(255,255,255,0.06);box-shadow:0 0 60px rgba(249,115,22,0.08),0 20px 60px rgba(0,0,0,0.5);">

<tr><td style="position:relative;padding:0;">
<div style="height:6px;background:linear-gradient(90deg,#f97316,#fb923c,#f97316,#ea580c,#f97316);background-size:200% 100%;animation:shimmer 3s linear infinite;"></div>
</td></tr>

<tr><td style="padding:40px 32px 24px;text-align:center;border-bottom:1px solid rgba(255,255,255,0.04);">
<table role="presentation" cellpadding="0" cellspacing="0" align="center"><tr>
<td style="padding-right:14px;vertical-align:middle;">
<img src="https://weeb-x.com/apple-icon.png" width="48" height="48" alt="Weeb-X" style="display:block;border-radius:12px;box-shadow:0 4px 16px rgba(249,115,22,0.2);">
</td>
<td style="vertical-align:middle;text-align:left;">
<h1 style="margin:0;color:#fff;font-size:24px;font-weight:800;letter-spacing:-0.5px;">Weeb-X</h1>
<p style="margin:2px 0 0;color:#71717a;font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;">Аниме платформа</p>
</td>
</tr></table>
</td></tr>

<tr><td style="padding:40px 32px 8px;text-align:center;">
<div style="width:72px;height:72px;margin:0 auto 24px;border-radius:50%;background:linear-gradient(135deg,rgba(249,115,22,0.15),rgba(234,88,12,0.05));border:2px solid rgba(249,115,22,0.2);display:flex;align-items:center;justify-content:center;animation:pulse-glow 2s ease-in-out infinite;">
<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#f97316" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l8 4v6c0 5-3.5 9-8 10-4.5-1-8-5-8-10V6l8-4z"/><path d="M9 12l2 2 4-4"/></svg>
</div>
<h2 style="margin:0 0 10px;color:#fafafa;font-size:22px;font-weight:800;letter-spacing:-0.3px;">Сброс пароля</h2>
<p style="color:#a1a1aa;font-size:15px;line-height:1.7;margin:0 0 8px;">
Кто-то запросил восстановление пароля для аккаунта
</p>
<p style="margin:0 0 32px;">
<span style="display:inline-block;padding:6px 16px;background:rgba(249,115,22,0.08);border:1px solid rgba(249,115,22,0.15);border-radius:8px;color:#fb923c;font-size:14px;font-weight:600;letter-spacing:0.2px;">${email}</span>
</p>
</td></tr>

<tr><td style="padding:0 32px 32px;text-align:center;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
<tr><td align="center" style="text-align:center;">
<a href="${resetLink}" style="display:inline-block;padding:16px 48px;background:linear-gradient(135deg,#f97316,#ea580c);color:#fff;text-decoration:none;font-weight:700;font-size:16px;border-radius:14px;box-shadow:0 6px 24px rgba(249,115,22,0.35),0 2px 8px rgba(249,115,22,0.15);letter-spacing:0.3px;border:1px solid rgba(255,255,255,0.1);">🔑 Сбросить пароль</a>
</td></tr>
</table>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" align="center" style="margin:0 0 24px;">
<tr><td style="background:rgba(255,255,255,0.02);border-radius:14px;padding:18px 22px;border:1px solid rgba(255,255,255,0.05);">
<table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:0 auto;">
<tr>
<td style="vertical-align:top;width:28px;padding-right:14px;">
<div style="width:24px;height:24px;border-radius:50%;background:rgba(249,115,22,0.12);border:1px solid rgba(249,115,22,0.2);text-align:center;line-height:22px;font-size:11px;font-weight:700;color:#f97316;">1</div>
</td>
<td style="vertical-align:middle;text-align:left;">
<p style="margin:0;color:#d4d4d8;font-size:14px;line-height:1.5;">Нажмите кнопку «Сбросить пароль» выше</p>
</td>
</tr>
<tr><td colspan="2" style="height:12px;line-height:12px;">&nbsp;</td></tr>
<tr>
<td style="vertical-align:top;width:28px;padding-right:14px;">
<div style="width:24px;height:24px;border-radius:50%;background:rgba(249,115,22,0.12);border:1px solid rgba(249,115,22,0.2);text-align:center;line-height:22px;font-size:11px;font-weight:700;color:#f97316;">2</div>
</td>
<td style="vertical-align:middle;text-align:left;">
<p style="margin:0;color:#d4d4d8;font-size:14px;line-height:1.5;">Придумайте новый надёжный пароль</p>
</td>
</tr>
<tr><td colspan="2" style="height:12px;line-height:12px;">&nbsp;</td></tr>
<tr>
<td style="vertical-align:top;width:28px;padding-right:14px;">
<div style="width:24px;height:24px;border-radius:50%;background:rgba(249,115,22,0.12);border:1px solid rgba(249,115,22,0.2);text-align:center;line-height:22px;font-size:11px;font-weight:700;color:#f97316;">3</div>
</td>
<td style="vertical-align:middle;text-align:left;">
<p style="margin:0;color:#d4d4d8;font-size:14px;line-height:1.5;">Готово! Войдите с новым паролем на Weeb-X</p>
</td>
</tr>
</table>
</td></tr>
</table>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" align="center" style="margin:0 0 24px;">
<tr><td style="background:rgba(239,68,68,0.04);border-radius:12px;padding:14px 20px;border:1px solid rgba(239,68,68,0.1);">
<table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:0 auto;"><tr>
<td style="vertical-align:top;padding-right:10px;">
<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block;margin-top:1px;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
</td>
<td style="text-align:left;">
<p style="margin:0;color:#a1a1aa;font-size:13px;line-height:1.6;">Ссылка действительна ограниченное время. Если вы не запрашивали сброс пароля — просто проигнорируйте это письмо. Ваш пароль останется без изменений.</p>
</td>
</tr></table>
</td></tr>
</table>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" align="center">
<tr><td style="background:rgba(255,255,255,0.02);border-radius:10px;padding:14px 18px;border:1px solid rgba(255,255,255,0.04);text-align:center;">
<p style="margin:0 0 4px;color:#52525b;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Не работает кнопка? Скопируйте ссылку:</p>
<p style="margin:0;color:#3f3f46;font-size:11px;line-height:1.5;word-break:break-all;text-align:center;">${resetLink}</p>
</td></tr>
</table>
</td></tr>

<tr><td style="padding:24px 32px 32px;border-top:1px solid rgba(255,255,255,0.04);background:rgba(0,0,0,0.2);text-align:center;">
<table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:0 auto 14px;">
<tr>
<td style="padding:0 8px;">
<a href="https://weeb-x.com" style="color:#52525b;font-size:12px;text-decoration:none;font-weight:500;">Главная</a>
</td>
<td style="color:#27272a;font-size:12px;">·</td>
<td style="padding:0 8px;">
<a href="https://weeb-x.com/catalog" style="color:#52525b;font-size:12px;text-decoration:none;font-weight:500;">Каталог</a>
</td>
<td style="color:#27272a;font-size:12px;">·</td>
<td style="padding:0 8px;">
<a href="https://weeb-x.com/gacha" style="color:#52525b;font-size:12px;text-decoration:none;font-weight:500;">Гача</a>
</td>
<td style="color:#27272a;font-size:12px;">·</td>
<td style="padding:0 8px;">
<a href="https://weeb-x.com/battle" style="color:#52525b;font-size:12px;text-decoration:none;font-weight:500;">Битвы</a>
</td>
</tr>
</table>
<p style="margin:0 0 6px;color:#3f3f46;font-size:11px;text-align:center;">Это автоматическое письмо — отвечать не нужно</p>
<p style="margin:0;color:#27272a;font-size:11px;text-align:center;">© 2026 Weeb-X · weeb-x.com</p>
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
