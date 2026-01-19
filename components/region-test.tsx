"use client"

import { useState } from "react"
import { RegionDetector } from "@/components/region-detector"

export function RegionTest() {
  const [currentCountry, setCurrentCountry] = useState<string>('RU')

  const handleCountryChange = (country: string) => {
    console.log('Country changed to:', country)
    setCurrentCountry(country)
  }

  return (
    <div className="p-8 bg-zinc-950 min-h-screen">
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-white mb-6">Тест определения региона</h1>
        
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4">
          <h2 className="text-lg font-semibold text-white mb-4">Детектор региона</h2>
          <RegionDetector onCountryChange={handleCountryChange} />
        </div>
        
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4">
          <h2 className="text-lg font-semibold text-white mb-2">Текущая страна для плеера</h2>
          <p className="text-zinc-300">Код страны: <span className="text-orange-500 font-mono">{currentCountry}</span></p>
          <p className="text-zinc-500 text-sm mt-1">
            {currentCountry === 'RU' && 'Россия - возможна блокировка контента, рекомендуется изменить регион'}
            {currentCountry === 'KZ' && 'Казахстан - оптимизированная настройка'}
            {currentCountry === 'US' && 'США - стандартная настройка'}
            {!['RU', 'KZ', 'US'].includes(currentCountry) && `${currentCountry} - определенный регион`}
          </p>
        </div>
      </div>
    </div>
  )
}
