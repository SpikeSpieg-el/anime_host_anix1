"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import { Anime } from "@/lib/shikimori"
import { AnimeCard } from "@/components/anime-card"
import { Calendar, Clock, AlertCircle, ArrowLeft } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import Link from "next/link"

interface ScheduleClientProps {
  schedule: { [key: number]: Anime[] }
}

const DAY_NAMES = [
  { name: 'Воскресенье', short: 'Вс' },
  { name: 'Понедельник', short: 'Пн' },
  { name: 'Вторник', short: 'Вт' },
  { name: 'Среда', short: 'Ср' },
  { name: 'Четверг', short: 'Чт' },
  { name: 'Пятница', short: 'Пт' },
  { name: 'Суббота', short: 'Сб' },
]

export function ScheduleClient({ schedule }: ScheduleClientProps) {
  const [mounted, setMounted] = useState(false)
  // Храним смещение относительно сегодняшнего дня (0 = сегодня)
  const [selectedOffset, setSelectedOffset] = useState<number>(0)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Генерируем массив из 13 дней (-6 ... 0 ... +6)
  const rollingDays = useMemo(() => {
    const days = []
    for (let i = -6; i <= 6; i++) {
      const date = new Date()
      date.setDate(date.getDate() + i)
      
      // Конвертируем JS день (0=Вс) в формат пропсов (0=Пн...6=Вс)
      const jsDay = date.getDay()
      const scheduleId = jsDay === 0 ? 6 : jsDay - 1
      
      days.push({
        offset: i,
        date: date,
        scheduleId: scheduleId,
        dayName: DAY_NAMES[jsDay].name,
        dayShort: DAY_NAMES[jsDay].short,
        isToday: i === 0
      })
    }
    return days
  }, [])

  useEffect(() => {
    setMounted(true)
    // Авто-скролл к текущему дню (центр) после загрузки
    setTimeout(() => {
      const todayElement = document.getElementById('day-offset-0')
      if (todayElement) {
        todayElement.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
      }
    }, 100)
  }, [])

  if (!mounted) {
    return (
      <div className="space-y-8">
        {/* Кнопка "На главную" */}
        <div className="flex justify-start">
          <Link href="/" className="inline-flex items-center gap-2 px-4 py-2 bg-card hover:bg-card/80 border border-border hover:border-primary text-muted-foreground hover:text-foreground font-medium rounded-xl transition-all">
            <ArrowLeft className="w-4 h-4" />
            На главную
          </Link>
        </div>

        {/* Заголовок */}
        <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <Skeleton className="w-8 h-8 md:w-10 md:h-10" />
              <Skeleton className="h-8 w-32 md:h-10 md:w-40" />
            </div>
            <Skeleton className="h-4 w-64 mt-2" />
          </div>
          
          <Skeleton className="h-8 w-48" />
        </div>

        {/* Навигация по дням (Rolling Tabs) */}
        <div className="sticky top-16 z-30 bg-background/95 backdrop-blur-sm pb-4 pt-2">
          <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
            {Array.from({ length: 13 }, (_, i) => (
              <Skeleton key={i} className="min-w-[85px] h-16 rounded-xl" />
            ))}
          </div>
        </div>

        {/* Сетка аниме */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-x-4 gap-y-6 sm:gap-y-8">
          {Array.from({ length: 12 }, (_, i) => (
            <div key={i} className="relative">
              <Skeleton className="w-full aspect-[3/4] rounded-lg" />
              <Skeleton className="absolute top-2 right-2 h-5 w-16 rounded" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  const currentDayInfo = rollingDays.find(d => d.offset === selectedOffset)!
  const activeAnimes = schedule[currentDayInfo.scheduleId] || []
  const sortedAnimes = [...activeAnimes].sort((a, b) => b.rating - a.rating)

  return (
    <div className="space-y-8">
      {/* Кнопка "На главную" */}
      <div className="flex justify-start">
        <Link href="/" className="inline-flex items-center gap-2 px-4 py-2 bg-card hover:bg-card/80 border border-border hover:border-primary text-muted-foreground hover:text-foreground font-medium rounded-xl transition-all">
          <ArrowLeft className="w-4 h-4" />
          На главную
        </Link>
      </div>

      {/* Заголовок */}
      <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-black text-foreground flex items-center gap-3">
            <Calendar className="w-8 h-8 md:w-10 md:h-10 text-orange-500" />
            Расписание
          </h1>
          <p className="text-muted-foreground mt-2 text-sm md:text-base">
            График выхода новых серий (по местному времени)
          </p>
        </div>
        
        <div className="flex items-center gap-2 text-sm font-medium px-4 py-2 bg-card rounded-full border border-border text-muted-foreground">
           <Clock className="w-4 h-4 text-orange-500" />
           <span>Выбрано: {currentDayInfo.dayName}, {currentDayInfo.date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}</span>
        </div>
      </div>

      {/* Навигация по дням (Rolling Tabs) */}
      <div className="sticky top-16 z-30 bg-background/95 backdrop-blur-sm pb-4 pt-4">
        <div 
          ref={scrollRef}
          className="flex gap-2 overflow-x-auto pb-2 no-scrollbar mask-fade-edges"
          style={{ scrollSnapType: 'x mandatory' }}
        >
          {rollingDays.map((day) => {
            const isActive = selectedOffset === day.offset
            
            return (
              <button
                key={day.offset}
                id={`day-offset-${day.offset}`}
                onClick={() => setSelectedOffset(day.offset)}
                className={cn(
                  "flex flex-col items-center justify-center py-3 px-5 rounded-xl transition-all min-w-[85px] border relative",
                  isActive 
                    ? "bg-primary border-primary text-primary-foreground shadow-lg shadow-primary/20 scale-105 z-10" 
                    : "bg-card border-border text-muted-foreground hover:bg-card/80 hover:text-foreground",
                  day.isToday && !isActive && "border-orange-500/50"
                )}
                style={{ scrollSnapAlign: 'center' }}
              >
                {day.isToday && (
                  <span className={cn(
                    "absolute -top-1 px-1.5 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-tighter",
                    isActive ? "bg-white text-primary" : "bg-orange-500 text-white"
                  )}>
                    Сегодня
                  </span>
                )}
                <span className={cn("text-sm font-bold", isActive ? "opacity-100" : "opacity-70")}>
                  {day.dayShort}
                </span>
                <span className={cn(
                  "mt-1 text-[11px] font-medium",
                  isActive ? "text-primary-foreground/90" : "text-muted-foreground"
                )}>
                  {day.date.getDate()}.{day.date.getMonth() + 1 < 10 ? '0' : ''}{day.date.getMonth() + 1}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Сетка аниме */}
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
        {sortedAnimes.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-x-4 gap-y-6 sm:gap-y-8">
            {sortedAnimes.map((anime) => (
              <div key={anime.id} className="relative group">
                <AnimeCard anime={anime} showPreviousEpisode={true} />
                
                <div className="absolute top-2 right-[7px] z-20">
                  <div className="bg-primary/90 backdrop-blur-sm text-primary-foreground text-[10px] font-bold px-2 py-1 rounded shadow-md border border-primary/20">
                    {selectedOffset < 0 ? 'Вышла' : 'Выйдет'} {anime.episodesCurrent} серия
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-border rounded-2xl bg-card/30">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
               <AlertCircle className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-bold text-foreground">Релизов не найдено</h3>
            <p className="text-muted-foreground mt-2 max-w-sm px-4">
              На этот день ({currentDayInfo.dayName}) в базе данных пока нет информации о выходе новых серий.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}