import { NextRequest, NextResponse } from "next/server"

function decodeGiftCardToken(token: string) {
  try {
    const normalized = token.replace(/-/g, "+").replace(/_/g, "/")
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4)
    const binary = Buffer.from(padded, "base64").toString("utf-8")
    JSON.parse(binary)
    return true
  } catch {
    return false
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params
  const rawToken = decodeURIComponent(token || "").trim()
  const redirectUrl = new URL("/auth/register", request.url)

  if (rawToken && decodeGiftCardToken(rawToken)) {
    redirectUrl.searchParams.set("gift_card", rawToken)
  }

  const response = NextResponse.redirect(redirectUrl)

  response.cookies.set("gift_card", rawToken, {
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  })

  return response
}
