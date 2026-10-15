"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
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
import { checkAdminAuth } from "../actions"

export default function AdminTutorialPage() {
  const [expandedId, setExpandedId] = useState<string | null>("login")
  // Страница отдавала ПОЛНУЮ инструкцию по эксплуатации админки любому
  // посетителю без входа: названия вкладок, механику чёрного списка,
  // имена переменных окружения и требования к TOTP/секретам в production.
  // Данных там нет, но это готовый разведматериал для атакующего, поэтому
  // контент отрисовывается только после подтверждения админ-сессии.
  const [authChecked, setAuthChecked] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  useEffect(() => {
    checkAdminAuth()
      .then((authenticated) => {
        setIsAuthenticated(authenticated)
        setAuthChecked(true)
      })
      .catch(() => setAuthChecked(true))
  }, [])

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <p className="text-slate-400 text-sm">Проверка доступа…</p>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-black mb-3">Доступ закрыт</h1>
          <p className="text-sm text-slate-400 mb-6">
            Туториал админ-панели доступен только после входа.
          </p>
          <Link
            href="/admin"
            className="inline-flex items-center gap-2 px-5 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-bold transition min-h-11"
          >
            <ArrowLeft size={16} className="shrink-0" />
            На страницу входа
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <ScrollToTop />
      <Footer />

      <main className="container mx-auto px-4 pt-20 sm:pt-24 lg:pt-28 pb-20">
        {/* Header */}
        <div className="mb-10">
          <Link
            href="/admin"
            className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition mb-4 min-h-11 -my-2"
          >
            <ArrowLeft size={16} className="shrink-0" />
            Назад в админку
          </Link>

          <div className="flex items-start gap-3 mb-3">
            <div className="p-3 bg-indigo-500/20 rounded-xl border border-indigo-500/30 shrink-0">
              <BookOpen className="w-8 h-8 text-indigo-400" />
            </div>
            <div>
              <h1 className="text-3xl font-black">Туториал админ-панели</h1>
              <p className="text-slate-400 mt-1">Полное руководство по всем разделам админки Weeb-X</p>
            </div>
          </div>

          {/* Quick nav */}
          <div className="flex flex-nowrap gap-2 mt-6 overflow-x-auto overscroll-x-contain snap-x [scrollbar-width:none] [&::-webkit-scrollbar]:hidden -mx-1 px-1 pb-1">
            {tutorialSections.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                onClick={() => setExpandedId(s.id)}
                className="inline-flex shrink-0 snap-start items-center gap-1.5 px-3 py-1.5 min-h-11 sm:min-h-0 bg-slate-900/50 hover:bg-slate-800 border border-white/5 rounded-lg text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-white transition whitespace-nowrap"
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
                  className="w-full flex items-center justify-between gap-3 p-4 sm:p-5 min-h-11 hover:bg-slate-800/50 transition text-left"
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
        <div className="mt-10 p-4 sm:p-6 bg-slate-900/30 border border-white/5 rounded-2xl text-center">
          <p className="text-sm text-slate-400">
            Туториал покрывает все {tutorialSections.length} разделов админ-панели.
            <br />
            Для дополнительной информации смотрите код в{" "}
            <code className="text-indigo-400 break-all">app/admin/</code>.
          </p>
        </div>
      </main>
    </div>
  )
}
