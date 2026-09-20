"use client"

import { useEffect, useState } from "react"
import { Gift, X, Sparkles } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import type { Card } from "@/app/gacha/types"
import { rarityConfig } from "@/types/gacha"
import { GIFT_CARD_RECEIVED_EVENT } from "@/lib/gift-card-events"
import { InteractiveCard } from "@/app/gacha/components/interactive-card"

export function GiftCardReceivedModal() {
  const [card, setCard] = useState<Card | null>(null)

  useEffect(() => {
    const handleGiftCardReceived = (event: Event) => {
      setCard((event as CustomEvent<Card>).detail)
    }

    window.addEventListener(GIFT_CARD_RECEIVED_EVENT, handleGiftCardReceived)
    return () => window.removeEventListener(GIFT_CARD_RECEIVED_EVENT, handleGiftCardReceived)
  }, [])

  const currentRarity = card?.rarity ? rarityConfig[card.rarity] : null

  return (
    <Dialog open={!!card} onOpenChange={(open) => !open && setCard(null)}>
      <DialogContent 
        showCloseButton={false}
        className="max-w-[min(96vw,460px)] max-h-[96vh] overflow-y-auto overflow-x-hidden border-white/10 bg-zinc-950/90 p-0 text-white backdrop-blur-2xl shadow-2xl shadow-black/80 sm:rounded-3xl"
      >
        <DialogDescription className="sr-only">
          Полученная подарочная карта: {card?.name}
        </DialogDescription>

        {card && (
          <div className="relative flex flex-col items-center p-4 sm:p-6 text-center">
            {/* Декоративное фоновое свечение в тон редкости карты */}
            <div 
              className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 h-72 w-72 rounded-full blur-[90px] opacity-30"
              style={{
                backgroundColor: currentRarity ? `rgb(${currentRarity.rgb})` : "rgb(245, 158, 11)"
              }}
            />

            {/* Кнопка закрытия */}
            <button
              type="button"
              onClick={() => setCard(null)}
              className="absolute right-4 top-4 z-30 rounded-full p-2 text-zinc-400 transition hover:bg-white/10 hover:text-white"
              aria-label="Закрыть"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Шапка подарка */}
            <div className="relative z-10 mb-4 flex flex-col items-center">
              <div className="mb-2 flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-500/10 px-3.5 py-1 text-amber-300 shadow-inner">
                <Gift className="h-4 w-4 animate-bounce" />
                <span className="text-xs font-semibold uppercase tracking-wider">Подарок получен</span>
              </div>
              <DialogTitle className="text-lg sm:text-xl font-black uppercase tracking-wide text-white">
                Новая карта в коллекции!
              </DialogTitle>
              <p className="mt-0.5 text-xs text-zinc-400">
                Нажмите на карту, чтобы повертеть или посмотреть статы
              </p>
            </div>

            {/* Интерактивная 3D карта с запасом места под перспективы */}
            <div className="relative z-10 my-2 flex w-full justify-center items-center py-2 overflow-visible">
              <InteractiveCard card={card} />
            </div>

            {/* Подвал с кнопкой действия */}
            <div className="relative z-10 mt-4 flex w-full max-w-[320px] flex-col gap-2">
              <Button
                onClick={() => setCard(null)}
                className="w-full bg-gradient-to-r from-amber-500 to-yellow-500 font-bold text-zinc-950 hover:from-amber-400 hover:to-yellow-400 shadow-lg shadow-amber-500/20"
              >
                <Sparkles className="mr-2 h-4 w-4" />
                Отлично
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}