"use client"

import { useState, useEffect, useCallback } from "react"
import { useAuth } from "@/components/auth/auth-provider"

interface PushSubscription {
  endpoint: string
  keys: { p256dh: string; auth: string }
}

export type PushErrorReason =
  | "unsupported"
  | "not-logged-in"
  | "permission-denied"
  | "permission-dismissed"
  | "no-notification-api"
  | "sw-registration-failed"
  | "no-vapid-key"
  | "push-subscribe-failed"
  | "save-failed"
  | "not-secure-context"
  | "unknown"

export function usePushNotifications() {
  const { user } = useAuth()
  const [isSupported, setIsSupported] = useState(false)
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [permission, setPermission] = useState<NotificationPermission>("default")
  const [loading, setLoading] = useState(false)
  const [errorReason, setErrorReason] = useState<PushErrorReason | null>(null)

  useEffect(() => {
    if (typeof window === "undefined") return
    const supported = "serviceWorker" in navigator && "PushManager" in window
    setIsSupported(supported)
    if ("Notification" in window) {
      setPermission(Notification.permission)
    }

    if (supported && navigator.serviceWorker) {
      navigator.serviceWorker.ready
        .then(async (reg) => {
          try {
            const sub = await reg.pushManager.getSubscription()
            if (sub) setIsSubscribed(true)
          } catch {
            // ignore
          }
        })
        .catch(() => {})
    }
  }, [])

  const subscribe = useCallback(async (): Promise<{ ok: boolean; reason?: PushErrorReason }> => {
    setErrorReason(null)

    if (!isSupported) {
      setErrorReason("unsupported")
      return { ok: false, reason: "unsupported" }
    }

    if (!user) {
      setErrorReason("not-logged-in")
      return { ok: false, reason: "not-logged-in" }
    }

    if (typeof window !== "undefined" && window.isSecureContext === false) {
      setErrorReason("not-secure-context")
      return { ok: false, reason: "not-secure-context" }
    }

    if (!("Notification" in window)) {
      setErrorReason("no-notification-api")
      return { ok: false, reason: "no-notification-api" }
    }

    setLoading(true)
    try {
      const currentPermission = Notification.permission
      setPermission(currentPermission)

      if (currentPermission === "denied") {
        setErrorReason("permission-denied")
        return { ok: false, reason: "permission-denied" }
      }

      if (currentPermission !== "granted") {
        const permissionResult = await Notification.requestPermission()
        setPermission(permissionResult)

        if (permissionResult === "denied") {
          setErrorReason("permission-denied")
          return { ok: false, reason: "permission-denied" }
        }
        if (permissionResult !== "granted") {
          setErrorReason("permission-dismissed")
          return { ok: false, reason: "permission-dismissed" }
        }
      }

      let reg: ServiceWorkerRegistration
      try {
        reg = await navigator.serviceWorker.register("/sw.js")
        await navigator.serviceWorker.ready
      } catch (swErr) {
        console.error("SW registration failed:", swErr)
        setErrorReason("sw-registration-failed")
        return { ok: false, reason: "sw-registration-failed" }
      }

      let sub = await reg.pushManager.getSubscription()
      if (!sub) {
        const res = await fetch("/api/push/vapid-public-key")
        const data = await res.json()
        if (!data.publicKey) {
          setErrorReason("no-vapid-key")
          return { ok: false, reason: "no-vapid-key" }
        }

        try {
          sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(data.publicKey) as BufferSource,
          })
        } catch (subErr) {
          console.error("pushManager.subscribe failed:", subErr)
          setErrorReason("push-subscribe-failed")
          return { ok: false, reason: "push-subscribe-failed" }
        }
      }

      const subscription: PushSubscription = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.getKey("p256dh") ? btoa(String.fromCharCode(...new Uint8Array(sub.getKey("p256dh")!))) : "",
          auth: sub.getKey("auth") ? btoa(String.fromCharCode(...new Uint8Array(sub.getKey("auth")!))) : "",
        },
      }

      try {
        const saveRes = await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subscription, userId: user.id }),
        })
        if (!saveRes.ok) {
          const saveErr = await saveRes.text()
          console.error("Save subscription failed:", saveErr)
          setErrorReason("save-failed")
          return { ok: false, reason: "save-failed" }
        }
      } catch (saveErr) {
        console.error("Save subscription network error:", saveErr)
        setErrorReason("save-failed")
        return { ok: false, reason: "save-failed" }
      }

      setIsSubscribed(true)
      return { ok: true }
    } catch (err) {
      console.error("Push subscription unexpected error:", err)
      setErrorReason("unknown")
      return { ok: false, reason: "unknown" }
    } finally {
      setLoading(false)
    }
  }, [isSupported, user])

  const unsubscribe = useCallback(async () => {
    setLoading(true)
    try {
      let unsubscribed = false
      let endpoint: string | null = null

      try {
        const reg = await navigator.serviceWorker.getRegistration()
        if (reg) {
          const sub = await reg.pushManager.getSubscription()
          if (sub) {
            endpoint = sub.endpoint
            await sub.unsubscribe()
            unsubscribed = true
          }
        }
      } catch (e) {
        console.warn("SW getSubscription failed during unsubscribe:", e)
      }

      if (endpoint) {
        try {
          await fetch("/api/push/unsubscribe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ endpoint }),
          })
        } catch (e) {
          console.warn("Server unsubscribe failed:", e)
        }
      }

      setIsSubscribed(false)
      return true
    } catch (err) {
      console.error("Push unsubscribe failed:", err)
      setIsSubscribed(false)
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
    errorReason,
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
