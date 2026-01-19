"use client"

import { useState, useEffect } from "react"
import { Home, Sparkles, History, Newspaper, TrendingUp, Play, Star, ArrowUp } from "lucide-react"

export function FloatingNav() {
  const [isVisible, setIsVisible] = useState(false)
  const [activeSection, setActiveSection] = useState("")

  const navItems = [
    { id: "hero", label: "Главная", icon: Home },
    { id: "history-bookmarks", label: "История", icon: History },
    { id: "news", label: "Новости", icon: Newspaper },
    { id: "popular", label: "Популярное", icon: TrendingUp },
    { id: "ongoing", label: "Онгоинги", icon: Play },
    { id: "legendary", label: "Легендарное", icon: Star },
  ]

  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY
      // Показываем панель, когда проскролили больше 100px
      setIsVisible(scrollY > 100)

      // Определение активной секции
      const sections = navItems.map(item => document.getElementById(item.id)).filter(Boolean)
      
      let currentSection = ""
      for (const section of sections) {
        if (!section) continue;
        const rect = section.getBoundingClientRect()
        // Секция активна, если она находится в верхней трети экрана
        if (rect.top <= window.innerHeight / 3 && rect.bottom >= 100) {
          currentSection = section.id
        }
      }
      setActiveSection(currentSection)
    }

    window.addEventListener("scroll", handleScroll)
    // Вызываем один раз при маунте, чтобы проверить начальное состояние
    handleScroll()
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id)
    if (element) {
      // Отступ сверху для учета навбара (80px)
      const offset = 80
      const elementPosition = element.getBoundingClientRect().top
      const offsetPosition = elementPosition + window.pageYOffset - offset
  
      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth"
      })
    }
  }

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  return (
    <div 
      className={`fixed z-50 transition-all duration-500 ease-in-out
        ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0 pointer-events-none'}
        
        /* Мобильные стили: горизонтальная панель внизу по центру */
        bottom-4 left-4 right-4 md:left-auto md:right-0 md:bottom-0
        
        /* ПК стили: позиционирование контейнера справа */
        md:fixed md:right-8 md:bottom-8 md:w-auto md:h-auto
        flex flex-row md:flex-col items-end gap-3
      `}
    >
      
      {/* Кнопка НАВЕРХ (Только для ПК здесь, на мобильном она внутри меню) */}
      <button
        onClick={scrollToTop}
        className="hidden md:flex w-12 h-12 rounded-xl bg-zinc-900/90 backdrop-blur-md border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800 shadow-2xl shadow-black/50 items-center justify-center transition-all active:scale-95 mb-2"
        title="Наверх"
      >
        <ArrowUp className="w-5 h-5" />
      </button>

      {/* Основная панель навигации */}
      <nav className="
        w-full md:w-auto
        bg-zinc-900/90 backdrop-blur-md border border-zinc-800 
        rounded-2xl md:rounded-2xl 
        p-1.5 md:p-2 
        shadow-2xl shadow-black/50
        
        /* Мобильный Grid/Flex для скролла если кнопок много */
        flex flex-row md:flex-col items-center justify-between md:justify-start gap-1 md:gap-2
        overflow-x-auto md:overflow-visible
        hide-scrollbar
      ">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = activeSection === item.id
          
          return (
            <button
              key={item.id}
              onClick={() => scrollToSection(item.id)}
              className={`
                relative group flex-shrink-0
                w-10 h-10 sm:w-11 sm:h-11 md:w-12 md:h-12 
                rounded-xl flex items-center justify-center 
                transition-all duration-300
                ${isActive 
                  ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/25 scale-105' 
                  : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
                }
              `}
              aria-label={item.label}
            >
              <Icon className="w-5 h-5 md:w-5 md:h-5" />
              
              {/* Тултип (Только для ПК) */}
              <span className="
                hidden md:block
                absolute right-full mr-4 px-2.5 py-1.5 
                bg-zinc-900 text-white text-xs font-medium rounded-lg 
                border border-zinc-800 shadow-xl
                opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 
                transition-all pointer-events-none whitespace-nowrap z-50
              ">
                {item.label}
                {/* Стрелочка тултипа */}
                <span className="absolute top-1/2 -right-1 -mt-1 border-4 border-transparent border-l-zinc-800" />
              </span>
            </button>
          )
        })}

        {/* Кнопка НАВЕРХ (Для мобильных: внутри панели, справа) */}
        <div className="w-[1px] h-6 bg-zinc-800 mx-1 md:hidden" /> {/* Разделитель */}
        <button
          onClick={scrollToTop}
          className="md:hidden flex-shrink-0 w-10 h-10 rounded-xl bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center active:scale-95 transition-all"
        >
          <ArrowUp className="w-5 h-5" />
        </button>
      </nav>
    </div>
  )
}