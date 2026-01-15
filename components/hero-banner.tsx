"use client"
import Image from "next/image"
import Link from "next/link"
import { Play, Info, Star, Calendar, Film, Tv, Flame, Sparkles, ChevronRight } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { useState } from "react"
import { useRouter } from "next/navigation"

interface HeroBannerProps {
  topOfWeekAnime: any
  recommendedAnime: any
}

export function HeroBanner({ topOfWeekAnime, recommendedAnime }: HeroBannerProps) {
  const [mode, setMode] = useState<'top' | 'recommended'>('top')
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const router = useRouter()
  const anime = mode === 'top' ? topOfWeekAnime : recommendedAnime
  
  if (!anime) return null

  const desktopBackdrop = anime.backdrop || anime.poster

  return (
    <div className="relative w-full h-[500px] sm:h-[600px] md:h-[700px] lg:h-[800px] mb-6 sm:mb-12 overflow-hidden group">
      {/* Фоновое изображение */}
      <div className="absolute inset-0">
        <Image
          src={desktopBackdrop}
          alt={anime.title}
          fill
          priority
          className="object-cover object-top scale-105"
        />
        
        {/* Градиенты */}
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/40 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-zinc-950 via-zinc-950/20 to-transparent" />
        <div className="absolute inset-0 bg-black/20" /> 
      </div>

      {/* Контент */}
      <div className="relative h-full container mx-auto px-4 sm:px-6 flex flex-col justify-end pb-8 sm:pb-12 md:pb-24 z-10">
        <div className="max-w-4xl animate-in fade-in slide-in-from-left-8 duration-700 ease-out">
          
          {/* Мета-данные */}
          <div className="flex flex-wrap items-center gap-3 sm:gap-4 mb-3 sm:mb-4">
            <div className="flex items-center gap-1.5 bg-black/50 backdrop-blur-md px-2 sm:px-3 py-1 rounded-lg border border-white/10 shadow-lg">
              <Star className="w-3 h-3 sm:w-3.5 sm:h-3.5 fill-orange-500 text-orange-500" />
              <span className="text-xs sm:text-sm font-bold text-white">{anime.rating}</span>
            </div>
            <span className="text-zinc-300 text-xs sm:text-sm font-medium tracking-wide shadow-black drop-shadow-md">
              {anime.year} • {anime.quality} • {anime.episodesTotal > 0 ? `${anime.episodesTotal} эп.` : 'Онгоинг'}
            </span>
          </div>

          {/* Заголовок: Адаптивный размер шрифта */}
          <h1 className="text-3xl sm:text-4xl md:text-6xl lg:text-7xl xl:text-8xl font-black text-white mb-4 sm:mb-6 leading-[1.1] sm:leading-[0.9] tracking-tighter drop-shadow-2xl line-clamp-2 sm:line-clamp-3">
            {anime.title}
          </h1>

          {/* Переключатель: Адаптивные отступы и размер текста */}
          <div className="inline-flex p-1 mb-6 sm:mb-8 bg-black/40 backdrop-blur-xl border border-white/10 rounded-xl sm:rounded-2xl overflow-x-auto max-w-full">
            <button
              onClick={() => setMode('top')}
              className={`flex items-center gap-2 px-4 sm:px-6 py-2 sm:py-2.5 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-black tracking-widest uppercase transition-all whitespace-nowrap ${
                mode === 'top'
                  ? 'bg-orange-600 text-white shadow-[0_0_20px_rgba(234,88,12,0.4)]'
                  : 'text-zinc-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Flame size={12} className={`sm:w-3.5 sm:h-3.5 ${mode === 'top' ? 'animate-pulse' : ''}`} />
              В тренде
            </button>
            <button
              onClick={() => setMode('recommended')}
              className={`flex items-center gap-2 px-4 sm:px-6 py-2 sm:py-2.5 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-black tracking-widest uppercase transition-all whitespace-nowrap ${
                mode === 'recommended'
                  ? 'bg-orange-600 text-white shadow-[0_0_20px_rgba(234,88,12,0.4)]'
                  : 'text-zinc-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Sparkles size={12} className="sm:w-3.5 sm:h-3.5" />
              Для вас
            </button>
          </div>

          {/* Кнопки действий */}
          <div className="flex flex-wrap items-center gap-3 sm:gap-4">
            <Link
              href={`/watch/${anime.id}`}
              className="flex items-center gap-2 sm:gap-3 bg-white text-black hover:bg-orange-500 hover:text-white px-5 sm:px-8 py-3 sm:py-4 rounded-xl sm:rounded-2xl font-black text-xs sm:text-base transition-all hover:scale-105 active:scale-95 shadow-xl shadow-white/5 hover:shadow-orange-500/20"
            >
              {/* Исправлены размеры иконок: w-4/w-5 вместо огромных size-20 */}
              <Play fill="currentColor" className="w-4 h-4 sm:w-5 sm:h-5" />
              <span>СМОТРЕТЬ</span>
            </Link>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <button className="flex items-center gap-2 bg-white/5 hover:bg-white/10 backdrop-blur-xl text-white px-5 sm:px-8 py-3 sm:py-4 rounded-xl sm:rounded-2xl font-bold text-xs sm:text-base transition-all border border-white/10 hover:border-white/20">
                  <Info className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span>ДЕТАЛИ</span>
                </button>
              </DialogTrigger>
              
              {/* Адаптивный контент диалога */}
              <DialogContent className="bg-zinc-950/95 backdrop-blur-2xl border-zinc-800 text-white w-[95vw] sm:max-w-3xl max-h-[85vh] p-0 overflow-hidden shadow-2xl rounded-2xl">
                <div className="flex flex-col h-full">
                  {/* Картинка в диалоге */}
                  <div className="relative h-48 sm:h-64 w-full flex-shrink-0">
                      <Image src={desktopBackdrop} fill className="object-cover" alt="" />
                      <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 to-transparent" />
                      <div className="absolute bottom-4 left-4 sm:bottom-6 sm:left-8 pr-4">
                          <DialogTitle className="text-xl sm:text-3xl font-black line-clamp-2">{anime.title}</DialogTitle>
                      </div>
                  </div>
                  
                  {/* Скроллящаяся часть контента */}
                  <div className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-4 sm:space-y-6">
                    <div className="flex flex-wrap gap-4 sm:gap-6 text-sm">
                      <div className="flex items-center gap-2 text-zinc-400">
                        <Film className="h-4 w-4 text-orange-500" />
                        <span className="font-bold">{anime.quality}</span>
                      </div>
                      <div className="flex items-center gap-2 text-zinc-400">
                        <Calendar className="h-4 w-4 text-orange-500" />
                        <span className="font-bold">{anime.year}</span>
                      </div>
                      <div className="flex items-center gap-2 text-zinc-400">
                        <Tv className="h-4 w-4 text-orange-500" />
                        <span className="font-bold">{anime.episodesTotal > 0 ? `${anime.episodesTotal} эп.` : 'Анонс'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Star className="h-4 w-4 fill-orange-500 text-orange-500" />
                        <span className="text-white font-black">{anime.rating} / 10</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {anime.genres?.map((genre: string) => (
                        <span key={genre} className="rounded-xl bg-white/5 px-3 py-1 sm:px-4 sm:py-1.5 text-[10px] sm:text-xs font-bold text-zinc-300 border border-white/5">
                          {genre}
                        </span>
                      ))}
                    </div>

                    <p className="text-zinc-400 leading-relaxed text-sm sm:text-lg font-medium">
                      {anime.description || "Описание отсутствует..."}
                    </p>

                    <div className="pt-2">
                        <button
                          onClick={() => {
                            setIsDialogOpen(false)
                            router.push(`/watch/${anime.id}`)
                          }}
                          className="w-full flex items-center justify-center gap-3 bg-orange-600 hover:bg-orange-500 text-white px-6 py-3 sm:px-8 sm:py-4 rounded-xl sm:rounded-2xl font-black transition-all shadow-lg shadow-orange-900/20 text-sm sm:text-base"
                        >
                          ПЕРЕЙТИ К ПЛЕЕРУ
                          <ChevronRight size={20} />
                        </button>
                    </div>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>
    </div>
  )
}