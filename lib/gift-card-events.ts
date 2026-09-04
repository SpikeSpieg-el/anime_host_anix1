import type { Card } from "@/app/gacha/types"

export const GIFT_CARD_RECEIVED_EVENT = "gift-card-received"

export function dispatchGiftCardReceived(card: Card) {
  window.dispatchEvent(new CustomEvent<Card>(GIFT_CARD_RECEIVED_EVENT, { detail: card }))
}
