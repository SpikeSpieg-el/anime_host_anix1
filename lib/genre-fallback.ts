import { GenreCache } from "./genre-cache";

interface ExternalGenreSource {
  name: string;
  genres: string[];
}

interface MyAnimeListResponse {
  data: Array<{
    node: {
      genres: Array<{
        name: string;
      }>;
    };
  }>;
}

interface AnilistResponse {
  data: {
    Media: {
      genres: string[];
    };
  };
}

export class GenreFallbackService {
  private static readonly GENRE_MAPPINGS: Record<string, string[]> = {
    // English to Russian genre mappings
    'Action': ['Экшен', 'Боевик'],
    'Adventure': ['Приключения'],
    'Comedy': ['Комедия'],
    'Drama': ['Драма'],
    'Fantasy': ['Фэнтези'],
    'Magic': ['Магия'],
    'Horror': ['Ужасы'],
    'Mystery': ['Детектив', 'Тайна'],
    'Romance': ['Романтика'],
    'Sci-Fi': ['Фантастика', 'Научная фантастика'],
    'Slice of Life': ['Повседневность', 'Сlice of Life'],
    'Sports': ['Спорт'],
    'Thriller': ['Триллер'],
    'Isekai': ['Исекай'],
    'Shounen': ['Сёнэн'],
    'Seinen': ['Сэйнэн'],
    'Shoujo': ['Сёдзё'],
    'Josei': ['Дзёсэй'],
    'Music': ['Музыка'],
    'Psychological': ['Психология'],
    'Supernatural': ['Сверхъестественное'],
    'Parody': ['Пародия'],
    'Ecchi': ['Этти'],
    'Mecha': ['Меха'],
    'School': ['Школа'],
    'Harem': ['Гарем'],
    'Historical': ['Исторический'],
    'Military': ['Военное'],
    'Demons': ['Демоны'],
    'Martial Arts': ['Боевые искусства'],
    'Kids': ['Детское'],
    'Space': ['Космос'],
    'Vampire': ['Вампиры'],
    'Game': ['Игры'],
    'Police': ['Полиция'],
    'Samurai': ['Самураи'],
    'Super Power': ['Супер сила'],
    'Psychological Thriller': ['Психология', 'Триллер'],
    'Cars': ['Машины'],
    'Dementia': ['Безумие'],
    'Hentai': ['Хентай']
  };

  static async fetchGenresFromMyAnimeList(title: string): Promise<string[]> {
    try {
      const response = await fetch(
        `https://api.jikan.moe/v4/anime?q=${encodeURIComponent(title)}&limit=1`,
        {
          headers: {
            'User-Agent': 'AnimePlatform/2.0'
          }
        }
      );

      if (!response.ok) return [];

      const data: MyAnimeListResponse = await response.json();
      
      if (!data.data || data.data.length === 0) return [];

      const anime = data.data[0];
      if (!anime.node || !anime.node.genres) return [];

      const genres = anime.node.genres.map(g => g.name).filter(Boolean);
      return this.mapGenresToRussian(genres);
    } catch (error) {
      console.error('Error fetching genres from MyAnimeList:', error);
      return [];
    }
  }

