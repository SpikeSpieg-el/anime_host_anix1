"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import type { FranchiseItem } from "@/lib/shikimori"
import { useCover } from "@/components/providers/cover-provider"

interface WatchOrderSectionProps {
  watchOrder: FranchiseItem[]
}

export function WatchOrderSection({ watchOrder }: WatchOrderSectionProps) {
  const { getPoster } = useCover()
  const [items, setItems] = useState<FranchiseItem[]>(watchOrder)

  useEffect(() => {
    setItems(watchOrder)
    if (watchOrder.length === 0) return

    let cancelled = false
    Promise.all(
      watchOrder.map(async (item) => {
        try {
          const poster = await getPoster(item.id, item.poster, item.originalTitle || "", item.title)
          return { ...item, poster }
        } catch (error) {
          console.error(`[WatchOrderSection] Error loading poster for ${item.id}:`, error)
          return item
        }
      }),
    ).then((resolvedItems) => {
      if (!cancelled) setItems(resolvedItems)
    })

    return () => {
      cancelled = true
    }
  }, [watchOrder, getPoster])

  if (items.length === 0) {
    return (
      <div id="order" className="mt-10">
        <h2 className="text-xl md:text-2xl font-bold mb-4">Порядок просмотра</h2>
        <p className="text-muted-foreground">
          У этого аниме нет продолжений или иных частей. Это самостоятельное произведение.
        </p>
      </div>
    )
  }

  return (
    <div id="order" className="mt-10">
      <h2 className="text-xl md:text-2xl font-bold mb-4">Порядок просмотра</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
        {items.map((item, index) => (
          item.isCurrent ? (
            <div
              key={item.id}
              className="group block rounded-xl border border-orange-500/60 bg-secondary/40 p-2"
            >
              <div className="relative aspect-[2/3] overflow-hidden rounded-lg">
                <Image src={item.poster} fill alt={item.title} className="object-cover" />
                <div className="absolute top-2 left-2 rounded-md bg-black/70 px-2 py-1 text-[10px] font-bold text-white">
                  #{index + 1}
                </div>
              </div>

              <div className="mt-2">
                <div className="text-[11px] text-zinc-500">
                  {item.year ? item.year : ''}{item.kind ? (item.year ? ` • ${item.kind}` : item.kind) : ''}
                </div>
                <div className="text-sm font-semibold text-orange-500">
                  {item.title}
                </div>
              </div>
            </div>
          ) : (
            <Link
              key={item.id}
              href={`/watch/${item.id}`}
              className="group block rounded-xl border border-border bg-secondary/40 p-2 transition hover:border-orange-500/40"
            >
              <div className="relative aspect-[2/3] overflow-hidden rounded-lg">
                <Image src={item.poster} fill alt={item.title} className="object-cover transition-transform duration-300 group-hover:scale-105" />
                <div className="absolute top-2 left-2 rounded-md bg-black/70 px-2 py-1 text-[10px] font-bold text-white">
                  #{index + 1}
                </div>
              </div>

              <div className="mt-2">
                <div className="text-[11px] text-zinc-500">
                  {item.year ? item.year : ''}{item.kind ? (item.year ? ` • ${item.kind}` : item.kind) : ''}
                </div>
                <div className="text-sm font-semibold text-white group-hover:text-orange-500 transition-colors">
                  {item.title}
                </div>
              </div>
            </Link>
          )
        ))}
      </div>
    </div>
  )
}
