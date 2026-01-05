export default function Loading() {
  return (
    <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        {/* Анимированный логотип */}
        <div className="w-16 h-16 bg-gradient-to-tr from-orange-600 to-red-600 rounded-lg flex items-center justify-center font-black text-white text-2xl shadow-lg shadow-orange-900/20 animate-pulse">
          K
        </div>
        
        {/* Спиннер загрузки */}
        <div className="relative w-12 h-12">
          <div className="absolute inset-0 border-4 border-zinc-800 rounded-full"></div>
          <div className="absolute inset-0 border-4 border-orange-500 rounded-full border-t-transparent animate-spin"></div>
        </div>
        
        {/* Текст загрузки */}
        <p className="text-zinc-400 text-sm animate-pulse">Загрузка каталога...</p>
      </div>
    </div>
  )
}
