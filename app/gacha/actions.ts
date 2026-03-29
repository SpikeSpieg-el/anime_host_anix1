"use server"

import { getPackById, searchPacksByTitle, searchAnimeByTitle, createCustomPack, type AnimePack, type CustomAnimePack } from "@/lib/gacha-packs"

const characterArtCache = new Map<string, string[]>();

const RARITY_ORDER = [
  "trash", "common", "uncommon", "rare", "super_rare", "epic",
  "mythic", "legendary", "ancient", "divine", "transcendent", "omnipotent"
];

/**
 * УТИЛИТЫ ОЧИСТКИ И ФОРМАТИРОВАНИЯ
 */

// Умная генерация тегов персонажа (поддержка японских имен и транслитерации)
function getCharacterTags(name: string): string[] {
  // Берем только английскую часть, если есть слэш (на Шикимори формат "Штарк / Stark")
  const engName = name.includes('/') ? name.split('/')[1] : name;
  
  // Очищаем от скобок и оставляем ТОЛЬКО латинские буквы
  const clean = engName.toLowerCase().replace(/\([^)]*\)/g, '').replace(/[^a-z\s]/g, '').trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  
  const tags = [];
  if (parts.length >= 2) {
    tags.push(`${parts[0]}_${parts[1]}`); // Stark_Frieren (если так введено)
    tags.push(`${parts[1]}_${parts[0]}`); // Фамилия_Имя (чаще всего на Booru)
    tags.push(parts[0]); 
  } else if (parts.length === 1 && parts[0]) {
    tags.push(parts[0]);
  }
  
  // Если теги не сгенерировались (например, из-за русского имени), пробуем маппинги
  if (tags.length === 0) {
    const nameMappings: Record<string, string[]> = {
      'рюко матой': ['ryuko_matoi', 'matoi_ryuko'],
      'сацуки кирюин': ['satsuki_kiryuin', 'kiryuin_satsuki'],
      'мако манканшок': ['mako_mankanshoku', 'mankanshoku_mako'],
      'аикуро микисуги': ['aikuro_mikisugi', 'mikisugi_aikuro'],
      'узумаки наруто': ['naruto_uzumaki', 'uzumaki_naruto'],
      'учиха саске': ['sasuke_uchiha', 'uchiha_sasuke'],
      'харuno сакура': ['sakura_haruno', 'haruno_sakura'],
      'эрен егер': ['eren_yeager', 'yeager_eren'],
      'микаса аккерман': ['mikasa_ackerman', 'ackerman_mikasa'],
      'армин арлерт': ['armin_arlert', 'arlert_armin']
    };
    
    const lowerName = name.toLowerCase();
    for (const [key, values] of Object.entries(nameMappings)) {
      if (lowerName.includes(key)) {
        tags.push(...values);
        break;
      }
    }
  }
  
  return tags;
}

// Очистка названия франшизы для поиска тега серии
function getCopyrightTag(animeName: string): string {
  const engName = animeName.includes('/') ? animeName.split('/')[1] : animeName;
  const clean = engName.toLowerCase().split(':')[0].replace(/[^a-z0-9\s]/g, ' ').trim();
  
  const mapping: Record<string, string> = {
    'naruto': 'naruto',
    'one piece': 'one_piece',
    'bleach': 'bleach',
    'attack on titan': 'shingeki_no_kyojin',
    'shingeki no kyojin': 'shingeki_no_kyojin',
    'demon slayer': 'kimetsu_no_yaiba',
    'kimetsu no yaiba': 'kimetsu_no_yaiba',
    'frieren': 'sousou_no_frieren',
    'sousou no frieren': 'sousou_no_frieren',
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
    'fate': 'fate_stay_night',
    're zero': 're_zero_kara_hajimeru_isekai_seikatsu',
    'sword art online': 'sword_art_online',
    'gintama': 'gintama',
    'konosuba': 'kono_subarashii_sekai_ni_shukufuku_wo',
    'mushoku tensei': 'mushoku_tensei',
    'one punch man': 'one_punch_man',
    'jojo': 'jojos_bizarre_adventure',
    'kill la kill': 'kill_la_kill',
    'убей или умри': 'kill_la_kill'
  };

  for (const [key, value] of Object.entries(mapping)) {
    if (clean.includes(key)) return value;
  }
  return clean.replace(/\s+/g, '_');
}

/**
 * УЛУЧШЕННЫЙ ПОИСК АРТА С УЧЕТОМ ЧЕРНОГО СПИСКА
 */
