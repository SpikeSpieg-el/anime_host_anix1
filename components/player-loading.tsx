export function PlayerLoading() {
  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-zinc-950 border border-zinc-800 shadow-2xl flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        {/* Анимированный логотип */}
        <div className="w-12 h-12 bg-gradient-to-tr from-orange-600 to-red-600 rounded-lg flex items-center justify-center font-black text-white text-lg shadow-lg shadow-orange-900/20 animate-pulse">
          K
        </div>
        
        {/* Спиннер загрузки */}
        <div className="relative w-8 h-8">
          <div className="absolute inset-0 border-3 border-zinc-800 rounded-full"></div>
          <div className="absolute inset-0 border-3 border-orange-500 rounded-full border-t-transparent animate-spin"></div>
        </div>
        
        {/* Текст загрузки */}
        <p className="text-zinc-400 text-xs animate-pulse">Загрузка плеера...</p>
      </div>
    </div>
  )
}
