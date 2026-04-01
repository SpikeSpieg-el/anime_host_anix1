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

  const { data: rpcData, error: rpcErr } = await supabaseAdmin.rpc("market_execute_purchase", {
    p_listing_id: listingId,
    p_buyer_id: user.id,
  })

  if (rpcErr) {
    console.error("[market/buy]", rpcErr)
    return NextResponse.json({ error: "Purchase failed" }, { status: 500 })
  }

  const result = rpcData as {
    ok?: boolean
    error?: string
    need?: number
    have?: number
  }

  if (!result?.ok) {
    if (result?.error === "insufficient_coins") {
      return NextResponse.json(
        { error: "insufficient_coins", need: result.need, have: result.have },
        { status: 402 }
      )
    }
    if (result?.error === "own_listing") {
      return NextResponse.json({ error: "own_listing" }, { status: 400 })
    }
    if (result?.error === "listing_not_found") {
      return NextResponse.json({ error: "listing_not_found" }, { status: 404 })
    }
    return NextResponse.json({ error: result?.error || "purchase_rejected" }, { status: 409 })
  }

  return NextResponse.json({ success: true })
}
