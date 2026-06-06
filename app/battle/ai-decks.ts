import { Card } from "./types"
import { Rarity } from "@/types/gacha"
import { RARITY_PROVISION_MAP, PROVISION_LIMIT, DECK_SIZE } from "./config"
import { getCardRole } from "./utils"
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

  return {
    uniqueId: `ai-generated-${cardIndex}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name,
    anime,
    rarity,
    imageUrl: `https://shikimori.one/system/characters/original/${1000 + cardIndex}.jpg`,
    stats,
    role,
    provisionCost: RARITY_PROVISION_MAP[rarity]
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
  cardPool.sort((a, b) => (b.provisionCost || 0) - (a.provisionCost || 0))

  // Build deck from pool (greedy algorithm)
  while (deck.length < DECK_SIZE && attempts < maxAttempts) {
    attempts++

    // Try to add highest provision card that fits
    for (const card of cardPool) {
      if (deck.some(c => c.uniqueId === card.uniqueId)) continue

      const cardProvision = card.provisionCost || RARITY_PROVISION_MAP[card.rarity]
      if (totalProvision + cardProvision <= targetProvision) {
        deck.push(card)
        totalProvision += cardProvision
        break
      }
    }

    // If we can't add more cards but have space, try with lower provision cards
    if (deck.length < DECK_SIZE && attempts > maxAttempts / 2) {
      for (const card of cardPool.reverse()) {
        if (deck.some(c => c.uniqueId === card.uniqueId)) continue

        const cardProvision = card.provisionCost || RARITY_PROVISION_MAP[card.rarity]
        if (totalProvision + cardProvision <= targetProvision) {
          deck.push(card)
          totalProvision += cardProvision
          break
        }
      }
    }
  }

  // If we still don't have enough cards, fill with trash/common cards
  while (deck.length < DECK_SIZE) {
    const fillerCard = generateRandomCard(-2, deck.length + 100) // Very easy rolls
    deck.push(fillerCard)
  }

  return deck
}

