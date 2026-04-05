"use client"

import { useState, useEffect } from "react"
import { Loader2, TrendingUp, TrendingDown, Minus, Store, BarChart3 } from "lucide-react"
import type { Rarity } from "@/types/gacha"

interface PriceStats {
  rarity: Rarity
  count: number
  minPrice: number
  maxPrice: number
  avgPrice: number
  medianPrice: number
  priceRange: { min: number; max: number; avg: number }
}

interface MarketAnalysis {
  totalListings: number
  totalValue: number
  averagePrice: number
  priceByRarity: Record<Rarity, PriceStats>
  topCharacters: Array<{
    characterId: number
    characterName: string
    count: number
    avgPrice: number
  }>
  recentTrends: Array<{
    date: string
    avgPrice: number
    volume: number
  }>
  priceRanges: Record<Rarity, { min: number; max: number; avg: number }>
  recommendations: {
    simplifyFormula: boolean
    removeCollectionBonus: boolean
    adjustStatMultiplier: number
    baseMultiplier: number
  }
}

const rarityConfig: Record<Rarity, { label: string; color: string }> = {
  trash: { label: "Мусор", color: "text-stone-400" },
  common: { label: "Обычная", color: "text-slate-400" },
  uncommon: { label: "Необычная", color: "text-emerald-400" },
  rare: { label: "Редкая", color: "text-cyan-400" },
  super_rare: { label: "Супер Редкая", color: "text-indigo-400" },
  epic: { label: "Эпическая", color: "text-purple-400" },
  mythic: { label: "Мифическая", color: "text-fuchsia-400" },
  legendary: { label: "Легендарная", color: "text-pink-400" },
  ancient: { label: "Древняя", color: "text-amber-400" },
  divine: { label: "Божественная", color: "text-orange-400" },
  transcendent: { label: "Трансцендентная", color: "text-red-400" },
  omnipotent: { label: "Всемогущая", color: "text-yellow-300" }
}

export default function MarketAnalysisPage() {
  const [analysis, setAnalysis] = useState<MarketAnalysis | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadAnalysis = async () => {
      try {
        setLoading(true)
        const response = await fetch('/api/market/price-stats')
        
        if (!response.ok) {
          throw new Error('Не удалось загрузить данные рынка')
        }
        
        const data = await response.json()
        setAnalysis(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Произошла ошибка')
      } finally {
        setLoading(false)
      }
    }

    loadAnalysis()
  }, [])

  const getPriceTrend = (current: number, suggested: number) => {
    if (current > suggested * 1.1) return { icon: TrendingUp, color: "text-red-400", label: "Высокая" }
    if (current < suggested * 0.9) return { icon: TrendingDown, color: "text-green-400", label: "Низкая" }
    return { icon: Minus, color: "text-yellow-400", label: "Нормальная" }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-cyan-400 animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Загрузка анализа рынка...</p>
        </div>
      </div>
    )
  }

  if (error || !analysis) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error || 'Данные недоступны'}</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-cyan-600 text-white rounded-lg"
          >
            Обновить
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center gap-3">
          <BarChart3 className="w-8 h-8 text-cyan-400" />
          <h1 className="text-3xl font-black text-white">Анализ рынка</h1>
        </div>

        {/* Общая статистика */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-4">
            <p className="text-slate-400 text-sm mb-1">Всего лотов</p>
            <p className="text-2xl font-black text-white">{analysis.totalListings}</p>
          </div>
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-4">
            <p className="text-slate-400 text-sm mb-1">Общая стоимость</p>
            <p className="text-2xl font-black text-yellow-400">{analysis.totalValue.toLocaleString()}</p>
          </div>
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-4">
            <p className="text-slate-400 text-sm mb-1">Средняя цена</p>
            <p className="text-2xl font-black text-cyan-400">{analysis.averagePrice.toLocaleString()}</p>
          </div>
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-4">
            <p className="text-slate-400 text-sm mb-1">Активных редкостей</p>
            <p className="text-2xl font-black text-green-400">
              {Object.values(analysis.priceByRarity).filter(r => r.count > 0).length}
            </p>
          </div>
        </div>

        {/* Статистика по редкостям */}
        <div className="bg-slate-900 border border-slate-700 rounded-xl p-6">
          <h2 className="text-xl font-black text-white mb-4">Цены по редкостям</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left py-2 text-slate-400">Редкость</th>
                  <th className="text-right py-2 text-slate-400">Лотов</th>
                  <th className="text-right py-2 text-slate-400">Минимум</th>
                  <th className="text-right py-2 text-slate-400">Среднее</th>
                  <th className="text-right py-2 text-slate-400">Максимум</th>
                  <th className="text-center py-2 text-slate-400">Тренд</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(analysis.priceByRarity).map(([rarity, stats]) => {
                  const config = rarityConfig[rarity as Rarity]
                  const trend = getPriceTrend(stats.avgPrice, stats.priceRange.avg)
                  const TrendIcon = trend.icon
                  
                  return (
                    <tr key={rarity} className="border-b border-slate-800">
                      <td className={`py-2 font-bold ${config.color}`}>{config.label}</td>
                      <td className="text-right py-2 text-white">{stats.count}</td>
                      <td className="text-right py-2 text-slate-300">{stats.minPrice.toLocaleString()}</td>
                      <td className="text-right py-2 text-cyan-300 font-bold">{stats.avgPrice.toLocaleString()}</td>
                      <td className="text-right py-2 text-slate-300">{stats.maxPrice.toLocaleString()}</td>
                      <td className="text-center py-2">
                        <div className={`flex items-center justify-center gap-1 ${trend.color}`}>
                          <TrendIcon className="w-4 h-4" />
                          <span className="text-xs">{trend.label}</span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Топ персонажей */}
        <div className="bg-slate-900 border border-slate-700 rounded-xl p-6">
          <h2 className="text-xl font-black text-white mb-4">Популярные персонажи</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {analysis.topCharacters.slice(0, 9).map((character, index) => (
              <div key={character.characterId} className="bg-slate-800 rounded-lg p-3">
                <div className="flex justify-between items-start mb-2">
                  <p className="text-white font-bold truncate">{character.characterName}</p>
                  <span className="text-cyan-400 text-xs">#{index + 1}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Лотов: {character.count}</span>
                  <span className="text-yellow-400">{character.avgPrice.toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Рекомендации */}
        <div className="bg-slate-900 border border-slate-700 rounded-xl p-6">
          <h2 className="text-xl font-black text-white mb-4">Рекомендации по улучшению</h2>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${analysis.recommendations.simplifyFormula ? 'bg-green-400' : 'bg-red-400'}`} />
              <span className="text-slate-300">Упростить формулу ценообразования</span>
            </div>
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${analysis.recommendations.removeCollectionBonus ? 'bg-green-400' : 'bg-red-400'}`} />
              <span className="text-slate-300">Убрать коллекционный бонус</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-slate-300">Множитель статов: {analysis.recommendations.adjustStatMultiplier}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-slate-300">Базовый множитель: {analysis.recommendations.baseMultiplier}</span>
            </div>
          </div>
        </div>

        {/* Кнопка обновления */}
        <div className="text-center">
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-xl flex items-center gap-2 mx-auto"
          >
            <Store className="w-5 h-5" />
            Обновить данные
          </button>
        </div>
      </div>
    </div>
  )
}
