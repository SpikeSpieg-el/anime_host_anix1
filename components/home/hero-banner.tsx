"use client"
import Image from "next/image"
import Link from "next/link"
import { Play, Info, Star, Zap, TrendingUp, Sparkles, ChevronRight, Hash, Eye, Bookmark, Loader2, RefreshCw, Disc } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog"
import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { HeroBannerSkeleton } from "@/components/shared/skeleton"
import { useBookmarks } from "@/components/providers/bookmarks-provider"
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
  isRecommendationLoading?: boolean
  onRefreshRecommendation?: () => Promise<void>
}

export function HeroBanner({ topOfWeekAnime, recommendedAnime, recommendationReason, isRecommendationLoading, onRefreshRecommendation }: HeroBannerProps) {
  const [mode, setMode] = useState<'top' | 'recommended'>('top')
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Плавное переключение режимов
  const switchMode = (newMode: 'top' | 'recommended') => {
    if (newMode === mode || isTransitioning) return
    setIsTransitioning(true)
    setTimeout(() => {
      setMode(newMode)
      requestAnimationFrame(() => {
        setIsTransitioning(false)
      })
    }, 180)
  }

  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [bgImageError, setBgImageError] = useState(false)
  const [posterImageError, setPosterImageError] = useState(false)
  const [fullDescription, setFullDescription] = useState<string | null>(null)
  const [loadingDescription, setLoadingDescription] = useState(false)
  const { isSaved, toggle } = useBookmarks()
  const router = useRouter()

  const anime = mode === 'top' ? topOfWeekAnime : recommendedAnime
  const saved = !!anime?.id && isSaved(String(anime.id))

  // Сброс ошибок картинок при смене аниме
  useEffect(() => {
    setBgImageError(false)
    setPosterImageError(false)
  }, [anime?.id])

  // Загрузка полного описания в модалке
  useEffect(() => {
    if (isDialogOpen && anime?.id) {
      const loadDescription = async () => {
        if (!anime.description || anime.description === "Описание отсутствует...") {
          setLoadingDescription(true)
          try {
            const response = await fetch(`/api/anime/${anime.id}`)
            if (response.ok) {
              const data = await response.json()
              if (data.description && data.description !== "Описание отсутствует...") {
                setFullDescription(data.description)
              }
            }
          } catch (error) {
            console.error('[HeroBanner] Failed to load description:', error)
          } finally {
            setLoadingDescription(false)
          }
        }
      }
      loadDescription()
    }
  }, [isDialogOpen, anime?.id, anime?.description])

  // 3D tilt effect refs and state
  const containerRef = useRef<HTMLDivElement>(null)
  const [rotation, setRotation] = useState({ x: 0, y: 0 })
  const [isHovering, setIsHovering] = useState(false)
  const [dvdOpen, setDvdOpen] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setIsLoaded(true), 100)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Плавное покачивание на мобильных
  useEffect(() => {
    if (!isMobile || !isLoaded) return

    let animationFrame: number
    const startTime = Date.now()

    const animate = () => {
      const elapsed = Date.now() - startTime
      const slowRotation = Math.sin(elapsed / 2200) * 2.5
      const slowTilt = Math.cos(elapsed / 3000) * 2

      setRotation({ x: slowTilt, y: slowRotation })
      animationFrame = requestAnimationFrame(animate)
    }

    animationFrame = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(animationFrame)
  }, [isMobile, isLoaded])

  useEffect(() => {
    if (mode === 'recommended' && !isRecommendationLoading && !recommendedAnime && topOfWeekAnime) {
      setMode('top')
    }
  }, [mode, isRecommendationLoading, recommendedAnime, topOfWeekAnime])

  const posterImage = posterImageError ? generateFallbackPoster(anime?.title || 'Anime') : anime?.poster;

  if (!anime) {
    if (!topOfWeekAnime && !recommendedAnime) {
      return <HeroBannerSkeleton />
    }
    if (mode === 'recommended' && !recommendedAnime) {
      if (isRecommendationLoading) {
        return (
          <div className="relative w-full min-h-[440px] lg:h-[600px] mb-8 lg:mb-12 overflow-hidden bg-background border-b border-border flex items-center justify-center">
            <div className="text-center p-8">
              <div className="relative w-16 h-16 mx-auto mb-6">
                <div className="absolute inset-0 rounded-full border-2 border-blue-500/20 animate-ping" />
                <div className="absolute inset-0 rounded-full border-2 border-blue-500/40" />
                <div className="flex items-center justify-center w-full h-full">
                  <Sparkles className="w-7 h-7 text-blue-500 animate-pulse" />
                </div>
              </div>
              <h3 className="text-lg font-bold text-foreground mb-2">Подбираем для вас...</h3>
              <p className="text-muted-foreground text-sm max-w-xs">
                Анализируем вашу историю и ищем идеальное аниме
              </p>
            </div>
          </div>
        )
      }
      return (
        <div className="relative w-full min-h-[440px] lg:h-[600px] mb-8 lg:mb-12 overflow-hidden bg-background border-b border-border flex items-center justify-center">
          <div className="text-center p-8">
            <Sparkles className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
            <h3 className="text-xl font-bold text-foreground mb-2">Нет рекомендаций</h3>
            <p className="text-muted-foreground text-sm max-w-md mb-4">
              Чтобы получить персональные рекомендации, посмотрите несколько аниме или добавьте их в закладки
            </p>
            <button
              onClick={() => setMode('top')}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
            >
              Показать топ аниме
            </button>
          </div>
        </div>
      )
    }
    return <HeroBannerSkeleton />
  }

  // Адаптивный размер шрифта заголовка
  const getTitleClass = (title: string) => {
    const len = title.length;
    if (len > 80) return "text-lg sm:text-2xl lg:text-3xl leading-snug";
    if (len > 50) return "text-xl sm:text-3xl lg:text-4xl leading-tight";
    if (len > 30) return "text-2xl sm:text-4xl lg:text-5xl leading-tight";
    return "text-3xl sm:text-5xl lg:text-6xl xl:text-7xl leading-none";
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    
    const rotateX = (centerY - y) / 18;
    const rotateY = (x - centerX) / 18;
    
    setRotation({ x: rotateX, y: rotateY });
  };

  const handleMouseEnter = () => {
    setIsHovering(true);
    setDvdOpen(true);
  };
  const handleMouseLeave = () => {
    setIsHovering(false);
    setDvdOpen(false);
    setRotation({ x: 0, y: 0 });
  };

  const transitionContentStyle = {
    opacity: isTransitioning ? 0 : 1,
    transform: isTransitioning ? 'translateY(10px) scale(0.98)' : 'translateY(0) scale(1)',
    filter: isTransitioning ? 'blur(8px)' : 'blur(0px)',
    transition: 'opacity 0.22s cubic-bezier(0.16, 1, 0.3, 1), transform 0.22s cubic-bezier(0.16, 1, 0.3, 1), filter 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
  };

  return (
    <div className="relative w-full min-h-[600px] sm:min-h-[660px] lg:h-[750px] mb-8 lg:mb-12 overflow-hidden bg-[#09090b] border-b border-border/60 group animate-fade-in">
      
      {/* ======================================================== */}
      {/* 1. РЕАЛЬНЫЙ ЦВЕТ ОБЛОЖКИ + ДИАГОНАЛЬНЫЙ ГРАДИЕНТ ПО СТРЕЛКЕ */}
      {/* ======================================================== */}

      {/* А. Живое световое поле цвета постера (визуально подсвечивает левую половину) */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none select-none">
        <div className="absolute -left-[15%] -bottom-[20%] w-[85%] sm:w-[70%] h-[95%] opacity-70 dark:opacity-65 blur-[85px] saturate-[2.2] scale-110">
          <Image
            src={posterImage}
            alt=""
            fill
            className="object-cover object-bottom"
            unoptimized={posterImageError || posterImage.startsWith('data:image')}
          />
        </div>
      </div>

      {/* Б. Направленный диагональный градиент (из левого нижнего угла вправо-вверх) */}
      <div 
        className="absolute inset-0 z-[1] pointer-events-none"
        style={{
          background: 'linear-gradient(125deg, rgba(249, 115, 22, 0.35) 0%, rgba(249, 115, 22, 0.15) 30%, transparent 60%)'
        }}
      />
      {/* Мягкий переход в темноту справа для контраста диска и читаемости текста */}
      <div 
        className="absolute inset-0 z-[1] pointer-events-none"
        style={{
          background: 'linear-gradient(125deg, rgba(9, 9, 11, 0.35) 0%, rgba(9, 9, 11, 0.65) 45%, rgba(9, 9, 11, 0.92) 75%, #09090b 100%)'
        }}
      />
      <div className="absolute inset-0 z-[1] bg-gradient-to-t from-[#09090b] via-transparent to-[#09090b]/40 pointer-events-none" />

      {/* ======================================================== */}
      {/* 2. ЧЕТКИЙ И ЛЕГКИЙ ПАТТЕРН ДЛЯ ГЛУБИНЫ (ХОРОШО ВИДЕН)   */}
      {/* ======================================================== */}
      <div 
        className="absolute inset-0 z-[2] pointer-events-none opacity-45 dark:opacity-40"
        style={{
          backgroundImage: `
            radial-gradient(circle at 1px 1px, rgba(255, 255, 255, 0.5) 1.5px, transparent 0),
            linear-gradient(to right, rgba(255, 255, 255, 0.08) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255, 255, 255, 0.08) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px, 40px 40px, 40px 40px',
          maskImage: 'linear-gradient(125deg, black 40%, rgba(0,0,0,0.5) 75%, transparent 100%)',
          WebkitMaskImage: 'linear-gradient(125deg, black 40%, rgba(0,0,0,0.5) 75%, transparent 100%)',
        }}
      />

      {/* ======================================================== */}
      {/* 3. КОНТЕНТ БАННЕРА                                      */}
      {/* ======================================================== */}
      <div className="relative h-full container mx-auto px-4 sm:px-6 z-10 flex flex-col justify-center py-6 sm:py-8 lg:py-0">
        <div className="flex flex-col lg:flex-row h-full items-center justify-between gap-4 lg:gap-8">
          
          {/* --- ПРАВАЯ ЧАСТЬ: ВЕРТИКАЛЬНЫЙ 3D COLLECTOR'S CASE --- */}
          <div 
            ref={containerRef}
            className="order-first lg:order-last lg:absolute lg:right-6 xl:right-14 lg:top-1/2 lg:-translate-y-1/2 lg:w-5/12 flex justify-center mb-4 lg:mb-0 z-20 w-full select-none"
            style={{ perspective: '2000px' }}
            onMouseMove={!isMobile ? handleMouseMove : undefined}
            onMouseEnter={!isMobile ? handleMouseEnter : undefined}
            onMouseLeave={!isMobile ? handleMouseLeave : undefined}
            onClick={() => {
              if (isMobile) setDvdOpen(!dvdOpen);
            }}
          >
            <div
              className="relative w-[150px] sm:w-[220px] lg:w-[290px] xl:w-[320px] aspect-[2/3] group/box cursor-pointer"
              style={{
                perspective: '2000px',
                transformStyle: 'preserve-3d',
                opacity: isLoaded ? 1 : 0,
                transform: isLoaded
                  ? `rotateX(${rotation.x}deg) rotateY(${rotation.y}deg)` 
                  : 'rotateX(8deg) rotateY(-14deg) translateY(20px)',
                transition: isMobile 
                  ? 'none' 
                  : (isHovering ? 'transform 0.08s ease-out' : 'transform 0.65s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.6s ease-out 0.2s'),
              }}
            >
              {/* Свечение за кейсом */}
              <div
                className="absolute -inset-4 bg-gradient-to-tr from-orange-600/40 via-amber-500/25 to-blue-600/30 rounded-3xl blur-2xl -z-30 pointer-events-none"
                style={{
                  transform: 'translateZ(-40px)',
                  opacity: dvdOpen ? 0.85 : 0.3,
                  transition: 'opacity 0.6s ease',
                }}
              />

              {/* Тень под кейсом */}
              <div
                className="absolute -bottom-6 left-4 right-4 h-8 bg-black/80 blur-xl rounded-full -z-20 pointer-events-none"
                style={{
                  transform: 'translateZ(-45px) rotateX(90deg)',
                }}
              />

              {/* 1. ЗАДНЯЯ ЧАСТЬ КЕЙСА (Back Tray) — глубина -18px */}
              <div
                className="absolute inset-0 rounded-2xl overflow-hidden shadow-2xl border border-white/15 bg-zinc-950"
                style={{
                  transform: 'translateZ(-18px)',
                  transformStyle: 'preserve-3d',
                }}
              >
                <div className="absolute inset-0 opacity-30">
                  <Image
                    src={anime.backdrop || posterImage}
                    alt=""
                    fill
                    className="object-cover blur-[2px] scale-105"
                    unoptimized={posterImageError || posterImage.startsWith('data:image')}
                  />
                  <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/85 to-black" />
                </div>

                <div className="absolute inset-2 sm:inset-3 rounded-xl border border-white/10 bg-zinc-900/60 backdrop-blur-md flex flex-col justify-between p-2.5 sm:p-4">
                  <div className="flex justify-between items-center text-[7px] sm:text-[9px] font-mono text-zinc-400 border-b border-white/10 pb-1.5 sm:pb-2">
                    <span className="text-orange-500 font-bold flex items-center gap-1">
                      <Disc size={12} className="animate-spin" style={{ animationDuration: '6s' }} /> SPECIAL DISC
                    </span>
                    <span className="opacity-60 hidden sm:inline">HI-RES AUDIO</span>
                  </div>

                  <div className="relative w-full aspect-square rounded-full border border-white/10 bg-black/60 shadow-[inset_0_4px_16px_rgba(0,0,0,0.9)] flex items-center justify-center my-auto">
                    <div className="absolute inset-2 sm:inset-3 rounded-full border border-dashed border-white/5" />
                    <div className="w-7 h-7 sm:w-10 sm:h-10 rounded-full bg-zinc-800 border-2 border-zinc-600 shadow-inner flex items-center justify-center">
                      <div className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 rounded-full bg-black border border-white/30" />
                    </div>
                  </div>

                  <div className="pt-1.5 sm:pt-2 border-t border-white/10 flex justify-between items-center text-[7px] sm:text-[8px] font-mono text-zinc-500">
                    <span className="truncate max-w-[100px] sm:max-w-[130px]">{anime.title}</span>
                    <span>#{anime.id}</span>
                  </div>
                </div>
              </div>

              {/* 2. КОРЕШОК КЕЙСА (Spine) */}
              <div
                className="absolute left-0 top-0 bottom-0 w-[12px] sm:w-[16px] bg-gradient-to-r from-zinc-950 via-zinc-900 to-zinc-800 border-y border-l border-white/15 rounded-l-md flex flex-col items-center justify-between py-3 sm:py-4"
                style={{
                  transformOrigin: 'left center',
                  transform: 'rotateY(-90deg) translateZ(0px)',
                }}
              >
                <div className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                <span className="[writing-mode:vertical-lr] rotate-180 text-[6px] sm:text-[8px] font-mono uppercase tracking-widest text-zinc-400 font-bold">
                  COLLECTOR EDITION
                </span>
                <span className="text-[6px] sm:text-[7px] font-mono text-zinc-500">CD</span>
              </div>

              {/* 3. КОМПАКТ-ДИСК (CD / Blu-Ray) — в закрытом виде на глубине -10px */}
              <div
                className="absolute top-1/2 -translate-y-1/2 left-2 aspect-square rounded-full flex items-center justify-center pointer-events-none"
                style={{
                  width: '92%',
                  transformStyle: 'preserve-3d',
                  transform: dvdOpen 
                    ? `translateX(${isMobile ? '30%' : '48%'}) rotateZ(210deg) translateZ(2px)` 
                    : 'translateX(0%) rotateZ(0deg) translateZ(-10px)',
                  opacity: dvdOpen ? 1 : 0,
                  transition: 'transform 0.85s cubic-bezier(0.34, 1.45, 0.64, 1), opacity 0.35s ease',
                  boxShadow: dvdOpen ? '0 20px 45px -5px rgba(0, 0, 0, 0.85), 0 0 0 1px rgba(255, 255, 255, 0.2)' : 'none'
                }}
              >
                <div 
                  className="absolute inset-0 rounded-full overflow-hidden"
                  style={{
                    background: 'radial-gradient(circle at center, transparent 0%, transparent 22%, #0f172a 22.5%, #1e293b 25%, #334155 45%, #1e293b 70%, #090d16 100%)',
                  }}
                >
                  <div 
                    className="absolute inset-0 opacity-70 mix-blend-screen transition-transform duration-700"
                    style={{
                      background: 'conic-gradient(from 40deg, transparent 0deg, rgba(239, 68, 68, 0.5) 45deg, rgba(245, 158, 11, 0.55) 90deg, rgba(16, 185, 129, 0.5) 140deg, rgba(6, 182, 212, 0.6) 190deg, rgba(139, 92, 246, 0.55) 250deg, rgba(236, 72, 153, 0.5) 310deg, transparent 360deg)',
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-tr from-white/20 via-transparent to-white/10 opacity-75" />
                  <div className="absolute inset-[24%] rounded-full border border-black/30 shadow-[inset_0_0_0_2px_rgba(255,255,255,0.08),inset_0_0_0_6px_rgba(0,0,0,0.15),inset_0_0_0_12px_rgba(255,255,255,0.04)] pointer-events-none" />
                </div>

                <div className="relative w-[44%] h-[44%] rounded-full overflow-hidden border-2 border-white/40 shadow-lg flex items-center justify-center bg-zinc-950">
                  <Image
                    src={posterImage}
                    alt=""
                    fill
                    className="object-cover scale-110 opacity-90"
                    sizes="140px"
                    unoptimized={posterImageError || posterImage.startsWith('data:image')}
                  />
                  <div className="absolute inset-0 bg-black/40" />
                  <div className="relative z-10 text-center px-1 pointer-events-none" style={transitionContentStyle}>
                    <p className="text-[6px] sm:text-[8px] font-black text-white uppercase tracking-wider truncate max-w-[80px] drop-shadow">
                      {anime.title}
                    </p>
                    <span className="text-[5px] sm:text-[6px] text-orange-400 font-mono font-bold tracking-widest block">
                      COLLECTOR CD
                    </span>
                  </div>
                </div>

                <div className="absolute w-[20%] h-[20%] rounded-full bg-white/20 backdrop-blur-md border border-white/50 flex items-center justify-center shadow-inner">
                  <div className="w-[44%] h-[44%] rounded-full bg-zinc-950 border border-zinc-700 shadow-[inset_0_2px_4px_rgba(0,0,0,0.9)]" />
                </div>
              </div>

              {/* 4. ПЕРЕДНЯЯ РАСПАХИВАЮЩАЯСЯ КРЫШКА (Front Cover) */}
              <div
                onClick={() => setIsDialogOpen(true)}
                className="absolute inset-0 w-full h-full rounded-2xl shadow-2xl cursor-pointer"
                style={{
                  transformOrigin: 'left center',
                  transformStyle: 'preserve-3d',
                  transform: dvdOpen 
                    ? `rotateY(${isMobile ? '-48deg' : '-58deg'}) translateZ(4px)` 
                    : 'rotateY(0deg) translateZ(4px)',
                  transition: 'transform 0.65s cubic-bezier(0.34, 1.45, 0.64, 1)',
                }}
                aria-label="Подробнее об аниме"
              >
                {/* Лицевая сторона */}
                <div 
                  className="absolute inset-0 w-full h-full rounded-2xl overflow-hidden border-2 border-white/20 bg-zinc-950 shadow-2xl"
                  style={{ backfaceVisibility: 'hidden' }}
                >
                  <div className="relative w-full h-full" style={transitionContentStyle}>
                    <Image
                      src={posterImage}
                      alt={anime.title}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 150px, 320px"
                      onError={() => setPosterImageError(true)}
                      unoptimized={posterImageError || posterImage.startsWith('data:image')}
                    />

                    {/* Градиент на нижнюю половину обложки */}
                    <div className="absolute inset-x-0 bottom-0 h-[58%] bg-gradient-to-t from-zinc-950 via-zinc-950/70 to-transparent pointer-events-none" />

                    {/* Стеклянные блики */}
                    <div 
                      className="absolute inset-0 pointer-events-none opacity-40 group-hover/box:opacity-70 transition-opacity duration-300"
                      style={{
                        background: 'linear-gradient(120deg, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0) 30%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.5) 70%)',
                      }}
                    />

                    {/* Бейдж */}
                    <div className="absolute top-2 left-2 sm:top-2.5 sm:left-2.5 z-10 flex items-center gap-1 sm:gap-1.5 bg-black/70 backdrop-blur-md px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md sm:rounded-lg border border-white/20 shadow-md">
                      <Disc className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-orange-500 animate-spin" style={{ animationDuration: '7s' }} />
                      <span className="text-[7px] sm:text-[9px] font-black text-white uppercase tracking-wider">
                        CD EDITION
                      </span>
                    </div>

                    {/* Нижняя плашка */}
                    <div className="absolute bottom-0 inset-x-0 p-2.5 sm:p-4">
                      <div className="flex justify-between items-end">
                        <div className="flex flex-col max-w-[70%]">
                          <span className="text-[7px] sm:text-[9px] text-zinc-400 font-mono uppercase tracking-widest font-semibold flex items-center gap-1">
                            <Hash size={10} className="text-orange-500" /> ID {anime.id}
                          </span>
                          <span className="text-[10px] sm:text-xs font-black text-white uppercase tracking-tight truncate drop-shadow-md">
                            {anime.title}
                          </span>
                        </div>
                        <div className="text-[7px] sm:text-[8px] font-mono text-orange-400 bg-orange-500/10 border border-orange-500/20 px-1.5 py-0.5 rounded">
                          DISC 1
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Внутренняя сторона */}
                <div
                  className="absolute inset-0 w-full h-full rounded-2xl overflow-hidden border-2 border-white/20 bg-gradient-to-br from-zinc-900 via-zinc-950 to-black p-3 flex flex-col justify-between"
                  style={{
                    transform: 'rotateY(180deg)',
                    backfaceVisibility: 'hidden',
                  }}
                >
                  <div className="relative w-full h-3/5 rounded-lg overflow-hidden border border-white/10 opacity-70">
                    <Image
                      src={anime.backdrop || posterImage}
                      alt=""
                      fill
                      className="object-cover"
                      unoptimized={posterImageError || posterImage.startsWith('data:image')}
                    />
                    <div className="absolute inset-0 bg-black/40" />
                    <div className="absolute inset-1.5 border border-white/20 rounded flex items-center justify-center text-center p-1">
                      <p className="text-[7px] sm:text-[9px] font-mono font-bold text-white uppercase">
                        ARTBOOK & LYRICS
                      </p>
                    </div>
                  </div>

                  <div className="border-t border-white/10 pt-1.5 text-center">
                    <p className="text-[6px] sm:text-[8px] font-mono text-zinc-400 uppercase tracking-widest">
                      SPECIAL EDITION
                    </p>
                    <div className="mt-0.5 inline-flex items-center gap-1 text-[7px] sm:text-[8px] font-bold text-orange-400">
                      <Info size={9} /> Кликните для деталей
                    </div>
                  </div>
                </div>
              </div>

              {/* Значок Sparkles */}
              <div
                className="absolute top-2 right-2 w-7 h-7 sm:w-9 sm:h-9 bg-gradient-to-br from-orange-600 to-amber-600 rounded-full flex items-center justify-center shadow-xl border-2 border-orange-400/40 pointer-events-none"
                style={{
                  transform: dvdOpen ? 'scale(1) rotate(360deg) translateZ(30px)' : 'scale(0) translateZ(0px)',
                  opacity: dvdOpen ? 1 : 0,
                  transition: 'all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.1s',
                }}
              >
                <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
              </div>
            </div>
          </div>

          {/* --- ЛЕВАЯ ЧАСТЬ: ИНФОРМАЦИЯ --- */}
          <div 
            className="w-full lg:w-7/12 flex flex-col items-center lg:items-start text-center lg:text-left justify-center relative z-30 pt-1 lg:pt-0"
            style={{
              opacity: isLoaded ? 1 : 0,
              transform: isLoaded ? 'translateY(0)' : 'translateY(20px)',
              transition: 'opacity 0.6s ease-out 0.3s, transform 0.6s ease-out 0.3s',
            }}
          >

            {/* 1. ТАБЫ */}
            <div className="flex items-center gap-1 sm:gap-1.5 mb-3 sm:mb-4 lg:mb-5 bg-zinc-900/80 backdrop-blur-md p-1 sm:p-1.5 rounded-xl border border-white/10 shadow-lg justify-center lg:justify-start">
              <button
                onClick={() => switchMode('top')}
                className={`flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-[10px] sm:text-xs lg:text-sm font-black uppercase tracking-wider transition-all duration-300 ${
                  mode === 'top' 
                    ? 'bg-white text-black shadow-md scale-100' 
                    : 'text-zinc-400 hover:text-white hover:bg-white/5 scale-95'
                }`}
              >
                <TrendingUp size={13} className={mode === 'top' ? 'text-orange-600' : 'opacity-50'} />
                ТОП
              </button>
              <div className="w-px h-4 bg-white/10 mx-0.5"></div>
              <button
                onClick={() => switchMode('recommended')}
                className={`flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-[10px] sm:text-xs lg:text-sm font-black uppercase tracking-wider transition-all duration-300 ${
                  mode === 'recommended'
                    ? 'bg-white text-black shadow-md scale-100' 
                    : 'text-zinc-400 hover:text-white hover:bg-white/5 scale-95'
                }`}
              >
                {isRecommendationLoading && mode !== 'recommended' ? (
                  <Loader2 size={13} className="animate-spin opacity-50" />
                ) : (
                  <Sparkles size={13} className={mode === 'recommended' ? 'text-blue-500' : 'opacity-50'} />
                )}
                ДЛЯ ВАС
              </button>
              {mode === 'recommended' && onRefreshRecommendation && (
                <>
                  <div className="w-px h-4 bg-white/10 mx-0.5"></div>
                  <button
                    onClick={async () => {
                      setIsRefreshing(true)
                      await onRefreshRecommendation().catch(() => {})
                      setIsRefreshing(false)
                    }}
                    disabled={isRefreshing}
                    title="Другая рекомендация"
                    className="flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition-all duration-200 disabled:opacity-40"
                  >
                    <RefreshCw size={12} className={isRefreshing ? 'animate-spin' : ''} />
                  </button>
                </>
              )}
            </div>

            {/* БЛОК СМЕНЯЕМОГО КОНТЕНТА */}
            <div className="w-full flex flex-col items-center lg:items-start" style={transitionContentStyle}>
              
              {/* 2. ЗАГОЛОВОК */}
              <h2
                className={`
                  ${getTitleClass(anime.title)}
                  font-black font-unbounded text-white mb-2.5 sm:mb-3 lg:mb-4
                  uppercase tracking-tight
                  drop-shadow-[0_4px_16px_rgba(0,0,0,0.85)]
                  max-w-full lg:max-w-[95%]
                `}
                style={{ textWrap: "balance" }}
              >
                {anime.title}
              </h2>

              {/* 3. МЕТА-ТЕГИ */}
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-1.5 sm:gap-2.5 mb-3 sm:mb-4 lg:mb-5 w-full">
                <div className="flex items-center gap-1 bg-orange-600 text-white px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-md text-xs sm:text-sm font-black shadow-lg shadow-orange-950/50">
                  <Star className="w-3.5 h-3.5 fill-white" />
                  <span>{anime.rating}</span>
                </div>
                
                <div className="flex items-center gap-1.5 sm:gap-2 text-zinc-300 font-mono text-[10px] sm:text-xs lg:text-sm uppercase tracking-wider font-bold">
                  <span className="bg-white/5 border border-white/10 px-2 py-1 sm:px-3 sm:py-1.5 rounded-md backdrop-blur-sm">
                      {anime.year}
                  </span>
                  <span className="bg-white/5 border border-white/10 px-2 py-1 sm:px-3 sm:py-1.5 rounded-md backdrop-blur-sm hidden sm:inline-block">
                      {anime.quality || "HD"}
                  </span>
                  <span className="flex items-center gap-1 text-orange-400 bg-orange-500/10 border border-orange-500/25 px-2 py-1 sm:px-3 sm:py-1.5 rounded-md">
                    <Zap size={12} fill="currentColor" />
                    {anime.episodesTotal > 0 ? `${anime.episodesTotal} ${getEpisodeText(anime.episodesTotal)}` : 'ONGOING'}
                  </span>
                </div>
              </div>

              {/* 3.1 ЖАНРЫ */}
              {anime.genres && anime.genres.length > 0 && (
                <div className="flex flex-wrap items-center justify-center lg:justify-start gap-1.5 sm:gap-2 mb-4 sm:mb-5 lg:mb-6">
                  {anime.genres.slice(0, 5).map((g: string) => (
                    <Link
                      key={g}
                      href={`/catalog?genre=${encodeURIComponent(g)}`}
                      className="inline-flex items-center px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 hover:border-orange-500/40 text-zinc-300 hover:text-orange-400 text-[10px] sm:text-xs font-medium transition-all duration-200 backdrop-blur-sm"
                    >
                      {g}
                    </Link>
                  ))}
                </div>
              )}

              {/* 4. ОСНОВНЫЕ КНОПКИ */}
              <div className="w-full sm:w-auto flex flex-row items-stretch justify-center gap-2.5 sm:gap-3">
                <Link 
                  href={`/watch/${anime.id}`} 
                  className="flex-1 sm:flex-none flex justify-center items-center gap-2 lg:gap-3 bg-white text-black hover:bg-zinc-200 px-5 sm:px-8 py-3 sm:py-3.5 lg:py-4 rounded-xl lg:rounded-2xl font-black text-xs sm:text-sm uppercase tracking-wider shadow-[0_4px_20px_-2px_rgba(0,0,0,0.3)] transition-transform active:scale-95"
                >
                  <Play fill="currentColor" className="w-4 h-4 lg:w-5 lg:h-5 text-orange-600" />
                  <span>СМОТРЕТЬ</span>
                </Link>

                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                  <DialogTrigger asChild>
                    <button className="flex-1 sm:flex-none flex justify-center items-center gap-2 bg-white/10 hover:bg-white/15 backdrop-blur-md border border-white/10 text-white px-5 sm:px-8 py-3 sm:py-3.5 lg:py-4 rounded-xl lg:rounded-2xl font-bold text-xs sm:text-sm uppercase tracking-wider transition-transform active:scale-95">
                      <Info className="w-4 h-4 lg:w-5 lg:h-5" />
                      <span>ИНФО</span>
                    </button>
                  </DialogTrigger>
                  
                  {/* --- МОДАЛЬНОЕ ОКНО --- */}
                  <DialogContent className="bg-zinc-950 border border-white/10 text-foreground w-[94vw] sm:w-full sm:max-w-4xl p-0 overflow-hidden shadow-2xl rounded-2xl sm:rounded-3xl h-[85vh] md:h-[580px] flex flex-col">
                    <DialogDescription className="sr-only">
                      Подробная информация об аниме {anime.title}
                    </DialogDescription>

                    <div className="flex flex-col md:grid md:grid-cols-12 h-full w-full overflow-hidden relative">

                      <div className="relative shrink-0 w-full h-52 sm:h-64 md:h-full md:col-span-5 overflow-hidden group bg-zinc-900">
                        <Image
                          src={anime.backdrop || posterImage}
                          fill
                          className="object-cover object-center"
                          alt={`Баннер: ${anime.title}`}
                          onError={() => setPosterImageError(true)}
                          unoptimized={posterImageError || (anime.backdrop || posterImage).startsWith('data:image')}
                        />

                        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/70 to-transparent dark:md:via-zinc-950/60 dark:md:to-zinc-950" />
                        <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/60 to-transparent" />

                        <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 bg-orange-600/90 backdrop-blur-md text-white px-3 py-1.5 rounded-xl text-xs font-black shadow-lg shadow-orange-950/40 border border-orange-400/30">
                          <Star className="w-3.5 h-3.5 fill-white" />
                          <span>{anime.rating}</span>
                        </div>
                      </div>

                      <div className="flex-1 md:col-span-7 flex flex-col h-full min-h-0 min-w-0 bg-zinc-950">
                         <div className="flex-1 overflow-y-auto p-5 sm:p-7 md:p-8 custom-scrollbar space-y-4 sm:space-y-5">
                            <div>
                              <DialogTitle className="text-xl sm:text-2xl md:text-3xl font-black font-unbounded uppercase leading-tight text-white tracking-tight">
                                {anime.title}
                              </DialogTitle>

                              <div className="flex flex-wrap items-center gap-2 mt-3 font-mono text-xs font-bold text-zinc-400">
                                <span className="bg-white/5 border border-white/10 px-2.5 py-1 rounded-lg">
                                  {anime.year}
                                </span>
                                {anime.quality && (
                                  <span className="bg-white/5 border border-white/10 px-2.5 py-1 rounded-lg">
                                    {anime.quality}
                                  </span>
                                )}
                                <span className="text-orange-500 bg-orange-500/10 border border-orange-500/20 px-2.5 py-1 rounded-lg flex items-center gap-1.5">
                                  <Zap size={13} fill="currentColor" />
                                  {anime.episodesTotal > 0 ? `${anime.episodesTotal} ${getEpisodeText(anime.episodesTotal)}` : 'ONGOING'}
                                </span>
                              </div>
                            </div>
                              
                            {anime.genres && anime.genres.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 pt-1">
                                 {anime.genres.slice(0, 6).map((g: string) => (
                                   <Link
                                     key={g}
                                     href={`/catalog?genre=${encodeURIComponent(g)}`}
                                     onClick={() => setIsDialogOpen(false)}
                                     className="inline-flex items-center px-3 py-1 rounded-lg bg-white/5 border border-white/10 text-[11px] sm:text-xs font-bold text-zinc-300 hover:border-orange-500/40 hover:text-orange-500 transition-all"
                                   >
                                     {g}
                                   </Link>
                                 ))}
                              </div>
                            )}

                            {mode === 'recommended' && recommendationReason && (
                              <div className="p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border border-blue-500/20 bg-blue-500/5">
                                <div className="flex items-center gap-2 mb-1.5">
                                  <Sparkles className="w-4 h-4 text-blue-500 shrink-0" />
                                  <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">
                                    Почему рекомендовано
                                  </span>
                                </div>

                                {recommendationReason.strategy === 'similar' && recommendationReason.sourceAnime ? (
                                  <p className="text-xs text-zinc-300 mb-2">
                                    Нашли для вас, потому что вам понравилось <span className="text-white font-semibold">«{recommendationReason.sourceAnime}»</span>
                                  </p>
                                ) : recommendationReason.strategy === 'similar' ? (
                                  <p className="text-xs text-zinc-300 mb-2">
                                    Подобрано на основе вашей истории просмотров
                                  </p>
                                ) : (
                                  <p className="text-xs text-zinc-300 mb-2">
                                    Популярно среди зрителей со схожим вкусом
                                  </p>
                                )}

                                <div className="flex flex-wrap gap-1">
                                  {recommendationReason.factors.map((factor, index) => (
                                    <span key={index} className="inline-block px-2 py-0.5 bg-blue-500/10 border border-blue-500/20 rounded-md text-[10px] font-medium text-blue-400">
                                      {factor}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {loadingDescription ? (
                              <div className="p-4 rounded-xl border border-white/5 bg-white/[0.02]">
                                <div className="flex items-center gap-2 text-muted-foreground">
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                  <span className="text-xs">Загрузка описания...</span>
                                </div>
                              </div>
                            ) : fullDescription || (anime.description && anime.description.trim() !== "" && anime.description !== "Описание отсутствует...") ? (
                              <div className="space-y-2 pt-1">
                                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                                  Сюжет
                                </h4>
                                <p className="text-zinc-300 text-xs sm:text-sm leading-relaxed opacity-95 whitespace-pre-line font-normal">
                                  {fullDescription || anime.description}
                                </p>
                              </div>
                            ) : (
                              <div className="p-4 rounded-xl border border-white/5 bg-white/[0.02] flex flex-col items-center text-center">
                                <Info className="w-5 h-5 text-zinc-500 mb-1.5" />
                                <p className="text-zinc-400 text-xs mb-3">
                                  У нас пока нет описания для этого аниме, но вы можете прочитать его на Shikimori:
                                </p>
                                <div className="flex flex-wrap items-center justify-center gap-2">
                                  <a
                                    href={`https://shikimori.one/animes/${anime.id}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-xs font-bold uppercase tracking-wider transition-all"
                                  >
                                    <TrendingUp size={13} />
                                    Shikimori
                                  </a>
                                  <a
                                    href={`https://shikimori.one/animes?search=${encodeURIComponent(anime.title)}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition-all"
                                  >
                                    Поиск
                                  </a>
                                </div>
                              </div>
                            )}
                         </div>
                          
                         <div className="shrink-0 p-4 sm:p-5 border-t border-white/10 bg-zinc-950">
                          <div className="flex flex-row gap-3">
                            <button 
                              type="button"
                              onClick={() => { setIsDialogOpen(false); router.push(`/watch/${anime.id}`) }}
                              className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 text-white font-black py-3 sm:py-3.5 rounded-xl uppercase tracking-wider shadow-lg shadow-orange-600/25 transition-all active:scale-[0.98] group/btn text-xs sm:text-sm"
                            >
                              <Eye className="w-4 h-4 sm:w-5 sm:h-5 group-hover/btn:scale-110 transition-transform" />
                              <span>Смотреть аниме</span>
                              <ChevronRight size={18} className="opacity-70 group-hover/btn:translate-x-1 transition-transform" />
                            </button>
                            <button
                              type="button"
                              onClick={() => toggle(anime)}
                              className="w-11 h-11 sm:w-12 sm:h-12 flex items-center justify-center shrink-0 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold rounded-xl uppercase transition-all active:scale-95"
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
    </div>
  )
}