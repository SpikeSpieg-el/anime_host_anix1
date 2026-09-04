"use client"

import { useEffect, useState } from "react"
import { Gift, X } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { getProxiedSrc } from "@/lib/image-loader"
import type { Card } from "@/app/gacha/types"
import { GIFT_CARD_RECEIVED_EVENT } from "@/lib/gift-card-events"

export function GiftCardReceivedModal() {
  const [card, setCard] = useState<Card | null>(null)

  useEffect(() => {
    const handleGiftCardReceived = (event: Event) => {
      setCard((event as CustomEvent<Card>).detail)
    }

    window.addEventListener(GIFT_CARD_RECEIVED_EVENT, handleGiftCardReceived)
    return () => window.removeEventListener(GIFT_CARD_RECEIVED_EVENT, handleGiftCardReceived)
  }, [])

  return (
    <Dialog open={!!card} onOpenChange={(open) => !open && setCard(null)}>
      <DialogContent className="max-w-[min(92vw,420px)] overflow-hidden border-amber-400/30 bg-zinc-950 p-0 text-white shadow-2xl shadow-amber-500/20">
        <DialogDescription className="sr-only">Полученная подарочная карта</DialogDescription>
        {card && (
          <div className="relative p-6 text-center">
            <button
              type="button"
              onClick={() => setCard(null)}
              className="absolute right-4 top-4 z-10 rounded-full p-2 text-zinc-400 transition hover:bg-white/10 hover:text-white"
              aria-label="Закрыть"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="mx-auto mb-3 flex w-fit items-center gap-2 text-amber-300">
              <Gift className="h-5 w-5" />
              <DialogTitle className="text-xl font-bold">Подарок получен!</DialogTitle>
            </div>
            <p className="mb-5 text-sm text-zinc-400">Карта добавлена в вашу коллекцию</p>
            <div className="mx-auto w-[min(68vw,260px)] overflow-hidden rounded-2xl border border-amber-300/40 bg-zinc-900 shadow-xl shadow-amber-500/20">
              {card.imageUrl ? (
                <img
                  src={getProxiedSrc(card.imageUrl)}
                  alt={card.name}
                  className="aspect-[2/3] w-full object-cover"
                />
              ) : (
                <div className="aspect-[2/3] bg-zinc-800" />
              )}
              <div className="p-3 text-left">
                <p className="truncate font-semibold text-white">{card.name}</p>
                <p className="mt-1 text-xs uppercase tracking-wider text-amber-300">{card.rarity}</p>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
