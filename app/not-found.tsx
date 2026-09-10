'use client'

import Link from "next/link"
import { useRouter } from "next/navigation"
import { Home, Search, ArrowLeft, AlertCircle } from "lucide-react"
import { useState, useEffect } from "react"

export default function NotFound() {
  const router = useRouter()

  // Массив изображений
  const images = ["/4_04.png", "/404_2.png", "/404_3.png"]
  const [currentImage, setCurrentImage] = useState<string | null>(null)
  const [isImageLoaded, setIsImageLoaded] = useState(false)

  // Выбор случайной иллюстрации без рассинхрона гидратации
  useEffect(() => {
    const randomIndex = Math.floor(Math.random() * images.length)
    setCurrentImage(images[randomIndex])
  }, [])

  return (
    <main className="relative min-h-[100dvh] w-full bg-[#08070d] text-zinc-100 flex flex-col items-center justify-center p-4 sm:p-6 overflow-hidden selection:bg-orange-500/30">

      {/* --- АНИМАЦИИ И ЭФФЕКТЫ --- */}
      <style jsx global>{`
        @keyframes floatCard {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-8px) rotate(0.3deg); }
        }
        @keyframes pulseGlow {
          0%, 100% { opacity: 0.45; transform: scale(1); }
          50% { opacity: 0.75; transform: scale(1.08); }
        }
        .animate-float-card {
          animation: floatCard 7s ease-in-out infinite;
        }
        .animate-pulse-glow {
          animation: pulseGlow 6s ease-in-out infinite;
        }
      `}</style>

      {/* --- ФОНОВЫЕ СВЕТОВЫЕ СФЕРЫ (ГЛУБИНА) --- */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Центральное оранжево-пурпурное свечение за карточкой */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[340px] sm:w-[620px] h-[340px] sm:h-[620px] rounded-full animate-pulse-glow"
          style={{
            background: 'radial-gradient(circle, rgba(249,115,22,0.18) 0%, rgba(139,92,246,0.12) 40%, transparent 70%)',
            filter: 'blur(80px)',
          }}
        />

        {/* Верхняя холодная вспышка */}
        <div
          className="absolute -top-32 -left-20 w-[450px] h-[450px] rounded-full opacity-40 pointer-events-none"
          style={{
            background: 'radial-gradient(circle, rgba(99,102,241,0.25) 0%, transparent 65%)',
            filter: 'blur(90px)',
          }}
        />

        {/* Нижний теплый акцент */}
        <div
          className="absolute -bottom-24 -right-20 w-[420px] h-[420px] rounded-full opacity-35 pointer-events-none"
          style={{
            background: 'radial-gradient(circle, rgba(234,88,12,0.25) 0%, transparent 65%)',
            filter: 'blur(90px)',
          }}
        />

        {/* Матовая гигантская подложка 404 */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
          <span className="text-[34vw] md:text-[26vw] font-black text-white/[0.02] tracking-tighter leading-none select-none scale-110 md:scale-100">
            404
          </span>
        </div>
      </div>

      {/* --- ОСНОВНОЙ ЦЕНТРАЛЬНЫЙ КОНТЕНТ --- */}
      <div className="relative z-10 flex flex-col items-center w-full max-w-2xl text-center">

        {/* ЦЕНТРАЛЬНАЯ КАРТОЧКА С ИЛЛЮСТРАЦИЕЙ */}
        <div className="relative w-full max-w-[460px] aspect-video mb-8 group animate-float-card">

          {/* Динамическое свечение по контуру карточки */}
          <div className="absolute -inset-1.5 rounded-[26px] bg-gradient-to-r from-orange-500/30 via-purple-500/20 to-orange-500/30 blur-xl opacity-60 group-hover:opacity-100 transition-opacity duration-700" />

          {/* Каркас карточки с эффектом матового стекла */}
          <div className="relative w-full h-full rounded-[22px] overflow-hidden bg-zinc-900/70 border border-white/10 backdrop-blur-xl shadow-2xl shadow-black/80 flex items-center justify-center">

            {/* Скелетон при загрузке */}
            {!isImageLoaded && (
              <div className="absolute inset-0 bg-zinc-900/90 flex flex-col items-center justify-center gap-2 animate-pulse">
                <AlertCircle className="w-8 h-8 text-orange-500/70" />
              </div>
            )}

            {/* Само изображение */}
            {currentImage && (
              <img
                src={currentImage}
                alt="404 Anime Illustration"
                className={`w-full h-full object-cover transition-all duration-700 ease-out ${
                  isImageLoaded
                    ? 'opacity-95 scale-100'
                    : 'opacity-0 scale-105'
                } group-hover:scale-105 group-hover:opacity-100`}
                onLoad={() => setIsImageLoaded(true)}
              />
            )}

            {/* Эстетичный мягкий градиент-затемнение снизу */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent pointer-events-none" />

            {/* Верхний статус: "Ошибочка системы" */}
            <div className="absolute top-4 left-5 flex items-center gap-2 pointer-events-none">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
              </span>
              <p className="text-orange-400/90 font-mono text-[11px] uppercase tracking-[0.25em] font-semibold">
                Ошибочка системы
              </p>
            </div>

            {/* Индикаторы справа сверху */}
            <div className="absolute top-4 right-5 flex items-center gap-1.5 opacity-60">
              <div className="w-1.5 h-1.5 rounded-full bg-white/40"></div>
              <div className="w-1.5 h-1.5 rounded-full bg-white/40"></div>
              <div className="w-1.5 h-1.5 rounded-full bg-orange-500"></div>
            </div>

            {/* Нижний заголовок внутри карточки: "ERROR 404" */}
            <div className="absolute bottom-4 left-5 pointer-events-none text-left">
              <p className="text-2xl sm:text-3xl font-black italic tracking-wider text-white drop-shadow-md">
                ERROR 404
              </p>
            </div>
          </div>
        </div>

        {/* ТЕКСТОВАЯ ЧАСТЬ */}
        <div className="space-y-3 px-4 mb-9 max-w-lg">
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight uppercase italic text-white">
            Серия <span className="bg-gradient-to-r from-orange-400 via-amber-400 to-orange-500 bg-clip-text text-transparent">не найдена</span>
          </h1>
          <p className="text-sm sm:text-base text-zinc-400 font-normal leading-relaxed">
            Похоже, эта страница была удалена авторами или перемещена в другой таймлайн.
          </p>
        </div>

        {/* КНОПКИ ДЕЙСТВИЙ */}
        <div className="w-full flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-3.5 px-6 sm:px-0">

          {/* Главная (акцентная) */}
          <Link
            href="/"
            className="group relative flex items-center justify-center gap-2.5 w-full sm:w-auto px-7 py-3.5 rounded-xl bg-orange-500 hover:bg-orange-400 text-black font-bold text-xs uppercase tracking-widest transition-all duration-300 shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]"
          >
            <Home className="w-4 h-4 transition-transform duration-300 group-hover:scale-110" />
            <span>Главная</span>
          </Link>

          {/* Каталог */}
          <Link
            href="/catalog"
            className="group relative flex items-center justify-center gap-2.5 w-full sm:w-auto px-7 py-3.5 rounded-xl bg-zinc-900/80 hover:bg-zinc-800/90 border border-white/10 hover:border-orange-500/40 text-zinc-200 hover:text-white font-bold text-xs uppercase tracking-widest backdrop-blur-md transition-all duration-300 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] shadow-md shadow-black/40"
          >
            <Search className="w-4 h-4 text-orange-400 transition-transform duration-300 group-hover:scale-110" />
            <span>Каталог</span>
          </Link>

          {/* Назад */}
          <button
            onClick={() => router.back()}
            className="group relative flex items-center justify-center gap-2.5 w-full sm:w-auto px-7 py-3.5 rounded-xl bg-zinc-900/80 hover:bg-zinc-800/90 border border-white/10 hover:border-orange-500/40 text-zinc-200 hover:text-white font-bold text-xs uppercase tracking-widest backdrop-blur-md transition-all duration-300 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] shadow-md shadow-black/40"
          >
            <ArrowLeft className="w-4 h-4 text-orange-400 transition-transform duration-300 group-hover:-translate-x-1" />
            <span>Назад</span>
          </button>
        </div>

      </div>

      {/* ДЕКОРАТИВНЫЙ ФУТЕР */}
      <div className="absolute bottom-6 left-0 right-0 flex justify-between items-center px-8 text-[11px] font-mono uppercase tracking-wider text-zinc-600 pointer-events-none hidden sm:flex">
        <span>ID: ERR_X72_YZ</span>
        <span>DESIGN: SYSTEM_V2</span>
      </div>

    </main>
  )
}
