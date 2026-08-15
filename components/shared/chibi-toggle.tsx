'use client'

import { useState, useEffect } from 'react'
import { Bot, BotOff } from 'lucide-react'
import { CHIBI_STORAGE_KEY, CHIBI_TOGGLE_EVENT } from '@/components/shared/chibi-guide'

export function ChibiToggle() {
  const [isEnabled, setIsEnabled] = useState(true)

  useEffect(() => {
    const saved = localStorage.getItem(CHIBI_STORAGE_KEY)
    if (saved !== null) {
      setIsEnabled(saved === 'true')
    }
  }, [])

  const toggle = () => {
    const next = !isEnabled
    setIsEnabled(next)
    localStorage.setItem(CHIBI_STORAGE_KEY, String(next))
    window.dispatchEvent(
      new CustomEvent(CHIBI_TOGGLE_EVENT, { detail: { enabled: next } })
    )
  }

  return (
    <button
      onClick={toggle}
      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-border bg-secondary/60 hover:bg-secondary text-xs font-medium transition-all dark:bg-zinc-900 dark:border-zinc-800 dark:hover:bg-zinc-800 w-full justify-between"
      title={isEnabled ? "Отключить маскота-помощника" : "Включить маскота-помощника"}
    >
      <span className="flex items-center gap-2">
        {isEnabled ? (
          <Bot className="w-3.5 h-3.5 text-primary" />
        ) : (
          <BotOff className="w-3.5 h-3.5 text-muted-foreground" />
        )}
        <span className="text-foreground dark:text-zinc-200">Маскот-гид</span>
      </span>
      <span className="text-[10px] text-muted-foreground">
        {isEnabled ? "Вкл" : "Выкл"}
      </span>
    </button>
  )
}
