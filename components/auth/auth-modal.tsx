"use client"

import { useState } from "react"
import { supabase } from "@/lib/supabase"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2, Mail, Lock, LogIn, UserPlus, AlertCircle, X, KeyRound, CheckCircle2, ArrowLeft } from "lucide-react"
import { loggers } from "@/lib/logger"
import { useToast } from "@/hooks/use-toast"
import { dispatchGiftCardReceived } from "@/lib/gift-card-events"
import type { Card } from "@/app/gacha/types"

function decodeGiftCardToken(token: string | null) {
  if (!token) return null

  try {
    const normalized = token.replace(/-/g, "+").replace(/_/g, "/")
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4)
    const binary = atob(padded)
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
    return JSON.parse(new TextDecoder().decode(bytes))
  } catch {
    return null
  }
}

function getGiftCardToken() {
  const queryToken = new URLSearchParams(window.location.search).get("gift_card")
  const cookieValue = document.cookie
    .split("; ")
    .find((cookie) => cookie.startsWith("gift_card="))
    ?.substring("gift_card=".length)
  const token = queryToken || cookieValue || null

  return token && /^[A-Za-z0-9]{32}$/.test(token) ? token : null
}

async function claimGiftCard(token: string, accessToken: string) {
  const response = await fetch("/api/gift/claim", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ token }),
  })

  if (!response.ok) {
    throw new Error("Не удалось добавить подарочную карту")
  }

  return response.json() as Promise<{ alreadyClaimed?: boolean; card?: Card }>
}

function userFacingAuthError(err: unknown): string {
  const e = err as { message?: string; status?: number; code?: string } | null
  const msg = (e?.message || "").trim()
  const lower = msg.toLowerCase()

  if (
    lower.includes("invalid login credentials") ||
    lower.includes("invalid_grant") ||
    e?.code === "invalid_credentials"
  ) {
    return "Неверный email или пароль"
  }
  if (lower.includes("email not confirmed")) {
    return "Подтвердите email по ссылке из письма (или отключите подтверждение в Supabase для разработки)"
  }
  if (lower.includes("user already registered")) {
    return "Пользователь с таким email уже зарегистрирован"
  }
  if (lower.includes("password should be") || lower.includes("password is known to be weak")) {
    return "Пароль слишком слабый. Задайте более длинный пароль"
  }
  if (lower.includes("signup is disabled") || lower.includes("email signups are disabled")) {
    return "Регистрация по email отключена в настройках проекта Supabase"
  }
  if (e?.status === 400 && !msg) {
    return "Запрос отклонён (400). Проверьте URL проекта и ключи в .env, включите Email в Authentication → Providers"
  }
  return msg || "Не удалось выполнить вход. Проверьте данные или настройки Supabase Auth"
}

interface AuthModalProps {
  isOpen?: boolean
  onClose?: (open: boolean) => void
  children?: React.ReactNode
  initialMode?: "login" | "register"
}

