"use client"

import { useState } from 'react'
import { Home, Search, Compass, BookMarked, History, Calendar, User, Monitor } from 'lucide-react'
import { useDpadNavigation } from '@/hooks/use-dpad-navigation'

interface TVNavigationProps {
  currentPath?: string
  onNavigate: (path: string) => void
  onExitTVMode: () => void
}

const navItems = [
  { icon: Home, label: 'Главная', path: '/' },
  { icon: Compass, label: 'Каталог', path: '/catalog' },
  { icon: Search, label: 'Поиск', path: '/search' },
  { icon: BookMarked, label: 'Закладки', path: '/bookmarks' },
  { icon: History, label: 'История', path: '/history' },
  { icon: Calendar, label: 'Расписание', path: '/schedule' },
  { icon: User, label: 'Настройки', path: '/settings' },
]

export function TVNavigation({ currentPath = '/', onNavigate, onExitTVMode }: TVNavigationProps) {
  const [focusedIndex, setFocusedIndex] = useState(0)

  return (
    <nav className="fixed left-0 top-0 bottom-0 w-24 bg-background/95 backdrop-blur-sm border-r flex flex-col items-center py-8 gap-4 z-50">
      {navItems.map((item, index) => {
        const Icon = item.icon
        const isActive = currentPath === item.path
        const isFocused = focusedIndex === index

        return (
          <button
            key={item.path}
            onClick={() => onNavigate(item.path)}
            onFocus={() => setFocusedIndex(index)}
            className={`
              group flex flex-col items-center gap-2 p-3 rounded-lg transition-all duration-200
              ${isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}
              ${isFocused ? 'ring-4 ring-primary scale-110' : 'scale-100'}
              focus:outline-none
            `}
          >
            <Icon className="h-6 w-6" />
            <span className="text-xs font-medium">{item.label}</span>
          </button>
        )
      })}
      
      <div className="flex-1" />
      
      <button
        onClick={onExitTVMode}
        onFocus={() => setFocusedIndex(navItems.length)}
        className={`
          group flex flex-col items-center gap-2 p-3 rounded-lg transition-all duration-200
          text-orange-500 hover:text-orange-600 hover:bg-orange-500/10
          ${focusedIndex === navItems.length ? 'ring-4 ring-orange-500 scale-110' : 'scale-100'}
          focus:outline-none
        `}
      >
        <Monitor className="h-6 w-6" />
        <span className="text-xs font-medium">Выйти</span>
      </button>
    </nav>
  )
}
