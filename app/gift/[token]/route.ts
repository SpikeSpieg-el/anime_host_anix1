import { NextRequest, NextResponse } from "next/server"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params
  const rawToken = decodeURIComponent(token || "").trim()
  const redirectUrl = new URL("/", request.url)

  if (/^[A-Za-z0-9]{32}$/.test(rawToken)) {
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
