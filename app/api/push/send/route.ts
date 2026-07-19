import { NextRequest, NextResponse } from "next/server"
import webpush from "web-push"
import { supabase } from "@/lib/supabase"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, title, message, url } = body

    if (!userId || !title) {
      return NextResponse.json({ error: "userId and title required" }, { status: 400 })
    }

    const publicKey = process.env.VAPID_PUBLIC_KEY
    const privateKey = process.env.VAPID_PRIVATE_KEY

    if (!publicKey || !privateKey) {
      return NextResponse.json({ error: "VAPID keys not configured" }, { status: 500 })
    }

    webpush.setVapidDetails(
      "mailto:admin@weeb-x.com",
      publicKey,
      privateKey
    )

    const { data: subs, error } = await supabase
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .eq("user_id", userId)

    if (error || !subs || subs.length === 0) {
      return NextResponse.json({ sent: 0 })
    }

    const payload = JSON.stringify({
      title,
      body: message,
      data: { url: url || "/" },
      tag: "episode-update",
    })

    let sentCount = 0
    const failedEndpoints: string[] = []

    for (const sub of subs) {
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      }

      try {
        await webpush.sendNotification(pushSubscription, payload)
        sentCount++
      } catch (err: any) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          failedEndpoints.push(sub.endpoint)
        }
      }
    }

    if (failedEndpoints.length > 0) {
      await supabase
        .from("push_subscriptions")
        .delete()
        .in("endpoint", failedEndpoints)
    }

    return NextResponse.json({ sent: sentCount })
  } catch (err) {
    console.error("Push send error:", err)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
