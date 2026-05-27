"use client"

import { useTVMode } from '@/hooks/use-tv-mode'
import { TVWatchPage } from '@/components/tv/tv-watch-page'
import { Navbar } from '@/components/layout/navbar'
import { Footer } from '@/components/layout/footer'
import { WatchPageClient } from './watch-page-client'
import type { Anime, FranchiseItem } from '@/lib/shikimori'
import Image from 'next/image'
import Link from 'next/link'
import { TextSkeleton } from '@/components/shared/skeleton'

interface WatchPageLayoutWrapperProps {
  anime: Anime
  initialEpisode?: number
  watchOrder: FranchiseItem[]
}

export function WatchPageLayoutWrapper({ anime, initialEpisode, watchOrder }: WatchPageLayoutWrapperProps) {
  const { isTVMode, isLoading } = useTVMode()

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (isTVMode) {
    return <TVWatchPage anime={anime} initialEpisode={initialEpisode} />
  }

  return (
    <main className="min-h-screen bg-background text-foreground pb-20 md:pb-24 relative">
      <div className="absolute inset-0 z-0 pointer-events-none opacity-[0.07]">
        <div className="absolute inset-0 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:20px_20px]" />
      </div>

      <Navbar />

      <div className="container mx-auto px-4 py-8 relative z-10">
        <WatchPageClient
          anime={anime}
          initialEpisode={initialEpisode}
        />

        {anime.description ? (
          <div className="mt-8">
            <p className="text-zinc-400 leading-relaxed whitespace-pre-line text-lg">
              {anime.description}
            </p>
          </div>
        ) : (
          <div className="mt-8">
            <TextSkeleton lines={6} />
          </div>
        )}

        <div id="order" className="mt-10">
          <h2 className="text-xl md:text-2xl font-bold mb-4">Порядок просмотра</h2>
          {watchOrder.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
              {watchOrder.map((item, index) => (
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
                      <div className="text-sm font-semibold text-orange-500 line-clamp-2">
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
                      <div className="text-sm font-semibold text-white line-clamp-2 group-hover:text-orange-500 transition-colors">
                        {item.title}
                      </div>
                    </div>
                  </Link>
                )
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">
              У этого аниме нет продолжений или иных частей. Это самостоятельное произведение.
            </p>
          )}
        </div>
      </div>
      <Footer />
    </main>
  )
}
