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

  // Выбор изображения только на клиенте (избегаем гидратации)
  useEffect(() => {
    const randomIndex = Math.floor(Math.random() * images.length)
    setCurrentImage(images[randomIndex])
  }, [])

  // Обновленный стиль кнопок с групповым ховером для иконок
  const btnClass = "group relative flex items-center justify-center gap-3 bg-zinc-900/80 backdrop-blur-md border border-zinc-800 hover:bg-orange-500 hover:border-orange-500 text-zinc-400 hover:text-black px-6 py-4 rounded-xl text-sm font-bold uppercase tracking-widest transition-all duration-300 w-full md:w-auto active:scale-[0.98] shadow-lg shadow-black/20 hover:shadow-orange-500/20";
  
  // Класс для иконок, чтобы они меняли цвет вместе с текстом
  const iconClass = "w-5 h-5 text-orange-500 transition-colors duration-300 group-hover:text-black";

  return (
    <main className="relative min-h-[100dvh] w-full bg-zinc-950 text-white flex flex-col items-center justify-center p-4 overflow-hidden selection:bg-orange-500/30">
      
      {/* --- ГЛОБАЛЬНЫЕ СТИЛИ И АНИМАЦИИ --- */}
      <style jsx global>{`
        .bg-noise {
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.05'/%3E%3C/svg%3E");
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        .animate-float {
          animation: float 6s ease-in-out infinite;
        }
      `}</style>

      {/* --- СЛОЙ 1: ФОН И ШУМ (Объём) --- */}
      <div className="absolute inset-0 bg-noise pointer-events-none z-[1] opacity-40 mix-blend-overlay"></div>
      
      {/* Гигантская цифра 404 на фоне */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-0 overflow-hidden">
        <span className="text-[35vw] font-black text-transparent bg-clip-text bg-gradient-to-b from-zinc-800/10 to-transparent leading-none select-none tracking-tighter blur-sm scale-150 md:scale-100 transform translate-y-10 md:translate-y-0">
          404
        </span>
      </div>

      {/* Световые пятна (Ambient Light) */}
      <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-orange-600/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-indigo-600/5 blur-[100px] rounded-full pointer-events-none" />

      {/* --- СЛОЙ 2: ОСНОВНОЙ КОНТЕНТ --- */}
      <div className="relative z-10 flex flex-col items-center max-w-4xl w-full">
        
        {/* КАРТОЧКА С ИЛЛЮСТРАЦИЕЙ */}
        <div className="relative w-full max-w-[90%] md:max-w-[480px] aspect-video mb-8 md:mb-10 group perspective-1000">
          
          {/* Задняя подсветка (Glow) */}
          <div className="absolute -inset-1 bg-gradient-to-r from-orange-500 to-purple-600 rounded-[32px] blur opacity-20 group-hover:opacity-40 transition duration-1000 group-hover:duration-200"></div>
          
          {/* Контейнер картинки */}
          <div className="relative h-full w-full bg-zinc-900/90 backdrop-blur-sm border border-white/10 rounded-[30px] overflow-hidden shadow-2xl shadow-black flex items-center justify-center animate-float">
            
            {/* Скелетон загрузки */}
            {!isImageLoaded && (
              <div className="absolute inset-0 bg-zinc-800 animate-pulse flex items-center justify-center">
                <AlertCircle className="w-8 h-8 text-zinc-700" />
              </div>
            )}

            {/* Изображение */}
            {currentImage && (
              <img 
                src={currentImage} 
                alt="404 Anime Illustration" 
                className={`w-full h-full object-cover transition-all duration-700 ease-out ${
                  isImageLoaded ? 'opacity-90 grayscale-[0.2] scale-100' : 'opacity-0 scale-105'
                } group-hover:grayscale-0 group-hover:scale-105 group-hover:opacity-100`}
                onLoad={() => setIsImageLoaded(true)}
              />
            )}
            
            {/* Оверлей (Виньетка) */}
            <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-transparent opacity-90" />
            
            {/* UI Элементы поверх картинки */}
            <div className="absolute top-4 right-5 flex gap-1">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                <div className="w-2 h-2 rounded-full bg-zinc-600"></div>
                <div className="w-2 h-2 rounded-full bg-zinc-600"></div>
            </div>

            <div className="absolute bottom-6 left-6 md:bottom-8 md:left-8 text-left">
                <p className="text-orange-500 font-mono text-[10px] md:text-xs uppercase tracking-[0.3em] mb-1 font-bold">System Failure</p>
                <p className="text-3xl md:text-4xl font-black italic text-white drop-shadow-lg">ERROR 404</p>
            </div>
          </div>
        </div>

        {/* ТЕКСТОВАЯ ЧАСТЬ */}
        <div className="text-center space-y-3 md:space-y-4 px-4 mb-10 md:mb-12">
          <h1 className="text-3xl md:text-5xl lg:text-6xl font-black tracking-tighter uppercase italic text-white drop-shadow-2xl">
            Эпизод <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-orange-600">не найден</span>
          </h1>
          <p className="text-base md:text-lg text-zinc-400 font-medium leading-relaxed max-w-md mx-auto">
            Похоже, эта страница была удалена авторами или перемещена в другой таймлайн.
          </p>
        </div>

        {/* НАВИГАЦИЯ */}
        <div className="w-full flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 md:gap-4 px-6 md:px-0">
          <Link href="/" className={btnClass}>
            <Home className={iconClass} />
            <span>Главная</span>
          </Link>

          <Link href="/catalog" className={btnClass}>
            <Search className={iconClass} />
            <span>Каталог</span>
          </Link>

          <button onClick={() => router.back()} className={btnClass}>
            <ArrowLeft className={iconClass} />
            <span>Назад</span>
          </button>
        </div>
      </div>

      {/* --- СЛОЙ 3: ДЕКОРАТИВНЫЕ ЭЛЕМЕНТЫ (Футер) --- */}
      <div className="absolute bottom-6 left-0 right-0 flex justify-between items-end px-6 md:px-10 opacity-50 pointer-events-none hidden sm:flex">
        <div className="text-zinc-700 font-mono text-[10px] uppercase space-y-1">
            <p>ID: ERR_X72_YZ</p>
            <p>LOC: UNKNOWN_SECTOR</p>
        </div>
        <div className="text-zinc-800 font-mono text-[10px] uppercase text-right">
            <p>DESIGN: SYSTEM_V2</p>
        </div>
      </div>
      
    </main>
  )
}