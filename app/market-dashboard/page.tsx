"use client"

import { useState, useEffect } from "react"
import { Loader2, Store, TrendingUp, BarChart3, History, Package, DollarSign, Eye, Filter, RefreshCw } from "lucide-react"
import type { Rarity } from "@/types/gacha"

interface MarketListing {
  listingId: string
  price: number
  minPriceAtList: number
  sellerId: string
  createdAt: string
  isMine: boolean
  card: {
    uniqueId: string
    serialId: string
    name: string
    anime: string
    rarity: Rarity
    imageUrl: string
    originalUrl: string
    fallbackUrls: string[]
    score: number
    shikiId: number
    characterId: number
    stats: {
      hp: number
      atk: number
      def: number
      spd: number
      luck: number
    }
    isMainCharacter: boolean
    packId?: string
    packName?: string
    isArtBlacklisted: boolean
  }
}

interface MarketSale {
  saleId: string
  listingId: string
  sellerId: string
  buyerId: string
  price: number
  soldAt: string
  card: {
    uniqueId: string
    serialId: string
    name: string
    anime: string
    rarity: Rarity
    stats: {
      hp: number
      atk: number
      def: number
      spd: number
      luck: number
    }
    isMainCharacter: boolean
    frameModifier?: string
    coatingModifier?: string
  }
}

interface MarketAnalytics {
  supply: {
    total: number
    byRarity: Record<string, number>
    byFrameModifier: Record<string, number>
    byCoatingModifier: Record<string, number>
  }
  demand: {
    total: number
    byRarity: Record<string, number>
    byFrameModifier: Record<string, number>
    byCoatingModifier: Record<string, number>
  }
  ratios: {
    byRarity: Record<string, number>
    byFrameModifier: Record<string, number>
    byCoatingModifier: Record<string, number>
  }
  avgPrice: Record<string, number>
  period: string
}

const rarityConfig: Record<Rarity, { label: string; color: string; bgColor: string }> = {
  trash: { label: "Мусор", color: "text-stone-400", bgColor: "bg-stone-900" },
  common: { label: "Обычная", color: "text-slate-400", bgColor: "bg-slate-900" },
  uncommon: { label: "Необычная", color: "text-emerald-400", bgColor: "bg-emerald-900" },
  rare: { label: "Редкая", color: "text-cyan-400", bgColor: "bg-cyan-900" },
  super_rare: { label: "Супер Редкая", color: "text-indigo-400", bgColor: "bg-indigo-900" },
  epic: { label: "Эпическая", color: "text-purple-400", bgColor: "bg-purple-900" },
  mythic: { label: "Мифическая", color: "text-fuchsia-400", bgColor: "bg-fuchsia-900" },
  legendary: { label: "Легендарная", color: "text-pink-400", bgColor: "bg-pink-900" },
  ancient: { label: "Древняя", color: "text-amber-400", bgColor: "bg-amber-900" },
  divine: { label: "Божественная", color: "text-orange-400", bgColor: "bg-orange-900" },
  transcendent: { label: "Трансцендентная", color: "text-red-400", bgColor: "bg-red-900" },
  omnipotent: { label: "Всемогущая", color: "text-yellow-300", bgColor: "bg-yellow-900" }
}

