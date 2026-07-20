"use server"

import { getPackById, searchPacksByTitle, searchAnimeByTitle, createCustomPack, type AnimePack, type CustomAnimePack } from "@/lib/gacha-packs"
import { fetchHighQualityArt } from "./art-sources"

const RARITY_ORDER =[
  "trash", "common", "uncommon", "rare", "super_rare", "epic",
  "mythic", "legendary", "ancient", "divine", "transcendent", "omnipotent"
];

// Helper function to check if rarity is Divine or better
function isDivineOrBetter(rarity: string): boolean {
  const divineIndex = RARITY_ORDER.indexOf("divine");
  const rarityIndex = RARITY_ORDER.indexOf(rarity);
  return rarityIndex >= divineIndex;
}

export async function generateStatsForRarity(rarity: string) {
  return generateStats(rarity);
}

function generateStats(rarity: string) {
  const index = RARITY_ORDER.indexOf(rarity);
  
  const baseMinTable =[5, 12, 19, 26, 33, 40, 47, 54, 62, 72, 82, 90];
  const baseMaxTable =[25, 32, 39, 46, 53, 60, 67, 74, 82, 90, 96, 100];
  
  const baseMin = baseMinTable[index] || 5;
  const baseMax = baseMaxTable[index] || 25;
  
  const roll = (min: number, max: number) => Math.min(Math.floor(Math.random() * (max - min + 1) + min), 100);

  // Шанс на все нулевые статы (1/100 000 = 0.001%)
  const allZeroChance = 0.00001;
  if (Math.random() < allZeroChance) {
    return {
      hp: 0,
      atk: 0,
      def: 0,
      spd: 0,
      luck: 0
    };
  }

  // Архетипы для идентичности карт
  const archetypes = [
    { name: "tank", boost: { hp: 1.5, def: 1.4, atk: 0.6, spd: 0.7, luck: 0.8 } },
    { name: "berserker", boost: { hp: 0.8, def: 0.5, atk: 1.6, spd: 1.2, luck: 0.9 } },
    { name: "speedster", boost: { hp: 0.7, def: 0.6, atk: 1.1, spd: 1.7, luck: 1.3 } },
    { name: "lucky", boost: { hp: 0.8, def: 0.8, atk: 0.9, spd: 1.0, luck: 1.8 } },
    { name: "balanced", boost: { hp: 1.0, def: 1.0, atk: 1.0, spd: 1.0, luck: 1.0 } },
    { name: "glass_cannon", boost: { hp: 0.5, def: 0.4, atk: 1.8, spd: 1.4, luck: 1.1 } },
    { name: "fortress", boost: { hp: 1.8, def: 1.6, atk: 0.4, spd: 0.5, luck: 0.6 } },
    { name: "trickster", boost: { hp: 0.6, def: 0.5, atk: 1.0, spd: 1.8, luck: 1.6 } },
  ];

  const archetype = archetypes[Math.floor(Math.random() * archetypes.length)];
  const boost = archetype.boost;

  // Шанс на 0 для отдельного стата (5%)
  const zeroChance = 0.05;
  
  const applyBoost = (base: number, multiplier: number) => {
    if (Math.random() < zeroChance) return 0;
    const boosted = Math.floor(base * multiplier);
    return Math.min(Math.max(boosted, 0), 100);
  };

  return {
    hp: applyBoost(roll(baseMin, baseMax), boost.hp),
    atk: applyBoost(roll(baseMin, baseMax), boost.atk),
    def: applyBoost(roll(baseMin, baseMax), boost.def),
    spd: applyBoost(roll(baseMin, baseMax), boost.spd),
    luck: applyBoost(roll(baseMin, baseMax), boost.luck)
  };
}

function calculateBaseRarity(score: number): string {
  if (score >= 8.8) return "mythic";
  if (score >= 8.3) return "epic";
  if (score >= 7.8) return "super_rare";
  if (score >= 7.2) return "rare";
  if (score >= 7.0) return "uncommon";
  if (score >= 6.6) return "common";
  return "trash";
}

