// app/loading.tsx
import { AnimatedLogo } from "@/components/layout/animated-logo"

export default function Loading() {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-zinc-950/95 backdrop-blur-md px-2 xs:px-4">
      <div className="flex flex-col items-center justify-center gap-3 xs:gap-4 sm:gap-6 max-w-full w-full">
        {/* Анимированный ASCII логотип */}
        <div className="w-full flex justify-center items-center overflow-hidden">
          <AnimatedLogo />
        </div>
        
        <div className="flex flex-col items-center gap-3">
          {/* Спиннер загрузки */}
          <div className="relative w-8 h-8 xs:w-10 xs:h-10 sm:w-12 sm:h-12">
            <div className="absolute inset-0 border-4 border-zinc-800 rounded-full" />
            <div className="absolute inset-0 border-4 border-orange-500 rounded-full border-t-transparent animate-spin" />
          </div>
          
          {/* Текст загрузки */}
          <p className="text-zinc-400 text-[10px] xs:text-xs sm:text-sm animate-pulse">
            Загрузка...
          </p>
        </div>
      </div>
    </div>
  )
}