"use server"

import { getPackById, type AnimePack } from "@/lib/gacha-packs"

const usedArtUrls = new Set<string>();
const characterArtCache = new Map<string, string[]>();

const RARITY_ORDER =[
  "trash", "common", "uncommon", "rare", "super_rare", "epic",
  "mythic", "legendary", "ancient", "divine", "transcendent", "omnipotent"
];

/**
 * УТИЛИТЫ ОЧИСТКИ И ФОРМАТИРОВАНИЯ
 */

// Умная генерация тегов персонажа (учитывает перестановку Имя/Фамилия)
function getCharacterTags(name: string): string[] {
  // Очищаем от скобок (например "Shinpachi Shimura (Child)")
  const clean = name.toLowerCase().replace(/\([^)]*\)/g, '').trim();
  // Оставляем только буквы и цифры
  const sanitized = clean.replace(/[^a-z0-9\s]/g, '').trim();
  const parts = sanitized.split(/\s+/);
  
  const tags =[];
  if (parts.length >= 2) {
    tags.push(`${parts[0]}_${parts[1]}`); // Прямой порядок (Имя_Фамилия)
    tags.push(`${parts[1]}_${parts[0]}`); // Японский порядок (Фамилия_Имя) - самый частый
    tags.push(parts[0]); // Только Имя (запасной)
  } else if (parts.length === 1 && parts[0]) {
    tags.push(parts[0]);
  }
  return tags;
}

// Очистка названия франшизы
function getCopyrightTag(animeName: string): string {
  // Убираем сезоны (после двоеточия), спецсимволы и берем основу
  const clean = animeName.toLowerCase().split(':')[0].replace(/[^a-z0-9\s]/g, ' ').trim();
  
  // Расширенный словарь популярных тайтлов
  const mapping: Record<string, string> = {
    'naruto': 'naruto',
    'one piece': 'one_piece',
    'bleach': 'bleach',
    'attack on titan': 'shingeki_no_kyojin',
    'shingeki no kyojin': 'shingeki_no_kyojin',
    'demon slayer': 'kimetsu_no_yaiba',
    'kimetsu no yaiba': 'kimetsu_no_yaiba',
    'jujutsu kaisen': 'jujutsu_kaisen',
    'my hero academia': 'boku_no_hero_academia',
    'boku no hero': 'boku_no_hero_academia',
    'chainsaw man': 'chainsaw_man',
    'evangelion': 'neon_genesis_evangelion',
    'fullmetal alchemist': 'fullmetal_alchemist',
    'death note': 'death_note',
    'code geass': 'code_geass',
    'steins gate': 'steins_gate',
    'tokyo ghoul': 'tokyo_ghoul',
    'hunter x hunter': 'hunter_x_hunter',
    'fairy tail': 'fairy_tail',
    'black clover': 'black_clover',
    'fate': 'fate_stay_night',
    'solo leveling': 'solo_leveling',
    're zero': 're_zero_kara_hajimeru_isekai_seikatsu',
    'sword art online': 'sword_art_online',
    'gintama': 'gintama',
    'kono suba': 'kono_subarashii_sekai_ni_shukufuku_wo',
    'konosuba': 'kono_subarashii_sekai_ni_shukufuku_wo',
    'mushoku tensei': 'mushoku_tensei',
    'no game no life': 'no_game_no_life',
    'one punch man': 'one_punch_man',
    'mob psycho': 'mob_psycho_100',
    'dragon ball': 'dragon_ball',
    'bocchi the rock': 'bocchi_the_rock',
    'dr stone': 'dr_stone',
    'spy x family': 'spy_x_family',
    'kaguya sama': 'kaguya_sama_wa_kokurasetai',
    'jojo': 'jojos_bizarre_adventure'
  };

  for (const [key, value] of Object.entries(mapping)) {
    if (clean.includes(key)) return value;
  }

  return clean.replace(/\s+/g, '_');
}

/**
 * УМНЫЙ ПОИСК АРТА
 */
