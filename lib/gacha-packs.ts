// lib/gacha-packs.ts

import { searchAnime } from "./shikimori/api";
import { getAnimeCatalog } from "./shikimori/api";

export interface AnimePack {
  id: string
  name: string
  description: string
  animeIds: number[]
  price: number
  color: string
  bgImage?: string
  guaranteedRarity?: string
  isCustom?: boolean
}

export interface CustomAnimePack extends AnimePack {
  isCustom: true
  searchQuery: string
  createdAt: number
}

export interface ShikimoriAnimeResult {
  id: number
  name: string
  russian: string | null
  score: number | null
  kind: string
  episodes: number
  status: string
  image: {
    original: string
  }
}

export const ANIME_PACKS: AnimePack[] = [
  {
    id: "attack_on_titan",
    name: "Атака Титанов",
    description: "Персонажи из мира борьбы за выживание человечества",
    // По порядку: S1, S2, S3, S3 P2, Final Season, Final Part 2
    animeIds: [16498, 25777, 35760, 38524, 40028, 48583],
    price: 100,
    color: "from-slate-700 to-slate-900",
    bgImage: "https://shikimori.one/system/animes/original/16498.jpg",
    guaranteedRarity: "rare"
  },
  {
    id: "demon_slayer",
    name: "Истребитель Демонов",
    description: "Воины ночи и их легендарные клинки",
    // S1, Movie, TV version Mugen Train, Yuukaku-hen, Katanakaji no Sato-hen
    animeIds: [38000, 40417, 49926, 43656, 51019],
    price: 120,
    color: "from-red-600 to-pink-800",
    bgImage: "https://shikimori.one/system/animes/original/38000.jpg",
    guaranteedRarity: "rare"
  },
  {
    id: "one_piece",
    name: "One Piece",
    description: "Пираты и сокровища Великого морского пути",
    // Основной сериал и популярные фильмы (Red, Stampede, Gold)
    animeIds: [21, 41433, 38234, 31490],
    price: 150,
    color: "from-orange-500 to-red-700",
    bgImage: "https://shikimori.one/system/animes/original/21.jpg"
  },
  {
    id: "naruto",
    name: "Naruto",
    description: "Ниндзя и их техники из скрытых деревень",
    // Наруто (1 сезон), Шиппуден, Боруто
    animeIds: [20, 1735, 34566],
    price: 130,
    color: "from-orange-400 to-blue-600",
    bgImage: "https://shikimori.one/system/animes/original/20.jpg",
    guaranteedRarity: "uncommon"
  },
  {
    id: "my_hero_academia",
    name: "Моя Геройская Академия",
    description: "Студенты герои и их уникальные способности",
    // S1, S2, S3, S4, S5, S6
    animeIds: [31964, 34572, 36956, 40022, 42897, 49918],
    price: 110,
    color: "from-green-500 to-blue-600",
    bgImage: "https://shikimori.one/system/animes/original/31964.jpg"
  },
  {
    id: "death_note",
    name: "Тетрадь Смерти",
    description: "Битва умов между светом и тьмой",
    animeIds: [1535],
    price: 90,
    color: "from-black to-gray-800",
    bgImage: "https://shikimori.one/system/animes/original/1535.jpg",
    guaranteedRarity: "epic"
  },
  {
    id: "steins_gate",
    name: "Врата;Штейна",
    description: "Путешествия во времени и параллельные миры",
    // Оригинал и Steins;Gate 0
    animeIds: [9253, 30484],
    price: 85,
    color: "from-blue-800 to-purple-900",
    bgImage: "https://shikimori.one/system/animes/original/9253.jpg",
    guaranteedRarity: "super_rare"
  },
  {
    id: "tokyo_ghoul",
    name: "Токийский Гуль",
    description: "Двойная жизнь между людьми и гулями",
    // S1, Root A, Re, Re 2nd Season
    animeIds: [22319, 27899, 36511, 37785],
    price: 95,
    color: "from-purple-700 to-black",
    bgImage: "https://shikimori.one/system/animes/original/22319.jpg",
    guaranteedRarity: "rare"
  },
  {
    id: "fullmetal_alchemist",
    name: "Стальной Алхимик",
    description: "Алхимия и цена человеческой амбиции",
    // Brotherhood и оригинал 2003
    animeIds: [5114, 121],
    price: 100,
    color: "from-red-600 to-blue-800",
    bgImage: "https://shikimori.one/system/animes/original/5114.jpg",
    guaranteedRarity: "epic"
  },
  {
    id: "evangelion",
    name: "Евангелион",
    description: "Пилоты Евы и апокалиптическая битва",
    // Сериал, End of Evangelion, Rebuild 1.11
    animeIds: [30, 32],
    price: 140,
    color: "from-green-600 to-purple-800",
    bgImage: "https://shikimori.one/system/animes/original/30.jpg",
    guaranteedRarity: "legendary"
  },
  {
    id: "main_characters_2000_2010",
    name: "Главные герои 2000-2010",
    description: "Легендарные главные герои золотой эры аниме 2000-2010 годов",
    animeIds: [], // Будет заполнено динамически через API
    price: 3000,
    color: "from-indigo-600 to-purple-700",
    guaranteedRarity: "epic"
  },
  {
    id: "main_characters_2010_2020",
    name: "Главные герои 2010-2020",
    description: "Популярные главные герои эры 2010-2020 годов",
    animeIds: [], // Будет заполнено динамически через API
    price: 3000,
    color: "from-cyan-600 to-blue-700",
    guaranteedRarity: "super_rare"
  },
  {
    id: "main_characters_2015_2026",
    name: "Главные герои 2015-2026",
    description: "Современные главные герои с 2015 по текущий 2026 год",
    animeIds: [], // Будет заполнено динамически через API
    price: 3000,
    color: "from-rose-600 to-pink-700",
    guaranteedRarity: "legendary"
  }
];

