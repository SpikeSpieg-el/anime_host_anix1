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
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || "https://weeb-x.com"}/reset-password`,
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

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin:0;padding:0;background:#09090b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
        <div style="max-width:480px;margin:40px auto;background:#18181b;border-radius:16px;overflow:hidden;border:1px solid rgba(255,255,255,0.1);">
          <div style="padding:32px 24px;text-align:center;border-bottom:1px solid rgba(255,255,255,0.05);">
            <h1 style="margin:0;color:#fff;font-size:24px;font-weight:700;">Weeb-X</h1>
            <p style="margin:8px 0 0;color:#a1a1aa;font-size:14px;">Восстановление пароля</p>
          </div>
          <div style="padding:32px 24px;">
            <p style="color:#a1a1aa;font-size:15px;line-height:1.6;margin:0 0 24px;">
              Вы запросили сброс пароля для вашего аккаунта Weeb-X.
              Нажмите на кнопку ниже, чтобы установить новый пароль.
            </p>
            <div style="text-align:center;margin:32px 0;">
              <a href="${resetLink}"
                 style="display:inline-block;padding:14px 32px;background:#f97316;color:#fff;text-decoration:none;font-weight:600;font-size:16px;border-radius:12px;">
                Сбросить пароль
              </a>
            </div>
            <p style="color:#71717a;font-size:13px;line-height:1.5;margin:24px 0 0;">
              Если вы не запрашивали сброс пароля, просто проигнорируйте это письмо.
              Ссылка действительна в течение 1 часа.
            </p>
            <p style="color:#52525b;font-size:12px;margin:16px 0 0;word-break:break-all;">
              Если кнопка не работает, скопируйте ссылку:<br>
              <span style="color:#71717a;">${resetLink}</span>
            </p>
          </div>
          <div style="padding:16px 24px;border-top:1px solid rgba(255,255,255,0.05);text-align:center;">
            <p style="margin:0;color:#52525b;font-size:12px;">© Weeb-X — Аниме платформа</p>
          </div>
        </div>
      </body>
      </html>
    `

    const text = `Weeb-X — Восстановление пароля\n\nВы запросили сброс пароля.\nПерейдите по ссылке для установки нового пароля:\n${resetLink}\n\nЕсли вы не запрашивали сброс, проигнорируйте это письмо.\nСсылка действительна 1 час.`

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
