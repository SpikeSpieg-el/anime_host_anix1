"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Github, Send, MessageCircle, Image as ImageIcon } from "lucide-react"
import { Dialog, DialogContent, DialogTrigger, DialogTitle, DialogDescription } from "@/components/ui/dialog"

const animeQuotes = [
  "Ты сильнее, чем думаешь - Аниме учит нас",
  "Даже если будет трудно, не сдавайся! - Naruto",
  "Твоя улыбка освещает этот мир",
  "Ты заслуживаешь быть счастливым",
  "Каждый день - это новый шанс",
  "Ты не один, мы с тобой! - Fairy Tail",
  "Просто дыши. Всё будет хорошо",
  "Сила не в мышцах, а в духе - Demon Slayer",
  "Мечты не имеют срока годности",
  "Падать - не страшно, страшно - не вставать",
  "Ты amazing, не забывай об этом",
  "Иногда нужно всё отпустить, чтобы начать заново",
  "Твоё будущее начинается сегодня",
  "Не бойся ошибаться, бойся не пробовать",
  "Верь в себя, даже если никто не верит",
  "Хочешь стать героем? - My Hero Academia",
  "Друзья - это наша сила! - One Piece",
  "Никогда не сдавайся на полпути к мечте - Attack on Titan",
  "Сила дружбы творит чудеса - Dragon Ball",
  "Защищай тех, кто тебе дорог - Bleach",
  "Настоящая сила - в добром сердце - Sailor Moon",
  "Всегда иди вперёд, даже если страшно - Tokyo Ghoul",
  "Мир прекрасен, когда рядом друзья - Hunter x Hunter",
  "Никогда не теряй надежду - Fullmetal Alchemist",
  "Смелость - это не отсутствие страха - Death Note",
  "Жизнь - это приключение - One Punch Man",
  "Будь собой, несмотря ни на что - Ouran High School Host Club",
  "Сила воли может всё - Re:Zero",
  "Не позволяй прошлому определять твоё будущее - Erased",
  "Каждая встреча имеет смысл - Your Name",
  "История ещё не закончилась - Steins;Gate",
  "Даже в тьме есть свет - Black Clover",
  "Настоящие герои не носят плащи - Mob Psycho 100",
  "Сила в том, чтобы продолжать идти - Haikyuu!!",
  "Верь в магию дружбы - Puella Magi Madoka Magica",
  "Твои решения создают твою судьбу - Code Geass",
  "Никогда не поздно начать сначала - Clannad",
  "Сила сердца важнее силы кулаков - JoJo's Bizarre Adventure",
  "Живи так, чтобы потом не жалело - Angel Beats!",
  "Даже маленький свет может разгнать тьму - Made in Abyss",
  "Настоящая победа - это победа над собой - Blue Exorcist",
  "Сострадание - величайшая сила - Natsume's Book of Friends",
  "Не позволяй другим решать твою судьбу - Sword Art Online",
  "Смысл в пути, а не в цели - Dragon Quest",
  "Даже если ты слабый, ты можешь стать сильным - My Hero Academia",
  "Мир изменяет тот, кто действует - Psycho-Pass",
  "Надежда - это то, что делает нас сильными - Danganronpa",
  "Жизнь ценна, потому что она конечна - Violet Evergarden",
  "Любовь - самая мощная сила в мире - Toradora!",
  "Смешно, как маленькие вещи меняют всё - K-On!",
  "Настоящая семья - это не всегда кровь - Fruits Basket",
  "Смех лечит любые раны - Gintama",
  "Иногда нужно просто поверить - The Girl Who Leapt Through Time",
  "Мечта стоит любых усилий - Weathering with You",
  "Память о друзьях живёт вечно - Anohana: The Flower We Saw That Day",
]

