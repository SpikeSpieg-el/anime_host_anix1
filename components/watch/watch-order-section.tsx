"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import type { FranchiseItem } from "@/lib/shikimori"
import { useCover } from "@/components/providers/cover-provider"
import { getWatchPath } from "@/lib/seo/watch-url"
import { cn } from "@/lib/utils"

interface WatchOrderSectionProps {
  watchOrder: FranchiseItem[]
}

/**
 * Обложка, которая точно не притворяется картинкой: заглушки Shikimori
 * (`/system/images/original/missing.png` и подобные) — это не 404, а валидный
 * файл-заглушка. Наш прежний код считал только 404, поэтому такие ссылки
 * доходили до `<Image>` и показывали серую картинку вместо обложки тайтла.
 */
function isUnusablePoster(url: string | undefined | null): boolean {
  if (!url) return true
  const lower = url.toLowerCase()
  if (['missing', 'stub', 'placeholder', 'default'].some(s => lower.includes(s))) return true
  // Пустой data-URI или обрывок после обрезки — рендерить нечего.
  return lower.startsWith('data:image') && lower.length < 64
}

export function WatchOrderSection({ watchOrder }: WatchOrderSectionProps) {
  const { getPoster, forgetPoster } = useCover()
  const [items, setItems] = useState<FranchiseItem[]>(watchOrder)
  /**
   * ID тайтлов, у которых ссылка Shikimori уже показала 404 в браузере.
   * Держим в ref, а не в state: значение нужно только внутри колбэка ошибки
   * и в следующем запросе обложки, перерисовывать из-за него список незачем.
   */
  const brokenShikimoriRef = useRef<Set<string>>(new Set())
  /**
   * `getPoster` пересоздаётся на каждое изменение кэша, поэтому в зависимостях
   * эффекта он обнулял его и заставлял заново запрашивать все обложки секции
   * после каждой найденной. Держим ссылку в ref: список запрашивается один раз
   * на набор `watchOrder`, а не на каждое попадание в кэш.
   */
  const getPosterRef = useRef(getPoster)
  getPosterRef.current = getPoster

  useEffect(() => {
    setItems(watchOrder)
    if (watchOrder.length === 0) return

    let cancelled = false
    Promise.all(
      watchOrder.map(async (item) => {
        const broken = brokenShikimoriRef.current.has(item.id)
        // Заведомо сломанный Shikimori не показываем даже на первом кадре:
        // иначе пользователь видит 404, пока идёт запрос к другому провайдеру.
        if (!broken && isUnusablePoster(item.poster)) {
          brokenShikimoriRef.current.add(item.id)
          forgetPoster(item.id)
        }
        try {
          const poster = await getPosterRef.current(
            item.id,
            item.poster,
            item.originalTitle || "",
            item.title,
            false,
            brokenShikimoriRef.current.has(item.id),
          )
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
    // `forgetPoster` стабилен (useCallback с []), а `getPosterRef` —
    // актуальная ссылка на getPoster, специально вынесенная из зависимостей.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchOrder, forgetPoster])

  /**
   * Картинка не загрузилась. Раньше обработчика не было вовсе, а «фоллбэк»
   * делал `getPoster`, который возвращал ту же ссылку Shikimori — обложка
   * оставалась битой навсегда. Теперь: вычищаем битую ссылку из 7-дневного
   * кэша и перезапрашиваем обложку, запретив Shikimori.
   */
  const handlePosterError = useCallback((item: FranchiseItem) => {
    forgetPoster(item.id)
    brokenShikimoriRef.current.add(item.id)
    void getPosterRef
      .current(item.id, item.poster, item.originalTitle || "", item.title, false, true)
      .then((poster) => {
        setItems(prev =>
          prev.map(p => (p.id === item.id ? { ...p, poster } : p)),
        )
      })
      .catch((error) => {
        console.error(`[WatchOrderSection] Recovery failed for ${item.id}:`, error)
      })
  }, [forgetPoster])

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
        {items.map((item, index) => {
          const posterBox = (extraClass?: string) => (
            <div className="relative aspect-[2/3] overflow-hidden rounded-lg">
              {isUnusablePoster(item.poster) ? null : (
                <Image
                  src={item.poster}
                  fill
                  alt={item.title}
                  className={cn("object-cover", extraClass)}
                  onError={() => handlePosterError(item)}
                />
              )}
              <div className="absolute top-2 left-2 rounded-md bg-black/70 px-2 py-1 text-[10px] font-bold text-white">
                #{index + 1}
              </div>
            </div>
          )

          return item.isCurrent ? (
            <div
              key={item.id}
              className="group block rounded-xl border border-orange-500/60 bg-secondary/40 p-2"
            >
              {posterBox()}

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
              href={getWatchPath(item.id, item.canonicalTitle || item.title)}
              className="group block rounded-xl border border-border bg-secondary/40 p-2 transition hover:border-orange-500/40"
            >
              {posterBox("transition-transform duration-300 group-hover:scale-105")}

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
        })}
      </div>
    </div>
  )
}
