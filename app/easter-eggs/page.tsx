"use client"

import { useState, useEffect } from "react"
import { Navbar } from "@/components/layout/navbar"
import { easterEggs, type EasterEgg } from "@/lib/easter-eggs"
import { Sparkles, Skull, Moon, Music, BookOpen, ClipboardList, Zap, Heart, Terminal, AlertTriangle, ExternalLink, CloudRain, Ghost, Bug, Wand2, Flame } from "lucide-react"
import { FloatingNav } from "@/components/layout/floating-nav"
import { toast } from "sonner"

const commandIcons: Record<string, React.ElementType> = {
  "?help": Terminal,
  "?rickroll": Music,
  "?wholesome": Heart,
  "?chaos": Zap,
  "?matrix": Terminal,
  "?anime": BookOpen,
  "?mood": Moon,
  "gachi": Skull,
  "?nyan": Sparkles,
  "?todo": ClipboardList,
  "?konami": Zap,
  "?404": AlertTriangle,
  "?waifu": Wand2,
  "?powerup": Flame,
  "?portal": Ghost,
  "?shower": CloudRain,
  "?glitch": Bug,
}

export default function EasterEggsPage() {
  const [unlocked, setUnlocked] = useState<Set<string>>(new Set())
  const [searchValue, setSearchValue] = useState("")

  // Синхронизируем с глобальным поиском через кастомное событие
  useEffect(() => {
    const handleSearchCommand = (event: CustomEvent) => {
      const command = event.detail.command
      if (command) {
        setUnlocked((prev) => new Set([...prev, command]))
      }
    }

    window.addEventListener("easter-egg-used" as any, handleSearchCommand as any)
    return () => window.removeEventListener("easter-egg-used" as any, handleSearchCommand as any)
  }, [])

  const handleTryCommand = (egg: EasterEgg) => {
    // Имитируем ввод команды в поиск
    setSearchValue(egg.command)
    
    // Вызываем реальную функцию команды
    egg.action()
    
    // Отмечаем как использованную
    setUnlocked((prev) => new Set([...prev, egg.command]))
    
    // Отправляем событие для синхронизации
    window.dispatchEvent(new CustomEvent("easter-egg-used", {
      detail: { command: egg.command }
    }))
  }

  const handleGoToSearch = () => {
    // Скроллим к верху и фокусируемся на поиске
    window.scrollTo({ top: 0, behavior: "smooth" })
    toast("Поднимись наверх и введи команду в поиск", {
      description: "Поисковая строка в шапке сайта",
      duration: 4000,
    })
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <FloatingNav />
      
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-orange-500 to-pink-500 mb-6 shadow-lg shadow-orange-500/25">
            <Sparkles className="w-10 h-10 text-white" />
          </div>
          
          <h1 className="text-4xl font-bold text-foreground mb-4">
            🎮 Easter Eggs
          </h1>
          
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Секретные команды для поиска. Введи команду в поисковую строку и нажми Enter!
          </p>
        </div>

        {/* Commands Grid */}
        <div className="grid gap-4 md:grid-cols-2">
          {easterEggs.map((egg) => {
            const Icon = commandIcons[egg.command] || Terminal
            const isUnlocked = unlocked.has(egg.command)

            return (
              <button
                key={egg.command}
                onClick={() => handleTryCommand(egg)}
                className={`
                  relative p-6 rounded-xl border text-left transition-all duration-300
                  ${isUnlocked
                    ? "bg-gradient-to-br from-orange-500/10 to-pink-500/10 border-orange-500/50 shadow-lg shadow-orange-500/10"
                    : "bg-card/50 border-border hover:border-primary/50 hover:bg-card"
                  }
                  group
                `}
              >
                {isUnlocked && (
                  <div className="absolute top-2 right-2 text-xs text-orange-500 font-medium">
                    ✓ Активировано
                  </div>
                )}

                <div className="flex items-start gap-4">
                  <div className={`
                    w-12 h-12 rounded-lg flex items-center justify-center
                    ${isUnlocked
                      ? "bg-gradient-to-br from-orange-500 to-pink-500"
                      : "bg-muted group-hover:bg-primary/20"
                    }
                    transition-colors
                  `}>
                    <Icon className={`w-6 h-6 ${isUnlocked ? "text-white" : "text-muted-foreground group-hover:text-primary"}`} />
                  </div>

                  <div className="flex-1">
                    <code className="text-sm font-mono font-bold text-primary">
                      {egg.command}
                    </code>
                    <p className="text-sm text-muted-foreground mt-1">
                      {egg.description}
                    </p>
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        {/* Tips */}
        <div className="mt-12 p-6 rounded-xl bg-muted/50 border border-border">
          <h2 className="text-lg font-semibold text-foreground mb-3">
            💡 Как использовать?
          </h2>
          <ol className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="text-primary font-bold">1.</span>
              <span>Кликни на поисковую строку в шапке сайта</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary font-bold">2.</span>
              <span>Введи команду (например, <code className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono">?help</code>)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary font-bold">3.</span>
              <span>Нажми Enter и наслаждайся!</span>
            </li>
          </ol>
        </div>

        {/* Secret Message */}
        <div className="mt-8 text-center">
          <p className="text-xs text-muted-foreground">
            🤫 А ещё открой консоль разработчика (F12)... там может быть что-то интересное
          </p>
        </div>
      </div>
    </div>
  )
}
