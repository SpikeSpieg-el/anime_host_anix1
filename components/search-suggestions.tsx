"use client"

import { useState, useEffect, useRef } from "react"
import { Search, Clock, X, ChevronRight } from "lucide-react"
import { Anime, searchAnime } from "@/lib/shikimori"
import { useRouter } from "next/navigation"
import { useAuth } from "@/components/auth-provider"

function saveSearchHistory(query: string) {
  if (typeof window === "undefined") return

  const normalized = query.trim()
  if (!normalized) return

  try {
    const raw = localStorage.getItem("search-history")
    const parsed = raw ? JSON.parse(raw) : []
    const current: string[] = Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : []

    const next = [normalized, ...current.filter((q) => q !== normalized)].slice(0, 10)
    localStorage.setItem("search-history", JSON.stringify(next))
    window.dispatchEvent(new Event("search-history-updated"))
  } catch (e) {
    console.error(e)
  }
}

interface SearchSuggestionsProps {
  value: string
  onChange: (value: string) => void
  onSelect: (value: string) => void // Вызывается при нажатии Enter или выбора "Искать ..."
  placeholder?: string
  className?: string
}

export function SearchSuggestions({ 
  value, 
  onChange, 
  onSelect, 
  placeholder = "Поиск аниме...",
  className = ""
}: SearchSuggestionsProps) {
  const router = useRouter()
  const { profile } = useAuth()
  const [suggestions, setSuggestions] = useState<Anime[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  // Поиск с дебаунсом
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (value.trim().length < 2) {
      setSuggestions([])
      setIsOpen(false)
      return
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const allowNsfw = profile?.allow_nsfw_search || false
        const results = await searchAnime(value.trim(), allowNsfw)
        setSuggestions(results.slice(0, 5))
        setIsOpen(true)
      } catch (error) {
        console.error("Search error:", error)
        setSuggestions([])
      } finally {
        setLoading(false)
      }
    }, 300)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [value])

  const handleAnimeClick = (animeId: string) => {
    saveSearchHistory(value)
    router.push(`/watch/${animeId}`) // Переход на страницу конкретного аниме
    setIsOpen(false)
    onChange("") // Очищаем поиск после перехода
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") setIsOpen(false)
    if (e.key === "Enter" && value.trim()) {
      saveSearchHistory(value)
      onSelect(value.trim()) // Переход в каталог
      setIsOpen(false)
    }
  }

  return (
    <div className={`relative ${className} z-50`}>
      <div className="relative group">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500 group-focus-within:text-orange-500 transition-colors pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => value.trim().length >= 2 && setIsOpen(true)}
          onKeyDown={handleKeyDown}
          className="w-full h-9 rounded-xl bg-zinc-900/50 border border-zinc-800/50 pl-10 pr-10 text-sm text-white focus:bg-zinc-900 focus:outline-none focus:ring-1 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all placeholder:text-zinc-600 shadow-inner"
        />
        {value && (
          <button
            onClick={() => { onChange(""); inputRef.current?.focus(); }}
            className="absolute right-3 top-2.5 text-zinc-500 hover:text-white transition-colors"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          
          <div className="absolute top-full left-0 right-0 mt-2 bg-zinc-950/95 backdrop-blur-xl border border-zinc-800 rounded-xl shadow-2xl z-50 max-h-[80vh] overflow-y-auto overflow-x-hidden">
            
            {/* Результаты поиска */}
            {suggestions.length > 0 ? (
              <div className="p-2">
                <div className="px-3 py-2 text-xs font-bold text-zinc-500 uppercase tracking-wider">
                    Быстрый переход
                </div>
                {suggestions.map((anime) => (
                  <button
                    key={anime.id}
                    onClick={() => handleAnimeClick(anime.id)}
                    className="w-full text-left p-2 rounded-lg hover:bg-zinc-900 transition-colors group flex items-start gap-3 mb-1"
                  >
                    <img
                        src={anime.poster}
                        alt={anime.title}
                        className="w-10 h-14 object-cover rounded shadow-lg group-hover:scale-105 transition-transform"
                    />
                    <div className="flex-1 min-w-0 py-0.5">
                        <div className="text-sm font-semibold text-zinc-200 group-hover:text-orange-400 transition-colors truncate">
                          {anime.title}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-400">
                             {anime.year}
                          </span>
                          <span className="text-[10px] text-zinc-500 flex items-center gap-1">
                             ★ {anime.rating}
                          </span>
                        </div>
                    </div>
                  </button>
                ))}
                
                <button 
                    onClick={() => { saveSearchHistory(value); onSelect(value) }}
                    className="w-full mt-2 p-3 text-center text-sm font-medium text-orange-500 bg-orange-500/10 hover:bg-orange-500/20 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                    <Search size={14} />
                    Смотреть все результаты для "{value}"
                </button>
              </div>
            ) : (
                // Если ничего не найдено
                !loading && (
                    <div className="p-6 text-center">
                        <p className="text-zinc-500 text-sm mb-2">Ничего не найдено</p>
                        <button 
                            onClick={() => { saveSearchHistory(value); onSelect(value) }}
                            className="text-orange-500 text-sm hover:underline"
                        >
                            Искать в каталоге &rarr;
                        </button>
                    </div>
                )
            )}
            
            {loading && (
                 <div className="p-4 flex justify-center">
                    <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
                 </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}