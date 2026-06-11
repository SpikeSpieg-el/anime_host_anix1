"use client"

import { useState, useEffect } from "react"
import { Loader2, Store, TrendingUp, TrendingDown, Minus, BarChart3, History, Package, DollarSign, Eye, Filter, RefreshCw } from "lucide-react"
import { LineChart, Line, BarChart, Bar, PieChart, Pie, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from "recharts"
import type { Rarity } from "@/types/gacha"
import { frameNames, coatingNames } from "@/components/gacha/card-modifiers"
import { Footer } from "@/components/layout/footer"

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
    frameModifier?: string
    coatingModifier?: string
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
    imageUrl?: string
    characterId: number
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

const rarityConfig: Record<Rarity, { label: string; color: string; bgColor: string; glow: string }> = {
  trash: { label: "Мусор", color: "text-stone-400", bgColor: "bg-stone-900/50", glow: "shadow-stone-900/20" },
  common: { label: "Обычная", color: "text-slate-400", bgColor: "bg-slate-900/50", glow: "shadow-slate-900/20" },
  uncommon: { label: "Необычная", color: "text-emerald-400", bgColor: "bg-emerald-900/20", glow: "shadow-emerald-900/20" },
  rare: { label: "Редкая", color: "text-cyan-400", bgColor: "bg-cyan-900/20", glow: "shadow-cyan-900/20" },
  super_rare: { label: "Супер Редкая", color: "text-indigo-400", bgColor: "bg-indigo-900/20", glow: "shadow-indigo-900/20" },
  epic: { label: "Эпическая", color: "text-purple-400", bgColor: "bg-purple-900/20", glow: "shadow-purple-900/20" },
  mythic: { label: "Мифическая", color: "text-fuchsia-400", bgColor: "bg-fuchsia-900/20", glow: "shadow-fuchsia-900/20" },
  legendary: { label: "Легендарная", color: "text-pink-400", bgColor: "bg-pink-900/20", glow: "shadow-pink-900/20" },
  ancient: { label: "Древняя", color: "text-amber-400", bgColor: "bg-amber-900/20", glow: "shadow-amber-900/20" },
  divine: { label: "Божественная", color: "text-orange-400", bgColor: "bg-orange-900/20", glow: "shadow-orange-900/20" },
  transcendent: { label: "Трансцендентная", color: "text-red-400", bgColor: "bg-red-900/20", glow: "shadow-red-900/20" },
  omnipotent: { label: "Всемогущая", color: "text-yellow-300", bgColor: "bg-yellow-900/30", glow: "shadow-yellow-900/40" }
}

const getBrightColor = (rarity: string): string => {
  const brightColors: Record<string, string> = {
    trash: "#a8a29e",
    common: "#94a3b8",
    uncommon: "#34d399",
    rare: "#22d3ee",
    super_rare: "#818cf8",
    epic: "#c084fc",
    mythic: "#e879f9",
    legendary: "#f472b6",
    ancient: "#fbbf24",
    divine: "#fb923c",
    transcendent: "#f87171",
    omnipotent: "#facc15"
  }
  return brightColors[rarity] || "#94a3b8"
}

export default function MarketDashboardPage() {
  const [activeTab, setActiveTab] = useState<"listings" | "sales" | "analytics" | "price-analysis">("listings")
  const [listings, setListings] = useState<MarketListing[]>([])
  const [sales, setSales] = useState<MarketSale[]>([])
  const [analytics, setAnalytics] = useState<MarketAnalytics | null>(null)
  const [marketAnalysis, setMarketAnalysis] = useState<MarketAnalysis | null>(null)
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

      const [listingsRes, salesRes, analyticsRes, priceStatsRes] = await Promise.all([
        fetch('/api/market/listings?limit=100'),
        fetch('/api/market/sales-history?limit=50&days=30'),
        fetch('/api/market/analytics?days=30'),
        fetch('/api/market/price-stats')
      ])

      if (!listingsRes.ok) throw new Error('Не удалось загрузить лоты')
      if (!salesRes.ok) throw new Error('Не удалось загрузить историю продаж')
      if (!analyticsRes.ok) throw new Error('Не удалось загрузить аналитику')
      if (!priceStatsRes.ok) throw new Error('Не удалось загрузить статистику цен')

      const listingsData = await listingsRes.json()
      const salesData = await salesRes.json()
      const analyticsData = await analyticsRes.json()
      const priceStatsData = await priceStatsRes.json()

      setListings(listingsData.listings || [])
      setSales(salesData.sales || [])
      setAnalytics(analyticsData)
      setMarketAnalysis(priceStatsData)
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
    <div className="min-h-screen bg-[#020617] text-slate-200 selection:bg-cyan-500/30 selection:text-cyan-200">
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(15, 23, 42, 0.1);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(51, 65, 85, 0.5);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(71, 85, 105, 0.8);
        }
        @keyframes glow {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
        .animate-glow {
          animation: glow 3s ease-in-out infinite;
        }
      `}</style>

      <div className="p-4 md:p-8 lg:p-12 relative overflow-hidden">
        {/* Background blobs */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-cyan-500/5 blur-[120px] rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-purple-500/5 blur-[120px] rounded-full translate-y-1/2 -translate-x-1/2" />

        <div className="max-w-7xl mx-auto space-y-8 relative">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-cyan-500/10 rounded-xl border border-cyan-500/20 shadow-[0_0_20px_rgba(6,182,212,0.15)]">
                  <Store className="w-8 h-8 text-cyan-400" />
                </div>
                <div>
                  <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight flex items-center gap-2">
                    Market <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">Hub</span>
                  </h1>
                  <p className="text-slate-500 font-medium tracking-wide">Рыночек порешал • Глобальная статистика</p>
                </div>
              </div>
            </div>
            <button
              onClick={loadData}
              className="group relative px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl flex items-center justify-center gap-3 border border-slate-700 transition-all duration-300 active:scale-95 shadow-lg shadow-black/50"
            >
              <RefreshCw className="w-5 h-5 group-hover:rotate-180 transition-transform duration-500 text-cyan-400" />
              <span className="font-bold tracking-wide">Обновить данные</span>
            </button>
          </div>

          {/* Stats Overview */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            {[
              { icon: Package, color: "text-cyan-400", bg: "bg-cyan-500/10", border: "border-cyan-500/20", label: "Активные лоты", value: listings.length, sub: "шт." },
              { icon: History, color: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/20", label: "Продаж за месяц", value: sales.length, sub: "сделок" },
              { icon: DollarSign, color: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/20", label: "Оборот рынка", value: sales.reduce((sum, s) => sum + s.price, 0).toLocaleString(), sub: "монет" },
              { icon: TrendingUp, color: "text-green-400", bg: "bg-green-500/10", border: "border-green-500/20", label: "Средняя цена", value: (listings.length > 0 ? Math.round(listings.reduce((sum, l) => sum + l.price, 0) / listings.length) : 0).toLocaleString(), sub: "монет" }
            ].map((stat, i) => (
              <div key={i} className="group relative bg-[#0f172a]/40 backdrop-blur-xl border border-slate-800/60 rounded-3xl p-5 transition-all duration-300 hover:border-slate-700/80 hover:bg-[#0f172a]/60 shadow-xl">
                <div className={`inline-flex p-2.5 rounded-xl ${stat.bg} ${stat.border} mb-4 transition-transform group-hover:scale-110`}>
                  <stat.icon className={`w-6 h-6 ${stat.color}`} />
                </div>
                <div className="space-y-1">
                  <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">{stat.label}</p>
                  <div className="flex items-baseline gap-2">
                    <p className="text-2xl md:text-3xl font-black text-white">{stat.value}</p>
                    <span className="text-xs font-medium text-slate-600">{stat.sub}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Tabs - Glassmorphism segmented control */}
          <div className="p-1.5 bg-slate-900/50 backdrop-blur-xl border border-slate-800/80 rounded-2xl flex flex-wrap gap-1.5 shadow-2xl">
            {[
              { id: "listings", label: "Лоты", icon: Package, count: listings.length, color: "from-cyan-500 to-blue-600", shadow: "shadow-cyan-500/20" },
              { id: "sales", label: "Продажи", icon: History, count: sales.length, color: "from-purple-500 to-indigo-600", shadow: "shadow-purple-500/20" },
              { id: "analytics", label: "Аналитика", icon: BarChart3, color: "from-emerald-500 to-teal-600", shadow: "shadow-emerald-500/20" },
              { id: "price-analysis", label: "Анализ цен", icon: TrendingUp, color: "from-amber-500 to-orange-600", shadow: "shadow-amber-500/20" }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex-1 min-w-[140px] px-5 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-3 transition-all duration-300 relative overflow-hidden group ${
                  activeTab === tab.id 
                    ? `bg-gradient-to-br ${tab.color} text-white ${tab.shadow} shadow-lg scale-[1.02]` 
                    : "text-slate-500 hover:text-slate-300 hover:bg-slate-800/50"
                }`}
              >
                <tab.icon className={`w-4 h-4 transition-transform group-hover:scale-110 ${activeTab === tab.id ? "text-white" : "text-slate-400"}`} />
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span className={`px-2 py-0.5 rounded-full text-[10px] ${activeTab === tab.id ? "bg-white/20 text-white" : "bg-slate-800 text-slate-500"}`}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-2 px-4 bg-slate-900/30 border border-slate-800/50 rounded-2xl backdrop-blur-md">
            <div className="flex items-center gap-4 w-full sm:w-auto">
              <div className="p-1.5 bg-slate-800/50 rounded-lg text-slate-400">
                <Filter className="w-4 h-4" />
              </div>
              <p className="text-sm font-bold text-slate-400 hidden lg:block">Фильтровать по редкости:</p>
              <select
                value={filterRarity}
                onChange={(e) => setFilterRarity(e.target.value)}
                className="flex-1 sm:flex-none min-w-[180px] bg-[#0f172a] border border-slate-800 text-slate-200 rounded-xl px-4 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500/50 transition-all cursor-pointer hover:bg-slate-800"
              >
                <option value="all">Все редкости</option>
                {Object.entries(rarityConfig).map(([key, config]) => (
                  <option key={key} value={key}>{config.label}</option>
                ))}
              </select>
            </div>
            <div className="text-[10px] font-bold text-slate-600 uppercase tracking-widest hidden sm:block">
              Найдено: <span className="text-cyan-500">{activeTab === 'listings' ? filteredListings.length : filteredSales.length}</span> элементов
            </div>
          </div>

        {/* Listings Tab */}
        {activeTab === "listings" && (
          <div className="group/container relative">
            <div className="absolute inset-0 bg-cyan-500/5 blur-3xl rounded-full animate-glow" />
            <div className="relative bg-[#0f172a]/60 backdrop-blur-2xl border border-slate-800/80 rounded-[2.5rem] p-6 md:p-8 shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between mb-8">
                <div className="space-y-1">
                  <h2 className="text-2xl font-black text-white flex items-center gap-3 uppercase tracking-tight">
                    <div className="p-2 bg-cyan-500/20 rounded-lg">
                      <Package className="w-5 h-5 text-cyan-400" />
                    </div>
                    Активные предложения
                  </h2>
                  <p className="text-slate-500 text-sm font-medium tracking-wide">Рыночные лоты выставленные игроками</p>
                </div>
              </div>
              
              <div className="space-y-4 max-h-[700px] overflow-y-auto pr-3 custom-scrollbar">
                {filteredListings.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-24 text-slate-500 space-y-4 bg-slate-900/20 rounded-3xl border border-dashed border-slate-800">
                    <Package className="w-16 h-16 opacity-10" />
                    <p className="text-xl font-bold tracking-tight opacity-40 uppercase">Ничего не найдено</p>
                  </div>
                ) : (
                  filteredListings.map((listing) => {
                    const config = rarityConfig[listing.card.rarity]
                    return (
                      <div key={listing.listingId} className={`group relative bg-slate-900/40 hover:bg-slate-800/60 rounded-3xl p-5 border border-slate-800/80 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-${config.glow.split('-')[1]}/10`}>
                        <div className={`absolute inset-y-0 left-0 w-1.5 rounded-l-full ${config.bgColor.replace('/20', '')}`} />
                        
                        <div className="flex flex-col lg:flex-row justify-between items-center gap-6">
                          <div className="flex flex-col md:flex-row items-center gap-6 flex-1 w-full text-center md:text-left">
                            <div className="relative shrink-0">
                              <div className={`absolute inset-0 ${config.bgColor.replace('/20', '/40')} blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity`} />
                              <img 
                                src={listing.card.imageUrl || undefined} 
                                alt={listing.card.name}
                                className="w-20 h-20 md:w-24 md:h-24 object-cover rounded-2xl border-2 border-slate-800 shadow-xl relative"
                              />
                            </div>

                            <div className="flex-1 space-y-3 w-full">
                              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                                <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${config.bgColor} ${config.color} border border-${config.color.split('-')[1]}-500/20 shadow-lg ${config.glow}`}>
                                  {config.label}
                                </span>
                                <h3 className="text-xl font-black text-white tracking-tight">{listing.card.name}</h3>
                                <span className="text-slate-500 font-bold text-sm tracking-wide">• {listing.card.anime}</span>
                              </div>
                              
                              <div className="grid grid-cols-5 gap-1 max-w-sm mx-auto md:mx-0">
                                {[
                                  { label: "HP", value: listing.card.stats.hp, color: "text-red-400" },
                                  { label: "ATK", value: listing.card.stats.atk, color: "text-orange-400" },
                                  { label: "DEF", value: listing.card.stats.def, color: "text-blue-400" },
                                  { label: "SPD", value: listing.card.stats.spd, color: "text-emerald-400" },
                                  { label: "LUK", value: listing.card.stats.luck, color: "text-yellow-400" }
                                ].map((stat) => (
                                  <div key={stat.label} className="bg-slate-950/50 p-2 rounded-xl border border-slate-800/50 text-center">
                                    <p className="text-[8px] font-black text-slate-600 uppercase mb-0.5 tracking-tighter">{stat.label}</p>
                                    <p className={`text-xs font-black ${stat.color}`}>{stat.value}</p>
                                  </div>
                                ))}
                              </div>

                              <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
                                <div className="text-[10px] text-slate-500 font-black uppercase tracking-widest bg-slate-950/50 px-3 py-1 rounded-lg border border-slate-800/50">
                                  ID: {listing.card.serialId} {listing.card.isMainCharacter && <span className="text-amber-500 ml-1">★ MC</span>}
                                </div>
                                {(listing.card.frameModifier || listing.card.coatingModifier) && (
                                  <div className="flex gap-2">
                                    {listing.card.frameModifier && <span className="text-[10px] font-black uppercase tracking-widest bg-purple-500/10 text-purple-400 px-3 py-1 rounded-lg border border-purple-500/20">🖼️ {frameNames[listing.card.frameModifier] || listing.card.frameModifier}</span>}
                                    {listing.card.coatingModifier && <span className="text-[10px] font-black uppercase tracking-widest bg-blue-500/10 text-blue-400 px-3 py-1 rounded-lg border border-blue-500/20">✨ {coatingNames[listing.card.coatingModifier] || listing.card.coatingModifier}</span>}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-col items-center lg:items-end gap-3 min-w-[140px] w-full lg:w-auto p-6 lg:p-0 bg-slate-950/20 lg:bg-transparent rounded-3xl border lg:border-0 border-slate-800/50">
                            <div className="text-center lg:text-right space-y-0.5">
                              <p className="text-3xl md:text-4xl font-black text-yellow-400 tracking-tighter drop-shadow-[0_0_15px_rgba(250,204,21,0.2)]">
                                {listing.price.toLocaleString()}
                              </p>
                              <p className="text-[10px] text-slate-500 uppercase tracking-[0.3em] font-black">монет</p>
                            </div>
                            {listing.isMine && (
                              <div className="flex items-center gap-2 px-4 py-1.5 bg-cyan-500/10 text-cyan-400 rounded-full border border-cyan-500/20 text-[10px] font-black uppercase tracking-widest">
                                <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse" />
                                Ваш лот
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {/* Sales Tab */}
        {activeTab === "sales" && (
          <div className="group/container relative">
            <div className="absolute inset-0 bg-purple-500/5 blur-3xl rounded-full animate-glow" />
            <div className="relative bg-[#0f172a]/60 backdrop-blur-2xl border border-slate-800/80 rounded-[2.5rem] p-6 md:p-8 shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between mb-8">
                <div className="space-y-1">
                  <h2 className="text-2xl font-black text-white flex items-center gap-3 uppercase tracking-tight">
                    <div className="p-2 bg-purple-500/20 rounded-lg">
                      <History className="w-5 h-5 text-purple-400" />
                    </div>
                    История сделок
                  </h2>
                  <p className="text-slate-500 text-sm font-medium tracking-wide">Последние продажи на глобальном рынке</p>
                </div>
              </div>
              
              <div className="space-y-4 max-h-[700px] overflow-y-auto pr-3 custom-scrollbar">
                {filteredSales.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-24 text-slate-500 bg-slate-900/20 rounded-3xl border border-dashed border-slate-800">
                    <History className="w-16 h-16 opacity-10" />
                    <p className="text-xl font-bold tracking-tight opacity-40 uppercase">История пуста</p>
                  </div>
                ) : (
                  filteredSales.map((sale) => {
                    const config = rarityConfig[sale.card.rarity]
                    const saleDate = new Date(sale.soldAt).toLocaleString('ru-RU', { 
                      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' 
                    })
                    return (
                      <div key={sale.saleId} className="group relative bg-slate-900/40 hover:bg-slate-800/60 rounded-3xl p-5 border border-slate-800/80 transition-all duration-300">
                        <div className={`absolute inset-y-0 left-0 w-1.5 rounded-l-full ${config.bgColor.replace('/20', '')}`} />
                        
                        <div className="flex flex-col lg:flex-row justify-between items-center gap-6">
                          <div className="flex flex-col md:flex-row items-center gap-6 flex-1 w-full text-center md:text-left">
                            <div className="relative shrink-0">
                              <div className={`absolute inset-0 ${config.bgColor.replace('/20', '/40')} blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity`} />
                              <img 
                                src={sale.card.imageUrl || (sale.card.characterId ? `https://shikimori.one/system/characters/original/${sale.card.characterId}.jpg` : undefined)} 
                                alt={sale.card.name}
                                className="w-16 h-16 object-cover rounded-xl border border-slate-800 shadow-xl grayscale-[0.3] group-hover:grayscale-0 transition-all duration-300"
                                onError={(e) => {
                                  const img = e.target as HTMLImageElement;
                                  if (!img.src.includes('missing_character_original.png')) {
                                    img.src = "https://shikimori.one/assets/globals/missing_character_original.png";
                                  }
                                }}
                              />
                            </div>

                            <div className="flex-1 space-y-3 w-full">
                              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                                <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full ${config.bgColor} ${config.color}`}>
                                  {config.label}
                                </span>
                                <h3 className="text-lg font-black text-white tracking-tight">{sale.card.name}</h3>
                              </div>
                              
                              <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 text-xs font-bold uppercase tracking-widest text-slate-600">
                                <div className="flex items-center gap-2">
                                  <div className="w-1.5 h-1.5 bg-slate-700 rounded-full" />
                                  ID: {sale.card.serialId}
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className="w-1.5 h-1.5 bg-slate-700 rounded-full" />
                                  {sale.card.anime}
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-col items-center lg:items-end gap-2 w-full lg:w-auto pt-4 lg:pt-0 border-t lg:border-0 border-slate-800/50">
                            <div className="text-center lg:text-right">
                              <p className="text-2xl font-black text-emerald-400 tracking-tighter">
                                {sale.price.toLocaleString()}
                              </p>
                              <p className="text-[9px] text-slate-600 uppercase tracking-[0.2em] font-black">монет</p>
                            </div>
                            <div className="px-3 py-1 bg-slate-950/50 rounded-lg border border-slate-800 text-[10px] font-bold text-slate-500 font-mono tracking-tight">
                              {saleDate}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {/* Analytics Tab */}
        {activeTab === "analytics" && analytics && (
          <div className="space-y-8 pb-20">
            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Supply/Demand & Liquidity Chart */}
              <div className="group relative bg-[#0f172a]/60 backdrop-blur-2xl border border-slate-800/80 rounded-[2.5rem] p-6 md:p-8 shadow-2xl overflow-hidden">
                <div className="absolute inset-0 bg-cyan-500/5 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                <div className="relative">
                  <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-cyan-500/20 rounded-lg">
                        <BarChart3 className="w-5 h-5 text-cyan-400" />
                      </div>
                      <h2 className="text-xl font-black text-white uppercase tracking-tight">Спрос и Ликвидность</h2>
                    </div>
                  </div>
                  <div className="h-[350px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart 
                        data={['trash', 'common', 'uncommon', 'rare', 'super_rare', 'epic', 'mythic', 'legendary', 'ancient', 'divine', 'transcendent', 'omnipotent']
                          .filter(r => analytics.supply.byRarity[r] !== undefined || analytics.demand.byRarity[r] !== undefined)
                          .map(rarity => {
                            const supply = analytics.supply.byRarity[rarity] || 0;
                            const demand = analytics.demand.byRarity[rarity] || 0;
                            const ratio = analytics.ratios.byRarity[rarity] || 0;
                            return {
                              name: rarityConfig[rarity as Rarity]?.label.substring(0, 5) + '.' || rarity,
                              fullName: rarityConfig[rarity as Rarity]?.label || rarity,
                              supply,
                              demand,
                              liquidity: (1 / (ratio || 1)) * 100
                            };
                          })}
                        margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                        <XAxis dataKey="name" stroke="#475569" fontSize={10} tickLine={false} axisLine={false} />
                        <YAxis stroke="#475569" fontSize={10} tickLine={false} axisLine={false} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#020617', border: '1px solid #1e293b', borderRadius: '16px', fontSize: '12px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}
                          itemStyle={{ padding: '4px 0' }}
                          labelStyle={{ color: '#94a3b8', marginBottom: '8px', fontWeight: '800', textTransform: 'uppercase' }}
                          labelFormatter={(label, payload) => {
                            if (payload && payload.length > 0) return (payload[0].payload as any).fullName;
                            return label;
                          }}
                        />
                        <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ fontSize: '10px', paddingBottom: '30px', fontWeight: 'bold' }} />
                        <Bar dataKey="supply" name="Предложение (лоты)" fill="#06b6d4" radius={[6, 6, 0, 0]} barSize={20} />
                        <Bar dataKey="demand" name="Спрос (желаемое)" fill="#8b5cf6" radius={[6, 6, 0, 0]} barSize={20} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Rarity Distribution Pie Chart */}
              <div className="group relative bg-[#0f172a]/60 backdrop-blur-2xl border border-slate-800/80 rounded-[2.5rem] p-6 md:p-8 shadow-2xl overflow-hidden">
                <div className="absolute inset-0 bg-purple-500/5 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                <div className="relative">
                  <div className="flex items-center gap-3 mb-8">
                    <div className="p-2 bg-purple-500/20 rounded-lg">
                      <PieChart className="w-5 h-5 text-purple-400" />
                    </div>
                    <h2 className="text-xl font-black text-white uppercase tracking-tight">Доли рынка по редкости</h2>
                  </div>
                  <div className="h-[350px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={['trash', 'common', 'uncommon', 'rare', 'super_rare', 'epic', 'mythic', 'legendary', 'ancient', 'divine', 'transcendent', 'omnipotent']
                            .filter(r => (analytics.supply.byRarity[r] || 0) > 0)
                            .map(rarity => ({
                              name: rarityConfig[rarity as Rarity]?.label || rarity,
                              value: analytics.supply.byRarity[rarity],
                              color: getBrightColor(rarity)
                            }))}
                          cx="50%"
                          cy="50%"
                          labelLine={true}
                          label={({ percent, name, cx, cy, midAngle, innerRadius, outerRadius, value, index }) => {
                            const RADIAN = Math.PI / 180;
                            const radius = outerRadius * 1.2;
                            const x = cx + radius * Math.cos(-midAngle * RADIAN);
                            const y = cy + radius * Math.sin(-midAngle * RADIAN);
                            return (
                              <text 
                                x={x} 
                                y={y} 
                                fill="#f1f5f9" 
                                textAnchor={x > cx ? 'start' : 'end'} 
                                dominantBaseline="central"
                                className="text-[12px] font-black tracking-tight"
                              >
                                {`${name} (${(percent * 100).toFixed(0)}%)`}
                              </text>
                            );
                          }}
                          outerRadius="85%"
                          innerRadius="60%"
                          fill="#8884d8"
                          dataKey="value"
                          paddingAngle={4}
                        >
                          {['trash', 'common', 'uncommon', 'rare', 'super_rare', 'epic', 'mythic', 'legendary', 'ancient', 'divine', 'transcendent', 'omnipotent']
                            .filter(r => (analytics.supply.byRarity[r] || 0) > 0)
                            .map((rarity) => (
                              <Cell 
                                key={rarity} 
                                fill={getBrightColor(rarity)} 
                                stroke="#020617"
                                strokeWidth={3}
                              />
                            ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'rgba(2, 6, 23, 0.95)', 
                            backdropFilter: 'blur(8px)',
                            border: '1px solid rgba(30, 41, 59, 0.5)', 
                            borderRadius: '16px', 
                            fontSize: '14px',
                            fontWeight: '800',
                            boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)'
                          }}
                          itemStyle={{ color: '#fff' }}
                          formatter={(value, name) => [`${value} лотов`, name]}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>

            {/* Price Trends Bar Chart */}
            <div className="group relative bg-[#0f172a]/60 backdrop-blur-2xl border border-slate-800/80 rounded-[2.5rem] p-6 md:p-8 shadow-2xl overflow-hidden">
              <div className="absolute inset-0 bg-amber-500/5 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
              <div className="relative">
                <div className="flex items-center gap-3 mb-8">
                  <div className="p-2 bg-amber-500/20 rounded-lg">
                    <TrendingUp className="w-5 h-5 text-amber-400" />
                  </div>
                  <h2 className="text-xl font-black text-white uppercase tracking-tight">Средняя стоимость сегментов</h2>
                </div>
                <div className="h-[350px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart 
                      data={['trash', 'common', 'uncommon', 'rare', 'super_rare', 'epic', 'mythic', 'legendary', 'ancient', 'divine', 'transcendent', 'omnipotent']
                        .filter(r => (analytics.avgPrice[r] || 0) > 0)
                        .map(rarity => ({
                          name: rarityConfig[rarity as Rarity]?.label.substring(0, 5) + '.' || rarity,
                          fullName: rarityConfig[rarity as Rarity]?.label || rarity,
                          price: Math.round(analytics.avgPrice[rarity]),
                          rarity
                        }))}
                      margin={{ top: 10, right: 10, left: -10, bottom: 40 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                      <XAxis 
                        dataKey="name" 
                        stroke="#475569" 
                        fontSize={10} 
                        angle={-45} 
                        textAnchor="end" 
                        interval={0}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis stroke="#475569" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => val >= 1000 ? `${(val/1000).toFixed(1)}k` : val} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#020617', border: '1px solid #1e293b', borderRadius: '16px', fontSize: '12px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}
                        labelStyle={{ color: '#94a3b8', marginBottom: '8px', fontWeight: '800' }}
                        labelFormatter={(label, payload) => {
                          if (payload && payload.length > 0) return (payload[0].payload as any).fullName;
                          return label;
                        }}
                        formatter={(value: any) => [`${Number(value).toLocaleString()} монет`, 'Средняя цена']}
                      />
                      <Bar dataKey="price" fill="#eab308" radius={[8, 8, 0, 0]} barSize={35}>
                        {['trash', 'common', 'uncommon', 'rare', 'super_rare', 'epic', 'mythic', 'legendary', 'ancient', 'divine', 'transcendent', 'omnipotent']
                          .filter(r => (analytics.avgPrice[r] || 0) > 0)
                          .map((rarity, index) => (
                            <Cell key={`cell-${index}`} fill={getBrightColor(rarity)} fillOpacity={0.7} stroke={getBrightColor(rarity)} strokeWidth={2} />
                          ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Detailed Analytics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
              <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-800/80 rounded-[2rem] p-6 md:p-8">
                <div className="flex flex-col gap-1 mb-8">
                  <h3 className="text-xs uppercase tracking-[0.2em] font-black text-cyan-500 flex items-center gap-3">
                    <div className="w-2 h-2 bg-cyan-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(6,182,212,0.5)]" />
                    Анализ ликвидности
                  </h3>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Коэффициент востребованности (Ratio)</p>
                </div>
                <div className="space-y-4">
                  {['trash', 'common', 'uncommon', 'rare', 'super_rare', 'epic', 'mythic', 'legendary', 'ancient', 'divine', 'transcendent', 'omnipotent']
                    .filter(r => analytics.supply.byRarity[r] !== undefined)
                    .map((rarity) => {
                      const supply = analytics.supply.byRarity[rarity] || 0
                      const demand = analytics.demand.byRarity[rarity] || 0
                      const ratio = analytics.ratios.byRarity[rarity] || 0
                      const config = rarityConfig[rarity as Rarity]
                      return (
                        <div key={rarity} className="group bg-slate-950/40 hover:bg-slate-950/60 transition-all rounded-2xl p-4 border border-slate-800/50">
                          <div className="flex justify-between items-center mb-3">
                            <span className={`text-sm font-black uppercase tracking-tight ${config.color}`}>{config.label}</span>
                            <div className={`text-[10px] px-2 py-0.5 rounded-full font-black ${ratio > 1.5 ? 'bg-red-500/10 text-red-400 border border-red-500/20' : ratio < 0.6 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}`}>
                              {ratio.toFixed(2)}x {ratio > 1.2 ? 'Избыток' : ratio < 0.8 ? 'Дефицит' : 'Баланс'}
                            </div>
                          </div>
                          <div className="flex justify-between text-[9px] text-slate-500 font-black uppercase tracking-widest mb-2">
                            <span>На рынке: <span className="text-slate-200">{supply}</span></span>
                            <span>В поиске: <span className="text-slate-200">{demand}</span></span>
                          </div>
                          <div className="h-1.5 bg-slate-900 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full transition-all duration-1000 ${ratio > 1 ? 'bg-gradient-to-r from-red-500 to-orange-500' : 'bg-gradient-to-r from-emerald-500 to-teal-500'}`} 
                              style={{ width: `${Math.min(100, ratio * 40)}%` }}
                            />
                          </div>
                        </div>
                      )
                    })}
                </div>
              </div>

              <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-800/80 rounded-[2rem] p-6 md:p-8">
                <div className="flex flex-col gap-1 mb-8">
                  <h3 className="text-xs uppercase tracking-[0.2em] font-black text-purple-500 flex items-center gap-3">
                    <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(168,85,247,0.5)]" />
                    Модификаторы рынка
                  </h3>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Влияние эффектов на оборот</p>
                </div>
                <div className="space-y-4">
                  {Object.entries(analytics.supply.byFrameModifier).length === 0 ? (
                    <div className="py-24 text-center">
                      <Package className="w-12 h-12 text-slate-800 mx-auto mb-4 opacity-20" />
                      <p className="text-slate-600 font-bold uppercase tracking-widest text-xs">Данные отсутствуют</p>
                    </div>
                  ) : (
                    Object.entries(analytics.supply.byFrameModifier).map(([modifier, supply]) => {
                      const demand = analytics.demand.byFrameModifier[modifier] || 0
                      const ratio = analytics.ratios.byFrameModifier[modifier] || 0
                      return (
                        <div key={modifier} className="bg-slate-950/40 hover:bg-slate-950/60 transition-all rounded-2xl p-4 border border-slate-800/50">
                          <div className="flex justify-between items-center mb-3">
                            <span className="text-white text-sm font-black uppercase tracking-tight">{frameNames[modifier] || modifier}</span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-black ${ratio > 1.2 ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}>
                              {ratio.toFixed(2)}x
                            </span>
                          </div>
                          <div className="flex justify-between text-[9px] text-slate-500 font-black uppercase tracking-widest">
                            <span>Предл: <span className="text-slate-200">{supply}</span></span>
                            <span>Спрос: <span className="text-slate-200">{demand}</span></span>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            </div>

            <div className="text-center py-4 bg-slate-900/20 rounded-2xl border border-slate-800/40">
              <p className="text-[10px] text-slate-600 font-black uppercase tracking-[0.4em]">
                Аналитическая сводка за период: <span className="text-cyan-500">{analytics.period}</span>
              </p>
            </div>
          </div>
        )}

        {/* Price Analysis Tab */}
        {activeTab === "price-analysis" && marketAnalysis && (
          <div className="space-y-8 pb-20">
            {/* Статистика по редкостям - Elite Table UI */}
            <div className="group relative bg-[#0f172a]/60 backdrop-blur-2xl border border-slate-800/80 rounded-[2.5rem] p-6 md:p-8 shadow-2xl overflow-hidden">
              <div className="absolute inset-0 bg-amber-500/5 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
              <div className="relative">
                <div className="flex items-center gap-3 mb-8">
                  <div className="p-2 bg-amber-500/20 rounded-lg">
                    <TrendingUp className="w-5 h-5 text-amber-400" />
                  </div>
                  <h2 className="text-2xl font-black text-white uppercase tracking-tight">Биржевой мониторинг</h2>
                </div>
                
                <div className="overflow-x-auto -mx-6 md:mx-0 px-6 md:px-0">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 border-b border-slate-800/50">
                        <th className="text-left py-6 px-4">Класс редкости</th>
                        <th className="text-right py-6 px-4 hidden sm:table-cell">Предложение</th>
                        <th className="text-right py-6 px-4">Медианная цена</th>
                        <th className="text-right py-6 px-4 hidden md:table-cell text-slate-600">Ценовой коридор</th>
                        <th className="text-center py-6 px-4">Динамика</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/30">
                      {Object.entries(marketAnalysis.priceByRarity).map(([rarity, stats]) => {
                        const config = rarityConfig[rarity as Rarity]
                        const trend = getPriceTrend(stats.avgPrice, stats.priceRange.avg)
                        const TrendIcon = trend.icon

                        return (
                          <tr key={rarity} className="group/row hover:bg-white/[0.02] transition-colors">
                            <td className="py-6 px-4">
                              <div className="flex flex-col gap-1">
                                <span className={`font-black uppercase tracking-widest text-xs ${config.color} drop-shadow-[0_0_8px_rgba(255,255,255,0.1)]`}>{config.label}</span>
                                <span className="text-[9px] text-slate-600 font-bold uppercase tracking-tighter sm:hidden">{stats.count} активных</span>
                              </div>
                            </td>
                            <td className="text-right py-6 px-4 font-mono text-slate-400 hidden sm:table-cell font-bold">{stats.count}</td>
                            <td className="text-right py-6 px-4">
                              <div className="flex flex-col items-end gap-1">
                                <span className="text-lg font-black text-cyan-400 tracking-tighter">{stats.avgPrice.toLocaleString()}</span>
                                <div className="md:hidden flex items-center gap-2 text-[8px] font-bold text-slate-600 uppercase">
                                  <span>{stats.minPrice.toLocaleString()}</span>
                                  <div className="w-1 h-[1px] bg-slate-800" />
                                  <span>{stats.maxPrice.toLocaleString()}</span>
                                </div>
                              </div>
                            </td>
                            <td className="text-right py-6 px-4 hidden md:table-cell">
                              <div className="flex items-center justify-end gap-3">
                                <span className="text-[10px] font-black text-slate-600">{stats.minPrice.toLocaleString()}</span>
                                <div className="w-16 h-1 bg-slate-900 rounded-full relative overflow-hidden">
                                  <div className="absolute inset-y-0 left-1/4 right-1/4 bg-slate-700 rounded-full" />
                                </div>
                                <span className="text-[10px] font-black text-slate-600">{stats.maxPrice.toLocaleString()}</span>
                              </div>
                            </td>
                            <td className="text-center py-6 px-4">
                              <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border border-current/10 ${trend.color} bg-current/5`}>
                                <TrendIcon className="w-3.5 h-3.5" />
                                <span className="text-[9px] font-black uppercase tracking-widest hidden sm:inline">{trend.label}</span>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Топ персонажей - Liquid Assets UI */}
            <div className="bg-[#0f172a]/60 backdrop-blur-2xl border border-slate-800/80 rounded-[2.5rem] p-6 md:p-8 shadow-2xl overflow-hidden">
              <div className="flex items-center gap-3 mb-8">
                <div className="p-2 bg-blue-500/20 rounded-lg">
                  <Eye className="w-5 h-5 text-blue-400" />
                </div>
                <h2 className="text-2xl font-black text-white uppercase tracking-tight">Ликвидные активы</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {marketAnalysis.topCharacters.slice(0, 12).map((character, index) => (
                  <div key={character.characterId} className="group bg-slate-950/40 hover:bg-slate-950/80 transition-all duration-300 rounded-2xl p-4 border border-slate-800/50 flex flex-col gap-4 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                      <Store className="w-12 h-12 text-white" />
                    </div>
                    <div className="flex items-center gap-3 relative">
                      <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-sm font-black text-slate-600 border border-slate-800 transition-colors group-hover:border-cyan-500/50 group-hover:text-cyan-400">
                        {(index + 1).toString().padStart(2, '0')}
                      </div>
                      <div className="overflow-hidden">
                        <p className="text-sm font-black text-white truncate group-hover:text-cyan-400 transition-colors uppercase tracking-tight">{character.characterName}</p>
                        <p className="text-[9px] text-slate-600 font-black uppercase tracking-widest">{character.count} лотов</p>
                      </div>
                    </div>
                    <div className="pt-4 border-t border-slate-900/50 flex justify-between items-end relative">
                      <div className="space-y-0.5">
                        <p className="text-[8px] text-slate-600 font-black uppercase tracking-widest">Средняя цена</p>
                        <p className="text-lg font-black text-yellow-500 tracking-tighter">{Math.round(character.avgPrice).toLocaleString()}</p>
                      </div>
                      <TrendingUp className="w-4 h-4 text-emerald-500 opacity-40" />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Рекомендации - Pro Insights UI */}
            <div className="group relative bg-[#0f172a]/60 backdrop-blur-2xl border border-slate-800/80 rounded-[2.5rem] p-6 md:p-8 shadow-2xl overflow-hidden">
              <div className="absolute inset-0 bg-emerald-500/5 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
              <div className="relative">
                <div className="flex items-center gap-3 mb-8">
                  <div className="p-2 bg-emerald-500/20 rounded-lg">
                    <BarChart3 className="w-5 h-5 text-emerald-400" />
                  </div>
                  <h2 className="text-2xl font-black text-white uppercase tracking-tight">Pro Insights</h2>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    {[
                      { label: "Оптимизация формул", status: marketAnalysis.recommendations.simplifyFormula },
                      { label: "Коллекционный бонус", status: marketAnalysis.recommendations.removeCollectionBonus }
                    ].map((rec) => (
                      <div key={rec.label} className="flex items-center justify-between p-4 bg-slate-950/40 rounded-2xl border border-slate-800/50 group/item">
                        <span className="text-xs font-black uppercase tracking-widest text-slate-400 group-hover/item:text-slate-200 transition-colors">{rec.label}</span>
                        <div className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all ${rec.status ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.1)]' : 'bg-red-500/10 text-red-400 border-red-500/20 opacity-50'}`}>
                          {rec.status ? 'Оптимизировано' : 'Рекомендовано'}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { label: "Stat Multiplier", value: marketAnalysis.recommendations.adjustStatMultiplier, color: "text-cyan-400" },
                      { label: "Base Multiplier", value: marketAnalysis.recommendations.baseMultiplier, color: "text-purple-400" }
                    ].map((val) => (
                      <div key={val.label} className="bg-slate-950/40 p-5 rounded-2xl border border-slate-800/50 flex flex-col items-center justify-center gap-2">
                        <span className="text-[8px] font-black text-slate-600 uppercase tracking-[0.2em] text-center">{val.label}</span>
                        <span className={`text-2xl font-black ${val.color} tracking-tighter`}>{val.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        </div>
      </div>

      <Footer />
    </div>
  )
}
