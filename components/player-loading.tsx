import { Zap } from "lucide-react"

export function PlayerLoading() {
  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-zinc-950 border border-zinc-800 shadow-2xl flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        {/* Анимированный логотип */}
        <a className="flex items-center gap-3 z-50 group" href="/">
          <div className="relative w-9 h-9 flex items-center justify-center">
            <div className="absolute inset-0 bg-orange-600 rounded-xl rotate-6 opacity-50 blur-[4px] group-hover:opacity-80 transition-opacity"></div>
            <div className="absolute inset-0 bg-red-600 rounded-xl -rotate-6 opacity-50 blur-[4px] group-hover:opacity-80 transition-opacity"></div>
            <div className="relative w-full h-full bg-gradient-to-br from-zinc-800 to-black border border-white/10 rounded-xl flex items-center justify-center shadow-2xl">
              <Zap className="w-5 h-5 text-orange-500 fill-orange-500" />
            </div>
          </div>
          <div className="flex flex-col justify-center">
            <h1 className="text-xl font-black tracking-tighter text-white leading-none">ANI<span className="text-orange-500">X</span></h1>
            <span className="text-[9px] font-bold tracking-[0.2em] text-zinc-500 uppercase leading-none group-hover:text-zinc-300 transition-colors">Stream</span>
          </div>
        </a>
        
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
