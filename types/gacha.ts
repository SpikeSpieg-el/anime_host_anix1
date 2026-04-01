export type Rarity = 
  | "trash" | "common" | "uncommon" | "rare" | "super_rare" | "epic" 
  | "mythic" | "legendary" | "ancient" | "divine" | "transcendent" | "omnipotent"

export const rarityConfig: Record<Rarity, { color: string; bg: string; label: string; glow: string; fx: string; rgb: string; weight: number }> = {
  trash: { color: "from-stone-500 to-stone-700", bg: "bg-stone-950", label: "Мусор", glow: "shadow-stone-500/10", fx: "bg-gradient-to-br from-stone-400/10 to-transparent", rgb: "120, 113, 108", weight: 1 },
  common: { color: "from-slate-400 to-slate-500", bg: "bg-slate-900", label: "Обычная", glow: "shadow-slate-400/20", fx: "bg-gradient-to-br from-white/10 to-transparent", rgb: "148, 163, 184", weight: 2 },
  uncommon: { color: "from-emerald-400 to-teal-500", bg: "bg-emerald-950", label: "Необычная", glow: "shadow-emerald-500/20", fx: "bg-gradient-to-br from-emerald-400/20 to-transparent", rgb: "52, 211, 153", weight: 3 },
  rare: { color: "from-blue-400 to-cyan-500", bg: "bg-cyan-950", label: "Редкая", glow: "shadow-blue-500/30", fx: "bg-gradient-to-br from-blue-400/20 to-transparent", rgb: "34, 211, 238", weight: 5 },
  super_rare: { color: "from-indigo-400 to-blue-600", bg: "bg-indigo-950", label: "Супер Редкая", glow: "shadow-indigo-500/40", fx: "bg-gradient-to-br from-indigo-400/30 to-transparent", rgb: "129, 140, 248", weight: 8 },
  epic: { color: "from-purple-500 to-pink-500", bg: "bg-purple-950", label: "Эпическая", glow: "shadow-purple-500/50", fx: "bg-gradient-to-br from-purple-400/30 to-transparent", rgb: "192, 132, 252", weight: 12 },
  mythic: { color: "from-fuchsia-400 to-rose-500", bg: "bg-fuchsia-950", label: "Мифическая", glow: "shadow-fuchsia-500/50", fx: "bg-gradient-to-br from-fuchsia-400/40 to-transparent", rgb: "232, 121, 249", weight: 18 },
  legendary: { color: "from-pink-400 to-rose-600", bg: "bg-pink-950", label: "Легендарная", glow: "shadow-pink-500/60", fx: "bg-gradient-to-tr from-pink-300/40 via-transparent to-rose-300/40", rgb: "244, 114, 182", weight: 25 },
  ancient: { color: "from-amber-400 to-orange-500", bg: "bg-amber-950", label: "Древняя", glow: "shadow-amber-500/70", fx: "bg-gradient-to-tr from-amber-300/50 via-transparent to-yellow-300/40", rgb: "251, 191, 36", weight: 35 },
  divine: { color: "from-orange-400 to-red-500", bg: "bg-orange-950", label: "Божественная", glow: "shadow-orange-500/80", fx: "bg-gradient-to-tr from-orange-400/50 via-transparent to-red-400/40", rgb: "251, 146, 60", weight: 50 },
  transcendent: { color: "from-red-500 to-rose-700", bg: "bg-red-950", label: "Трансцендентная", glow: "shadow-red-500/90", fx: "bg-gradient-to-tr from-red-400/60 via-transparent to-rose-400/50", rgb: "248, 113, 113", weight: 75 },
  omnipotent: { color: "from-white via-yellow-200 to-amber-500", bg: "bg-zinc-900", label: "Всемогущая", glow: "shadow-white/100", fx: "bg-gradient-to-tr from-white/60 via-yellow-200/40 to-white/60", rgb: "255, 255, 255", weight: 100 },
}

export const getDismantleValue = (rarity: Rarity): number => {
  const values: Record<Rarity, number> = {
    trash: 5,
    common: 10,
    uncommon: 20,
    rare: 40,
    super_rare: 80,
    epic: 150,
    mythic: 300,
    legendary: 500,
    ancient: 800,
    divine: 1200,
    transcendent: 2000,
    omnipotent: 5000
  };
  return values[rarity] || 5;
};
