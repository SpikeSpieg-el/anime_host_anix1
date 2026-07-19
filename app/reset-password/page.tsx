"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2, Lock, CheckCircle2, AlertCircle, KeyRound } from "lucide-react"

export default function ResetPasswordPage() {
  const router = useRouter()
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [verifying, setVerifying] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    const checkSession = async () => {
      // First try to get existing session (in case detectSessionInUrl already processed it)
      let { data, error } = await supabase.auth.getSession()

      if (!data.session) {
        // Manually parse hash for access_token and refresh_token
        // Supabase recovery links use implicit flow: #access_token=...&refresh_token=...
        const hash = window.location.hash.substring(1)
        const params = new URLSearchParams(hash)
        const accessToken = params.get("access_token")
        const refreshToken = params.get("refresh_token")
        const type = params.get("type")

        if (accessToken && refreshToken && type === "recovery") {
          const result = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })
          data = result.data
          error = result.error

          // Clean the URL hash for security
          window.history.replaceState(null, "", window.location.pathname)
        }
      }

      if (error || !data.session) {
        setError("Ссылка недействительна или истекла. Запросите новую ссылку для сброса пароля.")
        setVerifying(false)
        return
      }

      setVerifying(false)
    }

    checkSession()
  }, [])

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (newPassword.length < 6) {
      setError("Пароль должен содержать минимум 6 символов")
      return
    }

    if (newPassword !== confirmPassword) {
      setError("Пароли не совпадают")
      return
    }

    setLoading(true)

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      })

      if (error) {
        setError(error.message || "Не удалось обновить пароль")
        return
      }

      setSuccess(true)

      setTimeout(async () => {
        await supabase.auth.signOut()
        router.push("/")
      }, 3000)
    } catch (err: any) {
      setError(err.message || "Произошла ошибка")
    } finally {
      setLoading(false)
    }
  }

  if (verifying) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#09090b] px-4">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-orange-500 mx-auto mb-4" />
          <p className="text-zinc-400">Проверка ссылки...</p>
        </div>
      </div>
    )
  }

  if (error && !newPassword) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#09090b] px-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="mx-auto w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center mb-4 border border-red-500/20">
              <AlertCircle className="w-7 h-7 text-red-500" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Ошибка</h1>
            <p className="text-zinc-400 text-sm">{error}</p>
          </div>
          <Button
            onClick={() => router.push("/")}
            className="w-full h-12 bg-white/5 border border-white/10 text-white hover:bg-white/10 font-medium rounded-xl"
          >
            На главную
          </Button>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#09090b] px-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="mx-auto w-14 h-14 rounded-full bg-green-500/10 flex items-center justify-center mb-4 border border-green-500/20">
              <CheckCircle2 className="w-7 h-7 text-green-500" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Пароль обновлён!</h1>
            <p className="text-zinc-400 text-sm">
              Вы будете перенаправлены на главную страницу для входа с новым паролем.
            </p>
          </div>
          <div className="flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#09090b] px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="mx-auto w-14 h-14 rounded-full bg-white/5 flex items-center justify-center mb-4 border border-white/10 ring-1 ring-white/5">
            <KeyRound className="w-7 h-7 text-orange-500" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white mb-2">
            Новый пароль
          </h1>
          <p className="text-zinc-400 text-sm">
            Придумайте новый пароль для вашего аккаунта
          </p>
        </div>

        <form onSubmit={handleUpdatePassword} className="space-y-5">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-3 text-red-400 text-sm">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-1 group">
            <label className="text-xs font-medium text-zinc-500 ml-1 group-focus-within:text-orange-500 transition-colors">
              Новый пароль
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-5 w-5 text-zinc-500 group-focus-within:text-orange-500 transition-colors" />
              <Input
                type="password"
                placeholder="••••••••"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="pl-10 h-12 bg-white/5 border-white/10 text-white placeholder:text-zinc-600 focus:bg-white/10 focus:border-orange-500/50 focus:ring-orange-500/20 transition-all rounded-xl"
                required
                minLength={6}
                autoFocus
              />
            </div>
          </div>

          <div className="space-y-1 group">
            <label className="text-xs font-medium text-zinc-500 ml-1 group-focus-within:text-orange-500 transition-colors">
              Подтвердите пароль
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-5 w-5 text-zinc-500 group-focus-within:text-orange-500 transition-colors" />
              <Input
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="pl-10 h-12 bg-white/5 border-white/10 text-white placeholder:text-zinc-600 focus:bg-white/10 focus:border-orange-500/50 focus:ring-orange-500/20 transition-all rounded-xl"
                required
                minLength={6}
              />
            </div>
          </div>

          <Button
            type="submit"
            className="w-full h-12 bg-orange-500 text-white hover:bg-orange-600 font-semibold text-base rounded-xl shadow-lg shadow-orange-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
            disabled={loading}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Сохранение...
              </span>
            ) : (
              "Сохранить новый пароль"
            )}
          </Button>
        </form>
      </div>
    </div>
  )
}
