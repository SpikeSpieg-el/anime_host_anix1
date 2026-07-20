import React, { useState, useEffect } from "react"
import Image from "next/image"
import { X, Wand2, CheckSquare, Square } from "lucide-react"
import { Card } from "../types"
import { DECK_SIZE, ROLE_CONFIG, PROVISION_LIMIT } from "../config"
import { getCardProvision, getCardBasePower } from "../utils"
import { rarityConfig } from "@/types/gacha"
import { getProxiedSrc } from "@/lib/image-loader"

interface AutoBuildConfirmModalProps {
  isOpen: boolean
  onClose: () => void
  selectedCards: Card[]
  onConfirm: (keepIds: string[]) => void
}

export const AutoBuildConfirmModal: React.FC<AutoBuildConfirmModalProps> = ({
  isOpen,
  onClose,
  selectedCards,
  onConfirm,
}) => {
  const [keepIds, setKeepIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (isOpen) {
      setKeepIds(new Set(selectedCards.map(c => c.uniqueId)))
    }
  }, [isOpen, selectedCards])

  if (!isOpen) return null

  const allKept = keepIds.size === selectedCards.length

  const toggleAll = () => {
    setKeepIds(allKept ? new Set() : new Set(selectedCards.map(c => c.uniqueId)))
  }

  const toggleCard = (uniqueId: string) => {
    const next = new Set(keepIds)
    if (next.has(uniqueId)) next.delete(uniqueId)
    else next.add(uniqueId)
    setKeepIds(next)
  }

  const keptProvision = selectedCards
    .filter(c => keepIds.has(c.uniqueId))
    .reduce((acc, c) => acc + (c.provisionCost || getCardProvision(c)), 0)

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-xl animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-[#0a0a0f]/95 border border-white/10 rounded-[2rem] p-6 max-w-2xl w-full max-h-[85vh] flex flex-col shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4 shrink-0 gap-4">
          <div>
            <h2 className="text-2xl font-black text-white">Автосборка колоды</h2>
            <p className="text-sm text-slate-400 mt-1 leading-relaxed">
              Текущая колода будет пересобрана. Отметьте карты, которые хотите{" "}
              <span className="text-emerald-400 font-bold">оставить</span> — остальные заменит автоподбор.
            </p>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 p-2.5 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex items-center justify-between mb-3 shrink-0">
          <button
            onClick={toggleAll}
            className="flex items-center gap-2 text-sm font-bold text-slate-300 hover:text-white transition-colors"
          >
            {allKept ? <CheckSquare className="w-5 h-5 text-indigo-400" /> : <Square className="w-5 h-5 text-slate-500" />}
            {allKept ? "Снять все" : "Выбрать все"}
          </button>
          <span className={`text-xs font-bold ${keptProvision > PROVISION_LIMIT ? 'text-rose-400' : 'text-emerald-400'}`}>
            Вес выбранных: {keptProvision} / {PROVISION_LIMIT}
          </span>
        </div>

        <div className="overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent flex-1 space-y-2 mb-4">
          {selectedCards.length === 0 && (
            <p className="text-slate-500 text-sm text-center py-8">Колода пуста</p>
          )}
          {selectedCards.map((card) => {
            const isKept = keepIds.has(card.uniqueId)
            const config = rarityConfig[card.rarity] || { color: "from-slate-500 to-slate-700", label: "Обычная" }
            const role = card.role || "vanguard"
            const roleConf = ROLE_CONFIG[role] || ROLE_CONFIG.vanguard
            const provision = card.provisionCost || getCardProvision(card)

            return (
              <div
                key={card.uniqueId}
                onClick={() => toggleCard(card.uniqueId)}
                className={`flex items-center gap-3 p-2.5 rounded-xl border cursor-pointer transition-all ${
                  isKept
                    ? "bg-indigo-500/10 border-indigo-500/50"
                    : "bg-white/[0.02] border-white/5 hover:bg-white/[0.05]"
                }`}
              >
                <div className="shrink-0">
                  {isKept ? (
                    <CheckSquare className="w-5 h-5 text-indigo-400" />
                  ) : (
                    <Square className="w-5 h-5 text-slate-500" />
                  )}
                </div>
                <div className="relative w-10 aspect-[2/3] shrink-0 rounded-lg overflow-hidden">
                  <Image
                    src={getProxiedSrc(card.imageUrl)}
                    alt={card.name}
                    unoptimized={true}
                    fill
                    className="object-cover"
                    sizes="40px"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black text-white truncate">{card.name}</p>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] font-bold text-slate-400">
                    <span className={`bg-gradient-to-r ${config.color} bg-clip-text text-transparent`}>
                      {config.label}
                    </span>
                    <span className={roleConf.color}>{roleConf.name}</span>
                    <span className="text-indigo-400">{provision} вес</span>
                    <span className="text-amber-400">{getCardBasePower(card)} сила</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <div className="shrink-0 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 font-black uppercase tracking-wider transition-all active:scale-95"
          >
            Отмена
          </button>
          <button
            onClick={() => onConfirm(Array.from(keepIds))}
            className="flex-[2] py-3.5 bg-violet-500/15 hover:bg-violet-500/25 text-violet-300 border border-violet-500/30 font-black uppercase tracking-wider rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2"
          >
            <Wand2 className="w-5 h-5" />
            Заменить остальные ({Math.max(0, DECK_SIZE - keepIds.size)})
          </button>
        </div>
      </div>
    </div>
  )
}
