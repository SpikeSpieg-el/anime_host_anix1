import Link from "next/link"
import { Sparkles, Swords, Trophy, Zap } from "lucide-react"

export function GameGuideContent() {
  return (
    <section className="mb-16 scroll-mt-32">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-2.5 bg-purple-500/10 rounded-xl">
          <Sparkles className="w-6 h-6 text-purple-500" />
        </div>
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-foreground">Как начать играть: гача, PvP и прокачка</h2>
          <p className="text-muted-foreground text-sm">Полный гайд для новичков Weebx</p>
        </div>
      </div>

      <div className="bg-secondary/40 border rounded-2xl p-6 sm:p-8 dark:bg-zinc-900/40 dark:border-zinc-800">
        <div className="space-y-6 text-sm sm:text-base text-muted-foreground leading-relaxed dark:text-zinc-300">
          <div>
            <h3 className="text-lg font-bold text-foreground mb-2 dark:text-white flex items-center gap-2">
              <Zap className="w-5 h-5 text-orange-500" />
              Регистрация и первые шаги
            </h3>
            <p>
              Добро пожаловать в Weebx! Регистрация займёт минуту — просто укажи email и пароль. После входа ты получишь стартовый пакет с бесплатной гача-круткой. Это твой шанс получить первого легендарного героя без затрат! Не забудь проверить почту для подтверждения аккаунта — это откроет доступ ко всем функциям.
            </p>
          </div>

          <div>
            <h3 className="text-lg font-bold text-foreground mb-2 dark:text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-500" />
              Как работает гача и как получить первых героев
            </h3>
            <p>
              Гача-система Weebx — это как ящик с сюрпризами, только с аниме-персонажами! Крути паки за игровую валюту и получай карты разной редкости: от обычных N до легендарных SSR. Чем выше редкость, тем сильнее герой в PvP-арене. Система пити гарантирует выпадение легендарной карты после определённого количества круток. Начни с бесплатных ежедневных круток и копи валюту для серьёзных паков!
            </p>
          </div>

          <div>
            <h3 className="text-lg font-bold text-foreground mb-2 dark:text-white flex items-center gap-2">
              <Swords className="w-5 h-5 text-red-500" />
              Основы PvP – твоя первая битва
            </h3>
            <p>
              PvP-арена — это где твои герои проявляют себя! Собери команду из 5 карт с балансом ролей: танки, дамагеры и саппорты. Обрати внимание на синергию — некоторые персонажи усиливают друг друга. Первые битвы проводи против AI, чтобы понять механику. Когда почувствуешь уверенность — переходи в PvP против реальных игроков и поднимайся в рейтинге!
            </p>
          </div>

          <div>
            <h3 className="text-lg font-bold text-foreground mb-2 dark:text-white flex items-center gap-2">
              <Trophy className="w-5 h-5 text-yellow-500" />
              Ежедневные задания и фарм валюты
            </h3>
            <p>
              Ежедневные задания — твой главный источник валюты. Входи каждый день для получения бонуса входа, выполняй простые задачи и получай награды. Участвуй в PvP-битвах для дополнительного фарма. Чем выше твой ранг, тем больше валюты ты получаешь. Не пропускай сезонные ивенты — в них раздают уникальные награды, которые недоступны в обычное время!
            </p>
          </div>

          <div>
            <h3 className="text-lg font-bold text-foreground mb-2 dark:text-white">Частые ошибки новичков</h3>
            <p>
              Главная ошибка — тратить всю валюту на случайные крутки. Лучше копи на конкретный баннер с нужным персонажем. Вторая ошибка — игнорировать синергию команд. Сбалансированный колода всегда сильнее набора случайных легендарок. И самое важное — не забывай прокачивать своих героев! Редкость не всегда значит силу — прокачанный SR может победить не прокачанного SSR.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 sm:gap-4 mt-6 sm:mt-8 pt-6 border-t border-border dark:border-zinc-700">
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
        </div>
      </div>
    </section>
  )
}
