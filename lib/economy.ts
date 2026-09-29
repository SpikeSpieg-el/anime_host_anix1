// lib/economy.ts
//
// ЕДИНЫЙ ИСТОЧНИК ПРАВДЫ ПО ЭКОНОМИКЕ ИГРЫ.
//
// Раньше числа экономики были разбросаны по миграциям, роутам и компонентам:
// стартовый бонус 10 000 жил в SQL-триггере, цена крутки 50 — в хуке гачи,
// формула цены карты — в двух копиях (lib/market-floor.ts и lib/market-floor-improved.ts),
// а потолок/минимум лота считались от «разбора × 8».
//
// Из-за этого получилась воронка с положительным бесконечным ROI:
//   EV карты ≈ 465 монет при цене крутки 50 монет (×9.3).
// Любой игрок мог просто крутить и продавать на маркет, а PvE/PvP были лишними.
//
// Правило, которое теперь держит всю модель:
//   EV(одна крутка) ≈ 1.1–1.25 × цена крутки.
// Гача самодостаточна (продал ненужное — крутишь дальше), PvE/PvP дают сверху,
// маркет перераспределяет карты между игроками и забирает налог в сток.

import { getDismantleValue, type Rarity } from "@/types/gacha"

export const RARITY_ORDER = [
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
] as const

// ---------------------------------------------------------------------------
// Базовые константы
// ---------------------------------------------------------------------------

/** Цена одной крутки в обычном пуле. */
export const SPIN_COST = 50

/**
 * Стартовый бонус нового аккаунта.
 * 2 000 монет = 40 круток: хватает на «вау-эффект» первой серии и на гарант баннера,
 * но НЕ хватает на то, чтобы выбить всю коллекцию и уйти в даунтайм.
 * (было 10 000 = 200 круток — новичок опустошал бонус за один присед).
 */
export const STARTING_COINS = 2_000

/** Сколько круток получает новичок на старте (для UI и подсказок). */
export const STARTING_SPINS = STARTING_COINS / SPIN_COST

// ---------------------------------------------------------------------------
// Стоимость карты
// ---------------------------------------------------------------------------

/**
 * Справедливая (100%) рыночная стоимость карты по редкости, в монетах.
 *
 * Таблица подобрана так, чтобы EV одной крутки ≈ 60 монет при цене 50 (ROI ≈ 1.2).
 * Проверяется тестом tests/unit/lib/economy.test.ts по реальному распределению
 * редкостей: если поменять любую цену и ROI уедет выше 1.3 — гача снова
 * станет печатным станком и PvE/рынок потеряют смысл.
 *
 * Соотношение «справедливая цена : разбор в пыль» держится около 1.45 —
 * рынок всегда выгоднее распыления, иначе никто не торгует.
 * Это и есть «гача сама по себе»: игрок крутит, продаёт ненужное и крутит дальше.
 */
export const RARITY_FAIR_VALUE: Record<Rarity, number> = {
  trash: 5,
  common: 7,
  uncommon: 11,
  rare: 44,
  super_rare: 88,
  epic: 170,
  mythic: 335,
  legendary: 560,
  ancient: 920,
  divine: 1350,
  transcendent: 2300,
  omnipotent: 5700,
}

/** Максимальный бонус от статов (доля от справедливой цены). */
export const STATS_BONUS_CAP = 0.3
/** За сколько суммы статов набирается полный бонус. */
export const STATS_BONUS_FULL_AT = 1000
/** Множитель за главного героя. */
export const MAIN_CHARACTER_MULTIPLIER = 1.25
/** Бонус, если на карте есть и рамка, и покрытие. */
export const DUAL_MODIFIER_BONUS = 0.3

// ---------------------------------------------------------------------------
// Маркет
// ---------------------------------------------------------------------------

/** Комиссия маркета с продажи (8%). Уходит в сток — не возвращается ни игроку, ни гаче. */
export const MARKET_TAX_RATE = 0.08

/** Мгновенная продажа: 70% от справедливой цены. Плата за ликвидность «сейчас». */
export const INSTANT_SELL_RATE = 0.7

/** Нижняя граница лота: 60% от справедливой цены (можно демпинговать, чтобы продать быстро). */
export const LISTING_MIN_RATE = 0.6
/** Верхняя граница лота: 250% от справедливой цены (наценка за горячую карту). */
export const LISTING_MAX_RATE = 2.5
/** Абсолютный потолок цены лота, чтобы никто не выставил 999 999 999. */
export const ABSOLUTE_LISTING_PRICE_CAP = 500_000
/** Абсолютный минимум цены лота: мусорная карта может стоить и 2 монет. */
export const ABSOLUTE_LISTING_PRICE_FLOOR = 1

/** Сколько последних продаж нужно, чтобы доверять рыночной медиане. */
export const PRICE_DISCOVERY_MIN_SAMPLES = 5
/** Окно, по которому считается медиана продаж. */
export const PRICE_DISCOVERY_WINDOW_DAYS = 14

// ---------------------------------------------------------------------------
// PvE / PvP — «бонус», а не основной доход
// ---------------------------------------------------------------------------