export function AuthModal({
  isOpen: externalIsOpen,
  onClose,
  children,
  initialMode = "login",
}: AuthModalProps = {}) {
  const [internalIsOpen, setInternalIsOpen] = useState(false)
  const [isLogin, setIsLogin] = useState(initialMode === "login")
  const [isForgot, setIsForgot] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resetSent, setResetSent] = useState(false)
  const { toast } = useToast()

  const isOpen = externalIsOpen !== undefined ? externalIsOpen : internalIsOpen
  const setIsOpen = onClose || setInternalIsOpen

  const resetForm = () => {
    setEmail("")
    setPassword("")
    setError(null)
    setLoading(false)
    setResetSent(false)
    setIsForgot(false)
  }

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const emailTrim = email.trim()
    const passwordTrim = password.trim()

    // Basic validation
    if (!emailTrim || !passwordTrim) {
      setError("Email и пароль обязательны")
      setLoading(false)
      return
    }

    if (!emailTrim.includes('@') || !emailTrim.includes('.')) {
      setError("Введите корректный email адрес")
      setLoading(false)
      return
    }

    if (passwordTrim.length < 6) {
      setError("Пароль должен содержать минимум 6 символов")
      setLoading(false)
      return
    }

    try {
      if (isLogin) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: emailTrim,
          password: passwordTrim,
        })

        if (error) {
          loggers.auth.warn("signInWithPassword", {
            message: error.message,
            status: error.status,
            code: (error as { code?: string }).code,
          })
          setError(userFacingAuthError(error))
          return
        }

        const giftCardToken = getGiftCardToken()
        if (giftCardToken && data.session?.access_token) {
          try {
            const claimResult = await claimGiftCard(giftCardToken, data.session.access_token)
            if (!claimResult.alreadyClaimed) {
              if (claimResult.card) dispatchGiftCardReceived(claimResult.card)
              toast({
                title: "Подарок получен!",
                description: "Карта добавлена в вашу коллекцию.",
              })
            }
            document.cookie = "gift_card=; path=/; max-age=0"
          } catch (claimError) {
            loggers.auth.warn("claimGiftCard after sign in", claimError)
            setError("Вход выполнен, но подарочную карту не удалось добавить. Откройте ссылку ещё раз после входа.")
            return
          }
        }

        setIsOpen(false)
      } else {
        const referralCookie = document.cookie
          .split("; ")
          .find((cookie) => cookie.startsWith("referral_code="))
        const referralCode = referralCookie
          ? decodeURIComponent(referralCookie.substring("referral_code=".length))
          : null

        const rawGiftCardToken = getGiftCardToken()
        const giftCardValue = rawGiftCardToken && /^[A-Za-z0-9]{32}$/.test(rawGiftCardToken)
          ? rawGiftCardToken
          : decodeGiftCardToken(rawGiftCardToken)

        const { data, error } = await supabase.auth.signUp({
          email: emailTrim,
          password: passwordTrim,
          options: {
            data: {
              referral_code: referralCode,
              gift_card: giftCardValue ? JSON.stringify(giftCardValue) : null,
            },
          },
        })

        if (error) {
          loggers.auth.warn("signUp", {
            message: error.message,
            status: error.status,
            code: (error as { code?: string }).code,
          })
          setError(userFacingAuthError(error))
          return
        }

        // Если пользователь создан успешно - закрываем модалку
        // Email confirmation handled by Supabase settings
        if (data.user) {
          if (rawGiftCardToken && data.session?.access_token) {
            try {
              const claimResult = await claimGiftCard(rawGiftCardToken, data.session.access_token)
              if (claimResult.card) dispatchGiftCardReceived(claimResult.card)
              toast({
                title: "Подарок получен!",
                description: "Карта добавлена в вашу коллекцию.",
              })
            } catch (claimError) {
              loggers.auth.warn("claimGiftCard after sign up", claimError)
              setError("Аккаунт создан, но подарочную карту не удалось добавить. Откройте ссылку ещё раз после входа.")
              return
            }
          }

          document.cookie = "referral_code=; path=/; max-age=0"
          document.cookie = "gift_card=; path=/; max-age=0"
          setIsOpen(false)
        } else {
          setError('Не удалось создать аккаунт. Попробуйте снова.')
        }
      }
    } catch (err: any) {
      loggers.auth.warn("Auth error:", err)
      setError(userFacingAuthError(err))
    } finally {
      setLoading(false)
    }
  }

  const toggleMode = () => {
    setIsLogin(!isLogin)
    setError(null)
    setPassword("")
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const emailTrim = email.trim()
    if (!emailTrim || !emailTrim.includes('@') || !emailTrim.includes('.')) {
      setError("Введите корректный email адрес")
      setLoading(false)
      return
    }

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailTrim }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || "Не удалось отправить письмо")
        return
      }

      setResetSent(true)
    } catch (err: any) {
      loggers.auth.warn("Reset password error:", err)
      setError("Не удалось отправить письмо. Попробуйте позже.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      setIsOpen(open)
      if (!open) resetForm()
    }}>
      {children || (
        <DialogTrigger asChild>
          <Button variant="ghost" className="w-9 h-9 md:w-10 md:h-10 gap-2 text-zinc-400 hover:text-white transition-colors rounded-full">
            <LogIn className="w-4 h-4" />
            <span className="hidden sm:inline font-medium">Войти</span>
          </Button>
        </DialogTrigger>
      )}

      <DialogContent className="overflow-hidden p-0 bg-[#09090b] border border-white/10 text-white sm:max-w-[420px] shadow-2xl shadow-orange-500/5">
        <DialogDescription className="sr-only">
          {isLogin ? "Форма входа в систему" : "Форма регистрации нового пользователя"}
        </DialogDescription>
        
        {/* Декоративный градиент на фоне */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-32 bg-gradient-to-b from-orange-500/10 to-transparent pointer-events-none" />

        <div className="relative p-8">

          {isForgot ? (
            <>
              <DialogHeader className="mb-8 text-center">
                <div className="mx-auto w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-4 border border-white/10 ring-1 ring-white/5">
                  <KeyRound className="w-6 h-6 text-orange-500" />
                </div>
                <DialogTitle className="text-2xl font-bold tracking-tight text-white">
                  Восстановление пароля
                </DialogTitle>
                <p className="text-zinc-400 text-sm mt-2">
                  Введите email — мы отправим ссылку для сброса пароля
                </p>
              </DialogHeader>

              {resetSent ? (
                <div className="space-y-6">
                  <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg flex items-start gap-3 text-green-400 text-sm">
                    <CheckCircle2 className="w-5 h-5 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium">Письмо отправлено!</p>
                      <p className="text-zinc-400 mt-1">Проверьте почту <span className="text-white font-medium">{email}</span> и перейдите по ссылке для сброса пароля.</p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    onClick={() => { setIsForgot(false); setResetSent(false); }}
                    className="w-full h-12 bg-white/5 border border-white/10 text-white hover:bg-white/10 font-medium rounded-xl transition-all"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Вернуться ко входу
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleResetPassword} className="space-y-5">
                  {error && (
                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-3 text-red-400 text-sm animate-in fade-in slide-in-from-top-2">
                      <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}

                  <div className="space-y-1 group">
                    <label className="text-xs font-medium text-zinc-500 ml-1 group-focus-within:text-orange-500 transition-colors">Email</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-5 w-5 text-zinc-500 group-focus-within:text-orange-500 transition-colors" />
                      <Input
                        type="email"
                        placeholder="name@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-10 h-12 bg-white/5 border-white/10 text-white placeholder:text-zinc-600 focus:bg-white/10 focus:border-orange-500/50 focus:ring-orange-500/20 transition-all rounded-xl"
                        required
                        autoFocus
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
                        Отправка...
                      </span>
                    ) : (
                      "Отправить ссылку"
                    )}
                  </Button>

                  <div className="text-center">
                    <button
                      type="button"
                      onClick={() => { setIsForgot(false); setError(null); }}
                      className="text-sm text-zinc-400 hover:text-white transition-colors font-medium"
                    >
                      <ArrowLeft className="w-4 h-4 inline mr-1" />
                      Вернуться ко входу
                    </button>
                  </div>
                </form>
              )}
            </>
          ) : (
            <>
              <DialogHeader className="mb-8 text-center">
                <div className="mx-auto w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-4 border border-white/10 ring-1 ring-white/5">
                  {isLogin ? (
                    <LogIn className="w-6 h-6 text-orange-500" />
                  ) : (
                    <UserPlus className="w-6 h-6 text-orange-500" />
                  )}
                </div>
                <DialogTitle className="text-2xl font-bold tracking-tight text-white">
                  {isLogin ? "Добро пожаловать" : "Создать аккаунт"}
                </DialogTitle>
                <p className="text-zinc-400 text-sm mt-2">
                  {isLogin 
                    ? "Введите свои данные для входа в систему" 
                    : "Зарегистрируйтесь, чтобы получить доступ ко всем функциям"
                  }
                </p>
              </DialogHeader>

              <form onSubmit={handleAuth} className="space-y-5">
                {error && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-3 text-red-400 text-sm animate-in fade-in slide-in-from-top-2">
                    <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <div className="space-y-1 group">
                  <label className="text-xs font-medium text-zinc-500 ml-1 group-focus-within:text-orange-500 transition-colors">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-5 w-5 text-zinc-500 group-focus-within:text-orange-500 transition-colors" />
                    <Input
                      type="email"
                      placeholder="name@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10 h-12 bg-white/5 border-white/10 text-white placeholder:text-zinc-600 focus:bg-white/10 focus:border-orange-500/50 focus:ring-orange-500/20 transition-all rounded-xl"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1 group">
                  <label className="text-xs font-medium text-zinc-500 ml-1 group-focus-within:text-orange-500 transition-colors">Пароль</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-5 w-5 text-zinc-500 group-focus-within:text-orange-500 transition-colors" />
                    <Input
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10 h-12 bg-white/5 border-white/10 text-white placeholder:text-zinc-600 focus:bg-white/10 focus:border-orange-500/50 focus:ring-orange-500/20 transition-all rounded-xl"
                      required
                      minLength={6}
                    />
                  </div>
                </div>

                {isLogin && (
                  <div className="text-right">
                    <button
                      type="button"
                      onClick={() => { setIsForgot(true); setError(null); }}
                      className="text-xs text-zinc-500 hover:text-orange-500 transition-colors font-medium"
                    >
                      Забыли пароль?
                    </button>
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full h-12 bg-white text-black hover:bg-zinc-200 font-semibold text-base rounded-xl shadow-lg shadow-white/10 transition-all hover:scale-[1.02] active:scale-[0.98]"
                  disabled={loading}
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Обработка...
                    </span>
                  ) : (
                    isLogin ? "Войти" : "Зарегистрироваться"
                  )}
                </Button>
              </form>

              <div className="mt-6 text-center">
                <button
                  type="button"
                  onClick={toggleMode}
                  className="text-sm text-zinc-400 hover:text-white transition-colors font-medium"
                >
                  {isLogin ? "Нет аккаунта? " : "Уже есть аккаунт? "}
                  <span className="text-orange-500 hover:text-orange-400">
                    {isLogin ? "Создать" : "Войти"}
                  </span>
                </button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}