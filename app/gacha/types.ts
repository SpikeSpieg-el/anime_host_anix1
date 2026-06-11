import { Rarity } from "@/types/gacha"
export type { Rarity }

export interface CardStats {
  hp: number
  atk: number
  def: number
  spd: number
  luck: number
}

export interface Card {
  id: number
  uniqueId: string
  serialId: string
  name: string
  anime: string
  rarity: Rarity
  imageUrl: string
  originalUrl: string
  fallbackUrls?: string[] 
  score: number
  shikiId: number
  characterId: number
  stats: CardStats
  isMainCharacter?: boolean
  packId?: string
  packName?: string
  frameModifier?: string
  coatingModifier?: string
  isArtBlacklisted?: boolean
  orderIndex?: number // Индекс порядка добавления в коллекцию
  imageLayers?: [string, string, string] // PNG layers for 3D effect
}

export interface CollectionRating {
  overallScore: number
  grade: string
  gradeColor: string
  totalPower: number
  avgRarity: number
  powerScore: number
  rarityDistribution: Record<Rarity, number>
  topCards: Card[]
  stats: {
    avgHp: number
    avgAtk: number
    avgDef: number
    avgSpd: number
    avgLuck: number
  }
}