/** Базовая награда PvE за победу (было 50–300; поднято, т.к. это теперь реальный буст). */
export const PVE_REWARDS = {
  tutorial: { coins: 50, dust: 10, energy: 1 },
  normal: { coins: 70, dust: 15, energy: 1 },
  elite: { coins: 110, dust: 25, energy: 1 },
  boss: { coins: 170, dust: 40, energy: 2 },
  daily: { coins: 220, dust: 80, energy: 2 },
} as const

/** Множитель первой победы дня в данном данжеоне. */
export const PVE_FIRST_WIN_MULTIPLIER = 2
/** Разброс награды (±15%). */
export const PVE_REWARD_VARIANCE = 0.15
/** Потолок дневного заработка с PvE, в монетах. Страховка от «залипания в фарм». */
export const PVE_DAILY_COIN_CAP = 1_200

// ---------------------------------------------------------------------------
// Воронка: ежедневный бонус и вехи коллекции
// ---------------------------------------------------------------------------

/**
 * Ежедневная награда. Это и есть «якорь возврата»: игрок заходит,
 * забирает монеты/пыль и крутит. Стоимость дня 1 = 1 крутка, растёт до 7.
 */
export const DAILY_REWARDS = [
  { day: 1, coins: 50, dust: 0 },
  { day: 2, coins: 75, dust: 0 },
  { day: 3, coins: 100, dust: 25 },
  { day: 4, coins: 125, dust: 25 },
  { day: 5, coins: 175, dust: 50 },
  { day: 6, coins: 225, dust: 50 },
  { day: 7, coins: 300, dust: 100 },
] as const
export const DAILY_STREAK_LENGTH = DAILY_REWARDS.length
/** Пропуск дня сбрасывает серию. */
export const DAILY_STREAK_RESET_AFTER_DAYS = 2

/**
 * Вехи коллекции: дают причину крутить после первых 10–20 карт.
 * Суммарно ≈ 2 700 монет (54 крутки) на 200 карт — это ~10% дохода с гачи,
 * то есть цель, а не новый кран монет.
 */
export const COLLECTION_MILESTONES = [
  { cards: 10, coins: 50, dust: 0, title: "Первые десять" },
  { cards: 25, coins: 150, dust: 25, title: "Коллекционер" },
  { cards: 50, coins: 300, dust: 50, title: "Полсотни героев" },
  { cards: 100, coins: 700, dust: 100, title: "Ветеран гачи" },
  { cards: 200, coins: 1_500, dust: 250, title: "Легенда коллекции" },
] as const

// ---------------------------------------------------------------------------
// Типы и расчёты
// ---------------------------------------------------------------------------

export type EconomyCard = {
  rarity: Rarity
  stats: { hp: number; atk: number; def: number; spd: number; luck: number }
  isMainCharacter?: boolean
  frameModifier?: string | null
  coatingModifier?: string | null
}

/** Стоимость модификаторов в монетах (копия из card-modifiers, чтобы не тянуть React-компонент). */
export const MODIFIER_COSTS: Record<string, number> = {
  // рамки
  gold: 50,
  neon: 60,
  crystal: 55,
  dark: 70,
  blood: 80,
  inferno: 100,
  lightning: 90,
  divine: 120,
  cyber_glitch: 85,
  abyss: 110,
  // покрытия
  holo: 40,
  prismatic: 45,
  gold_leaf: 55,
  blood_stain: 65,
  void: 75,
  matrix_foil: 70,
  crt_scanlines: 50,
  falling_ash: 60,
  heartbeat: 80,
  ethereal_mist: 95,
}

/** Суммарная стоимость модификаторов карты (0, если их нет). */
export function getModifierValue(card: Pick<EconomyCard, "frameModifier" | "coatingModifier">): number {
  let total = 0
  if (card.frameModifier) total += MODIFIER_COSTS[card.frameModifier] ?? 0
  if (card.coatingModifier) total += MODIFIER_COSTS[card.coatingModifier] ?? 0
  if (total > 0 && card.frameModifier && card.coatingModifier) {
    total = Math.floor(total * (1 + DUAL_MODIFIER_BONUS))
  }
  return total
}

function statSum(card: Pick<EconomyCard, "stats">): number {
  const s = card.stats
  return (s?.hp ?? 0) + (s?.atk ?? 0) + (s?.def ?? 0) + (s?.spd ?? 0) + (s?.luck ?? 0)
}

export interface CardValueBreakdown {
  base: number
  statSum: number
  statsBonus: number
  mainBonus: number
  modifierBonus: number
  fair: number
}

/**
 * Разбор справедливой цены карты по слагаемым.
 * Используется в UI («из чего складывается цена») и в тестах.
 */
export function getCardValueBreakdown(card: EconomyCard): CardValueBreakdown {
  const base = RARITY_FAIR_VALUE[card.rarity] ?? RARITY_FAIR_VALUE.common
  const sum = statSum(card)
  const statsMultiplier = 1 + Math.min(STATS_BONUS_CAP, sum / STATS_BONUS_FULL_AT)
  const statsBonus = Math.round(base * (statsMultiplier - 1))
  const mainBonus = card.isMainCharacter
    ? Math.round(base * (MAIN_CHARACTER_MULTIPLIER - 1) * statsMultiplier)
    : 0
  const modifierBonus = getModifierValue(card)
  const fair = Math.max(1, base + statsBonus + mainBonus + modifierBonus)
  return { base, statSum: sum, statsBonus, mainBonus, modifierBonus, fair }
}

