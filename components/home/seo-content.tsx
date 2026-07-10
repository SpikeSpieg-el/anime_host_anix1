import Link from "next/link"
import { Sparkles, Swords, Star } from "lucide-react"

export function SEOContent() {
  return (
    <section className="container mx-auto px-3 sm:px-4 mb-12 sm:mb-16 relative z-10">
      <div className="bg-secondary/40 border rounded-2xl p-6 sm:p-8 dark:bg-zinc-900/40 dark:border-zinc-800">
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-4 sm:mb-6 flex items-center gap-3 dark:text-white">
          <Sparkles className="w-7 h-7 sm:w-8 sm:h-8 text-purple-400" />
          Гача-крутки аниме персонажей — собирай легендарку на Weeb-x
        </h1>
        
        <div className="space-y-4 text-sm sm:text-base text-muted-foreground leading-relaxed dark:text-zinc-300">
          <p>
            Добро пожаловать в мир гача-круток на Weeb-x! Здесь ты можешь собрать уникальную коллекцию любимых аниме-персонажей. Наша гача-система предлагает высокие шансы выпадения SSR-героев, а ежедневные бонусы помогут тебе быстрее получить легендарные карты.
          </p>
          
          <p>
            Механика проста: крути гачу за игровую валюту, получай персонажей разной редкости — от обычных N до легендарных SSR. Чем выше редкость, тем сильнее герой в PvP-арене. Бойцовский клуб аниме ждёт тебя: сражайся с другими игроками, поднимайся в рейтинге и получай эксклюзивные награды.
          </p>
          
          <p>
            Среди лучших гача игр на нашей платформе ты найдёшь тайтлы в стиле "Геншин" с открытым миром и захватывающим сюжетом. Аниме лутбоксы наполнены персонажами из популярных аниме — от классики до новинок сезона.
          </p>
          
          <p>
            Не упусти шанс получить первый дроп бесплатно! Зарегистрируйся сейчас и получи стартовый пакет для гача-круток. Присоединяйся к гача клубу Weeb-x и собери идеальную команду аниме-героев!
          </p>
        </div>

        <div className="flex flex-wrap gap-3 sm:gap-4 mt-6 sm:mt-8">
          <Link
            href="/gacha"
            className="flex items-center gap-2 bg-purple-500/10 hover:bg-purple-500/20 text-purple-500 px-4 sm:px-6 py-2.5 sm:py-3 rounded-full text-sm sm:text-base font-bold transition-colors dark:bg-purple-500/20 dark:hover:bg-purple-500/30 dark:text-purple-400"
          >
            <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />
            Крутить гачу
          </Link>
          <Link
            href="/battle"
            className="flex items-center gap-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 px-4 sm:px-6 py-2.5 sm:py-3 rounded-full text-sm sm:text-base font-bold transition-colors dark:bg-red-500/20 dark:hover:bg-red-500/30 dark:text-red-400"
          >
            <Swords className="w-4 h-4 sm:w-5 sm:h-5" />
            PvP-арена
          </Link>
          <Link
            href="/catalog"
            className="flex items-center gap-2 bg-orange-500/10 hover:bg-orange-500/20 text-orange-500 px-4 sm:px-6 py-2.5 sm:py-3 rounded-full text-sm sm:text-base font-bold transition-colors dark:bg-orange-500/20 dark:hover:bg-orange-500/30 dark:text-orange-400"
          >
            <Star className="w-4 h-4 sm:w-5 sm:h-5" />
            Смотреть аниме
          </Link>
        </div>
      </div>
    </section>
  )
}
