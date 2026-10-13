"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { AnimeSliderCaptcha } from "@/components/auth/anime-slider-captcha"
import { Loader2, Mail, Lock, LogIn, UserPlus, AlertCircle, KeyRound, CheckCircle2, ArrowLeft, AtSign, ShieldCheck } from "lucide-react"
import { loggers } from "@/lib/logger"
import { useToast } from "@/hooks/use-toast"
import { useConsent } from "@/components/providers/consent-provider"
import { useAuth } from "@/components/auth/auth-provider"
import { dispatchGiftCardReceived } from "@/lib/gift-card-events"
import { AnalyticsEvent, getSignupAttribution, identifyUser, trackEvent } from "@/lib/analytics"
import { consumeGuestHookAuthSource } from "@/lib/guest-hooks"
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

/**
 * Шаги формы.
 *
 * captcha     — пазл показывается ПЕРВЫМ, до полей ввода. Так его нельзя
 *              пропустить, не потеряв введённые данные, и бот упирается в
 *              пазл, а не в форму (парсенгулярные бота чаще чинят email'ы).
 * credentials — email и пароль.
 * nickname    — необязательный ник сразу после создания аккаунта. Без него
 *              profiles.username остаётся равен email, и в шапке сайта потом
 *              светится почтовый адрес вместо имени.
 */
type AuthStep = "captcha" | "credentials" | "nickname"