function calculateRarityWithBoost(score: number, isMainCharacter: boolean = false, badLuckStreak: number = 0): { rarity: string; pityBonusApplied: boolean } {
  let rarity = calculateBaseRarity(score);
  let boostApplied = 0;
  let pityBonusApplied = false;

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

  // Pity System: Apply bonus based on bad luck streak
  if (badLuckStreak > 0) {
    const pityBonusChance = Math.min(badLuckStreak * 0.02, 0.5); // Max 50% chance at 25 streak
    const pityBoostAmount = Math.floor(badLuckStreak / 5); // 1 boost per 5 streak
    
    if (Math.random() < pityBonusChance) {
      boostApplied += pityBoostAmount;
      pityBonusApplied = true;
      console.log(`[Pity System] Bad luck streak: ${badLuckStreak}, Applied boost: ${pityBoostAmount}`);
    }
  }

  if (boostApplied > 0) {
    const currentIndex = RARITY_ORDER.indexOf(rarity);
    const newIndex = Math.min(currentIndex + boostApplied, RARITY_ORDER.length - 1);
    rarity = RARITY_ORDER[newIndex];
  }

  return { rarity, pityBonusApplied };
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
  frameModifier?: string;
  coatingModifier?: string;
  pityData?: {
    bad_luck_streak: number;
    pity_bonus_applied: boolean;
  };
}

async function processCharacterData(
  anime: any,
  usedIds: number[],
  ignoredUrls: string[],
  expandPool: boolean = false,
  forceMainCharacter: boolean = false,
  badLuckStreak: number = 0
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

  if (available.length === 0) return null;

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
  const rarityResult = calculateRarityWithBoost(score, isMain, badLuckStreak);

  const originalShikiUrl = char.image.original.startsWith("/") 
    ? `https://shikimori.one${char.image.original}` 
    : char.image.original;

  let fanArt: string | null = null;
  let allFanArtBanned = false;

  if (isMain) {
    try {
        const artPromise = fetchHighQualityArt(char.name, ignoredUrls, false, undefined, anime.name || anime.russian);
        const timeoutPromise = new Promise<null>((_, reject) => 
            setTimeout(() => reject(new Error('Art fetch timeout')), 10000)
        );
        
        const artData = await Promise.race([artPromise, timeoutPromise]);

        if (artData) {
            fanArt = artData.url;
            console.log(`[Server Action] Using art from ${artData.source} by tag ${artData.tag}`);
        }
    } catch (error) {
        console.log(`[Server Action] Art fetch failed or timed out for ${char.name}:`, error);
    }

    if (!fanArt) {
        if (ignoredUrls.includes(originalShikiUrl)) {
            allFanArtBanned = true;
            return null;
        }
        console.log(`[Server Action] No fanart for ${char.name}, using Shiki original.`);
    }
  }

  const finalImageUrl = fanArt || originalShikiUrl;
  if (ignoredUrls.includes(finalImageUrl)) {
      console.log(`[Gacha] Final image ${finalImageUrl} is banned, skipping character.`);
      return null;
  }

  if (!finalImageUrl || finalImageUrl.trim() === '') {
      console.error(`[Gacha] Empty image URL for character ${char.name}, skipping.`);
      return null;
  }

  // --- ВЫДАЧА МОДИФИКАТОРОВ (РАМКИ И ПОКРЫТИЯ) ---
  let frameModifier: string | undefined = undefined;
  let coatingModifier: string | undefined = undefined;

  // 12% шанс на уникальную рамку
  if (Math.random() < 0.12) {
    const FRAMES =["gold", "neon", "crystal", "dark", "blood", "inferno", "lightning", "divine", "cyber_glitch", "abyss"];
    frameModifier = FRAMES[Math.floor(Math.random() * FRAMES.length)];
  }

  // 12% шанс на уникальное покрытие
  if (Math.random() < 0.12) {
    const COATINGS =["holo", "prismatic", "gold_leaf", "blood_stain", "void", "matrix_foil", "crt_scanlines", "falling_ash", "heartbeat", "ethereal_mist"];
    coatingModifier = COATINGS[Math.floor(Math.random() * COATINGS.length)];
  }

  console.log(`[Gacha] Final modifiers - Frame: ${frameModifier}, Coating: ${coatingModifier}`);

  return {
    animeName: anime.russian || anime.name,
    score: score,
    rarity: rarityResult.rarity,
    characterName: char.russian || char.name,
    characterId: char.id,
    originalUrl: originalShikiUrl,
    imageUrl: finalImageUrl,
    shikiId: anime.id,
    stats: generateStats(rarityResult.rarity),
    isMainCharacter: isMain,
    allFanArtBanned: allFanArtBanned,
    packId: undefined,
    packName: undefined,
    frameModifier,
    coatingModifier,
    pityData: {
      bad_luck_streak: badLuckStreak,
      pity_bonus_applied: rarityResult.pityBonusApplied
    }
  };
}

