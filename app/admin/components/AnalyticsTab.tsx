"use client"

import { useState } from "react"
import { BarChart3, Download, ServerCrash } from "lucide-react"
import type { AdminTab } from "./types"

interface AnalyticsTabProps {
  activeTab: AdminTab
  onTabChange: (tab: AdminTab) => void
}

export function AnalyticsTab({ activeTab, onTabChange }: AnalyticsTabProps) {
  const [isExporting, setIsExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Раньше здесь отправлялся POST на /api/admin/analytics-export, где
  // объявлен только GET — запрос всегда падал с 405, а поле со строкой
  // подключения к Postgres сервером вообще не использовалось.
  // Экспорт идёт через GET; подключение берётся из UMAMI_DATABASE_URL
  // на сервере, поэтому вводить учётные данные в браузере не нужно.
  const handleDownload = async () => {
    try {
      setIsExporting(true)
      setError(null)

      const response = await fetch("/api/admin/analytics-export", {
        method: "GET",
        cache: "no-store",
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.error || `Ошибка ${response.status}`)
      }

      // Роут отдаёт CSV-поток, поэтому скачивание делаем через blob,
      // а не переходом по ссылке.
      const blob = await response.blob()
      const objectUrl = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = objectUrl
      link.download = `analytics-${Date.now()}.csv`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(objectUrl)
    } catch (err) {
      console.error("Failed to export analytics:", err)
      setError(err instanceof Error ? err.message : "Не удалось выполнить экспорт.")
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <h2 className="text-lg sm:text-2xl font-bold flex items-center gap-2 min-w-0">
          <BarChart3 size={24} className="w-5 h-5 sm:w-6 sm:h-6 text-primary shrink-0" />
          <span className="break-words">Аналитика Umami — экспорт</span>
        </h2>
      </div>

      <div className="bg-card border border-border rounded-xl p-4 sm:p-6 space-y-4">
        <p className="text-sm text-muted-foreground leading-relaxed">
          Экспорт событий аналитики Umami в CSV. Подключение к базе выполняет сервер
          приложения — учётные данные вводить здесь не нужно.
        </p>

        <button
          onClick={handleDownload}
          disabled={isExporting || activeTab !== 'analytics'}
          className="flex w-full sm:w-auto items-center justify-center gap-2 min-h-11 px-4 py-2 bg-primary text-primary-foreground rounded hover:opacity-90 transition font-medium disabled:opacity-50"
        >
          <Download size={16} className="shrink-0" />
          {isExporting ? "Экспорт..." : "Скачать CSV"}
        </button>

        {error && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm break-words">
            {error}
          </div>
        )}

        <div className="bg-muted/40 border border-border rounded-lg p-3 space-y-2 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">Как использовать:</p>
          <ol className="list-decimal list-inside space-y-1 leading-relaxed">
            <li>Нажмите «Скачать CSV» — сервер выгрузит события и отдаст файл.</li>
            <li>Ограничение одной выгрузки — 100 000 последних событий.</li>
            <li>Повторные запросы подряд блокируются лимитом, чтобы не нагружать базу.</li>
          </ol>
        </div>

        <p className="text-xs text-muted-foreground">
          Требуется переменная окружения UMAMI_DATABASE_URL. Если сайт в базе не один,
          задайте NEXT_PUBLIC_UMAMI_WEBSITE_ID — иначе выгрузятся события всех сайтов.
        </p>
      </div>

      <div className="bg-card border border-border rounded-xl p-4 sm:p-6 space-y-3">
        <h3 className="text-base font-semibold flex items-center gap-2">
          <ServerCrash size={18} className="w-4 h-4 text-muted-foreground shrink-0" />
          Альтернативный способ (на сервере/компьютере)
        </h3>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Если у вас установлен Node.js, можно запустить экспорт напрямую одной командой:
        </p>
        <pre className="bg-muted border border-border rounded-lg p-3 text-xs sm:text-sm overflow-x-auto overscroll-x-contain [scrollbar-width:thin]">
{`npx @openpanel/umami-exporter "postgresql://username:password@localhost:5432/umami" --output data.csv`}
        </pre>
      </div>
    </div>
  )
}
