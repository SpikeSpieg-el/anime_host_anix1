"use client"

import type { AdminTab } from "./types"

interface AdminTabsProps {
  activeTab: AdminTab
  onTabChange: (tab: AdminTab) => void
}

const TABS: { id: AdminTab; label: string }[] = [
  { id: "users", label: "Users" },
  { id: "pvp", label: "PvP" },
  { id: "ai_battle", label: "AI Battle" },
  { id: "battle_logs", label: "Battle Logs" },
  { id: "cards", label: "Карты" },
  { id: "mail", label: "Рассылка" },
  { id: "events", label: "События" },
  { id: "news", label: "Новости" },
  { id: "tutorial", label: "Туториал" },
]

export function AdminTabs({ activeTab, onTabChange }: AdminTabsProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-thin">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`text-xs sm:text-sm px-3 sm:px-4 py-2 rounded-lg transition whitespace-nowrap ${activeTab === tab.id ? 'bg-primary text-primary-foreground font-semibold' : 'text-muted-foreground hover:bg-muted'}`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
