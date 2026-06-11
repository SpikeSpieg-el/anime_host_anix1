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
  "omnipotent"
] as const

export const statLabels = {
  hp: "Очки Здоровья",
  atk: "Сила Атаки",
  def: "Защита",
  spd: "Скорость",
  luck: "Удача"
} as const

export const ART_BAN_LIMIT = 10
