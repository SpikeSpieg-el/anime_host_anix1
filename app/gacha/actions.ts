"use server"

import { getPackById, searchPacksByTitle, searchAnimeByTitle, createCustomPack, type AnimePack, type CustomAnimePack } from "@/lib/gacha-packs"
import { fetchHighQualityArt, getAvailableArtCount, clearArtCache } from "./art-sources"

const RARITY_ORDER = [
  "trash", "common", "uncommon", "rare", "super_rare", "epic",
  "mythic", "legendary", "ancient", "divine", "transcendent", "omnipotent"
];

/**
 * ГЕЙМПЛЕЙНАЯ ЛОГИКА
 */

function generateStats(rarity: string) {
  const index = RARITY_ORDER.indexOf(rarity);
  
  // Базовые значения для каждой редкости
  const baseMinTable = [5, 12, 19, 26, 33, 40, 47, 54, 62, 72, 82, 90];
  const baseMaxTable = [25, 32, 39, 46, 53, 60, 67, 74, 82, 90, 96, 100];
  
  const baseMin = baseMinTable[index] || 5;
  const baseMax = baseMaxTable[index] || 25;
  
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

function calculateRarityWithBoost(score: number, isMainCharacter: boolean = false): string {
  let rarity = calculateBaseRarity(score);
  let boostApplied = 0;

  // 🎰 БУСТ 1: Легендарный рейтинг (9.0+) — шанс на +1-2 уровня
  if (score >= 9.0) {
    const legendaryRoll = Math.random();
    if (legendaryRoll < 0.03) { // 3% шанс на +2 уровня (divine+)
      boostApplied += 2;
      console.log(`[RarityBoost] LEGENDARY 9.0+ score triggered +2 boost!`);
    } else if (legendaryRoll < 0.10) { // 7% шанс на +1 уровень
      boostApplied += 1;
      console.log(`[RarityBoost] LEGENDARY 9.0+ score triggered +1 boost`);
    }
  }
  // 🎰 БУСТ 2: Очень высокий рейтинг (8.5-8.9) — шанс на +1 уровень
  else if (score >= 8.5) {
    if (Math.random() < 0.08) { // 8% шанс
      boostApplied += 1;
      console.log(`[RarityBoost] HIGH 8.5+ score triggered +1 boost`);
    }
  }

  // 🎭 БУСТ 3: Главный персонаж — всегда +1 уровень (стекается)
  if (isMainCharacter) {
    boostApplied += 1;
    console.log(`[RarityBoost] Main Character +1 boost`);
  }

  // 🍀 БУСТ 4: Случайная удача (1% шанс на любой карте)
  if (Math.random() < 0.01) {
    boostApplied += 1;
    console.log(`[RarityBoost] LUCKY 1% chance +1 boost!`);
  }

  // 🌟 БУСТ 5: Божественное провидение (0.1% = 1 к 1000)
  if (Math.random() < 0.001) {
    boostApplied += 3;
    console.log(`[RarityBoost] ✨ DIVINE PROVIDENCE 0.1% +3 boost!`);
  }

  // 💫 БУСТ 6: Абсолютная удача (0.01% = 1 к 10000)
  if (Math.random() < 0.0001) {
    boostApplied += 5;
    console.log(`[RarityBoost] 💫 ABSOLUTE LUCK 0.01% JACKPOT +5 boost!`);
  }

  // Применяем все бусты
  if (boostApplied > 0) {
    const currentIndex = RARITY_ORDER.indexOf(rarity);
    const newIndex = Math.min(currentIndex + boostApplied, RARITY_ORDER.length - 1);
    rarity = RARITY_ORDER[newIndex];
    console.log(`[RarityBoost] Total boost: +${boostApplied}, final rarity: ${rarity}`);
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
  allFanArtBanned?: boolean; // Флаг: все фан-арты забанены
  packId?: string;
  packName?: string;
}

async function processCharacterData(
  anime: any,
  usedIds: number[],
  ignoredUrls: string[],
  expandPool: boolean = false,
  forceMainCharacter: boolean = false  // true если должны выпадать только главные герои
): Promise<GachaResult | null> {
  const score = parseFloat(anime.score || "0");
  console.log(`[processCharacterData] Processing anime: ${anime.name} (ID: ${anime.id}), score: ${score}, expandPool: ${expandPool}`);

  const rolesRes = await fetch(`https://shikimori.one/api/animes/${anime.id}/roles`);
  if (!rolesRes.ok) {
    console.log(`[processCharacterData] Failed to fetch roles for anime ${anime.id}: ${rolesRes.status}`);
    return null;
  }
  const rolesData = await rolesRes.json();
  console.log(`[processCharacterData] Got ${rolesData.length} roles for anime ${anime.name}`);

  // Фильтрация персонажей: исключаем использованные ID и ВСЕХ персонажей с missing-изображениями
  // missing_original.jpg, missing_image.jpg и т.д. означают, что персонаж второстепенный/непопулярный
  let available = rolesData
    .filter((r: any) => r.character && r.character.id && !usedIds.includes(r.character.id))
    .filter((r: any) => {
      const imageUrl = r.character.image.original;
      // Исключаем все варианты missing изображений
      const isMissing = imageUrl.includes('missing');
      if (isMissing) {
        console.log(`[processCharacterData] Excluding character "${r.character.name}" (ID: ${r.character.id}) - missing image: ${imageUrl}`);
      }
      return !isMissing;
    });

  console.log(`[processCharacterData] Available characters after filtering (excluded used IDs and missing images): ${available.length} (used IDs: ${usedIds.length})`);

  // If no characters available, try relaxing ONLY the usedIds filter (but NEVER missing images)
  if (available.length === 0 && usedIds.length > 200) {
    console.log(`[processCharacterData] No available characters, relaxing used ID filter (but keeping missing image filter)...`);
    available = rolesData
      .filter((r: any) => r.character && r.character.id)
      .filter((r: any) => {
        const imageUrl = r.character.image.original;
        return !imageUrl.includes('missing');
      });
    console.log(`[processCharacterData] Available characters after relaxing used ID filter: ${available.length}`);
  }

  // If still no characters and we have a LOT of used IDs, allow duplicates with missing images excluded
  if (available.length === 0 && usedIds.length > 500) {
    console.log(`[processCharacterData] Very high collection count, allowing duplicates (excluding missing images)...`);
    available = rolesData
      .filter((r: any) => r.character && r.character.id)
      .filter((r: any) => {
        const imageUrl = r.character.image.original;
        return !imageUrl.includes('missing');
      });
    console.log(`[processCharacterData] Available characters with duplicates allowed: ${available.length}`);
  }

  if (available.length === 0) {
    console.log(`[processCharacterData] No available characters for anime ${anime.name} (all have missing images or are used)`);
    return null;
  }

  const mainChars = available.filter((r: any) => (r.roles || []).includes('Main') || (r.roles_ru || []).includes('Главный'));
  
  // Если forceMainCharacter=true, выбираем только из главных героев
  let selectedRole;
  if (forceMainCharacter) {
    if (mainChars.length > 0) {
      selectedRole = mainChars[Math.floor(Math.random() * mainChars.length)];
      console.log(`[processCharacterData] Force main character: selected from ${mainChars.length} main characters`);
    } else {
      console.log(`[processCharacterData] Force main character: NO main characters available, skipping this anime`);
      return null; // Возвращаем null, если нет главных героев при forceMainCharacter=true
    }
  } else {
    // Стандартная логика: 10% шанс на главного героя
    selectedRole = (mainChars.length > 0 && Math.random() > 0.9)
      ? mainChars[Math.floor(Math.random() * mainChars.length)]
      : available[Math.floor(Math.random() * available.length)];
  }

  const char = selectedRole.character;
  const isMain = (selectedRole.roles || []).includes('Main') || (selectedRole.roles_ru || []).includes('Главный');

  console.log(`[processCharacterData] Selected character: ${char.name} (ID: ${char.id}), isMain: ${isMain}`);

  let rarity = calculateRarityWithBoost(score, isMain);

  const originalShikiUrl = char.image.original.startsWith("/") 
    ? `https://shikimori.one${char.image.original}` 
    : char.image.original;

  // Ищем фан-арт только для главных персонажей
  let fanArt: string | null = null;
  let allFanArtBanned = false;
  if (isMain) {
    console.log(`[processCharacterData] Searching fan art for main character: ${char.name}, expandPool: ${expandPool}`);
    // Передаём expandPool=true если запрошено расширение или если это повторная попытка
    fanArt = await fetchHighQualityArt(char.name, anime.name, ignoredUrls, expandPool);
    console.log(`[processCharacterData] fetchHighQualityArt returned: ${fanArt ? 'URL' : 'null'}`);

    // Если арт не найден и не запрашивали расширение — пробуем расширить пул
    if (!fanArt && !expandPool) {
      console.log(`[processCharacterData] No art found, trying to expand pool...`);
      fanArt = await fetchHighQualityArt(char.name, anime.name, ignoredUrls, true);
      console.log(`[processCharacterData] fetchHighQualityArt (expanded) returned: ${fanArt ? 'URL' : 'null'}`);
      if (fanArt) {
        console.log(`[processCharacterData] Found art after expanding pool`);
      } else {
        allFanArtBanned = true;
        console.log(`[processCharacterData] All fan art banned for ${char.name}, using official art`);
      }
    } else if (!fanArt) {
      allFanArtBanned = true;
      console.log(`[processCharacterData] All fan art banned for ${char.name}, using official art`);
    }
  }

  const result = {
    animeName: anime.russian || anime.name,
    score: score,
    rarity: rarity,
    characterName: char.russian || char.name,
    characterId: char.id,
    originalUrl: originalShikiUrl, // Всегда храним официальный
    imageUrl: fanArt || originalShikiUrl, // Фан-арт только для главных, иначе официальный
    shikiId: anime.id,
    stats: generateStats(rarity),
    isMainCharacter: isMain,
    allFanArtBanned: allFanArtBanned // Флаг: все фан-арты забанены
  };

  console.log(`[processCharacterData] Final imageUrl: ${result.imageUrl === fanArt ? 'FAN ART' : 'SHIKIMORI'}, fanArt was: ${fanArt ? 'SET' : 'NULL'}`);
  console.log(`[processCharacterData] Returning result for ${result.characterName} from ${result.animeName}`);
  return result;
}

export async function rollAnimeCharacter(
  usedCharacterIds: number[] = [], 
  ignoredUrls: string[] = [],
  expandForCharacterIds: number[] = []  // Персонажи, для которых нужно расширить пул артов
): Promise<GachaResult | null> {
  try {
    console.log(`[rollAnimeCharacter] Starting roll, used IDs: ${usedCharacterIds.length}, ignored URLs: ${ignoredUrls.length}, expand for: ${expandForCharacterIds.length}`);

    const shikiRes = await fetch("https://shikimori.one/api/animes?limit=20&order=random&kind=tv&score=7", { cache: "no-store" });
    const data = await shikiRes.json();
    console.log(`[rollAnimeCharacter] Got ${data.length} anime series`);

    for (const anime of data) {
      const result = await processCharacterData(anime, usedCharacterIds, ignoredUrls, expandForCharacterIds.includes(anime.id), false);
      if (result) {
        console.log(`[rollAnimeCharacter] Successfully rolled: ${result.characterName} from ${result.animeName}`);
        return result;
      }
    }
    
    console.log(`[rollAnimeCharacter] No valid characters found in ${data.length} anime series`);
    return null;
  } catch (e) {
    console.error(`[rollAnimeCharacter] Error:`, e);
    throw e; // Re-throw to provide better error context
  }
}

export async function rollFromAnimePack(
  pack: AnimePack,
  usedCharacterIds: number[] = [],
  ignoredUrls: string[] = [],
  expandForCharacterIds: number[] = []  // Персонажи, для которых нужно расширить пул артов
): Promise<GachaResult | null> {
  try {
    console.log(`[rollFromAnimePack] Starting pack roll: ${pack.name}, anime IDs: ${pack.animeIds.length}, expand for: ${expandForCharacterIds.length}`);

    if (!pack.animeIds || pack.animeIds.length === 0) {
      console.error(`[rollFromAnimePack] Pack ${pack.name} has no anime IDs`);
      throw new Error(`Pack ${pack.name} is empty or invalid`);
    }

    // Определяем, должен ли пак выдавать только главных героев
    const forceMainCharacter = pack.id.includes('main_characters');
    console.log(`[rollFromAnimePack] Force main characters: ${forceMainCharacter} for pack ${pack.id}`);

    // Делаем до 3 попыток с перетасовкой ID, если не нашли персонажей
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const shuffledIds = [...pack.animeIds].sort(() => Math.random() - 0.5);

        // 🎯 НОВАЯ МЕХАНИКА: 10% шанс на гарантированную редкость (1 карта из 10)
        // Вместо 20% на каждый ролл
        const hasGuaranteedRarity = !!pack.guaranteedRarity;
        const isGuaranteedRoll = hasGuaranteedRarity && Math.random() < 0.10;
        console.log(`[rollFromAnimePack] Attempt ${attempt + 1}/3, Guaranteed roll: ${isGuaranteedRoll}, rarity: ${pack.guaranteedRarity}`);

        let processedCount = 0;
        for (const id of shuffledIds) {
          processedCount++;

          const res = await fetch(`https://shikimori.one/api/animes/${id}`);
          if (!res.ok) {
            console.log(`[rollFromAnimePack] Failed to fetch anime ${id}: ${res.status}`);
            continue;
          }
          const anime = await res.json();

          let expandPool = expandForCharacterIds.length > 0;
          const result = await processCharacterData(anime, usedCharacterIds, ignoredUrls, expandPool, forceMainCharacter);
          
          // Если результат получен и это главный персонаж из списка расширения - пробуем снова с расширенным пулом
          if (result && result.isMainCharacter && expandForCharacterIds.includes(result.characterId)) {
            console.log(`[rollFromAnimePack] Main character ${result.characterName} needs expanded pool, retrying...`);
            const expandedResult = await processCharacterData(anime, usedCharacterIds, ignoredUrls, true, forceMainCharacter);
            if (expandedResult) {
              // Используем результат с расширенным пулом
              result.imageUrl = expandedResult.imageUrl;
              result.allFanArtBanned = expandedResult.allFanArtBanned;
              console.log(`[rollFromAnimePack] Successfully expanded pool for ${result.characterName}`);
            }
          }

          if (result) {
            // Если это гарантированный ролл (1 из 10), применяем гарантированную редкость
            // Гарант перебивает все бусты — устанавливаем фиксированную редкость
            if (isGuaranteedRoll && pack.guaranteedRarity) {
              result.rarity = pack.guaranteedRarity;
              result.stats = generateStats(result.rarity);
              console.log(`[rollFromAnimePack] 🎯 GUARANTEED: Applied ${pack.guaranteedRarity} to ${result.characterName}`);
            }

            console.log(`[rollFromAnimePack] Successfully rolled: ${result.characterName} from ${result.animeName} (attempt ${attempt + 1}, processed ${processedCount} anime)`);
            return { ...result, packId: pack.id, packName: pack.name };
          }
        }

        console.log(`[rollFromAnimePack] No valid characters in attempt ${attempt + 1}, retrying...`);

        if (attempt < 2) {
          await new Promise(resolve => setTimeout(resolve, 300)); // Короткая пауза перед новой попыткой
        }
      } catch (fetchError) {
        console.error(`[rollFromAnimePack] Fetch error (attempt ${attempt + 1}):`, fetchError);
        if (attempt >= 2) throw fetchError;
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s before retry
      }
    }

    console.log(`[rollFromAnimePack] Exhausted all 3 attempts, no valid characters found in pack ${pack.name}`);
    console.log(`[rollFromAnimePack] Used character IDs: [${usedCharacterIds.slice(0, 10).join(', ')}${usedCharacterIds.length > 10 ? '...' : ''}]`);
    return null;
  } catch (e) {
    console.error(`[rollFromAnimePack] Error:`, e);
    throw e; // Re-throw to provide better error context
  }
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