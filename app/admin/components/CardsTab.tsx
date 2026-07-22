"use client"

import { Sparkles } from "lucide-react"
import Link from "next/link"

export function CardsTab() {
  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg sm:text-2xl font-bold flex items-center gap-2">
          <Sparkles size={24} className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
          Редактор карт
        </h2>
      </div>
      <div className="bg-card border border-border rounded-xl p-4 sm:p-8 text-center space-y-4 sm:space-y-6">
        <Sparkles size={48} className="text-primary mx-auto" />
        <div className="space-y-2">
          <h3 className="text-xl font-bold">Создание и редактирование карт</h3>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Откройте редактор карт, чтобы создать новую карту с 3D-слоями, статами и модификаторами.
            Готовую карту можно подарить пользователю или добавить в баннер события.
          </p>
        </div>
        <Link
          href="/admin/card-editor"
          className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-primary/90 transition"
        >
          <Sparkles size={20} />
          Открыть редактор карт
        </Link>
      </div>
    </div>
  )
}
