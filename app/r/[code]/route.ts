import { NextRequest, NextResponse } from "next/server"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params
  const normalizedCode = code.trim().toLowerCase()
  const redirectUrl = new URL("/auth/register", request.url)
  const response = NextResponse.redirect(redirectUrl)

  response.cookies.set("referral_code", normalizedCode, {
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  })

  return response
}
