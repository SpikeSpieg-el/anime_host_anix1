'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Search, Flame, Sparkles, ChevronLeft, ChevronRight, BookOpen, Filter, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MultiSelect } from '@/components/ui/multi-select';
import { MANGADEX_TAGS_MAP } from '@/lib/mangadex/api';
import { Footer } from '@/components/layout/footer';
import { getProxiedSrc } from '@/lib/image-loader';

interface Manga {
  id: string;
  title: string;
  image?: string;
  altTitles?: string[];
}

interface MangaSearchResult {
  currentPage: number;
  hasNextPage: boolean;
  results: Manga[];
}

function MangaCard({ manga }: { manga: Manga }) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  // Image URL — proxying handled by getProxiedSrc() in the img tag
  const imageUrl = manga.image || undefined;

  return (
    <Link
      href={`/manga/${manga.id}`}
      className="group flex flex-col gap-2.5 relative"
    >
      <div className="relative overflow-hidden rounded-2xl bg-secondary aspect-[3/4] border border-zinc-800/30 shadow-md group-hover:border-primary/50 group-hover:shadow-primary/5 transition-all duration-300">
        
        {/* Shimmer Skeleton Placeholder with Spinner while loading */}
        {!isLoaded && !hasError && imageUrl && (
          <div className="absolute inset-0 bg-secondary/60 animate-pulse flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {imageUrl && !hasError ? (
          <img
            src={getProxiedSrc(imageUrl)}
            alt={manga.title}
            onLoad={() => setIsLoaded(true)}
            onError={() => setHasError(true)}
            className={cn(
              "w-full h-full object-cover group-hover:scale-105 transition-all duration-500",
              isLoaded ? "opacity-100 scale-100" : "opacity-0 scale-95"
            )}
            loading="lazy"
          />
        ) : null}

        {/* Hover overlay */}
        {isLoaded && (
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
            <span className="text-[10px] font-bold text-primary-foreground bg-primary px-2.5 py-1 rounded-full shadow-lg">Читать</span>
          </div>
        )}

        {/* Fallback image placeholder */}
        {(hasError || !manga.image) && (
          <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-900 border border-zinc-800 rounded-2xl">
            <BookOpen className="w-8 h-8 text-zinc-600 mb-1" />
            <span className="text-muted-foreground text-[10px]">Нет фото</span>
          </div>
        )}
      </div>
      <h3 className="mt-1 text-sm font-bold text-foreground group-hover:text-primary transition-colors leading-snug line-clamp-2 px-1">
        {manga.title}
      </h3>
    </Link>
  );
}

