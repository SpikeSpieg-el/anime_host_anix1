"use client"

import { Bell, Play, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import Link from "next/link"

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
  if (updates.length === 0) return null

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60))
    
    if (diffInHours < 1) return "Только что"
    if (diffInHours < 24) return `${diffInHours} ч. назад`
    if (diffInHours < 48) return "Вчера"
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={`relative text-zinc-400 hover:text-white hover:bg-zinc-800 ${className}`}
        >
          <Bell className="w-5 h-5" />
          {updates.length > 0 && (
            <span className="absolute -top-1 -right-1 bg-orange-500 text-black text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
              {updates.length > 9 ? "9+" : updates.length}
            </span>
          )}
        </Button>
      </DialogTrigger>

      <DialogContent className="bg-zinc-900 border-zinc-800 max-w-md max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-white">
            Новые серии ({updates.length})
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-2 max-h-[60vh]">
          {updates.map((update) => (
            <Link
              key={update.animeId}
              href={`/watch/${update.animeId}`}
              className="block p-4 border-b border-zinc-800 last:border-b-0 hover:bg-zinc-800/50 transition-colors rounded-lg"
              onClick={() => {
                onClearUpdate?.(update.animeId)
              }}
            >
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-white text-sm break-words mb-1 hover:text-orange-500 transition-colors">
                    {update.animeTitle}
                  </h4>
                  <div className="flex items-center gap-2 text-xs text-zinc-400">
                    <Play className="w-3 h-3" />
                    <span>
                      Серия {update.oldEpisode + 1} - {update.newEpisode}
                      {update.totalEpisodes && ` из ${update.totalEpisodes}`}
                    </span>
                  </div>
                  <p className="text-[10px] text-zinc-500 mt-1">
                    {formatDate(update.updatedAt)}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>

        <div className="pt-4 border-t border-zinc-800">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearAll}
            className="w-full text-orange-500 hover:text-orange-400 hover:bg-orange-500/10"
          >
            <Check className="w-4 h-4 mr-2" />
            Отметить всё как прочитанное
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
