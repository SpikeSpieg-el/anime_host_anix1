"use client"

import { useState } from "react"
import { BarChart3, Download, ServerCrash } from "lucide-react"
import type { AdminTab } from "./types"

interface AnalyticsTabProps {
  activeTab: AdminTab
  onTabChange: (tab: AdminTab) => void
}

export function AnalyticsTab({ activeTab, onTabChange }: AnalyticsTabProps) {
  const [databaseUrl, setDatabaseUrl] = useState("")
  const [isExporting, setIsExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleDownload = async () => {
    if (!databaseUrl.trim()) {
      setError("Введите строку подключения к базе данных")
      return
    }
    try {
      setIsExporting(true)
      setError(null)
      await fetch("/api/admin/analytics-export", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ databaseUrl: databaseUrl.trim() }),
      })
    } catch (err) {
      console.error("Failed to export analytics:", err)
      setError("Не удалось запустить экспорт. Проверьте строку подключения к базе данных.")
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <h2 className="text-lg sm:text-2xl font-bold flex items-center gap-2">
          <BarChart3 size={24} className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
          Аналитика Umami — экспорт
        </h2>
      </div>

      <div className="bg-card border border-border rounded-xl p-4 sm:p-6 space-y-4">
        <p className="text-sm text-muted-foreground leading-relaxed">
          Экспорт данных аналитики Umami в CSV. Утилита подключается к базе данных проекта,
          объединяет все события и сессии и сохраняет готовый файл для скачивания.
        </p>

        <div className="space-y-3">
          <label className="block text-xs font-medium text-muted-foreground mb-1 uppercase">Строка подключения к Postgres</label>
          <input
            type="text"
            value={databaseUrl}
            onChange={(e) => setDatabaseUrl(e.target.value)}
            placeholder="postgresql://username:password@localhost:5432/umami"
            className="w-full px-3 py-2 bg-muted border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary text-sm font-mono"
          />
        </div>

        <button
          onClick={handleDownload}
          disabled={isExporting || activeTab !== 'analytics'}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded hover:opacity-90 transition font-medium disabled:opacity-50"
        >
          <Download size={16} />
          {isExporting ? "Экспорт..." : "Скачать CSV"}
        </button>

        {error && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
            {error}
          </div>
        )}

        <div className="bg-muted/40 border border-border rounded-lg p-3 space-y-2 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">Как использовать:</p>
          <ol className="list-decimal list-inside space-y-1 leading-relaxed">
            <li>Вставьте строку подключения к вашей базе данных Umami.</li>
            <li>Нажмите «Скачать CSV» — начнётся экспорт в браузере.</li>
            <li>Откроется файл с объединёнными событиями и сессиями для анализа.</li>
          </ol>
        </div>

        <p className="text-xs text-muted-foreground">
          Утилита устанавливается автоматически при первом запуске. Требуется Node.js на сервере.
        </p>
      </div>

      <div className="bg-card border border-border rounded-xl p-4 sm:p-6 space-y-3">
        <h3 className="text-base font-semibold flex items-center gap-2">
          <ServerCrash size={18} className="w-4 h-4 text-muted-foreground" />
          Альтернативный способ (на сервере/компьютере)
        </h3>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Если у вас установлен Node.js, можно запустить экспорт напрямую одной командой:
        </p>
        <pre className="bg-muted border border-border rounded-lg p-3 text-xs overflow-x-auto">
{`npx @openpanel/umami-exporter "postgresql://username:password@localhost:5432/umami" --output data.csv`}
        </pre>
      </div>
    </div>
  )
}
