"use client"

import { useState, useEffect, useCallback } from "react"
import { useAuth } from "@/components/auth/auth-provider"

interface PushSubscription {
  endpoint: string
  keys: { p256dh: string; auth: string }
}

export function usePushNotifications() {
  const { user } = useAuth()
  const [isSupported, setIsSupported] = useState(false)
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [permission, setPermission] = useState<NotificationPermission>("default")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return
    const supported = "serviceWorker" in navigator && "PushManager" in window
    setIsSupported(supported)
    if (supported && "Notification" in window) {
      setPermission(Notification.permission)
    }
  }, [])

  const subscribe = useCallback(async () => {
    if (!isSupported || !user) return false

    setLoading(true)
    try {
      const permissionResult = await Notification.requestPermission()
      setPermission(permissionResult)
      if (permissionResult !== "granted") return false

      const reg = await navigator.serviceWorker.register("/sw.js")
      await navigator.serviceWorker.ready

      let sub = await reg.pushManager.getSubscription()
      if (!sub) {
        const res = await fetch("/api/push/vapid-public-key")
        const { publicKey } = await res.json()
        if (!publicKey) return false

        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
        })
      }

      const subscription: PushSubscription = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.getKey("p256dh") ? btoa(String.fromCharCode(...new Uint8Array(sub.getKey("p256dh")!))) : "",
          auth: sub.getKey("auth") ? btoa(String.fromCharCode(...new Uint8Array(sub.getKey("auth")!))) : "",
        },
      }

      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription, userId: user.id }),
      })

      setIsSubscribed(true)
      return true
    } catch (err) {
      console.error("Push subscription failed:", err)
      return false
    } finally {
      setLoading(false)
    }
  }, [isSupported, user])

  const unsubscribe = useCallback(async () => {
    setLoading(true)
    try {
      const reg = await navigator.serviceWorker.getRegistration()
      if (reg) {
        const sub = await reg.pushManager.getSubscription()
        if (sub) {
          await sub.unsubscribe()
          await fetch("/api/push/unsubscribe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ endpoint: sub.endpoint }),
          })
        }
      }
      setIsSubscribed(false)
      return true
    } catch (err) {
      console.error("Push unsubscribe failed:", err)
      return false
    } finally {
      setLoading(false)
    }
  }, [])

  return {
    isSupported,
    isSubscribed,
    permission,
    loading,
    subscribe,
    unsubscribe,
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const rawData = atob(base64)
  const buffer = new ArrayBuffer(rawData.length)
  const outputArray = new Uint8Array(buffer)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}
