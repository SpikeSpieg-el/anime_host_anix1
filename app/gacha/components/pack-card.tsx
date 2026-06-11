import React from "react"
import { Package, Coins, Star } from "lucide-react"
import { AnimePack } from "@/lib/gacha-packs"
import { Rarity, rarityConfig } from "@/types/gacha"

interface PackCardProps {
  pack: AnimePack
  onSelect: (pack: AnimePack) => void
  userCoins: number
}

export const PackCard = ({ pack, onSelect, userCoins }: PackCardProps) => (
  <div 
    onClick={() => onSelect(pack)}
    className={`relative group cursor-pointer rounded-2xl sm:rounded-3xl overflow-hidden border border-white/10 p-5 sm:p-6 transition-all duration-300 hover:scale-[1.03] hover:border-indigo-500/50 hover:shadow-2xl hover:shadow-indigo-500/20 ${userCoins < pack.price ? 'opacity-50 cursor-not-allowed grayscale-[0.5]' : ''}`}
    style={{
      backgroundImage: pack.bgImage ? `linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.8)), url(${pack.bgImage})` : undefined,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    }}
  >
    {!pack.bgImage && (
      <div className={`absolute inset-0 bg-gradient-to-br ${pack.color} opacity-80 group-hover:opacity-100 transition-opacity`} />
    )}
    <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors duration-300" />
    
    <div className="relative z-10 h-full flex flex-col">
      <div className="flex items-start justify-between mb-4">
        <div className="p-2 sm:p-2.5 bg-white/10 backdrop-blur-md rounded-xl border border-white/20">
          <Package className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
        </div>
        <div className="flex items-center gap-1.5 bg-slate-900/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 shadow-lg">
          <Coins className="w-4 h-4 text-yellow-400" />
          <span className="text-sm font-black text-white">{pack.price}</span>
        </div>
      </div>
      
      <div className="mt-auto">
        <h3 className="text-xl sm:text-2xl font-black text-white mb-2 leading-tight">{pack.name}</h3>
        <p className="text-sm text-white/70 mb-4 line-clamp-2">{pack.description}</p>
        
        {pack.guaranteedRarity && (
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-indigo-500/20 backdrop-blur-md border border-indigo-500/30">
            <Star className="w-3.5 h-3.5 text-indigo-300" />
            <span className="text-xs font-bold text-indigo-200 tracking-wide uppercase">
              Гарант: {rarityConfig[pack.guaranteedRarity as Rarity].label} <span className="text-indigo-300/70 font-normal">(1 из 10)</span>
            </span>
          </div>
        )}
        
        {userCoins < pack.price && (
          <div className="mt-4 text-xs bg-red-500/20 text-red-300 px-3 py-1.5 rounded-lg border border-red-500/30 font-bold inline-block">Недостаточно монет</div>
        )}
      </div>
    </div>
  </div>
)
