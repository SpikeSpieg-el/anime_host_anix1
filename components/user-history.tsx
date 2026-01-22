"use client"
import { useEffect, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { Clock, Search, History, ChevronRight } from "lucide-react"
import { useEpisodeUpdates } from "@/hooks/use-episode-updates"
function normalizePosterUrl(value: string): string {
  const raw = (value ?? "").trim()
  if (!raw) return raw
  if (raw.startsWith("https//")) return `https://${raw.slice("https//".length)}`
  if (raw.startsWith("http//")) return `http://${raw.slice("http//".length)}`
  if (raw.startsWith("https://shikimori.onehttps//")) return `https://${raw.slice("https://shikimori.onehttps//".length)}`
  return raw
}
export function UserHistory() {
const [history, setHistory] = useState<any[]>([])
const [fullHistory, setFullHistory] = useState<any[]>([])
const [lastSearches, setLastSearches] = useState<string[]>([])
const [mounted, setMounted] = useState(false)
// Подключаем хук обновлений
const { updates, clearUpdate, checkAnimeUpdates, isChecking } = useEpisodeUpdates()
useEffect(() => {
setMounted(true)

const load = () => {
  // 1. Загрузка Истории
  try {
    const storedHistory = JSON.parse(localStorage.getItem("watch-history") || "[]")
    const normalized = Array.isArray(storedHistory)
      ? storedHistory.map((item: any) => ({ 
          ...item, 
          poster: normalizePosterUrl(item?.poster) 
        }))
      : []
    setFullHistory(normalized)
    setHistory(normalized.slice(0, 6)) 
  } catch (e) { console.error(e) }

  // 2. Загрузка Поиска
  try {
    const storedSearch = JSON.parse(localStorage.getItem("search-history") || "[]")
    const next = Array.isArray(storedSearch) ? storedSearch.filter((x) => typeof x === "string") : []
    setLastSearches(next.slice(0, 5))
  } catch (e) { console.error(e) }
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
// При изменении истории можно форсировать проверку (опционально)
useEffect(() => {
if (mounted && fullHistory.length > 0) {
// Мы передаем полный список, чтобы хук мог использовать актуальные данные
// checkAnimeUpdates(fullHistory) -> Это вызовет проверку.
// Но хук уже имеет встроенный useEffect с таймером и троттлингом,
// так что можно не вызывать вручную, чтобы не спамить запросами при каждом рендере.
}
}, [mounted, fullHistory, checkAnimeUpdates])
if (!mounted) return null
if (history.length === 0 && lastSearches.length === 0) return null
const hasMoreHistory = fullHistory.length > 6
return (
<div className="mb-12 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
{/* Секция: Вы недавно искали */}
  {lastSearches.length > 0 && (
    <div className="flex items-center gap-3 overflow-x-auto pb-2 hide-scrollbar">
      <div className="flex items-center gap-2 text-zinc-500 text-sm font-medium whitespace-nowrap mr-2 select-none">
        <Search size={16} /> Недавний поиск:
      </div>
      {lastSearches.map((term, idx) => (
        <Link 
          key={idx} 
          href={`/catalog?search=${encodeURIComponent(term)}`}
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
          <h2 className="text-lg sm:text-xl font-bold text-white">
            Вы смотрели
            {isChecking && <span className="ml-2 text-xs font-normal text-zinc-600 animate-pulse">(Проверка новых серий...)</span>}
          </h2>
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
        {history.map((item) => {
          const total = item?.episodesTotal && item.episodesTotal > 0 ? item.episodesTotal : null
          const progress = item?.episode && total ? Math.min(item.episode / total, 1) : null
          
          // Проверяем, есть ли обновление для этого аниме
          const update = updates.find(u => u.animeId === item.id)
          
          return (
          <Link
            key={item.id}
            href={item.episode ? `/watch/${item.id}?episode=${item.episode}` : `/watch/${item.id}`}
            className="group relative block"
            onClick={() => {
              // При клике удаляем уведомление об обновлении, так как пользователь пошел смотреть
              if (update) clearUpdate(item.id)
            }}
          >
            <div className="relative aspect-[16/9] md:aspect-[2/3] overflow-hidden rounded-lg bg-zinc-900 border border-zinc-800">
              <Image
                src={item.poster}
                alt={item.title}
                fill
                className="object-cover opacity-80 transition-transform duration-300 group-hover:scale-105 group-hover:opacity-100"
              />
              
              {/* Прогресс бар */}
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-zinc-800 overflow-hidden z-10">
                {progress !== null && (
                  <div
                    className="h-full bg-orange-600 transition-all duration-300"
                    style={{ width: `${(progress * 100).toFixed(0)}%` }}
                  />
                )}
              </div>

              {/* БЕЙДЖ НОВОЙ СЕРИИ */}
              {update && (
                <div className="absolute top-2 right-2 z-20 bg-orange-500 text-black text-[9px] font-black px-2 py-0.5 rounded-sm shadow-lg animate-pulse uppercase tracking-wide">
                  NEW EP {update.newEpisode}
                </div>
              )}

              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10">
                <div className="bg-orange-600 p-2 rounded-full shadow-lg transform scale-90 group-hover:scale-100 transition-transform">
                  <Clock size={16} className="text-white" fill="currentColor" />
                </div>
              </div>
            </div>
            
            <div className="mt-2">
               <h3 className="text-xs font-bold text-zinc-300 truncate group-hover:text-white transition-colors">{item.title}</h3>
              <div className="text-[10px] text-zinc-500 mt-0.5 flex flex-col">
                <span>
                  {item.episode
                    ? `Серия ${item.episode}${total ? ` из ${total}` : ""}`
                    : "Начать просмотр"}
                </span>
                {/* Текстовое пояснение обновления */}
                {update && (
                  <span className="text-orange-400 font-medium">
                    • Вышла {update.newEpisode} серия
                  </span>
                )}
              </div>
            </div>
          </Link>
        )})}
      </div>

      {hasMoreHistory && (
        <div className="mt-6 text-center sm:text-left">
          <Link 
            href="/history"
            className="inline-flex items-center gap-2 px-6 py-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-orange-500 text-white font-medium rounded-xl transition-all"
          >
            Показать всю историю
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      )}
    </section>
  )}
</div>
)
}