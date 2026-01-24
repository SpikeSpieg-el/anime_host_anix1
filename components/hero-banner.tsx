"use client"
import Image from "next/image"
import Link from "next/link"

import { Play, Info, Star, Zap, TrendingUp, Sparkles, ChevronRight, Hash, Eye } from "lucide-react"

import { Play, Info, Star, Zap, TrendingUp, Sparkles, ChevronRight, Hash, Eye, Bookmark } from "lucide-react"
 
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { HeroBannerSkeleton } from "@/components/skeleton"


import { useBookmarks } from "@/components/bookmarks-provider"
import { cn } from "@/lib/utils"
 

// Функция для генерации запасного постера (такая же как в anime-card)
function generateFallbackPoster(title: string): string {
  const hash = title.split('').reduce((acc, char) => char.charCodeAt(0) + ((acc << 5) - acc), 0);
  const index = Math.abs(hash) % 4;
  const letter = title.slice(0, 1).toUpperCase();
  
  const styles = [
    { bg: '#1a0505', textColor: '#fed7aa', accentColor: '#ea580c' },
    { bg: '#020617', textColor: '#bfdbfe', accentColor: '#3b82f6' },
    { bg: '#1e1b4b', textColor: '#e9d5ff', accentColor: '#8b5cf6' },
    { bg: '#18181b', textColor: '#e4e4e7', accentColor: '#22c55e' }
  ];
  
  const style = styles[index];
  const svg = `
    <svg width="400" height="600" viewBox="0 0 400 600" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="${style.bg}"/>
      <text x="50%" y="40%" font-family="sans-serif" font-weight="900" font-size="300" fill="${style.accentColor}" text-anchor="middle" dominant-baseline="middle" opacity="0.1">${letter}</text>
      <text x="50%" y="55%" font-family="sans-serif" font-size="24" fill="${style.textColor}" text-anchor="middle" font-weight="bold">${title}</text>
      <text x="50%" y="580" font-family="sans-serif" font-size="12" fill="${style.textColor}" opacity="0.6" text-anchor="middle">ANIME COLLECTION</text>
    </svg>
  `;
  
  const base64 = Buffer.from(svg).toString('base64');
  return `data:image/svg+xml;base64,${base64}`;
}

interface HeroBannerProps {
  topOfWeekAnime: any
  recommendedAnime: any
}

