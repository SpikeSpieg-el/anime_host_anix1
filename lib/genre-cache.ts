interface CachedGenres {
  genres: string[];
  timestamp: number;
}

class GenreCache {
  private static cache = new Map<string, CachedGenres>();
  private static CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

  static get(key: string): string[] | null {
    const cached = this.cache.get(key);
    if (!cached) return null;
    
    if (Date.now() - cached.timestamp > this.CACHE_DURATION) {
      this.cache.delete(key);
      return null;
    }
    
    return cached.genres;
  }

  static set(key: string, genres: string[]): void {
    this.cache.set(key, {
      genres,
      timestamp: Date.now()
    });
  }

  static clear(): void {
    this.cache.clear();
  }
}

export { GenreCache };
