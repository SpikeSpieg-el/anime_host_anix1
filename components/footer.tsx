import Link from "next/link"
import { Zap, Github, Send, MessageCircle } from "lucide-react"

export function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="bg-zinc-950 border-t border-white/5 pt-12 sm:pt-16 pb-8">
      <div className="container mx-auto px-3 sm:px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 md:gap-10 lg:gap-12 mb-12 sm:mb-16">
          
          {/* Brand Column */}
          <div className="space-y-6">
            <Link href="/" className="flex items-center gap-3 group">
              <div className="relative w-10 h-10 flex items-center justify-center bg-gradient-to-br from-zinc-800 to-black border border-white/10 rounded-xl shadow-2xl">
                <Zap className="w-6 h-6 text-orange-500 fill-orange-500" />
              </div>
              <div className="flex flex-col">
                <span className="text-xl font-black tracking-tighter text-white font-unbounded">Weeb.<span className="text-orange-500">X</span></span>
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Stream</span>
              </div>
            </Link>
            <p className="text-zinc-500 text-sm leading-relaxed max-w-xs">
              Твой путеводитель в мире аниме. Смотри лучшие тайтлы в высоком качестве с персональными рекомендациями.
            </p>
            <div className="flex items-center gap-4">
              {/* <a href="https://t.me/anix_stream" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-xl bg-zinc-900 flex items-center justify-center text-zinc-400 hover:bg-orange-500 hover:text-white transition-all">
                <Send size={18} />
              </a>
              <a href="https://discord.gg/Weeb.X" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-xl bg-zinc-900 flex items-center justify-center text-zinc-400 hover:bg-orange-500 hover:text-white transition-all">
                <MessageCircle size={18} />
              </a>
              <a href="https://github.com/Weeb.X-stream" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-xl bg-zinc-900 flex items-center justify-center text-zinc-400 hover:bg-orange-500 hover:text-white transition-all">
                <Github size={18} />
              </a> */}
            </div>
          </div>

          {/* Navigation */}
          <div>
            <h4 className="text-white font-black uppercase tracking-widest text-[10px] sm:text-xs mb-4 sm:mb-6">Навигация</h4>
            <ul className="space-y-3 sm:space-y-4">
              <li><Link href="/catalog" className="text-zinc-500 hover:text-orange-500 transition-colors text-sm sm:text-[15px] font-bold">Каталог аниме</Link></li>
              <li><Link href="/catalog?status=ongoing" className="text-zinc-500 hover:text-orange-500 transition-colors text-sm sm:text-[15px] font-bold">Расписание онгоингов</Link></li>
              <li><Link href="/catalog?sort=popular" className="text-zinc-500 hover:text-orange-500 transition-colors text-sm sm:text-[15px] font-bold">Популярные хиты</Link></li>
              <li><Link href="/catalog?kind=movie" className="text-zinc-500 hover:text-orange-500 transition-colors text-sm sm:text-[15px] font-bold">Полнометражные фильмы</Link></li>
            </ul>
          </div>

          {/* Important Links */}
          <div>
            <h4 className="text-white font-black uppercase tracking-widest text-[10px] sm:text-xs mb-4 sm:mb-6">Помощь</h4>
            <ul className="space-y-3 sm:space-y-4">
              <li><Link href="/faq" className="text-zinc-500 hover:text-white transition-colors text-sm sm:text-[15px] font-bold">Часто задаваемые вопросы</Link></li>
              <li><Link href="/dmca" className="text-zinc-500 hover:text-white transition-colors text-sm sm:text-[15px] font-bold">Правообладателям (DMCA)</Link></li>
              <li><Link href="/terms" className="text-zinc-500 hover:text-white transition-colors text-sm sm:text-[15px] font-bold">Пользовательское соглашение</Link></li>
              <li><Link href="/contacts" className="text-zinc-500 hover:text-white transition-colors text-sm sm:text-[15px] font-bold">Контакты</Link></li>
            </ul>
          </div>

          {/* Disclaimer */}
          <div>
            <h4 className="text-white font-black uppercase tracking-widest text-[10px] sm:text-xs mb-4 sm:mb-6">Правовая информация</h4>
            <div className="p-4 rounded-2xl bg-zinc-900/50 border border-white/5">
              <p className="text-[11px] text-zinc-500 leading-relaxed italic">
                Весь контент на сайте предоставлен из открытых источников. Мы не храним видеофайлы на наших серверах. Все права на аниме принадлежат их законным владельцам.
              </p>
            </div>
          </div>
        </div>

        <div className="pt-6 sm:pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-3 sm:gap-4">
          <p className="text-zinc-600 text-[9px] sm:text-[10px] font-bold tracking-widest uppercase text-center md:text-left">
            © {currentYear} Weeb.X STREAM. MADE BY ANIME FANS FOR ANIME FANS.
          </p>
          <div className="flex items-center gap-6">
            <span className="flex items-center gap-2 text-[10px] font-bold text-zinc-600 uppercase tracking-widest">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500" /> 
              All Systems Operational
            </span>
          </div>
        </div>
      </div>
    </footer>
  )
}