"use client"

import { useState, useEffect, useCallback } from "react"
import { useAuth } from "@/components/auth/auth-provider"
import { supabase } from "@/lib/supabase"
import { Loader2, Tv, CheckCircle2, XCircle, ShieldCheck } from "lucide-react"

export default function ActivatePage() {
  const { user, session, loading } = useAuth()
  const [pin, setPin] = useState("")
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle")
  const [message, setMessage] = useState("")

  const handleAuthorize = useCallback(async () => {
    if (!pin || pin.length !== 6) {
      setStatus("error")
      setMessage("Введите 6-значный код")
      return
    }

    if (!user || !session?.access_token) {
      setStatus("error")
      setMessage("Необходима авторизация на сайте")
      return
    }

    setStatus("submitting")
    setMessage("")

    try {
      const res = await fetch("/api/lampa/authorize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ pin }),
      })

      const data = await res.json()

      if (!res.ok) {
        setStatus("error")
        setMessage(data.message || "Ошибка активации")
        return
      }

      setStatus("success")
      setMessage("Устройство Lampa успешно привязано к вашему аккаунту!")
    } catch (err) {
      setStatus("error")
      setMessage("Сетевая ошибка. Попробуйте снова.")
    }
  }, [pin, user, session?.access_token])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="flex justify-center">
            <Tv className="w-16 h-16 text-muted-foreground" />
          </div>
          <h1 className="text-2xl font-bold">Активация Lampa</h1>
          <p className="text-muted-foreground">
            Для привязки устройства Lampa необходимо войти в аккаунт Weebx.
          </p>
          <a
            href="/?auth=login"
            className="inline-flex items-center justify-center rounded-lg bg-primary px-6 py-3 text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
          >
            Войти в аккаунт
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            {status === "success" ? (
              <CheckCircle2 className="w-16 h-16 text-green-500" />
            ) : status === "error" ? (
              <XCircle className="w-16 h-16 text-red-500" />
            ) : (
              <div className="relative">
                <Tv className="w-16 h-16 text-primary" />
                <ShieldCheck className="w-6 h-6 text-green-500 absolute -bottom-1 -right-1" />
              </div>
            )}
          </div>
          <h1 className="text-2xl font-bold">Активация Lampa</h1>
          <p className="text-muted-foreground text-sm">
            Введите 6-значный код, отображаемый на вашем ТВ в приложении Lampa
          </p>
        </div>

        {status !== "success" && (
          <div className="space-y-4">
            <div className="flex justify-center gap-2">
              <input
                type="text"
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                value={pin}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, "").slice(0, 6)
                  setPin(val)
                  setStatus("idle")
                  setMessage("")
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && pin.length === 6) handleAuthorize()
                }}
                placeholder="000000"
                className="w-48 h-16 text-center text-3xl font-mono font-bold tracking-[0.3em] rounded-xl border-2 border-border bg-background focus:border-primary focus:outline-none transition-colors"
                autoFocus
              />
            </div>

            {message && (
              <p className={`text-center text-sm ${status === "error" ? "text-red-500" : "text-muted-foreground"}`}>
                {message}
              </p>
            )}

            <button
              onClick={handleAuthorize}
              disabled={pin.length !== 6 || status === "submitting"}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 text-primary-foreground font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {status === "submitting" ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Активация...
                </>
              ) : (
                "Привязать устройство"
              )}
            </button>
          </div>
        )}

        {status === "success" && (
          <div className="text-center space-y-4">
            <p className="text-green-500 font-medium">{message}</p>
            <p className="text-muted-foreground text-sm">
              Теперь история просмотра будет синхронизироваться между Lampa и Weebx.
            </p>
            <a
              href="/"
              className="inline-flex items-center justify-center rounded-lg border border-border px-6 py-3 text-foreground font-medium hover:bg-accent transition-colors"
            >
              Вернуться на главную
            </a>
          </div>
        )}

        <div className="text-center text-xs text-muted-foreground space-y-1">
          <p>Как это работает:</p>
          <p>1. Откройте плагин Weebx в Lampa на ТВ</p>
          <p>2. На ТВ появится 6-значный код</p>
          <p>3. Введите этот код здесь</p>
          <p>4. История просмотра будет синхронизироваться автоматически</p>
        </div>
      </div>
    </div>
  )
}
