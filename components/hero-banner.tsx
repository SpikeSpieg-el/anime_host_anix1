"use client"
import Image from "next/image"
import Link from "next/link"
import { Play, Info, Star, Zap, TrendingUp, Sparkles, ChevronRight, Hash, Eye, Bookmark } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { HeroBannerSkeleton } from "@/components/skeleton"
import { useBookmarks } from "@/components/bookmarks-provider"
import { RecommendationReason } from "@/lib/shikimori/types"
import { cn } from "@/lib/utils"

// Helper function for dynamic episode/series text
const getEpisodeText = (count: number): string => {
  if (count === 1) return "Серия"
  const lastDigit = count % 10
  const lastTwoDigits = count % 100
  
  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) return "Серий"
  if (lastDigit === 1) return "Серия"
  if (lastDigit >= 2 && lastDigit <= 4) return "Серии"
  return "Серий"
}

// Функция для генерации запасного постера
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
  recommendationReason?: RecommendationReason
}

export function HeroBanner({ topOfWeekAnime, recommendedAnime, recommendationReason }: HeroBannerProps) {
  const [mode, setMode] = useState<'top' | 'recommended'>('top')
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [bgImageError, setBgImageError] = useState(false)
  const [posterImageError, setPosterImageError] = useState(false)
  const { isSaved, toggle } = useBookmarks()
  const router = useRouter()

  // 3D tilt effect refs and state
  const posterRef = useRef<HTMLButtonElement>(null)
  const [rotation, setRotation] = useState({ x: 0, y: 0 })
  const [isHovering, setIsHovering] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    // Trigger entrance animation after mount
    const timer = setTimeout(() => setIsLoaded(true), 100)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    // Check if mobile device
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Auto-rotation animation for mobile
  useEffect(() => {
    if (!isMobile || !isLoaded) return

    let animationFrame: number
    const startTime = Date.now()

    const animate = () => {
      const elapsed = Date.now() - startTime
      const slowRotation = Math.sin(elapsed / 2000) * 3 // Slow gentle rotation
      const slowTilt = Math.cos(elapsed / 3000) * 2

      setRotation({ x: slowTilt, y: slowRotation })
      animationFrame = requestAnimationFrame(animate)
    }

    animationFrame = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(animationFrame)
  }, [isMobile, isLoaded])

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

  // Handle 3D tilt effect on mouse move
  const handleMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!posterRef.current) return;
    
    const rect = posterRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    
    // Инвертированные наклоны (уменьшенный коэффициент для меньшего наклона)
    const rotateX = (centerY - y) / 20;
    const rotateY = (x - centerX) / 20;
    
    setRotation({ x: rotateX, y: rotateY });
  };

  const handleMouseEnter = () => setIsHovering(true);
  const handleMouseLeave = () => {
    setIsHovering(false);
    setRotation({ x: 0, y: 0 });
  };

  return (
    <div className="relative w-full min-h-[550px] lg:h-[750px] mb-8 lg:mb-12 overflow-hidden bg-background border-b border-border group animate-fade-in">
      
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
        {/* Градиенты */}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/90 to-background/30 lg:via-background/60 lg:to-transparent dark:from-zinc-950 dark:via-zinc-950/90 dark:to-zinc-950/30 lg:dark:via-zinc-950/60 lg:dark:to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/70 to-transparent dark:from-zinc-950/90 dark:via-zinc-950/70" />
      </div>

      {/* --- КОНТЕЙНЕР КОНТЕНТА --- */}
      <div className="relative h-full container mx-auto px-4 sm:px-6 z-10 flex flex-col justify-center py-6 lg:py-0">
        <div className="flex flex-col lg:flex-row h-full items-center">
          
          {/* --- ПРАВАЯ ЧАСТЬ: ПОСТЕР --- */}
          <div className="order-first lg:order-last lg:absolute lg:right-4 lg:top-1/2 lg:-translate-y-1/2 lg:w-5/12 flex justify-center mb-4 lg:mb-0 perspective-1000 z-20 w-full">
             <button
               ref={posterRef}
               type="button"
               onClick={() => setIsDialogOpen(true)}
               onMouseMove={!isMobile ? handleMouseMove : undefined}
               onMouseEnter={!isMobile ? handleMouseEnter : undefined}
               onMouseLeave={!isMobile ? handleMouseLeave : undefined}
               className="relative w-[160px] aspect-[2/3] sm:w-[240px] lg:w-[340px] group/poster"
               style={{
                 perspective: '1000px',
                 transform: isLoaded
                   ? (isMobile
                      ? `rotateX(${rotation.x}deg) rotateY(${rotation.y}deg) scale3d(1, 1, 1)`
                      : (isHovering 
                         ? `rotateX(${rotation.x}deg) rotateY(${rotation.y}deg) scale3d(1.05, 1.05, 1.05)` 
                         : 'rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)'))
                   : 'rotateX(10deg) rotateY(-10deg) scale3d(0.9, 0.9, 0.9) translateY(30px)',
                 transformStyle: 'preserve-3d',
                 transition: isMobile 
                   ? 'none' 
                   : (isHovering ? 'transform 0.1s ease-out' : 'transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)'),
                 opacity: isLoaded ? 1 : 0,
               }}
               aria-label="Подробнее об аниме"
             >
                {/* Glow effect behind poster */}
                <div
                  className="absolute inset-0 bg-gradient-to-br from-orange-600 to-orange-700 rounded-xl lg:rounded-2xl blur-xl -z-10"
                  style={{
                    transform: 'rotate(6deg) translateX(8px) translateY(8px)',
                    opacity: isLoaded ? (isMobile ? 0.5 : (isHovering ? 0.8 : 0.4)) : 0,
                    transition: isMobile 
                      ? 'opacity 0.6s ease-out 0.2s' 
                      : (isHovering ? 'opacity 0.3s ease-out' : 'opacity 0.6s ease-out 0.2s'),
                  }}
                />

                <div className="relative w-full h-full rounded-xl lg:rounded-2xl overflow-hidden shadow-2xl border border-border bg-secondary dark:border-white/10 dark:bg-zinc-900">
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
                             <span className="text-[8px] lg:text-[10px] text-muted-foreground font-mono uppercase dark:text-zinc-400">ID</span>
                             <span className="text-foreground text-[10px] lg:text-sm font-mono font-bold flex items-center gap-1 dark:text-white">
                               <Hash size={10} className="text-orange-500"/> {anime.id}
                             </span>
                          </div>
                       </div>
                    </div>
                </div>
             </button>
          </div>

          {/* --- ЛЕВАЯ ЧАСТЬ: ИНФОРМАЦИЯ --- */}
          <div 
            className="w-full lg:w-8/12 flex flex-col items-center lg:items-start text-center lg:text-left justify-center relative z-30 pt-2 lg:pt-0"
            style={{
              opacity: isLoaded ? 1 : 0,
              transform: isLoaded ? 'translateY(0)' : 'translateY(20px)',
              transition: 'opacity 0.6s ease-out 0.3s, transform 0.6s ease-out 0.3s',
            }}
          >

            {/* 1. ЗАГОЛОВОК (ДОБАВЛЕН font-unbounded) */}
            <h1
              className={`
                ${getTitleClass(anime.title)}
                font-black font-unbounded text-foreground mb-3 lg:mb-4 dark:text-white
                uppercase tracking-tight
                drop-shadow-[0_5px_15px_rgba(0,0,0,0.8)]
                max-w-full lg:max-w-[90%]
              `}
              style={{ 
                textWrap: "balance",
                opacity: isLoaded ? 1 : 0,
                transform: isLoaded ? 'translateY(0)' : 'translateY(10px)',
                transition: 'opacity 0.6s ease-out 0.4s, transform 0.6s ease-out 0.4s',
              }}
            >
              {anime.title}
            </h1>

            {/* 2. ТАБЫ */}
            <div 
              className="flex items-center gap-1.5 mb-5 lg:mb-6 bg-secondary/60 backdrop-blur-md p-1.5 rounded-xl border border-border shadow-lg justify-center lg:justify-start dark:bg-zinc-900/60 dark:border-white/10"
              style={{
                opacity: isLoaded ? 1 : 0,
                transform: isLoaded ? 'translateY(0)' : 'translateY(10px)',
                transition: 'opacity 0.6s ease-out 0.5s, transform 0.6s ease-out 0.5s',
              }}
            >
              <button
                onClick={() => setMode('top')}
                className={`flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-[10px] sm:text-xs lg:text-sm font-black uppercase tracking-wider transition-all duration-300 ${
                  mode === 'top' 
                    ? 'bg-background text-foreground shadow-md scale-100 dark:bg-white dark:text-black' 
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent scale-95 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-white/5'
                }`}
              >
                <TrendingUp size={14} className={mode === 'top' ? 'text-orange-600' : 'opacity-50'} />
                ТОП
              </button>
              <div className="w-px h-4 bg-border mx-0.5 dark:bg-white/10"></div>
              <button
                onClick={() => setMode('recommended')}
                className={`flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-[10px] sm:text-xs lg:text-sm font-black uppercase tracking-wider transition-all duration-300 ${
                  mode === 'recommended' 
                    ? 'bg-background text-foreground shadow-md scale-100 dark:bg-white dark:text-black' 
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent scale-95 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-white/5'
                }`}
              >
                <Sparkles size={14} className={mode === 'recommended' ? 'text-blue-500' : 'opacity-50'} />
                ДЛЯ ВАС
              </button>
            </div>

            {/* 3. МЕТА-ТЕГИ */}
            <div 
              className="flex flex-wrap items-center justify-center lg:justify-start gap-2 sm:gap-3 mb-4 lg:mb-5 w-full"
              style={{
                opacity: isLoaded ? 1 : 0,
                transform: isLoaded ? 'translateY(0)' : 'translateY(10px)',
                transition: 'opacity 0.6s ease-out 0.6s, transform 0.6s ease-out 0.6s',
              }}
            >
              <div className="flex items-center gap-1 bg-orange-600 text-white px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-md text-xs sm:text-sm font-black shadow-lg shadow-orange-900/40">
                <Star className="w-3.5 h-3.5 fill-white" />
                <span>{anime.rating}</span>
              </div>
              
              <div className="flex items-center gap-2 text-muted-foreground font-mono text-[10px] sm:text-sm uppercase tracking-wider font-bold dark:text-zinc-300">
                <span className="bg-secondary/5 border border-border px-2 py-1 sm:px-3 sm:py-1.5 rounded-md backdrop-blur-sm dark:bg-white/5 dark:border-white/10">
                    {anime.year}
                </span>
                <span className="bg-white/5 border border-white/10 px-2 py-1 sm:px-3 sm:py-1.5 rounded-md backdrop-blur-sm hidden sm:inline-block">
                    {anime.quality}
                </span>
                <span className="flex items-center gap-1 text-primary bg-primary/5 border border-primary/20 px-2 py-1 sm:px-3 sm:py-1.5 rounded-md dark:text-orange-400 dark:bg-orange-500/5 dark:border-orange-500/20">
                  <Zap size={12} fill="currentColor" />
                  {anime.episodesTotal > 0 ? `${anime.episodesTotal} ${getEpisodeText(anime.episodesTotal)}` : 'ONGOING'}
                </span>
              </div>
            </div>

            {/* 3.1 Жанры — ссылки в каталог с фильтром (Топ и Для вас) */}
            {anime.genres && anime.genres.length > 0 && (
              <div 
                className="flex flex-wrap items-center justify-center lg:justify-start gap-2 mb-5 lg:mb-6"
                style={{
                  opacity: isLoaded ? 1 : 0,
                  transform: isLoaded ? 'translateY(0)' : 'translateY(10px)',
                  transition: 'opacity 0.6s ease-out 0.7s, transform 0.6s ease-out 0.7s',
                }}
              >
                {anime.genres.slice(0, 6).map((g: string) => (
                  <Link
                    key={g}
                    href={`/catalog?genre=${encodeURIComponent(g)}`}
                    className="inline-flex items-center px-3 py-1.5 rounded-full bg-muted/50 border border-border hover:border-primary/40 hover:bg-primary/10 text-muted-foreground hover:text-primary text-[10px] sm:text-xs font-medium transition-all duration-200 dark:bg-white/5 dark:hover:bg-white/10 dark:border-white/10 dark:hover:border-orange-500/40"
                  >
                    {g}
                  </Link>
                ))}
              </div>
            )}

            {/* 4. ОСНОВНЫЕ КНОПКИ */}
            <div 
              className="w-full sm:w-auto flex flex-row items-stretch justify-center gap-3"
              style={{
                opacity: isLoaded ? 1 : 0,
                transform: isLoaded ? 'translateY(0)' : 'translateY(10px)',
                transition: 'opacity 0.6s ease-out 0.8s, transform 0.6s ease-out 0.8s',
              }}
            >
              <Link 
                href={`/watch/${anime.id}`} 
                className="flex-1 sm:flex-none flex justify-center items-center gap-2 lg:gap-3 bg-background text-foreground hover:bg-accent px-6 py-3.5 lg:px-8 lg:py-4 rounded-xl lg:rounded-2xl font-black text-xs lg:text-sm uppercase tracking-wider shadow-[0_0_20px_-5px_rgba(0,0,0,0.1)] transition-transform active:scale-95 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
              >
                <Play fill="currentColor" className="w-4 h-4 lg:w-5 lg:h-5 text-orange-600" />
                <span>СМОТРЕТЬ</span>
              </Link>

              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <button className="flex-1 sm:flex-none flex justify-center items-center gap-2 bg-secondary/5 hover:bg-secondary/10 backdrop-blur-md border border-border text-foreground px-6 py-3.5 lg:px-8 lg:py-4 rounded-xl lg:rounded-2xl font-bold text-xs lg:text-sm uppercase tracking-wider transition-transform active:scale-95 dark:bg-white/5 dark:hover:bg-white/10 dark:border-white/10 dark:text-white">
                    <Info className="w-4 h-4 lg:w-5 lg:h-5" />
                    <span>ИНФО</span>
                  </button>
                </DialogTrigger>
                
                {/* --- МОДАЛЬНОЕ ОКНО --- */}
                <DialogContent className="bg-background/95 backdrop-blur-2xl border text-foreground w-[95vw] sm:max-w-4xl p-0 overflow-hidden shadow-2xl rounded-3xl flex flex-col h-full max-h-[85dvh] sm:h-auto sm:max-h-[90vh]">
                  
                  <div className="flex flex-col md:grid md:grid-cols-12 h-full w-full">
                    
                    {/* Картинка */}
                    <div className="shrink-0 h-32 sm:h-52 md:h-full md:col-span-5 relative">
                      <Image 
                        src={posterImage} 
                        fill 
                        className="object-cover" 
                        alt="" 
                        onError={() => setPosterImageError(true)}
                        unoptimized={posterImageError}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent md:bg-gradient-to-r md:from-transparent md:to-background/95 dark:from-zinc-950 dark:via-zinc-950/20 dark:md:to-zinc-950/95" />
                    </div>

                    {/* Текст */}
                    <div className="flex-1 md:col-span-7 flex flex-col min-h-0">
                       
                       <div className="flex-1 overflow-y-auto p-5 sm:p-8 custom-scrollbar">
                          <DialogTitle className="text-xl sm:text-3xl font-black font-unbounded uppercase mb-3 leading-tight text-foreground dark:text-white">
                            {anime.title}
                          </DialogTitle>
                          
                          <div className="flex flex-wrap gap-2 mb-4">
                             {anime.genres?.slice(0, 6).map((g: string) => (
                               <Link
                                 key={g}
                                 href={`/catalog?genre=${encodeURIComponent(g)}`}
                                 className="inline-flex items-center px-2 py-1 rounded-md bg-secondary/5 border border-border hover:border-primary/40 hover:bg-primary/10 text-[10px] sm:text-xs uppercase font-bold text-muted-foreground hover:text-primary transition-all dark:bg-white/5 dark:border-white/10 dark:text-zinc-300 dark:hover:border-orange-500/40"
                               >
                                 {g}
                               </Link>
                             ))}
                          </div>

                          {/* Блок с причиной рекомендации */}
                          {mode === 'recommended' && recommendationReason && (
                            <div className="my-4 p-4 rounded-2xl border border-blue-500/20 bg-blue-500/5 dark:border-blue-400/20 dark:bg-blue-400/5">
                              <div className="flex items-center gap-2 mb-2">
                                <Sparkles className="w-4 h-4 text-blue-500" />
                                <span className="text-xs font-bold text-blue-500 dark:text-blue-400 uppercase tracking-wider">
                                  Почему рекомендовано
                                </span>
                              </div>
                              
                              {recommendationReason.strategy === 'similar' && recommendationReason.sourceAnime && (
                                <p className="text-[11px] sm:text-xs text-muted-foreground dark:text-zinc-300 mb-2">
                                  Похоже на «{recommendationReason.sourceAnime}» из вашей истории
                                </p>
                              )}
                              
                              {recommendationReason.strategy === 'trending' && (
                                <p className="text-[11px] sm:text-xs text-muted-foreground dark:text-zinc-300 mb-2">
                                  Популярное аниме среди пользователей
                                </p>
                              )}
                              
                              <div className="flex flex-wrap gap-1">
                                {recommendationReason.factors.map((factor, index) => (
                                  <span key={index} className="inline-block px-2 py-1 bg-blue-500/10 border border-blue-500/20 rounded-md text-[10px] font-medium text-blue-600 dark:text-blue-400">
                                    {factor}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {anime.description && anime.description.trim() !== "" && anime.description !== "Описание отсутствует..." ? (
                            <p className="text-muted-foreground text-xs sm:text-sm leading-relaxed mb-4 opacity-90 dark:text-zinc-300">
                              {anime.description}
                            </p>
                          ) : (
                            <div className="my-4 p-5 rounded-2xl border border-border bg-secondary/[0.02] flex flex-col items-center text-center dark:border-white/5 dark:bg-white/[0.02]">
                              <Info className="w-6 h-6 text-muted-foreground mb-2 dark:text-zinc-600" />
                              <p className="text-muted-foreground text-[11px] sm:text-xs mb-4 dark:text-zinc-400">
                                У нас пока нет описания для этого аниме, но вы можете прочитать его на популярном ресурсе:
                              </p>
                              <div className="flex flex-wrap items-center justify-center gap-2">
                                <a
                                  href={`https://shikimori.one/animes/${anime.id}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-2 px-5 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all active:scale-95"
                                >
                                  <TrendingUp size={14} className="opacity-90" />
                                  Страница на Shikimori
                                </a>
                                <a
                                  href={`https://shikimori.one/animes?search=${encodeURIComponent(anime.title)}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-2 px-5 py-2 bg-secondary hover:bg-accent text-foreground rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all active:scale-95 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-white"
                                >
                                  Поиск на Shikimori
                                </a>
                              </div>
                            </div>
                          )}
                       </div>

                       {/* ФУТЕР */}
                       <div className="shrink-0 p-4 sm:p-8 sm:pt-4 bg-gradient-to-t from-background to-transparent z-10 dark:from-zinc-950">
                        <div className="flex flex-row gap-3">
                          <button 
                            type="button"
                            onClick={() => { setIsDialogOpen(false); router.push(`/watch/${anime.id}`) }}
                            className="flex-1 flex items-center justify-center gap-2 sm:gap-3 bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 text-white font-black py-3 sm:py-4 rounded-xl uppercase tracking-wider shadow-lg hover:shadow-orange-500/20 transition-all active:scale-95 group/btn"
                          >
                            <Eye className="w-5 h-5 group-hover/btn:scale-110 transition-transform" />
                            <span>Смотреть</span>
                            <ChevronRight size={18} className="opacity-70 group-hover/btn:translate-x-1 transition-transform" />
                          </button>
                          <button
                            type="button"
                            onClick={() => toggle(anime)}
                            className="w-12 h-12 flex items-center justify-center bg-secondary/5 hover:bg-secondary/10 backdrop-blur-md border border-border text-foreground font-bold rounded-xl uppercase tracking-wider transition-all active:scale-95 dark:bg-white/5 dark:hover:bg-white/10 dark:border-white/10 dark:text-white"
                            aria-label={saved ? "Убрать из закладок" : "Добавить в закладки"}
                          >
                            <Bookmark className={cn(saved ? "fill-primary text-primary dark:fill-orange-500 dark:text-orange-500" : "text-foreground dark:text-white", "w-5 h-5")} />
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