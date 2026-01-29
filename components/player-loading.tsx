"use client"

export function PlayerLoading() {
  return (
    <div className="absolute inset-0 overflow-hidden rounded-xl bg-background border border-border shadow-2xl flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        {/* Анимированный логотип */}
        <div className="w-12 h-12 animate-pulse">
          <img src="/icon.svg" alt="Logo" className="w-full h-full" />
        </div>
        
        {/* Спиннер загрузки */}
        <div className="relative w-8 h-8">
          <div className="absolute inset-0 border-3 border-muted rounded-full"></div>
          <div className="absolute inset-0 border-3 border-orange-500 rounded-full border-t-transparent animate-spin"></div>
        </div>
        
        {/* Текст загрузки */}
        <p className="text-muted-foreground text-xs animate-pulse">Загрузка плеера...</p>
      </div>
    </div>
  )
}