async function fetchHighQualityArt(characterName: string, animeName: string, ignoredUrls: string[]): Promise<string | null> {
  const charTags = getCharacterTags(characterName);
  const seriesTag = getCopyrightTag(animeName);
  console.log(`[Art Search] Character: ${characterName}, Generated tags: [${charTags.join(', ')}], Series tag: ${seriesTag}`);
  if (charTags.length === 0) return null;

  const cacheKey = `${charTags[0]}_${seriesTag}`;
  let pool: string[] = characterArtCache.get(cacheKey) || [];

  if (pool.length === 0) {
    try {
      // ИСПОЛЬЗУЕМ SAFEBOORU КАК ОСНОВНОЙ (он лоялен к хотлинку)
      // Пробуем разные комбинации тегов для лучших результатов
      const tagCombinations = [
        seriesTag + ' ' + charTags[0],  // Аниме + персонаж
        charTags[0],                    // Только персонаж
        seriesTag,                      // Только аниме
      ];
      
      // Если есть несколько тегов персонажа, пробуем их все
      if (charTags.length > 1) {
        tagCombinations.push(seriesTag + ' ' + charTags[1]);
        tagCombinations.push(charTags[1]);
      }
      
      for (const tags of tagCombinations) {
        console.log(`[Safebooru Search] Character: ${characterName}, Anime: ${animeName}, Tags: ${tags}`);
        const sRes = await fetch(`https://safebooru.org/index.php?page=dapi&s=post&q=index&json=1&tags=${encodeURIComponent(tags)}&limit=20`);
        if (sRes.ok) {
          const sText = await sRes.text();
          console.log(`[Safebooru Response] Length: ${sText.length}, Preview: ${sText.substring(0, 200)}`);
          if (sText.trim()) {
            try {
              const sData = JSON.parse(sText);
              if (Array.isArray(sData) && sData.length > 0) {
                sData.forEach((p: any) => {
                  if (p.directory && p.image) {
                    // Формируем прямую ссылку
                    pool.push(`https://safebooru.org/images/${p.directory}/${p.image}`);
                  }
                });
                break; // Нашли результаты, выходим из цикла
              }
            } catch (jsonError) {
              console.log("Safebooru JSON parse error, response length:", sText.length, jsonError);
              // Safebooru иногда возвращает XML вместо JSON, пробуем парсить как текст
            }
          } else {
            console.log("Safebooru returned empty response for tags:", tags);
          }
        } else {
          console.log(`Safebooru HTTP error: ${sRes.status} ${sRes.statusText} for tags: ${tags}`);
        }
        
        // Если нашли результаты, не продолжаем поиск
        if (pool.length > 0) break;
      }

      // Если на Safebooru пусто, пробуем Danbooru, но берем только "sample" или "preview" (они реже блокируются)
      if (pool.length === 0) {
        try {
          const dRes = await fetch(`https://danbooru.donmai.us/posts.json?tags=${encodeURIComponent(charTags[0] + ' ' + seriesTag)}&limit=10&order=score`);
          if (dRes.ok) {
            const dData = await dRes.json();
            if (Array.isArray(dData)) {
              dData.forEach((p: any) => {
                // Берем large_file_url вместо original, он чаще доступен
                const url = p.large_file_url || p.file_url;
                if (url) pool.push(url);
              });
            }
          }
        } catch (danbooruError) {
          console.log("Danbooru fetch error for", charTags[0], seriesTag, ":", danbooruError);
        }
      }
      
      characterArtCache.set(cacheKey, pool);
    } catch (e) { 
      console.error("Art fetch error for", charTags[0], seriesTag, ":", e); 
    }
  }

  const filteredPool = pool.filter(url => !ignoredUrls.includes(url));
  if (filteredPool.length > 0) {
    return filteredPool[Math.floor(Math.random() * Math.min(filteredPool.length, 5))];
  }
  return null;
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

function calculateRarityWithBoost(score: number, boostPercent: number = 0): string {
  let rarity = calculateBaseRarity(score);
  
  if (boostPercent > 0 && Math.random() < boostPercent) {
    const currentIndex = RARITY_ORDER.indexOf(rarity);
    if (currentIndex < RARITY_ORDER.length - 1) {
      rarity = RARITY_ORDER[currentIndex + 1];
    }
  }
  
  return rarity;
}

export interface GachaResult {
  animeName: string;
  score: number;
  rarity: string;
  characterName: string;
  characterId: number;
  originalUrl: string;
  imageUrl: string;
  shikiId: number;
  stats: { hp: number; atk: number; def: number; spd: number; luck: number };
  isMainCharacter: boolean;
  packId?: string;
  packName?: string;
}

async function processCharacterData(anime: any, usedIds: number[], ignoredUrls: string[], rarityBoost: number = 0): Promise<GachaResult | null> {
  const score = parseFloat(anime.score || "0");
  const rolesRes = await fetch(`https://shikimori.one/api/animes/${anime.id}/roles`);
  if (!rolesRes.ok) return null;
  const rolesData = await rolesRes.json();

  const available = rolesData
    .filter((r: any) => r.character && r.character.id && !usedIds.includes(r.character.id))
    .filter((r: any) => !r.character.image.original.includes('missing'));

  if (available.length === 0) return null;

  const mainChars = available.filter((r: any) => (r.roles || []).includes('Main') || (r.roles_ru || []).includes('Главный'));
  const selectedRole = (mainChars.length > 0 && Math.random() > 0.9)
    ? mainChars[Math.floor(Math.random() * mainChars.length)]
    : available[Math.floor(Math.random() * available.length)];

  const char = selectedRole.character;
  const isMain = (selectedRole.roles || []).includes('Main') || (selectedRole.roles_ru || []).includes('Главный');

  let rarity = calculateRarityWithBoost(score, rarityBoost);

  const originalShikiUrl = char.image.original.startsWith("/") 
    ? `https://shikimori.one${char.image.original}` 
    : char.image.original;

  // Ищем фан-арт только для главных персонажей
  let fanArt: string | null = null;
  if (isMain) {
    fanArt = await fetchHighQualityArt(char.name, anime.name, ignoredUrls);
  }

  return {
    animeName: anime.russian || anime.name,
    score: score,
    rarity: rarity,
    characterName: char.russian || char.name, 
    characterId: char.id,
    originalUrl: originalShikiUrl, // Всегда храним официальный
    imageUrl: fanArt || originalShikiUrl, // Фан-арт только для главных, иначе официальный
    shikiId: anime.id,
    stats: generateStats(rarity),
    isMainCharacter: isMain
  };
}

export async function rollAnimeCharacter(usedCharacterIds: number[] = [], ignoredUrls: string[] = []): Promise<GachaResult | null> {
  try {
    const shikiRes = await fetch("https://shikimori.one/api/animes?limit=20&order=random&kind=tv&score=7", { cache: "no-store" });
    const data = await shikiRes.json();
    for (const anime of data) {
      const result = await processCharacterData(anime, usedCharacterIds, ignoredUrls, 0);
      if (result) {
        // Для главных героев повышаем редкость на +1 уровень
        if (result.isMainCharacter) {
          const currentRarityIndex = RARITY_ORDER.indexOf(result.rarity);
          const boostedRarity = RARITY_ORDER[Math.min(currentRarityIndex + 1, RARITY_ORDER.length - 1)];
          result.rarity = boostedRarity;
          result.stats = generateStats(boostedRarity);
        }
        return result;
      }
    }
    return null;
  } catch (e) { return null; }
}

export async function rollFromAnimePack(pack: AnimePack, usedCharacterIds: number[] = [], ignoredUrls: string[] = []): Promise<GachaResult | null> {
  const shuffledIds = [...pack.animeIds].sort(() => Math.random() - 0.5);
  
  // Определяем, будет ли это гарантированная карточка (20% шанс)
  const isGuaranteedRoll = pack.guaranteedRarity && Math.random() < 0.2;
  
  for (const id of shuffledIds) {
    const res = await fetch(`https://shikimori.one/api/animes/${id}`);
    if (!res.ok) continue;
    const anime = await res.json();
    
    // Если это гарантированный ролл, применяем гарантию
    const rarityBoost = isGuaranteedRoll ? 0 : 0.2; // 20% буст для обычных карточек
    const result = await processCharacterData(anime, usedCharacterIds, ignoredUrls, rarityBoost);
    
    if (result) {
      // Если это гарантированный ролл, применяем гарантию
      if (isGuaranteedRoll && pack.guaranteedRarity) {
        result.rarity = pack.guaranteedRarity;
        result.stats = generateStats(result.rarity);
      }
      
      // Затем для главных героев повышаем на 1 уровень выше
      if (result.isMainCharacter) {
        const currentRarityIndex = RARITY_ORDER.indexOf(result.rarity);
        const boostedRarity = RARITY_ORDER[Math.min(currentRarityIndex + 1, RARITY_ORDER.length - 1)];
        result.rarity = boostedRarity;
        result.stats = generateStats(boostedRarity);
      }
      
      return { ...result, packId: pack.id, packName: pack.name };
    }
  }
  return null;
}

export async function searchGachaPacks(query: string): Promise<AnimePack[]> {
  return searchPacksByTitle(query);
}

export interface CustomPackSearchResult {
  customPack: CustomAnimePack
  foundAnime: Array<{ id: number; name: string; russian: string | null; score: number | null; imageUrl: string }>
}

export async function createCustomGachaPack(query: string): Promise<CustomPackSearchResult | null> {
  if (!query.trim()) return null;
  try {
    const animeResults = await searchAnimeByTitle(query);
    if (animeResults.length === 0) return null;
    const customPack = createCustomPack(query, animeResults);
    const foundAnime = animeResults.map(anime => ({
      id: anime.id,
      name: anime.name,
      russian: anime.russian,
      score: anime.score,
      imageUrl: anime.image.original
    }));
    return { customPack, foundAnime };
  } catch (error) { return null; }
}