"use client"

import { useState } from "react"
import { Coffee, Heart, X, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { trackEvent } from "@/lib/analytics"

interface BoostyBannerProps {
  className?: string
  /** Ссылка на картинку (из /public или внешний URL) */
  imageSrc?: string
  /** Описание картинки для доступности */
  imageAlt?: string
}

export function BoostyBanner({
  className,
  imageSrc = "/boosty-art.png", // укажи дефолтный путь к арту или оставь пустым
  imageAlt = "WEEB-X Supporter",
}: BoostyBannerProps) {
  const [dismissed, setDismissed] = useState(false)

  const handleDismiss = () => {
    trackEvent("boosty_banner_dismiss")
    setDismissed(true)
  }

  const handleDonateClick = () => {
    trackEvent("boosty_donate_click")
  }

  const handleBoostyClick = () => {
    trackEvent("boosty_page_click")
  }

  if (dismissed) return null

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-xl border border-zinc-800 bg-[#0e0e11]/95 p-3.5 sm:p-4 shadow-xl backdrop-blur-md transition-all hover:border-zinc-700/80",
        className
      )}
    >
      {/* Мягкое неоновое свечение в углу */}
      <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-orange-500/10 blur-2xl" />

      {/* Кнопка закрыть */}
      <button
        onClick={handleDismiss}
        className="absolute top-2 right-2 z-10 rounded-md p-1 text-zinc-500 hover:text-zinc-300 hover:bg-white/5 transition-colors"
        aria-label="Закрыть"
      >
        <X className="w-3.5 h-3.5" />
      </button>

      {/* Основной контент: адаптивная колонка / строка */}
      <div className="flex gap-3 sm:gap-4 items-start">
        {/* Картинка (если передана) */}
        {imageSrc && (
          <div className="relative shrink-0 w-16 h-16 sm:w-20 sm:h-20 rounded-lg overflow-hidden border border-zinc-800/80 bg-zinc-900/60 shadow-inner">
            <img
              src={imageSrc}
              alt={imageAlt}
              className="w-full h-full object-cover object-center"
              loading="lazy"
            />
          </div>
        )}

        {/* Текстовая часть */}
        <div className="flex-1 pr-4 sm:pr-2">
          {/* Верхний бейдж */}
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="flex h-4 w-4 sm:h-5 sm:w-5 items-center justify-center rounded bg-orange-500/15 text-orange-400">
              <Coffee className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
            </span>
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-orange-400/90">
              Поддержка
            </span>
          </div>

          <h4 className="text-xs sm:text-sm font-semibold text-zinc-100">
            Нравится WEEBX?
          </h4>
          <p className="mt-1 text-[11px] sm:text-xs text-zinc-400 leading-relaxed">
            Мы развиваем сайт своими силами и боремся со сторонней рекламой. Любой донат на онигири помогает держать сервера и выпускать обновления.
          </p>
        </div>
      </div>

      {/* Кнопки действий: на узких экранах складываются аккуратно */}
      <div className="mt-3 sm:mt-3.5 flex flex-wrap sm:flex-nowrap items-center gap-2">
        <Button
          asChild
          size="sm"
          className="flex-1 min-w-[120px] h-8 text-xs font-semibold bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-black shadow-md shadow-orange-500/15 active:scale-95 transition-all"
        >
          <a
            href="https://boosty.to/weebx.com/donate"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5"
            onClick={handleDonateClick}
          >
            <Heart className="w-3 h-3 fill-black" />
            <span>Закинуть донат</span>
          </a>
        </Button>

        <Button
          asChild
          size="sm"
          variant="outline"
          className="h-8 px-2.5 text-xs font-medium text-zinc-300 border-zinc-700/80 hover:bg-zinc-800 hover:text-white shrink-0"
        >
          <a
            href="https://boosty.to/weebx.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1"
            title="Перейти на страницу Boosty"
            onClick={handleBoostyClick}
          >
            <span>Boosty</span>
            <ExternalLink className="w-3 h-3 text-zinc-400" />
          </a>
        </Button>
      </div>
    </div>
  )
}