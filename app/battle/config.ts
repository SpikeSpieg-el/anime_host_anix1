import {
  Mountain, Flame, Waves, Castle, FlameKindling, Swords, Timer, Skull, TreePine, Flower2, LucideIcon
} from "lucide-react"

export interface ThemeItem {
  icon: LucideIcon
  color: string
  bg: string
  border: string
  gradient: string
}

export const THEME_CONFIG: Record<string, ThemeItem> = {
  tutorial_forest: { icon: TreePine, color: "text-green-300", bg: "bg-green-500/10", border: "border-green-500/20", gradient: "from-green-900/20 to-transparent" },
  peaceful_meadow: { icon: Flower2, color: "text-lime-300", bg: "bg-lime-500/10", border: "border-lime-500/20", gradient: "from-lime-900/20 to-transparent" },
  dark_forest: { icon: Mountain, color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20", gradient: "from-emerald-900/20 to-transparent" },
  volcano: { icon: Flame, color: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/20", gradient: "from-red-900/20 to-transparent" },
  ocean: { icon: Waves, color: "text-cyan-400", bg: "bg-cyan-500/10", border: "border-cyan-500/20", gradient: "from-blue-900/20 to-transparent" },
  sky_castle: { icon: Castle, color: "text-violet-400", bg: "bg-violet-500/10", border: "border-violet-500/20", gradient: "from-purple-900/20 to-transparent" },
  demon_realm: { icon: FlameKindling, color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20", gradient: "from-red-950/30 to-transparent" },
  tournament: { icon: Swords, color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20", gradient: "from-amber-900/20 to-transparent" },
  daily: { icon: Timer, color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20", gradient: "from-blue-900/20 to-transparent" },
  boss_raid: { icon: Skull, color: "text-rose-400", bg: "bg-rose-500/10", border: "border-rose-500/20", gradient: "from-rose-950/30 to-transparent" },
}

export const TIER_CONFIG: Record<string, { color: string; label: string; bg: string }> = {
  normal: { color: "text-slate-300", label: "Обычный", bg: "bg-slate-800/80" },
  elite: { color: "text-blue-300", label: "Элитный", bg: "bg-blue-900/80" },
  boss: { color: "text-purple-300", label: "Босс", bg: "bg-purple-900/80" },
  legendary: { color: "text-amber-300", label: "Легендарный", bg: "bg-amber-900/80" },
}

export const glassCard = "bg-white/[0.03] backdrop-blur-xl border border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.3)]"
export const glassButton = "bg-white/[0.05] hover:bg-white/[0.1] backdrop-blur-md border border-white/10 transition-all duration-300 active:scale-95"

// ==========================================
// CCG CONFIGURATION
// ==========================================

export const PROVISION_LIMIT = 35
export const DECK_SIZE = 8

export const RARITY_PROVISION_MAP: Record<string, number> = {
  trash: 0,
  common: 2,
  uncommon: 3,
  rare: 4,
  super_rare: 5,
  epic: 6,
  mythic: 8,
  legendary: 9,
  ancient: 10,
  divine: 11,
  transcendent: 13,
  omnipotent: 15,
}

export const ROLE_CONFIG = {
  vanguard: { name: "Авангард", label: "Авангард", color: "text-rose-400", bg: "bg-rose-500/10", border: "border-rose-500/20" },
  guard: { name: "Страж", label: "Страж", color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20" },
  trickster: { name: "Плут", label: "Плут", color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20" }
}

// ==========================================
// DECK DEPTH: SYNERGIES, LEADER, FORMATION
// ==========================================

// Hard caps on the total deck-building influence on a single card's power.
// Keeps the system meaningful but never dominant (~+25 / -15).
export const SYNERGY_TOTAL_CAP = 25
export const SYNERGY_TOTAL_FLOOR = -15

// Passive deck synergies. Tunable bonus values are kept here.
// Computation of which synergies are active lives in utils.ts (computeDeckSynergies).
export const SYNERGY_VALUES = {
  brotherhood3: 6,   // 3+ cards from the same anime
  brotherhood5: 12,   // 5+ cards from the same anime (replaces brotherhood3)
  roleHarmony: 8,    // all 3 roles present
  raritySpectrum: 5, // 5+ distinct rarities
  lightStep: 5,      // total provision weight <= lightStepThreshold
  elite: 6,          // 4+ cards of epic rarity or higher
  specializationSelf: 6, // 4+ cards of one role: bonus to that role
  specializationOther: -3, // ...penalty to the other roles
}

export const LIGHT_STEP_THRESHOLD = 28
export const ELITE_RARITIES = ["epic", "mythic", "legendary", "ancient", "divine", "transcendent", "omnipotent"]

export interface SynergyMeta {
  nameRu: string
  description: string
  color: string
  bg: string
  border: string
}

export const SYNERGY_DEFINITIONS: Record<string, SynergyMeta> = {
  brotherhood: { nameRu: "Братство", description: "Несколько карт из одного аниме усиливают всю колоду.", color: "text-violet-300", bg: "bg-violet-500/10", border: "border-violet-500/20" },
  role_harmony: { nameRu: "Гармония ролей", description: "В колоде есть все три роли (Авангард, Страж, Плут).", color: "text-emerald-300", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
  rarity_spectrum: { nameRu: "Спектр редкостей", description: "5+ разных редкостей карт в колоде.", color: "text-cyan-300", bg: "bg-cyan-500/10", border: "border-cyan-500/20" },
  light_step: { nameRu: "Лёгкая поступь", description: `Общий вес колоды не превышает ${LIGHT_STEP_THRESHOLD} очков.`, color: "text-sky-300", bg: "bg-sky-500/10", border: "border-sky-500/20" },
  elite: { nameRu: "Элита", description: "4+ карт редкости Эпическая и выше.", color: "text-amber-300", bg: "bg-amber-500/10", border: "border-amber-500/20" },
  specialization: { nameRu: "Специализация", description: "4+ карт одной роли: бонус этой роли, штраф остальным.", color: "text-rose-300", bg: "bg-rose-500/10", border: "border-rose-500/20" },
}

// Leader aura: choosing a leader grants a soft role-based buff to the whole deck.
export const LEADER_AURA_VALUE = 8
export const LEADER_AURA_CONFIG: Record<string, { nameRu: string; description: string }> = {
  vanguard: { nameRu: "Аура Авангарда", description: "+8 силы всем картам Авангард." },
  guard: { nameRu: "Аура Стража", description: "+8 силы всем картам Страж." },
  trickster: { nameRu: "Аура Плута", description: "Скрытые карты получают +8 при раскрытии." },
}

// Formation: tactical stance applied to the whole deck during a match.
export type FormationId = "aggression" | "defense" | "balance"
export interface FormationMeta {
  nameRu: string
  description: string
  color: string
  bg: string
  border: string
  open: number
  secret: number
  guard: number
  trickster: number
  all: number
}

export const FORMATION_CONFIG: Record<FormationId, FormationMeta> = {
  aggression: {
    nameRu: "Агрессия", description: "Открытые карты +10, скрытые -6.",
    color: "text-rose-300", bg: "bg-rose-500/10", border: "border-rose-500/20",
    open: 10, secret: -6, guard: 0, trickster: 0, all: 0,
  },
  defense: {
    nameRu: "Оборона", description: "Стражи +10, Плуты -5.",
    color: "text-blue-300", bg: "bg-blue-500/10", border: "border-blue-500/20",
    open: 0, secret: 0, guard: 10, trickster: -5, all: 0,
  },
  balance: {
    nameRu: "Баланс", description: "Все карты +5 (ровный профиль).",
    color: "text-emerald-300", bg: "bg-emerald-500/10", border: "border-emerald-500/20",
    open: 0, secret: 0, guard: 0, trickster: 0, all: 5,
  },
}

export const TERRITORY_MODIFIERS = [
  // === ВЗАИМОДЕЙСТВИЕ С ИНФОРМАЦИЕЙ И СКРЫТЫМИ КАРТАМИ ===
  { id: "shadow_step", name: "Теневой выпад", nameRu: "Теневой выпад", description: "Все скрытые карты на этой линии получают +100 к силе при раскрытии." },
  { id: "mirage_zone", name: "Зона иллюзий", nameRu: "Зона иллюзий", description: "Сила скрытых карт удваивается, но открытые карты теряют 50% своей силы." },
  { id: "first_strike", name: "Быстрый старт", nameRu: "Быстрый старт", description: "Открытые карты (сыгранные на эту линию первыми) получают бонус +80 к силе." },
  { id: "ambush_point", name: "Точка засады", nameRu: "Точка засады", description: "Скрытые карты (сыгранные на эту линию вторыми) получают бонус +120 к силе." },
  { id: "double_bluff", name: "Двойной блеф", nameRu: "Двойной блеф", description: "Если оба игрока сыграли свои скрытые карты на этой линии, обе карты получают +200 к силе." },
  { id: "dark_zone", name: "Темная зона", nameRu: "Темная зона", description: "Все показатели карт на этой линии скрыты даже после раскрытия. Победитель определяется вслепую." },
  { id: "provocation_point", name: "Точка провокации", nameRu: "Точка провокации", description: "Раскрытие скрытой карты Стража на этой линии принудительно раскрывает скрытую карту противника." },

  // === ПРАВИЛА РОЛЕЙ И КНБ (КАМЕНЬ-НОЖНИЦЫ-БУМАГА) ===
  { id: "reverse_rps", name: "Зеркальный резонанс", nameRu: "Зеркальный резонанс", description: "Правила превосходства ролей меняются: Плут побеждает Авангарда, Авангард побеждает Стража, Страж побеждает Плута." },
  { id: "double_rps", name: "Абсолютное доминирование", nameRu: "Абсолютное доминирование", description: "Бонус к силе за победу по системе ролей (КНБ) на этой линии увеличивается в два раза." },
  { id: "no_rps", name: "Чистый триумф", nameRu: "Чистый триумф", description: "На этой линии не действуют правила ролей (КНБ), сравнивается только чистая базовая сила карт." },
  { id: "tactical_synergy", name: "Тактический союз", nameRu: "Тактический союз", description: "Если ваши две карты на этой линии имеют разные роли, они обе получают бонус +100 к силе." },
  { id: "shared_fate", name: "Общая судьба", nameRu: "Общая судьба", description: "Если карты противников на этой линии имеют одинаковую роль, обе карты получают +150 к силе." },
  { id: "unity", name: "Единство", nameRu: "Единство", description: "Если ваши две карты на этой линии из одного аниме, они обе получают бонус +150 к силе." },
  { id: "rivalry", name: "Соперничество", nameRu: "Соперничество", description: "Если карты противников на этой линии из разных аниме, они теряют 50 к силе." },
  { id: "sabotage_camp", name: "Лагерь диверсантов", nameRu: "Лагерь диверсантов", description: "Плуты на этой линии снижают скрытую силу противостоящей карты противника на 100 единиц." },
  
  // === БАФФЫ ДЛЯ КОНКРЕТНЫХ РОЛЕЙ ===
  { id: "vanguard_ring", name: "Авангардный ринг", nameRu: "Авангардный ринг", description: "Карты с ролью Авангард получают +150 к базовой силе." },
  { id: "fortress_gate", name: "Железная цитадель", nameRu: "Железная цитадель", description: "Карты с ролью Страж получают +150 к базовой силе." },
  { id: "speed_valley", name: "Долина Ветров", nameRu: "Долина Ветров", description: "Карты с ролью Плут получают +150 к базовой силе." },
  { id: "iron_curtain", name: "Железный занавес", nameRu: "Железный занавес", description: "Стражи на этой линии полностью защищены от любых негативных эффектов и принудительного снижения силы." },

  // === ПРАВИЛА РЕДКОСТИ ===
  { id: "trash_revolution", name: "Восстание низов", nameRu: "Восстание низов", description: "Карты редкости Мусор и Обычная получают +300% к силе на этой линии." },
  { id: "golden_cage", name: "Золотая клетка", nameRu: "Золотая клетка", description: "Карты редкостей Божественные, Трансцендентные и Всемогущие теряют 40% своей силы." },
  { id: "balanced_force", name: "Идеальный баланс", nameRu: "Идеальный баланс", description: "Карты редкостей Эпические, Сверхредкие и Редкие получают +100 к базовой силе." },
  { id: "black_market", name: "Черный рынок", nameRu: "Черный рынок", description: "Карты редкостей Необычные и Редкие получают +120 к силе." },
  { id: "god_domain", name: "Обитель богов", nameRu: "Обитель богов", description: "Всемогущие карты на этой линии удваивают свои итоговые показатели." },
  { id: "vandalism", name: "Отрицание редкости", nameRu: "Отрицание редкости", description: "Все преимущества редкостей отключены. Карты рассчитываются как Обычные." },
  { id: "fools_gold", name: "Золото дураков", nameRu: "Золото дураков", description: "Карты редкостей Легендарные и Мифические приравниваются по силе к редкости Мусор." },

  // === МЕХАНИКИ ПОЗИЦИОНИРОВАНИЯ И КОЛИЧЕСТВА ===
  { id: "lonely_hero", name: "Одинокий боец", nameRu: "Одинокий боец", description: "Если у вас на этой линии всего одна карта против двух карт соперника, она получает +200 к силе." },
  { id: "duelist_honor", name: "Честь дуэлянта", nameRu: "Честь дуэлянта", description: "Если на линии находится ровно по одной карте с каждой стороны, они получают +150 к силе." },
  { id: "gravity_well", name: "Гравитационный колодец", nameRu: "Гравитационный колодец", description: "Сила карт на этой линии уменьшается на 50 за каждую карту, сыгранную на соседних линиях." },
  { id: "overdrive", name: "Предельная перегрузка", nameRu: "Предельная перегрузка", description: "Карта с максимальной силой на этой линии наносит урон соседним линиям противника в размере 50% от своей силы." },

  // === СИСТЕМНЫЕ И АНАРХИЧЕСКИЕ ИЗМЕНЕНИЯ ПРАВИЛ ===
  { id: "equality", name: "Уравнитель", nameRu: "Уравнитель", description: "Сила всех карт на этой линии приравнивается к 150, независимо от их реальных показателей." },
  { id: "power_vacuum", name: "Вакуум силы", nameRu: "Вакуум силы", description: "Энергетический сбой. Все карты на этой линии теряют 50% своей базовой силы." },
  { id: "kamikaze_rift", name: "Разлом камикадзе", nameRu: "Разлом камикадзе", description: "Сильнейшая карта на этой линии по итогам раунда уничтожается и не возвращается в колоду." },
  { id: "stamina_drain", name: "Перераспределение", nameRu: "Перераспределение", description: "Сильнейшая карта на этой линии отдает 100 единиц своей силы самой слабой карте на этой же линии." },
  { id: "gambler_den", name: "Притон азарта", nameRu: "Притон азарта", description: "Карты с высоким показателем Удачи получают случайный бонус от 50 до 250 силы." },
  { id: "reversal_gate", name: "Врата парадокса", nameRu: "Врата парадокса", description: "Парадокс силы: на этой линии карта с наименьшим показателем силы побеждает карту с наибольшим." },

]

