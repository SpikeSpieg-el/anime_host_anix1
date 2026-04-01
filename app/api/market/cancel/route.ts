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

  const { data: rpcData, error: rpcErr } = await supabaseAdmin.rpc("market_cancel_listing", {
    p_seller_id: user.id,
    p_listing_id: listingId,
  })

  if (rpcErr) {
    console.error("[market/cancel]", rpcErr)
    return NextResponse.json({ error: "Cancel failed" }, { status: 500 })
  }

  const result = rpcData as { ok?: boolean; error?: string }
  if (!result?.ok) {
    const status = result?.error === "listing_not_found" ? 404 : 409
    return NextResponse.json({ error: result?.error || "cancel_rejected" }, { status })
  }

  return NextResponse.json({ success: true })
}
