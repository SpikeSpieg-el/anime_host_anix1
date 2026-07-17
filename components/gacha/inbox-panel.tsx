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
      return <Gift className="w-5 h-5 text-pink-400" />
    case "coins":
      return <Coins className="w-5 h-5 text-yellow-400" />
    case "dust":
      return <Sparkles className="w-5 h-5 text-amber-400" />
    default:
      return <Mail className="w-5 h-5 text-indigo-400" />
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
      month: "long",
      year: "numeric",
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

      if (data.claimedType === "card_gift") {
        toast.success("Карта добавлена в коллекцию!")
      } else if (data.claimedType === "coins") {
        toast.success("Монеты зачислены!")
      } else if (data.claimedType === "dust") {
        toast.success("Пыль зачислена!")
      } else {
        toast.success("Награда получена!")
      }

      // Notify parent so it can refresh coins/dust/collection
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
      <DrawerContent className="bg-slate-950 border-slate-800 text-white sm:max-w-md w-full">
        <DrawerHeader className="border-b border-slate-800 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <Mail className="w-6 h-6 text-indigo-400" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </div>
              <div>
                <DrawerTitle className="text-white text-lg font-bold">Почта</DrawerTitle>
                <DrawerDescription className="text-slate-400 text-xs">
                  {mail.length > 0
                    ? `${mail.length} ${mail.length === 1 ? "письмо" : "писем"}`
                    : "Нет писем"}
                </DrawerDescription>
              </div>
            </div>
            <button
              onClick={() => onOpenChange(false)}
              className="p-2 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>
        </DrawerHeader>

        <ScrollArea className="flex-1 px-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
              <p className="text-slate-400 text-sm">Загрузка почты...</p>
            </div>
          ) : mail.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Mail className="w-12 h-12 text-slate-600" />
              <p className="text-slate-500 text-sm">Здесь пока пусто</p>
              <p className="text-slate-600 text-xs">Награды и подарки будут появляться здесь</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3 py-4">
              {mail.map((item) => {
                const claimable = isClaimable(item)
                const card = item.cardPayload
                const rarity = card?.rarity as Rarity | undefined
                const rarityCfg = rarity ? rarityConfig[rarity] : null

                return (
                  <div
                    key={item.id}
                    className={`relative rounded-xl border p-4 transition-colors ${
                      !item.isRead
                        ? "bg-indigo-950/40 border-indigo-700/50"
                        : "bg-slate-900/60 border-slate-800"
                    }`}
                    onClick={() => {
                      if (!item.isRead) handleMarkRead(item.id)
                    }}
                  >
                    {!item.isRead && (
                      <span className="absolute top-4 right-4 w-2.5 h-2.5 rounded-full bg-indigo-400" />
                    )}

                    <div className="flex items-start gap-3 pr-6">
                      <div className="mt-0.5 shrink-0">{getMailIcon(item.type)}</div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-white font-semibold text-sm leading-tight">
                          {item.title}
                        </h3>
                        <p className="text-slate-400 text-xs mt-0.5">
                          от {item.sender === "system" ? "Системы" : item.sender}
                        </p>
                      </div>
                    </div>

                    {item.body && (
                      <p className="text-slate-300 text-sm mt-2 leading-relaxed">{item.body}</p>
                    )}

                    {card && (
                      <div className="mt-3 flex items-center gap-3 rounded-lg bg-slate-900/80 border border-slate-800 p-2.5">
                        <div className="relative w-12 h-16 rounded overflow-hidden shrink-0 bg-slate-800">
                          {card.imageUrl && (
                            <Image
                              src={getProxiedSrc(card.imageUrl)}
                              alt={card.name}
                              fill
                              sizes="48px"
                              className="object-cover"
                              unoptimized
                            />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-white text-sm font-medium truncate">{card.name}</p>
                          <p className="text-slate-400 text-xs truncate">{card.anime}</p>
                          {rarityCfg && (
                            <span
                              className={`inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold bg-gradient-to-r ${rarityCfg.color} text-slate-900`}
                            >
                              {rarityCfg.label}
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {(item.type === "coins" || (item.type === "event_reward" && item.amount > 0 && !card)) && (
                      <div className="mt-3 flex items-center gap-2 text-yellow-400">
                        <Coins className="w-4 h-4" />
                        <span className="font-bold text-sm">+{item.amount.toLocaleString()}</span>
                      </div>
                    )}

                    {item.type === "dust" && (
                      <div className="mt-3 flex items-center gap-2 text-amber-400">
                        <Sparkles className="w-4 h-4" />
                        <span className="font-bold text-sm">+{item.amount.toLocaleString()}</span>
                      </div>
                    )}

                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-800/60">
                      <span className="text-slate-500 text-[11px]">
                        {formatDate(item.createdAt)}
                      </span>
                      <div className="flex items-center gap-2">
                        {item.isClaimed && (
                          <span className="flex items-center gap-1 text-green-400 text-xs font-medium">
                            <Check className="w-3.5 h-3.5" />
                            Получено
                          </span>
                        )}
                        {claimable && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleClaim(item.id)
                            }}
                            disabled={claimingId === item.id}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold transition-colors"
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
                          className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-red-400 transition-colors"
                          title="Удалить"
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
        </ScrollArea>
      </DrawerContent>
    </Drawer>
  )
}
