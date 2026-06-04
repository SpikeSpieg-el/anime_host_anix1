import {
  Mountain, Flame, Waves, Castle, FlameKindling, Swords, Timer, Skull, LucideIcon
} from "lucide-react"

export interface ThemeItem {
  icon: LucideIcon
  color: string
  bg: string
  border: string
  gradient: string
}

export const THEME_CONFIG: Record<string, ThemeItem> = {
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
