import type { BattleZone, ZoneCard, Card, Enemy, Dungeon } from "@/app/battle/types"
import { makeBattleCard } from "./cards"

export function makeZoneCard(card: Card, extra: Partial<ZoneCard> = {}): ZoneCard {
  return {
    card,
    isSecret: false,
    wasSecret: false,
    powerAfterModifier: 100,
    placementOrder: 0,
    isPlayer: true,
    ...extra,
  }
}

export function makeEmptyZone(id = "zone-a", modifierId = "none"): BattleZone {
  return {
    id,
    name: id,
    nameRu: id,
    modifier: {
      id: modifierId,
      name: modifierId,
      nameRu: modifierId,
      description: "",
    },
    playerCards: [],
    aiCards: [],
    playerScore: 0,
    aiScore: 0,
    owner: "none",
  }
}

export function makeThreeZones(modifierIds: string[] = ["none", "none", "none"]): BattleZone[] {
  return ["left", "mid", "right"].map((id, i) => makeEmptyZone(id, modifierIds[i] || "none"))
}

export function makeEnemy(overrides: Partial<Enemy> = {}): Enemy {
  return {
    id: "enemy-1",
    name: "Titan",
    name_ru: "Титан",
    anime: "Attack on Titan",
    image_url: "",
    level: 5,
    tier: "normal",
    stats_hp: 100,
    stats_atk: 40,
    stats_def: 30,
    stats_spd: 20,
    stats_luck: 10,
    ...overrides,
  }
}

export function makeDungeon(overrides: Partial<Dungeon> = {}): Dungeon {
  return {
    id: "dungeon-1",
    name: "Dark Forest",
    name_ru: "Тёмный лес",
    theme: "dark_forest",
    difficulty: 2,
    required_level: 1,
    energy_cost: 1,
    coins_reward_base: 50,
    dust_reward_base: 10,
    xp_reward_base: 20,
    enemy_ids: ["enemy-1"],
    ...overrides,
  }
}

export function sampleDeck(): Card[] {
  return [
    makeBattleCard({ uniqueId: "d1", name: "A", anime: "Naruto", rarity: "rare", stats: { hp: 80, atk: 50, def: 20, spd: 20, luck: 10 } }),
    makeBattleCard({ uniqueId: "d2", name: "B", anime: "Naruto", rarity: "epic", stats: { hp: 400, atk: 20, def: 70, spd: 10, luck: 10 } }),
    makeBattleCard({ uniqueId: "d3", name: "C", anime: "Bleach", rarity: "uncommon", stats: { hp: 80, atk: 10, def: 10, spd: 70, luck: 60 } }),
    makeBattleCard({ uniqueId: "d4", name: "D", anime: "One Piece", rarity: "common", stats: { hp: 80, atk: 40, def: 20, spd: 20, luck: 10 } }),
    makeBattleCard({ uniqueId: "d5", name: "E", anime: "Naruto", rarity: "super_rare", stats: { hp: 200, atk: 60, def: 30, spd: 20, luck: 10 } }),
    makeBattleCard({ uniqueId: "d6", name: "F", anime: "HxH", rarity: "mythic", stats: { hp: 80, atk: 80, def: 20, spd: 30, luck: 20 } }),
    makeBattleCard({ uniqueId: "d7", name: "G", anime: "AOT", rarity: "legendary", stats: { hp: 500, atk: 40, def: 80, spd: 10, luck: 10 } }),
    makeBattleCard({ uniqueId: "d8", name: "H", anime: "AOT", rarity: "rare", stats: { hp: 80, atk: 10, def: 10, spd: 80, luck: 70 } }),
  ]
}
