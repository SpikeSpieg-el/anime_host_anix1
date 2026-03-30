
"use server"

import { getPackById, searchPacksByTitle, searchAnimeByTitle, createCustomPack, type AnimePack, type CustomAnimePack } from "@/lib/gacha-packs"
import { fetchHighQualityArt } from "./art-sources"

const RARITY_ORDER =[
  "trash", "common", "uncommon", "rare", "super_rare", "epic",
  "mythic", "legendary", "ancient", "divine", "transcendent", "omnipotent"
];

function generateStats(rarity: string) {
  const index = RARITY_ORDER.indexOf(rarity);
  
  const baseMinTable =[5, 12, 19, 26, 33, 40, 47, 54, 62, 72, 82, 90];
  const baseMaxTable =[25, 32, 39, 46, 53, 60, 67, 74, 82, 90, 96, 100];
  
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

  if (score >= 9.0) {
    const legendaryRoll = Math.random();
    if (legendaryRoll < 0.03) boostApplied += 2;
    else if (legendaryRoll < 0.10) boostApplied += 1;
  } else if (score >= 8.5) {
    if (Math.random() < 0.08) boostApplied += 1;
  }

  if (isMainCharacter) boostApplied += 1;
  if (Math.random() < 0.01) boostApplied += 1;
  if (Math.random() < 0.001) boostApplied += 3;
  if (Math.random() < 0.0001) boostApplied += 5;

  if (boostApplied > 0) {
    const currentIndex = RARITY_ORDER.indexOf(rarity);
    const newIndex = Math.min(currentIndex + boostApplied, RARITY_ORDER.length - 1);
    rarity = RARITY_ORDER[newIndex];
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
  allFanArtBanned?: boolean;
  packId?: string;
  packName?: string;
}

async function processCharacterData(
  anime: any,
  usedIds: number[],
  ignoredUrls: string[],
  expandPool: boolean = false,
  forceMainCharacter: boolean = false
): Promise<GachaResult | null> {
  const score = parseFloat(anime.score || "0");

  const rolesRes = await fetch(`https://shikimori.one/api/animes/${anime.id}/roles`);
  if (!rolesRes.ok) return null;
  const rolesData = await rolesRes.json();

  const allValidMainChars = rolesData.filter((r: any) => {
    if (!r.character || !r.character.id || r.character.image.original.includes('missing')) return false;
    return (r.roles ||[]).includes('Main') || (r.roles_ru ||[]).includes('Главный');
  });

  let available = rolesData.filter((r: any) => {
    if (!r.character || !r.character.id || r.character.image.original.includes('missing')) return false;
    return !usedIds.includes(r.character.id);
  });

  // УДАЛИ ИЛИ ЗАКОММЕНТИРУЙ ЭТОТ БЛОК, чтобы не было повторов, пока пак не пуст
  /*
  let endgameArtMode = false;
  if (available.length === 0 && allValidMainChars.length > 0) {
     available = allValidMainChars;
     endgameArtMode = true; 
  }
  */

  if (available.length === 0) return null; // Если в этом аниме все выбиты, идем к следующему

  const mainChars = available.filter((r: any) => (r.roles || []).includes('Main') || (r.roles_ru ||[]).includes('Главный'));
  
  let selectedRole;
  if (forceMainCharacter) {
    if (mainChars.length > 0) {
      selectedRole = mainChars[Math.floor(Math.random() * mainChars.length)];
    } else {
      return null; 
    }
  } else {
    selectedRole = (mainChars.length > 0 && Math.random() > 0.9)
      ? mainChars[Math.floor(Math.random() * mainChars.length)]
      : available[Math.floor(Math.random() * available.length)];
  }

  const char = selectedRole.character;
  const isMain = (selectedRole.roles ||[]).includes('Main') || (selectedRole.roles_ru ||[]).includes('Главный');
  let rarity = calculateRarityWithBoost(score, isMain);

  const originalShikiUrl = char.image.original.startsWith("/") 
    ? `https://shikimori.one${char.image.original}` 
    : char.image.original;

  let fanArt: string | null = null;
  let allFanArtBanned = false;

  // В actions.ts найдите это место:
if (isMain) {
    // ВЫЗОВ ОБНОВЛЕН: получаем объект вместо строки
    const artData = await fetchHighQualityArt(char.name, ignoredUrls, false);

    if (artData) {
        fanArt = artData.url; // Берем URL из объекта
        // Можно залогировать и здесь
        console.log(`[Server Action] Using art from ${artData.source} by tag ${artData.tag}`);
    }

    if (!fanArt) {
        if (ignoredUrls.includes(originalShikiUrl)) {
            allFanArtBanned = true;
            return null;
        }
        console.log(`[Server Action] No fanart for ${char.name}, using Shiki original.`);
    }
}

  // Проверяем, что финальный арт не забанен
  const finalImageUrl = fanArt || originalShikiUrl;
  if (ignoredUrls.includes(finalImageUrl)) {
    console.log(`[Gacha] Final image ${finalImageUrl} is banned, skipping character.`);
    return null;
  }

  return {
    animeName: anime.russian || anime.name,
    score: score,
    rarity: rarity,
    characterName: char.russian || char.name,
    characterId: char.id,
    originalUrl: originalShikiUrl,
    imageUrl: finalImageUrl,
    shikiId: anime.id,
    stats: generateStats(rarity),
    isMainCharacter: isMain,
    allFanArtBanned: allFanArtBanned,
    packId: undefined,
    packName: undefined
  };
}

export async function rollAnimeCharacter(
  usedCharacterIds: number[] =[], 
  ignoredUrls: string[] = [],
  expandForCharacterIds: number[] =[]
): Promise<GachaResult | null> {
  try {
    const shikiRes = await fetch("https://shikimori.one/api/animes?limit=30&order=random&kind=tv&score=7", { cache: "no-store" });
    const data = await shikiRes.json();

    for (const anime of data) {
      const result = await processCharacterData(anime, usedCharacterIds, ignoredUrls, expandForCharacterIds.includes(anime.id), false);
      if (result) return result;
    }
    return null;
  } catch (e) {
    console.error(`[rollAnimeCharacter] Error:`, e);
    return null;
  }
}

export async function rollFromAnimePack(
  pack: AnimePack,
  usedCharacterIds: number[] = [],
  ignoredUrls: string[] = [],
  expandForCharacterIds: number[] =[]
): Promise<GachaResult | null> {
  try {
    if (!pack.animeIds || pack.animeIds.length === 0) throw new Error(`Pack ${pack.name} is empty`);

    const forceMainCharacter = pack.id.includes('main_characters');

    // 1 проход: ищем только НОВЫХ
    for (let attempt = 0; attempt < 3; attempt++) {
      const shuffledIds = [...pack.animeIds].sort(() => Math.random() - 0.5);
      const isGuaranteedRoll = !!pack.guaranteedRarity && Math.random() < 0.10;

      for (const id of shuffledIds) {
        const res = await fetch(`https://shikimori.one/api/animes/${id}`);
        if (!res.ok) continue;
        const anime = await res.json();

        let expandPool = expandForCharacterIds.includes(id);
        const result = await processCharacterData(anime, usedCharacterIds, ignoredUrls, expandPool, forceMainCharacter);

        if (result) {
          if (isGuaranteedRoll && pack.guaranteedRarity) {
            result.rarity = pack.guaranteedRarity;
            result.stats = generateStats(result.rarity);
          }
          return { ...result, packId: pack.id, packName: pack.name };
        }
      }
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    // Если ничего не нашли (все выбиты), можно запустить 2-й проход БЕЗ фильтра usedIds (опционально)
    // Но лучше просто вернуть null, чтобы фронтенд показал ошибку "Пак пуст"
    return null; 
  } catch (e) {
    console.error(`[rollFromAnimePack] Error:`, e);
    return null;
  }
}

export async function searchGachaPacks(query: string): Promise<AnimePack[]> {
  return searchPacksByTitle(query);
}

export interface CustomPackSearchResult {
  customPack: CustomAnimePack;
  foundAnime: Array<{ id: number; name: string; russian: string | null; score: number | null; imageUrl: string }>;
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
  } catch (error) {
    console.error("Custom pack creation error:", error);
    return null;
  }
}