const NICKNAME_MIN = 2
const NICKNAME_MAX = 24

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
  const [step, setStep] = useState<AuthStep>("captcha")
  /**
   * Меняется, чтобы перемонтировать <AnimeSliderCaptcha/> и получить новый
   * пазл. Ключ react, а не ref: у капчи нет публичного сброса, а пересоздать
   * компонент — единственный способ сбросить и картинку, и токен.
   */
  const [captchaNonce, setCaptchaNonce] = useState(0)
  const [nickname, setNickname] = useState("")
  /** id свежесозданного пользователя — для записи ника в profiles. */
  const [pendingUserId, setPendingUserId] = useState<string | null>(null)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resetSent, setResetSent] = useState(false)
  const { toast } = useToast()
  const { consent, hasConsent } = useConsent()
  const { refreshProfile } = useAuth()

  const isOpen = externalIsOpen !== undefined ? externalIsOpen : internalIsOpen
  const setIsOpen = onClose || setInternalIsOpen

  const isControlled = externalIsOpen !== undefined || onClose !== undefined

  useEffect(() => {
    if (isOpen) {
      setIsLogin(initialMode === "login")
      setIsForgot(false)
      setStep("captcha")
      setCaptchaToken(null)
      setCaptchaNonce((n) => n + 1)
    }
  }, [isOpen, initialMode])

  /** Полный сброс формы — при закрытии модалки. */
  const resetForm = () => {
    setEmail("")
    setPassword("")
    setCaptchaToken(null)
    setCaptchaNonce((n) => n + 1)
    setNickname("")
    setPendingUserId(null)
    setStep("captcha")
    setError(null)
    setLoading(false)
    setResetSent(false)
    setIsForgot(false)
  }

  /** Вернуться к пазлу: он пересоздаётся, иначе остаётся уже решённым. */
  const backToCaptcha = () => {
    setStep("captcha")
    setCaptchaToken(null)
    setCaptchaNonce((n) => n + 1)
    setError(null)
  }

  const finishAuth = () => {
    setIsOpen(false)
  }

  /** Запись ника в profiles. Ошибка не блокирует выход — ник необязательный. */
  const saveNickname = async (userId: string) => {
    const name = nickname.trim().replace(/\s+/g, " ")
    if (name.length >= NICKNAME_MIN) {
      try {
        const { error: updateError } = await supabase
          .from("profiles")
          .update({ username: name, updated_at: new Date().toISOString() })
          .eq("id", userId)

        if (updateError) {
          // Не роняем регистрацию из-за ника: аккаунт уже создан.
          loggers.auth.warn("saveNickname", updateError.message)
        } else {
          await refreshProfile()
        }
      } catch (updateError) {
        loggers.auth.warn("saveNickname", updateError)
      }
    }
    finishAuth()
  }

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const emailTrim = email.trim()
    const passwordTrim = password.trim()

    if (!emailTrim || !passwordTrim) {
      setError("Email и пароль обязательны")
      setLoading(false)
      return
    }

    if (!emailTrim.includes("@") || !emailTrim.includes(".")) {
      setError("Введите корректный email адрес")
      setLoading(false)
      return
    }

    if (passwordTrim.length < 6) {
      setError("Пароль должен содержать минимум 6 символов")
      setLoading(false)
      return
    }

    if (!captchaToken) {
      // Капча — первый шаг, поэтому сюда мы попадать не должны. Но если
      // токен протух (TTL 5 минут) — возвращаем на пазл, а не ругаемся
      // в форме, где его и не видно.
      backToCaptcha()
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

        if (data.user && data.session) {
          identifyUser(`supabase:${data.user.id}`)
          const hookSource = consumeGuestHookAuthSource()
          trackEvent(AnalyticsEvent.AUTH_SIGN_IN, {
            method: "email",
            ...(hookSource
              ? { hook_id: hookSource.hook_id, hook_trigger: hookSource.trigger ?? null }
              : {}),
          })
        }

        const giftCardToken = getGiftCardToken()
        if (giftCardToken && data.session?.access_token) {
          try {
            const claimResult = await claimGiftCard(giftCardToken, data.session.access_token)
            trackEvent(
              claimResult.alreadyClaimed
                ? AnalyticsEvent.GIFT_CARD_ALREADY_CLAIMED
                : AnalyticsEvent.GIFT_CARD_REDEEM,
              {
                context: "sign_in",
                already_claimed: Boolean(claimResult.alreadyClaimed),
              }
            )
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
            setError(
              "Вход выполнен, но подарочную карту не удалось добавить. Откройте ссылку ещё раз после входа."
            )
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
        const giftCardValue =
          rawGiftCardToken && /^[A-Za-z0-9]{32}$/.test(rawGiftCardToken)
            ? rawGiftCardToken
            : decodeGiftCardToken(rawGiftCardToken)

        const { data, error } = await supabase.auth.signUp({
          email: emailTrim,
          password: passwordTrim,
          options: {
            data: {
              referral_code: referralCode,
              gift_card: giftCardValue ? JSON.stringify(giftCardValue) : null,
              // Store first-touch attribution only when the visitor opted into analytics.
              ...(hasConsent && consent?.analytics ? getSignupAttribution() : {}),
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

        if (data.user) {
          if (data.session) identifyUser(`supabase:${data.user.id}`)
          const hookSource = consumeGuestHookAuthSource()
          trackEvent(AnalyticsEvent.AUTH_SIGN_UP, {
            confirmation_required: !data.session,
            method: "email",
            has_referral: Boolean(referralCode),
            has_gift: Boolean(rawGiftCardToken),
            ...(hookSource
              ? { hook_id: hookSource.hook_id, hook_trigger: hookSource.trigger ?? null }
              : {}),
          })
          let giftCardClaimed = false
          if (rawGiftCardToken && data.session?.access_token) {
            try {
              const claimResult = await claimGiftCard(rawGiftCardToken, data.session.access_token)
              trackEvent(
                claimResult.alreadyClaimed
                  ? AnalyticsEvent.GIFT_CARD_ALREADY_CLAIMED
                  : AnalyticsEvent.GIFT_CARD_REDEEM,
                {
                  context: "sign_up",
                  already_claimed: Boolean(claimResult.alreadyClaimed),
                }
              )
              if (claimResult.card) dispatchGiftCardReceived(claimResult.card)
              toast({
                title: "Подарок получен!",
                description: "Карта добавлена в вашу коллекцию.",
              })
              giftCardClaimed = true
            } catch (claimError) {
              loggers.auth.warn("claimGiftCard after sign up", claimError)
              setError(
                "Аккаунт создан, но подарочную карту не удалось добавить. Откройте ссылку ещё раз после входа."
              )
              return
            }
          }

          document.cookie = "referral_code=; path=/; max-age=0"
          if (!rawGiftCardToken || giftCardClaimed) {
            document.cookie = "gift_card=; path=/; max-age=0"
          }

          // Ник предлагаем только когда есть сессия — то есть подтверждение
          // email отключено и мы можем писать в profiles от его имени.
          // При включённом подтверждении пользователь ещё не вошёл, и RLS
          // (auth.uid() = id) не пустит UPDATE: тогда просто закрываем окно,
          // ник можно будет задать в настройках.
          if (data.session) {
            setPendingUserId(data.user.id)
            setNickname("")
            setStep("nickname")
          } else {
            setIsOpen(false)
          }
        } else {
          setError("Не удалось создать аккаунт. Попробуйте снова.")
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
    // Смена режима тоже возвращает на пазл: токен второй раз не пройдёт.
    backToCaptcha()
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const emailTrim = email.trim()
    if (!emailTrim || !emailTrim.includes("@") || !emailTrim.includes(".")) {
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

      trackEvent(AnalyticsEvent.AUTH_PASSWORD_RESET)
      setResetSent(true)
    } catch (err: any) {
      loggers.auth.warn("Reset password error:", err)
      setError("Не удалось отправить письмо. Попробуйте позже.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        setIsOpen(open)
        if (!open) resetForm()
      }}
    >
      {children ??
        (!isControlled && (
          <DialogTrigger asChild>
            <Button
              variant="ghost"
              className="w-9 h-9 md:w-10 md:h-10 gap-2 text-zinc-400 hover:text-white transition-colors rounded-full"
            >
              <LogIn className="w-4 h-4" />
              <span className="hidden sm:inline font-medium">Войти</span>
            </Button>
          </DialogTrigger>
        ))}

      {/* Адаптивная высота: max-h с автоскроллом и корректными отступами */}
      <DialogContent className="max-h-[calc(100dvh-2rem)] sm:max-h-[92dvh] overflow-y-auto overscroll-contain p-0 bg-[#09090b] border border-white/10 text-white w-[calc(100%-2rem)] sm:max-w-[420px] shadow-2xl shadow-orange-500/5 [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.1)_transparent]">
        <DialogDescription className="sr-only">
          {isLogin ? "Форма входа в систему" : "Форма регистрации нового пользователя"}
        </DialogDescription>

        {/* Декоративный градиент на фоне */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-28 sm:h-32 bg-gradient-to-b from-orange-500/10 to-transparent pointer-events-none" />

        <div className="relative p-5 sm:p-7">
          {isForgot ? (
            <>
              <DialogHeader className="mb-4 sm:mb-6 text-center">
                <div className="mx-auto w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white/5 flex items-center justify-center mb-2.5 sm:mb-3 border border-white/10 ring-1 ring-white/5">
                  <KeyRound className="w-5 h-5 sm:w-6 sm:h-6 text-orange-500" />
                </div>
                <DialogTitle className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                  Восстановление пароля
                </DialogTitle>
                <p className="text-zinc-400 text-xs sm:text-sm mt-1 sm:mt-2">
                  Введите email — мы отправим ссылку для сброса пароля
                </p>
              </DialogHeader>

              {resetSent ? (
                <div className="space-y-4 sm:space-y-5">
                  <div className="p-3.5 sm:p-4 bg-green-500/10 border border-green-500/20 rounded-lg flex items-start gap-3 text-green-400 text-sm">
                    <CheckCircle2 className="w-5 h-5 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium">Письмо отправлено!</p>
                      <p className="text-zinc-400 mt-1 text-xs sm:text-sm">
                        Проверьте почту <span className="text-white font-medium">{email}</span> и перейдите по ссылке для сброса пароля.
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    onClick={() => {
                      setIsForgot(false)
                      setResetSent(false)
                    }}
                    className="w-full h-11 sm:h-12 bg-white/5 border border-white/10 text-white hover:bg-white/10 font-medium rounded-xl transition-all text-sm sm:text-base"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Вернуться ко входу
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleResetPassword} className="space-y-3.5 sm:space-y-4">
                  {error && (
                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-3 text-red-400 text-xs sm:text-sm animate-in fade-in slide-in-from-top-2">
                      <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}

                  <div className="space-y-1 group">
                    <label className="text-xs font-medium text-zinc-500 ml-1 group-focus-within:text-orange-500 transition-colors">
                      Email
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-zinc-500 group-focus-within:text-orange-500 transition-colors" />
                      <Input
                        type="email"
                        placeholder="name@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-10 h-11 sm:h-12 bg-white/5 border-white/10 text-white placeholder:text-zinc-600 focus:bg-white/10 focus:border-orange-500/50 focus:ring-orange-500/20 transition-all rounded-xl text-sm sm:text-base"
                        required
                        autoFocus
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="w-full h-11 sm:h-12 bg-orange-500 text-white hover:bg-orange-600 font-semibold text-sm sm:text-base rounded-xl shadow-lg shadow-orange-500/20 transition-all hover:scale-[1.01] active:scale-[0.98]"
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

                  <div className="text-center pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setIsForgot(false)
                        setError(null)
                      }}
                      className="text-xs sm:text-sm text-zinc-400 hover:text-white transition-colors font-medium"
                    >
                      <ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4 inline mr-1" />
                      Вернуться ко входу
                    </button>
                  </div>
                </form>
              )}
            </>
          ) : (
            <>
              <DialogHeader className="mb-4 sm:mb-6 text-center">
                <div className="mx-auto w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white/5 flex items-center justify-center mb-2.5 sm:mb-3 border border-white/10 ring-1 ring-white/5">
                  {step === "captcha" ? (
                    <ShieldCheck className="w-5 h-5 sm:w-6 sm:h-6 text-orange-500" />
                  ) : step === "nickname" ? (
                    <AtSign className="w-5 h-5 sm:w-6 sm:h-6 text-orange-500" />
                  ) : isLogin ? (
                    <LogIn className="w-5 h-5 sm:w-6 sm:h-6 text-orange-500" />
                  ) : (
                    <UserPlus className="w-5 h-5 sm:w-6 sm:h-6 text-orange-500" />
                  )}
                </div>
                <DialogTitle className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                  {step === "captcha"
                    ? "Проверка безопасности"
                    : step === "nickname"
                      ? "Как вас зовут?"
                      : isLogin
                        ? "Добро пожаловать"
                        : "Создать аккаунт"}
                </DialogTitle>
                <p className="text-zinc-400 text-xs sm:text-sm mt-1 sm:mt-2">
                  {step === "captcha"
                    ? "Соберите пазл — и сразу перейдём к полям"
                    : step === "nickname"
                      ? "Придумайте ник, его увидят другие зрители"
                      : isLogin
                        ? "Введите свои данные для входа в систему"
                        : "Зарегистрируйтесь, чтобы получить доступ ко всем функциям"}
                </p>

                {/* Индикатор шагов: у входа их два, у регистрации — три. */}
                {step !== "nickname" && (
                  <div className="mt-3 flex items-center justify-center gap-1.5" aria-hidden>
                    {(isLogin ? ["captcha", "credentials"] : ["captcha", "credentials"]).map(
                      (s) => (
                        <span
                          key={s}
                          className={`h-1 rounded-full transition-all ${
                            s === step ? "w-6 bg-orange-500" : "w-3 bg-white/15"
                          }`}
                        />
                      ),
                    )}
                  </div>
                )}
              </DialogHeader>

              {step === "captcha" && (
                <div className="space-y-3.5 sm:space-y-4">
                  <div className="flex justify-center pt-1">
                    <AnimeSliderCaptcha
                      key={captchaNonce}
                      onSuccess={(token) => {
                        setCaptchaToken(token)
                        setError(null)
                      }}
                      disabled={loading}
                    />
                  </div>

                  <Button
                    type="button"
                    onClick={() => setStep("credentials")}
                    disabled={!captchaToken}
                    className="w-full h-11 sm:h-12 bg-white text-black hover:bg-zinc-200 font-semibold text-sm sm:text-base rounded-xl shadow-lg shadow-white/10 transition-all hover:scale-[1.01] active:scale-[0.98] disabled:opacity-40 disabled:hover:scale-100"
                  >
                    Продолжить
                  </Button>

                  {!captchaToken && (
                    <p className="text-center text-xs text-zinc-500">
                      Сначала соберите пазл — потом откроются поля
                    </p>
                  )}
                </div>
              )}

              {step === "credentials" && (
              <form onSubmit={handleAuth} className="space-y-3.5 sm:space-y-4">
                {error && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-3 text-red-400 text-xs sm:text-sm animate-in fade-in slide-in-from-top-2">
                    <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <div className="space-y-1 group">
                  <label className="text-xs font-medium text-zinc-500 ml-1 group-focus-within:text-orange-500 transition-colors">
                    Email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-zinc-500 group-focus-within:text-orange-500 transition-colors" />
                    <Input
                      type="email"
                      placeholder="name@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10 h-11 sm:h-12 bg-white/5 border-white/10 text-white placeholder:text-zinc-600 focus:bg-white/10 focus:border-orange-500/50 focus:ring-orange-500/20 transition-all rounded-xl text-sm sm:text-base"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1 group">
                  <label className="text-xs font-medium text-zinc-500 ml-1 group-focus-within:text-orange-500 transition-colors">
                    Пароль
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-zinc-500 group-focus-within:text-orange-500 transition-colors" />
                    <Input
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10 h-11 sm:h-12 bg-white/5 border-white/10 text-white placeholder:text-zinc-600 focus:bg-white/10 focus:border-orange-500/50 focus:ring-orange-500/20 transition-all rounded-xl text-sm sm:text-base"
                      required
                      minLength={6}
                    />
                  </div>
                </div>

                {isLogin && (
                  <div className="text-right">
                    <button
                      type="button"
                      onClick={() => {
                        setIsForgot(true)
                        setError(null)
                      }}
                      className="text-xs text-zinc-500 hover:text-orange-500 transition-colors font-medium"
                    >
                      Забыли пароль?
                    </button>
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full h-11 sm:h-12 bg-white text-black hover:bg-zinc-200 font-semibold text-sm sm:text-base rounded-xl shadow-lg shadow-white/10 transition-all hover:scale-[1.01] active:scale-[0.98]"
                  disabled={loading}
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Обработка...
                    </span>
                  ) : isLogin ? (
                    "Войти"
                  ) : (
                    "Создать аккаунт"
                  )}
                </Button>

                <div className="text-center">
                  <button
                    type="button"
                    onClick={backToCaptcha}
                    className="text-xs sm:text-sm text-zinc-500 hover:text-zinc-200 transition-colors font-medium"
                  >
                    <ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4 inline mr-1" />
                    К проверке безопасности
                  </button>
                </div>
              </form>
              )}

              {step === "nickname" && pendingUserId && (
                <div className="space-y-3.5 sm:space-y-4">
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex items-start gap-3 text-emerald-400 text-xs sm:text-sm">
                    <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>Аккаунт создан. Остался последний штрих — ник.</span>
                  </div>

                  <div className="space-y-1 group">
                    <label
                      htmlFor="auth-nickname"
                      className="text-xs font-medium text-zinc-500 ml-1 group-focus-within:text-orange-500 transition-colors"
                    >
                      Никнейм
                    </label>
                    <div className="relative">
                      <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-zinc-500 group-focus-within:text-orange-500 transition-colors" />
                      <Input
                        id="auth-nickname"
                        type="text"
                        placeholder="Например, Satoru"
                        value={nickname}
                        onChange={(e) => setNickname(e.target.value)}
                        maxLength={NICKNAME_MAX}
                        autoFocus
                        className="pl-10 h-11 sm:h-12 bg-white/5 border-white/10 text-white placeholder:text-zinc-600 focus:bg-white/10 focus:border-orange-500/50 focus:ring-orange-500/20 transition-all rounded-xl text-sm sm:text-base"
                      />
                    </div>
                    <div className="flex items-center justify-between px-1">
                      <span className="text-[11px] text-zinc-600">
                        От {NICKNAME_MIN} до {NICKNAME_MAX} символов
                      </span>
                      <span className="text-[11px] text-zinc-600 tabular-nums">
                        {nickname.length}/{NICKNAME_MAX}
                      </span>
                    </div>
                  </div>

                  <Button
                    type="button"
                    onClick={() => saveNickname(pendingUserId)}
                    className="w-full h-11 sm:h-12 bg-white text-black hover:bg-zinc-200 font-semibold text-sm sm:text-base rounded-xl shadow-lg shadow-white/10 transition-all hover:scale-[1.01] active:scale-[0.98]"
                  >
                    Сохранить и войти
                  </Button>

                  <div className="text-center">
                    <button
                      type="button"
                      onClick={finishAuth}
                      className="text-xs sm:text-sm text-zinc-500 hover:text-zinc-200 transition-colors font-medium"
                    >
                      Пропустить — задам позже
                    </button>
                  </div>
                </div>
              )}

              {step !== "nickname" && (
                <div className="mt-4 sm:mt-6 text-center">
                  <button
                    type="button"
                    onClick={toggleMode}
                    className="text-xs sm:text-sm text-zinc-400 hover:text-white transition-colors font-medium"
                  >
                    {isLogin ? "Нет аккаунта? " : "Уже есть аккаунт? "}
                    <span className="text-orange-500 hover:text-orange-400">
                      {isLogin ? "Создать" : "Войти"}
                    </span>
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}