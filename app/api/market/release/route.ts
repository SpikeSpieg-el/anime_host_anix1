import { NextResponse } from "next/server"
import { getMarketAuth } from "@/app/api/market/_auth"

export async function POST(request: Request) {
  const auth = await getMarketAuth(request)
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: { listingId?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const listingId = body.listingId
  if (!listingId || typeof listingId !== "string") {
    return NextResponse.json({ error: "listingId required" }, { status: 400 })
  }

  const { user, supabaseAdmin } = auth

  const { error: rpcErr } = await supabaseAdmin.rpc("market_release_reservation", {
    p_listing_id: listingId,
    p_user_id: user.id,
  })

  if (rpcErr) {
    console.error("[market/release]", rpcErr)
    return NextResponse.json({ error: "Release failed" }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
