// lib/gacha-packs.ts

import { searchAnime } from "./shikimori/api";

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
    guaranteedRarity: "rare"
  },
  {
    id: "one_piece",
    name: "One Piece",
    description: "Пираты и сокровища Великого морского пути",
    // Основной сериал и популярные фильмы (Red, Stampede, Gold)
    animeIds: [21, 41433, 38234, 31490],
    price: 150,
    color: "from-orange-500 to-red-700"
  },
  {
    id: "naruto",
    name: "Naruto",
    description: "Ниндзя и их техники из скрытых деревень",
    // Наруто (1 сезон), Шиппуден, Боруто
    animeIds: [20, 1735, 34566],
    price: 130,
    color: "from-orange-400 to-blue-600",
    guaranteedRarity: "uncommon"
  },
  {
    id: "my_hero_academia",
    name: "Моя Геройская Академия",
    description: "Студенты герои и их уникальные способности",
    // S1, S2, S3, S4, S5, S6
    animeIds: [31964, 34572, 36956, 40022, 42897, 49918],
    price: 110,
    color: "from-green-500 to-blue-600"
  },
  {
    id: "death_note",
    name: "Тетрадь Смерти",
    description: "Битва умов между светом и тьмой",
    animeIds: [1535],
    price: 90,
    color: "from-black to-gray-800",
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
    guaranteedRarity: "epic"
  },
  {
    id: "evangelion",
    name: "Евангелион",
    description: "Пилоты Евы и апокалиптическая битва",
    // Сериал, End of Evangelion, Rebuild 1.11
    animeIds: [30, 32, 2759],
    price: 140,
    color: "from-green-600 to-purple-800",
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

// Создание кастомного пака из найденных аниме
export function createCustomPack(query: string, animeResults: ShikimoriAnimeResult[]): CustomAnimePack {
  const animeIds = animeResults.map(anime => anime.id);
  const validScores = animeResults.map(a => a.score).filter((s): s is number => typeof s === 'number');
  const topScore = validScores.length > 0 ? Math.max(...validScores) : 0;
  
  // Берем название первого аниме для названия пака
  const primaryAnime = animeResults[0];
  const packName = primaryAnime?.russian || primaryAnime?.name || query;
  
  // Динамическая цена на основе среднего рейтинга найденных аниме (x3 для кастомных паков)
  const avgScore = validScores.length > 0 
    ? validScores.reduce((sum, s) => sum + s, 0) / validScores.length 
    : 0;
  const price = Math.max(150, Math.min(600, Math.floor(avgScore * 60)));
  
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
    description: `Кастомный пак из ${animeResults.length} аниме по запросу "${query}"`,
    animeIds,
    price,
    color,
    guaranteedRarity,
    isCustom: true,
    searchQuery: query,
    createdAt: Date.now()
  };
}