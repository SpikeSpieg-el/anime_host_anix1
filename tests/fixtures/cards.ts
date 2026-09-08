import type { Rarity } from "@/types/gacha"
import type { Card as GachaCard } from "@/app/gacha/types"
import type { Card as BattleCard, CardRole } from "@/app/battle/types"

export const ALL_RARITIES: Rarity[] = [
  "trash",
  "common",
  "uncommon",
  "rare",
  "super_rare",
  "epic",
  "mythic",
  "legendary",
  "ancient",
  "divine",
  "transcendent",
  "omnipotent",
]

export function makeGachaCard(overrides: Partial<GachaCard> = {}): GachaCard {
  return {
    id: 1,
    uniqueId: "card-1",
    serialId: "S-0001",
    name: "Naruto Uzumaki",
    anime: "Naruto",
    rarity: "rare",
    imageUrl: "https://shikimori.one/system/characters/original/1.jpg",
    originalUrl: "https://shikimori.one/system/characters/original/1.jpg",
    score: 8.1,
    shikiId: 20,
    characterId: 17,
    stats: { hp: 80, atk: 40, def: 30, spd: 35, luck: 20 },
    isMainCharacter: true,
    ...overrides,
  }
}

export function makeBattleCard(
  overrides: Partial<BattleCard> & { role?: CardRole } = {},
): BattleCard {
  return {
    uniqueId: "battle-1",
    name: "Eren Yeager",
    anime: "Attack on Titan",
    rarity: "epic",
    imageUrl: "https://shikimori.one/system/characters/original/2.jpg",
    stats: { hp: 400, atk: 70, def: 40, spd: 50, luck: 20 },
    isMainCharacter: true,
    ...overrides,
  }
}

export function makeVanguard(overrides: Partial<BattleCard> = {}): BattleCard {
  return makeBattleCard({
    uniqueId: "vg-1",
    name: "Vanguard",
    role: "vanguard",
    stats: { hp: 80, atk: 90, def: 10, spd: 10, luck: 10 },
    ...overrides,
  })
}

export function makeGuard(overrides: Partial<BattleCard> = {}): BattleCard {
  return makeBattleCard({
    uniqueId: "gd-1",
    name: "Guard",
    role: "guard",
    stats: { hp: 800, atk: 10, def: 90, spd: 10, luck: 10 },
    ...overrides,
  })
}

export function makeTrickster(overrides: Partial<BattleCard> = {}): BattleCard {
  return makeBattleCard({
    uniqueId: "tr-1",
    name: "Trickster",
    role: "trickster",
    stats: { hp: 80, atk: 10, def: 10, spd: 90, luck: 80 },
    ...overrides,
  })
}

export function makeMarketCard(rarity: Rarity = "rare", extra: Record<string, unknown> = {}) {
  return {
    rarity,
    stats: { hp: 50, atk: 40, def: 30, spd: 20, luck: 10 },
    isMainCharacter: false,
    ...extra,
  }
}
