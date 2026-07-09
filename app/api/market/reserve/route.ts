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

  const { data: rpcData, error: rpcErr } = await supabaseAdmin.rpc("market_reserve_listing", {
    p_listing_id: listingId,
    p_user_id: user.id,
  })

  if (rpcErr) {
    console.error("[market/reserve]", rpcErr)
    return NextResponse.json({ error: "Reserve failed" }, { status: 500 })
  }

  const result = rpcData as { ok?: boolean; error?: string }

  if (!result?.ok) {
    if (result?.error === "listing_not_found") {
      return NextResponse.json({ error: "listing_not_found" }, { status: 404 })
    }
    if (result?.error === "already_reserved") {
      return NextResponse.json({ error: "already_reserved" }, { status: 409 })
    }
    return NextResponse.json({ error: result?.error || "reserve_rejected" }, { status: 409 })
  }

  return NextResponse.json({ success: true, expiresIn: 15 })
}
