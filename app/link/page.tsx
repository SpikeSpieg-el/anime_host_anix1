"use client"

import { Suspense, useCallback, useEffect, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { useAuth } from "@/components/auth/auth-provider"
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Send,
  ExternalLink,
  Unlink,
  ShieldCheck,
  ArrowRight,
  RefreshCw,
} from "lucide-react"

const CODE_PATTERN = /^[A-HJ-NP-Z2-9]{8}$/
// Укажите имя вашего бота без @
const BOT_USERNAME = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || "weebx_bot"

const ERROR_TEXTS: Record<string, string> = {
  "Code not found or already used": "Код не найден или уже использован. Получите новый командой /link в боте.",
  "Code has expired": "Срок действия кода истёк (10 минут). Запросите новый код в боте.",
  "Invalid code format": "Неверный формат кода. Он должен состоять из 8 символов.",
  "Failed to verify code": "Не удалось проверить код. Попробуйте снова.",
  "Failed to link account": "Не удалось привязать аккаунт. Попробуйте через минуту.",
  Unauthorized: "Сессия истекла. Пожалуйста, войдите в аккаунт заново.",
}

function describeError(error: unknown): string {
  if (typeof error === "string" && ERROR_TEXTS[error]) return ERROR_TEXTS[error]
  return "Произошла ошибка при выполнении запроса. Попробуйте позже."
}

interface LinkStatus {
  linked: boolean
  telegramUsername: string | null
  linkedAt: string | null
  notificationsEnabled: boolean
}

function LinkAccountInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { user, session, loading: authLoading } = useAuth()

  const rawCode = searchParams.get("code") ?? ""
  const [inputCode, setInputCode] = useState(rawCode.trim().toUpperCase())
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle")
  const [message, setMessage] = useState("")

  // Данные о текущей привязке
  const [currentLink, setCurrentLink] = useState<LinkStatus | null>(null)
  const [loadingStatus, setLoadingStatus] = useState(false)
  const [unlinking, setUnlinking] = useState(false)

  const normalizedCode = inputCode.trim().toUpperCase()
  const isCodeValid = CODE_PATTERN.test(normalizedCode)

  // Загружаем текущий статус привязки пользователя
  const fetchLinkStatus = useCallback(async () => {
    if (!session?.access_token) return
    setLoadingStatus(true)
    try {
      const res = await fetch("/api/telegram/link", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const data = await res.json()
      if (data.success) {
        setCurrentLink({
          linked: data.linked,
          telegramUsername: data.telegramUsername,
          linkedAt: data.linkedAt,
          notificationsEnabled: data.notificationsEnabled,
        })
      }
    } catch {
      // Игнорируем фоновую ошибку статуса
    } finally {
      setLoadingStatus(false)
    }
  }, [session?.access_token])

  useEffect(() => {
    if (session?.access_token) {
      fetchLinkStatus()
    }
  }, [session?.access_token, fetchLinkStatus])

  // Обновляем inputCode, если параметр в URL изменился
  useEffect(() => {
    if (rawCode) {
      setInputCode(rawCode.trim().toUpperCase())
    }
  }, [rawCode])

  // Привязка кода
  const handleLink = async () => {
    if (!isCodeValid) {
      setStatus("error")
      setMessage("Код должен состоять из 8 символов (без 0, 1, O, I)")
      return
    }

    if (!session?.access_token) {
      setStatus("error")
      setMessage("Необходима авторизация на сайте")
      return
    }

    setStatus("submitting")
    setMessage("")

    try {
      const res = await fetch("/api/telegram/link", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ code: normalizedCode }),
      })

      const data = await res.json()

      if (!res.ok) {
        setStatus("error")
        setMessage(describeError(data?.error))
        return
      }

      setStatus("success")
      setMessage(
        data.telegramUsername
          ? `Успешно привязан к @${data.telegramUsername}!`
          : "Telegram успешно привязан!"
      )
      fetchLinkStatus()
    } catch {
      setStatus("error")
      setMessage("Ошибка соединения с сервером. Попробуйте снова.")
    }
  }

  // Отвязка аккаунта
  const handleUnlink = async () => {
    if (!confirm("Вы действительно хотите отвязать Telegram? Уведомления перестанут приходить.")) {
      return
    }

    setUnlinking(true)
    try {
      const res = await fetch("/api/telegram/link", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session?.access_token}` },
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setCurrentLink(null)
        setStatus("idle")
        setMessage("Telegram успешно отвязан")
      } else {
        alert(describeError(data?.error))
      }
    } catch {
      alert("Не удалось отвязать аккаунт")
    } finally {
      setUnlinking(false)
    }
  }

  if (authLoading || loadingStatus) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  // Не авторизован
  if (!user) {
    const returnUrl = encodeURIComponent(
      typeof window !== "undefined" ? window.location.pathname + window.location.search : "/link"
    )

    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="max-w-md w-full bg-card border border-border rounded-2xl p-6 sm:p-8 text-center space-y-6 shadow-sm">
          <div className="w-16 h-16 rounded-full bg-primary/10 text-primary mx-auto flex items-center justify-center">
            <Send className="w-8 h-8 ml-0.5" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight">Привязка Telegram</h1>
            <p className="text-muted-foreground text-sm">
              Войдите в аккаунт Weebx, чтобы бот знал, кому отправлять уведомления о новых сериях и озвучках.
            </p>
          </div>

          <a
            href={`/?auth=login&redirect=${returnUrl}`}
            className="w-full inline-flex items-center justify-center rounded-xl bg-primary px-6 py-3.5 text-primary-foreground font-medium hover:bg-primary/90 transition-all shadow"
          >
            Войти в аккаунт
          </a>

          {rawCode && (
            <p className="text-xs text-muted-foreground/80">
              Код из ссылки сохранится и применится сразу после входа.
            </p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-lg w-full bg-card border border-border rounded-2xl p-6 sm:p-8 space-y-6 shadow-sm">
        {/* Шапка */}
        <div className="text-center space-y-2">
          <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center transition-colors">
            {status === "success" ? (
              <div className="w-16 h-16 rounded-full bg-green-500/10 text-green-500 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8" />
              </div>
            ) : status === "error" ? (
              <div className="w-16 h-16 rounded-full bg-destructive/10 text-destructive flex items-center justify-center">
                <XCircle className="w-8 h-8" />
              </div>
            ) : (
              <div className="w-16 h-16 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                <Send className="w-8 h-8 ml-0.5" />
              </div>
            )}
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Telegram-уведомления</h1>
          <p className="text-muted-foreground text-sm">
            Получайте мгновенные оповещения о релизах любимых тайтлов
          </p>
        </div>

        {/* Текущий статус привязки */}
        {currentLink?.linked && (
          <div className="rounded-xl border border-border/80 bg-muted/40 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-green-500" />
                <span className="text-sm font-medium">Аккаунт подключен</span>
              </div>
              <button
                onClick={handleUnlink}
                disabled={unlinking}
                className="text-xs text-destructive hover:underline flex items-center gap-1 disabled:opacity-50"
              >
                {unlinking ? <Loader2 className="w-3 h-3 animate-spin" /> : <Unlink className="w-3 h-3" />}
                Отвязать
              </button>
            </div>
            <div className="text-xs text-muted-foreground">
              {currentLink.telegramUsername ? (
                <>Подключен к Telegram: <strong className="text-foreground">@{currentLink.telegramUsername}</strong></>
              ) : (
                "Telegram-аккаунт успешно сопряжён с профилем"
              )}
            </div>
          </div>
        )}

        {/* Успешный результат привязки */}
        {status === "success" ? (
          <div className="space-y-4 text-center">
            <div className="rounded-xl bg-green-500/10 border border-green-500/20 p-4 text-green-600 dark:text-green-400 text-sm font-medium">
              {message}
            </div>
            <p className="text-xs text-muted-foreground">
              Теперь бот будет уведомлять о сериях из вашего списка отслеживания. Настроить список можно командой{" "}
              <code className="bg-muted px-1.5 py-0.5 rounded text-foreground font-mono">/alerts</code> в боте.
            </p>
            <button
              onClick={() => router.push("/")}
              className="w-full rounded-xl bg-primary px-6 py-3 text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
            >
              Вернуться на главную
            </button>
          </div>
        ) : (
          /* Форма привязки */
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Код подтверждения
              </label>
              <div className="relative">
                <input
                  type="text"
                  maxLength={8}
                  value={inputCode}
                  onChange={(e) => {
                    setInputCode(e.target.value.toUpperCase())
                    if (status === "error") setStatus("idle")
                  }}
                  placeholder="XXXXXXXX"
                  className="w-full text-center tracking-[0.25em] font-mono text-xl font-bold py-3 px-4 rounded-xl border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all placeholder:text-muted-foreground/30 placeholder:tracking-widest"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Код выдаётся ботом по команде <span className="font-mono text-foreground">/link</span> и действует 10 минут.
              </p>
            </div>

            {status === "error" && message && (
              <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-3 text-destructive text-sm text-center">
                {message}
              </div>
            )}

            <button
              onClick={handleLink}
              disabled={!isCodeValid || status === "submitting"}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3.5 text-primary-foreground font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow"
            >
              {status === "submitting" ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Проверяем код...
                </>
              ) : currentLink?.linked ? (
                <>
                  <RefreshCw className="w-4 h-4" />
                  Перепривязать Telegram
                </>
              ) : (
                <>
                  Привязать Telegram
                  <ArrowRight className="w-4 h-4 ml-1" />
                </>
              )}
            </button>

            {/* Быстрый переход в бота */}
            <div className="pt-2 text-center">
              <a
                href={`https://t.me/${BOT_USERNAME}?start=link`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline font-medium"
              >
                Открыть бота @{BOT_USERNAME}
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        )}

        {/* Справка */}
        <div className="border-t border-border pt-4">
          <details className="group text-xs text-muted-foreground cursor-pointer">
            <summary className="font-medium hover:text-foreground list-none flex justify-between items-center select-none">
              <span>Как получить код?</span>
              <span className="transition-transform group-open:rotate-180">↓</span>
            </summary>
            <div className="mt-2.5 space-y-1.5 pl-2 border-l-2 border-muted leading-relaxed">
              <p>1. Откройте нашего бота в Telegram: <strong>@{BOT_USERNAME}</strong></p>
              <p>2. Отправьте команду <code className="bg-muted px-1 rounded text-foreground font-mono">/link</code></p>
              <p>3. Перейдите по ссылке из сообщения или вставьте 8-значный код сюда</p>
            </div>
          </details>
        </div>
      </div>
    </div>
  )
}

export default function LinkAccountPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      }
    >
      <LinkAccountInner />
    </Suspense>
  )
}