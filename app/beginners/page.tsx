"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { 
  ArrowLeft, 
  Star, 
  PlayCircle, 
  BookOpen, 
  Monitor,
  Clock,
  Film,
  Flag,
  BadgeCheck,
  Info,
  LayoutGrid,
  MousePointer2,
  Download,
  ExternalLink,
  CheckCircle2,
  Filter,
  Bookmark,
  Lightbulb,
  Smartphone,
  RotateCcw,
  Search
} from "lucide-react"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"

export default function BeginnersPage() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Helper function for dynamic episode/series text
  const getEpisodeText = (count: number): string => {
    if (count === 1) return "Серия"
    const lastDigit = count % 10
    const lastTwoDigits = count % 100
    
    if (lastTwoDigits >= 11 && lastTwoDigits <= 14) return "Серий"
    if (lastDigit === 1) return "Серия"
    if (lastDigit >= 2 && lastDigit <= 4) return "Серии"
    return "Серий"
  }

  if (!mounted) return null

  return (
    <main className="min-h-screen bg-zinc-950 text-white pb-20 md:pb-24 selection:bg-orange-500/30">
      <Navbar />

      <div className="container mx-auto px-4 pt-8 pb-12 max-w-6xl">
        
        {/* --- Header --- */}
        <div className="mb-10">
          <Link 
            href="/" 
            className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-800 hover:border-orange-500 text-zinc-400 hover:text-white font-medium rounded-xl transition-all mb-6 group backdrop-blur-sm"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            На главную
          </Link>
          
          <div className="flex flex-col md:flex-row md:items-start gap-6">
            <div className="p-4 bg-orange-500/10 rounded-2xl border border-orange-500/20 w-fit hidden md:block">
              <BookOpen size={40} className="text-orange-500" />
            </div>
            <div className="max-w-3xl">
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight mb-4">
                Гайд по интерфейсу 
              </h1>
              <span className="text-zinc-600 text-sm text-5xl font-bold">(в разработке)</span>
              <p className="text-zinc-400 text-lg">
                Прежде чем начать смотреть, давайте разберемся, как работает наш сайт. 
                Мы подробно объясним каждый значок, кнопку и элемент, чтобы вы чувствовали себя уверенно.
              </p>
            </div>
          </div>
        </div>

        {/* --- SECTION 1: Basic Icons (Top Level) --- */}
        <div className="mb-12 scroll-mt-24" id="icons">
          <div className="flex items-center gap-3 mb-6">
            <BadgeCheck className="text-orange-500" />
            <h2 className="text-2xl font-bold text-white">Основные обозначения</h2>
          </div>
          
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 md:p-8">
            <div className="grid sm:grid-cols-2 gap-6">
              {/* Item 1 */}
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-14 h-14 bg-zinc-950 rounded-xl border border-zinc-800 flex items-center justify-center">
                  <Monitor className="w-7 h-7 text-orange-500" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white mb-1">TV / WEB (Качество)</h3>
                  <p className="text-zinc-400 text-sm leading-relaxed">
                    Обозначает источник видео. 
                    <span className="text-white font-semibold"> TV</span> — версия с эфирного телевидения (лучшее качество). 
                    <span className="text-white font-semibold"> WEB</span> — версия с онлайн-кинотеатров (обычно хуже).
                    <br /><span className="text-orange-400 font-semibold">Оранжевая метка TV</span> — онгоинг (сейчас выходит). 
                    <span className="text-zinc-400 font-semibold">Серая метка</span> — тайтл завершён.
                  </p>
                </div>
              </div>

              {/* Item 2 */}
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-14 h-14 bg-zinc-950 rounded-xl border border-zinc-800 flex items-center justify-center">
                  <Star className="w-7 h-7 text-orange-500 fill-orange-500" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white mb-1">Рейтинг (Звезда)</h3>
                  <p className="text-zinc-400 text-sm leading-relaxed">
                    Число рядом со звездой — это средняя оценка пользователей сайта Shikimori. 
                    Чем выше цифра (например, <span className="text-orange-400">9.0</span>), тем популярнее тайтл.
                  </p>
                </div>
              </div>

              {/* Item 3 */}
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-14 h-14 bg-zinc-950 rounded-xl border border-zinc-800 flex items-center justify-center">
                  <Clock className="w-7 h-7 text-orange-500" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white mb-1">Статус выхода</h3>
                  <p className="text-zinc-400 text-sm leading-relaxed">
                    <span className="text-white font-semibold">Онгоинг</span> — серия выходит каждую неделю. <br />
                    <span className="text-white font-semibold">Завершён</span> — все серии уже вышли. <br />
                    <span className="text-white font-semibold">Анонс</span> — дата выхода известна, но серий еще нет.
                  </p>
                </div>
              </div>

              {/* Item 4 */}
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-14 h-14 bg-zinc-950 rounded-xl border border-zinc-800 flex items-center justify-center">
                  <Flag className="w-7 h-7 text-orange-500" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white mb-1">Субтитры vs Озвучка</h3>
                  <p className="text-zinc-400 text-sm leading-relaxed">
                    Наш плеер обычно предлагает <span className="text-white font-semibold">Субтитры</span> (текст снизу) или <span className="text-white font-semibold">Озвучку</span> (русский голос). 
                    Рекомендуем начать с субтитров для оригинальных эмоций.
                  </p>
                </div>
              </div>

              {/* Item 5 */}
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-14 h-14 bg-zinc-950 rounded-xl border border-zinc-800 flex items-center justify-center">
                  <div className="w-7 h-7 bg-orange-500 rounded-full"></div>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white mb-1">Оранжевые акценты</h3>
                  <p className="text-zinc-400 text-sm leading-relaxed">
                    <span className="text-white font-semibold">Оранжевый цвет</span> — это наш фирменный цвет. Он используется для интерактивных элементов: 
                    наведение на карточки, активные кнопки, важные метки. Если видите оранжевое — значит можно взаимодействовать.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* --- SECTION 2: Card Anatomy (Visual Breakdown) --- */}
        <div className="mb-12 scroll-mt-24" id="cards">
          <div className="flex items-center gap-3 mb-6">
            <LayoutGrid className="text-orange-500" />
            <h2 className="text-2xl font-bold text-white">Устройство карточки</h2>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
            <div className="grid md:grid-cols-12">
              
              {/* Visual Simulation (Left Side) */}
              <div className="md:col-span-5 bg-zinc-950/50 p-8 flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-zinc-800 relative">
                <div className="text-zinc-500 text-sm font-mono mb-6 uppercase tracking-widest text-center">Интерактивный пример</div>
                
                {/* Mock Card */}
                <div className="relative aspect-[2/3] w-56 rounded-lg overflow-hidden bg-zinc-900 shadow-lg group cursor-help select-none">
                  {/* Mock Image */}
                  <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1578632767115-351597cf2477?q=80&w=600&auto=format&fit=crop')] bg-cover bg-center opacity-60 group-hover:scale-105 transition-transform duration-500"></div>
                  
                  {/* Градиент */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-60"></div>
                  
                  {/* Element 1: Bookmark Button (Top Left) */}
                  <div className="absolute top-2 left-2 z-20">
                    <div className="bg-black/60 hover:bg-black/70 text-white border border-white/10 backdrop-blur-sm h-7 w-7 rounded-md flex items-center justify-center">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                      </svg>
                    </div>
                  </div>

                  {/* Element 2: Quality Badge (Top Right) */}
                  <div className="absolute top-2 right-2 z-20">
                    <span className="bg-orange-500 text-black text-[10px] font-bold px-1.5 py-0.5 rounded shadow-sm">TV</span>
                  </div>

                  {/* Element 3: Rating (Bottom Left) */}
                  <div className="absolute bottom-2 left-2 z-20">
                    <div className="flex items-center gap-1">
                      <Star className="w-3 h-3 fill-yellow-500 text-yellow-500" />
                      <span className="font-bold text-white text-xs shadow-black drop-shadow-md">8.9</span>
                    </div>
                  </div>

                  {/* Connecting Lines for explanation (Desktop) */}
                  <div className="hidden md:block absolute -left-20 top-2 w-16 h-px bg-orange-500/50"></div>
                  <div className="hidden md:block absolute -right-20 top-2 w-16 h-px bg-orange-500/50"></div>
                  <div className="hidden md:block absolute -bottom-10 left-2 w-px h-10 bg-orange-500/50"></div>
                </div>

                {/* Mock Title and Info */}
                <div className="mt-2 w-56">
                  <h4 className="font-bold text-white text-sm line-clamp-2 group-hover:text-orange-500 transition-colors leading-tight">
                    Название демонстрационного аниме
                  </h4>
                  <p className="text-zinc-500 text-xs mt-0.5">
                    2024 • 12 {getEpisodeText(12)}.
                  </p>
                </div>

                <p className="mt-6 text-center text-xs text-zinc-600 max-w-[200px]">
                  (Наведите мышкой на пример, чтобы увидеть эффект наведения)
                </p>
              </div>

              {/* Explanations (Right Side) */}
              <div className="md:col-span-7 p-6 md:p-8 flex flex-col justify-center space-y-6">
                
                <div className="flex gap-4 items-start group">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-orange-500/20 text-orange-500 flex items-center justify-center font-bold border border-orange-500/20 group-hover:bg-orange-500 group-hover:text-white transition-colors">1</div>
                  <div>
                    <h4 className="font-bold text-white text-lg group-hover:text-orange-400 transition-colors">Закладки (Слева сверху)</h4>
                    <p className="text-zinc-400 text-sm mt-1">
                      Иконка книги для сохранения тайтла. Нажмите, чтобы добавить аниме в личный список и не потерять.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4 items-start group">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-orange-500/20 text-orange-500 flex items-center justify-center font-bold border border-orange-500/20 group-hover:bg-orange-500 group-hover:text-white transition-colors">2</div>
                  <div>
                    <h4 className="font-bold text-white text-lg group-hover:text-orange-400 transition-colors">Качество (Справа сверху)</h4>
                    <p className="text-zinc-400 text-sm mt-1">
                      Оранжевая метка <span className="bg-orange-500/20 text-orange-400 px-1 rounded text-xs border border-orange-500/30">TV</span> или <span className="bg-orange-500/20 text-orange-400 px-1 rounded text-xs border border-orange-500/30">WEB</span>. 
                      Всегда выбирайте TV, если доступно.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4 items-start group">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-orange-500/20 text-orange-500 flex items-center justify-center font-bold border border-orange-500/20 group-hover:bg-orange-500 group-hover:text-white transition-colors">3</div>
                  <div>
                    <h4 className="font-bold text-white text-lg group-hover:text-orange-400 transition-colors">Рейтинг (Слева внизу)</h4>
                    <p className="text-zinc-400 text-sm mt-1">
                      Звезда с числом показывает среднюю оценку сообщества. Если меньше 6.0 — скорее всего, тайтл слабый.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4 items-start group">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-orange-500/20 text-orange-500 flex items-center justify-center font-bold border border-orange-500/20 group-hover:bg-orange-500 group-hover:text-white transition-colors">4</div>
                  <div>
                    <h4 className="font-bold text-white text-lg group-hover:text-orange-400 transition-colors">Название и Информация</h4>
                    <p className="text-zinc-400 text-sm mt-1">
                      Под картинкой. Название подсвечивается оранжевым при наведении — значит можно кликать. Год и номер серии под названием.
                    </p>
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>

        {/* --- SECTION 3: Player Page Guide --- */}
        <div className="mb-12 scroll-mt-24" id="player">
          <div className="flex items-center gap-3 mb-6">
            <PlayCircle className="text-orange-500" />
            <h2 className="text-2xl font-bold text-white">Страница просмотра</h2>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Player Controls */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
              <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                <MousePointer2 className="w-5 h-5 text-orange-500" />
                Управление плеером
              </h3>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <div className="mt-1 w-5 h-5 rounded border border-zinc-600 flex items-center justify-center bg-zinc-800">
                    <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                  </div>
                  <div>
                    <span className="text-zinc-200 font-medium">Выбор озвучки/перевода</span>
                    <p className="text-zinc-500 text-xs mt-1">В плеере есть вкладки (сверху или снизу). Выберите "Субтитры" или "Дубляж".</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="mt-1 w-5 h-5 rounded border border-zinc-600 flex items-center justify-center bg-zinc-800">
                    <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                  </div>
                  <div>
                    <span className="text-zinc-200 font-medium">Следующая серия</span>
                    <p className="text-zinc-500 text-xs mt-1">Под плеером есть список всех серий. Просто кликните на номер, чтобы переключиться.</p>
                  </div>
                </li>
              </ul>
            </div>

            {/* Actions */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
              <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                <Download className="w-5 h-5 text-orange-500" />
                Дополнительные кнопки
              </h3>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <div className="mt-1 w-5 h-5 rounded border border-zinc-600 flex items-center justify-center bg-zinc-800">
                    <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                  </div>
                  <div>
                    <span className="text-zinc-200 font-medium">Скачать (иконка диска)</span>
                    <p className="text-zinc-500 text-xs mt-1">Нажмите, если хотите скачать торрент. Перебросит на поисковик.</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="mt-1 w-5 h-5 rounded border border-zinc-600 flex items-center justify-center bg-zinc-800">
                    <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                  </div>
                  <div>
                    <span className="text-zinc-200 font-medium">В закладки (иконка книги)</span>
                    <p className="text-zinc-500 text-xs mt-1">Сохраняет тайтл в ваш личный список, чтобы не потерять.</p>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* --- SECTION 4: Catalog Features --- */}
        <div className="mb-12 scroll-mt-24" id="catalog">
          <div className="flex items-center gap-3 mb-6">
            <LayoutGrid className="text-orange-500" />
            <h2 className="text-2xl font-bold text-white">Каталог и фильтры</h2>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* View Modes */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
              <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                <LayoutGrid className="w-5 h-5 text-orange-500" />
                Режимы отображения
              </h3>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <div className="mt-1 w-5 h-5 rounded border border-zinc-600 flex items-center justify-center bg-zinc-800">
                    <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                  </div>
                  <div>
                    <span className="text-zinc-200 font-medium">Comfortable (удобный)</span>
                    <p className="text-zinc-500 text-xs mt-1">2 колонки, большие карточки. Идеально для планшетов и ПК.</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="mt-1 w-5 h-5 rounded border border-zinc-600 flex items-center justify-center bg-zinc-800">
                    <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                  </div>
                  <div>
                    <span className="text-zinc-200 font-medium">Compact (компактный)</span>
                    <p className="text-zinc-500 text-xs mt-1">3 колонки на мобильных. Больше контента на экране.</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="mt-1 w-5 h-5 rounded border border-zinc-600 flex items-center justify-center bg-zinc-800">
                    <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                  </div>
                  <div>
                    <span className="text-zinc-200 font-medium">Table (таблица)</span>
                    <p className="text-zinc-500 text-xs mt-1">Плиточный вид с горизонтальной компоновкой.</p>
                  </div>
                </li>
              </ul>
            </div>

            {/* Filters */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
              <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                <Filter className="w-5 h-5 text-orange-500" />
                Умные фильтры
              </h3>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <div className="mt-1 w-5 h-5 rounded border border-zinc-600 flex items-center justify-center bg-zinc-800">
                    <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                  </div>
                  <div>
                    <span className="text-zinc-200 font-medium">Сортировка</span>
                    <p className="text-zinc-500 text-xs mt-1">Популярные, Новинки, Рейтинг. Помогает найти лучшее.</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="mt-1 w-5 h-5 rounded border border-zinc-600 flex items-center justify-center bg-zinc-800">
                    <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                  </div>
                  <div>
                    <span className="text-zinc-200 font-medium">Фильтр по рейтингу</span>
                    <p className="text-zinc-500 text-xs mt-1">От 5★ до 9★. Исключите слабые тайтлы.</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="mt-1 w-5 h-5 rounded border border-zinc-600 flex items-center justify-center bg-zinc-800">
                    <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                  </div>
                  <div>
                    <span className="text-zinc-200 font-medium">Типы контента</span>
                    <p className="text-zinc-500 text-xs mt-1">ТВ сериал, Фильм, OVA, ONA, Спешл.</p>
                  </div>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-6 bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6">
            <h4 className="font-bold text-white mb-3 flex items-center gap-2">
              <MousePointer2 className="w-4 h-4 text-orange-500" />
              Фишки каталога
            </h4>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 bg-orange-500/10 rounded-lg border border-orange-500/20 flex items-center justify-center">
                  <Lightbulb className="w-4 h-4 text-orange-500" />
                </div>
                <div>
                  <p className="text-zinc-300 text-sm">Панель фильтров автоматически скрывается при прокрутке для удобства</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 bg-orange-500/10 rounded-lg border border-orange-500/20 flex items-center justify-center">
                  <Smartphone className="w-4 h-4 text-orange-500" />
                </div>
                <div>
                  <p className="text-zinc-300 text-sm">Следующая страница подгружается автоматически при скролле</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 bg-orange-500/10 rounded-lg border border-orange-500/20 flex items-center justify-center">
                  <RotateCcw className="w-4 h-4 text-orange-500" />
                </div>
                <div>
                  <p className="text-zinc-300 text-sm">Кнопка "Сбросить" возвращает все фильтры к исходному состоянию</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 bg-orange-500/10 rounded-lg border border-orange-500/20 flex items-center justify-center">
                  <Search className="w-4 h-4 text-orange-500" />
                </div>
                <div>
                  <p className="text-zinc-300 text-sm">Поиск работает по названиям на русском и английском</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* --- SECTION 5: Advanced Tips --- */}
        <div className="mb-12 scroll-mt-24" id="tips">
          <div className="flex items-center gap-3 mb-6">
            <Info className="text-orange-500" />
            <h2 className="text-2xl font-bold text-white">Продвинутые советы</h2>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 md:p-8">
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="p-4 rounded-xl bg-zinc-950/50 border border-zinc-800/50">
                <h4 className="text-orange-400 font-bold mb-2 flex items-center gap-2">
                  <ArrowLeft className="w-4 h-4" />
                  Умная кнопка "Назад"
                </h4>
                <p className="text-zinc-500 text-xs">
                  На странице просмотра кнопка "Назад" возвращает на предыдущую страницу, 
                  а если истории нет — в каталог.
                </p>
              </div>
              
              <div className="p-4 rounded-xl bg-zinc-950/50 border border-zinc-800/50">
                <h4 className="text-orange-400 font-bold mb-2 flex items-center gap-2">
                  <Bookmark className="w-4 h-4" />
                  Закладки меняют цвет
                </h4>
                <p className="text-zinc-500 text-xs">
                  Сохранённый тайтл подсвечивается оранжевым. 
                  Кнопка показывает "Сохранено" вместо "В закладки".
                </p>
              </div>
              
              <div className="p-4 rounded-xl bg-zinc-950/50 border border-zinc-800/50">
                <h4 className="text-orange-400 font-bold mb-2 flex items-center gap-2">
                  <Download className="w-4 h-4" />
                  Скачать через торренты
                </h4>
                <p className="text-zinc-500 text-xs">
                  Кнопка "Скачать" открывает диалог с RuTracker и Rutor. 
                  Ищет целый сезон, а не отдельные серии.
                </p>
              </div>
              
              <div className="p-4 rounded-xl bg-zinc-950/50 border border-zinc-800/50">
                <h4 className="text-orange-400 font-bold mb-2 flex items-center gap-2">
                  <PlayCircle className="w-4 h-4" />
                  Автоскролл к плееру
                </h4>
                <p className="text-zinc-500 text-xs">
                  При выборе серии страница плавно прокручивается к плееру, 
                  чтобы не искать его вручную.
                </p>
              </div>
              
              <div className="p-4 rounded-xl bg-zinc-950/50 border border-zinc-800/50">
                <h4 className="text-orange-400 font-bold mb-2 flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  История просмотра
                </h4>
                <p className="text-zinc-500 text-xs">
                  Сайт запоминает, какую серию вы смотрите. 
                  При следующем визите можно продолжить с того же места.
                </p>
              </div>
              
              <div className="p-4 rounded-xl bg-zinc-950/50 border border-zinc-800/50">
                <h4 className="text-orange-400 font-bold mb-2 flex items-center gap-2">
                  <ExternalLink className="w-4 h-4" />
                  Внешние ссылки
                </h4>
                <p className="text-zinc-500 text-xs">
                  Все внешние ссылки (торренты, Shikimori) открываются в новой вкладке. 
                  Ваш просмотр не прерывается.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* --- SECTION 6: Glossary / Terms --- */}
        <div className="mb-12 scroll-mt-24" id="glossary">
          <div className="flex items-center gap-3 mb-6">
            <Info className="text-orange-500" />
            <h2 className="text-2xl font-bold text-white">Словарь терминов</h2>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 md:p-8">
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-zinc-950/50 border border-zinc-800/50">
                <h4 className="text-orange-400 font-bold mb-1">Онгоинг (Ongoing)</h4>
                <p className="text-zinc-500 text-xs">Аниме, которое сейчас выходит по одной серии в неделю.</p>
              </div>
              <div className="p-4 rounded-xl bg-zinc-950/50 border border-zinc-800/50">
                <h4 className="text-orange-400 font-bold mb-1">Тайтл</h4>
                <p className="text-zinc-500 text-xs">Так фанаты называют одно аниме (фильм или сериал).</p>
              </div>
              <div className="p-4 rounded-xl bg-zinc-950/50 border border-zinc-800/50">
                <h4 className="text-orange-400 font-bold mb-1">Сезонность (Курсы)</h4>
                <p className="text-zinc-500 text-xs">Аниме выходит кварталами: Зима, Весна, Лето, Осень.</p>
              </div>
              <div className="p-4 rounded-xl bg-zinc-950/50 border border-zinc-800/50">
                <h4 className="text-orange-400 font-bold mb-1">Фуллметл</h4>
                <p className="text-zinc-500 text-xs">Сериал длиной от 24 до 26 серий (обычный сезон).</p>
              </div>
              <div className="p-4 rounded-xl bg-zinc-950/50 border border-zinc-800/50">
                <h4 className="text-orange-400 font-bold mb-1">ONA / OVA</h4>
                <p className="text-zinc-500 text-xs">Аниме, выпущенное сразу для интернета или на дисках, без TV-эфира.</p>
              </div>
              <div className="p-4 rounded-xl bg-zinc-950/50 border border-zinc-800/50">
                <h4 className="text-orange-400 font-bold mb-1">Сёнэн / Сёдзё</h4>
                <p className="text-zinc-500 text-xs">Жанры: для мальчиков (боевики) и для девочек (романтика) соответственно.</p>
              </div>
            </div>
          </div>
        </div>

        {/* --- Ready to Start --- */}
        <div className="text-center py-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/10 border border-green-500/20 mb-4">
            <CheckCircle2 className="w-8 h-8 text-green-500" />
          </div>
          <h2 className="text-3xl font-bold text-white mb-2">Готовы к просмотру?</h2>
          <p className="text-zinc-400 mb-8 max-w-lg mx-auto">
            Теперь вы знаете всё необходимое. Самое время найти свой первый тайтл в каталоге.
          </p>
          <Link
            href="/catalog"
            className="inline-flex items-center justify-center gap-2 px-8 py-3 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-orange-900/20 hover:shadow-orange-900/40"
          >
            Открыть полный каталог
            <ArrowLeft className="w-4 h-4 rotate-180" />
          </Link>
        </div>

      </div>

      <Footer />
    </main>
  )
}