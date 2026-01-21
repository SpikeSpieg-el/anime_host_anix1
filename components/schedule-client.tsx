"use client"

import { useState, useEffect } from "react"
import { Anime } from "@/lib/shikimori"
import { AnimeCard } from "@/components/anime-card"
import { Calendar, Clock, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

interface ScheduleClientProps {
  schedule: { [key: number]: Anime[] }
}

const DAYS = [
  { id: 0, name: 'Понедельник', short: 'Пн' },
  { id: 1, name: 'Вторник', short: 'Вт' },
  { id: 2, name: 'Среда', short: 'Ср' },
  { id: 3, name: 'Четверг', short: 'Чт' },
  { id: 4, name: 'Пятница', short: 'Пт' },
  { id: 5, name: 'Суббота', short: 'Сб' },
  { id: 6, name: 'Воскресенье', short: 'Вс' },
]

export function ScheduleClient({ schedule }: ScheduleClientProps) {
  // Определяем текущий день недели (0 = Пн, ..., 6 = Вс)
  const [currentDay, setCurrentDay] = useState<number>(0)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    // JS getDay(): 0 = Вс, 1 = Пн. Конвертируем в наш формат (0 = Пн)
    const today = new Date().getDay()
    const mappedDay = today === 0 ? 6 : today - 1
    setCurrentDay(mappedDay)
    setMounted(true)
  }, [])

  const activeAnimes = schedule[currentDay] || []

  const sortedAnimes = [...activeAnimes].sort((a, b) => b.rating - a.rating)

  if (!mounted) return null // Чтобы избежать гидратации server/client mismatch по дате

  return (
    <div className="space-y-8">
      {/* Кнопка "На главную" */}
      <div className="flex justify-start">
        <Link href="/" className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-orange-500 text-zinc-400 hover:text-white font-medium rounded-xl transition-all">
          <ArrowLeft className="w-4 h-4" />
          На главную
        </Link>
      </div>

      {/* Заголовок и текущая дата */}
      <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-black text-white flex items-center gap-3">
            <Calendar className="w-8 h-8 md:w-10 md:h-10 text-orange-500" />
            Расписание
          </h1>
          <p className="text-zinc-500 mt-2 text-sm md:text-base">
            График выхода новых серий онгоингов
          </p>
        </div>
        
        <div className="flex items-center gap-2 text-sm font-medium px-4 py-2 bg-zinc-900 rounded-full border border-zinc-800 text-zinc-400">
           <Clock className="w-4 h-4 text-orange-500" />
           <span>Сегодня: {DAYS[currentDay].name}</span>
        </div>
      </div>

      {/* Навигация по дням (Табы) */}
      <div className="sticky top-16 z-30 bg-zinc-950/95 backdrop-blur-sm pb-4 pt-2 overflow-x-auto">
        <div className="flex md:grid md:grid-cols-7 gap-2 min-w-max md:min-w-0 md:px-0">
          {DAYS.map((day) => {
            const isActive = currentDay === day.id
            const count = schedule[day.id]?.length || 0
            
            return (
              <button
                key={day.id}
                onClick={() => setCurrentDay(day.id)}
                className={cn(
                  "flex flex-col items-center justify-center py-3 px-4 md:px-2 rounded-xl transition-all min-w-[80px] md:min-w-0 border",
                  isActive 
                    ? "bg-orange-600 border-orange-500 text-white shadow-lg shadow-orange-900/20" 
                    : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800 hover:text-white"
                )}
              >
                <span className={cn("text-sm font-bold", isActive ? "opacity-100" : "opacity-70")}>
                  {day.short}
                </span>
                <span className="text-[10px] mt-1 opacity-60 font-medium uppercase tracking-wider hidden md:block">
                  {day.name}
                </span>
                {count > 0 && (
                  <span className={cn(
                    "mt-1 text-[10px] px-1.5 py-0.5 rounded-full",
                    isActive ? "bg-white/20 text-white" : "bg-zinc-800 text-zinc-500"
                  )}>
                    {count}
                  </span>
                )}
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
                {/* Оверлей с номером серии, специфичный для расписания */}
                <AnimeCard anime={anime} />
                <div className="absolute top-2 left-2 z-10">
                   <div className="bg-orange-600 text-white text-[10px] font-bold px-2 py-1 rounded shadow-md border border-orange-500">
                     EP {anime.episodesCurrent}
                   </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-zinc-800 rounded-2xl bg-zinc-900/30">
            <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center mb-4">
               <AlertCircle className="w-8 h-8 text-zinc-600" />
            </div>
            <h3 className="text-xl font-bold text-zinc-300">Нет релизов</h3>
            <p className="text-zinc-500 mt-2 max-w-sm">
              В этот день недели пока не запланировано выхода новых серий или данные обновляются.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}