export function getPackById(id: string): AnimePack | undefined {
  return ANIME_PACKS.find(pack => pack.id === id);
}

export function searchPacksByTitle(query: string): AnimePack[] {
  if (!query.trim()) return [];

  const normalizedQuery = query.toLowerCase().trim();

  return ANIME_PACKS.filter(pack => {
    const normalizedName = pack.name.toLowerCase();
    const normalizedDescription = pack.description.toLowerCase();
    const normalizedId = pack.id.toLowerCase();

    // Поиск по названию, описанию и ID
    return (
      normalizedName.includes(normalizedQuery) ||
      normalizedDescription.includes(normalizedQuery) ||
      normalizedId.includes(normalizedQuery)
    );
  });
}

// Поиск аниме через Shikimori API по названию (использует умный поиск как на сайте)
export async function searchAnimeByTitle(query: string): Promise<ShikimoriAnimeResult[]> {
  if (!query.trim()) return [];

  try {
    // Используем ту же функцию поиска, что и на сайте
    const searchResults = await searchAnime(query, false, false);
    
    // Конвертируем результаты в формат ShikimoriAnimeResult
    return searchResults.map(anime => ({
      id: parseInt(anime.shikimoriId), // Преобразуем строку в число
      name: anime.originalTitle || anime.title,
      russian: anime.title,
      score: anime.rating,
      kind: anime.quality,
      episodes: anime.episodesTotal || 0,
      status: anime.status,
      image: {
        original: anime.poster
      }
    }));
  } catch (error) {
    console.error("Shikimori search error:", error);
    return [];
  }
}

// Создание кастомного набора из найденных аниме
export function createCustomPack(query: string, animeResults: ShikimoriAnimeResult[]): CustomAnimePack {
  const animeIds = animeResults.map(anime => anime.id);
  const validScores = animeResults.map(a => a.score).filter((s): s is number => typeof s === 'number');
  const topScore = validScores.length > 0 ? Math.max(...validScores) : 0;
  
  // Берем название первого аниме для названия набора
  const primaryAnime = animeResults[0];
  const packName = primaryAnime?.russian || primaryAnime?.name || query;
  
  // Базовая цена 2000 для кастомных наборов + динамическая надбавка за рейтинг
  const avgScore = validScores.length > 0 
    ? validScores.reduce((sum, s) => sum + s, 0) / validScores.length 
    : 0;
  const ratingBonus = Math.max(0, Math.min(1000, Math.floor(avgScore * 100)));
  const price = 2000 + ratingBonus;
  
  // Динамическая редкость на основе СРЕДНЕГО рейтинга (унификация с заголовком)
  let guaranteedRarity: string | undefined;
  if (avgScore >= 8.5) guaranteedRarity = "epic";
  else if (avgScore >= 7.5) guaranteedRarity = "super_rare";
  else if (avgScore >= 6.5) guaranteedRarity = "rare";
  
  // Градиент на основе среднего рейтинга
  const color = avgScore >= 8 
    ? "from-amber-500 to-orange-600" 
    : avgScore >= 7 
      ? "from-purple-500 to-pink-600" 
      : "from-slate-500 to-gray-600";

  return {
    id: `custom_${Date.now()}`,
    name: packName,
    description: `Кастомный набор из ${animeResults.length} аниме по запросу "${query}" (база: 2000 + бонус за рейтинг)`,
    animeIds,
    price,
    color,
    guaranteedRarity,
    isCustom: true,
    searchQuery: query,
    createdAt: Date.now()
  };
}

// Поиск аниме по годовому диапазону
export async function getAnimeByYearRange(startYear: number, endYear: number, limit: number = 50): Promise<number[]> {
  try {
    // Используем year параметр для поиска по диапазону лет
    const yearRange = `${startYear}_${endYear}`;
    const animeList = await getAnimeCatalog({
      year: yearRange,
      limit: limit,
      order: 'ranked',
      score: '7', // Только аниме с рейтингом 7+
      disableExternalAPIs: true // Отключаем внешние API для гача
    });
    
    // Возвращаем только ID аниме
    return animeList.map(anime => parseInt(anime.shikimoriId));
  } catch (error) {
    console.error(`Error fetching anime for years ${startYear}-${endYear}:`, error);
    return [];
  }
}

// Динамическое заполнение наборетов по годам
export async function loadYearBasedPacks(): Promise<void> {
  try {
    // Заполняем набори аниме ID по годовым диапазонам
    const pack2000_2010 = ANIME_PACKS.find(pack => pack.id === "main_characters_2000_2010");
    const pack2010_2020 = ANIME_PACKS.find(pack => pack.id === "main_characters_2010_2020");
    const pack2015_2026 = ANIME_PACKS.find(pack => pack.id === "main_characters_2015_2026");

    if (pack2000_2010) {
      pack2000_2010.animeIds = await getAnimeByYearRange(2000, 2010, 40);
    }

    if (pack2010_2020) {
      pack2010_2020.animeIds = await getAnimeByYearRange(2010, 2020, 40);
    }

    if (pack2015_2026) {
      pack2015_2026.animeIds = await getAnimeByYearRange(2015, 2026, 40);
    }
  } catch (error) {
    console.error("Error loading year-based packs:", error);
  }
}