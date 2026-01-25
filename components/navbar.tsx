"use client"

import Link from "next/link"
import { useRouter, usePathname } from "next/navigation"
import { useState, useEffect } from "react"
import { Menu, X, ChevronDown, Flame, Tv, Zap, Compass, Home, BookMarked, History, Calendar, Settings, GraduationCap, LogOut, User as UserIcon } from "lucide-react"
import { GENRES_MAP } from "@/lib/shikimori"
import { SearchSuggestions } from "@/components/search-suggestions"
import { EpisodeUpdateBadge } from "@/components/episode-update-badge"
import { useEpisodeUpdates } from "@/hooks/use-episode-updates"
import { cn } from "@/lib/utils"
import { useAuth } from "@/components/auth-provider"
import { AuthModal } from "@/components/auth-modal"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

// Helper для сохранения истории поиска
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

export function Navbar() {
  const router = useRouter()
  const pathname = usePathname()
  const { user, signOut, profile } = useAuth()
  
  const [isOpen, setIsOpen] = useState(false) // Мобильное меню
  const [isGenresOpen, setIsGenresOpen] = useState(false) // Мобильные жанры
  const [searchValue, setSearchValue] = useState("")
  const [scrolled, setScrolled] = useState(false)
  
  const { updates, clearUpdate, clearAllUpdates } = useEpisodeUpdates()

  // Отслеживание скролла для изменения прозрачности хедера
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  // Блокировка скролла body при открытом меню
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => { document.body.style.overflow = 'unset' }
  }, [isOpen])

  const handleSearchSelect = (query: string) => {
    if (!query.trim()) return
    saveSearchHistory(query)
    router.push(`/catalog?search=${encodeURIComponent(query)}`)
    setIsOpen(false)
  }

  // Плавный скролл наверх, если мы уже на главной
  const handleLogoClick = (e: React.MouseEvent) => {
    if (pathname === "/") {
      e.preventDefault()
      window.scrollTo({ top: 0, behavior: "smooth" })
      setIsOpen(false)
    }
  }

  return (
    <>
      <header 
        className={cn(
          "fixed top-0 left-0 right-0 z-50 w-full border-b border-white/5 transition-all duration-300 bg-zinc-950/90 backdrop-blur-xl shadow-lg shadow-black/20"
        )}
      >
        <div className="container mx-auto px-4 h-16 md:h-20 flex items-center justify-between gap-4">
          
          {/* 1. ЛОГОТИП */}
          <Link href="/" onClick={handleLogoClick} className="flex items-center gap-3 z-50 group relative">
             {/*<div className="relative w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center">
               <div className="absolute inset-0 bg-orange-600 rounded-xl rotate-6 opacity-50 blur-[6px] group-hover:opacity-80 transition-opacity duration-500"></div>
               <div className="absolute inset-0 bg-red-600 rounded-xl -rotate-6 opacity-50 blur-[6px] group-hover:opacity-80 transition-opacity duration-500"></div>
               <div className="relative w-full h-full bg-zinc-900 border border-white/10 rounded-xl flex items-center justify-center shadow-2xl overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <Zap className="w-5 h-5 sm:w-6 sm:h-6 text-orange-500 fill-orange-500 transform group-hover:scale-110 transition-transform" />
               </div>
             </div>*/}
             <div className="flex flex-col justify-center">
               <h1 className="text-xl sm:text-2xl font-black tracking-tighter text-white leading-none font-unbounded">
                 Weeb.<span className="text-orange-500">X</span>
               </h1>
             </div>
          </Link>

          {/* 2. НАВИГАЦИЯ (DESKTOP) */}
          <nav className="hidden lg:flex items-center gap-1 bg-zinc-900/50 p-1 rounded-full border border-white/5 backdrop-blur-md">
            <Link 
              href="/" 
              onClick={handleLogoClick}
              className={cn(
                "px-5 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2",
                pathname === "/" 
                  ? "bg-zinc-800 text-white shadow-lg" 
                  : "text-zinc-400 hover:text-white hover:bg-zinc-800/50"
              )}
            >
              <Home size={16} /> Главная
            </Link>
            
            <Link 
              href="/catalog?sort=popular" 
              className={cn(
                "px-5 py-2 rounded-full text-sm font-bold transition-all flex items-center gap-2",
                pathname.includes("sort=popular")
                  ? "bg-orange-600 text-white shadow-lg shadow-orange-900/20" 
                  : "text-orange-500 hover:text-orange-400 hover:bg-orange-500/10"
              )}
            >
              <Flame size={16} className={pathname.includes("sort=popular") ? "fill-white" : ""} /> Топ-100
            </Link>

            <Link 
              href="/catalog?sort=new&status=ongoing" 
              className={cn(
                "px-5 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2",
                pathname === "/catalog" && !pathname.includes("popular")
                  ? "bg-zinc-800 text-white shadow-lg" 
                  : "text-zinc-400 hover:text-white hover:bg-zinc-800/50"
              )}
            >
              <Tv size={16} /> Онгоинги
            </Link>

            {/* Dropdown "Ещё" */}
            <div className="group relative px-4 py-2 cursor-pointer">
              <span className={cn(
                "flex items-center gap-1.5 text-sm font-medium transition-colors",
                (pathname.includes("genre") || pathname === "/bookmarks" || pathname === "/schedule" || pathname === "/history" || pathname === "/beginners") ? "text-white" : "text-zinc-400 group-hover:text-white"
              )}>
                <Settings size={16} /> Ещё <ChevronDown size={14} className="group-hover:rotate-180 transition-transform duration-300" />
              </span>
              
              {/* Выпадающее меню */}
              <div className="absolute top-full left-1/2 -translate-x-1/2 pt-4 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 transform translate-y-2 group-hover:translate-y-0 z-50">
                <div className="w-64 bg-zinc-950/95 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-2xl space-y-2">
                  {/* Жанры 
                  <div className="border-b border-white/5 pb-2">
                    <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">Жанры</p>
                    <div className="grid grid-cols-2 gap-1">
                      {Object.entries(GENRES_MAP).map(([name, id]) => (
                        <Link 
                          key={id} 
                          href={`/catalog?genre=${id}`}
                          className="px-3 py-1.5 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-orange-400 transition text-xs font-medium border border-transparent hover:border-white/5 text-center"
                        >
                          {name}
                        </Link>
                      ))}
                    </div>
                  </div>*/}
                  
                  {/* Другие разделы */}
                  <div className="space-y-1">
                    <Link 
                      href="/beginners" 
                      className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition text-sm font-medium"
                    >
                      <GraduationCap size={14} /> Для новичков
                    </Link>
                    <Link 
                      href="/bookmarks" 
                      className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition text-sm font-medium"
                    >
                      <BookMarked size={14} /> Закладки
                    </Link>
                    <Link 
                      href="/schedule" 
                      className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition text-sm font-medium"
                    >
                      <Calendar size={14} /> Расписание
                    </Link>
                    <Link 
                      href="/history" 
                      className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition text-sm font-medium"
                    >
                      <History size={14} /> История
                    </Link>
                  </div>
                </div>
              </div>
            </div>

          </nav>

          {/* 3. ПОИСК (DESKTOP + TABLET) */}
          <div className="flex-1 max-w-sm xl:max-w-md hidden md:block">
            <SearchSuggestions
              value={searchValue}
              onChange={setSearchValue}
              onSelect={handleSearchSelect}
              placeholder="Поиск аниме..."
            />
          </div>

          {/* 4. ПРОФИЛЬ/АВТОРИЗАЦИЯ + УВЕДОМЛЕНИЯ О НОВЫХ СЕРИЯХ (DESKTOP) */}
          <div className="flex items-center gap-6 hidden md:block">
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="w-9 h-9 rounded-full bg-gradient-to-tr from-orange-500 to-purple-600 p-[2px] overflow-hidden">
                     <Avatar className="w-full h-full">
                       <AvatarImage src={profile?.avatar_url || undefined} alt="User Avatar" />
                       <AvatarFallback className="bg-zinc-900 text-white font-semibold">
                         {profile?.username ? profile.username.slice(0, 2).toUpperCase() : user.email?.slice(0, 2).toUpperCase()}
                       </AvatarFallback>
                     </Avatar>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 bg-zinc-950 border-zinc-800 text-zinc-200">
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none text-white">Аккаунт</p>
                      <p className="text-xs leading-none text-zinc-500 truncate">{user.email}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-zinc-800" />
                  <DropdownMenuItem asChild className="cursor-pointer hover:bg-zinc-900 focus:bg-zinc-900">
                     <Link href="/settings">Настройки профиля</Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-zinc-800" />
                  <DropdownMenuItem onClick={signOut} className="cursor-pointer text-red-500 focus:text-red-400 focus:bg-red-500/10">
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Выйти</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <AuthModal />
            )}
            
            <EpisodeUpdateBadge 
              updates={updates} 
              onClearUpdate={clearUpdate}
              onClearAll={clearAllUpdates}
            />
          </div>

          {/* 5. МОБИЛЬНЫЙ ТОГГЛ + УВЕДОМЛЕНИЯ + ПРОФИЛЬ */}
          <div className="flex items-center gap-2 md:hidden">
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="w-8 h-8 rounded-full bg-gradient-to-tr from-orange-500 to-purple-600 p-[1.5px] overflow-hidden">
                     <Avatar className="w-full h-full">
                       <AvatarImage src={profile?.avatar_url || undefined} alt="User Avatar" />
                       <AvatarFallback className="bg-zinc-900 text-white font-semibold text-xs">
                         {profile?.username ? profile.username.slice(0, 2).toUpperCase() : user.email?.slice(0, 2).toUpperCase()}
                       </AvatarFallback>
                     </Avatar>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 bg-zinc-950 border-zinc-800 text-zinc-200">
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-xs font-medium leading-none text-white">Аккаунт</p>
                      <p className="text-xs leading-none text-zinc-500 truncate">{user.email}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-zinc-800" />
                  <DropdownMenuItem asChild className="cursor-pointer hover:bg-zinc-900 focus:bg-zinc-900 text-sm">
                     <Link href="/settings">Настройки</Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-zinc-800" />
                  <DropdownMenuItem onClick={signOut} className="cursor-pointer text-red-500 focus:text-red-400 focus:bg-red-500/10 text-sm">
                    <LogOut className="mr-2 h-3 w-3" />
                    <span>Выйти</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="scale-75 origin-right">
                <AuthModal />
              </div>
            )}
            
            <EpisodeUpdateBadge 
              updates={updates} 
              onClearUpdate={clearUpdate}
              onClearAll={clearAllUpdates}
            />
            <button 
              className="p-2 text-zinc-300 hover:text-white active:scale-95 transition-transform" 
              onClick={() => setIsOpen(!isOpen)}
              aria-label="Toggle menu"
            >
              {isOpen ? <X size={28} /> : <Menu size={28} />}
            </button>
          </div>
        </div>
      </header>

      <div className="h-16 md:h-20" aria-hidden="true" />

      {/* === МОБИЛЬНОЕ МЕНЮ (Full Screen) === */}
      {isOpen && (
         <div className="fixed inset-0 top-16 z-40 bg-zinc-950/95 backdrop-blur-xl md:hidden flex flex-col overflow-y-auto animate-in fade-in slide-in-from-bottom-5 duration-200">
            <div className="p-4 space-y-6 pb-20">
                
                {/* Поиск для мобилок */}
                <div className="relative z-50">
                   <SearchSuggestions
                      value={searchValue}
                      onChange={setSearchValue}
                      onSelect={handleSearchSelect}
                      placeholder="Что ищем?"
                      className="w-full h-12 text-lg"
                   />
                </div>

                {/* Основные ссылки */}
                <div className="space-y-2">
                    <Link 
                      href="/" 
                      onClick={(e) => { handleLogoClick(e); setIsOpen(false); }} 
                      className={cn(
                        "flex items-center gap-4 px-4 py-4 rounded-xl text-lg font-medium transition-all active:scale-[0.98]",
                        pathname === "/" ? "bg-zinc-900 text-white border border-zinc-800" : "text-zinc-400 hover:bg-zinc-900/50 hover:text-white"
                      )}
                    >
                        <Home className="w-6 h-6 text-orange-500" /> Главная
                    </Link>

                    <Link 
                      href="/catalog?sort=popular" 
                      onClick={() => setIsOpen(false)} 
                      className={cn(
                        "flex items-center gap-4 px-4 py-4 rounded-xl text-lg font-bold transition-all active:scale-[0.98]",
                         pathname.includes("sort=popular") ? "bg-orange-500/10 text-orange-500 border border-orange-500/20" : "text-zinc-400 hover:bg-zinc-900/50 hover:text-orange-500"
                      )}
                    >
                        <Flame className="w-6 h-6" /> Популярное
                    </Link>

                    <Link 
                      href="/catalog?sort=new&status=ongoing" 
                      onClick={() => setIsOpen(false)} 
                      className="flex items-center gap-4 px-4 py-4 rounded-xl text-lg font-medium text-zinc-400 hover:bg-zinc-900/50 hover:text-white transition-all active:scale-[0.98]"
                    >
                        <Tv className="w-6 h-6 text-blue-500" /> Онгоинги
                    </Link>

                    <Link 
                      href="/catalog" 
                      onClick={() => setIsOpen(false)} 
                      className="flex items-center gap-4 px-4 py-4 rounded-xl text-lg font-medium text-zinc-400 hover:bg-zinc-900/50 hover:text-white transition-all active:scale-[0.98]"
                    >
                        <Compass className="w-6 h-6 text-purple-500" /> Весь каталог
                    </Link>

                    <Link 
                      href="/beginners" 
                      onClick={() => setIsOpen(false)} 
                      className={cn(
                        "flex items-center gap-4 px-4 py-4 rounded-xl text-lg font-medium transition-all active:scale-[0.98]",
                        pathname === "/beginners" ? "bg-zinc-900 text-white border border-zinc-800" : "text-zinc-400 hover:bg-zinc-900/50 hover:text-white"
                      )}
                    >
                        <GraduationCap className="w-6 h-6 text-green-500" /> Для новичков
                    </Link>

                    <Link 
                      href="/bookmarks" 
                      onClick={() => setIsOpen(false)} 
                      className={cn(
                        "flex items-center gap-4 px-4 py-4 rounded-xl text-lg font-medium transition-all active:scale-[0.98]",
                        pathname === "/bookmarks" ? "bg-zinc-900 text-white border border-zinc-800" : "text-zinc-400 hover:bg-zinc-900/50 hover:text-white"
                      )}
                    >
                        <BookMarked className="w-6 h-6 text-orange-500" /> Закладки
                    </Link>

                    <Link 
                      href="/schedule" 
                      onClick={() => setIsOpen(false)} 
                      className={cn(
                        "flex items-center gap-4 px-4 py-4 rounded-xl text-lg font-medium transition-all active:scale-[0.98]",
                        pathname === "/schedule" ? "bg-zinc-900 text-white border border-zinc-800" : "text-zinc-400 hover:bg-zinc-900/50 hover:text-white"
                      )}
                    >
                        <Calendar className="w-6 h-6 text-purple-500" /> Расписание
                    </Link>

                    <Link 
                      href="/history" 
                      onClick={() => setIsOpen(false)} 
                      className={cn(
                        "flex items-center gap-4 px-4 py-4 rounded-xl text-lg font-medium transition-all active:scale-[0.98]",
                        pathname === "/history" ? "bg-zinc-900 text-white border border-zinc-800" : "text-zinc-400 hover:bg-zinc-900/50 hover:text-white"
                      )}
                    >
                        <History className="w-6 h-6 text-blue-500" /> История
                    </Link>
                </div>

                <hr className="border-white/5" />

                {/* Аккордеон Жанров */}
                <div className="rounded-xl border border-white/5 overflow-hidden bg-zinc-900/20">
                    <button 
                      onClick={() => setIsGenresOpen(!isGenresOpen)}
                      className="w-full flex items-center justify-between px-4 py-4 text-left text-lg font-medium text-zinc-300 hover:bg-zinc-900/50 transition-colors"
                    >
                       <span className="flex items-center gap-3">
                          <BookMarked className="w-6 h-6 text-green-500" /> Жанры
                       </span>
                       <ChevronDown className={cn("transition-transform duration-300", isGenresOpen ? "rotate-180" : "")} />
                    </button>
                    
                    <div className={cn(
                      "grid grid-cols-2 gap-2 px-4 overflow-hidden transition-all duration-300 ease-in-out",
                      isGenresOpen ? "max-h-[800px] py-4 opacity-100" : "max-h-0 py-0 opacity-0"
                    )}>
                       {Object.entries(GENRES_MAP).map(([name, id]) => (
                          <Link 
                            key={id} 
                            href={`/catalog?genre=${id}`}
                            onClick={() => setIsOpen(false)}
                            className="text-sm py-2.5 px-3 rounded-lg bg-zinc-900 text-zinc-400 text-center border border-zinc-800 hover:border-orange-500/50 hover:text-white transition-colors"
                          >
                            {name}
                          </Link>
                       ))}
                    </div>
                </div>
            </div>
         </div>
      )}
    </>
  )
}