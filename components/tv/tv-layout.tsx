"use client"

import { ReactNode } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { TVNavigation } from './tv-navigation'
import { useDpadNavigation } from '@/hooks/use-dpad-navigation'
import { useTVMode } from '@/hooks/use-tv-mode'

interface TVLayoutProps {
  children: ReactNode
}

export function TVLayout({ children }: TVLayoutProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { toggleTVMode } = useTVMode()
  
  useDpadNavigation({ enabled: true })

  const handleNavigate = (path: string) => {
    router.push(path)
  }

  const handleExitTVMode = () => {
    toggleTVMode(false)
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-background">
      <TVNavigation 
        currentPath={pathname} 
        onNavigate={handleNavigate}
        onExitTVMode={handleExitTVMode}
      />
      
      <main className="ml-24 p-8">
        {children}
      </main>
    </div>
  )
}
