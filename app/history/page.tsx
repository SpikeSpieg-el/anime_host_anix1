"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { Clock, History, Trash2, ArrowLeft } from "lucide-react"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { useEpisodeUpdates } from "@/hooks/use-episode-updates"
<<<<<<< HEAD
=======
import { useHistory } from "@/components/history-provider"
>>>>>>> test-source/main

function normalizePosterUrl(value: string): string {
  const raw = (value ?? "").trim()
  if (!raw) return raw

  if (raw.startsWith("https//")) return `https://${raw.slice("https//".length)}`
  if (raw.startsWith("http//")) return `http://${raw.slice("http//".length)}`

  if (raw.startsWith("https://shikimori.onehttps//")) {
    return `https://${raw.slice("https://shikimori.onehttps//".length)}`
  }
  if (raw.startsWith("https://shikimori.onehttp//")) {
    return `http://${raw.slice("https://shikimori.onehttp//".length)}`
  }

  return raw
}

export default function HistoryPage() {
<<<<<<< HEAD
  const [history, setHistory] = useState<any[]>([])
=======
  const { items: historyItems, clear } = useHistory()
  const history = historyItems.map((item: any) => ({
    ...item,
    poster: normalizePosterUrl(item?.poster)
  }))
>>>>>>> test-source/main
  const [mounted, setMounted] = useState(false)
  const { updates } = useEpisodeUpdates()

  // Helper function to get update info for an anime
  const getUpdateInfo = (animeId: string) => {
    const update = updates.find(u => u.animeId === animeId)
    if (!update) return undefined
    
    const historyItem = history.find(h => h.id === animeId)
    if (!historyItem) return undefined
    
    return {
      newEpisode: update.newEpisode,
      totalEpisodes: update.totalEpisodes
    }
  }

  useEffect(() => {
    setMounted(true)
<<<<<<< HEAD

    const load = () => {
      try {
        const storedHistory = JSON.parse(localStorage.getItem("watch-history") || "[]")
        const normalized = Array.isArray(storedHistory)
          ? storedHistory.map((item: any) => ({ ...item, poster: normalizePosterUrl(item?.poster) }))
          : []
        setHistory(normalized)
      } catch (e) {
        console.error(e)
      }
    }

    load()

    const onUpdated = () => load()
    window.addEventListener("storage", onUpdated)

    return () => {
      window.removeEventListener("storage", onUpdated)
    }
=======
>>>>>>> test-source/main
  }, [])

  const clearHistory = () => {
    if (confirm("Вы уверены, что хотите очистить всю историю просмотров?")) {
<<<<<<< HEAD
      localStorage.removeItem("watch-history")
      setHistory([])
=======
      clear()
>>>>>>> test-source/main
    }
  }

  if (!mounted) return null

  return (
    <main className="min-h-screen bg-zinc-950 text-white pb-20 md:pb-24">
      <Navbar />

      <div className="container mx-auto px-4 pt-8 pb-12">
        <div className="mb-8">
          <Link href="/" className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-orange-500 text-zinc-400 hover:text-white font-medium rounded-xl transition-all mb-4">
            <ArrowLeft className="w-4 h-4" />
            На главную
          </Link>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <History size={28} className="text-orange-500" />
              <h1 className="text-3xl sm:text-4xl font-bold">История просмотров</h1>
            </div>
            {history.length > 0 && (
              <button
                onClick={clearHistory}
                className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-900 hover:bg-red-900/50 border border-zinc-800 hover:border-red-500 text-zinc-400 hover:text-white font-medium rounded-xl transition-all"
              >
                <Trash2 className="w-4 h-4" />
                Очистить
              </button>
            )}
          </div>
          <p className="text-zinc-500 mt-2">
            {history.length} {history.length === 1 ? 'аниме' : history.length < 5 ? 'аниме' : 'аниме'} в истории
          </p>
        </div>

        {history.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <History size={64} className="text-zinc-800 mb-4" />
            <h2 className="text-xl font-bold text-zinc-400 mb-2">История пуста</h2>
            <p className="text-zinc-600 mb-6">Начните смотреть аниме, чтобы оно появилось здесь</p>
            <Link
              href="/catalog"
              className="inline-flex items-center gap-2 px-6 py-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-orange-500 text-white font-medium rounded-xl transition-all"
            >
              Перейти в каталог
              <ArrowLeft className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-3 sm:gap-x-4 gap-y-6 sm:gap-y-8">
          {history.map((item) => {
            const total = item?.episodesTotal && item.episodesTotal > 0 ? item.episodesTotal : null
            const progress = item?.episode && total ? Math.min(item.episode / total, 1) : null
            const updateInfo = getUpdateInfo(item.id)
            return (
              <Link
                key={item.id}
                href={item.episode ? `/watch/${item.id}?episode=${item.episode}` : `/watch/${item.id}`}
                className="group relative block"
              >
                <div className="relative aspect-[16/9] md:aspect-[2/3] overflow-hidden rounded-lg bg-zinc-900 border border-zinc-800">
                  <Image
                    src={item.poster}
                    alt={item.title}
                    fill
                    className="object-cover opacity-80 transition-transform duration-300 group-hover:scale-105 group-hover:opacity-100"
                  />
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-zinc-800 overflow-hidden">
                  {progress !== null && (
                    <div
                      className="h-full bg-orange-600 transition-all duration-300"
                      style={{ width: `${(progress * 100).toFixed(0)}%` }}
                    />
                  )}
                </div>
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="bg-orange-600 p-2 rounded-full shadow-lg">
                      <Clock size={16} className="text-white" fill="currentColor" />
                    </div>
                  </div>
                  
                  {/* New episode badge */}
                  {updateInfo && (
                    <div className="absolute top-2 right-2">
                      <span className="bg-orange-500 text-black text-[10px] font-bold px-1.5 py-0.5 rounded shadow-sm animate-pulse block">
                        новых серий + {updateInfo.newEpisode - (item.episode || 0)}
                      </span>
                    </div>
                  )}
                </div>
                <div className="mt-2">
                  <h3 className="text-xs font-bold text-zinc-300 truncate group-hover:text-white">{item.title}</h3>
                  <p className="text-[10px] text-zinc-500">
                    {item.episode
                      ? `Остановились на серии ${item.episode}${total ? ` / ${total}` : ""}`
                      : "Продолжить"}
                  </p>
                </div>
              </Link>
            )
          })}
          </div>
        )}
      </div>

      <Footer />
    </main>
  )
}
