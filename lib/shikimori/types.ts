export interface ShikimoriAnime {
  id: number;
  name: string;
  russian: string;
  /**
   * Shikimori отдаёт альтернативные названия МАССИВОМ строк
   * (`english: ["Attack on Titan"]`), иногда там несколько вариантов.
   * В Anime (см. ниже) поля уже нормализованы в одну строку в transformAnime.
   */
  english?: string | string[];
  japanese?: string | string[];
  image: {
    original: string;
    preview: string;
    x96?: string;
    x48?: string;
  };
  score: string;
  episodes: number;
  episodes_aired: number;
  status: string;
  aired_on: string;
  kind: string;
  rating: string; // Важно для фильтрации хентая
  description?: string;
  genres?: { id: number; name: string; russian: string }[];
}

export interface Anime {
  id: string;
  shikimoriId: string;
  title: string;
  originalTitle: string;
  poster: string;
  backdrop?: string;
  rating: number;
  year: number;
  airedOn?: string;
  episodesCurrent: number;
  episodesTotal: number;
  status: string;
  description: string;
  genres: string[];
  quality: string;
  /**
   * Поля ниже нужны SEO-разметке страницы /watch (alternateName, @type),
   * возрастной фильтрации и определению хентая. Раньше transformAnime их
   * выбрасывал, из-за чего `anime.english`/`anime.japanese`/`anime.kind`
   * всегда были undefined, а детектор хентая никогда не срабатывал по рейтингу.
   */
  russian?: string;
  /** Английское название одной строкой (массив из Shikimori нормализует transformAnime). */
  english?: string;
  /** Японское название одной строкой (массив из Shikimori нормализует transformAnime). */
  japanese?: string;
  /** Тип из Shikimori: tv | movie | ova | ona | special | music */
  kind?: string;
  /** Исходный строковый рейтинг Shikimori: g | pg | pg_13 | r | r_plus | rx */
  shikimoriRating?: string;
  /** true, если тайтл помечен как NSFW (r_plus/rx или жанры 12/33/34) */
  isNsfw?: boolean;
}

export interface RecommendationReason {
  strategy: 'similar' | 'trending';
  sourceAnime?: string;
  score: number;
  factors: string[];
}

export interface CatalogFilters {
  page?: number;
  limit?: number;
  order?: string;
  genre?: string | string[];
  status?: string;
  kind?: string;
  year?: string | string[];
  score?: string;
  search?: string;
  allowNsfw?: boolean;
  enableGenreFallback?: boolean;
  disableExternalAPIs?: boolean;
}

export interface LinkedAnime {
  id: number;
  name: string;
  russian: string;
  image?: { original?: string; preview?: string; x96?: string; x48?: string };
  url?: string;
  kind?: string;
  score?: string;
  status?: string;
  episodes?: number;
}

export interface NewsItem {
  id: string;
  title: string;
  excerpt: string;
  imageUrl?: string;
  date: string;
  author: string;
  comments: number;
  url: string;
  htmlBody?: string;
  htmlFooter?: string;
  linkedAnime?: LinkedAnime;
}

export interface FranchiseItem {
  id: string;
  title: string;
  originalTitle?: string;
  /** Название, из которого строится ЧПУ страницы (russian || name, как в transformAnime). */
  canonicalTitle?: string;
  poster: string;
  year?: number;
  kind?: string;
  weight: number;
  isCurrent: boolean;
}

export interface WeeklySchedule {
  [dayIndex: number]: Anime[];
}