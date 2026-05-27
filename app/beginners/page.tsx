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
  BadgeCheck,
  CheckCircle2,
  Bookmark,
  Lightbulb,
  RotateCcw,
  Search,
  Zap,
  ChevronRight,
  Sparkles,
  Eye,
  Volume2,
  MessageSquare,
  Shield,
  Award,
  TrendingUp,
  Calendar,
  Film,
  LayoutGrid,
  Filter,
  Download,
  ExternalLink,
  MousePointerClick,
  Check,
  X,
  Play,
  SkipForward,
  Settings,
  Maximize,
  VolumeX,
  Pause,
  Smartphone,
  HardDrive
} from "lucide-react"
import { Navbar } from "@/components/layout/navbar"
import { Footer } from "@/components/layout/footer"
import { ScrollToTop } from "@/components/layout/scroll-to-top"

const navItems = [
  { id: "icons", label: "Значки", icon: BadgeCheck },
  { id: "cards", label: "Карточки", icon: LayoutGrid },
  { id: "player", label: "Плеер", icon: PlayCircle },
  { id: "catalog", label: "Каталог", icon: Filter },
  { id: "tips", label: "Советы", icon: Lightbulb },
  { id: "glossary", label: "Словарь", icon: BookOpen },
]

export default function BeginnersPage() {
  const [mounted, setMounted] = useState(false)
  const [activeSection, setActiveSection] = useState<string>("")

  useEffect(() => {
    setMounted(true)

    const handleScroll = () => {
      const sections = navItems.map(item => item.id)
      const scrollPosition = window.scrollY + 150

      for (const section of sections) {
        const element = document.getElementById(section)
        if (element) {
          const { offsetTop, offsetHeight } = element
          if (scrollPosition >= offsetTop && scrollPosition < offsetTop + offsetHeight) {
            setActiveSection(section)
            break
          }
        }
      }
    }

    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId)
    if (element) {
      const offsetTop = element.offsetTop - 180
      window.scrollTo({
        top: offsetTop,
        behavior: "smooth"
      })
    }
  }

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
    <main className="min-h-screen bg-background text-foreground pb-20 md:pb-24 selection:bg-orange-500/30 relative">
      {/* Dot Pattern Background */}
      <div className="absolute inset-0 z-0 pointer-events-none opacity-[0.07]">
        <div className="absolute inset-0 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:20px_20px]" />
      </div>

      <Navbar />

      <div className="container mx-auto px-4 pt-8 pb-12 max-w-7xl relative z-10">

        {/* --- Hero Header --- */}
        <section className="mb-16 relative">
          <div className="absolute inset-0 bg-gradient-to-r from-orange-500/10 to-purple-500/10 rounded-3xl blur-3xl -z-10" />
          
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-orange-500/10 via-background to-purple-500/10 border border-orange-500/20 p-8 md:p-12">
            <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/10 rounded-full blur-3xl" />
            
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-4 py-2 bg-secondary/80 hover:bg-secondary border border-border hover:border-orange-500/50 text-muted-foreground hover:text-foreground font-medium rounded-xl transition-all mb-6 group backdrop-blur-sm"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
              На главную
            </Link>

            <div className="flex flex-col md:flex-row md:items-center gap-6">
              <div className="relative">
                <div className="absolute inset-0 bg-orange-500/20 rounded-2xl blur-xl" />
                <div className="relative p-4 bg-orange-500/10 rounded-2xl border border-orange-500/30">
                  <BookOpen size={48} className="text-orange-500" />
                </div>
              </div>
              
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-5 h-5 text-orange-500" />
                  <span className="text-orange-500 font-bold text-sm uppercase tracking-wider">Для новичков</span>
                </div>
                <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black tracking-tight mb-4 bg-gradient-to-r from-orange-500 via-orange-400 to-purple-500 bg-clip-text text-transparent">
                  Гайд по интерфейсу
                </h1>
                <p className="text-muted-foreground text-lg md:text-xl max-w-2xl">
                  Полный путеводитель по сайту: от значков до продвинутых функций. 
                  Станьте уверенным пользователем за 5 минут.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* --- Sticky Navigation --- */}
        <nav className="sticky top-20 z-40 mb-12">
          <div className="bg-background/80 backdrop-blur-xl border border-border rounded-2xl p-2 overflow-x-auto">
            <div className="flex gap-1 min-w-max">
              {navItems.map((item) => {
                const Icon = item.icon
                return (
                  <button
                    key={item.id}
                    onClick={() => scrollToSection(item.id)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      activeSection === item.id
                        ? "bg-orange-500 text-white shadow-lg shadow-orange-500/25"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {item.label}
                  </button>
                )
              })}
            </div>
          </div>
        </nav>

        {/* --- SECTION 1: Basic Icons --- */}
        <section className="mb-16 scroll-mt-32" id="icons">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-2.5 bg-orange-500/10 rounded-xl">
              <BadgeCheck className="w-6 h-6 text-orange-500" />
            </div>
            <div>
              <h2 className="text-2xl md:text-3xl font-bold text-foreground">Основные обозначения</h2>
              <p className="text-muted-foreground text-sm">Базовые элементы, которые нужно знать</p>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              {
                icon: Monitor,
                title: "TV / WEB",
                subtitle: "Качество видео",
                description: "TV — эфирное телевидение (лучшее качество). WEB — онлайн-кинотеатры. Оранжевая метка TV означает онгоинг.",
                color: "orange"
              },
              {
                icon: Star,
                title: "Рейтинг",
                subtitle: "Оценка Shikimori",
                description: "Средняя оценка пользователей. 9.0+ — шедевр, 7.0-8.9 — хорошо, ниже 6.0 — слабо.",
                color: "yellow"
              },
              {
                icon: Clock,
                title: "Статус выхода",
                subtitle: "Онгоинг / Завершён",
                description: "Онгоинг — серии выходят еженедельно. Завершён — все серии доступны. Анонс — дата выхода известна.",
                color: "blue"
              },
              {
                icon: Volume2,
                title: "Озвучка",
                subtitle: "Субтитры vs Дубляж",
                description: "Субтитры — оригинальный голос с текстом. Озвучка — русский голос. Рекомендуем субтитры.",
                color: "green"
              },
              {
                icon: Zap,
                title: "Оранжевые акценты",
                subtitle: "Интерактивные элементы",
                description: "Оранжевый цвет обозначает активные элементы: кнопки, ссылки, важные метки.",
                color: "orange"
              },
              {
                icon: Shield,
                title: "18+ Контент",
                subtitle: "Возрастные ограничения",
                description: "Тайтлы с пометкой 18+ содержат контент для взрослых. Фильтруются в настройках.",
                color: "red"
              }
            ].map((item, index) => {
              const Icon = item.icon
              const colorClasses = {
                orange: "bg-orange-500/10 border-orange-500/20 text-orange-500",
                yellow: "bg-yellow-500/10 border-yellow-500/20 text-yellow-500",
                blue: "bg-blue-500/10 border-blue-500/20 text-blue-500",
                green: "bg-green-500/10 border-green-500/20 text-green-500",
                red: "bg-red-500/10 border-red-500/20 text-red-500",
                purple: "bg-purple-500/10 border-purple-500/20 text-purple-500"
              }
              
              return (
                <div
                  key={index}
                  className="group relative bg-secondary/50 hover:bg-secondary border border-border hover:border-orange-500/30 rounded-2xl p-6 transition-all duration-300 hover:shadow-lg hover:shadow-orange-500/10 hover:-translate-y-1"
                >
                  <div className={`inline-flex p-3 rounded-xl mb-4 ${colorClasses[item.color as keyof typeof colorClasses]}`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-bold text-foreground mb-1">{item.title}</h3>
                  <p className="text-xs text-muted-foreground mb-3">{item.subtitle}</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
                </div>
              )
            })}
          </div>
        </section>

        {/* --- SECTION 2: Card Anatomy --- */}
        <section className="mb-16 scroll-mt-32" id="cards">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-2.5 bg-orange-500/10 rounded-xl">
              <LayoutGrid className="w-6 h-6 text-orange-500" />
            </div>
            <div>
              <h2 className="text-2xl md:text-3xl font-bold text-foreground">Устройство карточки</h2>
              <p className="text-muted-foreground text-sm">Разбор каждого элемента карточки аниме</p>
            </div>
          </div>

          <div className="bg-gradient-to-br from-secondary to-secondary/50 border border-border rounded-3xl overflow-hidden">
            <div className="grid lg:grid-cols-2">
              {/* Interactive Demo */}
              <div className="p-8 md:p-12 bg-gradient-to-br from-background to-secondary/50 flex flex-col items-center justify-center border-b lg:border-b-0 lg:border-r border-border">
                <div className="text-muted-foreground text-xs font-mono mb-6 uppercase tracking-widest text-center">
                  Интерактивный пример
                </div>

                <div className="relative group cursor-pointer">
                  {/* Glow Effect */}
                  <div className="absolute -inset-1 bg-gradient-to-r from-orange-500 to-purple-500 rounded-lg blur opacity-20 group-hover:opacity-40 transition-opacity" />
                  
                  {/* Card */}
                  <div className="relative aspect-[2/3] w-56 rounded-lg overflow-hidden bg-secondary shadow-2xl">
                    <Image
                      src="https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&auto=format&fit=crop"
                      alt="Demo"
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-60" />

                    {/* Bookmark */}
                    <div className="absolute top-2 left-2 z-20">
                      <div className="bg-black/60 backdrop-blur-sm text-white border border-white/10 h-7 w-7 rounded-md flex items-center justify-center">
                        <Bookmark className="w-4 h-4" />
                      </div>
                    </div>

                    {/* Quality */}
                    <div className="absolute top-2 right-2 z-20 flex flex-col gap-1">
                      <span className="bg-orange-500 text-black text-[10px] font-bold px-1.5 py-0.5 rounded shadow-sm">TV</span>
                      <span className="bg-orange-500/80 text-black text-[10px] font-bold px-1.5 py-0.5 rounded shadow-sm animate-pulse">+2</span>
                    </div>

                    {/* Rating */}
                    <div className="absolute bottom-2 left-2 z-20">
                      <div className="flex items-center gap-1 bg-black/60 backdrop-blur-sm px-2 py-1 rounded-md">
                        <Star className="w-3 h-3 fill-yellow-500 text-yellow-500" />
                        <span className="font-bold text-white text-xs">8.9</span>
                      </div>
                    </div>
                  </div>

                  {/* Title */}
                  <div className="mt-3 w-56">
                    <h4 className="font-bold text-foreground text-sm line-clamp-2 group-hover:text-orange-500 transition-colors leading-tight">
                      Демонстрационное аниме
                    </h4>
                    <p className="text-muted-foreground text-xs mt-1">
                      2024 • 12 {getEpisodeText(12)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Explanations */}
              <div className="p-8 md:p-12">
                <div className="space-y-6">
                  {[
                    {
                      num: 1,
                      title: "Закладки",
                      desc: "Иконка книги слева сверху. Нажмите, чтобы сохранить тайтл в личный список.",
                      icon: Bookmark
                    },
                    {
                      num: 2,
                      title: "Качество",
                      desc: "Метка TV/WEB справа сверху. TV всегда предпочтительнее. Оранжевая = онгоинг.",
                      icon: Monitor
                    },
                    {
                      num: 3,
                      title: "Рейтинг",
                      desc: "Звезда с числом слева внизу. Показывает среднюю оценку сообщества.",
                      icon: Star
                    },
                    {
                      num: 4,
                      title: "Название",
                      desc: "Под картинкой. Подсвечивается оранжевым при наведении — можно кликать.",
                      icon: BookOpen
                    }
                  ].map((item) => {
                    const Icon = item.icon
                    return (
                      <div key={item.num} className="flex gap-4 group">
                        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-orange-500/10 text-orange-500 flex items-center justify-center font-bold border border-orange-500/20 group-hover:bg-orange-500 group-hover:text-white transition-all">
                          {item.num}
                        </div>
                        <div className="flex-1">
                          <h4 className="font-bold text-foreground group-hover:text-orange-500 transition-colors flex items-center gap-2">
                            <Icon className="w-4 h-4" />
                            {item.title}
                          </h4>
                          <p className="text-muted-foreground text-sm mt-1">{item.desc}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* --- SECTION 3: Player Page --- */}
        <section className="mb-16 scroll-mt-32" id="player">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-2.5 bg-orange-500/10 rounded-xl">
              <PlayCircle className="w-6 h-6 text-orange-500" />
            </div>
            <div>
              <h2 className="text-2xl md:text-3xl font-bold text-foreground">Страница просмотра</h2>
              <p className="text-muted-foreground text-sm">Всё о видеоплеере и управлении</p>
            </div>
          </div>

          {/* Player Mockup */}
          <div className="mb-8 rounded-2xl overflow-hidden border border-border bg-secondary/50">
            <div className="aspect-video bg-gradient-to-br from-zinc-900 to-black relative flex items-center justify-center">
              <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0iIzMzMyIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIiBvcGFjaXR5PSIwLjEiLz48L3N2Zz4=')] opacity-20" />
              
              {/* Play Button */}
              <div className="relative z-10 w-20 h-20 rounded-full bg-orange-500/90 flex items-center justify-center cursor-pointer hover:scale-110 transition-transform shadow-lg shadow-orange-500/30">
                <Play className="w-8 h-8 text-white ml-1" fill="currentColor" />
              </div>

              {/* Controls Bar */}
              <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-black/90 to-transparent flex items-end p-4">
                <div className="flex items-center gap-4 w-full">
                  <Play className="w-5 h-5 text-white cursor-pointer hover:text-orange-500" />
                  <Pause className="w-5 h-5 text-white cursor-pointer hover:text-orange-500" />
                  <div className="flex-1 h-1 bg-white/20 rounded-full overflow-hidden">
                    <div className="w-1/3 h-full bg-orange-500 rounded-full" />
                  </div>
                  <VolumeX className="w-5 h-5 text-white cursor-pointer hover:text-orange-500" />
                  <Settings className="w-5 h-5 text-white cursor-pointer hover:text-orange-500" />
                  <Maximize className="w-5 h-5 text-white cursor-pointer hover:text-orange-500" />
                </div>
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {[
              {
                icon: Volume2,
                title: "Озвучка и субтитры",
                desc: "В плеере есть вкладки для выбора перевода. Субтитры дают оригинальные эмоции, дубляж — комфорт.",
                tips: ["Нажмите на иконку звука", "Выберите студию озвучки"]
              },
              {
                icon: SkipForward,
                title: "Переключение серий",
                desc: "Под плеером находится список всех серий. Кликните на номер для переключения.",
                tips: ["Автопереход к следующей", "Горячие клавиши ← →"]
              },
              {
                icon: Download,
                title: "Скачать торрентом",
                desc: "Кнопка с иконкой диска открывает поиск на RuTracker и Rutor для скачивания.",
                tips: ["Весь сезон сразу", "Отдельные серии"]
              },
              {
                icon: Eye,
                title: "История просмотра",
                desc: "Сайт запоминает последнюю просмотренную серию. Продолжите с того же места.",
                tips: ["Автосохранение", "Синхронизация между устройствами"]
              }
            ].map((item, index) => {
              const Icon = item.icon
              return (
                <div
                  key={index}
                  className="bg-secondary/50 border border-border rounded-2xl p-6 hover:border-orange-500/30 transition-all"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-orange-500/10 rounded-lg">
                      <Icon className="w-5 h-5 text-orange-500" />
                    </div>
                    <h3 className="font-bold text-foreground">{item.title}</h3>
                  </div>
                  <p className="text-muted-foreground text-sm mb-4">{item.desc}</p>
                  <div className="space-y-2">
                    {item.tips.map((tip, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Check className="w-3 h-3 text-green-500" />
                        {tip}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* --- SECTION 4: Catalog --- */}
        <section className="mb-16 scroll-mt-32" id="catalog">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-2.5 bg-orange-500/10 rounded-xl">
              <Filter className="w-6 h-6 text-orange-500" />
            </div>
            <div>
              <h2 className="text-2xl md:text-3xl font-bold text-foreground">Каталог и фильтры</h2>
              <p className="text-muted-foreground text-sm">Мощные инструменты для поиска</p>
            </div>
          </div>

          <div className="grid lg:grid-cols-3 gap-6 mb-8">
            {[
              {
                icon: LayoutGrid,
                title: "Режимы просмотра",
                items: [
                  { name: "Comfortable", desc: "Большие карточки, 2 колонки" },
                  { name: "Compact", desc: "3 колонки, больше контента" },
                  { name: "Table", desc: "Горизонтальные карточки" }
                ]
              },
              {
                icon: TrendingUp,
                title: "Сортировка",
                items: [
                  { name: "Популярные", desc: "По количеству просмотров" },
                  { name: "Новинки", desc: "По дате выхода" },
                  { name: "Рейтинг", desc: "По оценке Shikimori" }
                ]
              },
              {
                icon: Filter,
                title: "Фильтры",
                items: [
                  { name: "Жанры", desc: "Выбор из 50+ жанров" },
                  { name: "Годы", desc: "От 1990 до 2026" },
                  { name: "Рейтинг", desc: "От 5★ до 9★" }
                ]
              }
            ].map((section, index) => {
              const Icon = section.icon
              return (
                <div
                  key={index}
                  className="bg-secondary/50 border border-border rounded-2xl p-6"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-orange-500/10 rounded-lg">
                      <Icon className="w-5 h-5 text-orange-500" />
                    </div>
                    <h3 className="font-bold text-foreground">{section.title}</h3>
                  </div>
                  <div className="space-y-3">
                    {section.items.map((item, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-orange-500 mt-2" />
                        <div>
                          <p className="text-sm font-medium text-foreground">{item.name}</p>
                          <p className="text-xs text-muted-foreground">{item.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Pro Tips */}
          <div className="bg-gradient-to-r from-orange-500/10 to-purple-500/10 border border-orange-500/20 rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <Zap className="w-5 h-5 text-orange-500" />
              <h3 className="font-bold text-foreground">Фишки каталога</h3>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { icon: RotateCcw, text: "Панель скрывается при скролле" },
                { icon: Smartphone, text: "Адаптивный дизайн" },
                { icon: Search, text: "Поиск на русском и английском" },
                { icon: CheckCircle2, text: "Автосохранение фильтров" }
              ].map((tip, i) => {
                const Icon = tip.icon
                return (
                  <div key={i} className="flex items-center gap-3 bg-background/50 rounded-xl p-3">
                    <div className="p-2 bg-orange-500/10 rounded-lg">
                      <Icon className="w-4 h-4 text-orange-500" />
                    </div>
                    <p className="text-sm text-muted-foreground">{tip.text}</p>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        {/* --- SECTION 5: Advanced Tips --- */}
        <section className="mb-16 scroll-mt-32" id="tips">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-2.5 bg-orange-500/10 rounded-xl">
              <Lightbulb className="w-6 h-6 text-orange-500" />
            </div>
            <div>
              <h2 className="text-2xl md:text-3xl font-bold text-foreground">Продвинутые советы</h2>
              <p className="text-muted-foreground text-sm">Секреты для опытных пользователей</p>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              {
                icon: ArrowLeft,
                title: "Умная кнопка «Назад»",
                desc: "Возвращает на предыдущую страницу, а если истории нет — в каталог."
              },
              {
                icon: Bookmark,
                title: "Цвет закладок",
                desc: "Сохранённый тайтл подсвечивается оранжевым. Кнопка меняет текст."
              },
              {
                icon: HardDrive,
                title: "Торренты",
                desc: "Кнопка «Скачать» ищет на RuTracker и Rutor целые сезоны."
              },
              {
                icon: PlayCircle,
                title: "Автоскролл",
                desc: "При выборе серии страница плавно прокручивается к плееру."
              },
              {
                icon: Clock,
                title: "История",
                desc: "Сайт запоминает последнюю серию для продолжения просмотра."
              },
              {
                icon: ExternalLink,
                title: "Новые вкладки",
                desc: "Внешние ссылки открываются отдельно, не прерывая просмотр."
              }
            ].map((tip, index) => {
              const Icon = tip.icon
              return (
                <div
                  key={index}
                  className="group bg-secondary/50 hover:bg-secondary border border-border hover:border-orange-500/30 rounded-2xl p-6 transition-all hover:shadow-lg hover:-translate-y-1"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-orange-500/10 rounded-lg group-hover:bg-orange-500 transition-colors">
                      <Icon className="w-5 h-5 text-orange-500 group-hover:text-white" />
                    </div>
                    <h3 className="font-bold text-foreground">{tip.title}</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">{tip.desc}</p>
                </div>
              )
            })}
          </div>
        </section>

        {/* --- SECTION 6: Glossary --- */}
        <section className="mb-16 scroll-mt-32" id="glossary">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-2.5 bg-orange-500/10 rounded-xl">
              <BookOpen className="w-6 h-6 text-orange-500" />
            </div>
            <div>
              <h2 className="text-2xl md:text-3xl font-bold text-foreground">Словарь терминов</h2>
              <p className="text-muted-foreground text-sm">Основные понятия аниме-индустрии</p>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { term: "Онгоинг", def: "Аниме, выходящее по сериям еженедельно" },
              { term: "Тайтл", def: "Отдельное произведение (сериал или фильм)" },
              { term: "Сезон", def: "Квартал выхода: Зима, Весна, Лето, Осень" },
              { term: "Фуллметл", def: "Сериал на 24-26 серий (полный сезон)" },
              { term: "OVA", def: "Аниме, выпущенное на дисках без TV-эфира" },
              { term: "ONA", def: "Аниме для интернет-платформ" },
              { term: "Сёнэн", def: "Аниме для мальчиков (боевики, приключения)" },
              { term: "Сёдзё", def: "Аниме для девочек (романтика, драма)" },
              { term: "Этти", def: "Контент с откровенными сценами (18+)" }
            ].map((item, index) => (
              <div
                key={index}
                className="bg-secondary/50 border border-border rounded-2xl p-5 hover:border-orange-500/30 transition-all"
              >
                <h3 className="text-orange-500 font-bold mb-2">{item.term}</h3>
                <p className="text-sm text-muted-foreground">{item.def}</p>
              </div>
            ))}
          </div>
        </section>

        {/* --- CTA Section --- */}
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-orange-500 to-purple-600 p-8 md:p-12 text-center">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS1vcGFjaXR5PSIwLjEiIHN0cm9rZS13aWR0aD0iMSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNncmlkKSIgb3BhY2l0eT0iMC4xIi8+PC9zdmc+')] opacity-30" />
          
          <div className="relative">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm mb-6">
              <CheckCircle2 className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-3xl md:text-4xl font-black text-white mb-4">
              Готовы к просмотру?
            </h2>
            <p className="text-white/80 text-lg mb-8 max-w-lg mx-auto">
              Теперь вы знаете всё необходимое. Самое время найти свой первый тайтл!
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/catalog"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white text-orange-600 font-bold rounded-xl transition-all hover:scale-105 shadow-lg"
              >
                Открыть каталог
                <ChevronRight className="w-5 h-5" />
              </Link>
              <Link
                href="/"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white/10 backdrop-blur-sm text-white font-bold rounded-xl transition-all hover:bg-white/20 border border-white/20"
              >
                На главную
              </Link>
            </div>
          </div>
        </section>

      </div>

      <ScrollToTop />
      <Footer />
    </main>
  )
}
