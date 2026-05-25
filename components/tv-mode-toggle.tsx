"use client"

import { Tv, Monitor } from 'lucide-react'
import { useTVMode } from '@/hooks/use-tv-mode'
import { Button } from './ui/button'

export function TVModeToggle() {
  const { isTVMode, toggleTVMode } = useTVMode()

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => toggleTVMode(!isTVMode)}
      className="relative"
      title={isTVMode ? "Переключить на обычный режим" : "Переключить на TV режим"}
    >
      {isTVMode ? (
        <Tv className="h-5 w-5" />
      ) : (
        <Monitor className="h-5 w-5" />
      )}
    </Button>
  )
}
