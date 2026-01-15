"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { Clock, Search, History, ChevronRight } from "lucide-react"

function normalizePosterUrl(value: string): string {
  const raw = (value ?? "").trim()
  if (!raw) return raw

  if (raw.startsWith("https//")) return `https://${raw.slice("https//".length)}`
  if (raw.startsWith("http//")) return `http://${raw.slice("http//".length)}`

  // Частый кейс: префикснули origin поверх уже абсолютной ссылки
  if (raw.startsWith("https://shikimori.onehttps//")) {
    return `https://${raw.slice("https://shikimori.onehttps//".length)}`
  }
  if (raw.startsWith("https://shikimori.onehttp//")) {
    return `http://${raw.slice("https://shikimori.onehttp//".length)}`
  }

  return raw
}

export function UserHistory() {
  const [history, setHistory] = useState<any[]>([])
  const [fullHistory, setFullHistory] = useState<any[]>([])
  const [lastSearches, setLastSearches] = useState<string[]>([])
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)

    const load = () => {
      // 1. Загружаем историю просмотров
      try {
        const storedHistory = JSON.parse(localStorage.getItem("watch-history") || "[]")
        const normalized = Array.isArray(storedHistory)
          ? storedHistory
              .map((item: any) => ({ ...item, poster: normalizePosterUrl(item?.poster) }))
          : []
        setFullHistory(normalized)
        setHistory(normalized.slice(0, 6)) // Берем последние 6 для отображения
      } catch (e) {
        console.error(e)
      }

      // 2. Загружаем историю поиска
      try {
        const storedSearch = JSON.parse(localStorage.getItem("search-history") || "[]")
        const next = Array.isArray(storedSearch) ? storedSearch.filter((x) => typeof x === "string") : []
        setLastSearches(next.slice(0, 5)) // Берем последние 5
      } catch (e) {
        console.error(e)
      }
    }

    load()

    const onUpdated = () => load()
    window.addEventListener("search-history-updated", onUpdated)
    window.addEventListener("storage", onUpdated)

    return () => {
      window.removeEventListener("search-history-updated", onUpdated)
      window.removeEventListener("storage", onUpdated)
    }
  }, [])

  if (!mounted) return null
  if (history.length === 0 && lastSearches.length === 0) return null

  const hasMoreHistory = fullHistory.length > 6

  return (
    <div className="mb-12 space-y-8">
      
      {/* Секция: Вы недавно искали */}
      {lastSearches.length > 0 && (
        <div className="flex items-center gap-3 overflow-x-auto pb-2 no-scrollbar">
          <div className="flex items-center gap-2 text-zinc-500 text-sm font-medium whitespace-nowrap mr-2">
            <Search size={16} /> Недавний поиск:
          </div>
          {lastSearches.map((term, idx) => (
            <Link 
              key={idx} 
              href={`/search?q=${encodeURIComponent(term)}`}
              className="px-3 sm:px-4 py-1.5 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-300 text-sm hover:border-orange-500 hover:text-white transition whitespace-nowrap"
            >
              {term}
            </Link>
          ))}
        </div>
      )}

      {/* Секция: Продолжить просмотр */}
      {history.length > 0 && (
        <section>
          <div className="flex items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-2 text-zinc-400">
              <History size={20} className="text-orange-500" />
              <h2 className="text-lg sm:text-xl font-bold text-white">Вы смотрели</h2>
            </div>
            {hasMoreHistory && (
              <Link 
                href="/history"
                className="text-orange-500 text-sm font-medium hover:text-orange-400 transition flex items-center gap-1 whitespace-nowrap"
              >
                Все {fullHistory.length} <ChevronRight className="w-4 h-4" />
              </Link>
            )}
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 sm:gap-4">
            {history.map((item) => (
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
                  {/* Прогресс бар (имитация) */}
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-zinc-800">
                    <div className="h-full bg-orange-600 w-[40%]" /> 
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="bg-orange-600 p-2 rounded-full shadow-lg">
                      <Clock size={16} className="text-white" fill="currentColor" />
                    </div>
                  </div>
                </div>
                <div className="mt-2">
                   <h3 className="text-xs font-bold text-zinc-300 truncate group-hover:text-white">{item.title}</h3>
                   <p className="text-[10px] text-zinc-500">
                     {item.episode ? `Остановились на серии ${item.episode}` : "Продолжить"}
                   </p>
                </div>
              </Link>
            ))}
          </div>

          {hasMoreHistory && (
            <div className="mt-6 text-center sm:text-left">
              <Link 
                href="/history"
                className="inline-flex items-center gap-2 px-6 py-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-orange-500 text-white font-medium rounded-xl transition-all"
              >
                Показать всю историю ({fullHistory.length} аниме)
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          )}
        </section>
      )}
    </div>
  )
}