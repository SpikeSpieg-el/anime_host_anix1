"use client"

import { useState, useEffect, useRef } from "react"
import { usePathname } from "next/navigation"
import { ArrowUp } from "lucide-react"
import { cn } from "@/lib/utils"

export function ScrollToTop() {
  const [isVisible, setIsVisible] = useState(false)
  const [isScrollingDown, setIsScrollingDown] = useState(false)
  const lastScrollY = useRef(0)
  // В админке плавающего дока навигации нет — позиционируемся по-обычному.
  const pathname = usePathname()
  const isAdminRoute = pathname === "/admin" || pathname.startsWith("/admin/")

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY
      
      // Порог появления (сделаем чуть больше, чтобы не мешать в самом начале)
      setIsVisible(currentScrollY > 300)

      // Определяем направление скролла
      if (currentScrollY > lastScrollY.current) {
        setIsScrollingDown(true) // Скроллим вниз
      } else {
        setIsScrollingDown(false) // Скроллим вверх
      }
      
      lastScrollY.current = currentScrollY
    }

    window.addEventListener("scroll", handleScroll, { passive: true })
    handleScroll()
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  return (
    <button
      onClick={scrollToTop}
      className={cn(
        // Базовые стили и анимация
        "fixed z-50 transition-all duration-500 ease-in-out",
        
        // Логика видимости:
        // На мобилках: показываем только если (isVisible && скроллим вниз)
        // На ПК: показываем всегда, если isVisible
        isVisible 
          ? "translate-y-0 opacity-100 scale-100" 
          : "translate-y-20 opacity-0 scale-90 pointer-events-none",
        
        // Специальное скрытие на мобилках при скролле ВВЕРХ (чтобы не пересекаться с доком).
        // В админке дока нет вообще, поэтому кнопка и при скролле вверх
        // остаётся на месте — иначе она была бы «прикована» к правому
        // нижнему углу и не появлялась там, где её ждут.
        !isScrollingDown && !isAdminRoute && "md:translate-y-0 max-md:translate-y-24 max-md:opacity-0",

        /* Позиционирование */
        // На мобилках кнопка стояла на bottom-4 (16px) — ровно ВНУТРИ
        // плавающего дока навигации (bottom-6, h-[68px] → зона 24…92px).
        // Она рисуется позже Navbar в DOM, поэтому перехватывала тап по
        // правому слоту дока. Поднимаем её над доком через готовый токен
        // --bottom-nav-height. В админке дока нет — возвращаем обычный
        // отступ, иначе кнопка болталась бы на 100px выше края экрана.
        isAdminRoute
          ? "bottom-4 right-4 md:right-8 md:bottom-8"
          : "bottom-[calc(var(--bottom-nav-height)+0.75rem)] right-4 md:right-8 md:bottom-8",

        /* Стилизация (сохраняем вашу старую логику вида) */
        "w-12 h-12 rounded-xl bg-secondary/90 backdrop-blur-md border border-border shadow-2xl flex items-center justify-center active:scale-95",
        "text-muted-foreground hover:text-foreground hover:bg-secondary",
        "dark:bg-zinc-900/90 dark:border-zinc-800 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-zinc-800"
      )}
      title="Наверх"
      aria-label="Вернуться в начало страницы"
    >
      <ArrowUp className="w-5 h-5" />
    </button>
  )
}