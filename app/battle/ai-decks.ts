import { Card } from "./types"
import { Rarity } from "@/types/gacha"
import { RARITY_PROVISION_BASE, PROVISION_LIMIT, DECK_SIZE } from "./config"
import { getCardRole, getCardProvision } from "./utils"
import { PlayerCardUsage } from "./ai/adaptive-learning"

// ==========================================
// AI DECK GENERATOR (Simulated Gacha Pulls)
// ==========================================

// Simulate gacha rarity roll (similar to gacha system)
function simulateGachaRoll(difficultyModifier: number = 0): Rarity {
  const rarityWeights = [
    { rarity: "trash" as Rarity, weight: 35 },
    { rarity: "common" as Rarity, weight: 30 },
    { rarity: "uncommon" as Rarity, weight: 20 },
    { rarity: "rare" as Rarity, weight: 10 },
    { rarity: "super_rare" as Rarity, weight: 4 },
    { rarity: "epic" as Rarity, weight: 1 },
  ]

  // Adjust weights based on difficulty
  const adjustedWeights = rarityWeights.map(rw => {
    if (difficultyModifier > 0 && ["rare", "super_rare", "epic"].includes(rw.rarity)) {
      return { ...rw, weight: rw.weight + difficultyModifier }
    }
    return rw
  })

  const totalWeight = adjustedWeights.reduce((sum, rw) => sum + rw.weight, 0)
  let random = Math.random() * totalWeight

  for (const { rarity, weight } of adjustedWeights) {
    random -= weight
    if (random <= 0) return rarity
  }

  return "trash"
}

// Generate random stats based on rarity (similar to gacha actions.ts)
function generateRandomStats(rarity: Rarity) {
  const rarityIndex = ["trash", "common", "uncommon", "rare", "super_rare", "epic"].indexOf(rarity)
  const baseMin = [5, 12, 19, 26, 33, 40][rarityIndex] || 5
  const baseMax = [25, 32, 39, 46, 53, 60][rarityIndex] || 25

  const roll = (min: number, max: number) => Math.min(Math.floor(Math.random() * (max - min + 1) + min), 100)

  return {
    hp: roll(baseMin, baseMax),
    atk: roll(baseMin, baseMax),
    def: roll(baseMin, baseMax),
    spd: roll(baseMin, baseMax),
    luck: roll(baseMin, baseMax)
  }
}

// Sample anime names for generated cards
const SAMPLE_ANIMES = [
  "Naruto", "One Piece", "Bleach", "Attack on Titan", "My Hero Academia",
  "Demon Slayer", "Jujutsu Kaisen", "Dragon Ball", "Black Clover", "Fairy Tail"
]

// Sample character names by anime
const SAMPLE_CHARACTERS: Record<string, string[]> = {
  "Naruto": ["Наруто Узумаки", "Саске Учиха", "Сакура Харуно", "Какаши Хатаке", "Рок Ли"],
  "One Piece": ["Монки Д. Луффи", "Ророноа Зоро", "Нами", "Санжи", "Усопп"],
  "Bleach": ["Ичиго Куросаки", "Рукия Кучики", "Ренджи Абарай", "Орихиме Иноуэ", "Бьюакуя"],
  "Attack on Titan": ["Эрен Йегер", "Микаса Аккерман", "Леви Аккерман", "Армин Арлерт", "Саша"],
  "My Hero Academia": ["Деку", "Бакуго", "Тодороки", "Уракака", "Иида"],
  "Demon Slayer": ["Танджиро Камадо", "Незуко Камадо", "Дзэнитсу", "Иносаукэ", "Ренгоку"],
  "Jujutsu Kaisen": ["Юдзи Итадори", "Мэгуми Фусигуро", "Нобара Кугисаки", "Сатору Годзё", "Годжо"],
  "Dragon Ball": ["Гоку", "Веджета", "Гохан", "Пикколо", "Транкс"],
  "Black Clover": ["Аста", "Юно", "Ноэль", "Юми", "Лаки"],
  "Fairy Tail": ["Нацу", "Люси", "Грей", "Эрза", "Венди"]
}