// Pre-defined AI decks for each dungeon
// Each deck contains 6 cards with 30 provision total (matching daily decks)
export const AI_DECKS: Record<string, Card[]> = {
  // Dark Forest - Beginner dungeon (difficulty 1)
  // Naruto-themed low-mid tier characters - Total: 30 provision (6+6+4+4+5+5)
  "dark_forest": [
    { uniqueId: "ai-dark-1", name: "Какаши Хатаке", anime: "Naruto", rarity: "rare" as Rarity, imageUrl: "https://shikimori.one/system/characters/original/85.jpg", stats: { hp: 70, atk: 75, def: 50, spd: 60, luck: 55 } }, // Vanguard
    { uniqueId: "ai-dark-2", name: "Наруто Узумаки", anime: "Naruto", rarity: "rare" as Rarity, imageUrl: "https://shikimori.one/system/characters/original/17.jpg", stats: { hp: 90, atk: 85, def: 55, spd: 65, luck: 50 } }, // Vanguard
    { uniqueId: "ai-dark-3", name: "Сакура Харуно", anime: "Naruto", rarity: "rare" as Rarity, imageUrl: "https://shikimori.one/system/characters/original/145.jpg", stats: { hp: 100, atk: 50, def: 80, spd: 45, luck: 40 } }, // Guard
    { uniqueId: "ai-dark-4", name: "Рок Ли", anime: "Naruto", rarity: "rare" as Rarity, imageUrl: "https://shikimori.one/system/characters/original/306.jpg", stats: { hp: 75, atk: 90, def: 35, spd: 100, luck: 30 } }, // Trickster
    { uniqueId: "ai-dark-5", name: "Нидзи Хьюга", anime: "Naruto", rarity: "super_rare" as Rarity, imageUrl: "https://shikimori.one/system/characters/original/1694.jpg", stats: { hp: 70, atk: 60, def: 65, spd: 95, luck: 45 } }, // Trickster
    { uniqueId: "ai-dark-6", name: "Шикамару Нара", anime: "Naruto", rarity: "super_rare" as Rarity, imageUrl: "https://shikimori.one/system/characters/original/2007.jpg", stats: { hp: 65, atk: 50, def: 55, spd: 50, luck: 80 } }, // Trickster
  ],

  // Volcanic Cave - Mid tier (difficulty 3)
  // One Piece + Naruto mix - Total: 30 provision (6+6+6+6+3+3)
  "volcano": [
    { uniqueId: "ai-volc-1", name: "Ророноа Зоро", anime: "One Piece", rarity: "epic" as Rarity, imageUrl: "https://shikimori.one/system/characters/original/62.jpg", stats: { hp: 100, atk: 110, def: 60, spd: 70, luck: 50 } }, // Vanguard
    { uniqueId: "ai-volc-2", name: "Саске Учиха", anime: "Naruto", rarity: "epic" as Rarity, imageUrl: "https://shikimori.one/system/characters/original/13.jpg", stats: { hp: 100, atk: 105, def: 55, spd: 90, luck: 55 } }, // Trickster
    { uniqueId: "ai-volc-3", name: "Санжи", anime: "One Piece", rarity: "epic" as Rarity, imageUrl: "https://shikimori.one/system/characters/original/305.jpg", stats: { hp: 90, atk: 100, def: 60, spd: 80, luck: 55 } }, // Vanguard
    { uniqueId: "ai-volc-4", name: "Гаара", anime: "Naruto", rarity: "epic" as Rarity, imageUrl: "https://shikimori.one/system/characters/original/1662.jpg", stats: { hp: 140, atk: 55, def: 105, spd: 50, luck: 45 } }, // Guard
    { uniqueId: "ai-volc-5", name: "Нами", anime: "One Piece", rarity: "uncommon" as Rarity, imageUrl: "https://shikimori.one/system/characters/original/723.jpg", stats: { hp: 70, atk: 65, def: 50, spd: 90, luck: 65 } }, // Trickster
    { uniqueId: "ai-volc-6", name: "Усопп", anime: "One Piece", rarity: "uncommon" as Rarity, imageUrl: "https://shikimori.one/system/characters/original/724.jpg", stats: { hp: 65, atk: 60, def: 50, spd: 70, luck: 85 } }, // Trickster
  ],

  // Ocean Depths - High mid tier (difficulty 5)
  // Bleach + One Piece - Total: 30 provision (9+6+6+5+2+2)
  "ocean": [
    { uniqueId: "ai-ocean-1", name: "Ичиго Куросаки", anime: "Bleach", rarity: "legendary" as Rarity, imageUrl: "https://shikimori.one/system/characters/original/5.jpg", stats: { hp: 125, atk: 120, def: 75, spd: 90, luck: 60 } }, // Vanguard
    { uniqueId: "ai-ocean-2", name: "Рукия Кучики", anime: "Bleach", rarity: "epic" as Rarity, imageUrl: "https://shikimori.one/system/characters/original/6.jpg", stats: { hp: 90, atk: 95, def: 65, spd: 85, luck: 50 } }, // Vanguard
    { uniqueId: "ai-ocean-3", name: "Брук", anime: "One Piece", rarity: "epic" as Rarity, imageUrl: "https://shikimori.one/system/characters/original/5627.jpg", stats: { hp: 100, atk: 105, def: 65, spd: 80, luck: 55 } }, // Vanguard
    { uniqueId: "ai-ocean-4", name: "Ренджи Абарай", anime: "Bleach", rarity: "epic" as Rarity, imageUrl: "https://shikimori.one/system/characters/original/906.jpg", stats: { hp: 120, atk: 90, def: 90, spd: 65, luck: 50 } }, // Guard
    { uniqueId: "ai-ocean-5", name: "Фрэнки", anime: "One Piece", rarity: "super_rare" as Rarity, imageUrl: "https://shikimori.one/system/characters/original/64.jpg", stats: { hp: 140, atk: 70, def: 105, spd: 55, luck: 45 } }, // Guard
    { uniqueId: "ai-ocean-6", name: "Орихиме Иноуэ", anime: "Bleach", rarity: "super_rare" as Rarity, imageUrl: "https://shikimori.one/system/characters/original/7.jpg", stats: { hp: 110, atk: 50, def: 90, spd: 60, luck: 70 } }, // Guard
  ],

  // Sky Castle - Elite tier (difficulty 7)
  // Attack on Titan + My Hero Academia - Total: 30 provision (9+9+6+3+2+1)
  "sky_castle": [
    { uniqueId: "ai-sky-1", name: "Эрен Йегер", anime: "Attack on Titan", rarity: "legendary" as Rarity, imageUrl: "https://shikimori.one/system/characters/original/40882.jpg", stats: { hp: 140, atk: 130, def: 85, spd: 100, luck: 55 } }, // Vanguard
    { uniqueId: "ai-sky-2", name: "Леви Аккерман", anime: "Attack on Titan", rarity: "legendary" as Rarity, imageUrl: "https://shikimori.one/system/characters/original/45627.jpg", stats: { hp: 110, atk: 135, def: 70, spd: 120, luck: 50 } }, // Trickster
    { uniqueId: "ai-sky-3", name: "Микаса Аккерман", anime: "Attack on Titan", rarity: "epic" as Rarity, imageUrl: "https://shikimori.one/system/characters/original/40881.jpg", stats: { hp: 160, atk: 110, def: 100, spd: 105, luck: 50 } }, // Vanguard
    { uniqueId: "ai-sky-4", name: "Деку", anime: "My Hero Academia", rarity: "epic" as Rarity, imageUrl: "https://shikimori.one/system/characters/original/117909.jpg", stats: { hp: 175, atk: 120, def: 90, spd: 100, luck: 60 } }, // Vanguard
    { uniqueId: "ai-sky-5", name: "Армин Арлерт", anime: "Attack on Titan", rarity: "uncommon" as Rarity, imageUrl: "https://shikimori.one/system/characters/original/46494.jpg", stats: { hp: 125, atk: 65, def: 75, spd: 75, luck: 90 } }, // Trickster
    { uniqueId: "ai-sky-6", name: "Уракака", anime: "My Hero Academia", rarity: "rare" as Rarity, imageUrl: "https://shikimori.one/system/characters/original/117917.jpg", stats: { hp: 130, atk: 70, def: 100, spd: 65, luck: 60 } }, // Guard
  ],

  // Demon Realm - Boss tier (difficulty 10)
  // Demon Slayer + Jujutsu Kaisen - Total: 30 provision (10+9+6+3+1+1)
  "demon_realm": [
    { uniqueId: "ai-demon-1", name: "Сатору Годжо", anime: "Jujutsu Kaisen", rarity: "ancient" as Rarity, imageUrl: "https://shikimori.one/system/characters/original/164471.jpg", stats: { hp: 175, atk: 155, def: 110, spd: 125, luck: 70 } }, // Trickster
    { uniqueId: "ai-demon-2", name: "Танджиро Камадо", anime: "Demon Slayer", rarity: "legendary" as Rarity, imageUrl: "https://shikimori.one/system/characters/original/146156.jpg", stats: { hp: 195, atk: 125, def: 105, spd: 100, luck: 60 } }, // Vanguard
    { uniqueId: "ai-demon-3", name: "Незуко Камадо", anime: "Demon Slayer", rarity: "epic" as Rarity, imageUrl: "https://shikimori.one/system/characters/original/146157.jpg", stats: { hp: 225, atk: 90, def: 110, spd: 90, luck: 55 } }, // Guard
    { uniqueId: "ai-demon-4", name: "Мегуми Фушигуро", anime: "Jujutsu Kaisen", rarity: "epic" as Rarity, imageUrl: "https://shikimori.one/system/characters/original/164470.jpg", stats: { hp: 130, atk: 120, def: 85, spd: 110, luck: 65 } }, // Trickster
    { uniqueId: "ai-demon-5", name: "Дзэнитсу", anime: "Demon Slayer", rarity: "uncommon" as Rarity, imageUrl: "https://shikimori.one/system/characters/original/146158.jpg", stats: { hp: 125, atk: 135, def: 75, spd: 120, luck: 50 } }, // Trickster
    { uniqueId: "ai-demon-6", name: "Нобара Кугисаки", anime: "Jujutsu Kaisen", rarity: "rare" as Rarity, imageUrl: "https://shikimori.one/system/characters/original/164472.jpg", stats: { hp: 115, atk: 105, def: 80, spd: 90, luck: 60 } }, // Vanguard
  ],

  // Grand Tournament - Legendary tier (difficulty 15)
  // Top tier characters from multiple series - Total: 30 provision (11+10+5+2+1+1)
  "tournament": [
    { uniqueId: "ai-tourn-1", name: "Аин", anime: "One Piece", rarity: "transcendent" as Rarity, imageUrl: "https://shikimori.one/system/characters/original/67143.jpg", stats: { hp: 245, atk: 245, def: 170, spd: 155, luck: 100 } }, // Vanguard
    { uniqueId: "ai-tourn-2", name: "Сайтама", anime: "One Punch Man", rarity: "divine" as Rarity, imageUrl: "https://shikimori.one/system/characters/original/73935.jpg", stats: { hp: 315, atk: 265, def: 140, spd: 70, luck: 35 } }, // Vanguard (extreme ATK)
    { uniqueId: "ai-tourn-3", name: "Гоку", anime: "Dragon Ball", rarity: "ancient" as Rarity, imageUrl: "https://shikimori.one/system/characters/original/246.jpg", stats: { hp: 265, atk: 195, def: 155, spd: 140, luck: 85 } }, // Vanguard
    { uniqueId: "ai-tourn-4", name: "Мадара Учиха", anime: "Naruto", rarity: "super_rare" as Rarity, imageUrl: "https://shikimori.one/system/characters/original/53901.jpg", stats: { hp: 225, atk: 210, def: 175, spd: 155, luck: 70 } }, // Vanguard
    { uniqueId: "ai-tourn-5", name: "Веджета", anime: "Dragon Ball", rarity: "uncommon" as Rarity, imageUrl: "https://shikimori.one/system/characters/original/913.jpg", stats: { hp: 195, atk: 200, def: 140, spd: 145, luck: 75 } }, // Vanguard
    { uniqueId: "ai-tourn-6", name: "Гаро", anime: "One Punch Man", rarity: "rare" as Rarity, imageUrl: "https://shikimori.one/system/characters/original/112889.jpg", stats: { hp: 210, atk: 190, def: 145, spd: 160, luck: 75 } }, // Vanguard
  ],

  // Daily battle - Random mix of elite+ characters - Total: 30 provision (9+9+6+3+2+1)
  "daily": [
    { uniqueId: "ai-daily-1", name: "Астa", anime: "Black Clover", rarity: "legendary" as Rarity, imageUrl: "https://shikimori.one/system/characters/original/124731.jpg", stats: { hp: 130, atk: 130, def: 90, spd: 105, luck: 65 } }, // Vanguard
    { uniqueId: "ai-daily-2", name: "Юно", anime: "Black Clover", rarity: "legendary" as Rarity, imageUrl: "https://shikimori.one/system/characters/original/124732.jpg", stats: { hp: 175, atk: 105, def: 110, spd: 90, luck: 65 } }, // Guard
    { uniqueId: "ai-daily-3", name: "Мелодиас", anime: "Seven Deadly Sins", rarity: "epic" as Rarity, imageUrl: "https://shikimori.one/system/characters/original/72921.jpg", stats: { hp: 195, atk: 120, def: 110, spd: 85, luck: 60 } }, // Guard
    { uniqueId: "ai-daily-4", name: "Сабо", anime: "One Piece", rarity: "epic" as Rarity, imageUrl: "https://shikimori.one/system/characters/original/32893.jpg", stats: { hp: 140, atk: 120, def: 90, spd: 110, luck: 60 } }, // Trickster
    { uniqueId: "ai-daily-5", name: "Хиен", anime: "Naruto", rarity: "uncommon" as Rarity, imageUrl: "https://shikimori.one/system/characters/original/2792.jpg", stats: { hp: 125, atk: 90, def: 100, spd: 85, luck: 55 } }, // Guard
    { uniqueId: "ai-daily-6", name: "Кару", anime: "Naruto", rarity: "rare" as Rarity, imageUrl: "https://shikimori.one/system/characters/original/22248.jpg", stats: { hp: 90, atk: 85, def: 65, spd: 80, luck: 50 } }, // Vanguard
  ],

  // Daily Market Deck 1 - Frieren Power (High tier) - Total: 30 provision (15+10+5+0+0+0)
  "daily_market_1": [
    { uniqueId: "market-1-1", name: "Ферн", anime: "Провожающая в последний путь Фрирен", rarity: "omnipotent" as Rarity, imageUrl: "https://files.yande.re/image/21766019c33763e78e32f5a0b3e22076/yande.re%201256576%20bandages%20elf%20fern%20frieren%20pointy_ears%20sousou_no_frieren%20stark%20tagme.jpg", stats: { hp: 94, atk: 91, def: 97, spd: 97, luck: 100 } },
    { uniqueId: "market-1-2", name: "Фрирен", anime: "Провожающая в последний путь Фрирен", rarity: "ancient" as Rarity, imageUrl: "https://shikimori.one/system/characters/original/184947.jpg", stats: { hp: 64, atk: 79, def: 82, spd: 67, luck: 73 } },
    { uniqueId: "market-1-3", name: "Наруто Узумаки", anime: "Наруто: Последний фильм", rarity: "super_rare" as Rarity, imageUrl: "https://safebooru.org/images/1842/0e06d477880ced203e25823c228d59ad68f674ec.jpg", stats: { hp: 44, atk: 37, def: 35, spd: 43, luck: 50 } },
    { uniqueId: "market-1-4", name: "Дакэми", anime: "Б — улица рэперов", rarity: "trash" as Rarity, imageUrl: "https://shikimori.one/system/characters/original/170864.jpg", stats: { hp: 15, atk: 20, def: 25, spd: 5, luck: 25 } },
    { uniqueId: "market-1-5", name: "Саяка Табэ", anime: "Девушки, покоряющие новые горизонты", rarity: "trash" as Rarity, imageUrl: "https://shikimori.one/system/characters/original/138648.jpg", stats: { hp: 8, atk: 24, def: 8, spd: 10, luck: 21 } },
    { uniqueId: "market-1-6", name: "Ниро Юдзурисаки", anime: "Детективное агентство Милки Холмс 3", rarity: "common" as Rarity, imageUrl: "https://konachan.net/image/cbf31f19580d5f079c367cd604631050/Konachan.com%20-%2093596%20cordelia_glauca%20hercule_barton%20sherlock_shellingford%20tantei_opera_milky_holmes%20yuzurizaki_nero.jpg", stats: { hp: 13, atk: 19, def: 17, spd: 26, luck: 28 } },
  ],

  // Daily Market Deck 2 - Jujutsu Kaisen Elite - Total: 30 provision (9+8+6+4+2+1)
  "daily_market_2": [
    { uniqueId: "market-2-1", name: "Мэгуми Фусигуро", anime: "Магическая битва: Смертельная миграция", rarity: "legendary" as Rarity, imageUrl: "https://safebooru.org/images/1842/23b738f985ca314edef731e126c3a12c36c7e7e7.jpg", stats: { hp: 65, atk: 74, def: 57, spd: 68, luck: 55 } },
    { uniqueId: "market-2-2", name: "Юдзи Итадори", anime: "Магическая битва: Смертельная миграция", rarity: "mythic" as Rarity, imageUrl: "https://safebooru.org/images/1070/643a1988dd3e8471ca4de8f176b6db6ab9da371c.png", stats: { hp: 64, atk: 59, def: 67, spd: 62, luck: 48 } },
    { uniqueId: "market-2-3", name: "Сатору Годзё", anime: "Магическая битва: Смертельная миграция", rarity: "epic" as Rarity, imageUrl: "https://safebooru.org/images/1331/a4bf038c7ee40efab4ec4b90b1cb912f874ce04e.jpg", stats: { hp: 54, atk: 51, def: 51, spd: 45, luck: 53 } },
    { uniqueId: "market-2-4", name: "Джо Эйсел", anime: "Дикие Зойды: Начало", rarity: "rare" as Rarity, imageUrl: "https://s3.zerochan.net/600/46/26/3923846.jpg", stats: { hp: 44, atk: 37, def: 43, spd: 35, luck: 35 } },
    { uniqueId: "market-2-5", name: "Котори Сиракава", anime: "С начала. Часть I", rarity: "common" as Rarity, imageUrl: "https://shikimori.one/system/characters/original/2387.jpg", stats: { hp: 13, atk: 12, def: 16, spd: 32, luck: 15 } },
    { uniqueId: "market-2-6", name: "Хакуфу Сонсаку", anime: "Сила тысячи", rarity: "common" as Rarity, imageUrl: "https://safebooru.org/images/1880/c2911f8795b5f2e0c030de1359939ea64dff09bb.jpeg", stats: { hp: 25, atk: 23, def: 31, spd: 22, luck: 20 } },
  ],

  // Daily Market Deck 3 - Naruto Speedsters - Total: 30 provision (8+5+5+5+4+3)
  "daily_market_3": [
    { uniqueId: "market-3-1", name: "Нобара Кугисаки", anime: "Магическая битва: Смертельная миграция", rarity: "mythic" as Rarity, imageUrl: "https://safebooru.org/images/4395/e614360d0d8cd16e3b226d9a3b0909b68ac174f9.jpg", stats: { hp: 59, atk: 59, def: 61, spd: 56, luck: 49 } },
    { uniqueId: "market-3-2", name: "Наруто Узумаки", anime: "Наруто: Последний фильм", rarity: "super_rare" as Rarity, imageUrl: "https://safebooru.org/images/1842/0e06d477880ced203e25823c228d59ad68f674ec.jpg", stats: { hp: 44, atk: 37, def: 35, spd: 43, luck: 50 } },
    { uniqueId: "market-3-3", name: "Тэяки Учиха", anime: "Наруто", rarity: "super_rare" as Rarity, imageUrl: "https://shikimori.one/system/characters/original/23143.jpg", stats: { hp: 50, atk: 33, def: 50, spd: 34, luck: 37 } },
    { uniqueId: "market-3-4", name: "Лина", anime: "Триган: Ураган", rarity: "super_rare" as Rarity, imageUrl: "https://shikimori.one/system/characters/original/58671.jpg", stats: { hp: 43, atk: 40, def: 50, spd: 47, luck: 50 } },
    { uniqueId: "market-3-5", name: "Дории", anime: "Прославленный: Маска истины", rarity: "rare" as Rarity, imageUrl: "https://shikimori.one/system/characters/original/2437.jpg", stats: { hp: 26, atk: 31, def: 37, spd: 46, luck: 36 } },
    { uniqueId: "market-3-6", name: "Нао Томори", anime: "Шарлотта", rarity: "super_rare" as Rarity, imageUrl: "https://safebooru.org/images/4404/1e49953670bd6741eeb337d32e21fdaf25f98796.png", stats: { hp: 38, atk: 48, def: 34, spd: 38, luck: 41 } },
  ],

  // Daily Market Deck 4 - Mixed Power - Total: 30 provision (13+9+5+2+1+0)
  "daily_market_4": [
    { uniqueId: "market-4-1", name: "Леорио Паладинайт", anime: "Охотник х Охотник (2011)", rarity: "transcendent" as Rarity, imageUrl: "https://s3.zerochan.net/600/15/41/3337065.jpg", stats: { hp: 90, atk: 90, def: 82, spd: 82, luck: 91 } },
    { uniqueId: "market-4-2", name: "Симон", anime: "Гуррен-Лаганн, пронзающий небеса", rarity: "legendary" as Rarity, imageUrl: "https://safebooru.org/images/3048/e8a1e6f31233901bb9eebe9c205fe82b41c33a86.jpg", stats: { hp: 61, atk: 56, def: 67, spd: 55, luck: 72 } },
    { uniqueId: "market-4-3", name: "Лавине", anime: "Провожающая в последний путь Фрирен", rarity: "mythic" as Rarity, imageUrl: "https://s3.zerochan.net/600/07/49/4124957.jpg", stats: { hp: 59, atk: 53, def: 53, spd: 66, luck: 60 } },
    { uniqueId: "market-4-4", name: "Канне", anime: "Провожающая в последний путь Фрирен", rarity: "mythic" as Rarity, imageUrl: "https://s3.zerochan.net/600/33/21/4193583.jpg", stats: { hp: 65, atk: 66, def: 64, spd: 50, luck: 58 } },
    { uniqueId: "market-4-5", name: "Хакуфу Сонсаку", anime: "Сила тысячи", rarity: "common" as Rarity, imageUrl: "https://safebooru.org/images/1880/c2911f8795b5f2e0c030de1359939ea64dff09bb.jpeg", stats: { hp: 25, atk: 23, def: 31, spd: 22, luck: 20 } },
    { uniqueId: "market-4-6", name: "Дакэми", anime: "Б — улица рэперов", rarity: "trash" as Rarity, imageUrl: "https://shikimori.one/system/characters/original/170864.jpg", stats: { hp: 15, atk: 20, def: 25, spd: 5, luck: 25 } },
  ],
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
    counterCards.sort((a, b) => (b.provisionCost || 0) - (a.provisionCost || 0))
    
    const adaptiveDeck: Card[] = []
    let totalProvision = 0
    
    for (const card of counterCards) {
      if (adaptiveDeck.length >= DECK_SIZE) break
      const cardProvision = card.provisionCost || RARITY_PROVISION_MAP[card.rarity]
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
      const cardProvision = randomCard.provisionCost || RARITY_PROVISION_MAP[randomCard.rarity]
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
  
  // Replace some cards with counter cards
  for (let i = 0; i < counterCount; i++) {
    const randomIndex = Math.floor(Math.random() * mixedDeck.length)
    mixedDeck[randomIndex] = counterCards[i]
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
