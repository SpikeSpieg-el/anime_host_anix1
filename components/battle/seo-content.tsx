import Link from "next/link"
import { Sparkles, Swords, Trophy } from "lucide-react"

export function BattleSEOContent() {
  return (
    <section className="container mx-auto px-3 sm:px-4 mb-8 sm:mb-12 relative z-10">
      <div className="bg-secondary/40 border rounded-2xl p-6 sm:p-8 dark:bg-zinc-900/40 dark:border-zinc-800">
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-4 sm:mb-6 flex items-center gap-3 dark:text-white">
          <Swords className="w-7 h-7 sm:w-8 sm:h-8 text-red-400" />
          PvP-арена аниме битв — сразись и возглавь рейтинг
        </h1>
        
        <div className="space-y-4 text-sm sm_text-base text-muted-foreground leading-relaxed dark:text-zinc-300">
          <h2 className="text-lg sm:text-xl font-bold text-foreground dark:text-white">Как участвовать в PvP-сражениях</h2>
          <p>
            PvP-арена Weeb.x — это место, где твои аниме-персонажи проявляют свою силу! Собери команду из гача-героев и сражайся с другими игроками в реальном времени. Чем выше редкость твоих карт, тем больше шансов на победу. SSR и легендарные персонажи обладают уникальными способностями, которые могут перевернуть ход битвы.
          </p>
          
          <h2 className="text-lg sm:text-xl font-bold text-foreground dark:text-white">Рейтинговая система и награды</h2>
          <p>
            Каждая победа поднимает тебя в таблице лидеров. Бойцовский клуб аниме разделён на лиги: от бронзы до легенды. Поднимаясь по рангам, ты получаешь эксклюзивные награды — редкую валюту, специальные гача-паки и уникальные скины для карт. Топ-игроки сезона получают легендарные призы, которые недоступны обычным способом.
          </p>
          
          <h2 className="text-lg sm:text-xl font-bold text-foreground dark:text-white">Советы по сбору команды</h2>
          <p>
            Для успешных PvP-битв важен баланс. Сочетай персонажей с разными ролями: танки, дамагеры, саппорты. Обращай внимание на синергию между картами — некоторые герои усиливают друг друга при совместном использовании. Регулярно крути гачу, чтобы пополнять коллекцию новыми сильными персонажами.
          </p>
          
          <h2 className="text-lg sm:text-xl font-bold text-foreground dark:text-white">Баланс и обновления</h2>
          <p>
            Мы постоянно обновляем PvP-арену: добавляем новые режимы, балансируем существующие карты и проводим сезонные ивенты. Следи за новостями, чтобы не пропустить специальные турниры с увеличенными наградами. Аниме игры онлайн на Weeb.x — это всегда свежий контент и честные соревнования!
          </p>
        </div>

        <div className="flex flex-wrap gap-3 sm:gap-4 mt-6 sm:mt-8">
          <Link
            href="/gacha"
            className="flex items-center gap-2 bg-purple-500/10 hover:bg-purple-500/20 text-purple-500 px-4 sm:px-6 py-2.5 sm:py-3 rounded-full text-sm sm:text-base font-bold transition-colors dark:bg-purple-500/20 dark:hover:bg-purple-500/30 dark:text-purple-400"
          >
            <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />
            Получить героев
          </Link>
          <Link
            href="/catalog"
            className="flex items-center gap-2 bg-orange-500/10 hover:bg-orange-500/20 text-orange-500 px-4 sm:px-6 py-2.5 sm:py-3 rounded-full text-sm sm:text-base font-bold transition-colors dark:bg-orange-500/20 dark:hover:bg-orange-500/30 dark:text-orange-400"
          >
            <Trophy className="w-4 h-4 sm:w-5 sm:h-5" />
            Таблица лидеров
          </Link>
        </div>
      </div>
    </section>
  )
}
