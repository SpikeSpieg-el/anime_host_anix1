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
import { ThemeToggle } from "@/components/theme-toggle"
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
          "fixed top-0 left-0 right-0 z-50 w-full border-b transition-all duration-300 bg-background/90 backdrop-blur-xl shadow-lg shadow-black/20 dark:border-white/5 dark:shadow-black/20 border-border"
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
               <h1 className="text-xl sm:text-2xl font-black tracking-tighter text-foreground leading-none font-unbounded">
                 Weeb.<span className="text-primary">X</span>
               </h1>
             </div>
          </Link>

          {/* 2. НАВИГАЦИЯ (DESKTOP) */}
          <nav className="hidden lg:flex items-center gap-1 bg-secondary/50 p-1 rounded-full border backdrop-blur-md border-border">
            <Link 
              href="/" 
              onClick={handleLogoClick}
              className={cn(
                "px-5 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2",
                pathname === "/" 
                  ? "bg-secondary text-foreground shadow-lg" 
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
              )}
            >
              <Home size={16} /> Главная
            </Link>
            
            <Link 
              href="/catalog?sort=popular" 
              className={cn(
                "px-5 py-2 rounded-full text-sm font-bold transition-all flex items-center gap-2",
                pathname.includes("sort=popular")
                  ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" 
                  : "text-primary hover:text-primary/80 hover:bg-primary/10"
              )}
            >
              <Flame size={16} className={pathname.includes("sort=popular") ? "fill-white" : ""} /> Топ-100
            </Link>

            <Link 
              href="/catalog?sort=new&status=ongoing" 
              className={cn(
                "px-5 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2",
                pathname === "/catalog" && !pathname.includes("popular")
                  ? "bg-secondary text-foreground shadow-lg" 
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
              )}
            >
              <Tv size={16} /> Онгоинги
            </Link>

            {/* Dropdown "Ещё" */}
            <div className="group relative px-4 py-2 cursor-pointer">
              <span className={cn(
                "flex items-center gap-1.5 text-sm font-medium transition-colors",
                (pathname.includes("genre") || pathname === "/bookmarks" || pathname === "/schedule" || pathname === "/history" || pathname === "/beginners") ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"
              )}>
                <Settings size={16} /> Ещё <ChevronDown size={14} className="group-hover:rotate-180 transition-transform duration-300" />
              </span>
              
              {/* Выпадающее меню */}
              <div className="absolute top-full left-1/2 -translate-x-1/2 pt-4 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 transform translate-y-2 group-hover:translate-y-0 z-50">
                <div className="w-64 bg-background/95 backdrop-blur-xl border rounded-2xl p-4 shadow-2xl space-y-2">
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
                      className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-accent hover:text-accent-foreground transition text-sm font-medium text-muted-foreground"
                    >
                      <GraduationCap size={14} /> Для новичков
                    </Link>
                    <Link 
                      href="/bookmarks" 
                      className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-accent hover:text-accent-foreground transition text-sm font-medium text-muted-foreground"
                    >
                      <BookMarked size={14} /> Закладки
                    </Link>
                    <Link 
                      href="/schedule" 
                      className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-accent hover:text-accent-foreground transition text-sm font-medium text-muted-foreground"
                    >
                      <Calendar size={14} /> Расписание
                    </Link>
                    <Link 
                      href="/history" 
                      className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-accent hover:text-accent-foreground transition text-sm font-medium text-muted-foreground"
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

          {/* 4. ПРОФИЛЬ/АВТОРИЗАЦИЯ + УВЕДОМЛЕНИЯ О НОВЫХ СЕРИЯХ + ПЕРЕКЛЮЧАТЕЛЬ ТЕМЫ (DESKTOP) */}
          <div className="flex items-center gap-6 hidden md:block">
            
            
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="w-9 h-9 rounded-full bg-gradient-to-tr from-orange-500 to-purple-600 p-[2px] overflow-hidden">
                     <Avatar className="w-full h-full">
                       <AvatarImage src={profile?.avatar_url || undefined} alt="User Avatar" />
                       <AvatarFallback className="bg-secondary text-secondary-foreground font-semibold">
                         {profile?.username ? profile.username.slice(0, 2).toUpperCase() : user.email?.slice(0, 2).toUpperCase()}
                       </AvatarFallback>
                     </Avatar>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 bg-background border text-foreground">
                  <DropdownMenuLabel className="flex items-center gap-2 font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none text-foreground">Аккаунт</p>
                      <p className="text-xs leading-none text-muted-foreground truncate">{user.email}</p>
                    </div>
                    <ThemeToggle />
                  </DropdownMenuLabel>
                  
                  <DropdownMenuSeparator className="bg-border" />
                  <DropdownMenuItem asChild className="cursor-pointer hover:bg-accent focus:bg-accent">
                     <Link href="/settings">Настройки профиля</Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-border" />
                  <DropdownMenuItem onClick={signOut} className="cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10">
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
                       <AvatarFallback className="bg-secondary text-secondary-foreground font-semibold text-xs dark:bg-zinc-900 dark:text-white">
                         {profile?.username ? profile.username.slice(0, 2).toUpperCase() : user.email?.slice(0, 2).toUpperCase()}
                       </AvatarFallback>
                     </Avatar>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 bg-background border text-foreground">
                  <DropdownMenuLabel className="flex justify-between items-center font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-xs leading-none text-foreground">Аккаунт</p>
                      <p className="text-xs leading-none text-muted-foreground truncate">{user.email}</p>
                    </div>
                    <ThemeToggle />
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-border" />
                  <DropdownMenuItem asChild className="cursor-pointer hover:bg-accent focus:bg-accent text-sm dark:hover:bg-zinc-900 dark:focus:bg-zinc-900">
                     <Link href="/settings">Настройки</Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-border" />
                  <DropdownMenuItem onClick={signOut} className="cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10 text-sm dark:text-red-500 dark:focus:text-red-400 dark:focus:bg-red-500/10">
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
              className="p-2 text-muted-foreground hover:text-foreground active:scale-95 transition-transform" 
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
         <div className="fixed inset-0 top-16 z-40 bg-background/95 backdrop-blur-xl md:hidden flex flex-col overflow-y-auto animate-in fade-in slide-in-from-bottom-5 duration-200">
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
                        pathname === "/" ? "bg-secondary text-foreground border dark:bg-zinc-900 dark:text-white dark:border-zinc-800" : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground dark:text-zinc-400 dark:hover:bg-zinc-900/50 dark:hover:text-white"
                      )}
                    >
                        <Home className="w-6 h-6 text-orange-500" /> Главная
                    </Link>

                    <Link 
                      href="/catalog?sort=popular" 
                      onClick={() => setIsOpen(false)} 
                      className={cn(
                        "flex items-center gap-4 px-4 py-4 rounded-xl text-lg font-bold transition-all active:scale-[0.98]",
                         pathname.includes("sort=popular") ? "bg-primary/10 text-primary border border-primary/20 dark:bg-orange-500/10 dark:text-orange-500 dark:border-orange-500/20" : "text-muted-foreground hover:bg-secondary/50 hover:text-primary dark:text-zinc-400 dark:hover:bg-zinc-900/50 dark:hover:text-orange-500"
                      )}
                    >
                        <Flame className="w-6 h-6" /> Популярное
                    </Link>

                    <Link 
                      href="/catalog?sort=new&status=ongoing" 
                      onClick={() => setIsOpen(false)} 
                      className="flex items-center gap-4 px-4 py-4 rounded-xl text-lg font-medium text-muted-foreground hover:bg-secondary/50 hover:text-foreground transition-all active:scale-[0.98] dark:text-zinc-400 dark:hover:bg-zinc-900/50 dark:hover:text-white"
                    >
                        <Tv className="w-6 h-6 text-blue-500" /> Онгоинги
                    </Link>

                    <Link 
                      href="/catalog" 
                      onClick={() => setIsOpen(false)} 
                      className="flex items-center gap-4 px-4 py-4 rounded-xl text-lg font-medium text-muted-foreground hover:bg-secondary/50 hover:text-foreground transition-all active:scale-[0.98] dark:text-zinc-400 dark:hover:bg-zinc-900/50 dark:hover:text-white"
                    >
                        <Compass className="w-6 h-6 text-purple-500" /> Весь каталог
                    </Link>

                    <Link 
                      href="/beginners" 
                      onClick={() => setIsOpen(false)} 
                      className={cn(
                        "flex items-center gap-4 px-4 py-4 rounded-xl text-lg font-medium transition-all active:scale-[0.98]",
                        pathname === "/beginners" ? "bg-secondary text-foreground border dark:bg-zinc-900 dark:text-white dark:border-zinc-800" : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground dark:text-zinc-400 dark:hover:bg-zinc-900/50 dark:hover:text-white"
                      )}
                    >
                        <GraduationCap className="w-6 h-6 text-green-500" /> Для новичков
                    </Link>

                    <Link 
                      href="/bookmarks" 
                      onClick={() => setIsOpen(false)} 
                      className={cn(
                        "flex items-center gap-4 px-4 py-4 rounded-xl text-lg font-medium transition-all active:scale-[0.98]",
                        pathname === "/bookmarks" ? "bg-secondary text-foreground border dark:bg-zinc-900 dark:text-white dark:border-zinc-800" : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground dark:text-zinc-400 dark:hover:bg-zinc-900/50 dark:hover:text-white"
                      )}
                    >
                        <BookMarked className="w-6 h-6 text-orange-500" /> Закладки
                    </Link>

                    <Link 
                      href="/schedule" 
                      onClick={() => setIsOpen(false)} 
                      className={cn(
                        "flex items-center gap-4 px-4 py-4 rounded-xl text-lg font-medium transition-all active:scale-[0.98]",
                        pathname === "/schedule" ? "bg-secondary text-foreground border dark:bg-zinc-900 dark:text-white dark:border-zinc-800" : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground dark:text-zinc-400 dark:hover:bg-zinc-900/50 dark:hover:text-white"
                      )}
                    >
                        <Calendar className="w-6 h-6 text-purple-500" /> Расписание
                    </Link>

                    <Link 
                      href="/history" 
                      onClick={() => setIsOpen(false)} 
                      className={cn(
                        "flex items-center gap-4 px-4 py-4 rounded-xl text-lg font-medium transition-all active:scale-[0.98]",
                        pathname === "/history" ? "bg-secondary text-foreground border dark:bg-zinc-900 dark:text-white dark:border-zinc-800" : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground dark:text-zinc-400 dark:hover:bg-zinc-900/50 dark:hover:text-white"
                      )}
                    >
                        <History className="w-6 h-6 text-blue-500" /> История
                    </Link>
                </div>

                <hr className="border-border dark:border-white/5" />

                {/* Аккордеон Жанров */}
                <div className="rounded-xl border overflow-hidden bg-secondary/20 dark:bg-zinc-900/20 dark:border-white/5 border-border">
                    <button 
                      onClick={() => setIsGenresOpen(!isGenresOpen)}
                      className="w-full flex items-center justify-between px-4 py-4 text-left text-lg font-medium text-muted-foreground hover:bg-secondary/50 transition-colors dark:text-zinc-300 dark:hover:bg-zinc-900/50"
                    >
                       <span className="flex items-center gap-3">
                          <BookMarked className="w-6 h-6 text-green-500" /> Жанры
                       </span>
                       <ChevronDown className={cn("transition-transform duration-300", isGenresOpen ? "rotate-180" : "")} />
                    </button>
                    
                    <div className={cn(
                      "grid grid-cols-2 gap-2 px-4 overflow-hidden transition-all duration-300 ease-in-out",
                      isGenresOpen ? "max-h-[1200px] py-4 opacity-100" : "max-h-0 py-0 opacity-0"
                    )}>
                       {Object.entries(GENRES_MAP).map(([name, id]) => (
                          <Link 
                            key={id} 
                            href={`/catalog?genre=${id}`}
                            onClick={() => setIsOpen(false)}
                            className="text-sm py-2.5 px-3 rounded-lg bg-secondary text-muted-foreground text-center border hover:border-primary/50 hover:text-foreground transition-colors dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-800 dark:hover:border-orange-500/50 dark:hover:text-white"
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