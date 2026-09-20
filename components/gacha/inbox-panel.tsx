"use client"

import { useState, useEffect, useCallback } from "react"
import Image from "next/image"
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Mail, Gift, Coins, Sparkles, Loader2, Check, Trash2, X } from "lucide-react"
import { toast } from "sonner"
import { rarityConfig } from "@/types/gacha"
import type { Rarity } from "@/app/gacha/types"
import { getProxiedSrc } from "@/lib/image-loader"
import { AnalyticsEvent, trackEvent } from "@/lib/analytics"

interface MailItem {
  id: string
  userId: string
  sender: string
  type: "card_gift" | "coins" | "dust" | "event_reward" | "message"
  title: string
  body: string | null
  cardPayload: any | null
  amount: number
  isRead: boolean
  isClaimed: boolean
  expiresAt: string | null
  createdAt: string
  claimedAt: string | null
}

interface InboxPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  session: any
  onClaimed?: (claimedType: string) => void
}

function getMailIcon(type: MailItem["type"]) {
  switch (type) {
    case "card_gift":
    case "event_reward":
      return <Gift className="w-5 h-5 text-pink-400 shrink-0" />
    case "coins":
      return <Coins className="w-5 h-5 text-yellow-400 shrink-0" />
    case "dust":
      return <Sparkles className="w-5 h-5 text-amber-400 shrink-0" />
    default:
      return <Mail className="w-5 h-5 text-indigo-400 shrink-0" />
  }
}

function isClaimable(mail: MailItem): boolean {
  if (mail.isClaimed) return false
  if (mail.type === "card_gift" || mail.type === "event_reward") {
    return !!mail.cardPayload || mail.amount > 0
  }
  if (mail.type === "coins" || mail.type === "dust") {
    return mail.amount > 0
  }
  return false
}

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr)
    return date.toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    })
  } catch {
    return dateStr
  }
}