export function HeroBanner({ topOfWeekAnime, recommendedAnime }: HeroBannerProps) {
  const [mode, setMode] = useState<'top' | 'recommended'>('top')
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [bgImageError, setBgImageError] = useState(false)
  const [posterImageError, setPosterImageError] = useState(false)

  const router = useRouter()
  
  const anime = mode === 'top' ? topOfWeekAnime : recommendedAnime

  const { isSaved, toggle } = useBookmarks()
  const router = useRouter()
  
  const anime = mode === 'top' ? topOfWeekAnime : recommendedAnime
  const saved = !!anime?.id && isSaved(String(anime.id))
 
  
  const hasHighQualityBackdrop = !!anime?.backdrop && !bgImageError;
  const bgImage = bgImageError ? generateFallbackPoster(anime?.title || 'Anime') : (anime?.backdrop || anime?.poster);
  const posterImage = posterImageError ? generateFallbackPoster(anime?.title || 'Anime') : anime?.poster;

  if (!anime) return <HeroBannerSkeleton />

  // Адаптивный размер заголовка
  const getTitleClass = (title: string) => {
    const len = title.length;
    if (len > 80) return "text-lg sm:text-2xl lg:text-3xl leading-snug";
    if (len > 50) return "text-xl sm:text-3xl lg:text-4xl leading-tight";
    if (len > 30) return "text-2xl sm:text-4xl lg:text-5xl leading-tight";
    return "text-3xl sm:text-5xl lg:text-7xl leading-none";
  };

  return (
    <div className="relative w-full min-h-[550px] lg:h-[750px] mb-8 lg:mb-12 overflow-hidden bg-zinc-950 border-b border-zinc-800 group animate-fade-in">
      
      {/* --- ФОН --- */}
      <div className="absolute inset-0 z-[1] pointer-events-none opacity-[0.07]">
        <div className="absolute inset-0 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:20px_20px]" />
      </div>

      <div className="absolute inset-0 z-0">
        <Image
          src={bgImage}
          alt={anime.title}
          fill
          priority
          className={`
            object-cover object-center transition-transform duration-700
            ${hasHighQualityBackdrop ? 'scale-105' : 'scale-110 blur-xl opacity-50'}
          `}
          sizes="100vw"
          onError={() => setBgImageError(true)}
          unoptimized={bgImageError}
        />
        {/* Градиенты для читаемости текста */}
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/90 to-zinc-950/30 lg:via-zinc-950/60 lg:to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-zinc-950/90 via-zinc-950/70 to-transparent" />
      </div>

      {/* --- ДЕКОРАТИВНЫЙ ТЕКСТ НА ФОНЕ --- */}
      {!hasHighQualityBackdrop && (
        <div className="absolute top-0 right-0 left-0 bottom-0 z-0 pointer-events-none select-none opacity-[0.05] lg:opacity-10 mix-blend-overlay overflow-hidden">
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              key={i}
              className="absolute text-[150px] lg:text-[350px] leading-none font-black text-white italic -skew-x-12 tracking-tighter animate-slide"
              style={{
                left: `${(i % 5) * 25}%`,
                top: `${Math.floor(i / 5) * 25}%`,
                transform: `translate(-50%, -50%) skewX(-12deg)`,
                animationDelay: `${i * 0.5}s`,
                animationDuration: `${15 + (i % 3) * 5}s`
              }}
            >
              {mode === 'top' ? 'TOP' : 'REC'}
            </div>
          ))}
        </div>
      )}

      {/* --- КОНТЕЙНЕР КОНТЕНТА --- */}
      <div className="relative h-full container mx-auto px-4 sm:px-6 z-10 flex flex-col justify-center py-6 lg:py-0">
        <div className="flex flex-col lg:flex-row h-full items-center">
          
          {/* --- ПРАВАЯ ЧАСТЬ: ПОСТЕР (На мобильном сверху, но компактнее) --- */}
          <div className="order-first lg:order-last lg:absolute lg:right-4 lg:top-1/2 lg:-translate-y-1/2 lg:w-5/12 flex justify-center mb-4 lg:mb-0 perspective-1000 z-20 w-full">

             <div className="relative w-[160px] aspect-[2/3] sm:w-[240px] lg:w-[340px] group/poster transition-all duration-500">

             <button
               type="button"
               onClick={() => setIsDialogOpen(true)}
               className="relative w-[160px] aspect-[2/3] sm:w-[240px] lg:w-[340px] group/poster transition-all duration-500"
               aria-label="Подробнее об аниме"
             >
 
                {/* Эффект свечения */}
                <div className="absolute inset-0 bg-gradient-to-br from-orange-600 to-orange-700 rounded-xl lg:rounded-2xl transform rotate-6 translate-x-2 translate-y-2 opacity-60 blur-md lg:group-hover/poster:rotate-12 lg:group-hover/poster:translate-x-6 transition-all duration-500" />
                
                <div className="relative w-full h-full rounded-xl lg:rounded-2xl overflow-hidden shadow-2xl border border-white/10 bg-zinc-900">
                    <Image 
                       src={posterImage}
                       alt={anime.title}
                       fill
                       className="object-cover"
                       sizes="(max-width: 768px) 160px, 350px"
                       quality={90}
                       onError={() => setPosterImageError(true)}
                       unoptimized={posterImageError}
                    />
                    <div className="absolute bottom-0 left-0 right-0 p-2 lg:p-4 bg-gradient-to-t from-black/90 via-black/60 to-transparent backdrop-blur-[1px]">
                       <div className="flex justify-between items-end">
                          <div className="flex flex-col">
                             <span className="text-[8px] lg:text-[10px] text-zinc-400 font-mono uppercase">ID</span>
                             <span className="text-white text-[10px] lg:text-sm font-mono font-bold flex items-center gap-1">
                               <Hash size={10} className="text-orange-500"/> {anime.id}
                             </span>
                          </div>
                       </div>
                    </div>
                </div>

             </div>

             </button>
 
          </div>

          {/* --- ЛЕВАЯ ЧАСТЬ: ИНФОРМАЦИЯ --- */}
          <div className="w-full lg:w-8/12 flex flex-col items-center lg:items-start text-center lg:text-left justify-center relative z-30 pt-2 lg:pt-0">
            
            {/* 1. ЗАГОЛОВОК */}
            <h1 
              className={`
                ${getTitleClass(anime.title)}
                font-black text-white mb-3 lg:mb-4
                uppercase tracking-tight
                drop-shadow-[0_5px_15px_rgba(0,0,0,0.8)]
                max-w-full lg:max-w-[90%]
              `}
              style={{ textWrap: "balance" }} 
            >
              {anime.title}
            </h1>

            {/* 2. ТАБЫ (ТОП / ДЛЯ ВАС) - Прямо под заголовком */}
            <div className="flex items-center gap-1.5 mb-5 lg:mb-6 bg-zinc-900/60 backdrop-blur-md p-1.5 rounded-xl border border-white/10 shadow-lg justify-center lg:justify-start">
              <button
                onClick={() => setMode('top')}
                className={`flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-[10px] sm:text-xs lg:text-sm font-black uppercase tracking-wider transition-all duration-300 ${
                  mode === 'top' 
                    ? 'bg-white text-black shadow-md scale-100' 
                    : 'text-zinc-400 hover:text-white hover:bg-white/5 scale-95'
                }`}
              >
                <TrendingUp size={14} className={mode === 'top' ? 'text-orange-600' : 'opacity-50'} />
                ТОП
              </button>
              <div className="w-px h-4 bg-white/10 mx-0.5"></div>
              <button
                onClick={() => setMode('recommended')}
                className={`flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-[10px] sm:text-xs lg:text-sm font-black uppercase tracking-wider transition-all duration-300 ${
                  mode === 'recommended' 
                    ? 'bg-white text-black shadow-md scale-100' 
                    : 'text-zinc-400 hover:text-white hover:bg-white/5 scale-95'
                }`}
              >
                <Sparkles size={14} className={mode === 'recommended' ? 'text-blue-500' : 'opacity-50'} />
                ДЛЯ ВАС
              </button>
            </div>

            {/* 3. МЕТА-ТЕГИ (Рейтинг, год, качество) */}
            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2 sm:gap-3 mb-6 lg:mb-8 w-full">
              <div className="flex items-center gap-1 bg-orange-600 text-white px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-md text-xs sm:text-sm font-black shadow-lg shadow-orange-900/40">
                <Star className="w-3.5 h-3.5 fill-white" />
                <span>{anime.rating}</span>
              </div>
              
              <div className="flex items-center gap-2 text-zinc-300 font-mono text-[10px] sm:text-sm uppercase tracking-wider font-bold">
                <span className="bg-white/5 border border-white/10 px-2 py-1 sm:px-3 sm:py-1.5 rounded-md backdrop-blur-sm">
                    {anime.year}
                </span>
                <span className="bg-white/5 border border-white/10 px-2 py-1 sm:px-3 sm:py-1.5 rounded-md backdrop-blur-sm hidden sm:inline-block">
                    {anime.quality}
                </span>
                <span className="flex items-center gap-1 text-orange-400 bg-orange-500/5 border border-orange-500/20 px-2 py-1 sm:px-3 sm:py-1.5 rounded-md">
                  <Zap size={12} fill="currentColor" />
                  {anime.episodesTotal > 0 ? `${anime.episodesTotal} Серия` : 'ONGOING'}
                </span>
              </div>
            </div>

            {/* 4. ОСНОВНЫЕ КНОПКИ (Смотреть / Инфо) */}
            <div className="w-full sm:w-auto flex flex-row items-stretch justify-center gap-3">
              <Link 
                href={`/watch/${anime.id}`} 
                className="flex-1 sm:flex-none flex justify-center items-center gap-2 lg:gap-3 bg-white text-black hover:bg-zinc-200 px-6 py-3.5 lg:px-8 lg:py-4 rounded-xl lg:rounded-2xl font-black text-xs lg:text-sm uppercase tracking-wider shadow-[0_0_20px_-5px_rgba(255,255,255,0.3)] transition-transform active:scale-95"
              >
                <Play fill="currentColor" className="w-4 h-4 lg:w-5 lg:h-5 text-orange-600" />
                <span>СМОТРЕТЬ</span>
              </Link>

              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <button className="flex-1 sm:flex-none flex justify-center items-center gap-2 bg-white/5 hover:bg-white/10 backdrop-blur-md border border-white/10 text-white px-6 py-3.5 lg:px-8 lg:py-4 rounded-xl lg:rounded-2xl font-bold text-xs lg:text-sm uppercase tracking-wider transition-transform active:scale-95">
                    <Info className="w-4 h-4 lg:w-5 lg:h-5" />
                    <span>ИНФО</span>
                  </button>
                </DialogTrigger>
                
                {/* --- МОДАЛЬНОЕ ОКНО --- */}
                {/* max-h-[90dvh] и h-auto для мобил, чтобы не вылезало за границы браузера */}
                <DialogContent className="bg-zinc-950/95 backdrop-blur-2xl border border-white/10 text-white w-[95vw] sm:max-w-4xl p-0 overflow-hidden shadow-2xl rounded-3xl flex flex-col h-full max-h-[85dvh] sm:h-auto sm:max-h-[90vh]">
                  
                  <div className="flex flex-col md:grid md:grid-cols-12 h-full w-full">
                    
                    {/* Картинка в диалоге */}
                    <div className="shrink-0 h-32 sm:h-52 md:h-full md:col-span-5 relative">
                      <Image 
                        src={posterImage} 
                        fill 
                        className="object-cover" 
                        alt="" 
                        onError={() => setPosterImageError(true)}
                        unoptimized={posterImageError}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/20 to-transparent md:bg-gradient-to-r md:from-transparent md:to-zinc-950/95" />
                    </div>

                    {/* Правая часть с текстом */}
                    <div className="flex-1 md:col-span-7 flex flex-col min-h-0">
                       
                       {/* Скролл контента */}
                       <div className="flex-1 overflow-y-auto p-5 sm:p-8 custom-scrollbar">
                          <DialogTitle className="text-xl sm:text-3xl font-black uppercase mb-3 leading-tight text-white">
                            {anime.title}
                          </DialogTitle>

                          <DialogDescription className="sr-only">
                            Подробная информация об аниме {anime.title}, включая описание, жанры и рейтинг
                          </DialogDescription>

 
                          
                          <div className="flex flex-wrap gap-2 mb-4">
                             {anime.genres?.slice(0, 4).map((g: string) => (
                               <span key={g} className="px-2 py-1 rounded-md bg-white/5 border border-white/10 text-[10px] sm:text-xs uppercase font-bold text-zinc-300">
                                 {g}
                               </span>
                             ))}
                          </div>


                          <p className="text-zinc-300 text-xs sm:text-sm leading-relaxed mb-4 opacity-90">
                            {anime.description || "Описание отсутствует..."}
                          </p>

                          {/* ПРОВЕРКА ОПИСАНИЯ */}
                          {anime.description && anime.description !== "Описание отсутствует..." ? (
                            <p className="text-zinc-300 text-xs sm:text-sm leading-relaxed mb-4 opacity-90">
                              {anime.description}
                            </p>
                          ) : (
                            <div className="my-4 p-5 rounded-2xl border border-white/5 bg-white/[0.02] flex flex-col items-center text-center">
                              <Info className="w-6 h-6 text-zinc-600 mb-2" />
                              <p className="text-zinc-400 text-[11px] sm:text-xs mb-4">
                                У нас пока нет описания для этого аниме, но вы можете прочитать его на популярном ресурсе:
                              </p>
                              <a 
                                href={`https://shikimori.one/animes?search=${encodeURIComponent(anime.title)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 px-5 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all active:scale-95"
                              >
                                <TrendingUp size={14} className="text-orange-500" />
                                Открыть на Shikimori
                              </a>
                            </div>
                          )}
 
                       </div>

                       {/* ФУТЕР ДИАЛОГА (Кнопка Смотреть) */}
                       <div className="shrink-0 p-4 sm:p-8 sm:pt-4 bg-gradient-to-t from-zinc-950 to-transparent z-10">

                         <button 
                           onClick={() => { setIsDialogOpen(false); router.push(`/watch/${anime.id}`) }}
                           className="w-full flex items-center justify-center gap-2 sm:gap-3 bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 text-white font-black py-3 sm:py-4 rounded-xl uppercase tracking-wider shadow-lg hover:shadow-orange-500/20 transition-all active:scale-95 group/btn"
                         >
                           {/* Иконка глаза или плей */}
                           <Eye className="w-5 h-5 group-hover/btn:scale-110 transition-transform" />
                           <span>Смотреть</span>
                           <ChevronRight size={18} className="opacity-70 group-hover/btn:translate-x-1 transition-transform" />
                         </button>
                       </div>


                        <div className="flex flex-row gap-3">
                          <button 
                            type="button"
                            onClick={() => { setIsDialogOpen(false); router.push(`/watch/${anime.id}`) }}
                            className="flex-1 flex items-center justify-center gap-2 sm:gap-3 bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 text-white font-black py-3 sm:py-4 rounded-xl uppercase tracking-wider shadow-lg hover:shadow-orange-500/20 transition-all active:scale-95 group/btn"
                          >
                            {/* Иконка глаза или плей */}
                            <Eye className="w-5 h-5 group-hover/btn:scale-110 transition-transform" />
                            <span>Смотреть</span>
                            <ChevronRight size={18} className="opacity-70 group-hover/btn:translate-x-1 transition-transform" />
                          </button>
                          <button
                            type="button"
                            onClick={() => toggle(anime)}
                            className="w-12 h-12 flex items-center justify-center bg-white/5 hover:bg-white/10 backdrop-blur-md border border-white/10 text-white font-bold rounded-xl uppercase tracking-wider transition-all active:scale-95"
                            aria-label={saved ? "Убрать из закладок" : "Добавить в закладки"}
                          >
                            <Bookmark className={cn(saved ? "fill-orange-500 text-orange-500" : "text-white", "w-5 h-5")} />
                            
                          </button>
                        </div>
                       </div>
 
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}