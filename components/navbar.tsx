"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { Menu, X, ChevronDown, Flame, Tv, Zap } from "lucide-react"
import { GENRES_MAP } from "@/lib/shikimori"
import { SearchSuggestions } from "@/components/search-suggestions"

export function Navbar() {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [searchValue, setSearchValue] = useState("")

  // Логика поиска: Редирект в каталог
  const handleSearchSelect = (query: string) => {
    if (!query.trim()) return
    // ВАЖНО: Перенаправляем на каталог с параметром search
    router.push(`/catalog?search=${encodeURIComponent(query)}`)
    setIsOpen(false)
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/5 bg-zinc-950/80 backdrop-blur-md">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between gap-4">
        
        {/* ЛОГОТИП */}
        <Link href="/" className="flex items-center gap-3 z-50 group">
           <div className="relative w-9 h-9 flex items-center justify-center">
             <div className="absolute inset-0 bg-orange-600 rounded-xl rotate-6 opacity-50 blur-[4px] group-hover:opacity-80 transition-opacity"></div>
             <div className="absolute inset-0 bg-red-600 rounded-xl -rotate-6 opacity-50 blur-[4px] group-hover:opacity-80 transition-opacity"></div>
             <div className="relative w-full h-full bg-gradient-to-br from-zinc-800 to-black border border-white/10 rounded-xl flex items-center justify-center shadow-2xl">
                <Zap className="w-5 h-5 text-orange-500 fill-orange-500" />
             </div>
           </div>
           <div className="flex flex-col justify-center">
             <h1 className="text-xl font-black tracking-tighter text-white leading-none">
               ANI<span className="text-orange-500">X</span>
             </h1>
             <span className="text-[9px] font-bold tracking-[0.2em] text-zinc-500 uppercase leading-none group-hover:text-zinc-300 transition-colors">
               Stream
             </span>
           </div>
        </Link>

        {/* Навигация (Desktop) */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-zinc-400">
          <Link href="/" className="hover:text-white transition flex items-center gap-1.5">
            Главная
          </Link>
          
          {/* Меню Жанров */}
          <div className="group relative h-16 flex items-center cursor-pointer">
            <span className="group-hover:text-white transition flex items-center gap-1">
              Жанры <ChevronDown size={14} />
            </span>
            <div className="absolute top-full left-0 w-[450px] bg-zinc-950 border border-zinc-800 rounded-xl p-4 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all transform translate-y-2 group-hover:translate-y-0 shadow-2xl grid grid-cols-3 gap-2 z-50">
              {Object.entries(GENRES_MAP).map(([name, id]) => (
                <Link 
                  key={id} 
                  href={`/catalog?genre=${id}`}
                  className="px-3 py-2 rounded-lg hover:bg-zinc-900 text-zinc-400 hover:text-orange-500 transition text-xs border border-transparent hover:border-zinc-800"
                >
                  {name}
                </Link>
              ))}
            </div>
          </div>

          <Link href="/catalog?sort=new&status=ongoing" className="hover:text-white transition flex items-center gap-1.5">
            <Tv size={16} /> Онгоинги
          </Link>
          <Link href="/catalog?sort=popular" className="text-orange-500 hover:text-orange-400 transition flex items-center gap-1.5 font-bold">
            <Flame size={16} /> Топ-100
          </Link>
        </nav>

        {/* Поиск */}
        <div className="flex-1 max-w-md hidden md:block">
          <SearchSuggestions
            value={searchValue}
            onChange={setSearchValue}
            onSelect={handleSearchSelect}
            placeholder="Поиск аниме..."
          />
        </div>

        {/* Мобильное меню */}
        <button className="md:hidden text-zinc-300" onClick={() => setIsOpen(!isOpen)}>
          {isOpen ? <X /> : <Menu />}
        </button>
      </div>

      {/* Мобильное выпадающее меню */}
      {isOpen && (
         <div className="md:hidden absolute top-16 left-0 w-full bg-zinc-950 border-b border-zinc-800 p-4 flex flex-col gap-4 shadow-2xl animate-in slide-in-from-top-5 h-[calc(100vh-64px)] overflow-y-auto">
            <SearchSuggestions
              value={searchValue}
              onChange={setSearchValue}
              onSelect={handleSearchSelect}
              placeholder="Поиск..."
              className="w-full"
            />
            
            <div className="space-y-4">
                <Link href="/catalog?sort=popular" onClick={() => setIsOpen(false)} className="flex items-center gap-2 text-orange-500 font-bold text-lg">
                    <Flame size={20} /> Популярное
                </Link>
                <Link href="/catalog?sort=new&status=ongoing" onClick={() => setIsOpen(false)} className="flex items-center gap-2 text-white font-medium text-lg">
                    <Tv size={20} /> Онгоинги
                </Link>
            </div>

            <div className="border-t border-zinc-800 pt-4">
                <h3 className="text-zinc-500 text-xs font-bold uppercase tracking-wider mb-3">Жанры</h3>
                <div className="grid grid-cols-2 gap-2">
                {Object.entries(GENRES_MAP).map(([name, id]) => (
                    <Link 
                        key={id} 
                        href={`/catalog?genre=${id}`}
                        className="px-3 py-2 bg-zinc-900 rounded-lg text-sm text-center text-zinc-400 hover:text-white"
                        onClick={() => setIsOpen(false)}
                    >
                        {name}
                    </Link>
                ))}
                </div>
            </div>
         </div>
      )}
    </header>
  )
}