export function Footer() {
  const currentYear = new Date().getFullYear()
  const [quote, setQuote] = useState(animeQuotes[0])

  useEffect(() => {
    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000)
    setQuote(animeQuotes[dayOfYear % animeQuotes.length])
  }, [])

  return (
    <footer className="relative">
      {/* Верхняя граница на всю ширину */}
      <div className="border-t border-border dark:border-white/5"></div>

      <div className="container mx-auto px-3 sm:px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 md:gap-10 lg:gap-12 mb-12 sm:mb-16 py-12 sm:py-16">
          {/* Колонки футера */}
          <div className="space-y-6">
            <a className="flex items-center gap-3 group" href="/">
              <div className="flex flex-col">
                <span className="text-xl font-black tracking-tighter text-foreground font-unbounded dark:text-white">Weeb.<span className="text-primary dark:text-orange-500">X</span></span>
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest dark:text-zinc-500">Stream</span>
              </div>
            </a>
            <p className="text-muted-foreground text-sm leading-relaxed max-w-xs dark:text-zinc-500">Твой путеводитель в мире аниме. Смотри лучшие тайтлы в высоком качестве с персональными рекомендациями.</p>
            
            {/* Цитата дня */}
            <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
              <p className="text-xs text-muted-foreground italic">
                💭 {quote}
              </p>
            </div>
            
            <div className="flex items-center gap-4"></div>
          </div>

          <div>
            <h4 className="text-foreground font-black uppercase tracking-widest text-[10px] sm:text-xs mb-4 sm:mb-6 dark:text-white">Навигация</h4>
            <ul className="space-y-3 sm:space-y-4">
              <li><a className="text-muted-foreground hover:text-primary transition-colors text-sm sm:text-[15px] font-bold dark:text-zinc-500 dark:hover:text-orange-500" href="/catalog">Каталог аниме</a></li>
              <li><a className="text-zinc-500 hover:text-orange-500 transition-colors text-sm sm:text-[15px] font-bold" href="/manga">Манга</a></li>
              <li><a className="text-zinc-500 hover:text-orange-500 transition-colors text-sm sm:text-[15px] font-bold" href="/catalog?status=ongoing">Расписание онгоингов</a></li>
              <li><a className="text-zinc-500 hover:text-orange-500 transition-colors text-sm sm:text-[15px] font-bold" href="/catalog?sort=popular">Популярные хиты</a></li>
              <li><a className="text-zinc-500 hover:text-orange-500 transition-colors text-sm sm:text-[15px] font-bold" href="/catalog?kind=movie">Полнометражные фильмы</a></li>
              <li><a className="text-zinc-500 hover:text-orange-500 transition-colors text-sm sm:text-[15px] font-bold" href="/gacha">WEEB.X Гача</a></li>
              <li><a className="text-zinc-500 hover:text-orange-500 transition-colors text-sm sm:text-[15px] font-bold" href="/market-dashboard">Рынок карт</a></li>
            </ul>
          </div>

          <div>
            <h4 className="text-foreground font-black uppercase tracking-widest text-[10px] sm:text-xs mb-4 sm:mb-6 dark:text-white">Помощь</h4>
            <ul className="space-y-3 sm:space-y-4">
              <li><a className="text-muted-foreground hover:text-foreground transition-colors text-sm sm:text-[15px] font-bold dark:text-zinc-500 dark:hover:text-white" href="/faq">Часто задаваемые вопросы</a></li>
              <li><a className="text-zinc-500 hover:text-white transition-colors text-sm sm:text-[15px] font-bold" href="/dmca">Правообладателям (DMCA)</a></li>
              <li><a className="text-zinc-500 hover:text-white transition-colors text-sm sm:text-[15px] font-bold" href="/terms">Пользовательское соглашение</a></li>
              <li><a className="text-zinc-500 hover:text-white transition-colors text-sm sm:text-[15px] font-bold" href="/contacts">Контакты</a></li>
            </ul>
          </div>

          <div>
            <h4 className="text-foreground font-black uppercase tracking-widest text-[10px] sm:text-xs mb-4 sm:mb-6 dark:text-white">Правовая информация</h4>
            <div className="p-4 rounded-2xl bg-secondary/50 border border-border dark:bg-zinc-900/50 dark:border-white/5">
              <p className="text-[11px] text-muted-foreground leading-relaxed italic dark:text-zinc-500">Весь контент на сайте предоставлен из открытых источников. Мы не храним видеофайлы на наших серверах. Все права на аниме принадлежат их законным владельцам.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Нижняя граница и футер-бар на всю ширину */}
      <div className="border-t border-border dark:border-white/5">
        <div className="container mx-auto px-3 sm:px-4">
          <div className="py-6 sm:py-8 flex flex-col md:flex-row justify-between items-center gap-3 sm:gap-4">
            <p className="text-muted-foreground text-[9px] sm:text-[10px] font-bold tracking-widest uppercase text-center md:text-left dark:text-zinc-600">© {currentYear} Weeb.X STREAM. MADE BY ANIME FANS FOR ANIME FANS.</p>
            <div className="flex items-center gap-6">
              <Dialog>
                <DialogTrigger asChild>
                  <button className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest hover:text-primary transition-colors dark:text-zinc-600 dark:hover:text-orange-500">
                    <ImageIcon className="w-4 h-4" />
                    Показать баннер
                  </button>
                </DialogTrigger>
                <DialogContent className="p-0 overflow-hidden">
                  <DialogTitle className="sr-only">Банер</DialogTitle>
                  <DialogDescription className="sr-only">Просмотр баннера</DialogDescription>
                  <img 
                    src="/baner.png" 
                    alt="Банер" 
                    className="w-full h-auto"
                  />
                </DialogContent>
              </Dialog>
              <span className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest dark:text-zinc-600">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                All Systems Operational
              </span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
