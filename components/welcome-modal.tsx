"use client"

import React, { useState, useEffect, useRef } from "react"
import { Zap, ChevronRight, PlayCircle, Star } from "lucide-react"
import { AuthModal } from "@/components/auth-modal"

// Вспомогательный компонент для скрытия заголовка (для a11y)
const VisuallyHidden = ({ children }: { children: React.ReactNode }) => (
  <span className="sr-only">{children}</span>
)

// --- CSS Анимации для специфичных эффектов ---
// Мы добавляем их через стиль-тег, чтобы не настраивать tailwind.config.js
const customStyles = `
  @keyframes slow-zoom {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.1); }
  }
  .animate-slow-zoom {
    animation: slow-zoom 20s infinite alternate ease-in-out;
  }
`

// --- Класс Частицы ---
class Particle {
  x: number
  y: number
  size: number
  speedX: number
  speedY: number
  opacity: number
  fadeDirection: number

  constructor(w: number, h: number) {
    this.x = Math.random() * w
    this.y = Math.random() * h
    this.size = Math.random() * 2 + 0.5
    this.speedX = Math.random() * 0.5 - 0.25
    this.speedY = Math.random() * 0.5 - 0.25
    this.opacity = Math.random() * 0.5 + 0.1
    this.fadeDirection = Math.random() > 0.5 ? 0.005 : -0.005
  }

  update(w: number, h: number) {
    this.x += this.speedX
    this.y += this.speedY

    // Мерцание
    this.opacity += this.fadeDirection
    if (this.opacity > 0.8 || this.opacity < 0.1) {
      this.fadeDirection = -this.fadeDirection
    }

    // Границы
    if (this.x < 0 || this.x > w || this.y < 0 || this.y > h) {
      this.x = Math.random() * w
      this.y = Math.random() * h
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = `rgba(249, 115, 22, ${this.opacity})` // Orange-500
    ctx.beginPath()
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2)
    ctx.fill()
  }
}

