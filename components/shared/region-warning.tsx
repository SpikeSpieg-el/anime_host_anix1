"use client"

import { useState, useEffect } from "react"
import { AlertCircle } from "lucide-react"

interface RegionWarningProps {
  selectedCountry: string
  isRegionDetected?: boolean
}

export function RegionWarning({ selectedCountry, isRegionDetected = false }: RegionWarningProps) {
  const [showWarning, setShowWarning] = useState(false)

  useEffect(() => {
    // Показываем предупреждение только после определения региона
    if (isRegionDetected && selectedCountry === 'RU') {
      setShowWarning(true)
    } else {
      setShowWarning(false)
    }
  }, [selectedCountry, isRegionDetected])

  if (!showWarning) return null

  return (
    <div className="w-full mb-4">
      <div className="flex flex-col gap-1.5 p-3 sm:p-4 bg-gradient-to-r from-orange-500/15 to-red-500/10 border border-orange-500/25 rounded-xl backdrop-blur-md">
        <div className="flex items-center gap-2 text-orange-400 text-sm sm:text-base font-medium">
          <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
          <span className="leading-tight">Предупреждение, регион</span>
        </div>
        <div className="space-y-2">
          <p className="text-foreground text-sm sm:text-base leading-relaxed opacity-90">
            Обнаружен российский регион. Возможна блокировка контента и ограничение доступа к плееру.
          </p>
          <p className="text-muted-foreground text-sm sm:text-base leading-relaxed opacity-75">
            Рекомендуется изменить страну через сторонний сервис для стабильного доступа и чтобы не было рекламы 💫😶‍🌫️.
          </p>
        </div>
      </div>
    </div>
  )
}