/**
 * Справедливая цена карты (100%).
 *
 * Цена не зависит от коллекции продавца: иначе монеты копятся у «богатых»
 * и рынок перестаёт быть рынком. Коллекция влияет только на ваш ПОВ (силу колоды).
 */
export function getFairCardValue(card: EconomyCard): number {
  return getCardValueBreakdown(card).fair
}

/** Минимальная цена лота (60% от справедливой). */
export function getMinListingPrice(card: EconomyCard): number {
  const fair = getFairCardValue(card)
  return Math.max(ABSOLUTE_LISTING_PRICE_FLOOR, Math.round(fair * LISTING_MIN_RATE))
}

/** Максимальная цена лота (250% от справедливой, с абсолютным потолком). */
export function getMaxListingPrice(card: EconomyCard): number {
  const fair = getFairCardValue(card)
  return Math.max(getMinListingPrice(card), Math.min(Math.round(fair * LISTING_MAX_RATE), ABSOLUTE_LISTING_PRICE_CAP))
}

/** Цена мгновенной продажи (70% от справедливой). */
export function getInstantSellPrice(card: EconomyCard): number {
  return Math.max(1, Math.round(getFairCardValue(card) * INSTANT_SELL_RATE))
}

/** Сколько получит продавец после комиссии маркета. */
export function getNetProceeds(price: number): number {
  return Math.max(0, Math.round(price * (1 - MARKET_TAX_RATE)))
}

/**
 * Стоимость разбора карты в пыль (≈71% справедливой цены).
 * Пыль — отдельный ресурс: её тратят на смену арта, это сток, а не монеты.
 * Реэкспорт, чтобы весь интерфейс экономики жил в одном файле.
 */
export { getDismantleValue }

/**
 * Рекомендуемая цена лота на основе РЕАЛЬНЫХ продаж.
 * Формула сама по себе не определяет цену — её определяет спрос.
 *
 * @param medianPrice медиана последних продаж этой редкости (null, если данных мало)
 */
export function getSuggestedListingPrice(
  card: EconomyCard,
  medianPrice?: number | null,
  sampleCount: number = 0
): number {
  const min = getMinListingPrice(card)
  const max = getMaxListingPrice(card)
  const fair = getFairCardValue(card)

  if (!medianPrice || sampleCount < PRICE_DISCOVERY_MIN_SAMPLES) {
    return Math.min(max, Math.max(min, fair))
  }

  // Медиана рынка важнее формулы, но с доверием к объёму выборки:
  // чем больше продаж, тем сильнее тянем к реальной цене.
  const confidence = Math.min(1, sampleCount / (PRICE_DISCOVERY_MIN_SAMPLES * 4))
  const marketAnchored = medianPrice * (0.85 + 0.3 * confidence)
  const blended = Math.round(fair * (1 - confidence) + marketAnchored * confidence)
  return Math.min(max, Math.max(min, blended))
}

/** Награда за N-й день серии (1-based). */
export function getDailyReward(day: number) {
  const normalized = ((Math.max(1, day) - 1) % DAILY_STREAK_LENGTH) + 1
  return DAILY_REWARDS[normalized - 1]
}

/** Ближайшая веха коллекции, которую игрок ещё не получил. */
export function getNextMilestone(cardCount: number) {
  return COLLECTION_MILESTONES.find((m) => m.cards > cardCount) ?? null
}

/** Сколько карт осталось до следующей вехи. */
export function getMilestoneProgress(cardCount: number) {
  const next = getNextMilestone(cardCount)
  if (!next) return { next: null, remaining: 0, progress: 1 }
  const prev = [...COLLECTION_MILESTONES].reverse().find((m) => m.cards <= cardCount)
  const from = prev?.cards ?? 0
  const progress = Math.min(1, Math.max(0, (cardCount - from) / (next.cards - from)))
  return { next, remaining: next.cards - cardCount, progress }
}

// ---------------------------------------------------------------------------
// Документация модели (используется в тестах и в docs/ECONOMY.md)
// ---------------------------------------------------------------------------

/**
 * Ожидаемая стоимость карты при одном розыгрыше, в монетах.
 * Значение пересчитано Монте-Карло по реальному распределению редкостей
 * (см. scripts/economy-report.mjs). Используется как «проба» в тестах:
 * если формулу поправить и EV уедет выше ~1.3 × SPIN_COST — гача снова
 * станет печатным станком.
 */
export const EXPECTED_CARD_VALUE_PER_SPIN = 60
/** Ожидаемый ROI одной крутки при продаже всего дропа по справедливой цене. */
export const EXPECTED_ROI_PER_SPIN = EXPECTED_CARD_VALUE_PER_SPIN / SPIN_COST
/** Потолок ROI, выше которого экономика считается сломанной. */
export const MAX_HEALTHY_ROI = 1.3