async function fetchHighQualityArt(characterName: string, animeName: string): Promise<string | null> {
  const charTags = getCharacterTags(characterName);
  const seriesTag = getCopyrightTag(animeName);
  
  // 1. Проверка Кэша
  const cacheKey = `${characterName}_${animeName}`;
  if (characterArtCache.has(cacheKey)) {
    const cached = characterArtCache.get(cacheKey)!;
    const unused = cached.find(url => !usedArtUrls.has(url));
    if (unused) {
      usedArtUrls.add(unused);
      return unused;
    }
  }

  const validFoundUrls: string[] =[];

  // 2. Поиск по Danbooru
  // Мы используем формат tag_(series) + rating:g. Это ровно 2 тега, что проходит под лимиты анонимного API Danbooru!
  for (const charTag of charTags.slice(0, 2)) {
    try {
      const exactTag = `${charTag}_(${seriesTag})`;
      const query = encodeURIComponent(`${exactTag} rating:g`);
      const url = `https://danbooru.donmai.us/posts.json?tags=${query}&limit=10&order=score`;
      
      const res = await fetch(url, { cache: "no-store", headers: { "User-Agent": "AnimeGachaApp/1.0" } });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          for (const post of data) {
            const img = post.large_file_url || post.file_url;
            if (img) validFoundUrls.push(img);
          }
        }
      }
    } catch (e) {
      console.error("Danbooru exact error:", e);
    }
  }

  // 3. Поиск по Safebooru (если Danbooru не нашел)
  // Safebooru разрешает больше тегов, поэтому используем комбинацию Имя + Серия раздельно
  if (validFoundUrls.length === 0) {
    for (const charTag of charTags.slice(0, 2)) {
      try {
        const safeQuery = encodeURIComponent(`${charTag} ${seriesTag}`);
        const url = `https://safebooru.org/index.php?page=dapi&s=post&q=index&json=1&tags=${safeQuery}&limit=10`;
        
        const res = await fetch(url, { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            for (const post of data) {
              const img = `https://safebooru.org/images/${post.directory}/${post.image}`;
              validFoundUrls.push(img);
            }
          }
        }
      } catch (e) {
        console.error("Safebooru exact error:", e);
      }
    }
  }

  // 4. Широкий поиск Safebooru (крайний случай, только по имени персонажа)
  if (validFoundUrls.length === 0) {
    for (const charTag of charTags.slice(0, 2)) {
      try {
        const safeQuery = encodeURIComponent(charTag);
        const url = `https://safebooru.org/index.php?page=dapi&s=post&q=index&json=1&tags=${safeQuery}&limit=10`;
        const res = await fetch(url, { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            for (const post of data) {
              const img = `https://safebooru.org/images/${post.directory}/${post.image}`;
              validFoundUrls.push(img);
            }
          }
        }
      } catch(e) {
        // Пропускаем ошибки
      }
    }
  }

  // Сохраняем все найденные варианты в кэш и возвращаем первый свободный
  if (validFoundUrls.length > 0) {
    if (!characterArtCache.has(cacheKey)) {
      characterArtCache.set(cacheKey,[]);
    }
    characterArtCache.get(cacheKey)!.push(...validFoundUrls);

    const unused = validFoundUrls.find(url => !usedArtUrls.has(url));
    if (unused) {
      usedArtUrls.add(unused);
      return unused;
    }
  }

  return null;
}

// Конвертация картинки в Base64 для красивого рендеринга и обхода CORS
async function imageUrlToBase64(url: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!res.ok) return url;
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    return `data:${res.headers.get('content-type')};base64,${buffer.toString('base64')}`;
  } catch (e) {
    return url;
  }
}

/**
 * ГЕЙМПЛЕЙНАЯ ЛОГИКА
 */

function generateStats(rarity: string) {
  const index = RARITY_ORDER.indexOf(rarity);
  const baseMin = 5 + (index * 7);
  const baseMax = 25 + (index * 7);
  const roll = (min: number, max: number) => Math.min(Math.floor(Math.random() * (max - min + 1) + min), 100);

  return {
    hp: roll(baseMin, baseMax),
    atk: roll(baseMin, baseMax),
    def: roll(baseMin, baseMax),
    spd: roll(baseMin, baseMax),
    luck: roll(baseMin, baseMax)
  };
}

function calculateBaseRarity(score: number): string {
  if (score >= 8.8) return "mythic";
  if (score >= 8.3) return "epic";
  if (score >= 7.8) return "super_rare";
  if (score >= 7.2) return "rare";
  if (score >= 6.5) return "uncommon";
  if (score >= 5.5) return "common";
  return "trash";
}