export async function rollAnimeCharacter(
  usedCharacterIds: number[] =[], 
  ignoredUrls: string[] =[],
  expandForCharacterIds: number[] =[],
  badLuckStreak: number = 0
): Promise<GachaResult | null> {
  try {
    const shikiRes = await fetch("https://shikimori.one/api/animes?limit=30&order=random&kind=tv", { cache: "no-store" });
    const data = await shikiRes.json();

    for (const anime of data) {
      const result = await processCharacterData(anime, usedCharacterIds, ignoredUrls, expandForCharacterIds.includes(anime.id), false, badLuckStreak);
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
  usedCharacterIds: number[] =[],
  ignoredUrls: string[] = [],
  expandForCharacterIds: number[] =[],
  badLuckStreak: number = 0
): Promise<GachaResult | null> {
  try {
    if (!pack.animeIds || pack.animeIds.length === 0) throw new Error(`Pack ${pack.name} is empty`);

    const forceMainCharacter = pack.id.includes('main_characters');

    for (let attempt = 0; attempt < 3; attempt++) {
      const shuffledIds =[...pack.animeIds].sort(() => Math.random() - 0.5);
      const isGuaranteedRoll = !!pack.guaranteedRarity && Math.random() < 0.10;

      for (const id of shuffledIds) {
        const res = await fetch(`https://shikimori.one/api/animes/${id}`);
        if (!res.ok) continue;
        const anime = await res.json();

        let expandPool = expandForCharacterIds.includes(id);
        const result = await processCharacterData(anime, usedCharacterIds, ignoredUrls, expandPool, forceMainCharacter, badLuckStreak);

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
    return null; 
  } catch (e) {
    console.error(`[rollFromAnimePack] Error:`, e);
    return null;
  }
}

function normalizeBannerCardPayload(payload: any): GachaResult {
  const rarity = payload.rarity || 'common'

  return {
    ...payload,
    characterName: payload.characterName || payload.name || '',
    animeName: payload.animeName || payload.anime || '',
    characterId: payload.characterId ?? payload.id ?? 0,
    imageUrl: payload.imageUrl || payload.originalUrl || '',
    originalUrl: payload.originalUrl || payload.imageUrl || '',
    rarity,
    score: payload.score ?? payload.animeScore ?? 0,
    shikiId: payload.shikiId ?? payload.animeId ?? 0,
    stats: payload.stats || generateStats(rarity),
    isMainCharacter: payload.isMainCharacter || false,
  }
}

export async function rollFromBanner(
  banner: {
    id: string;
    name: string;
    featuredAnimeIds: number[];
    boostedRarity?: string | null;
    cards: { cardPayload: any; weight: number; isFeatured: boolean }[];
    guaranteedCardPayload?: any | null;
    guaranteedCardPity?: number;
    guaranteedCardsPool?: any[] | null;
  },
  usedCharacterIds: number[] = [],
  ignoredUrls: string[] = [],
  badLuckStreak: number = 0
): Promise<GachaResult | null> {
  try {
    const userId = (banner as any).userId

    // Multi-GG pool mode (dynamic banner): 3 guaranteed characters, pick random uncollected
    if (banner.guaranteedCardsPool && banner.guaranteedCardsPool.length > 0 && banner.guaranteedCardPity && banner.guaranteedCardPity > 0 && userId) {
      try {
        const { createClient } = await import('@supabase/supabase-js')
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
        const supabase = createClient(supabaseUrl, supabaseServiceKey, {
          auth: { autoRefreshToken: false, persistSession: false }
        })

        const { data: pullData } = await supabase
          .from('user_banner_pulls')
          .select('pull_count, collected_guaranteed_cards')
          .eq('user_id', userId)
          .eq('banner_id', banner.id)
          .single()

        const currentCount = pullData?.pull_count || 0
        let collectedIds: number[] = Array.isArray(pullData?.collected_guaranteed_cards) ? pullData.collected_guaranteed_cards : []
        const newCount = currentCount + 1

        // If all GGs have been collected, start a new cycle
        let pool = banner.guaranteedCardsPool
        if (collectedIds.length >= pool.length) {
          collectedIds = []
        }

        const uncollectedPool = pool.filter(c => !collectedIds.includes(c.characterId))
        const shouldAwardGuaranteed = newCount >= banner.guaranteedCardPity

        if (shouldAwardGuaranteed && uncollectedPool.length > 0) {
          const chosenGG = uncollectedPool[Math.floor(Math.random() * uncollectedPool.length)]
          const nextCollectedIds = [...collectedIds, chosenGG.characterId]
          const allCollected = nextCollectedIds.length >= pool.length

          await supabase
            .from('user_banner_pulls')
            .upsert({
              user_id: userId,
              banner_id: banner.id,
              pull_count: 0,
              guaranteed_claimed: false,
              collected_guaranteed_cards: allCollected ? [] : nextCollectedIds,
              last_pull_at: new Date().toISOString(),
            }, { onConflict: 'user_id,banner_id' })

          console.log(`[rollFromBanner] Awarding guaranteed GG: ${chosenGG.characterName || chosenGG.name} after ${newCount} pulls!`)
          const guaranteedResult = {
            ...normalizeBannerCardPayload(chosenGG),
            packId: 'banner:' + banner.id,
            packName: banner.name,
          }
          return guaranteedResult
        }

        await supabase
          .from('user_banner_pulls')
          .upsert({
            user_id: userId,
            banner_id: banner.id,
            pull_count: newCount,
            guaranteed_claimed: false,
            collected_guaranteed_cards: collectedIds,
            last_pull_at: new Date().toISOString(),
          }, { onConflict: 'user_id,banner_id' })
      } catch (pityError) {
        console.error('[rollFromBanner] Multi-GG pity check failed:', pityError)
      }
    }

    // Single guaranteed card mode (standard banner)
    if (banner.guaranteedCardPayload && banner.guaranteedCardPity && banner.guaranteedCardPity > 0) {
      try {
        const { createClient } = await import('@supabase/supabase-js')
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
        const supabase = createClient(supabaseUrl, supabaseServiceKey, {
          auth: { autoRefreshToken: false, persistSession: false }
        })

        const userId = (banner as any).userId
        if (userId) {
          const { data: pullData } = await supabase
            .from('user_banner_pulls')
            .select('pull_count, guaranteed_claimed')
            .eq('user_id', userId)
            .eq('banner_id', banner.id)
            .single()

          const currentCount = pullData?.pull_count || 0
          const alreadyClaimed = pullData?.guaranteed_claimed || false

          const newCount = currentCount + 1
          const shouldAwardGuaranteed = !alreadyClaimed && newCount >= banner.guaranteedCardPity

          await supabase
            .from('user_banner_pulls')
            .upsert({
              user_id: userId,
              banner_id: banner.id,
              pull_count: newCount,
              guaranteed_claimed: shouldAwardGuaranteed || alreadyClaimed,
              last_pull_at: new Date().toISOString(),
            }, { onConflict: 'user_id,banner_id' })

          if (shouldAwardGuaranteed) {
            console.log(`[rollFromBanner] Awarding guaranteed card after ${newCount} pulls!`)
            const payload = banner.guaranteedCardPayload
            const guaranteedResult = {
              ...normalizeBannerCardPayload(payload),
              packId: 'banner:' + banner.id,
              packName: banner.name,
            }
            return guaranteedResult
          }
        }
      } catch (pityError) {
        console.error('[rollFromBanner] Guaranteed card pity check failed:', pityError)
      }
    }

    if (banner.cards && banner.cards.length > 0) {
      const totalWeight = banner.cards.reduce((sum, c) => sum + (c.weight || 0), 0)
      if (totalWeight <= 0) return null

      let roll = Math.random() * totalWeight
      let chosen = banner.cards[0]
      for (const c of banner.cards) {
        roll -= (c.weight || 0)
        if (roll <= 0) {
          chosen = c
          break
        }
      }

      const cardPayload = chosen.cardPayload
      if (!cardPayload) return null

      return {
        ...normalizeBannerCardPayload(cardPayload),
        packId: 'banner:' + banner.id,
        packName: banner.name,
      }
    }

    if (banner.featuredAnimeIds && banner.featuredAnimeIds.length > 0) {
      const tempPack: AnimePack = {
        id: 'banner:' + banner.id,
        name: banner.name,
        description: '',
        animeIds: banner.featuredAnimeIds,
        price: 0,
        color: '',
        guaranteedRarity: banner.boostedRarity || undefined,
      }

      const result = await rollFromAnimePack(tempPack, usedCharacterIds, ignoredUrls, [], badLuckStreak)
      if (!result) return null

      if (banner.boostedRarity) {
        const boostedIndex = RARITY_ORDER.indexOf(banner.boostedRarity)
        const rolledIndex = RARITY_ORDER.indexOf(result.rarity)
        if (boostedIndex >= 0 && rolledIndex >= 0 && rolledIndex < boostedIndex) {
          result.rarity = banner.boostedRarity
          result.stats = generateStats(result.rarity)
        }
      }

      return { ...result, packId: 'banner:' + banner.id, packName: banner.name }
    }

    return null
  } catch (e) {
    console.error(`[rollFromBanner] Error:`, e)
    return null
  }
}

export async function searchGachaPacks(query: string): Promise<AnimePack[]> {
  return searchPacksByTitle(query);
}

export interface CustomPackSearchResult {
  customPack: CustomAnimePack;
  foundAnime: Array<{ id: number; name: string; russian: string | null; score: number | null; imageUrl: string }>;
}

export async function checkPackAvailability(
  pack: AnimePack,
  usedCharacterIds: number[] =[]
): Promise<{
  totalCharacters: number;
  collectedCount: number;
  availableCount: number;
  collectionRate: number;
  isEmpty: boolean;
  isNearlyComplete: boolean;
}> {
  try {
    if (!pack.animeIds || pack.animeIds.length === 0) {
      return {
        totalCharacters: 0,
        collectedCount: usedCharacterIds.length,
        availableCount: 0,
        collectionRate: 1,
        isEmpty: true,
        isNearlyComplete: true
      };
    }

    let totalCharacterCount = 0;
    let availableCharacterCount = 0;

    for (const animeId of pack.animeIds) {
      try {
        const res = await fetch(`https://shikimori.one/api/animes/${animeId}/roles`);
        if (res.ok) {
          const roles = await res.json();
          const validCharacters = roles.filter((r: any) => 
            r.character && 
            r.character.id && 
            !r.character.image.original.includes('missing')
          );
          
          totalCharacterCount += validCharacters.length;
          
          const newCharacters = validCharacters.filter((r: any) => 
            !usedCharacterIds.includes(r.character.id)
          );
          availableCharacterCount += newCharacters.length;
        }
      } catch (error) {
        console.error(`Error checking anime ${animeId}:`, error);
        totalCharacterCount += 5;
        availableCharacterCount += Math.max(0, 5 - usedCharacterIds.length);
      }
    }

    const collectionRate = totalCharacterCount > 0 ? (totalCharacterCount - availableCharacterCount) / totalCharacterCount : 0;
    const collectedFromPack = totalCharacterCount - availableCharacterCount;
    
    const isNearlyComplete = availableCharacterCount < (totalCharacterCount * 0.2);
    const isEmpty = availableCharacterCount === 0;

    return {
      totalCharacters: totalCharacterCount,
      collectedCount: collectedFromPack,
      availableCount: availableCharacterCount,
      collectionRate,
      isEmpty,
      isNearlyComplete
    };
  } catch (error) {
    console.error('[checkPackAvailability] Error:', error);
    return {
      totalCharacters: pack.animeIds ? pack.animeIds.length * 5 : 0,
      collectedCount: usedCharacterIds.length,
      availableCount: Math.max(0, (pack.animeIds ? pack.animeIds.length * 5 : 0) - usedCharacterIds.length),
      collectionRate: usedCharacterIds.length / (pack.animeIds ? pack.animeIds.length * 5 : 1),
      isEmpty: false,
      isNearlyComplete: false
    };
  }
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

// Pity system management functions
export async function updateUserPityAfterRoll(userId: string, result: GachaResult): Promise<{ newStreak: number; wasReset: boolean }> {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
    
    const { data: currentPity, error: fetchError } = await supabase
      .from('user_pity')
      .select('bad_luck_streak')
      .eq('id', userId)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('[updateUserPityAfterRoll] Fetch error:', fetchError);
      return { newStreak: 0, wasReset: false };
    }

    const currentStreak = currentPity?.bad_luck_streak || 0;
    let newStreak: number;
    let wasReset: boolean;

    if (isDivineOrBetter(result.rarity)) {
      newStreak = 0;
      wasReset = true;
      console.log(`[Pity System] User ${userId} got ${result.rarity}, resetting streak from ${currentStreak} to 0`);
    } else {
      newStreak = currentStreak + 1;
      wasReset = false;
      console.log(`[Pity System] User ${userId} got ${result.rarity}, incrementing streak from ${currentStreak} to ${newStreak}`);
    }

    const updateData: any = { bad_luck_streak: newStreak };
    if (wasReset) {
      updateData.last_rare_roll = new Date().toISOString();
    }

    const { error: updateError } = await supabase
      .from('user_pity')
      .upsert({ id: userId, ...updateData }, { onConflict: 'id' });

    if (updateError) {
      console.error('[updateUserPityAfterRoll] Update error:', updateError);
      return { newStreak: currentStreak, wasReset: false };
    }

    return { newStreak, wasReset };
  } catch (error) {
    console.error('[updateUserPityAfterRoll] Unexpected error:', error);
    return { newStreak: 0, wasReset: false };
  }
}