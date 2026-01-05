"use client"

import { useState, useEffect, useRef } from "react"
import { Search, Clock, X } from "lucide-react"
import { Anime } from "@/lib/shikimori"
import { searchAnime } from "@/lib/shikimori"

interface SearchSuggestionsProps {
  value: string
  onChange: (value: string) => void
  onSelect: (value: string) => void
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
  const [suggestions, setSuggestions] = useState<Anime[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [searchHistory, setSearchHistory] = useState<string[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  // Загружаем историю поиска при монтировании
  useEffect(() => {
    try {
      const history = JSON.parse(localStorage.getItem("search-history") || "[]")
      setSearchHistory(history.slice(0, 5)) // Показываем до 5 последних запросов
    } catch (err) {}
  }, [])

  // Поиск с дебаунсом
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    if (value.trim().length < 2) {
      setSuggestions([])
      setIsOpen(false)
      return
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const results = await searchAnime(value.trim())
        setSuggestions(results.slice(0, 5)) // Ограничиваем до 5 результатов
        setIsOpen(true)
      } catch (error) {
        console.error("Search error:", error)
        setSuggestions([])
      } finally {
        setLoading(false)
      }
    }, 300)

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [value])

  const handleSelect = (selectedValue: string) => {
    onChange(selectedValue)
    onSelect(selectedValue)
    setIsOpen(false)
    
    // Сохраняем в историю
    try {
      const history = JSON.parse(localStorage.getItem("search-history") || "[]")
      const newHistory = [selectedValue, ...history.filter((h: string) => h !== selectedValue)].slice(0, 5)
      localStorage.setItem("search-history", JSON.stringify(newHistory))
      setSearchHistory(newHistory)
    } catch (err) {}
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setIsOpen(false)
    }
  }

  const clearInput = () => {
    onChange("")
    setIsOpen(false)
    inputRef.current?.focus()
  }

  return (
    <div className={`relative ${className}`}>
      {/* Поле поиска */}
      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500 group-focus-within:text-orange-500 transition-colors" />
        <input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => value.trim().length >= 2 && setIsOpen(true)}
          onKeyDown={handleKeyDown}
          className="w-full h-9 rounded-full bg-zinc-900 border border-zinc-800 pl-10 pr-10 text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all placeholder:text-zinc-600"
        />
        {value && (
          <button
            onClick={clearInput}
            className="absolute right-3 top-2.5 text-zinc-500 hover:text-white transition-colors"
            type="button"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Выпадающие подсказки */}
      {isOpen && (
        <>
          {/* Затемнение фона */}
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)}
          />
          
          {/* Список подсказок */}
          <div className="absolute top-full left-0 right-0 mt-2 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl z-50 max-h-96 overflow-y-auto">
            {/* История поиска (показывается когда нет результатов) */}
            {suggestions.length === 0 && !loading && searchHistory.length > 0 && (
              <div className="p-2">
                <div className="px-3 py-2 text-xs font-medium text-zinc-500 flex items-center gap-2">
                  <Clock size={12} />
                  Недавние запросы
                </div>
                {searchHistory.map((item, index) => (
                  <button
                    key={index}
                    onClick={() => handleSelect(item)}
                    className="w-full text-left px-3 py-2 rounded-lg text-sm text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors flex items-center gap-2"
                  >
                    <Clock size={12} className="text-zinc-600" />
                    {item}
                  </button>
                ))}
              </div>
            )}

            {/* Загрузка */}
            {loading && (
              <div className="p-4 text-center text-zinc-500 text-sm">
                Поиск...
              </div>
            )}

            {/* Результаты поиска */}
            {suggestions.length > 0 && (
              <div className="p-2">
                <div className="px-3 py-2 text-xs font-medium text-zinc-500">
                  Найденные аниме
                </div>
                {suggestions.map((anime) => (
                  <button
                    key={anime.id}
                    onClick={() => handleSelect(anime.title)}
                    className="w-full text-left p-3 rounded-lg hover:bg-zinc-800 transition-colors group"
                  >
                    <div className="flex items-start gap-3">
                      {/* Постер */}
                      <img
                        src={anime.poster}
                        alt={anime.title}
                        className="w-12 h-16 object-cover rounded-md flex-shrink-0"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement
                          target.src = `https://placehold.co/48x64/18181b/orange/png?text=${encodeURIComponent(anime.title.slice(0, 10))}`
                        }}
                      />
                      
                      {/* Информация */}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-white group-hover:text-orange-500 transition-colors truncate">
                          {anime.title}
                        </div>
                        <div className="text-xs text-zinc-500 mt-1 truncate">
                          {anime.originalTitle}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-zinc-400">
                            {anime.year}
                          </span>
                          <span className="text-xs text-zinc-400">•</span>
                          <span className="text-xs text-zinc-400">
                            {anime.status === 'Ongoing' ? 'Онгоинг' : 'Завершено'}
                          </span>
                          <span className="text-xs text-zinc-400">•</span>
                          <span className="text-xs text-orange-500">
                            ★ {anime.rating}
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Нет результатов */}
            {suggestions.length === 0 && !loading && searchHistory.length === 0 && value.trim().length >= 2 && (
              <div className="p-4 text-center text-zinc-500 text-sm">
                Ничего не найдено
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
