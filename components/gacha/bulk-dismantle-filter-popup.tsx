"use client"

import { Filter, X, Sparkles, Trash2, Crown } from "lucide-react"
import { 
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel
} from "@/components/ui/alert-dialog"
import { Rarity, rarityConfig, getDismantleValue } from "@/types/gacha"
import { Card } from "@/app/gacha/types"
import { useState } from "react"

interface BulkDismantleFilterPopupProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (selectedRarity: Rarity | "all", excludeMainCharacters: boolean) => void
  collectedCards: Card[]
  isLoading?: boolean
}

export function BulkDismantleFilterPopup({
  isOpen,
  onClose,
  onConfirm,
  collectedCards,
  isLoading = false
}: BulkDismantleFilterPopupProps) {
  const [excludeMainCharacters, setExcludeMainCharacters] = useState(false)

  const getCardsCountByRarity = (rarity: Rarity | "all", excludeMain: boolean = false): number => {
    let cards = rarity === "all" ? collectedCards : collectedCards.filter(card => card.rarity === rarity)
    if (excludeMain) {
      cards = cards.filter(card => !card.isMainCharacter)
    }
    return cards.length
  }

  const getTotalDustByRarity = (rarity: Rarity | "all", excludeMain: boolean = false): number => {
    let cards = rarity === "all" ? collectedCards : collectedCards.filter(card => card.rarity === rarity)
    if (excludeMain) {
      cards = cards.filter(card => !card.isMainCharacter)
    }
    return cards.reduce((total, card) => total + getDismantleValue(card.rarity), 0)
  }

  const handleConfirm = (rarity: Rarity | "all") => {
    onConfirm(rarity, excludeMainCharacters)
  }

  const rarities: (Rarity | "all")[] = [
    "all", "trash", "common", "uncommon", "rare", "super_rare", 
    "epic", "mythic", "legendary", "ancient", "divine", "transcendent", "omnipotent"
  ]

  const mainCharactersCount = collectedCards.filter(card => card.isMainCharacter).length

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent className="max-w-2xl bg-slate-900 border-slate-700 text-white max-h-[80vh] overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle className="sr-only">
            Массовое распыление карт
          </AlertDialogTitle>
          <AlertDialogDescription className="sr-only">
            Выберите редкость карт для массового распыления. Все выбранные карты будут удалены, а вы получите пыль.
          </AlertDialogDescription>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-full border bg-amber-500/20 border-amber-500/30">
              <Filter className="w-6 h-6 text-amber-400" />
            </div>
            <div className="text-xl font-bold text-white">
              Массовое распыление карт
            </div>
          </div>
          <div className="space-y-4">
            <p className="text-slate-300 text-base leading-relaxed">
              Выберите редкость карт для массового распыления. Все выбранные карты будут удалены, а вы получите пыль.
            </p>

            {/* Exclude Main Characters Checkbox */}
            {mainCharactersCount > 0 && (
              <div className="flex items-center gap-3 p-4 bg-yellow-500/10 rounded-xl border border-yellow-500/20">
                <input
                  type="checkbox"
                  id="exclude-main-characters"
                  checked={excludeMainCharacters}
                  onChange={(e) => setExcludeMainCharacters(e.target.checked)}
                  className="w-5 h-5 rounded border-2 border-yellow-600 bg-slate-900 text-yellow-500 focus:ring-2 focus:ring-yellow-500/50 focus:ring-offset-0 focus:ring-offset-slate-900 cursor-pointer"
                />
                <label htmlFor="exclude-main-characters" className="flex items-center gap-2 cursor-pointer flex-1">
                  <Crown className="w-4 h-4 text-yellow-400" />
                  <span className="text-sm font-bold text-white">Не распылять главных героев</span>
                  <span className="text-xs text-yellow-300">({mainCharactersCount} карт)</span>
                </label>
              </div>
            )}
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {rarities.map((rarity) => {
                const cardsCount = getCardsCountByRarity(rarity, excludeMainCharacters)
                const totalDust = getTotalDustByRarity(rarity, excludeMainCharacters)
                
                if (rarity === "all") {
                  return (
                    <button
                      key={rarity}
                      onClick={() => handleConfirm(rarity)}
                      disabled={cardsCount === 0 || isLoading}
                      className="p-4 rounded-xl border border-slate-600 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-left"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Trash2 className="w-4 h-4 text-red-400" />
                          <span className="font-bold text-white">Все редкости</span>
                        </div>
                        <Sparkles className="w-4 h-4 text-amber-400" />
                      </div>
                      <div className="text-sm space-y-1">
                        <div>Карт: <span className="text-white font-medium">{cardsCount}</span></div>
                        <div>Пыль: <span className="text-amber-400 font-semibold">+{totalDust.toLocaleString()}</span></div>
                        {excludeMainCharacters && cardsCount < collectedCards.length && (
                          <div className="text-xs text-yellow-300">Исключены главные герои</div>
                        )}
                      </div>
                    </button>
                  )
                }
                
                const config = rarityConfig[rarity]
                
                return (
                  <button
                    key={rarity}
                    onClick={() => handleConfirm(rarity)}
                    disabled={cardsCount === 0 || isLoading}
                    className="p-4 rounded-xl border border-slate-600 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-left"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className={`px-2 py-1 rounded-full text-xs font-bold bg-gradient-to-r ${config.color} text-white`}>
                        {config.label}
                      </div>
                      <Sparkles className="w-4 h-4 text-amber-400" />
                    </div>
                    <div className="text-sm space-y-1">
                      <div>Карт: <span className="text-white font-medium">{cardsCount}</span></div>
                      <div>Пыль: <span className="text-amber-400 font-semibold">+{totalDust.toLocaleString()}</span></div>
                      {excludeMainCharacters && cardsCount < collectedCards.filter(card => card.rarity === rarity).length && (
                        <div className="text-xs text-yellow-300">Исключены главные герои</div>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
            
            <p className="text-slate-400 text-sm">
              ⚠️ Это действие нельзя отменить. Все выбранные карты будут навсегда удалены из вашей коллекции.
            </p>
          </div>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel 
            className="bg-slate-700 hover:bg-slate-600 text-white border-slate-600"
            disabled={isLoading}
          >
            Отмена
          </AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