export default function MarketDashboardPage() {
  const [activeTab, setActiveTab] = useState<"listings" | "sales" | "analytics">("listings")
  const [listings, setListings] = useState<MarketListing[]>([])
  const [sales, setSales] = useState<MarketSale[]>([])
  const [analytics, setAnalytics] = useState<MarketAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filterRarity, setFilterRarity] = useState<string>("all")

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)

      const [listingsRes, salesRes, analyticsRes] = await Promise.all([
        fetch('/api/market/listings?limit=100'),
        fetch('/api/market/sales-history?limit=50&days=30'),
        fetch('/api/market/analytics?days=30')
      ])

      if (!listingsRes.ok) throw new Error('Не удалось загрузить лоты')
      if (!salesRes.ok) throw new Error('Не удалось загрузить историю продаж')
      if (!analyticsRes.ok) throw new Error('Не удалось загрузить аналитику')

      const listingsData = await listingsRes.json()
      const salesData = await salesRes.json()
      const analyticsData = await analyticsRes.json()

      setListings(listingsData.listings || [])
      setSales(salesData.sales || [])
      setAnalytics(analyticsData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Произошла ошибка')
    } finally {
      setLoading(false)
    }
  }

  const filteredListings = filterRarity === "all" 
    ? listings 
    : listings.filter(l => l.card.rarity === filterRarity)

  const filteredSales = filterRarity === "all"
    ? sales
    : sales.filter(s => s.card.rarity === filterRarity)

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-cyan-400 animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Загрузка данных рынка...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <button 
            onClick={loadData}
            className="px-4 py-2 bg-cyan-600 text-white rounded-lg"
          >
            Повторить
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Store className="w-8 h-8 text-cyan-400" />
            <h1 className="text-3xl font-black text-white">Рыночек порешал</h1>
          </div>
          <button
            onClick={loadData}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Обновить
          </button>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Package className="w-5 h-5 text-cyan-400" />
              <p className="text-slate-400 text-sm">Активные лоты</p>
            </div>
            <p className="text-2xl font-black text-white">{listings.length}</p>
          </div>
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <History className="w-5 h-5 text-purple-400" />
              <p className="text-slate-400 text-sm">Продаж за 30 дней</p>
            </div>
            <p className="text-2xl font-black text-white">{sales.length}</p>
          </div>
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-5 h-5 text-yellow-400" />
              <p className="text-slate-400 text-sm">Оборот рынка</p>
            </div>
            <p className="text-2xl font-black text-yellow-400">
              {sales.reduce((sum, s) => sum + s.price, 0).toLocaleString()}
            </p>
          </div>
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-5 h-5 text-green-400" />
              <p className="text-slate-400 text-sm">Средняя цена</p>
            </div>
            <p className="text-2xl font-black text-cyan-400">
              {listings.length > 0 
                ? Math.round(listings.reduce((sum, l) => sum + l.price, 0) / listings.length).toLocaleString()
                : 0}
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-slate-900 border border-slate-700 rounded-xl p-2 flex gap-2">
          <button
            onClick={() => setActiveTab("listings")}
            className={`flex-1 px-4 py-2 rounded-lg font-bold flex items-center justify-center gap-2 ${
              activeTab === "listings" ? "bg-cyan-600 text-white" : "text-slate-400 hover:bg-slate-800"
            }`}
          >
            <Package className="w-4 h-4" />
            Лоты ({listings.length})
          </button>
          <button
            onClick={() => setActiveTab("sales")}
            className={`flex-1 px-4 py-2 rounded-lg font-bold flex items-center justify-center gap-2 ${
              activeTab === "sales" ? "bg-purple-600 text-white" : "text-slate-400 hover:bg-slate-800"
            }`}
          >
            <History className="w-4 h-4" />
            История продаж ({sales.length})
          </button>
          <button
            onClick={() => setActiveTab("analytics")}
            className={`flex-1 px-4 py-2 rounded-lg font-bold flex items-center justify-center gap-2 ${
              activeTab === "analytics" ? "bg-green-600 text-white" : "text-slate-400 hover:bg-slate-800"
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            Аналитика
          </button>
        </div>

        {/* Filter */}
        <div className="flex items-center gap-3">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={filterRarity}
            onChange={(e) => setFilterRarity(e.target.value)}
            className="bg-slate-900 border border-slate-700 text-white rounded-lg px-3 py-2"
          >
            <option value="all">Все редкости</option>
            {Object.entries(rarityConfig).map(([key, config]) => (
              <option key={key} value={key}>{config.label}</option>
            ))}
          </select>
        </div>

        {/* Listings Tab */}
        {activeTab === "listings" && (
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-6">
            <h2 className="text-xl font-black text-white mb-4">Активные лоты</h2>
            <div className="space-y-3 max-h-[600px] overflow-y-auto">
              {filteredListings.length === 0 ? (
                <p className="text-slate-400 text-center py-8">Нет лотов</p>
              ) : (
                filteredListings.map((listing) => {
                  const config = rarityConfig[listing.card.rarity]
                  return (
                    <div key={listing.listingId} className={`bg-slate-800 rounded-lg p-4 border-l-4 ${config.bgColor.replace('bg-', 'border-')}`}>
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className={`font-bold ${config.color}`}>{config.label}</span>
                            <span className="text-slate-400">•</span>
                            <span className="text-white font-bold">{listing.card.name}</span>
                            <span className="text-slate-400">•</span>
                            <span className="text-slate-300">{listing.card.anime}</span>
                          </div>
                          <div className="grid grid-cols-5 gap-2 text-xs text-slate-400">
                            <div>HP: {listing.card.stats.hp}</div>
                            <div>ATK: {listing.card.stats.atk}</div>
                            <div>DEF: {listing.card.stats.def}</div>
                            <div>SPD: {listing.card.stats.spd}</div>
                            <div>LUCK: {listing.card.stats.luck}</div>
                          </div>
                          <div className="text-xs text-slate-500 mt-1">
                            #{listing.card.serialId} • {listing.card.isMainCharacter && "★ Главный персонаж"}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-black text-yellow-400">{listing.price.toLocaleString()}</p>
                          <p className="text-xs text-slate-500">монет</p>
                          {listing.isMine && (
                            <span className="text-xs text-cyan-400">Ваш лот</span>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        )}

        {/* Sales Tab */}
        {activeTab === "sales" && (
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-6">
            <h2 className="text-xl font-black text-white mb-4">История продаж</h2>
            <div className="space-y-3 max-h-[600px] overflow-y-auto">
              {filteredSales.length === 0 ? (
                <p className="text-slate-400 text-center py-8">Нет продаж</p>
              ) : (
                filteredSales.map((sale) => {
                  const config = rarityConfig[sale.card.rarity]
                  const saleDate = new Date(sale.soldAt).toLocaleString('ru-RU')
                  return (
                    <div key={sale.saleId} className={`bg-slate-800 rounded-lg p-4 border-l-4 ${config.bgColor.replace('bg-', 'border-')}`}>
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className={`font-bold ${config.color}`}>{config.label}</span>
                            <span className="text-slate-400">•</span>
                            <span className="text-white font-bold">{sale.card.name}</span>
                            <span className="text-slate-400">•</span>
                            <span className="text-slate-300">{sale.card.anime}</span>
                          </div>
                          <div className="grid grid-cols-5 gap-2 text-xs text-slate-400">
                            <div>HP: {sale.card.stats.hp}</div>
                            <div>ATK: {sale.card.stats.atk}</div>
                            <div>DEF: {sale.card.stats.def}</div>
                            <div>SPD: {sale.card.stats.spd}</div>
                            <div>LUCK: {sale.card.stats.luck}</div>
                          </div>
                          <div className="text-xs text-slate-500 mt-1">
                            #{sale.card.serialId} • {sale.card.isMainCharacter && "★ Главный персонаж"}
                          </div>
                          {(sale.card.frameModifier || sale.card.coatingModifier) && (
                            <div className="text-xs text-purple-400 mt-1">
                              {sale.card.frameModifier && `🖼️ ${sale.card.frameModifier} `}
                              {sale.card.coatingModifier && `✨ ${sale.card.coatingModifier}`}
                            </div>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-black text-green-400">{sale.price.toLocaleString()}</p>
                          <p className="text-xs text-slate-500">монет</p>
                          <p className="text-xs text-slate-500 mt-1">{saleDate}</p>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        )}

        {/* Analytics Tab */}
        {activeTab === "analytics" && analytics && (
          <div className="space-y-6">
            {/* Supply/Demand Overview */}
            <div className="bg-slate-900 border border-slate-700 rounded-xl p-6">
              <h2 className="text-xl font-black text-white mb-4">Спрос и предложение</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-lg font-bold text-cyan-400 mb-3">По редкостям</h3>
                  <div className="space-y-2">
                    {Object.entries(analytics.supply.byRarity).map(([rarity, supply]) => {
                      const demand = analytics.demand.byRarity[rarity] || 0
                      const ratio = analytics.ratios.byRarity[rarity] || 0
                      const config = rarityConfig[rarity as Rarity]
                      return (
                        <div key={rarity} className="bg-slate-800 rounded-lg p-3">
                          <div className="flex justify-between items-center mb-2">
                            <span className={`font-bold ${config.color}`}>{config.label}</span>
                            <span className={`text-sm ${ratio > 1 ? 'text-red-400' : ratio < 1 ? 'text-green-400' : 'text-yellow-400'}`}>
                              {ratio.toFixed(2)}x
                            </span>
                          </div>
                          <div className="flex justify-between text-xs text-slate-400">
                            <span>Предложение: {supply}</span>
                            <span>Спрос: {demand}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-purple-400 mb-3">По модификаторам рамок</h3>
                  <div className="space-y-2">
                    {Object.entries(analytics.supply.byFrameModifier).map(([modifier, supply]) => {
                      const demand = analytics.demand.byFrameModifier[modifier] || 0
                      const ratio = analytics.ratios.byFrameModifier[modifier] || 0
                      return (
                        <div key={modifier} className="bg-slate-800 rounded-lg p-3">
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-white font-bold">{modifier}</span>
                            <span className={`text-sm ${ratio > 1 ? 'text-red-400' : ratio < 1 ? 'text-green-400' : 'text-yellow-400'}`}>
                              {ratio.toFixed(2)}x
                            </span>
                          </div>
                          <div className="flex justify-between text-xs text-slate-400">
                            <span>Предложение: {supply}</span>
                            <span>Спрос: {demand}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Average Prices */}
            <div className="bg-slate-900 border border-slate-700 rounded-xl p-6">
              <h2 className="text-xl font-black text-white mb-4">Средние цены продаж</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {Object.entries(analytics.avgPrice).map(([rarity, avgPrice]) => {
                  const config = rarityConfig[rarity as Rarity]
                  return (
                    <div key={rarity} className={`bg-slate-800 rounded-lg p-3 ${config.bgColor}`}>
                      <p className={`font-bold ${config.color} mb-1`}>{config.label}</p>
                      <p className="text-xl font-black text-white">{Math.round(avgPrice).toLocaleString()}</p>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Period Info */}
            <div className="bg-slate-900 border border-slate-700 rounded-xl p-4">
              <p className="text-slate-400 text-sm">
                Период анализа: <span className="text-white font-bold">{analytics.period}</span>
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
