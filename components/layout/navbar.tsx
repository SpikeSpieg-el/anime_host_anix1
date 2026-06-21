"use client"

import Link from "next/link"
import { useRouter, usePathname } from "next/navigation"
import { useState, useEffect, useMemo, useRef } from "react"
import {
  Flame, Tv, Compass, Home, BookMarked, History, Calendar,
  Settings, GraduationCap, LogOut, Search, MoreHorizontal, X, ArrowUp,
  Sparkles, Swords, Wrench, MessageCircle
} from "lucide-react"
import { SearchSuggestions } from "@/components/catalog/search-suggestions"
import { EpisodeUpdateBadge } from "@/components/watch/episode-update-badge"
import { useEpisodeUpdates } from "@/hooks/use-episode-updates"
import { cn } from "@/lib/utils"
import { useAuth } from "@/components/auth/auth-provider"
import { AuthModal } from "@/components/auth/auth-modal"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { ThemeToggle } from "@/components/shared/theme-toggle"
import { TVModeToggle } from "@/components/tv/tv-mode-toggle"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Charm } from "next/font/google"

// --- Helper для истории поиска ---
function saveSearchHistory(query: string) {
  if (typeof window === "undefined") return
  const normalized = query.trim()
  if (!normalized) return
  try {
    const raw = localStorage.getItem("search-history")
    const parsed = raw ? JSON.parse(raw) : []
    const current: string[] = Array.isArray(parsed) ? parsed.filter((x: any) => typeof x === "string") : []
    const next = [normalized, ...current.filter((q) => q !== normalized)].slice(10)
    localStorage.setItem("search-history", JSON.stringify(next))
    window.dispatchEvent(new Event("search-history-updated"))
  } catch (e) {
    console.error(e)
  }
}