export default function MangaClient() {
  const [searchQuery, setSearchQuery] = useState('');
  const [mangaList, setMangaList] = useState<Manga[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [activeTab, setActiveTab] = useState<'search' | 'popular' | 'recent' | 'genres'>('popular');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showGenreFilter, setShowGenreFilter] = useState(false);

  const fetchManga = async (query?: string, page: number = 1, tags?: string[]) => {
    setLoading(true);
    try {
      let url = '';
      if (tags && tags.length > 0) {
        url = `/api/manga/search?tags=${tags.join(',')}&page=${page}`;
      } else if (query) {
        url = `/api/manga/search?q=${encodeURIComponent(query)}&page=${page}`;
      } else if (activeTab === 'popular') {
        url = `/api/manga/popular?page=${page}`;
      } else if (activeTab === 'recent') {
        url = `/api/manga/recent?page=${page}`;
      }

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error(`Expected JSON response but got: ${contentType || 'none'}`);
      }

      const data: MangaSearchResult = await response.json();
      setMangaList(data.results || []);
      setHasNextPage(data.hasNextPage);
      setCurrentPage(page);
    } catch (error) {
      console.error('Error fetching manga:', error);
      setMangaList([]);
      setHasNextPage(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'genres' && selectedTags.length > 0) {
      fetchManga(undefined, 1, selectedTags);
    } else if (activeTab !== 'genres') {
      fetchManga(undefined, 1);
    }
  }, [activeTab]);

  useEffect(() => {
    if (selectedTags.length > 0 && activeTab === 'genres') {
      fetchManga(undefined, 1, selectedTags);
    } else if (selectedTags.length === 0 && activeTab === 'genres') {
      setMangaList([]);
    }
  }, [selectedTags]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setActiveTab('search');
      setSelectedTags([]);
      fetchManga(searchQuery, 1);
    }
  };

  const handlePageChange = (newPage: number) => {
    if (activeTab === 'search' && searchQuery) {
      fetchManga(searchQuery, newPage);
    } else if (activeTab === 'genres' && selectedTags.length > 0) {
      fetchManga(undefined, newPage, selectedTags);
    } else {
      fetchManga(undefined, newPage);
    }
    // Scroll smoothly to top on page change
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const clearTags = () => {
    setSelectedTags([]);
    setActiveTab('popular');
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden pb-16">
      {/* Immersive background decoration */}
      <div className="absolute top-0 left-1/3 w-[500px] h-[500px] bg-primary/5 rounded-full blur-3xl -z-10 pointer-events-none" />
      <div className="absolute top-1/4 right-1/4 w-[400px] h-[400px] bg-indigo-500/5 rounded-full blur-3xl -z-10 pointer-events-none" />

      <div className="container mx-auto px-4 py-8 max-w-6xl relative z-10">
        {/* Title Badge */}
        <div className="flex flex-col items-center text-center gap-2 mb-10">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-xs font-bold text-primary tracking-wide uppercase animate-pulse">
            <BookOpen className="w-3.5 h-3.5" /> WeebX Reader
          </div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight text-foreground">Каталог Манги</h1>
          <p className="text-sm text-muted-foreground max-w-md">Читайте популярную мангу на русском онлайн со стабильной скоростью</p>
        </div>

        {/* Glassmorphic Search Bar */}
        <form onSubmit={handleSearch} className="mb-10 max-w-2xl mx-auto w-full group/search">
          <div className="relative">
            <div className="absolute inset-0 bg-primary/20 rounded-2xl blur-xl group-hover/search:bg-primary/35 transition-all duration-300 opacity-40 -z-10" />
            <div className="relative bg-secondary/40 backdrop-blur-md border border-zinc-800/80 rounded-2xl p-2 flex items-center shadow-2xl">
              <Search className="w-5 h-5 text-muted-foreground ml-3 shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Поиск манги (например: Solo Leveling, Chainsaw Man)..."
                className="flex-1 px-3 py-2 bg-transparent text-sm text-foreground placeholder-muted-foreground outline-none border-0 min-w-0"
              />
              <button
                type="submit"
                className="px-6 py-2 bg-primary text-primary-foreground font-bold text-xs rounded-xl hover:bg-primary/95 hover:shadow-lg hover:shadow-primary/20 transition-all shrink-0"
              >
                Поиск
              </button>
            </div>
          </div>
        </form>

        {/* Navigation Tabs */}
        <div className="flex justify-center gap-4 mb-10">
          <div className="flex bg-secondary/35 p-1 rounded-full border border-zinc-800/40 backdrop-blur">
            <button
              onClick={() => {
                setActiveTab('popular');
                setSearchQuery('');
                setSelectedTags([]);
                fetchManga(undefined, 1);
              }}
              className={cn(
                "px-5 py-2.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5",
                activeTab === 'popular' ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Flame className="w-4 h-4" /> Популярное
            </button>
            <button
              onClick={() => {
                setActiveTab('recent');
                setSearchQuery('');
                setSelectedTags([]);
                fetchManga(undefined, 1);
              }}
              className={cn(
                "px-5 py-2.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5",
                activeTab === 'recent' ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Sparkles className="w-4 h-4" /> Новинки
            </button>
            <button
              onClick={() => {
                setActiveTab('genres');
                setSearchQuery('');
                setShowGenreFilter(!showGenreFilter);
              }}
              className={cn(
                "px-5 py-2.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5",
                activeTab === 'genres' ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Filter className="w-4 h-4" /> Жанры
            </button>
          </div>
        </div>

        {/* Genre Filter Panel */}
        {showGenreFilter && (
          <div className="mb-8 p-4 bg-secondary/80 rounded-xl border border-zinc-800/40 backdrop-blur animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-foreground">Фильтр по жанрам</h3>
              {selectedTags.length > 0 && (
                <button
                  onClick={clearTags}
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                >
                  <X className="w-3 h-3" /> Очистить
                </button>
              )}
            </div>
            <div className="mb-3 p-2 bg-orange-500/10 border border-orange-500/30 rounded-lg">
              <p className="text-xs text-orange-400 font-medium">⚠️ Некоторые жанры могут содержать контент 18+</p>
            </div>
            <MultiSelect
              options={[
                { value: 'all', label: 'Все жанры' },
                ...Object.entries(MANGADEX_TAGS_MAP).map(([name, id]) => ({ value: name, label: name }))
              ]}
              selected={selectedTags}
              onChange={(selected) => {
                setSelectedTags(selected.includes('all') ? [] : selected);
                if (selected.length > 0 && !selected.includes('all')) {
                  setActiveTab('genres');
                }
              }}
              placeholder="Выберите жанры..."
              className="w-full bg-secondary border-border text-foreground min-h-[2.5rem] h-auto py-1 dark:bg-zinc-800 dark:border-zinc-700 dark:text-white"
            />
          </div>
        )}

        {/* Content Section */}
        {loading ? (
          /* Shimmering Loading Skeleton Cards */
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="flex flex-col gap-3 animate-pulse">
                <div className="aspect-[3/4] bg-secondary/40 border border-zinc-800/40 rounded-2xl" />
                <div className="h-4 bg-secondary/50 rounded-md w-4/5" />
                <div className="h-3 bg-secondary/40 rounded-md w-3/5" />
              </div>
            ))}
          </div>
        ) : mangaList.length > 0 ? (
          /* Manga Cards Grid */
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
            {mangaList.map((manga) => (
              <MangaCard key={manga.id} manga={manga} />
            ))}
          </div>
        ) : (
          /* Beautiful Empty State */
          <div className="text-center py-16 bg-secondary/15 rounded-3xl border border-zinc-850/40 max-w-xl mx-auto">
            <BookOpen className="w-16 h-12 mx-auto mb-4 text-zinc-600" />
            <h3 className="text-lg font-bold text-foreground">Ничего не найдено</h3>
            <p className="text-sm text-muted-foreground mt-1 px-4">Попробуйте ввести другое название или воспользуйтесь каталогом популярного</p>
          </div>
        )}

        {/* Sleek Pagination */}
        {!loading && mangaList.length > 0 && (
          <div className="flex justify-center items-center gap-6 mt-12 pt-6 border-t border-zinc-850/40">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage <= 1}
              className="px-4 py-2 bg-secondary/50 border border-zinc-800 hover:bg-secondary hover:text-foreground disabled:opacity-30 disabled:hover:bg-secondary/50 disabled:hover:text-muted-foreground text-xs font-bold rounded-full transition-all flex items-center gap-1"
            >
              <ChevronLeft className="w-4 h-4" /> Назад
            </button>
            <span className="text-xs font-bold text-muted-foreground tracking-wider uppercase">Страница {currentPage}</span>
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={!hasNextPage}
              className="px-4 py-2 bg-secondary/50 border border-zinc-800 hover:bg-secondary hover:text-foreground disabled:opacity-30 disabled:hover:bg-secondary/50 disabled:hover:text-muted-foreground text-xs font-bold rounded-full transition-all flex items-center gap-1"
            >
              Вперед <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}
