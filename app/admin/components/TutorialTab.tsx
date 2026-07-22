"use client"

import { useState } from "react"
import { BookOpen, ChevronDown, ChevronRight, Lightbulb, CheckCircle, AlertTriangle } from "lucide-react"
import { tutorialSections } from "./constants"

export function TutorialTab() {
  const [expandedId, setExpandedId] = useState<string | null>("login")

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <BookOpen className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
        <div>
          <h2 className="text-lg sm:text-2xl font-bold">Туториал админ-панели</h2>
          <p className="text-xs sm:text-sm text-muted-foreground">Полное руководство по всем разделам</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-2">
        {tutorialSections.map((s) => (
          <button
            key={s.id}
            onClick={() => setExpandedId(s.id)}
            className="inline-flex items-center gap-1.5 px-2 sm:px-3 py-1.5 bg-muted/50 hover:bg-muted border border-border rounded-lg text-[10px] sm:text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground transition whitespace-nowrap"
          >
            {s.icon}
            {s.title.split("—")[0].trim()}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {tutorialSections.map((section) => {
          const isExpanded = expandedId === section.id
          return (
            <div key={section.id} className="bg-card border border-border rounded-xl overflow-hidden">
              <button
                onClick={() => setExpandedId(isExpanded ? null : section.id)}
                className="w-full flex items-center justify-between p-3 sm:p-4 hover:bg-muted/50 transition text-left"
              >
                <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                  <div className="p-2 bg-primary/10 rounded-lg border border-primary/20 flex-shrink-0">
                    {section.icon}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm sm:text-base font-bold truncate">{section.title}</h3>
                    <p className="text-[10px] sm:text-xs text-muted-foreground truncate">{section.description}</p>
                  </div>
                </div>
                {isExpanded ? <ChevronDown className="w-5 h-5 text-muted-foreground flex-shrink-0" /> : <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />}
              </button>
              {isExpanded && (
                <div className="px-3 sm:px-4 pb-3 sm:pb-4 space-y-3">
                  <div className="space-y-2">
                    {section.steps.map((step, i) => (
                      <div key={i} className="flex gap-2 sm:gap-3 p-2 sm:p-3 bg-muted/30 rounded-lg border border-border/50">
                        <div className="flex-shrink-0 w-5 h-5 sm:w-6 sm:h-6 bg-primary/20 rounded-full flex items-center justify-center text-[10px] sm:text-xs font-black text-primary">
                          {i + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs sm:text-sm font-bold text-foreground">{step.title}</p>
                          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">{step.detail}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  {section.tips && section.tips.length > 0 && (
                    <div className="p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-lg space-y-1.5">
                      <div className="flex items-center gap-2 text-emerald-500 font-bold text-xs uppercase tracking-wider">
                        <Lightbulb className="w-4 h-4" />
                        Советы
                      </div>
                      {section.tips.map((tip, i) => (
                        <div key={i} className="flex items-start gap-2 text-sm text-emerald-600/80">
                          <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-emerald-500" />
                          <span>{tip}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {section.warnings && section.warnings.length > 0 && (
                    <div className="p-3 bg-amber-500/5 border border-amber-500/20 rounded-lg space-y-1.5">
                      <div className="flex items-center gap-2 text-amber-500 font-bold text-xs uppercase tracking-wider">
                        <AlertTriangle className="w-4 h-4" />
                        Внимание
                      </div>
                      {section.warnings.map((w, i) => (
                        <div key={i} className="flex items-start gap-2 text-sm text-amber-600/80">
                          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0 text-amber-500" />
                          <span>{w}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
