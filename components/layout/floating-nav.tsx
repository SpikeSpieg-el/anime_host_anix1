"use client"

import { useState, useEffect, useRef } from "react"
import { 
  Home as HomeIcon, 
  History as HistoryIcon, 
  Newspaper as NewsIcon, 
  TrendingUp as TrendingIcon, 
  Play as PlayIcon, 
  Star as StarIcon, 
  ArrowUp as ArrowUpIcon, 
  PlayCircle as PlayCircleIcon, 
  Camera as CameraIcon, 
  Users as UsersIcon 
} from "lucide-react"
import { cn } from "@/lib/utils"

export interface NavItem {
  id: string
  label: string
  icon: any
}

export interface FloatingNavConfig {
  navItems: NavItem[]
  scrollThreshold?: number
  showScrollUpButton?: boolean
}

const defaultConfig: FloatingNavConfig = {
  navItems: [
    { id: "hero", label: "Главная", icon: HomeIcon },
    { id: "history-bookmarks", label: "История", icon: HistoryIcon },
    { id: "news", label: "Новости", icon: NewsIcon },
    { id: "popular", label: "Популярное", icon: TrendingIcon },
    { id: "ongoing", label: "Онгоинги", icon: PlayIcon },
    { id: "legendary", label: "Легендарное", icon: StarIcon },
  ],
  scrollThreshold: 100,
  showScrollUpButton: true,
}

const watchPageConfig: FloatingNavConfig = {
  navItems: [
    { id: "player", label: "Плеер", icon: PlayCircleIcon },
    { id: "frames", label: "Кадры", icon: CameraIcon },
    { id: "characters", label: "Персонажи", icon: UsersIcon },
    { id: "order", label: "Порядок просмотра", icon: PlayIcon },
  ],
  scrollThreshold: 100,
  showScrollUpButton: true,
}

interface FloatingNavProps {
  config?: FloatingNavConfig
  variant?: 'default' | 'watch-page'
}

export function FloatingNav({ config, variant = 'default' }: FloatingNavProps) {
  const finalConfig = config || (variant === 'watch-page' ? watchPageConfig : defaultConfig)
  const { navItems, scrollThreshold = 100, showScrollUpButton = true } = finalConfig
  
  const [isVisible, setIsVisible] = useState(false)
  const [activeSection, setActiveSection] = useState("")
  const [isScrollingDown, setIsScrollingDown] = useState(false)
  const lastScrollY = useRef(0)

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY
      setIsVisible(currentScrollY > scrollThreshold)
      setIsScrollingDown(currentScrollY > lastScrollY.current)
      lastScrollY.current = currentScrollY

      const sections = navItems.map(item => document.getElementById(item.id)).filter(Boolean)
      let currentSection = ""
      for (const section of sections) {
        if (!section) continue;
        const rect = section.getBoundingClientRect()
        if (rect.top <= window.innerHeight / 3 && rect.bottom >= 100) {
          currentSection = section.id
        }
      }
      setActiveSection(currentSection)
    }

    window.addEventListener("scroll", handleScroll, { passive: true })
    handleScroll()
    return () => window.removeEventListener("scroll", handleScroll)
  }, [navItems, scrollThreshold])

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id)
    if (element) {
      const offset = 100
      const elementPosition = element.getBoundingClientRect().top
      const offsetPosition = elementPosition + window.pageYOffset - offset
      window.scrollTo({ top: offsetPosition, behavior: "smooth" })
    }
  }

  return (
    <div 
      className={cn(
        "fixed z-40 transition-all duration-500 ease-in-out flex flex-row md:flex-col items-end gap-3",
        
        // --- ПОЛОЖЕНИЕ ---
        // Мобильные: по центру внизу
        "left-1/2 -translate-x-1/2 bottom-6", 
        // Десктоп: справа внизу, сброс центрирования
        "md:left-auto md:right-8 md:translate-x-0 md:bottom-8",
        
        // --- ЛОГИКА ВИДИМОСТИ ---
        isVisible 
          ? "translate-y-0 opacity-100" 
          : "translate-y-32 opacity-0 pointer-events-none",
        
        // На мобилках скрываем, когда скроллим ВВЕРХ (чтобы выплыл основной Navbar Dock)
        !isScrollingDown && "max-md:translate-y-32 max-md:opacity-0"
      )}
    >
      
      {/* Кнопка НАВЕРХ (Для десктопа вынесена отдельно выше панели) */}
      {showScrollUpButton && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="hidden md:flex w-12 h-12 rounded-[18px] bg-background/80 backdrop-blur-2xl border border-white/10 dark:border-white/5 shadow-2xl items-center justify-center text-muted-foreground hover:text-primary transition-all active:scale-90"
        >
          <ArrowUpIcon size={20} />
        </button>
      )}

      {/* Основная панель (Стиль идентичен везде) */}
      <nav className="flex flex-row md:flex-col items-center gap-1.5 p-1.5 bg-background/80 backdrop-blur-2xl border border-white/10 dark:border-white/5 rounded-[22px] shadow-2xl">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = activeSection === item.id
          
          return (
            <button
              key={item.id}
              onClick={() => scrollToSection(item.id)}
              className={cn(
                "relative group flex items-center justify-center w-11 h-11 md:w-12 md:h-12 rounded-[18px] transition-all duration-300",
                isActive 
                  ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20 scale-105" 
                  : "text-muted-foreground hover:bg-white/10 hover:text-foreground active:scale-90"
              )}
              aria-label={item.label}
            >
              <Icon size={isActive ? 22 : 20} strokeWidth={isActive ? 2.5 : 2} />
              
              {/* Tooltip (Только Desktop) */}
              <span className="hidden md:block absolute right-full mr-4 px-3 py-1.5 rounded-xl bg-popover/90 backdrop-blur-md border border-border text-xs font-semibold text-popover-foreground opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all pointer-events-none whitespace-nowrap shadow-xl">
                {item.label}
              </span>
            </button>
          )
        })}

        {/* Разделитель и кнопка НАВЕРХ (Внутри панели только на мобилках) */}
        {showScrollUpButton && (
          <>
            <div className="w-[1px] h-6 bg-border/50 mx-1 md:hidden" />
            <button
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              className="md:hidden flex items-center justify-center w-11 h-11 rounded-[18px] bg-primary/10 text-primary active:scale-90 transition-all"
            >
              <ArrowUpIcon size={20} />
            </button>
          </>
        )}
      </nav>
    </div>
  )
}