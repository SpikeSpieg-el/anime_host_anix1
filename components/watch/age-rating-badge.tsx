"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { Info } from "lucide-react"
import {
  AGE_RATING_LIST,
  getAgeRatingInfo,
  type AgeRatingInfo,
} from "@/lib/age-rating"

interface AgeRatingBadgeProps {
  /** Строковый рейтинг Shikimori: "r", "r_plus", "rx"… */
  rating: string | undefined | null
}

/**
 * Возрастной бейдж поверх обложки. По клику открывает окно-объяснение:
 * что означает метка на конкретном тайтле и легенду всей сетки 0+…18+.
 *
 * КОНФЛИКТ С ОБЛОЖКОЙ (исправлено): раньше бейдж вкладывался ВНУТРЬ
 * кликабельного постера (div role="button" открывает модалку обложки),
 * и клику по бейджу нужен был stopPropagation, а скринридер читал постер
 * одной строкой вместе с бейджем. Теперь бейдж рендерится как СОСЕД
 * постера (см. watch-page-client.tsx, обёртка relative shrink-0) —
 * события пересекаться не могут в принципе, поэтому здесь обычная
 * кнопка без перехвата всплытия.
 */
export function AgeRatingBadge({ rating }: AgeRatingBadgeProps) {
  const [isOpen, setIsOpen] = useState(false)

  const info = getAgeRatingInfo(rating)

  // Неизвестный рейтинг — молча не рисуем: пустой угол лучше выдуманной метки.
  if (!info) return null

  const rawRating = (rating ?? "").toUpperCase().replace("_", "+")

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-haspopup="dialog"
        aria-label={`Возрастная категория ${info.label} — ${info.description}. Нажмите, чтобы прочитать, что это значит.`}
        title="Что означает эта метка?"
        className={cn(
          "pointer-events-auto cursor-pointer px-1.5 py-0.5 rounded font-bold tracking-wide shadow-sm",
          "text-[9px] md:text-[10px] transition-transform hover:scale-110 active:scale-95",
          "inline-flex items-center gap-0.5",
          info.badgeClass
        )}
      >
        {info.label}
        <Info className="w-2 h-2 opacity-80" aria-hidden="true" />
      </button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-md rounded-2xl p-5 md:p-6">
          <DialogTitle className="text-base md:text-lg font-bold">
            Возрастная категория
          </DialogTitle>
          <DialogDescription className="sr-only">
            Пояснение: что означает возрастная метка этого тайтла и вся сетка
            возрастных меток.
          </DialogDescription>

          {/* Текущая метка крупно + сырой код Shikimori */}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span
              className={cn(
                "inline-flex items-center px-3 py-1.5 rounded-lg text-base font-black tracking-wide shadow-sm",
                info.badgeClass
              )}
            >
              {info.label}
            </span>
            <span className="text-xs md:text-sm text-muted-foreground">
              рейтинг Shikimori:{" "}
              <code className="px-1.5 py-0.5 rounded bg-muted text-foreground font-semibold">
                {rawRating}
              </code>
            </span>
          </div>

          <p className="mt-3 text-sm leading-relaxed text-foreground/90">
            {info.explain}
          </p>

          {/* Легенда: вся сетка меток, текущая подсвечена */}
          <div className="mt-5 rounded-xl border border-border bg-muted/40 p-3 md:p-4">
            <h4 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Что означают метки
            </h4>
            <ul className="mt-2.5 space-y-2">
              {AGE_RATING_LIST.map((item) => (
                <AgeRatingLegendRow
                  key={item.label}
                  info={item}
                  isCurrent={item === info}
                />
              ))}
            </ul>
          </div>

          <p className="mt-3 text-[10px] md:text-xs text-muted-foreground leading-relaxed">
            Метка проставлена по данным Shikimori и показывает возрастную
            границу контента, а не запрет. Решение о просмотре остаётся за
            зрителем (или его родителями).
          </p>
        </DialogContent>
      </Dialog>
    </>
  )
}

function AgeRatingLegendRow({
  info,
  isCurrent,
}: {
  info: AgeRatingInfo
  isCurrent: boolean
}) {
  return (
    <li className={cn(
      "flex items-start gap-2.5 rounded-lg p-1.5 -m-1.5 transition-colors",
      isCurrent && "bg-primary/10"
    )}>
      <span
        className={cn(
          "shrink-0 inline-flex items-center justify-center px-2 py-0.5 rounded-md text-[10px] font-bold shadow-sm mt-0.5",
          info.badgeClass
        )}
      >
        {info.label}
      </span>
      <span className={cn(
        "text-xs leading-relaxed",
        isCurrent ? "text-foreground font-medium" : "text-muted-foreground"
      )}>
        {info.description}
      </span>
    </li>
  )
}
