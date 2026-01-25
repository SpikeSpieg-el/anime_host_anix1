export default function Loading() {
  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        {/* Анимированный логотип */}
        <div className="w-16 h-16 animate-pulse">
          <img src="/icon.svg" alt="Logo" className="w-full h-full" />
        </div>
        
        {/* Спиннер загрузки */}
        <div className="relative w-12 h-12">
          <div className="absolute inset-0 border-4 border-border rounded-full"></div>
          <div className="absolute inset-0 border-4 border-orange-500 rounded-full border-t-transparent animate-spin"></div>
        </div>
        
        {/* Текст загрузки */}
        <p className="text-muted-foreground text-sm animate-pulse">Загрузка каталога...</p>
      </div>
    </div>
  )
}
