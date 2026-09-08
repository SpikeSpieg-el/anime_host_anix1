import { describe, expect, it } from "vitest"
import { GIFT_CARD_RECEIVED_EVENT, dispatchGiftCardReceived } from "@/lib/gift-card-events"
import { makeGachaCard } from "../../fixtures/cards"

describe("gift-card-events", () => {
  it("exports a stable event name", () => {
    expect(GIFT_CARD_RECEIVED_EVENT).toBe("gift-card-received")
  })

  it("dispatches CustomEvent with the card as detail", () => {
    const card = makeGachaCard({ name: "Gift Hero" })
    let received: unknown
    const handler = (e: Event) => {
      received = (e as CustomEvent).detail
    }
    window.addEventListener(GIFT_CARD_RECEIVED_EVENT, handler)
    dispatchGiftCardReceived(card)
    window.removeEventListener(GIFT_CARD_RECEIVED_EVENT, handler)
    expect(received).toMatchObject({ name: "Gift Hero", uniqueId: card.uniqueId })
  })
})