export function InboxPanel({ open, onOpenChange, session, onClaimed }: InboxPanelProps) {
  const [mail, setMail] = useState<MailItem[]>([])
  const [loading, setLoading] = useState(false)
  const [claimingId, setClaimingId] = useState<string | null>(null)

  const fetchMail = useCallback(async () => {
    if (!session?.access_token) return
    setLoading(true)
    try {
      const response = await fetch("/api/mail", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })
      const data = await response.json()
      if (response.ok && data.mail) {
        setMail(data.mail)
      }
    } catch (err) {
      console.error("Fetch mail error:", err)
      toast.error("Не удалось загрузить почту")
    } finally {
      setLoading(false)
    }
  }, [session?.access_token])

  useEffect(() => {
    if (open && session?.access_token) {
      fetchMail()
    }
  }, [open, session?.access_token, fetchMail])

  const handleClaim = async (mailId: string) => {
    if (!session?.access_token) return
    setClaimingId(mailId)
    try {
      const response = await fetch("/api/mail", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ action: "claim", mailId }),
      })
      const data = await response.json()

      if (!response.ok) {
        toast.error(data.error || "Не удалось забрать награду")
        return
      }

      setMail((prev) =>
        prev.map((m) =>
          m.id === mailId
            ? { ...m, isClaimed: true, isRead: true, claimedAt: new Date().toISOString() }
            : m
        )
      )

      trackEvent(AnalyticsEvent.INBOX_CLAIM, {
        claimed_type: data.claimedType ?? "unknown",
        mail_id: mailId,
      })

      if (data.claimedType === "card_gift") {
        toast.success("Карта добавлена в коллекцию!")
      } else if (data.claimedType === "coins") {
        toast.success("Монеты зачислены!")
      } else if (data.claimedType === "dust") {
        toast.success("Пыль зачислена!")
      } else {
        toast.success("Награда получена!")
      }

      try {
        onClaimed?.(data.claimedType)
      } catch (e) {
        console.error("onClaimed callback error:", e)
      }
    } catch (err) {
      console.error("Claim error:", err)
      toast.error("Ошибка при получении награды")
    } finally {
      setClaimingId(null)
    }
  }

  const handleMarkRead = async (mailId: string) => {
    if (!session?.access_token) return
    setMail((prev) =>
      prev.map((m) => (m.id === mailId ? { ...m, isRead: true } : m))
    )
    try {
      await fetch("/api/mail", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ action: "mark_read", mailId }),
      })
    } catch (err) {
      console.error("Mark read error:", err)
    }
  }

  const handleDelete = async (mailId: string) => {
    if (!session?.access_token) return
    setMail((prev) => prev.filter((m) => m.id !== mailId))
    try {
      await fetch("/api/mail", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ action: "delete", mailId }),
      })
      toast.success("Письмо удалено")
    } catch (err) {
      console.error("Delete error:", err)
      fetchMail()
    }
  }

  const unreadCount = mail.filter((m) => !m.isRead).length

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="right">
      <DrawerContent className="fixed inset-y-0 right-0 z-50 mt-0 flex h-full h-dvh w-full max-w-[min(92vw,440px)] flex-col border-l border-slate-800 border-y-0 border-r-0 bg-slate-950 p-0 text-white shadow-2xl outline-none rounded-none sm:rounded-l-2xl overflow-hidden">
        {/* Шапка (зафиксирована сверху) */}
        <DrawerHeader className="shrink-0 border-b border-slate-850 bg-slate-950/80 px-4 py-3 sm:py-4 backdrop-blur-md">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="relative shrink-0 flex items-center justify-center w-9 h-9 rounded-xl bg-indigo-950/60 border border-indigo-500/20">
                <Mail className="w-5 h-5 text-indigo-400" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-red-500 text-[9px] font-black text-white shadow">
                    {unreadCount}
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <DrawerTitle className="text-white text-base font-bold truncate">Почта</DrawerTitle>
                <DrawerDescription className="text-slate-400 text-xs truncate">
                  {mail.length > 0
                    ? `${mail.length} ${mail.length === 1 ? "письмо" : mail.length >= 5 ? "писем" : "письма"}`
                    : "Нет писем"}
                </DrawerDescription>
              </div>
            </div>
            <button
              onClick={() => onOpenChange(false)}
              className="p-2 rounded-xl hover:bg-slate-850 text-slate-400 hover:text-white transition-colors shrink-0"
              aria-label="Закрыть почту"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </DrawerHeader>

        {/* Скроллируемая область писем */}
        <ScrollArea className="flex-1 min-h-0 w-full overflow-hidden">
          <div className="p-3 sm:p-4">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-24 gap-3">
                <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
                <p className="text-slate-400 text-sm font-medium">Загрузка почты...</p>
              </div>
            ) : mail.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 gap-3 text-center px-4">
                <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-600">
                  <Mail className="w-7 h-7" />
                </div>
                <p className="text-slate-300 font-semibold text-sm">Здесь пока пусто</p>
                <p className="text-slate-500 text-xs max-w-[240px]">
                  Подарки, награды за события и системные уведомления будут приходить сюда
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {mail.map((item) => {
                  const claimable = isClaimable(item)
                  const card = item.cardPayload
                  const rarity = card?.rarity as Rarity | undefined
                  const rarityCfg = rarity ? rarityConfig[rarity] : null

                  return (
                    <div
                      key={item.id}
                      className={`relative w-full overflow-hidden rounded-xl border p-3 sm:p-3.5 transition-all min-w-0 ${
                        !item.isRead
                          ? "bg-indigo-950/30 border-indigo-700/50 shadow-sm shadow-indigo-950/30"
                          : "bg-slate-900/60 border-slate-800/90"
                      }`}
                      onClick={() => {
                        if (!item.isRead) handleMarkRead(item.id)
                      }}
                    >
                      {!item.isRead && (
                        <span className="absolute top-3 right-3 w-2 h-2 rounded-full bg-indigo-400 ring-4 ring-indigo-400/20" />
                      )}

                      {/* Заголовок письма и иконка */}
                      <div className="flex items-start gap-2.5 pr-4 min-w-0">
                        <div className="mt-0.5">{getMailIcon(item.type)}</div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-white font-semibold text-sm leading-snug break-words">
                            {item.title}
                          </h3>
                          <p className="text-slate-400 text-xs mt-0.5 truncate">
                            от {item.sender === "system" ? "Системы" : item.sender}
                          </p>
                        </div>
                      </div>

                      {/* Текст письма */}
                      {item.body && (
                        <p className="text-slate-300 text-xs mt-2 leading-relaxed break-words line-clamp-4">
                          {item.body}
                        </p>
                      )}

                      {/* Превью прикрепленной карты */}
                      {card && (
                        <div className="mt-2.5 flex items-center gap-2.5 rounded-lg bg-slate-950/60 border border-slate-800 p-2 overflow-hidden min-w-0">
                          <div className="relative w-11 h-14 rounded-md overflow-hidden shrink-0 bg-slate-800 border border-white/5">
                            {card.imageUrl && (
                              <Image
                                src={getProxiedSrc(card.imageUrl)}
                                alt={card.name || "Карта"}
                                fill
                                sizes="48px"
                                className="object-cover"
                                unoptimized
                              />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-white text-xs font-bold truncate">{card.name}</p>
                            <p className="text-slate-400 text-[11px] truncate">{card.anime}</p>
                            {rarityCfg && (
                              <span
                                className={`inline-block mt-1 px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-gradient-to-r ${rarityCfg.color} text-slate-950`}
                              >
                                {rarityCfg.label}
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Монеты */}
                      {(item.type === "coins" || (item.type === "event_reward" && item.amount > 0 && !card)) && (
                        <div className="mt-2 flex items-center gap-1.5 text-yellow-400">
                          <Coins className="w-4 h-4 shrink-0" />
                          <span className="font-bold text-xs">+{item.amount.toLocaleString()} монет</span>
                        </div>
                      )}

                      {/* Пыль */}
                      {item.type === "dust" && (
                        <div className="mt-2 flex items-center gap-1.5 text-amber-400">
                          <Sparkles className="w-4 h-4 shrink-0" />
                          <span className="font-bold text-xs">+{item.amount.toLocaleString()} пыли</span>
                        </div>
                      )}

                      {/* Футер карточки (дата + кнопки) */}
                      <div className="flex items-center justify-between gap-2 mt-3 pt-2.5 border-t border-slate-800/70 min-w-0">
                        <span className="text-slate-500 text-[11px] truncate shrink-0">
                          {formatDate(item.createdAt)}
                        </span>
                        <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                          {item.isClaimed && (
                            <span className="flex items-center gap-1 text-emerald-400 text-xs font-semibold px-2 py-1 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                              <Check className="w-3.5 h-3.5" />
                              Забрано
                            </span>
                          )}
                          {claimable && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleClaim(item.id)
                              }}
                              disabled={claimingId === item.id}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold transition-all shadow-sm active:scale-95"
                            >
                              {claimingId === item.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Gift className="w-3.5 h-3.5" />
                              )}
                              Забрать
                            </button>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDelete(item.id)
                            }}
                            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-red-400 transition-colors"
                            title="Удалить"
                            aria-label="Удалить письмо"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </ScrollArea>
      </DrawerContent>
    </Drawer>
  )
}