export function WelcomeModal() {
  const [isOpen, setIsOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // --- Эффект монтирования и проверки LocalStorage ---
  useEffect(() => {
    setMounted(true)
    const hasVisited = localStorage.getItem("Weeb.X-visited-v2")

    if (!hasVisited) {
      // Небольшая задержка для плавности появления
      const timer = setTimeout(() => setIsOpen(true), 600)
      return () => clearTimeout(timer)
    }
  }, [])

  // --- Логика частиц (Canvas) ---
  useEffect(() => {
    if (!isOpen || !canvasRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    let animationFrameId: number
    const particles: Particle[] = []
    const particleCount = 40

    const resize = () => {
      if (canvas.parentElement) {
        canvas.width = canvas.parentElement.clientWidth
        canvas.height = canvas.parentElement.clientHeight
      }
    }

    resize()
    window.addEventListener("resize", resize)

    for (let i = 0; i < particleCount; i++) {
      particles.push(new Particle(canvas.width, canvas.height))
    }

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      particles.forEach((p) => {
        p.update(canvas.width, canvas.height)
        p.draw(ctx)
      })
      animationFrameId = requestAnimationFrame(animate)
    }

    animate()

    return () => {
      window.removeEventListener("resize", resize)
      cancelAnimationFrame(animationFrameId)
    }
  }, [isOpen])

  const handleStart = () => {
    setIsOpen(false)
    localStorage.setItem("Weeb.X-visited-v2", "true")
  }

  const handleSignUp = () => {
    setIsOpen(false)
    localStorage.setItem("Weeb.X-visited-v2", "true")
    setShowAuthModal(true)
  }

  // Предотвращаем рендер на сервере (Next.js) до проверки состояния
  if (!mounted) return null

  return (
    <>
      <style>{customStyles}</style>
      
      {/* Оверлей / Backdrop */}
      <div 
        className={`fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-sm transition-all duration-300 ${
          isOpen ? "opacity-100 visible" : "opacity-0 invisible pointer-events-none"
        }`}
      >
        {/* Сама карточка модалки */}
        <div 
          className={`relative w-full h-[95vh] sm:h-[90vh] md:h-[85vh] lg:h-[80vh] max-w-[95vw] sm:max-w-[420px] md:max-w-[450px] lg:max-w-[480px] bg-zinc-950 rounded-[1.5rem] sm:rounded-[2rem] overflow-hidden shadow-2xl border border-white/5 transition-all duration-500 ease-out transform ${
            isOpen ? "scale-100 opacity-100" : "scale-95 opacity-0"
          }`}
        >
          <VisuallyHidden>
            <h2>Добро пожаловать в Weeb.X STREAM</h2>
          </VisuallyHidden>

          {/* --- ВИЗУАЛЬНАЯ ЧАСТЬ (ФОН) --- */}
          <div className="absolute inset-0 z-0">
            {/* Фоновая картинка (замените url на свой) */}
            <div 
              className="absolute inset-0 bg-cover bg-center animate-slow-zoom opacity-80"
              style={{ backgroundImage: "url('../anix2.png')" }}
            />

            {/* Canvas с частицами */}
            <canvas 
              ref={canvasRef} 
              className="absolute inset-0 z-5 pointer-events-none opacity-60 mix-blend-screen" 
            />

            {/* Градиенты для читаемости текста */}
            <div className="absolute inset-0 bg-gradient-to-b from-zinc-950/70 via-transparent to-zinc-950 z-10 pointer-events-none" />
            <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/90 to-transparent z-10 pointer-events-none" />
          </div>

          {/* --- КОНТЕНТ --- */}
          <div className="relative z-20 flex flex-col justify-between h-full p-4 sm:p-6 md:p-8">
            
            {/* Логотип */}
            <div className="flex justify-center pt-2 sm:pt-4">
              <div className="relative group cursor-default">
                {/* Свечение */}
                <div className="absolute -inset-1 bg-gradient-to-r from-orange-600 to-purple-600 rounded-xl blur opacity-20 group-hover:opacity-40 transition duration-1000" />
                
                {/* Иконка */}
                <div className="relative w-10 h-10 sm:w-12 sm:h-12 bg-zinc-950/50 backdrop-blur-md border border-white/10 rounded-xl flex items-center justify-center shadow-lg">
                  <Zap className="w-5 h-5 sm:w-6 sm:h-6 text-orange-500 fill-orange-500/20" />
                </div>
              </div>
            </div>

            {/* Текст и кнопки */}
            <div className="flex flex-col items-center text-center space-y-6 sm:space-y-8 pb-2 sm:pb-4">
              
              {/* Заголовки */}
              <div className="space-y-2 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100">
                <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tighter leading-none drop-shadow-2xl font-unbounded">
                  Weeb.<span className="text-transparent bg-clip-text bg-gradient-to-br from-orange-400 to-orange-600">X</span>
                </h2>
                <p className="text-zinc-400 text-[10px] sm:text-xs font-bold uppercase tracking-[0.2em] sm:tracking-[0.3em]">
                  Premium Anime Stream
                </p>
              </div>

              {/* Преимущества (Список) */}
              <div className="w-full space-y-2.5 sm:space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200">
                {/* Карточка 1 */}
                <div className="flex items-center gap-3 sm:gap-4 bg-white/5 border border-white/5 p-3 sm:p-3.5 rounded-2xl backdrop-blur-sm hover:bg-white/10 transition-colors cursor-default group">
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-orange-500/10 flex items-center justify-center shrink-0 border border-orange-500/20">
                    <PlayCircle className="w-4 h-4 sm:w-5 sm:h-5 text-orange-500" />
                  </div>
                  <div className="text-left">
                    <div className="text-white text-xs sm:text-sm font-bold group-hover:text-orange-200 transition-colors">Без рекламы</div>
                    <div className="text-zinc-500 text-[10px] sm:text-xs">Ничто не отвлечет от просмотра</div>
                  </div>
                </div>
                
                {/* Карточка 2 */}
                <div className="flex items-center gap-3 sm:gap-4 bg-white/5 border border-white/5 p-3 sm:p-3.5 rounded-2xl backdrop-blur-sm hover:bg-white/10 transition-colors cursor-default group">
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0 border border-blue-500/20">
                    <Star className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400" />
                  </div>
                  <div className="text-left">
                    <div className="text-white text-xs sm:text-sm font-bold group-hover:text-blue-200 transition-colors">Лучший подбор</div>
                    <div className="text-zinc-500 text-[10px] sm:text-xs">Только топовые тайтлы сезона</div>
                  </div>
                </div>
              </div>

              {/* Кнопка действия */}
              <div className="w-full pt-1 sm:pt-2 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300">
                <button
                  onClick={handleStart}
                  className="w-full h-12 sm:h-14 bg-white text-zinc-950 hover:bg-zinc-200 hover:scale-[1.02] active:scale-[0.98] text-xs sm:text-sm font-bold rounded-2xl shadow-xl shadow-white/10 transition-all duration-300 flex items-center justify-center gap-2 group outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 focus:ring-offset-zinc-950"
                >
                  Смотреть бесплатно
                  <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>

              {/* Кнопка регистрации */}
              <div className="w-full animate-in fade-in slide-in-from-bottom-4 duration-700 delay-400">
                <button
                  onClick={handleSignUp}
                  className="w-full h-10 sm:h-12 bg-transparent text-white hover:bg-white/5 hover:border-white/20 border border-white/10 text-xs sm:text-sm font-medium rounded-2xl transition-all duration-300 flex items-center justify-center gap-2 group outline-none focus:ring-2 focus:ring-white/20 focus:ring-offset-2 focus:ring-offset-zinc-950"
                >
                  Войти / Зарегистрироваться
                  <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>

            </div>
          </div>
        </div>
      </div>
      
      {/* Auth Modal */}
      {showAuthModal && (
        <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
      )}
    </>
  )
}