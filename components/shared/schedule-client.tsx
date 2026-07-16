"use client"

import { useState, useEffect, useMemo, useRef, useCallback } from "react"
import { Anime } from "@/lib/shikimori"
import { AnimeCard } from "@/components/shared/anime-card"
import { ScheduleSkeleton } from "@/components/shared/skeleton"
import { Calendar, Clock, AlertCircle, ArrowLeft, Filter, Bookmark, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { useBookmarks } from "@/components/providers/bookmarks-provider"
import { useCover } from "@/components/providers/cover-provider"

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

// Collect all anime from schedule for poster fetching
function getAllAnimeFromSchedule(schedule: { [key: number]: Anime[] }): Anime[] {
  return Object.values(schedule).flat()
}

export function ScheduleClient({ schedule: initialSchedule }: ScheduleClientProps) {
  const [mounted, setMounted] = useState(false)
  const [selectedOffset, setSelectedOffset] = useState<number>(0)
  const [showBookmarksOnly, setShowBookmarksOnly] = useState<boolean>(false)
  const [schedule, setSchedule] = useState(initialSchedule)
  const scrollRef = useRef<HTMLDivElement>(null)
  const { items: bookmarks } = useBookmarks()
  const { preloadBatch, getFromCache } = useCover()
  const loadedDaysRef = useRef<Set<number>>(new Set())
  const getFromCacheRef = useRef(getFromCache)
  useEffect(() => {
    getFromCacheRef.current = getFromCache
  }, [getFromCache])

  // Генерируем данные для дней: -6 дней от сегодня ... Сегодня ... +6 дней
  const rollingDays = useMemo(() => {
    const days = []
    const now = new Date()
    now.setHours(0, 0, 0, 0)

    const todayJsDay = now.getDay()
    const todayScheduleId = todayJsDay === 0 ? 6 : todayJsDay - 1

    for (let i = -6; i <= 6; i++) {
      const targetDate = new Date(now)
      targetDate.setDate(now.getDate() + i)
      
      const jsDay = targetDate.getDay() // 0-6 (Вс-Сб)
      const scheduleId = jsDay === 0 ? 6 : jsDay - 1 // 0-6 (Пн-Вс)

      const startOfCurrentWeek = new Date(now)
      startOfCurrentWeek.setDate(now.getDate() - todayScheduleId)
      
      const startOfTargetWeek = new Date(targetDate)
      startOfTargetWeek.setDate(targetDate.getDate() - scheduleId)
      
      const diffInMs = startOfTargetWeek.getTime() - startOfCurrentWeek.getTime()
      // Расчет смещения недель (0 = эта неделя, 1 = следующая, -1 = прошлая)
      const weekOffset = Math.round(diffInMs / (7 * 24 * 60 * 60 * 1000))

      days.push({
        offset: i,
        date: targetDate,
        scheduleId: scheduleId,
        dayName: DAY_NAMES[jsDay].name,
        dayShort: DAY_NAMES[jsDay].short,
        isToday: i === 0,
        weekOffset: weekOffset
      })
    }
    return days
  }, [])

  useEffect(() => {
    setMounted(true)
    setTimeout(() => {
      const todayElement = document.getElementById('day-offset-0')
      if (todayElement && scrollRef.current) {
        todayElement.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
      }
    }, 300)
  }, [])

  // Load better posters for the currently selected day and adjacent days
  // Strategy: Load current day + 2 days left + 2 days right progressively
  useEffect(() => {
    if (!mounted) return

    const loadPostersForDay = (dayId: number) => {
      // Skip if already loaded
      if (loadedDaysRef.current.has(dayId)) {
        console.log(`[ScheduleClient] Day ${dayId} already loaded, skipping`)
        return
      }

      const dayAnimes = initialSchedule[dayId]
      if (!dayAnimes || dayAnimes.length === 0) return

      console.log(`[ScheduleClient] Loading posters for day ${dayId} (${dayAnimes.length} anime)`)
      const startTime = Date.now()

      // Mark as loading to prevent duplicate requests
      loadedDaysRef.current.add(dayId)

      // Prepare batch request for current day only
      const posterRequests = dayAnimes.map(anime => ({
        id: anime.id,
        shikimoriUrl: anime.poster,
        romajiName: anime.originalTitle,
        russianName: anime.title
      }))

      // Use CoverProvider's preloadBatch - loads posters in background
      // Don't await - let it run in background without blocking UI
      preloadBatch(posterRequests).then(() => {
        const duration = Date.now() - startTime
        console.log(`[ScheduleClient] Preload batch for day ${dayId} completed in ${duration}ms`)
        
        // Update schedule with posters from cache (non-blocking)
        // Use setTimeout to defer state update and prevent UI blocking
        setTimeout(() => {
          setSchedule(prevSchedule => {
            const newSchedule = { ...prevSchedule }
            let updatedCount = 0
            
            newSchedule[dayId] = prevSchedule[dayId].map(anime => {
              const cached = getFromCacheRef.current(anime.id)
              // Don't overwrite good URLs with data URI fallbacks
              if (cached && cached.poster && cached.poster !== anime.poster && !cached.poster.startsWith('data:')) {
                updatedCount++
                return { ...anime, poster: cached.poster }
              }
              return anime
            })
            
            console.log(`[ScheduleClient] Updated ${updatedCount} posters for day ${dayId}`)
            return newSchedule
          })
        }, 0)
      }).catch(error => {
        console.error('[ScheduleClient] Error in preloadBatch:', error)
        // Remove from loaded set on error so it can be retried
        loadedDaysRef.current.delete(dayId)
      })
    }

    const currentDayInfo = rollingDays.find(d => d.offset === selectedOffset)
    if (currentDayInfo) {
      // Load current day immediately
      setTimeout(() => loadPostersForDay(currentDayInfo.scheduleId), 500)
      
      // Load 2 days to the left with delay
      for (let i = 1; i <= 2; i++) {
        const leftDay = rollingDays.find(d => d.offset === selectedOffset - i)
        if (leftDay) {
          setTimeout(() => loadPostersForDay(leftDay.scheduleId), 500 + i * 300)
        }
      }
      
      // Load 2 days to the right with delay
      for (let i = 1; i <= 2; i++) {
        const rightDay = rollingDays.find(d => d.offset === selectedOffset + i)
        if (rightDay) {
          setTimeout(() => loadPostersForDay(rightDay.scheduleId), 500 + i * 300)
        }
      }
    }
  }, [mounted, selectedOffset, rollingDays, preloadBatch, getFromCache])

  if (!mounted) return <ScheduleSkeleton />

  const currentDayInfo = rollingDays.find(d => d.offset === selectedOffset)!
  const activeAnimes = schedule[currentDayInfo.scheduleId] || []
  const sortedAnimes = [...activeAnimes].sort((a, b) => b.rating - a.rating)
  
  // Фильтр по закладкам
  const filteredAnimes = showBookmarksOnly 
    ? sortedAnimes.filter(anime => bookmarks.some(bookmark => bookmark.id === anime.id))
    : sortedAnimes

  return (
    <div className="space-y-8">
      {/* Навигация сверху */}
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
            График выхода серий: от прошлых к будущим
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Фильтр по закладкам */}
          <button
            onClick={() => setShowBookmarksOnly(!showBookmarksOnly)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-medium transition-all",
              showBookmarksOnly
                ? "bg-primary border-primary text-primary-foreground shadow-lg shadow-primary/20"
                : "bg-card border-border text-muted-foreground hover:bg-card/80 hover:text-foreground"
            )}
          >
            <Bookmark className="w-4 h-4" />
            {showBookmarksOnly ? 'Всё' : 'Только в закладках'}
          </button>
          

        </div>
      </div>

      {/* Горизонтальная лента дней */}
      <div className="sticky top-16 z-30 bg-background/95 backdrop-blur-sm pb-4 pt-2">
        <div 
          ref={scrollRef}
          className="flex gap-2 overflow-x-auto pb-3 pt-3 no-scrollbar px-1"
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
                    "absolute -top-2 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider",
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
        {filteredAnimes.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-x-4 gap-y-6 sm:gap-y-8">
            {filteredAnimes.map((anime, index) => {
              // ИСПРАВЛЕНИЕ:
              // Теперь номер серии зависит только от смещения недели относительно текущей даты.
              // Текущая неделя (0) = episodesCurrent
              // Следующая неделя (+1) = episodesCurrent + 1
              // Прошлая неделя (-1) = episodesCurrent - 1
              const displayEpisode = anime.episodesCurrent + currentDayInfo.weekOffset
              const isPriority = index < 6 // Priority for first 6 images (above the fold)
              
              return (
                <div key={anime.id} className="relative group">
                  <AnimeCard anime={anime} showPreviousEpisode={true} priority={isPriority} />
                  
                  <div className="absolute top-2 right-[7px] z-20">
                    <div className={cn(
                      "text-[10px] font-bold px-2 py-1 rounded shadow-md border backdrop-blur-sm transition-colors",
                      currentDayInfo.offset < 0 
                        ? "bg-secondary/90 text-secondary-foreground border-border" 
                        : "bg-primary/90 text-primary-foreground border-primary/20"
                    )}>
                      {currentDayInfo.offset < 0 ? 'Была' : 'Будет'} {displayEpisode} серия
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-border rounded-2xl bg-card/30">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
               {showBookmarksOnly ? <Bookmark className="w-8 h-8 text-muted-foreground" /> : <AlertCircle className="w-8 h-8 text-muted-foreground" />}
            </div>
            <h3 className="text-xl font-bold text-foreground">
              {showBookmarksOnly ? 'Нет закладок' : 'Нет данных'}
            </h3>
            <p className="text-muted-foreground mt-2 max-w-sm px-4">
              {showBookmarksOnly 
                ? `На ${currentDayInfo.date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })} нет аниме в закладках.`
                : `На ${currentDayInfo.date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })} выпусков не запланировано.`
              }
            </p>
          </div>
        )}
      </div>
    </div>
  )
}