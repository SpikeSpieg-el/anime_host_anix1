import { NextRequest, NextResponse } from "next/server"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params
  const normalizedCode = code.trim().toLowerCase()
  const referralUrl = new URL(`/r/${encodeURIComponent(normalizedCode)}`, request.url)
  const redirectUrl = new URL("/auth/register", request.url)
  redirectUrl.searchParams.set("referral", normalizedCode)

  const response = NextResponse.redirect(redirectUrl)

  response.cookies.set("referral_code", normalizedCode, {
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  })

  const userAgent = request.headers.get("user-agent")?.toLowerCase() || ""
  const isSocialCrawler = /facebookexternalhit|twitterbot|linkedinbot|telegrambot|whatsapp|slackbot|discordbot|skypeuripreview|googlebot|yandex(bot)?/.test(userAgent)

  if (isSocialCrawler) {
    const title = "Пригласи друга в Weeb-X и получи 2000 монет"
    const description = "Регистрируйся по реферальной ссылке Weeb-X. Ты и твой друг получите по 2000 монет."
    const escapeHtml = (value: string) =>
      value.replace(/[&<>"']/g, (character) => (
        { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character] || character
      ))

    return new NextResponse(
      `<!doctype html>
<html lang="ru">
  <head>
    <meta charset="utf-8">
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}">
    <meta property="og:type" content="website">
    <meta property="og:url" content="${referralUrl.toString()}">
    <meta property="og:title" content="${escapeHtml(title)}">
    <meta property="og:description" content="${escapeHtml(description)}">
    <meta property="og:image" content="${new URL("/og-image.png", request.url).toString()}">
    <meta property="og:site_name" content="Weeb-X">
    <meta property="og:locale" content="ru_RU">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${escapeHtml(title)}">
    <meta name="twitter:description" content="${escapeHtml(description)}">
    <meta name="twitter:image" content="${new URL("/og-image.png", request.url).toString()}">
    <meta http-equiv="refresh" content="0;url=${escapeHtml(redirectUrl.toString())}">
  </head>
  <body><a href="${escapeHtml(redirectUrl.toString())}">Перейти к регистрации</a></body>
</html>`,
      {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "X-Robots-Tag": "noindex, nofollow",
        },
      },
    )
  }

  return response
}
