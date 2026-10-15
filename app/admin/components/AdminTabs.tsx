"use client"

import { useEffect, useRef } from "react"
import type { AdminTab } from "./types"

interface AdminTabsProps {
  activeTab: AdminTab
  onTabChange: (tab: AdminTab) => void
}

const TABS: { id: AdminTab; label: string }[] = [
  { id: "users", label: "Пользователи" },
  { id: "pvp", label: "PvP" },
  { id: "ai_battle", label: "AI Battle" },
  { id: "battle_logs", label: "Battle Logs" },
  { id: "cards", label: "Карты" },
  { id: "mail", label: "Рассылка" },
  { id: "events", label: "События" },
  { id: "news", label: "Новости" },
  { id: 'editorial', label: 'Редакция' },
  { id: "tutorial", label: "Туториал" },
  { id: "analytics", label: "Аналитика" },
  { id: "blacklist", label: "Чёрный список" },
]

export function AdminTabs({ activeTab, onTabChange }: AdminTabsProps) {
  const tabRefs = useRef<Partial<Record<AdminTab, HTMLButtonElement | null>>>({})

  // На 360px в ленте видно ~4 вкладки из 12. Раньше при переключении
  // лента оставалась на месте, и активная вкладка уезжала за край — не
  // было видно, какая вкладка открыта. Подкручиваем её в центр.
  useEffect(() => {
    tabRefs.current[activeTab]?.scrollIntoView({
      inline: "center",
      block: "nearest",
      behavior: "smooth",
    })
  }, [activeTab])

  return (
    // scrollbar-thin в Tailwind не существует: класс ничего не делал, а
    // глобальные стили рисуют 8px скроллбар поверх ленты. Скрываем его
    // явно и добавляем snap, чтобы вкладки не останавливались между.
    <div
      role="tablist"
      aria-label="Разделы админ-панели"
      className="flex gap-2 overflow-x-auto overscroll-x-contain snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden pb-1 -mx-1 px-1"
    >
      {TABS.map((tab) => (
        <button
          key={tab.id}
          ref={(element) => { tabRefs.current[tab.id] = element }}
          role="tab"
          aria-selected={activeTab === tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`shrink-0 snap-start min-h-11 text-xs sm:text-sm px-3 sm:px-4 py-2 rounded-lg transition whitespace-nowrap ${activeTab === tab.id ? 'bg-primary text-primary-foreground font-semibold' : 'text-muted-foreground hover:bg-muted'}`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}