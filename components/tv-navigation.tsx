"use client"

import { useState } from 'react'
import { Home, Search, Sparkles, User, Settings } from 'lucide-react'
import { useDpadNavigation } from '@/hooks/use-dpad-navigation'

interface TVNavigationProps {
  currentPath?: string
  onNavigate: (path: string) => void
}

const navItems = [
  { icon: Home, label: 'Главная', path: '/' },
  { icon: Search, label: 'Поиск', path: '/search' },
  { icon: Sparkles, label: 'Гача', path: '/gacha' },
  { icon: User, label: 'Профиль', path: '/profile' },
  { icon: Settings, label: 'Настройки', path: '/settings' },
]

export function TVNavigation({ currentPath = '/', onNavigate }: TVNavigationProps) {
  const [focusedIndex, setFocusedIndex] = useState(0)

  return (
    <nav className="fixed left-0 top-0 bottom-0 w-24 bg-background/95 backdrop-blur-sm border-r flex flex-col items-center py-8 gap-6 z-50">
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
    </nav>
  )
}
