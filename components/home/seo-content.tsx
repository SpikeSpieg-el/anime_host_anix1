import Link from "next/link"
import { Sparkles, Swords, Star, Coins, Trophy } from "lucide-react"

const features = [
  {
    icon: Sparkles,
    title: "Высокие шансы SSR",
    description: "Легендарные герои выпадают чаще, чем в классических гача-играх",
    color: "text-purple-400",
    glow: "from-purple-500/20",
  },
  {
    icon: Coins,
    title: "Ежедневные бонусы",
    description: "Заходи каждый день, копи валюту и крути гачу бесплатно",
    color: "text-amber-400",
    glow: "from-amber-500/20",
  },
  {
    icon: Swords,
    title: "PvP-арена",
    description: "Собирай колоду и сражайся с игроками в рейтинговых боях",
    color: "text-red-400",
    glow: "from-red-500/20",
  },
  {
    icon: Trophy,
    title: "Сезонные награды",
    description: "Эксклюзивные карты и титулы для лучших игроков сезона",
    color: "text-orange-400",
    glow: "from-orange-500/20",
  },
]

export function SEOContent() {
  return (
    <section className="container mx-auto px-3 sm:px-4 mb-12 sm:mb-16 relative z-10">
      <div className="relative rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl shadow-purple-950/20 p-6 sm:p-8 overflow-hidden dark:bg-white/[0.03] dark:border-white/10">
        {/* Glass highlight */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent pointer-events-none" />
        {/* Decorative gradient orbs */}
        <div className="absolute top-[-30%] right-[-10%] w-[40%] h-[60%] rounded-full bg-purple-600/15 blur-[100px] pointer-events-none" />
        <div className="absolute bottom-[-20%] left-[-5%] w-[30%] h-[50%] rounded-full bg-indigo-600/10 blur-[100px] pointer-events-none" />

        <div className="relative">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 mb-6 sm:mb-8">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-white/5 backdrop-blur-md border border-white/15 shadow-inner shadow-purple-500/10 flex items-center justify-center shrink-0">
              <Sparkles className="w-6 h-6 sm:w-7 sm:h-7 text-purple-400" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-foreground dark:text-white tracking-tight leading-tight">
                Гача-крутки аниме-персонажей
              </h1>
              <p className="text-sm sm:text-base text-muted-foreground dark:text-zinc-400 mt-1">
                Коллекционируй, прокачивай и сражайся на Weeb-x
              </p>
            </div>
          </div>

          {/* Feature grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-8 sm:mb-10">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="group relative rounded-xl sm:rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-3 sm:p-5 overflow-hidden transition-all hover:scale-[1.02] hover:border-white/20 hover:bg-white/[0.08]"
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${feature.glow} to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none`} />
                <feature.icon className={`relative w-5 h-5 sm:w-6 sm:h-6 ${feature.color} mb-2 sm:mb-3`} />
                <h3 className="relative text-xs sm:text-sm font-bold text-foreground dark:text-white mb-1">
                  {feature.title}
                </h3>
                <p className="relative text-[11px] sm:text-xs text-muted-foreground dark:text-zinc-400 leading-snug">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>

          {/* SEO text content */}
          <div className="relative rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-md p-4 sm:p-6 space-y-4 text-sm sm:text-base text-muted-foreground leading-relaxed dark:text-zinc-300">
            <h2 className="text-lg sm:text-xl font-bold text-foreground dark:text-white">
              Твоя коллекция аниме-героев
            </h2>
            <p>
              Weeb-x — это гача-платформа, где каждая крутка может подарить легендарного персонажа из любимого аниме. Повышенные шансы на SSR, честная система гарантов и ежедневные бонусы помогут собрать коллекцию мечты быстрее, чем где-либо ещё.
            </p>

            <h2 className="text-lg sm:text-xl font-bold text-foreground dark:text-white">
              Как это работает
            </h2>
            <p>
              Крути гачу за игровую валюту и получай карты разной редкости — от обычных до божественных. Ненужные дубликаты распыляй в пыль, покупай улучшения и собирай колоду для PvP-арены. Чем сильнее карты, тем выше поднимешься в рейтинге сезона.
            </p>

            <h2 className="text-lg sm:text-xl font-bold text-foreground dark:text-white">
              Смотри аниме — получай награды
            </h2>
            <p>
              Здесь гача и просмотр аниме объединены в одну экосистему: смотри новые серии, выполняй ежедневные задания и зарабатывай валюту для новых круток. Каталог включает тысячи тайтлов — от классики до новинок текущего сезона.
            </p>

            <h2 className="text-lg sm:text-xl font-bold text-foreground dark:text-white">
              Начни бесплатно
            </h2>
            <p>
              Регистрация занимает меньше минуты, а стартовый бонус позволит сделать первые крутки сразу. Присоединяйся к Weeb-x, собери идеальную команду аниме-героев и докажи своё превосходство на арене!
            </p>
          </div>

          {/* CTA buttons */}
          <div className="flex flex-wrap gap-3 sm:gap-4 mt-8 sm:mt-10">
            <Link
              href="/gacha"
              className="group flex items-center gap-2 bg-gradient-to-r from-purple-600/90 to-indigo-600/90 hover:from-purple-500 hover:to-indigo-500 backdrop-blur-md border border-white/20 text-white px-5 sm:px-7 py-3 sm:py-3.5 rounded-xl text-sm sm:text-base font-bold transition-all shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 hover:scale-[1.02]"
            >
              <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 transition-transform group-hover:rotate-12" />
              Крутить гачу
            </Link>
            <Link
              href="/battle"
              className="group flex items-center gap-2 bg-white/5 hover:bg-red-500/15 backdrop-blur-md border border-white/10 hover:border-red-500/30 text-red-500 dark:text-red-400 px-5 sm:px-7 py-3 sm:py-3.5 rounded-xl text-sm sm:text-base font-bold transition-all hover:scale-[1.02]"
            >
              <Swords className="w-4 h-4 sm:w-5 sm:h-5 transition-transform group-hover:rotate-12" />
              PvP-арена
            </Link>
            <Link
              href="/catalog"
              className="group flex items-center gap-2 bg-white/5 hover:bg-orange-500/15 backdrop-blur-md border border-white/10 hover:border-orange-500/30 text-orange-500 dark:text-orange-400 px-5 sm:px-7 py-3 sm:py-3.5 rounded-xl text-sm sm:text-base font-bold transition-all hover:scale-[1.02]"
            >
              <Star className="w-4 h-4 sm:w-5 sm:h-5 transition-transform group-hover:rotate-12" />
              Смотреть аниме
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
