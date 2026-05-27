"use client"

import { useState } from "react"
import { Bell, Play, Check, ChevronRight, Clock, Sparkles, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import Link from "next/link"
import { cn } from "@/lib/utils"

interface EpisodeUpdate {
  animeId: string
  animeTitle: string
  oldEpisode: number
  newEpisode: number
  totalEpisodes?: number
  updatedAt: string
}

interface EpisodeUpdateBadgeProps {
  updates: EpisodeUpdate[]
  onClearUpdate?: (animeId: string) => void
  onClearAll?: () => void
  className?: string
}

export function EpisodeUpdateBadge({ updates, onClearUpdate, onClearAll, className }: EpisodeUpdateBadgeProps) {
  const [isOpen, setIsOpen] = useState(false)

  const combinedClassName = cn("ml-2", className)

  if (updates.length === 0) {
    // Пустой колокольчик с диалогом "нет уведомлений"
    return (
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn("text-muted-foreground hover:text-foreground hover:bg-accent active:scale-95 transition-all", combinedClassName)}
          >
            <Bell className="w-5 h-5" />
          </Button>
        </DialogTrigger>

        <DialogContent 
          className="bg-background/95 backdrop-blur-xl border w-[95vw] sm:w-full sm:max-w-md p-0 gap-0 overflow-hidden shadow-2xl rounded-2xl flex flex-col max-h-[85vh]" 
          showCloseButton={false}
        >
          <DialogDescription className="sr-only">
            Нет новых уведомлений о новых сериях аниме
          </DialogDescription>
          
          {/* Хедер */}
          <div className="flex items-center justify-between px-4 py-4 border-b bg-muted/50">
            <div className="flex items-center gap-2.5">
              <Bell className="w-5 h-5 text-muted-foreground" />
              <DialogTitle className="text-base font-bold tracking-tight">
                Уведомления
              </DialogTitle>
            </div>
            <Button 
              variant="ghost" 
              size="icon-sm" 
              className="h-8 w-8 text-muted-foreground hover:text-foreground rounded-full hover:bg-accent"
              onClick={() => setIsOpen(false)}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Контент: нет уведомлений */}
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <div className="w-32 h-32 rounded-full bg-muted/50 border flex items-center justify-center mb-4">
              <img src="/No notifications.png" alt="No notifications" className="w-40 h-32 opacity-69" />
            </div>
            <p className="text-muted-foreground text-center font-medium mb-2">Нет новых уведомлений</p>
            <p className="text-muted-foreground/70 text-center text-sm">Здесь появятся уведомления о новых сериях ваших аниме</p>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))
    
    if (diffInMinutes < 60) return `${diffInMinutes} мин. назад`
    const diffInHours = Math.floor(diffInMinutes / 60)
    if (diffInHours < 24) return `${diffInHours} ч. назад`
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn("relative text-foreground hover:text-foreground hover:bg-accent active:scale-95 transition-all", combinedClassName)}
        >
          <Bell className="w-6 h-6" />
          {/* Пульсирующий индикатор */}
          <span className="absolute top-2 right-2 flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-orange-500 border border-black"></span>
          </span>
        </Button>
      </DialogTrigger>

      <DialogContent 
        className="bg-background/95 backdrop-blur-xl border w-[95vw] sm:w-full sm:max-w-md p-0 gap-0 overflow-hidden shadow-2xl rounded-2xl flex flex-col max-h-[85vh]" 
        showCloseButton={false}
      >
        <DialogDescription className="sr-only">
          Список новых серий доступных для просмотра
        </DialogDescription>
        
        {/* Хедер */}
        <div className="flex items-center justify-between px-4 py-4 border-b bg-muted/50">
          <div className="flex items-center gap-2.5">
            <div className="relative">
               <Bell className="w-5 h-5 text-primary" />
               <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-[9px] font-bold h-3.5 min-w-[14px] px-0.5 rounded-full flex items-center justify-center">
                 {updates.length}
               </span>
            </div>
            <DialogTitle className="text-base font-bold tracking-tight">
              Новые серии
            </DialogTitle>
          </div>
          <Button 
            variant="ghost" 
            size="icon-sm" 
            className="h-8 w-8 text-muted-foreground hover:text-foreground rounded-full hover:bg-accent"
            onClick={() => setIsOpen(false)}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Список (с кастомным скроллом) */}
        <div className="max-h-[60vh] overflow-y-auto custom-scrollbar p-2 space-y-2">
          {updates.map((update, idx) => (
            <Link
              key={update.animeId}
              href={`/watch/${update.animeId}`}
              onClick={() => {
                onClearUpdate?.(update.animeId)
                setIsOpen(false)
              }}
              className="group relative flex items-center gap-3 p-3 rounded-xl bg-muted/40 border hover:bg-accent hover:border-accent-foreground/20 active:scale-[0.98] transition-all animate-in fade-in slide-in-from-bottom-2 duration-300 fill-mode-backwards"
              style={{ animationDelay: `${idx * 50}ms` }}
            >
              {/* Левая часть: Номер серии (вместо постера) */}
              <div className="shrink-0 relative w-12 h-12 sm:w-14 sm:h-14 rounded-lg overflow-hidden flex items-center justify-center bg-gradient-to-br from-muted to-background border group-hover:border-primary/30 transition-colors">
                 <div className="absolute inset-0 bg-primary/10 group-hover:bg-primary/20 transition-colors" />
                 <div className="flex flex-col items-center">
                    <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Серия</span>
                    <span className="text-lg sm:text-xl font-black text-primary leading-none">
                        {update.newEpisode}
                    </span>
                 </div>
              </div>

              {/* Центр: Информация */}
              <div className="flex-1 min-w-0 flex flex-col justify-center">
                <h4 className="font-bold text-sm sm:text-[15px] pr-4 group-hover:text-primary transition-colors">
                  {update.animeTitle}
                </h4>
                
                <div className="flex items-center gap-2 mt-1">
                   {/* Прогресс */}
                   <span className="inline-flex items-center text-[10px] sm:text-xs font-medium text-muted-foreground bg-background/50 px-1.5 py-0.5 rounded border">
                      <Sparkles className="w-2.5 h-2.5 mr-1 text-primary" />
                      {update.oldEpisode} <ChevronRight className="w-2.5 h-2.5 mx-0.5 opacity-50"/> {update.newEpisode}
                   </span>
                   
                   {/* Время */}
                   <span className="flex items-center text-[10px] text-muted-foreground">
                      <Clock className="w-2.5 h-2.5 mr-1" />
                      {formatTimeAgo(update.updatedAt)}
                   </span>
                </div>
              </div>

              {/* Правая часть: Play Button */}
              <div className="shrink-0 pr-1">
                 <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground group-hover:bg-primary group-hover:text-primary-foreground transition-all shadow-lg group-hover:shadow-primary/25">
                    <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                 </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Футер */}
        <div className="p-3 border-t bg-muted/50 backdrop-blur-sm">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
                onClearAll?.()
                setIsOpen(false)
            }}
            className="w-full text-muted-foreground hover:text-foreground hover:bg-accent h-10 rounded-xl transition-all font-medium text-xs sm:text-sm"
          >
            <Check className="w-4 h-4 mr-2" />
            Отметить всё как прочитанное
          </Button>
        </div>

      </DialogContent>
    </Dialog>
  )
}