  static async fetchGenresFromAnilist(title: string): Promise<string[]> {
    try {
      const query = `
        query ($search: String) {
          Media(search: $search, type: ANIME) {
            genres
          }
        }
      `;

      const response = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'AnimePlatform/2.0'
        },
        body: JSON.stringify({
          query,
          variables: { search: title }
        })
      });

      if (!response.ok) return [];

      const data: AnilistResponse = await response.json();
      
      if (!data.data?.Media?.genres) return [];

      return this.mapGenresToRussian(data.data.Media.genres);
    } catch (error) {
      console.error('Error fetching genres from Anilist:', error);
      return [];
    }
  }

  static async fetchGenresFromKitsu(title: string): Promise<string[]> {
    try {
      const response = await fetch(
        `https://api.kitsu.io/edge/anime?filter[text]=${encodeURIComponent(title)}&page[limit]=1`,
        {
          headers: {
            'Accept': 'application/vnd.api+json',
            'User-Agent': 'AnimePlatform/2.0'
          }
        }
      );

      if (!response.ok) return [];

      const data = await response.json();
      
      if (!data.data || data.data.length === 0) return [];

      const anime = data.data[0];
      const genres = anime.relationships?.genres?.data?.map((genre: any) => genre.attributes?.name).filter(Boolean) || [];
      
      return this.mapGenresToRussian(genres);
    } catch (error) {
      console.error('Error fetching genres from Kitsu:', error);
      return [];
    }
  }

  private static mapGenresToRussian(englishGenres: string[]): string[] {
    const russianGenres: string[] = [];

    for (const genre of englishGenres) {
      const mapped = this.GENRE_MAPPINGS[genre];
      if (mapped) {
        russianGenres.push(...mapped);
      } else {
        // Try to find partial matches or keep original if no mapping found
        const partialMatch = Object.keys(this.GENRE_MAPPINGS).find(key => 
          genre.toLowerCase().includes(key.toLowerCase()) || 
          key.toLowerCase().includes(genre.toLowerCase())
        );
        
        if (partialMatch) {
          russianGenres.push(...this.GENRE_MAPPINGS[partialMatch]);
        } else {
          // Keep original genre name if no mapping found
          russianGenres.push(genre);
        }
      }
    }

    // Remove duplicates and return
    return [...new Set(russianGenres)];
  }

  static async getFallbackGenres(title: string, originalTitle?: string): Promise<string[]> {
    const cacheKey = `${title}-${originalTitle || ''}`;
    
    // Check cache first
    const cached = GenreCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const titles = [title];
    if (originalTitle && originalTitle !== title) {
      titles.push(originalTitle);
    }

    // Helper function to create timeout promise
    const withTimeout = <T>(promise: Promise<T>, timeoutMs: number = 3000): Promise<T> => {
      return Promise.race([
        promise,
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), timeoutMs)
        )
      ]);
    };

    // Try different sources with timeouts for each title
    const promises = titles.map(t => [
      withTimeout(this.fetchGenresFromMyAnimeList(t)).catch(() => []),
      withTimeout(this.fetchGenresFromAnilist(t)).catch(() => []),
      // Skip Kitsu for now due to fetch failures
      // withTimeout(this.fetchGenresFromKitsu(t)).catch(() => [])
    ]).flat();

    try {
      const results = await Promise.allSettled(promises);
      const allGenres: string[] = [];

      for (const result of results) {
        if (result.status === 'fulfilled' && result.value.length > 0) {
          allGenres.push(...result.value);
        }
      }

      // Remove duplicates and cache the result
      const uniqueGenres = [...new Set(allGenres)];
      if (uniqueGenres.length > 0) {
        GenreCache.set(cacheKey, uniqueGenres);
      }
      
      return uniqueGenres;
    } catch (error) {
      console.error('Error in fallback genre fetching:', error);
      return [];
    }
  }

  // Synchronous version that returns cached genres or extracts from description
  static getFallbackGenresSync(title: string, originalTitle?: string, description?: string): string[] {
    const cacheKey = `${title}-${originalTitle || ''}`;
    
    // Check cache first
    const cached = GenreCache.get(cacheKey);
    if (cached) {
      return cached;
    }
    
    // Last resort: extract from description
    return this.extractGenresFromDescription(description || "");
  }

  static extractGenresFromDescription(description: string): string[] {
    if (!description) return [];

    const genreKeywords = [
      'экшен', 'боевик', 'приключения', 'комедия', 'драма', 'фэнтези', 'магия',
      'ужасы', 'детектив', 'тайна', 'романтика', 'фантастика', 'повседневность',
      'спорт', 'триллер', 'исекай', 'сёнэн', 'сэйнэн', 'сёдзё', 'дзёсэй',
      'музыка', 'психология', 'сверхъестественное', 'пародия', 'этти', 'меха',
      'школа', 'гарем', 'исторический', 'военное', 'демоны', 'боевые искусства',
      'детское', 'космос', 'вампиры', 'игры', 'полиция', 'самураи', 'супер сила'
    ];

    const foundGenres: string[] = [];
    const lowerDesc = description.toLowerCase();

    for (const keyword of genreKeywords) {
      if (lowerDesc.includes(keyword)) {
        foundGenres.push(keyword.charAt(0).toUpperCase() + keyword.slice(1));
      }
    }

    return [...new Set(foundGenres)];
  }
}
