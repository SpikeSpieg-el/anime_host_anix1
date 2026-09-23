"use client"

import { useState } from "react"
import Link from "next/link"
import { Navbar } from "@/components/layout/navbar"
import { Footer } from "@/components/layout/footer"
import { ScrollToTop } from "@/components/layout/scroll-to-top"
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  ArrowLeft,
  Lightbulb,
  AlertTriangle,
  CheckCircle,
} from "lucide-react"
import { tutorialSections } from "../components/constants"

export default function AdminTutorialPage() {
  const [expandedId, setExpandedId] = useState<string | null>("login")

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Navbar />
      <ScrollToTop />
      <Footer />

      <main className="container mx-auto px-4 pt-20 sm:pt-24 lg:pt-28 pb-20">
        {/* Header */}
        <div className="mb-10">
          <Link
            href="/admin"
            className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition mb-4"
          >
            <ArrowLeft size={16} />
            Назад в админку
          </Link>

          <div className="flex items-center gap-3 mb-3">
            <div className="p-3 bg-indigo-500/20 rounded-xl border border-indigo-500/30">
              <BookOpen className="w-8 h-8 text-indigo-400" />
            </div>
            <div>
              <h1 className="text-3xl font-black">Туториал админ-панели</h1>
              <p className="text-slate-400 mt-1">Полное руководство по всем разделам админки Weeb-X</p>
            </div>
          </div>

          {/* Quick nav */}
          <div className="flex flex-wrap gap-2 mt-6">
            {tutorialSections.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                onClick={() => setExpandedId(s.id)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900/50 hover:bg-slate-800 border border-white/5 rounded-lg text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-white transition"
              >
                {s.icon}
                {s.title.split("—")[0].trim()}
              </a>
            ))}
          </div>
        </div>

        {/* Sections */}
        <div className="space-y-4">
          {tutorialSections.map((section) => {
            const isExpanded = expandedId === section.id
            return (
              <div
                key={section.id}
                id={section.id}
                className="bg-slate-900/50 border border-white/5 rounded-2xl overflow-hidden scroll-mt-24"
              >
                {/* Section header */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : section.id)}
                  className="w-full flex items-center justify-between p-5 hover:bg-slate-800/50 transition text-left"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="p-2 bg-indigo-500/10 rounded-lg border border-indigo-500/20 flex-shrink-0">
                      {section.icon}
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-lg font-bold truncate">{section.title}</h2>
                      <p className="text-sm text-slate-400 truncate">{section.description}</p>
                    </div>
                  </div>
                  {isExpanded ? (
                    <ChevronDown className="w-5 h-5 text-slate-400 flex-shrink-0" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-slate-400 flex-shrink-0" />
                  )}
                </button>

                {/* Section content */}
                {isExpanded && (
                  <div className="px-5 pb-5 space-y-4">
                    {/* Steps */}
                    <div className="space-y-3">
                      {section.steps.map((step, i) => (
                        <div
                          key={i}
                          className="flex gap-3 p-3 bg-slate-950/50 rounded-xl border border-white/5"
                        >
                          <div className="flex-shrink-0 w-7 h-7 bg-indigo-500/20 rounded-full flex items-center justify-center text-xs font-black text-indigo-400">
                            {i + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-white">{step.title}</p>
                            <p className="text-sm text-slate-400 mt-0.5">{step.detail}</p>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Tips */}
                    {section.tips && section.tips.length > 0 && (
                      <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-xl space-y-2">
                        <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase tracking-wider">
                          <Lightbulb className="w-4 h-4" />
                          Советы
                        </div>
                        {section.tips.map((tip, i) => (
                          <div key={i} className="flex items-start gap-2 text-sm text-emerald-300/80">
                            <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-emerald-500" />
                            <span>{tip}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Warnings */}
                    {section.warnings && section.warnings.length > 0 && (
                      <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-xl space-y-2">
                        <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wider">
                          <AlertTriangle className="w-4 h-4" />
                          Внимание
                        </div>
                        {section.warnings.map((w, i) => (
                          <div key={i} className="flex items-start gap-2 text-sm text-amber-300/80">
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

        {/* Footer note */}
        <div className="mt-10 p-6 bg-slate-900/30 border border-white/5 rounded-2xl text-center">
          <p className="text-sm text-slate-400">
            Туториал покрывает все 11 вкладок админ-панели: Users (с фильтрами и сортировкой), PvP,
            AI Battle, Battle Logs, Карты, Рассылка, События, Новости, Редакция, Туториал, Аналитика.
            <br />
            Для дополнительной информации смотрите код в <code className="text-indigo-400">app/admin/</code>.
          </p>
        </div>
      </main>
    </div>
  )
}