export interface GachaResult {
  animeName: string;
  score: number;
  rarity: string;
  characterName: string;
  characterId: number;
  originalUrl: string | null;
  imageUrl: string | null;
  shikiId: number;
  stats: { hp: number; atk: number; def: number; spd: number; luck: number };
  isMainCharacter: boolean;
  packId?: string;
  packName?: string;
}

async function processCharacterData(anime: any, usedIds: number[]): Promise<GachaResult | null> {
  const score = parseFloat(anime.score || "0");
  
  const rolesRes = await fetch(`https://shikimori.one/api/animes/${anime.id}/roles`, {
    headers: { "User-Agent": "AnimeGachaApp/1.0" }
  });

  if (!rolesRes.ok) return null;
  const rolesData = await rolesRes.json();

  const available = rolesData
    .filter((r: any) => r.character && r.character.id && !usedIds.includes(r.character.id))
    .filter((r: any) => !r.character.image.original.includes('missing'));

  if (available.length === 0) return null;

  // Приоритет главным героям (с высоким шансом выбираем их)
  const mainChars = available.filter((r: any) => (r.roles ||[]).includes('Main') || (r.roles_ru ||[]).includes('Главный'));
  const selectedRole = (mainChars.length > 0 && Math.random() > 0.3)
    ? mainChars[Math.floor(Math.random() * mainChars.length)]
    : available[Math.floor(Math.random() * available.length)];

  const char = selectedRole.character;
  const isMain = (selectedRole.roles || []).includes('Main') || (selectedRole.roles_ru ||[]).includes('Главный');

  let rarity = calculateBaseRarity(score);
  if (isMain) {
    const idx = RARITY_ORDER.indexOf(rarity);
    rarity = RARITY_ORDER[Math.min(idx + 1, RARITY_ORDER.length - 1)];
  }

  // --- ПОДБОР АРТА ---
  let finalArtUrl: string | null = null;
  
  // Для ГГ всегда пытаемся найти кастомный арт. Для остальных - с шансом 30%.
  if (isMain || Math.random() > 0.7) {
    // ВАЖНО: Передаем АНГЛИЙСКИЕ/РОМАДЗИ имена для поиска по базе
    finalArtUrl = await fetchHighQualityArt(char.name, anime.name);
  }

  // Фолбэк на Shikimori, если арт не найден
  if (!finalArtUrl) {
    finalArtUrl = char.image.original.startsWith("/") 
      ? `https://shikimori.one${char.image.original}` 
      : char.image.original;
  }

  const base64 = await imageUrlToBase64(finalArtUrl);

  return {
    animeName: anime.russian || anime.name,
    score: score,
    rarity: rarity,
    characterName: char.russian || char.name, // На клиенте отображаем русское
    characterId: char.id,
    originalUrl: finalArtUrl,
    imageUrl: base64,
    shikiId: anime.id,
    stats: generateStats(rarity),
    isMainCharacter: isMain
  };
}

export async function rollAnimeCharacter(usedCharacterIds: number[] =[]): Promise<GachaResult | null> {
  try {
    const shikiRes = await fetch("https://shikimori.one/api/animes?limit=30&order=random&kind=tv,movie&score=6", {
      cache: "no-store",
      headers: { "User-Agent": "AnimeGachaApp/1.0" }
    });

    const data = await shikiRes.json();
    for (const anime of data) {
      const result = await processCharacterData(anime, usedCharacterIds);
      if (result) return result;
    }
    return null;
  } catch (e) {
    return null;
  }
}

export async function rollFromAnimePack(packId: string, usedCharacterIds: number[] =[]): Promise<GachaResult | null> {
  const pack = getPackById(packId);
  if (!pack) return null;

  const shuffledIds = [...pack.animeIds].sort(() => Math.random() - 0.5);
  for (const id of shuffledIds) {
    const res = await fetch(`https://shikimori.one/api/animes/${id}`);
    if (!res.ok) continue;
    const anime = await res.json();
    const result = await processCharacterData(anime, usedCharacterIds);
    if (result) {
      // Гарант редкости для паков
      if (pack.guaranteedRarity) {
         const gIdx = RARITY_ORDER.indexOf(pack.guaranteedRarity);
         const cIdx = RARITY_ORDER.indexOf(result.rarity);
         if (cIdx < gIdx) {
           result.rarity = pack.guaranteedRarity;
           result.stats = generateStats(result.rarity);
         }
      }
      return { ...result, packId, packName: pack.name };
    }
  }
  return null;
}