// Generate a single random card
function generateRandomCard(difficultyModifier: number = 0, cardIndex: number): Card {
  const rarity = simulateGachaRoll(difficultyModifier)
  const anime = SAMPLE_ANIMES[Math.floor(Math.random() * SAMPLE_ANIMES.length)]
  const characters = SAMPLE_CHARACTERS[anime] || ["Персонаж"]
  const name = characters[Math.floor(Math.random() * characters.length)]

  const stats = generateRandomStats(rarity)
  const role = getCardRole({ uniqueId: "", name, anime, rarity, imageUrl: "", stats } as Card)
  const card = { uniqueId: `ai-generated-${cardIndex}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, name, anime, rarity, imageUrl: `https://shikimori.one/system/characters/original/${1000 + cardIndex}.jpg`, stats, role }
  const provisionCost = getCardProvision(card)

  return {
    ...card,
    provisionCost
  }
}

// Generate a random deck from simulated gacha pulls
export function generateRandomAIDeck(difficultyModifier: number = 0, targetProvision: number = PROVISION_LIMIT): Card[] {
  const deck: Card[] = []
  let totalProvision = 0
  let attempts = 0
  const maxAttempts = 100

  // Simulate opening 20 packs and collecting cards
  const cardPool: Card[] = []
  for (let i = 0; i < 20; i++) {
    const card = generateRandomCard(difficultyModifier, i)
    cardPool.push(card)
  }

  // Sort by provision cost (higher rarity first) to try to fit best cards
  cardPool.sort((a, b) => getCardProvision(b) - getCardProvision(a))

  // Build deck from pool (greedy algorithm)
  while (deck.length < DECK_SIZE && attempts < maxAttempts) {
    attempts++

    // Try to add highest provision card that fits
    for (const card of cardPool) {
      // Check for duplicate characters (same name + anime) instead of uniqueId
      if (deck.some(c => c.name === card.name && c.anime === card.anime)) continue

      const cardProvision = getCardProvision(card)
      if (totalProvision + cardProvision <= targetProvision) {
        deck.push(card)
        totalProvision += cardProvision
        break
      }
    }

    // If we can't add more cards but have space, try with lower provision cards
    if (deck.length < DECK_SIZE && attempts > maxAttempts / 2) {
      for (const card of cardPool.reverse()) {
        // Check for duplicate characters (same name + anime) instead of uniqueId
        if (deck.some(c => c.name === card.name && c.anime === card.anime)) continue

        const cardProvision = getCardProvision(card)
        if (totalProvision + cardProvision <= targetProvision) {
          deck.push(card)
          totalProvision += cardProvision
          break
        }
      }
    }
  }

  // If we still don't have enough cards, fill with trash/common cards
  let fillerAttempts = 0
  while (deck.length < DECK_SIZE && fillerAttempts < 50) {
    fillerAttempts++
    const fillerCard = generateRandomCard(-2, deck.length + fillerAttempts) // Very easy rolls
    // Prevent duplicate characters (same name + anime)
    if (deck.some(c => c.name === fillerCard.name && c.anime === fillerCard.anime)) continue
    deck.push(fillerCard)
  }

  return deck
}

// Pre-defined AI decks for each dungeon
// Each deck contains exactly 8 cards. Provision cost is calculated dynamically based on stats.
export const AI_DECKS: Record<string, Card[]> = {
  // Dark Forest - Beginner dungeon
  "dark_forest": [
    { uniqueId: "ai-dark-1", name: "Какаши Хатаке", anime: "Naruto", rarity: "rare" as Rarity, imageUrl: "https://shikimori.one/system/characters/original/85.jpg", stats: { hp: 70, atk: 75, def: 50, spd: 60, luck: 55 } },
    { uniqueId: "ai-dark-2", name: "Наруто Узумаки", anime: "Naruto", rarity: "rare" as Rarity, imageUrl: "https://shikimori.one/system/characters/original/17.jpg", stats: { hp: 90, atk: 85, def: 55, spd: 65, luck: 50 } },
    { uniqueId: "ai-dark-3", name: "Сакура Харуно", anime: "Naruto", rarity: "rare" as Rarity, imageUrl: "https://shikimori.one/system/characters/original/145.jpg", stats: { hp: 100, atk: 50, def: 80, spd: 45, luck: 40 } },
    { uniqueId: "ai-dark-4", name: "Рок Ли", anime: "Naruto", rarity: "rare" as Rarity, imageUrl: "https://shikimori.one/system/characters/original/306.jpg", stats: { hp: 75, atk: 90, def: 35, spd: 100, luck: 30 } },
    { uniqueId: "ai-dark-5", name: "Нидзи Хьюга", anime: "Naruto", rarity: "super_rare" as Rarity, imageUrl: "https://shikimori.one/system/characters/original/1694.jpg", stats: { hp: 70, atk: 60, def: 65, spd: 95, luck: 45 } },
    { uniqueId: "ai-dark-6", name: "Шикамару Нара", anime: "Naruto", rarity: "super_rare" as Rarity, imageUrl: "https://shikimori.one/system/characters/original/2007.jpg", stats: { hp: 65, atk: 50, def: 55, spd: 50, luck: 80 } },
    { uniqueId: "ai-dark-7", name: "Гаара", anime: "Naruto", rarity: "super_rare" as Rarity, imageUrl: "https://shikimori.one/system/characters/original/1662.jpg", stats: { hp: 80, atk: 55, def: 90, spd: 50, luck: 45 } },
    { uniqueId: "ai-dark-8", name: "Саске Учиха", anime: "Naruto", rarity: "rare" as Rarity, imageUrl: "https://shikimori.one/system/characters/original/13.jpg", stats: { hp: 75, atk: 80, def: 50, spd: 85, luck: 50 } },
  ].map(card => ({ ...card, provisionCost: getCardProvision(card) })),

  // Volcanic Cave - Mid tier
  "volcano": [
    { uniqueId: "ai-volc-1", name: "Ророноа Зоро", anime: "One Piece", rarity: "epic" as Rarity, imageUrl: "https://shikimori.one/system/characters/original/62.jpg", stats: { hp: 100, atk: 110, def: 60, spd: 70, luck: 50 } },
    { uniqueId: "ai-volc-2", name: "Саске Учиха", anime: "Naruto", rarity: "epic" as Rarity, imageUrl: "https://shikimori.one/system/characters/original/13.jpg", stats: { hp: 100, atk: 105, def: 55, spd: 90, luck: 55 } },
    { uniqueId: "ai-volc-3", name: "Санжи", anime: "One Piece", rarity: "epic" as Rarity, imageUrl: "https://shikimori.one/system/characters/original/305.jpg", stats: { hp: 90, atk: 100, def: 60, spd: 80, luck: 55 } },
    { uniqueId: "ai-volc-4", name: "Гаара", anime: "Naruto", rarity: "rare" as Rarity, imageUrl: "https://shikimori.one/system/characters/original/1662.jpg", stats: { hp: 110, atk: 50, def: 85, spd: 45, luck: 40 } },
    { uniqueId: "ai-volc-5", name: "Нами", anime: "One Piece", rarity: "uncommon" as Rarity, imageUrl: "https://shikimori.one/system/characters/original/723.jpg", stats: { hp: 70, atk: 65, def: 50, spd: 90, luck: 65 } },
    { uniqueId: "ai-volc-6", name: "Усопп", anime: "One Piece", rarity: "uncommon" as Rarity, imageUrl: "https://shikimori.one/system/characters/original/724.jpg", stats: { hp: 65, atk: 60, def: 50, spd: 70, luck: 85 } },
    { uniqueId: "ai-volc-7", name: "Рок Ли", anime: "Naruto", rarity: "rare" as Rarity, imageUrl: "https://shikimori.one/system/characters/original/306.jpg", stats: { hp: 70, atk: 85, def: 40, spd: 95, luck: 35 } },
    { uniqueId: "ai-volc-8", name: "Тони Тони Чоппер", anime: "One Piece", rarity: "uncommon" as Rarity, imageUrl: "https://shikimori.one/system/characters/original/309.jpg", stats: { hp: 80, atk: 60, def: 60, spd: 65, luck: 70 } },
  ].map(card => ({ ...card, provisionCost: getCardProvision(card) })),

  // Ocean Depths - High mid tier
  "ocean": [
    { uniqueId: "ai-ocean-1", name: "Ичиго Куросаки", anime: "Bleach", rarity: "legendary" as Rarity, imageUrl: "https://shikimori.one/system/characters/original/5.jpg", stats: { hp: 125, atk: 120, def: 75, spd: 90, luck: 60 } },
    { uniqueId: "ai-ocean-2", name: "Рукия Кучики", anime: "Bleach", rarity: "epic" as Rarity, imageUrl: "https://shikimori.one/system/characters/original/6.jpg", stats: { hp: 90, atk: 95, def: 65, spd: 85, luck: 50 } },
    { uniqueId: "ai-ocean-3", name: "Брук", anime: "One Piece", rarity: "super_rare" as Rarity, imageUrl: "https://shikimori.one/system/characters/original/5627.jpg", stats: { hp: 90, atk: 95, def: 60, spd: 75, luck: 50 } },
    { uniqueId: "ai-ocean-4", name: "Ренджи Абарай", anime: "Bleach", rarity: "rare" as Rarity, imageUrl: "https://shikimori.one/system/characters/original/906.jpg", stats: { hp: 100, atk: 80, def: 80, spd: 60, luck: 45 } },
    { uniqueId: "ai-ocean-5", name: "Фрэнки", anime: "One Piece", rarity: "uncommon" as Rarity, imageUrl: "https://shikimori.one/system/characters/original/64.jpg", stats: { hp: 110, atk: 60, def: 85, spd: 45, luck: 40 } },
    { uniqueId: "ai-ocean-6", name: "Орихиме Иноуэ", anime: "Bleach", rarity: "uncommon" as Rarity, imageUrl: "https://shikimori.one/system/characters/original/7.jpg", stats: { hp: 90, atk: 40, def: 75, spd: 50, luck: 60 } },
    { uniqueId: "ai-ocean-7", name: "Усопп", anime: "One Piece", rarity: "uncommon" as Rarity, imageUrl: "https://shikimori.one/system/characters/original/724.jpg", stats: { hp: 70, atk: 65, def: 55, spd: 75, luck: 80 } },
    { uniqueId: "ai-ocean-8", name: "Нами", anime: "One Piece", rarity: "common" as Rarity, imageUrl: "https://shikimori.one/system/characters/original/723.jpg", stats: { hp: 65, atk: 60, def: 45, spd: 80, luck: 60 } },
  ].map(card => ({ ...card, provisionCost: getCardProvision(card) })),

  // Sky Castle - Elite tier
  "sky_castle": [
    { uniqueId: "ai-sky-1", name: "Эрен Йегер", anime: "Attack on Titan", rarity: "legendary" as Rarity, imageUrl: "https://shikimori.one/system/characters/original/40882.jpg", stats: { hp: 140, atk: 130, def: 85, spd: 100, luck: 55 } },
    { uniqueId: "ai-sky-2", name: "Леви Аккерман", anime: "Attack on Titan", rarity: "epic" as Rarity, imageUrl: "https://shikimori.one/system/characters/original/45627.jpg", stats: { hp: 100, atk: 120, def: 65, spd: 110, luck: 50 } },
    { uniqueId: "ai-sky-3", name: "Микаса Аккерман", anime: "Attack on Titan", rarity: "epic" as Rarity, imageUrl: "https://shikimori.one/system/characters/original/40881.jpg", stats: { hp: 160, atk: 110, def: 100, spd: 105, luck: 50 } },
    { uniqueId: "ai-sky-4", name: "Деку", anime: "My Hero Academia", rarity: "rare" as Rarity, imageUrl: "https://shikimori.one/system/characters/original/117909.jpg", stats: { hp: 130, atk: 100, def: 75, spd: 85, luck: 50 } },
    { uniqueId: "ai-sky-5", name: "Армин Арлерт", anime: "Attack on Titan", rarity: "uncommon" as Rarity, imageUrl: "https://shikimori.one/system/characters/original/46494.jpg", stats: { hp: 125, atk: 65, def: 75, spd: 75, luck: 90 } },
    { uniqueId: "ai-sky-6", name: "Уракака", anime: "My Hero Academia", rarity: "uncommon" as Rarity, imageUrl: "https://shikimori.one/system/characters/original/117917.jpg", stats: { hp: 100, atk: 60, def: 80, spd: 60, luck: 50 } },
    { uniqueId: "ai-sky-7", name: "Бакуго", anime: "My Hero Academia", rarity: "common" as Rarity, imageUrl: "https://shikimori.one/system/characters/original/117911.jpg", stats: { hp: 90, atk: 95, def: 55, spd: 80, luck: 40 } },
    { uniqueId: "ai-sky-8", name: "Тодороки", anime: "My Hero Academia", rarity: "common" as Rarity, imageUrl: "https://shikimori.one/system/characters/original/117915.jpg", stats: { hp: 95, atk: 90, def: 60, spd: 75, luck: 45 } },
  ].map(card => ({ ...card, provisionCost: getCardProvision(card) })),

  // Demon Realm - Boss tier
  "demon_realm": [
    { uniqueId: "ai-demon-1", name: "Сатору Годжо", anime: "Jujutsu Kaisen", rarity: "ancient" as Rarity, imageUrl: "https://shikimori.one/system/characters/original/164471.jpg", stats: { hp: 175, atk: 155, def: 110, spd: 125, luck: 70 } },
    { uniqueId: "ai-demon-2", name: "Танджиро Камадо", anime: "Demon Slayer", rarity: "legendary" as Rarity, imageUrl: "https://shikimori.one/system/characters/original/146156.jpg", stats: { hp: 195, atk: 125, def: 105, spd: 100, luck: 60 } },
    { uniqueId: "ai-demon-3", name: "Незуко Камадо", anime: "Demon Slayer", rarity: "epic" as Rarity, imageUrl: "https://shikimori.one/system/characters/original/146157.jpg", stats: { hp: 225, atk: 90, def: 110, spd: 90, luck: 55 } },
    { uniqueId: "ai-demon-4", name: "Мегуми Фушигуро", anime: "Jujutsu Kaisen", rarity: "super_rare" as Rarity, imageUrl: "https://shikimori.one/system/characters/original/164470.jpg", stats: { hp: 120, atk: 110, def: 80, spd: 100, luck: 60 } },
    { uniqueId: "ai-demon-5", name: "Дзэнитсу", anime: "Demon Slayer", rarity: "uncommon" as Rarity, imageUrl: "https://shikimori.one/system/characters/original/146158.jpg", stats: { hp: 125, atk: 135, def: 75, spd: 120, luck: 50 } },
    { uniqueId: "ai-demon-6", name: "Нобара Кугисаки", anime: "Jujutsu Kaisen", rarity: "common" as Rarity, imageUrl: "https://shikimori.one/system/characters/original/164472.jpg", stats: { hp: 90, atk: 85, def: 65, spd: 75, luck: 50 } },
    { uniqueId: "ai-demon-7", name: "Иносаукэ", anime: "Demon Slayer", rarity: "trash" as Rarity, imageUrl: "https://shikimori.one/system/characters/original/146159.jpg", stats: { hp: 80, atk: 85, def: 50, spd: 70, luck: 30 } },
    { uniqueId: "ai-demon-8", name: "Ренгоку", anime: "Demon Slayer", rarity: "trash" as Rarity, imageUrl: "https://shikimori.one/system/characters/original/148417.jpg", stats: { hp: 85, atk: 90, def: 55, spd: 75, luck: 40 } },
  ].map(card => ({ ...card, provisionCost: getCardProvision(card) })),

  // Grand Tournament - Legendary tier
  "tournament": [
    { uniqueId: "ai-tourn-1", name: "Аин", anime: "One Piece", rarity: "transcendent" as Rarity, imageUrl: "https://shikimori.one/system/characters/original/67143.jpg", stats: { hp: 245, atk: 245, def: 170, spd: 155, luck: 100 } },
    { uniqueId: "ai-tourn-2", name: "Сайтама", anime: "One Punch Man", rarity: "divine" as Rarity, imageUrl: "https://shikimori.one/system/characters/original/73935.jpg", stats: { hp: 315, atk: 265, def: 140, spd: 70, luck: 35 } },
    { uniqueId: "ai-tourn-3", name: "Гоку", anime: "Dragon Ball", rarity: "uncommon" as Rarity, imageUrl: "https://shikimori.one/system/characters/original/246.jpg", stats: { hp: 150, atk: 120, def: 95, spd: 90, luck: 60 } },
    { uniqueId: "ai-tourn-4", name: "Мадара Учиха", anime: "Naruto", rarity: "common" as Rarity, imageUrl: "https://shikimori.one/system/characters/original/53901.jpg", stats: { hp: 130, atk: 125, def: 100, spd: 95, luck: 50 } },
    { uniqueId: "ai-tourn-5", name: "Веджета", anime: "Dragon Ball", rarity: "common" as Rarity, imageUrl: "https://shikimori.one/system/characters/original/913.jpg", stats: { hp: 120, atk: 120, def: 90, spd: 90, luck: 50 } },
    { uniqueId: "ai-tourn-6", name: "Гаро", anime: "One Punch Man", rarity: "common" as Rarity, imageUrl: "https://shikimori.one/system/characters/original/112889.jpg", stats: { hp: 125, atk: 115, def: 95, spd: 100, luck: 50 } },
    { uniqueId: "ai-tourn-7", name: "Пикколо", anime: "Dragon Ball", rarity: "common" as Rarity, imageUrl: "https://shikimori.one/system/characters/original/915.jpg", stats: { hp: 110, atk: 100, def: 95, spd: 85, luck: 50 } },
    { uniqueId: "ai-tourn-8", name: "Транкс", anime: "Dragon Ball", rarity: "trash" as Rarity, imageUrl: "https://shikimori.one/system/characters/original/247.jpg", stats: { hp: 100, atk: 105, def: 80, spd: 90, luck: 45 } },
  ].map(card => ({ ...card, provisionCost: getCardProvision(card) })),

  // Daily battle - Mid-high tier
  "daily": [
    { uniqueId: "ai-daily-1", name: "Астa", anime: "Black Clover", rarity: "legendary" as Rarity, imageUrl: "https://shikimori.one/system/characters/original/124731.jpg", stats: { hp: 130, atk: 130, def: 90, spd: 105, luck: 65 } },
    { uniqueId: "ai-daily-2", name: "Юно", anime: "Black Clover", rarity: "mythic" as Rarity, imageUrl: "https://shikimori.one/system/characters/original/124732.jpg", stats: { hp: 160, atk: 100, def: 100, spd: 85, luck: 60 } },
    { uniqueId: "ai-daily-3", name: "Мелодиас", anime: "Seven Deadly Sins", rarity: "epic" as Rarity, imageUrl: "https://shikimori.one/system/characters/original/72921.jpg", stats: { hp: 195, atk: 120, def: 110, spd: 85, luck: 60 } },
    { uniqueId: "ai-daily-4", name: "Сабо", anime: "One Piece", rarity: "super_rare" as Rarity, imageUrl: "https://shikimori.one/system/characters/original/32893.jpg", stats: { hp: 125, atk: 110, def: 85, spd: 100, luck: 55 } },
    { uniqueId: "ai-daily-5", name: "Кару", anime: "Naruto", rarity: "rare" as Rarity, imageUrl: "https://shikimori.one/system/characters/original/22248.jpg", stats: { hp: 90, atk: 85, def: 65, spd: 80, luck: 50 } },
    { uniqueId: "ai-daily-6", name: "Хиен", anime: "Naruto", rarity: "uncommon" as Rarity, imageUrl: "https://shikimori.one/system/characters/original/2792.jpg", stats: { hp: 125, atk: 90, def: 100, spd: 85, luck: 55 } },
    { uniqueId: "ai-daily-7", name: "Ноэль", anime: "Black Clover", rarity: "trash" as Rarity, imageUrl: "https://shikimori.one/system/characters/original/124733.jpg", stats: { hp: 80, atk: 75, def: 60, spd: 70, luck: 50 } },
    { uniqueId: "ai-daily-8", name: "Юми", anime: "Black Clover", rarity: "trash" as Rarity, imageUrl: "https://shikimori.one/system/characters/original/124734.jpg", stats: { hp: 90, atk: 95, def: 70, spd: 65, luck: 45 } },
  ].map(card => ({ ...card, provisionCost: getCardProvision(card) })),

  // Daily Market Deck 1 - Frieren Power (High tier)
  "daily_market_1": [
    { uniqueId: "market-1-1", name: "Ферн", anime: "Провожающая в последний путь Фрирен", rarity: "omnipotent" as Rarity, imageUrl: "https://files.yande.re/image/21766019c33763e78e32f5a0b3e22076/yande.re%201256576%20bandages%20elf%20fern%20frieren%20pointy_ears%20sousou_no_frieren%20stark%20tagme.jpg", stats: { hp: 94, atk: 91, def: 97, spd: 97, luck: 100 } },
    { uniqueId: "market-1-2", name: "Фрирен", anime: "Провожающая в последний путь Фрирен", rarity: "ancient" as Rarity, imageUrl: "https://shikimori.one/system/characters/original/184947.jpg", stats: { hp: 64, atk: 79, def: 82, spd: 67, luck: 73 } },
    { uniqueId: "market-1-3", name: "Наруто Узумаки", anime: "Наруто: Последний фильм", rarity: "super_rare" as Rarity, imageUrl: "https://safebooru.org/images/1842/0e06d477880ced203e25823c228d59ad68f674ec.jpg", stats: { hp: 44, atk: 37, def: 35, spd: 43, luck: 50 } },
    { uniqueId: "market-1-4", name: "Ниро Юдзурисаки", anime: "Детективное агентство Милки Холмс 3", rarity: "uncommon" as Rarity, imageUrl: "https://konachan.net/image/cbf31f19580d5f079c367cd604631050/Konachan.com%20-%2093596%20cordelia_glauca%20hercule_barton%20sherlock_shellingford%20tantei_opera_milky_holmes%20yuzurizaki_nero.jpg", stats: { hp: 15, atk: 22, def: 19, spd: 30, luck: 32 } },
    { uniqueId: "market-1-5", name: "Котори Сиракава", anime: "С начала. Часть I", rarity: "common" as Rarity, imageUrl: "https://shikimori.one/system/characters/original/2387.jpg", stats: { hp: 13, atk: 12, def: 16, spd: 32, luck: 15 } },
    { uniqueId: "market-1-6", name: "Дакэми", anime: "Б — улица рэперов", rarity: "trash" as Rarity, imageUrl: "https://shikimori.one/system/characters/original/170864.jpg", stats: { hp: 15, atk: 20, def: 25, spd: 5, luck: 25 } },
    { uniqueId: "market-1-7", name: "Саяка Табэ", anime: "Девушки, покоряющие новые горизонты", rarity: "trash" as Rarity, imageUrl: "https://shikimori.one/system/characters/original/138648.jpg", stats: { hp: 8, atk: 24, def: 8, spd: 10, luck: 21 } },
    { uniqueId: "market-1-8", name: "Хакуфу Сонсаку", anime: "Сила тысячи", rarity: "trash" as Rarity, imageUrl: "https://safebooru.org/images/1880/c2911f8795b5f2e0c030de1359939ea64dff09bb.jpeg", stats: { hp: 15, atk: 14, def: 20, spd: 12, luck: 15 } },
  ].map(card => ({ ...card, provisionCost: getCardProvision(card) })),

  // Daily Market Deck 2 - Jujutsu Kaisen Elite
  "daily_market_2": [
    { uniqueId: "market-2-1", name: "Мэгуми Фусигуро", anime: "Магическая битва: Смертельная миграция", rarity: "legendary" as Rarity, imageUrl: "https://safebooru.org/images/1842/23b738f985ca314edef731e126c3a12c36c7e7e7.jpg", stats: { hp: 65, atk: 74, def: 57, spd: 68, luck: 55 } },
    { uniqueId: "market-2-2", name: "Юдзи Итадори", anime: "Магическая битва: Смертельная миграция", rarity: "mythic" as Rarity, imageUrl: "https://safebooru.org/images/1070/643a1988dd3e8471ca4de8f176b6db6ab9da371c.png", stats: { hp: 64, atk: 59, def: 67, spd: 62, luck: 48 } },
    { uniqueId: "market-2-3", name: "Сатору Годзё", anime: "Магическая битва: Смертельная миграция", rarity: "epic" as Rarity, imageUrl: "https://safebooru.org/images/1331/a4bf038c7ee40efab4ec4b90b1cb912f874ce04e.jpg", stats: { hp: 54, atk: 51, def: 51, spd: 45, luck: 53 } },
    { uniqueId: "market-2-4", name: "Нобара Кугисаки", anime: "Магическая битва: Смертельная миграция", rarity: "super_rare" as Rarity, imageUrl: "https://safebooru.org/images/4395/e614360d0d8cd16e3b226d9a3b0909b68ac174f9.jpg", stats: { hp: 42, atk: 45, def: 38, spd: 40, luck: 35 } },
    { uniqueId: "market-2-5", name: "Джо Эйсел", anime: "Дикие Зойды: Начало", rarity: "rare" as Rarity, imageUrl: "https://s3.zerochan.net/600/46/26/3923846.jpg", stats: { hp: 44, atk: 37, def: 43, spd: 35, luck: 35 } },
    { uniqueId: "market-2-6", name: "Котори Сиракава", anime: "С начала. Часть I", rarity: "uncommon" as Rarity, imageUrl: "https://shikimori.one/system/characters/original/2387.jpg", stats: { hp: 15, atk: 14, def: 18, spd: 34, luck: 18 } },
    { uniqueId: "market-2-7", name: "Хакуфу Сонсаку", anime: "Сила тысячи", rarity: "trash" as Rarity, imageUrl: "https://safebooru.org/images/1880/c2911f8795b5f2e0c030de1359939ea64dff09bb.jpeg", stats: { hp: 15, atk: 15, def: 18, spd: 14, luck: 12 } },
    { uniqueId: "market-2-8", name: "Саяка Табэ", anime: "Девушки, покоряющие новые горизонты", rarity: "trash" as Rarity, imageUrl: "https://shikimori.one/system/characters/original/138648.jpg", stats: { hp: 8, atk: 24, def: 8, spd: 10, luck: 21 } },
  ].map(card => ({ ...card, provisionCost: getCardProvision(card) })),

  // Daily Market Deck 3 - Naruto Speedsters
  "daily_market_3": [
    { uniqueId: "market-3-1", name: "Нобара Кугисаки", anime: "Магическая битва: Смертельная миграция", rarity: "mythic" as Rarity, imageUrl: "https://safebooru.org/images/4395/e614360d0d8cd16e3b226d9a3b0909b68ac174f9.jpg", stats: { hp: 59, atk: 59, def: 61, spd: 56, luck: 49 } },
    { uniqueId: "market-3-2", name: "Наруто Узумаки", anime: "Наруто: Последний фильм", rarity: "super_rare" as Rarity, imageUrl: "https://safebooru.org/images/1842/0e06d477880ced203e25823c228d59ad68f674ec.jpg", stats: { hp: 44, atk: 37, def: 35, spd: 43, luck: 50 } },
    { uniqueId: "market-3-3", name: "Тэяки Учиха", anime: "Наруто", rarity: "super_rare" as Rarity, imageUrl: "https://shikimori.one/system/characters/original/23143.jpg", stats: { hp: 50, atk: 33, def: 50, spd: 34, luck: 37 } },
    { uniqueId: "market-3-4", name: "Лина", anime: "Триган: Ураган", rarity: "super_rare" as Rarity, imageUrl: "https://shikimori.one/system/characters/original/58671.jpg", stats: { hp: 43, atk: 40, def: 50, spd: 47, luck: 50 } },
    { uniqueId: "market-3-5", name: "Нао Томори", anime: "Шарлотта", rarity: "super_rare" as Rarity, imageUrl: "https://safebooru.org/images/4404/1e49953670bd6741eeb337d32e21fdaf25f98796.png", stats: { hp: 38, atk: 48, def: 34, spd: 38, luck: 41 } },
    { uniqueId: "market-3-6", name: "Дории", anime: "Прославленный: Маска истины", rarity: "uncommon" as Rarity, imageUrl: "https://shikimori.one/system/characters/original/2437.jpg", stats: { hp: 20, atk: 25, def: 30, spd: 38, luck: 28 } },
    { uniqueId: "market-3-7", name: "Котори Сиракава", anime: "С начала. Часть I", rarity: "common" as Rarity, imageUrl: "https://shikimori.one/system/characters/original/2387.jpg", stats: { hp: 13, atk: 12, def: 16, spd: 32, luck: 15 } },
    { uniqueId: "market-3-8", name: "Хакуфу Сонсаку", anime: "Сила тысячи", rarity: "common" as Rarity, imageUrl: "https://safebooru.org/images/1880/c2911f8795b5f2e0c030de1359939ea64dff09bb.jpeg", stats: { hp: 25, atk: 23, def: 31, spd: 22, luck: 20 } },
  ].map(card => ({ ...card, provisionCost: getCardProvision(card) })),

  // Daily Market Deck 4 - Mixed Power
  "daily_market_4": [
    { uniqueId: "market-4-1", name: "Леорио Паладинайт", anime: "Охотник х Охотник (2011)", rarity: "transcendent" as Rarity, imageUrl: "https://s3.zerochan.net/600/15/41/3337065.jpg", stats: { hp: 90, atk: 90, def: 82, spd: 82, luck: 91 } },
    { uniqueId: "market-4-2", name: "Симон", anime: "Гуррен-Лаганн, пронзающий небеса", rarity: "legendary" as Rarity, imageUrl: "https://safebooru.org/images/3048/e8a1e6f31233901bb9eebe9c205fe82b41c33a86.jpg", stats: { hp: 61, atk: 56, def: 67, spd: 55, luck: 72 } },
    { uniqueId: "market-4-3", name: "Лавине", anime: "Провожающая в последний путь Фрирен", rarity: "epic" as Rarity, imageUrl: "https://s3.zerochan.net/600/07/49/4124957.jpg", stats: { hp: 45, atk: 40, def: 42, spd: 50, luck: 45 } },
    { uniqueId: "market-4-4", name: "Канне", anime: "Провожающая в последний путь Фрирен", rarity: "uncommon" as Rarity, imageUrl: "https://s3.zerochan.net/600/33/21/4193583.jpg", stats: { hp: 35, atk: 32, def: 34, spd: 40, luck: 35 } },
    { uniqueId: "market-4-5", name: "Хакуфу Сонсаку", anime: "Сила тысячи", rarity: "common" as Rarity, imageUrl: "https://safebooru.org/images/1880/c2911f8795b5f2e0c030de1359939ea64dff09bb.jpeg", stats: { hp: 25, atk: 23, def: 31, spd: 22, luck: 20 } },
    { uniqueId: "market-4-6", name: "Котори Сиракава", anime: "С начала. Часть I", rarity: "common" as Rarity, imageUrl: "https://shikimori.one/system/characters/original/2387.jpg", stats: { hp: 13, atk: 12, def: 16, spd: 32, luck: 15 } },
    { uniqueId: "market-4-7", name: "Дакэми", anime: "Б — улица рэперов", rarity: "trash" as Rarity, imageUrl: "https://shikimori.one/system/characters/original/170864.jpg", stats: { hp: 15, atk: 20, def: 25, spd: 5, luck: 25 } },
    { uniqueId: "market-4-8", name: "Саяка Табэ", anime: "Девушки, покоряющие новые горизонты", rarity: "trash" as Rarity, imageUrl: "https://shikimori.one/system/characters/original/138648.jpg", stats: { hp: 8, atk: 24, def: 8, spd: 10, luck: 21 } },
  ].map(card => ({ ...card, provisionCost: getCardProvision(card) })),
}

// Get AI deck for a specific dungeon theme
export function getAIDeckForDungeon(theme: string): Card[] {
  // Use random generator for beginner dungeons
  if (theme === "tutorial_forest" || theme === "peaceful_meadow") {
    const difficultyModifier = theme === "tutorial_forest" ? -3 : -2
    return generateRandomAIDeck(difficultyModifier, PROVISION_LIMIT)
  }

  // Use random generator for dark_forest as well (now it's a mid-tier dungeon)
  if (theme === "dark_forest") {
    return generateRandomAIDeck(0, PROVISION_LIMIT) // Normal difficulty
  }

  const deck = AI_DECKS[theme]
  if (!deck) {
    // Fallback to generated deck if theme not found
    return generateRandomAIDeck(0, PROVISION_LIMIT)
  }
  return deck
}

// Generate adaptive AI deck based on player's favorite cards (counter-pick strategy)
export function generateAdaptiveAIDeck(
  playerFavoriteCards: PlayerCardUsage[],
  baseDeck: Card[],
  targetProvision: number = PROVISION_LIMIT
): Card[] {
  if (playerFavoriteCards.length === 0) {
    return baseDeck.slice(0, DECK_SIZE)
  }

  // Get counter roles for player's favorite cards
  const counterRoles: string[] = []
  const topFavorites = playerFavoriteCards.slice(0, 3)
  
  topFavorites.forEach(fav => {
    if (fav.role === 'vanguard') counterRoles.push('guard')
    if (fav.role === 'guard') counterRoles.push('trickster')
    if (fav.role === 'trickster') counterRoles.push('vanguard')
  })

  // Filter base deck for cards with counter roles
  const counterCards = baseDeck.filter(card => {
    const cardRole = getCardRole(card)
    return counterRoles.includes(cardRole)
  })

  // If we have enough counter cards, prioritize them
  if (counterCards.length >= DECK_SIZE) {
    // Sort by provision to fit within limit
    counterCards.sort((a, b) => getCardProvision(b) - getCardProvision(a))
    
    const adaptiveDeck: Card[] = []
    let totalProvision = 0
    
    for (const card of counterCards) {
      if (adaptiveDeck.length >= DECK_SIZE) break
      // Check for duplicate characters (same name + anime)
      if (adaptiveDeck.some(c => c.name === card.name && c.anime === card.anime)) continue
      const cardProvision = getCardProvision(card)
      if (totalProvision + cardProvision <= targetProvision) {
        adaptiveDeck.push(card)
        totalProvision += cardProvision
      }
    }
    
    // Fill remaining slots with random cards from base deck
    while (adaptiveDeck.length < DECK_SIZE) {
      const remainingCards = baseDeck.filter(c => !adaptiveDeck.includes(c))
      if (remainingCards.length === 0) break
      const randomCard = remainingCards[Math.floor(Math.random() * remainingCards.length)]
      // Check for duplicate characters (same name + anime)
      if (adaptiveDeck.some(c => c.name === randomCard.name && c.anime === randomCard.anime)) continue
      const cardProvision = getCardProvision(randomCard)
      if (totalProvision + cardProvision <= targetProvision) {
        adaptiveDeck.push(randomCard)
        totalProvision += cardProvision
      }
    }
    
    return adaptiveDeck
  }

  // Fallback: return base deck with some counter cards mixed in
  const mixedDeck = [...baseDeck]
  const counterCount = Math.min(counterCards.length, 2)
  const usedIndices = new Set<number>()
  
  // Replace some cards with counter cards (avoid duplicates)
  for (let i = 0; i < counterCount; i++) {
    // Find an index to replace that isn't already the same counter card
    // and isn't already used for another replacement
    const counterCard = counterCards[i]
    // Skip if counter card is already in the deck at a position we haven't replaced
    const existingIndex = mixedDeck.findIndex((c, idx) => 
      c.name === counterCard.name && c.anime === counterCard.anime && !usedIndices.has(idx)
    )
    if (existingIndex >= 0) {
      usedIndices.add(existingIndex)
      continue // Card already in deck, no need to add again
    }
    // Find a random index to replace that hasn't been used yet
    let attempts = 0
    let randomIndex = Math.floor(Math.random() * mixedDeck.length)
    while (usedIndices.has(randomIndex) && attempts < 10) {
      randomIndex = Math.floor(Math.random() * mixedDeck.length)
      attempts++
    }
    if (usedIndices.has(randomIndex)) break
    usedIndices.add(randomIndex)
    mixedDeck[randomIndex] = counterCard
  }
  
  return mixedDeck.slice(0, DECK_SIZE)
}

// Get random market deck for daily market battles
export function getRandomMarketDeck(): Card[] {
  const marketDecks = [
    AI_DECKS["daily_market_1"],
    AI_DECKS["daily_market_2"],
    AI_DECKS["daily_market_3"],
    AI_DECKS["daily_market_4"]
  ].filter((deck): deck is Card[] => deck !== undefined)

  if (marketDecks.length === 0) {
    return AI_DECKS["daily"] || []
  }

  const randomIndex = Math.floor(Math.random() * marketDecks.length)
  return marketDecks[randomIndex]
}