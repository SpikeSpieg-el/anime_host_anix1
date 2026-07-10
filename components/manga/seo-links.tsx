import Link from "next/link"
import { Sparkles, Swords, Star } from "lucide-react"

export function MangaSEOLinks() {
  return (
    <section className="container mx-auto px-3 sm:px-4 mb-8 sm:mb-12 relative z-10">
      <div className="bg-secondary/30 border rounded-xl p-4 sm:p-6 dark:bg-zinc-900/30 dark:border-zinc-800">
        <h3 className="text-lg sm:text-xl font-bold text-foreground mb-3 sm:mb-4 dark:text-white">
          Другие разделы
        </h3>
        <div className="flex flex-wrap gap-2 sm:gap-3">
          <Link
            href="/gacha"
            className="flex items-center gap-2 bg-purple-500/10 hover:bg-purple-500/20 text-purple-500 px-3 sm:px-4 py-2 rounded-full text-xs sm:text-sm font-medium transition-colors dark:bg-purple-500/20 dark:hover:bg-purple-500/30 dark:text-purple-400"
          >
            <Sparkles className="w-3 h-3 sm:w-4 sm:h-4" />
            Гача-крутки
          </Link>
          <Link
            href="/battle"
            className="flex items-center gap-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 px-3 sm:px-4 py-2 rounded-full text-xs sm:text-sm font-medium transition-colors dark:bg-red-500/20 dark:hover:bg-red-500/30 dark:text-red-400"
          >
            <Swords className="w-3 h-3 sm:w-4 sm:h-4" />
            PvP-арена
          </Link>
          <Link
            href="/catalog"
            className="flex items-center gap-2 bg-orange-500/10 hover:bg-orange-500/20 text-orange-500 px-3 sm:px-4 py-2 rounded-full text-xs sm:text-sm font-medium transition-colors dark:bg-orange-500/20 dark:hover:bg-orange-500/30 dark:text-orange-400"
          >
            <Star className="w-3 h-3 sm:w-4 sm:h-4" />
            Аниме
          </Link>
        </div>
      </div>
    </section>
  )
}
