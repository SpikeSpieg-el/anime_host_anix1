"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import { Bell, Play, Check, ChevronRight, Clock, Sparkles, X, BellRing, BellOff, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { useCover } from "@/components/providers/cover-provider"
import { usePushNotifications, type PushErrorReason } from "@/hooks/use-push-notifications"

interface EpisodeUpdate {
  animeId: string
  animeTitle: string
  poster?: string
  oldEpisode: number
  newEpisode: number
  totalEpisodes?: number
  updatedAt: string
}

interface EpisodeUpdateBadgeProps {
  updates: EpisodeUpdate[]
  onClearUpdate?: (animeId: string) => void
  onClearAll?: () => void
  className?: string
}

export function EpisodeUpdateBadge({ updates, onClearUpdate, onClearAll, className }: EpisodeUpdateBadgeProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [failedPosters, setFailedPosters] = useState<Set<string>>(new Set())
  const [fallbackPosters, setFallbackPosters] = useState<Record<string, string>>({})
  const { getPoster } = useCover()
  const { isSupported: pushSupported, isSubscribed: pushSubscribed, permission: pushPermission, loading: pushLoading, errorReason: pushErrorReason, subscribe: pushSubscribe, unsubscribe: pushUnsubscribe } = usePushNotifications()
  const [pushStatus, setPushStatus] = useState<"idle" | "success" | "error">("idle")

  const failedRef = useRef<Set<string>>(new Set())
  const getPosterRef = useRef(getPoster)
  getPosterRef.current = getPoster

  function isPlaceholderPoster(url: string | undefined): boolean {
    if (!url) return true
    const lower = url.toLowerCase()
    return ['missing', 'stub', 'placeholder', 'default'].some(s => lower.includes(s))
  }

  // When posters fail (Shikimori didn't return image), fetch from CoverProvider (AniList/Kitsu/MAL)
  useEffect(() => {
    const failedIds = updates
      .filter((u) => (failedRef.current.has(u.animeId) || isPlaceholderPoster(u.poster)) && !fallbackPosters[u.animeId])
      .map((u) => u.animeId)
    if (failedIds.length === 0) return

    let cancelled = false
    ;(async () => {
      const loaded = await Promise.all(
        failedIds.map(async (id) => {
          const update = updates.find((u) => u.animeId === id)
          if (!update) return null
          const poster = await getPosterRef.current(
            update.animeId,
            "",
            "",
            update.animeTitle,
          )
          return [id, poster] as const
        }),
      )
      if (!cancelled) {
        const newFallbacks = Object.fromEntries(loaded.filter(Boolean) as [string, string][])
        setFallbackPosters((prev) => ({ ...prev, ...newFallbacks }))
      }
    })()
    return () => { cancelled = true }
  }, [updates, failedPosters, fallbackPosters])

  const getPushErrorMessage = (reason: PushErrorReason | null): string => {
    switch (reason) {
      case "permission-denied":
        return "Разрешение отклонено. Откройте настройки сайта (иконка замка в адресной строке) → Уведомления → Разрешить, затем попробуйте снова."
      case "permission-dismissed":
        return "Окно разрешения было закрыто. Нажмите кнопку ещё раз."
      case "not-logged-in":
        return "Войдите в аккаунт, чтобы включить push-уведомления."
      case "not-secure-context":
        return "Push-уведомления работают только на HTTPS-соединении."
      case "no-notification-api":
        return "Этот браузер не поддерживает уведомления."
      case "sw-registration-failed":
        return "Не удалось зарегистрировать service worker. Очистите кэш браузера и попробуйте снова."
      case "no-vapid-key":
        return "Сервер не настроен для push-уведомлений (VAPID ключи). Обратитесь к администратору."
      case "push-subscribe-failed":
        return "Браузер отказался создавать подписку. Возможно, push заблокирован в настройках браузера."
      case "save-failed":
        return "Не удалось сохранить подписку на сервере. Попробуйте позже."
      case "unsupported":
        return "Этот браузер не поддерживает push-уведомления."
      default:
        return "Не удалось включить. Проверьте разрешения браузера."
    }
  }

  const combinedClassName = cn("ml-2", className)

  if (updates.length === 0) {
    // Пустой колокольчик с диалогом "нет уведомлений"
    return (
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn("text-muted-foreground hover:text-foreground hover:bg-accent active:scale-95 transition-all", combinedClassName)}
          >
            <Bell className="w-5 h-5" />
          </Button>
        </DialogTrigger>

        <DialogContent 
          className="bg-background/95 backdrop-blur-xl border w-[calc(100vw-2rem)] sm:w-full sm:max-w-md p-0 gap-0 overflow-hidden shadow-2xl rounded-2xl flex flex-col max-h-[85vh]"
          showCloseButton={false}
        >
          <DialogDescription className="sr-only">
            Нет новых уведомлений о новых сериях аниме
          </DialogDescription>
          
          {/* Хедер */}
          <div className="flex items-center justify-between px-4 py-4 border-b bg-muted/50">
            <div className="flex items-center gap-2.5">
              <Bell className="w-5 h-5 text-muted-foreground" />
              <DialogTitle className="text-base font-bold tracking-tight">
                Уведомления
              </DialogTitle>
            </div>
            <Button 
              variant="ghost" 
              size="icon-sm" 
              className="h-8 w-8 text-muted-foreground hover:text-foreground rounded-full hover:bg-accent"
              onClick={() => setIsOpen(false)}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Контент: нет уведомлений */}
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <div className="w-32 h-32 rounded-full bg-muted/50 border flex items-center justify-center mb-4">
              <img src="/No notifications.png" alt="No notifications" className="w-40 h-32 opacity-69" />
            </div>
            <p className="text-muted-foreground text-center font-medium mb-2">Нет новых уведомлений</p>
            <p className="text-muted-foreground/70 text-center text-sm">Здесь появятся уведомления о новых сериях ваших аниме</p>

            {/* Push notifications enable button */}
            {pushSupported && (
              <div className="mt-4 w-full">
                {pushSubscribed ? (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pushLoading}
                    onClick={async () => { await pushUnsubscribe(); setPushStatus("idle") }}
                    className="w-full h-10 rounded-xl text-muted-foreground hover:text-foreground"
                  >
                    {pushLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <BellOff className="w-4 h-4 mr-2" />}
                    Отключить push-уведомления
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pushLoading}
                    onClick={async () => {
                      const result = await pushSubscribe()
                      setPushStatus(result.ok ? "success" : "error")
                      if (result.ok) setTimeout(() => setPushStatus("idle"), 3000)
                    }}
                    className="w-full h-10 rounded-xl border-primary/50 hover:border-primary hover:bg-primary/10 text-primary"
                  >
                    {pushLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <BellRing className="w-4 h-4 mr-2" />}
                    Включить push-уведомления
                  </Button>
                )}
                {pushStatus === "success" && (
                  <p className="text-xs text-green-500 text-center mt-2">Push-уведомления включены!</p>
                )}
                {pushStatus === "error" && (
                  <div className="mt-2 p-2.5 rounded-lg bg-red-500/10 border border-red-500/30">
                    <p className="text-xs text-red-500 text-center leading-relaxed">{getPushErrorMessage(pushErrorReason)}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))
    
    if (diffInMinutes < 60) return `${diffInMinutes} мин. назад`
    const diffInHours = Math.floor(diffInMinutes / 60)
    if (diffInHours < 24) return `${diffInHours} ч. назад`
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn("relative text-foreground hover:text-foreground hover:bg-accent active:scale-95 transition-all", combinedClassName)}
        >
          <Bell className="w-6 h-6" />
          {/* Пульсирующий индикатор */}
          <span className="absolute top-2 right-2 flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-orange-500 border border-black"></span>
          </span>
        </Button>
      </DialogTrigger>

      <DialogContent 
        className="bg-background/95 backdrop-blur-xl border w-[calc(100vw-2rem)] sm:w-full sm:max-w-md p-0 gap-0 overflow-hidden shadow-2xl rounded-2xl flex flex-col max-h-[85vh]"
        showCloseButton={false}
      >
        <DialogDescription className="sr-only">
          Список новых серий доступных для просмотра
        </DialogDescription>
        
        {/* Хедер */}
        <div className="flex items-center justify-between px-4 py-4 border-b bg-muted/50">
          <div className="flex items-center gap-2.5">
            <div className="relative">
               <Bell className="w-5 h-5 text-primary" />
               <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-[9px] font-bold h-3.5 min-w-[14px] px-0.5 rounded-full flex items-center justify-center">
                 {updates.length}
               </span>
            </div>
            <DialogTitle className="text-base font-bold tracking-tight">
              Новые серии
            </DialogTitle>
          </div>
          <Button 
            variant="ghost" 
            size="icon-sm" 
            className="h-8 w-8 text-muted-foreground hover:text-foreground rounded-full hover:bg-accent"
            onClick={() => setIsOpen(false)}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Список (с кастомным скроллом) */}
        <div className="max-h-[60vh] overflow-y-auto custom-scrollbar p-2 space-y-2">
          {updates.map((update, idx) => (
            <Link
              key={update.animeId}
              href={`/watch/${update.animeId}`}
              onClick={() => {
                onClearUpdate?.(update.animeId)
                setIsOpen(false)
              }}
              className="group relative flex items-center gap-3 p-3 rounded-xl bg-muted/40 border hover:bg-accent hover:border-accent-foreground/20 active:scale-[0.98] transition-all animate-in fade-in slide-in-from-bottom-2 duration-300 fill-mode-backwards"
              style={{ animationDelay: `${idx * 50}ms` }}
            >
              {/* Обложка тайтла мягко проявляется справа налево */}
              <div className="absolute inset-y-0 right-0 w-[72%] overflow-hidden pointer-events-none">
                {(() => {
                  const shikimoriFailed = failedPosters.has(update.animeId) || isPlaceholderPoster(update.poster)
                  const src = !shikimoriFailed && update.poster
                    ? update.poster
                    : fallbackPosters[update.animeId]
                  if (!src) return null
                  return (
                    <Image
                      src={src}
                      alt=""
                      fill
                      sizes="260px"
                      className="object-cover object-center opacity-75 transition-transform duration-500 group-hover:scale-105"
                      unoptimized={src.startsWith("data:image")}
                      onError={() => {
                        if (!shikimoriFailed) {
                          failedRef.current = new Set(failedRef.current).add(update.animeId)
                          setFailedPosters(prev => new Set(prev).add(update.animeId))
                        }
                      }}
                    />
                  )
                })()}
                <div className="absolute inset-0 bg-gradient-to-r from-muted/95 via-muted/75 via-45% to-muted/15 dark:from-zinc-900/95 dark:via-zinc-900/75 dark:to-zinc-900/15" />
                <div className="absolute inset-0 bg-gradient-to-t from-muted/70 via-transparent to-muted/20 dark:from-zinc-900/70 dark:to-zinc-900/20" />
              </div>

              {/* Левая часть: номер серии */}
              <div className="relative z-10 shrink-0 w-12 h-12 sm:w-14 sm:h-14 rounded-lg overflow-hidden flex items-center justify-center bg-background/60 border border-border/80 group-hover:border-primary/50 transition-colors shadow-lg backdrop-blur-sm">
                 <div className="absolute inset-0 bg-primary/10 group-hover:bg-primary/20 transition-colors" />
                 <div className="relative flex flex-col items-center">
                    <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Серия</span>
                    <span className="text-lg sm:text-xl font-black text-primary leading-none">
                        {update.newEpisode}
                    </span>
                 </div>
              </div>

              {/* Центр: Информация */}
              <div className="relative z-10 flex-1 min-w-0 flex flex-col justify-center">
                <h4 className="font-bold text-sm sm:text-[15px] pr-4 group-hover:text-primary transition-colors">
                  {update.animeTitle}
                </h4>
                
                <div className="flex items-center gap-2 mt-1">
                   {/* Прогресс */}
                   <span className="inline-flex items-center text-[10px] sm:text-xs font-medium text-muted-foreground bg-background/50 px-1.5 py-0.5 rounded border">
                      <Sparkles className="w-2.5 h-2.5 mr-1 text-primary" />
                      {update.oldEpisode} <ChevronRight className="w-2.5 h-2.5 mx-0.5 opacity-50"/> {update.newEpisode}
                   </span>
                   
                   {/* Время */}
                   <span className="flex items-center text-[10px] text-muted-foreground">
                      <Clock className="w-2.5 h-2.5 mr-1" />
                      {formatTimeAgo(update.updatedAt)}
                   </span>
                </div>
              </div>

              {/* Правая часть: Play Button */}
              <div className="shrink-0 pr-1">
                 <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground group-hover:bg-primary group-hover:text-primary-foreground transition-all shadow-lg group-hover:shadow-primary/25">
                    <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                 </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Push notifications toggle */}
        {pushSupported && (
          <div className="px-3 py-2 border-b bg-muted/30">
            {pushSubscribed ? (
              <Button
                variant="ghost"
                size="sm"
                disabled={pushLoading}
                onClick={async () => { await pushUnsubscribe(); setPushStatus("idle") }}
                className="w-full text-muted-foreground hover:text-foreground h-9 rounded-xl text-xs"
              >
                {pushLoading ? <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> : <BellOff className="w-3.5 h-3.5 mr-2" />}
                Отключить push-уведомления
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                disabled={pushLoading}
                onClick={async () => {
                  const result = await pushSubscribe()
                  setPushStatus(result.ok ? "success" : "error")
                  if (result.ok) setTimeout(() => setPushStatus("idle"), 3000)
                }}
                className="w-full text-primary hover:bg-primary/10 h-9 rounded-xl text-xs"
              >
                {pushLoading ? <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> : <BellRing className="w-3.5 h-3.5 mr-2" />}
                Включить push-уведомления о новых сериях
              </Button>
            )}
            {pushStatus === "success" && (
              <p className="text-xs text-green-500 text-center mt-1">Push-уведомления включены!</p>
            )}
            {pushStatus === "error" && (
              <div className="mt-1 p-2 rounded-lg bg-red-500/10 border border-red-500/30">
                <p className="text-xs text-red-500 text-center leading-relaxed break-words">{getPushErrorMessage(pushErrorReason)}</p>
              </div>
            )}
          </div>
        )}

        {/* Футер */}
        <div className="p-3 border-t bg-muted/50 backdrop-blur-sm">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
                onClearAll?.()
                setIsOpen(false)
            }}
            className="w-full text-muted-foreground hover:text-foreground hover:bg-accent h-10 rounded-xl transition-all font-medium text-xs sm:text-sm"
          >
            <Check className="w-4 h-4 mr-2" />
            Отметить всё как прочитанное
          </Button>
        </div>

      </DialogContent>
    </Dialog>
  )
}