export function Navbar() {
  const router = useRouter()
  const pathname = usePathname()
  const { user, signOut, profile, sessionLoading } = useAuth()
  const { updates, clearUpdate, clearAllUpdates } = useEpisodeUpdates()

  const isDev = process.env.NODE_ENV === 'development'

  // Состояния
  const [searchValue, setSearchValue] = useState("")
  const [scrolled, setScrolled] = useState(false)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  
  // Mobile specific states
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false)
  const [isMobileDropdownOpen, setIsMobileDropdownOpen] = useState(false)
  const [showBottomNav, setShowBottomNav] = useState(true)
  const lastScrollY = useRef(0)

  // Стабильная ссылка на аватар
  const avatarUrl = useMemo(() => {
    if (!profile?.avatar_url) return undefined;
    return `${profile.avatar_url}?t=${profile.updated_at || 'initial'}`;
  }, [profile?.avatar_url, profile?.updated_at]);

  // Логика скролла: прозрачность хедера + скрытие нижнего бара при скролле вниз
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY
      setScrolled(currentScrollY > 20)
      
      // Логика для мобильного бара (скрываем при скролле вниз, показываем при скролле вверх)
      if (currentScrollY > lastScrollY.current && currentScrollY > 100) {
        setShowBottomNav(false)
      } else {
        setShowBottomNav(true)
      }
      lastScrollY.current = currentScrollY
    }
    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  const handleSearchSelect = (query: string) => {
    if (!query.trim()) return
    saveSearchHistory(query)
    router.push(`/catalog?search=${encodeURIComponent(query)}`)
    setIsMobileSearchOpen(false) 
  }

  const handleLogoClick = (e: React.MouseEvent) => {
    if (pathname === "/") {
      e.preventDefault()
    }
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  // Общие классы для иконок навигации
  const navIconClass = (isActive: boolean) => cn(
    "flex flex-col items-center justify-center gap-1 w-full h-full rounded-xl transition-all duration-300",
    isActive 
      ? "text-primary scale-105" 
      : "text-muted-foreground hover:text-foreground active:scale-95"
  )

  return (
    <>
      <header 
        className={cn(
          "fixed top-0 left-0 right-0 z-50 w-full border-b transition-all duration-300 bg-background/80 backdrop-blur-xl shadow-sm border-border",
          scrolled ? "shadow-md bg-background/95" : "border-transparent"
        )}
      >
        <div className="container mx-auto px-4 h-16 md:h-20 flex items-center justify-between gap-4">
          
          {/* === 1. ЛОГОТИП (Скрывается на моб при открытом поиске) === */}
          <Link 
            href="/" 
            onClick={handleLogoClick} 
            className={cn(
              "flex items-center gap-3 z-50 transition-all duration-300",
              isMobileSearchOpen ? "hidden md:flex" : "flex"
            )}
          >
             <div className="flex flex-col justify-center">
               <h1 className="text-xl sm:text-2xl font-black tracking-tighter text-foreground leading-none font-unbounded">
                 Weeb.<span className="text-primary">X</span>
               </h1>
             </div>
          </Link>

          {/* === 2. МОБИЛЬНЫЙ ПОИСК (Expanded State) === */}
          <div className={cn(
            "flex-1 md:hidden transition-all duration-300 flex items-center gap-2",
            isMobileSearchOpen ? "opacity-100 scale-100 w-full" : "opacity-0 scale-95 w-0 hidden"
          )}>
            <SearchSuggestions
              value={searchValue}
              onChange={setSearchValue}
              onSelect={handleSearchSelect}
              placeholder="Поиск аниме..."
              className="w-full h-10"
              autoFocus={isMobileSearchOpen}
            />
            <button 
              onClick={() => setIsMobileSearchOpen(false)}
              className="p-2 bg-secondary rounded-full text-muted-foreground"
            >
              <X size={18} />
            </button>
          </div>

          {/* === 3. НАВИГАЦИЯ (DESKTOP ONLY) === */}
          <nav className="hidden lg:flex items-center gap-1 bg-secondary/50 p-1 rounded-full border backdrop-blur-md border-border">
            {/* ... Старый код десктопной навигации без изменений ... */}
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

            {/* Dropdown "Ещё" Desktop */}
            <DropdownMenu open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
              <DropdownMenuTrigger asChild>
                <button className={cn(
                  "px-4 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2",
                  (pathname.includes("genre") || pathname === "/bookmarks" || pathname === "/schedule" || pathname === "/history") 
                    ? "bg-secondary text-foreground shadow-lg" 
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                )}>
                  <Settings size={16} /> Ещё
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center" className="w-56 bg-background/95 backdrop-blur-xl border rounded-2xl p-2 shadow-2xl">
                <DropdownMenuItem asChild>
                  <Link href="/beginners" className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-accent transition text-sm font-medium text-muted-foreground hover:text-foreground"><GraduationCap size={14} /> Для новичков</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/bookmarks" className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-accent transition text-sm font-medium text-muted-foreground hover:text-foreground"><BookMarked size={14} /> Закладки</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/schedule" className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-accent transition text-sm font-medium text-muted-foreground hover:text-foreground"><Calendar size={14} /> Расписание</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/history" className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-accent transition text-sm font-medium text-muted-foreground hover:text-foreground"><History size={14} /> История</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <a href="https://t.me/evangelion_chat" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-accent transition text-sm font-medium text-blue-500 hover:text-blue-600"><MessageCircle size={14} /> Telegram чат</a>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/battle" className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-accent transition text-sm font-medium text-red-500 hover:text-red-600"><Swords size={14} /> PVE Бои</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <div className="px-2 py-1.5 flex items-center justify-between">
                  <span className="text-sm">TV режим</span>
                  <TVModeToggle />
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </nav>

          {/* === 4. ПОИСК (DESKTOP) === */}
          <div className="hidden md:block flex-1 max-w-sm xl:max-w-md">
            <SearchSuggestions
              value={searchValue}
              onChange={setSearchValue}
              onSelect={handleSearchSelect}
              placeholder="Поиск аниме..."
            />
          </div>

          {/* === 5. ПРАВАЯ ЧАСТЬ (Аватар, Уведомления, Тоггл поиска для моб) === */}
          <div className="flex items-center gap-3 md:gap-6"> 
            
            {/* Кнопка поиска для мобильных */}
            {!isMobileSearchOpen && (
              <button 
                className="md:hidden p-2 text-muted-foreground hover:text-primary transition-colors"
                onClick={() => setIsMobileSearchOpen(true)}
              >
                <Search size={22} />
              </button>
            )}

            {/* Бэйджик уведомлений */}
            <EpisodeUpdateBadge 
              updates={updates} 
              onClearUpdate={clearUpdate}
              onClearAll={clearAllUpdates}
            />

            {/* Аватар / Вход */}
            {sessionLoading ? (
              <div className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-secondary/50 animate-pulse" />
            ) : user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-gradient-to-tr from-orange-500 to-purple-600 p-[2px] overflow-hidden focus:outline-none cursor-pointer active:scale-95 transition-transform">
                     <Avatar className="w-full h-full border-2 border-background rounded-full">
                       <AvatarImage src={avatarUrl} className="object-cover" />
                       <AvatarFallback className="bg-secondary text-[10px] md:text-xs">
                         {profile?.username?.slice(0, 2).toUpperCase() || "WX"}
                       </AvatarFallback>
                     </Avatar>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium">{profile?.username || "Пользователь"}</p>
                      <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/gacha" className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-accent transition text-sm font-medium text-purple-500 hover:text-purple-600">
                      <Sparkles size={14} /> Гача
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/battle" className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-accent transition text-sm font-medium text-red-500 hover:text-red-600">
                      <Swords size={14} /> PVE Бои
                    </Link>
                  </DropdownMenuItem>
                  {isDev && (
                    <DropdownMenuItem asChild>
                      <Link href="/admin/card-editor" className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-accent transition text-sm font-medium text-amber-500 hover:text-amber-600">
                        <Wrench size={14} /> Редактор карт
                      </Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <div className="px-2 py-1.5 flex items-center justify-between">
                     <span className="text-sm">Тема</span>
                     <ThemeToggle />
                  </div>
                  <div className="px-2 py-1.5 flex items-center justify-between">
                     <span className="text-sm">TV режим</span>
                     <TVModeToggle />
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild><Link href="/settings">Настройки</Link></DropdownMenuItem>
                  <DropdownMenuItem onClick={signOut} className="text-destructive"><LogOut className="mr-2 h-4 w-4" /> Выйти</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <AuthModal />
            )}
          </div>
        </div>
      </header>
      
      {/* Spacer под хедера */}
      <div className="h-16 md:h-20" aria-hidden="true" />

      {/* 
        === MODERN MOBILE FLOATING DOCK === 
        Скрыт на md+, виден на мобильных. Скрываем при скролле вниз, на странице гачи и на странице боёв.
      */}
      {!pathname.includes("/gacha") && !pathname.includes("/battle") && (
        <div className={cn(
          "fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-[400px] md:hidden transition-all duration-500 ease-in-out",
          showBottomNav ? "translate-y-0 opacity-100" : "translate-y-24 opacity-0"
        )}>
        <div className="bg-background/80 backdrop-blur-xl border border-white/10 dark:border-white/5 rounded-2xl shadow-2xl shadow-black/20 flex items-center justify-between px-2 py-2 h-[68px]">
          
          {/* 1. Главная */}
          <Link href="/" onClick={() => window.scrollTo({ top: 0 })} className={navIconClass(pathname === "/")}>
            <Home size={20} className={pathname === "/" ? "animate-pulse" : ""} />
            <span className="text-[10px] font-medium">Главная</span>
          </Link>
          {/* 2. Расписание */}
          <Link href="/schedule" className={navIconClass(pathname === "/schedule")}>
            <Calendar size={20} className={pathname === "/schedule" ? "animate-pulse" : ""} />
            <span className="text-[10px] font-medium">Расписание</span>
          </Link>

          {/* 3. Каталог как остальные кнопки */}
          <Link href="/catalog" className={navIconClass(pathname === "/catalog")}>
            <Compass size={20} className={pathname === "/catalog" && !pathname.includes("sort=popular") ? "animate-pulse" : ""} />
            <span className="text-[10px] font-medium">
              Каталог
            </span>
          </Link>

          {/* 4. Закладки */}
          <Link href="/bookmarks" className={navIconClass(pathname === "/bookmarks")}>
            <BookMarked size={20} className={pathname === "/bookmarks" ? "animate-pulse" : ""} />
            <span className="text-[10px] font-medium">Моё</span>
          </Link>

          {/* 5. Ещё (Меню) */}
          <DropdownMenu onOpenChange={setIsMobileDropdownOpen}>
            <DropdownMenuTrigger asChild>
              <button className={navIconClass(false)}>
                {/* мигает если открыто */}
                <Settings size={20} className={isMobileDropdownOpen ? "animate-pulse" : ""} />
                <span className="text-[10px] font-medium">Ещё</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="top" className="w-56 mb-4 bg-background/95 backdrop-blur-xl border rounded-2xl p-2 shadow-2xl">
              <DropdownMenuLabel className="px-3 py-2 text-sm font-medium">Разделы</DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-border/50" />
              <DropdownMenuItem asChild>
                <Link href="/history" className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-accent transition text-sm font-medium text-muted-foreground hover:text-foreground"><History size={14} /> История</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/beginners" className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-accent transition text-sm font-medium text-muted-foreground hover:text-foreground"><GraduationCap size={14} /> Новичкам</Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-border/50" />
              <DropdownMenuItem asChild>
                <Link href="/catalog?sort=new&status=ongoing" className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-accent transition text-sm font-medium text-blue-500 hover:text-blue-600"><Tv size={14} /> Онгоинги</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/catalog?sort=popular" className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-accent transition text-sm font-medium text-blue-500 hover:text-blue-600"><Flame size={14} /> Популярное</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/battle" className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-accent transition text-sm font-medium text-red-500 hover:text-red-600"><Swords size={14} /> PVE Бои</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <a href="https://t.me/evangelion_chat" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-accent transition text-sm font-medium text-blue-500 hover:text-blue-600"><MessageCircle size={14} /> Telegram чат</a>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

        </div>
      </div>
      )}
    </>
  )}