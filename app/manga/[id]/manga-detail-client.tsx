'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  ArrowLeft, BookOpen, ChevronLeft, ChevronRight, 
  Maximize, Minimize, Settings, Sparkles, Calendar, Star, Info
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Footer } from '@/components/layout/footer';

interface Chapter {
  id: string;
  chapter: string;
  title?: string;
  lang?: string;
  provider?: 'mangadex' | 'remanga' | 'mangalib' | 'comick' | 'mangaeden';
  fallbackId?: string;
  mangalibId?: string;
  comickId?: string;
  mangaedenId?: string;
}

interface MangaInfo {
  id: string;
  title: string;
  altTitles?: string[];
  image?: string;
  description?: string;
  status?: string;
  genres?: string[];
  rating?: string;
  year?: number;
  chapters?: Chapter[];
}

interface MangaDetailClientProps {
  mangaId: string;
}

export default function MangaDetailClient({ mangaId }: MangaDetailClientProps) {
  const [manga, setManga] = useState<MangaInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedChapter, setSelectedChapter] = useState<Chapter | null>(null);
  const [chapterPages, setChapterPages] = useState<string[]>([]);
  const [loadingPages, setLoadingPages] = useState(false);
  const [showReader, setShowReader] = useState(false);
  const [usingFallback, setUsingFallback] = useState(false);

  // New Immersive Reader States
  const [readerMode, setReaderMode] = useState<'single' | 'webtoon'>('single');
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Cover loading states on the detail view
  const [isCoverLoaded, setIsCoverLoaded] = useState(false);
  const [coverHasError, setCoverHasError] = useState(false);

  // Page image loading states
  const [loadedImages, setLoadedImages] = useState<Set<number>>(new Set());
  const [loadingImages, setLoadingImages] = useState<Set<number>>(new Set());

  useEffect(() => {
    fetchMangaInfo();
  }, [mangaId]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement !== null);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const fetchMangaInfo = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/manga/info?id=${mangaId}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error(`Expected JSON response but got: ${contentType || 'none'}`);
      }
      const data: MangaInfo | null = await response.json();
      setManga(data);
      console.log('[MangaDetail] Fetched manga:', data?.title, 'Chapters:', data?.chapters?.length);
    } catch (error) {
      console.error('[MangaDetail] Error fetching manga info:', error);
      setManga(null);
    } finally {
      setLoading(false);
    }
  };

  const handleChapterSelect = async (chapter: Chapter, forceProvider?: 'mangadex' | 'remanga' | 'mangalib' | 'comick' | 'mangaeden') => {
    setSelectedChapter(chapter);
    setShowReader(true);
    setLoadingPages(true);
    setCurrentPageIndex(0); // Reset page to page 1 for the new chapter
    setUsingFallback(false);
    setLoadedImages(new Set());
    setLoadingImages(new Set());
    
    const provider = forceProvider || chapter.provider || 'mangadex';
    const chapterId = forceProvider === 'mangadex' && chapter.fallbackId ? chapter.fallbackId : chapter.id;
    
    try {
      const fallbackParam = chapter.fallbackId ? `&fallbackId=${chapter.fallbackId}` : '';
      const mangalibParam = chapter.mangalibId ? `&mangalibId=${chapter.mangalibId}` : '';
      const comickParam = chapter.comickId ? `&comickId=${chapter.comickId}` : '';
      const mangaedenParam = chapter.mangaedenId ? `&mangaedenId=${chapter.mangaedenId}` : '';
      const response = await fetch(`/api/manga/read?mangaId=${mangaId}&chapterId=${chapterId}&provider=${provider}${fallbackParam}${mangalibParam}${comickParam}${mangaedenParam}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error(`Expected JSON response but got: ${contentType || 'none'}`);
      }
      const data = await response.json() as { pages: string[]; usedProvider?: string };
      setChapterPages(data.pages || []);
      if (data.usedProvider && data.usedProvider !== provider) {
        setUsingFallback(true);
      }
    } catch (error) {
      console.error('Error fetching chapter pages:', error);
      setChapterPages([]);
    } finally {
      setLoadingPages(false);
    }
  };

  const handleBackToList = () => {
    setShowReader(false);
    setSelectedChapter(null);
    setChapterPages([]);
    setUsingFallback(false);
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
  };

  const handleImageError = () => {
    // If using Remanga and a fallback is available, switch to MangaDex
    if (selectedChapter?.provider === 'remanga' && selectedChapter.fallbackId && !usingFallback) {
      console.log('[MangaReader] Remanga images failed, falling back to MangaDex');
      handleChapterSelect(selectedChapter, 'mangadex');
    }
  };

  const handleImageLoad = (index: number) => {
    setLoadedImages(prev => new Set(prev).add(index));
    setLoadingImages(prev => {
      const next = new Set(prev);
      next.delete(index);
      return next;
    });
  };

  const handleImageStartLoad = (index: number) => {
    setLoadingImages(prev => new Set(prev).add(index));
  };

  const currentChapterIndex = manga?.chapters?.findIndex(ch => ch.id === selectedChapter?.id) ?? -1;
  const hasNextChapter = manga?.chapters && currentChapterIndex < manga.chapters.length - 1;
  const hasPrevChapter = manga?.chapters && currentChapterIndex > 0;

  const handleNextChapter = () => {
    if (!manga?.chapters || !selectedChapter || !hasNextChapter) return;
    handleChapterSelect(manga.chapters[currentChapterIndex + 1]);
  };

  const handlePrevChapter = () => {
    if (!manga?.chapters || !selectedChapter || !hasPrevChapter) return;
    handleChapterSelect(manga.chapters[currentChapterIndex - 1]);
  };

  // Keyboard navigation for page-by-page mode
  useEffect(() => {
    if (!showReader || readerMode !== 'single') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        if (currentPageIndex < chapterPages.length - 1) {
          setCurrentPageIndex(prev => prev + 1);
        } else if (hasNextChapter) {
          handleNextChapter();
        }
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (currentPageIndex > 0) {
          setCurrentPageIndex(prev => prev - 1);
        } else if (hasPrevChapter) {
          handlePrevChapter();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showReader, readerMode, currentPageIndex, chapterPages, selectedChapter, manga?.chapters]);

  // Click side areas navigation handler
  const handlePageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const width = rect.width;

    if (x > width / 2) {
      if (currentPageIndex < chapterPages.length - 1) {
        setCurrentPageIndex(prev => prev + 1);
      } else if (hasNextChapter) {
        handleNextChapter();
      }
    } else {
      if (currentPageIndex > 0) {
        setCurrentPageIndex(prev => prev - 1);
      } else if (hasPrevChapter) {
        handlePrevChapter();
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        <p className="text-sm text-muted-foreground animate-pulse">Загрузка информации...</p>
      </div>
    );
  }

  if (!manga) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="container mx-auto px-4 py-8 text-center">
          <Link href="/manga" className="inline-flex items-center gap-2 text-primary hover:underline mb-8">
            <ArrowLeft className="w-4 h-4" />
            Назад к списку
          </Link>
          <div className="max-w-md mx-auto">
            <BookOpen className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <p className="text-xl font-bold text-muted-foreground mb-2">Манга не найдена</p>
            <p className="text-sm text-muted-foreground mb-6">
              ID: <code className="bg-secondary px-2 py-1 rounded text-xs">{mangaId}</code>
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              Возможно, этот ID не существует в MangaDex или был введён неправильно.
            </p>
            <Link 
              href="/manga" 
              className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
            >
              <BookOpen className="w-4 h-4" />
              Перейти в каталог
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (showReader) {
    return (
      <div className={cn(
        "min-h-screen bg-zinc-950 text-zinc-100 flex flex-col select-none transition-all duration-300 z-40",
        isFullscreen && "fixed inset-0 z-50 overflow-hidden"
      )}>
        {/* Top Header Controls */}
        <div className="bg-zinc-900/90 backdrop-blur-md border-b border-zinc-800/60 sticky top-0 z-20 px-4 py-3 flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-4">
            <button
              onClick={handleBackToList}
              className="p-2 hover:bg-zinc-800 rounded-full text-zinc-400 hover:text-zinc-100 transition-colors"
              title="Назад к деталям"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex flex-col">
              <span className="text-xs text-zinc-500 font-bold tracking-wide uppercase truncate max-w-[150px] md:max-w-xs">{manga.title}</span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-zinc-200">
                  Глава {selectedChapter?.chapter} {selectedChapter?.title && `- ${selectedChapter.title}`}
                </span>
                {usingFallback && (
                  <span className="text-[10px] font-bold bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded border border-amber-500/30">
                    MangaDex Fallback
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Center Chapter Select and Navigation */}
          <div className="hidden md:flex items-center gap-2 bg-zinc-950/60 px-3 py-1.5 rounded-full border border-zinc-800">
            <button
              disabled={!hasPrevChapter}
              onClick={handlePrevChapter}
              className="p-1 hover:bg-zinc-800 disabled:opacity-40 disabled:hover:bg-transparent rounded-full text-zinc-300 transition-colors"
              title="Предыдущая глава"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            
            <select
              value={selectedChapter?.id}
              onChange={(e) => {
                const target = manga.chapters?.find(ch => ch.id === e.target.value);
                if (target) handleChapterSelect(target);
              }}
              className="bg-transparent text-sm font-bold px-2 py-0.5 outline-none cursor-pointer text-zinc-200 hover:text-white"
            >
              {manga.chapters?.map((ch) => (
                <option key={ch.id} value={ch.id} className="bg-zinc-900 text-zinc-200">
                  Глава {ch.chapter} {ch.provider === 'remanga' ? '[ReManga]' : ch.provider === 'mangalib' ? '[MangaLib]' : (ch.lang && `(${ch.lang === 'ru' ? 'RU' : ch.lang.toUpperCase()})`)}
                </option>
              ))}
            </select>

            <button
              disabled={!hasNextChapter}
              onClick={handleNextChapter}
              className="p-1 hover:bg-zinc-800 disabled:opacity-40 disabled:hover:bg-transparent rounded-full text-zinc-300 transition-colors"
              title="Следующая глава"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Right Toolbar Controls */}
          <div className="flex items-center gap-2">
            {/* Mode Select */}
            <div className="flex bg-zinc-950 p-1 rounded-full border border-zinc-800 text-xs font-semibold">
              <button
                onClick={() => setReaderMode('single')}
                className={cn(
                  "px-3 py-1 rounded-full transition-colors",
                  readerMode === 'single' ? "bg-primary text-primary-foreground shadow" : "text-zinc-400 hover:text-zinc-200"
                )}
              >
                Постранично
              </button>
              <button
                onClick={() => setReaderMode('webtoon')}
                className={cn(
                  "px-3 py-1 rounded-full transition-colors",
                  readerMode === 'webtoon' ? "bg-primary text-primary-foreground shadow" : "text-zinc-400 hover:text-zinc-200"
                )}
              >
                Лента
              </button>
            </div>

            {/* Fullscreen Button */}
            <button
              onClick={() => {
                if (!isFullscreen) {
                  document.documentElement.requestFullscreen().catch(() => {});
                  setIsFullscreen(true);
                } else {
                  document.exitFullscreen().catch(() => {});
                  setIsFullscreen(false);
                }
              }}
              className="p-2 hover:bg-zinc-800 rounded-full text-zinc-400 hover:text-zinc-100 transition-colors hidden sm:block"
              title={isFullscreen ? "Выйти из полноэкранного режима" : "Во весь экран"}
            >
              {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Reader Content Body */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden relative flex flex-col justify-between bg-zinc-950">
          {loadingPages ? (
            <div className="flex-1 flex flex-col items-center justify-center py-24">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
              <p className="text-zinc-400 text-sm font-medium animate-pulse">Загрузка страниц...</p>
            </div>
          ) : chapterPages.length > 0 ? (
            readerMode === 'webtoon' ? (
              /* --- WEBTOON MODE (Vertical ribbon) --- */
              <div className="max-w-3xl mx-auto w-full px-2 sm:px-4 py-6 space-y-4">
                {chapterPages.map((page, index) => (
                  <div key={index} className="flex flex-col items-center group relative w-full">
                    {!loadedImages.has(index) && (
                      <div className="w-full min-h-[200px] flex items-center justify-center bg-zinc-900/50 rounded-lg border border-zinc-800/30 mb-2">
                        <div className="flex flex-col items-center gap-3">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                          <span className="text-xs text-zinc-500 font-medium animate-pulse">Загрузка страницы {index + 1}...</span>
                        </div>
                      </div>
                    )}
                    <img
                      src={page}
                      alt={`Страница ${index + 1}`}
                      className={cn(
                        "max-w-full h-auto block mx-auto object-contain rounded-lg shadow-2xl bg-zinc-900 border border-zinc-800/30",
                        !loadedImages.has(index) && "hidden"
                      )}
                      onLoad={() => handleImageLoad(index)}
                      onError={handleImageError}
                    />
                    <span className="absolute bottom-2 right-4 text-xs font-bold bg-black/80 text-zinc-300 px-3 py-1 rounded-full backdrop-blur border border-zinc-850 opacity-0 group-hover:opacity-100 transition-opacity">
                      {index + 1} / {chapterPages.length}
                    </span>
                  </div>
                ))}

                {/* Webtoon End Navigation */}
                <div className="pt-12 pb-12 flex flex-col items-center gap-4 border-t border-zinc-900 mt-12">
                  <p className="text-zinc-400 text-sm font-bold">Вы дочитали главу {selectedChapter?.chapter}!</p>
                  <div className="flex gap-4">
                    <button
                      disabled={!hasPrevChapter}
                      onClick={handlePrevChapter}
                      className="px-5 py-2.5 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 disabled:opacity-30 text-xs font-bold rounded-full transition-all flex items-center gap-2"
                    >
                      <ChevronLeft className="w-4 h-4" /> Предыдущая глава
                    </button>
                    <button
                      disabled={!hasNextChapter}
                      onClick={handleNextChapter}
                      className="px-6 py-2.5 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-30 text-xs font-bold rounded-full shadow-lg hover:shadow-primary/20 transition-all flex items-center gap-2"
                    >
                      Следующая глава <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* --- SINGLE PAGE MODE (Paginated Slider) --- */
              <div className="flex-1 flex flex-col items-center justify-center py-6 px-4 relative group/image max-h-[calc(100vh-140px)]">
                {/* Side tap areas */}
                <div 
                  onClick={() => {
                    if (currentPageIndex > 0) {
                      setCurrentPageIndex(prev => prev - 1);
                    } else if (hasPrevChapter) {
                      handlePrevChapter();
                    }
                  }}
                  className="absolute left-0 top-0 bottom-0 w-1/5 z-10 cursor-pointer flex items-center justify-start pl-6 opacity-0 group-hover/image:opacity-100 transition-opacity duration-200"
                  title="Предыдущая страница"
                >
                  <div className="p-3 bg-zinc-900/90 backdrop-blur border border-zinc-800 rounded-full text-zinc-300 hover:text-white hover:scale-110 active:scale-90 transition-all shadow-xl">
                    <ChevronLeft className="w-6 h-6" />
                  </div>
                </div>

                <div 
                  onClick={() => {
                    if (currentPageIndex < chapterPages.length - 1) {
                      setCurrentPageIndex(prev => prev + 1);
                    } else if (hasNextChapter) {
                      handleNextChapter();
                    }
                  }}
                  className="absolute right-0 top-0 bottom-0 w-1/5 z-10 cursor-pointer flex items-center justify-end pr-6 opacity-0 group-hover/image:opacity-100 transition-opacity duration-200"
                  title="Следующая страница"
                >
                  <div className="p-3 bg-zinc-900/90 backdrop-blur border border-zinc-800 rounded-full text-zinc-300 hover:text-white hover:scale-110 active:scale-90 transition-all shadow-xl">
                    <ChevronRight className="w-6 h-6" />
                  </div>
                </div>

                {/* Active Image Container */}
                <div 
                  onClick={handlePageClick}
                  className="relative cursor-pointer max-h-full flex items-center justify-center transition-all duration-300"
                  style={{ height: 'calc(100vh - 190px)' }}
                >
                  {!loadedImages.has(currentPageIndex) && (
                    <div className="absolute inset-0 flex items-center justify-center bg-zinc-900/50 rounded-lg border border-zinc-800/30">
                      <div className="flex flex-col items-center gap-3">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                        <span className="text-sm text-zinc-500 font-medium animate-pulse">Загрузка страницы {currentPageIndex + 1}...</span>
                      </div>
                    </div>
                  )}
                  <img
                    src={chapterPages[currentPageIndex]}
                    alt={`Страница ${currentPageIndex + 1}`}
                    className={cn(
                      "max-w-full max-h-full object-contain rounded-lg shadow-2xl border border-zinc-800/80 bg-zinc-950 transition-all duration-300",
                      !loadedImages.has(currentPageIndex) && "opacity-0"
                    )}
                    onLoad={() => handleImageLoad(currentPageIndex)}
                    onError={handleImageError}
                  />

                  {/* Preload next page image dynamically in background */}
                  {currentPageIndex < chapterPages.length - 1 && (
                    <img 
                      src={chapterPages[currentPageIndex + 1]} 
                      className="hidden" 
                      alt="preload"
                      onLoad={() => handleImageLoad(currentPageIndex + 1)}
                    />
                  )}
                </div>

                {/* Key Guidance Indicator */}
                <div className="mt-4 flex items-center gap-3 bg-zinc-900/50 backdrop-blur-sm border border-zinc-800/80 px-4 py-1.5 rounded-full text-[11px] font-semibold text-zinc-400">
                  <span>Клавиши ← и → для управления</span>
                  <div className="w-px h-3 bg-zinc-800"></div>
                  <span className="text-zinc-200 font-bold">Страница {currentPageIndex + 1} из {chapterPages.length}</span>
                </div>
              </div>
            )
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center py-24 text-center">
              <p className="text-zinc-500 font-medium">Не удалось загрузить страницы главы</p>
              <button 
                onClick={() => handleChapterSelect(selectedChapter!)}
                className="mt-4 px-5 py-2 bg-zinc-900 hover:bg-zinc-800 rounded-full text-xs font-bold border border-zinc-800 transition-colors"
              >
                Повторить попытку
              </button>
            </div>
          )}

          {/* Immersive Bottom Floating Bar (Single Page Mode) */}
          {readerMode === 'single' && !loadingPages && chapterPages.length > 0 && (
            <div className="bg-zinc-950/90 backdrop-blur-md border-t border-zinc-900 px-4 py-3 flex items-center justify-center gap-6 sticky bottom-0 z-20">
              <div className="flex items-center gap-4 max-w-xl w-full">
                <button
                  disabled={currentPageIndex === 0 && !hasPrevChapter}
                  onClick={() => {
                    if (currentPageIndex > 0) {
                      setCurrentPageIndex(prev => prev - 1);
                    } else {
                      handlePrevChapter();
                    }
                  }}
                  className="px-4 py-2 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 hover:text-white disabled:opacity-40 text-xs font-bold rounded-full transition-colors flex items-center gap-1"
                >
                  <ChevronLeft className="w-4 h-4" /> Назад
                </button>

                {/* Progress bar slider with clickable segments */}
                <div className="flex-1 flex items-center gap-3">
                  <div 
                    className="relative flex-1 h-2 bg-zinc-850 rounded-full overflow-hidden cursor-pointer group"
                    onClick={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const clickX = e.clientX - rect.left;
                      const percentage = clickX / rect.width;
                      const index = Math.min(Math.max(0, Math.floor(percentage * chapterPages.length)), chapterPages.length - 1);
                      setCurrentPageIndex(index);
                    }}
                  >
                    <div 
                      className="absolute left-0 top-0 bottom-0 bg-primary group-hover:bg-primary/90 transition-all duration-150"
                      style={{ width: `${((currentPageIndex + 1) / chapterPages.length) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs font-bold text-zinc-300 w-12 text-right">
                    {currentPageIndex + 1} / {chapterPages.length}
                  </span>
                </div>

                <button
                  disabled={currentPageIndex === chapterPages.length - 1 && !hasNextChapter}
                  onClick={() => {
                    if (currentPageIndex < chapterPages.length - 1) {
                      setCurrentPageIndex(prev => prev + 1);
                    } else {
                      handleNextChapter();
                    }
                  }}
                  className="px-5 py-2 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 text-xs font-bold rounded-full shadow-lg transition-all flex items-center gap-1"
                >
                  Вперед <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // --- DETAIL VIEW WITH PREMIUM WEEBX STYLING ---
  return (
    <div className="min-h-screen bg-background relative overflow-hidden pb-12">
      {/* Background Decorative Blurs to match WeebX theme */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-primary/5 rounded-full blur-3xl -z-10 pointer-events-none" />
      <div className="absolute top-1/3 right-1/4 w-[400px] h-[400px] bg-indigo-500/5 rounded-full blur-3xl -z-10 pointer-events-none" />

      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <Link 
          href="/manga" 
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors mb-8 group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          Назад к списку
        </Link>

        {/* Info Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-12">
          {/* Left Column: Cover & Badges */}
          <div className="col-span-1 md:col-span-4 flex flex-col gap-6">
            <div className="relative aspect-[3/4] w-full rounded-2xl overflow-hidden shadow-2xl border border-zinc-800/40 bg-zinc-900 group">
              
              {/* Shimmer skeleton with Spinner */}
              {!isCoverLoaded && !coverHasError && manga.image && (
                <div className="absolute inset-0 bg-secondary/60 animate-pulse flex items-center justify-center">
                  <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              )}

              {manga.image && !coverHasError ? (
                <img
                  src={manga.image}
                  alt={manga.title}
                  onLoad={() => setIsCoverLoaded(true)}
                  onError={() => setCoverHasError(true)}
                  className={cn(
                    "w-full h-full object-cover transition-all duration-500 group-hover:scale-105",
                    isCoverLoaded ? "opacity-100 scale-100" : "opacity-0 scale-95"
                  )}
                />
              ) : null}

              {(coverHasError || !manga.image) && (
                <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-900 border border-zinc-800 rounded-2xl">
                  <BookOpen className="w-12 h-12 text-zinc-600 mb-2" />
                  <span className="text-muted-foreground text-sm">Нет изображения</span>
                </div>
              )}
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 gap-3 bg-secondary/30 backdrop-blur border border-zinc-800/40 p-4 rounded-xl">
              <div className="flex flex-col">
                <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Год</span>
                <span className="text-sm font-bold text-foreground flex items-center gap-1.5 mt-1">
                  <Calendar className="w-4 h-4 text-primary" /> {manga.year || 'Н/Д'}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Статус</span>
                <span className="text-sm font-bold text-foreground mt-1 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-emerald-500 animate-pulse" />
                  <span className="capitalize">{manga.status || 'Неизвестно'}</span>
                </span>
              </div>
            </div>
          </div>

          {/* Right Column: Detailed info & Chapters */}
          <div className="col-span-1 md:col-span-8 flex flex-col gap-6">
            <div className="flex flex-col gap-3">
              <h1 className="text-3xl md:text-5xl font-black tracking-tight text-foreground leading-none">{manga.title}</h1>
              {manga.altTitles && manga.altTitles.length > 0 && (
                <p className="text-sm text-muted-foreground italic line-clamp-1">{manga.altTitles.join(' • ')}</p>
              )}
            </div>

            {/* Genres */}
            {manga.genres && manga.genres.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {manga.genres.map((genre, index) => (
                  <span
                    key={index}
                    className="px-3.5 py-1 rounded-full bg-secondary border border-zinc-800/30 text-xs font-bold hover:bg-primary hover:text-primary-foreground hover:scale-105 transition-all cursor-default"
                  >
                    {genre}
                  </span>
                ))}
              </div>
            )}

            {/* Description */}
            {manga.description && (
              <div className="bg-secondary/20 p-5 rounded-2xl border border-zinc-800/30">
                <h3 className="font-bold mb-3 text-sm tracking-wide uppercase text-muted-foreground flex items-center gap-1.5">
                  <Info className="w-4 h-4 text-primary" /> Описание
                </h3>
                <p className="text-sm md:text-base text-muted-foreground whitespace-pre-line leading-relaxed max-h-60 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-zinc-800">
                  {manga.description}
                </p>
              </div>
            )}

            {/* Chapters Section */}
            <div className="mt-4 flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-zinc-800/40 pb-3">
                <h2 className="text-xl md:text-2xl font-black tracking-tight flex items-center gap-2">
                  <BookOpen className="w-6 h-6 text-primary" />
                  Главы для чтения
                </h2>
                {manga.chapters && (
                  <span className="text-xs font-bold bg-primary/10 text-primary px-3 py-1 rounded-full">
                    Доступно: {manga.chapters.length}
                  </span>
                )}
              </div>

              {manga.chapters && manga.chapters.length > 0 ? (
                <div className="space-y-6 max-h-[450px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-zinc-800">
                  {(() => {
                    // Group chapters by provider
                    const grouped = manga.chapters.reduce((acc, chapter) => {
                      const provider = chapter.provider || 'mangadex';
                      if (!acc[provider]) acc[provider] = [];
                      acc[provider].push(chapter);
                      return acc;
                    }, {} as Record<string, typeof manga.chapters>);

                    // Provider order: ReManga (RU priority), MangaLib, MangaDex
                    const providerOrder = ['remanga', 'mangalib', 'mangadex'];
                    
                    return providerOrder
                      .filter(provider => grouped[provider]?.length > 0)
                      .map(provider => (
                        <div key={provider} className="space-y-3">
                          <div className="flex items-center gap-2 pb-2 border-b border-zinc-800/40">
                            <span className="text-sm font-bold text-foreground">
                              {provider === 'remanga' ? '🇷🇺 ReManga' : provider === 'mangalib' ? '🇷🇺 MangaLib' : '🌐 MangaDex'}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              ({grouped[provider].length} глав)
                            </span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {grouped[provider].map((chapter) => (
                              <button
                                key={chapter.id}
                                onClick={() => handleChapterSelect(chapter)}
                                className="group/btn text-left p-4 bg-secondary/35 hover:bg-secondary border border-zinc-800/30 hover:border-primary/50 rounded-xl transition-all duration-300 hover:scale-[1.01] hover:shadow-lg hover:shadow-primary/5 active:scale-95"
                              >
                                <div className="flex items-center justify-between gap-4">
                                  <div className="flex flex-col gap-1 min-w-0">
                                    <span className="font-bold text-sm text-foreground truncate group-hover/btn:text-primary transition-colors">
                                      Глава {chapter.chapter}
                                    </span>
                                    {chapter.title && (
                                      <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                                        {chapter.title}
                                      </span>
                                    )}
                                  </div>
                                  {chapter.lang && chapter.provider !== 'remanga' && chapter.provider !== 'mangalib' && (
                                    <span className="text-[10px] font-extrabold bg-zinc-900 border border-zinc-800 text-zinc-400 group-hover/btn:text-white px-2 py-1 rounded">
                                      {chapter.lang === 'ru' ? '🇷🇺' : chapter.lang.toUpperCase()}
                                    </span>
                                  )}
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      ));
                  })()}
                </div>
              ) : (
                <div className="text-center py-12 bg-secondary/20 rounded-2xl border border-zinc-800/30">
                  <BookOpen className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                  <p className="font-semibold text-muted-foreground text-sm">Главы не найдены на MangaDex</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">Они могут быть добавлены позже волонтерами.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
