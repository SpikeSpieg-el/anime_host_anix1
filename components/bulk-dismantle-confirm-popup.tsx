"use client"

import { AlertTriangle, Sparkles, X, RefreshCcw, Loader2 } from "lucide-react"
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
import { Rarity, rarityConfig } from "@/types/gacha"
import { useEffect } from "react"

interface BulkDismantleConfirmPopupProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  selectedRarity: Rarity | "all"
  cardsCount: number
  totalDustAmount: number
  isLoading?: boolean
  progress?: { processed: number; total: number }
}

export function BulkDismantleConfirmPopup({
  isOpen,
  onClose,
  onConfirm,
  selectedRarity,
  cardsCount,
  totalDustAmount,
  isLoading = false,
  progress
}: BulkDismantleConfirmPopupProps) {
  const getRarityText = (rarity: Rarity | "all"): string => {
    if (rarity === "all") return "Все редкости"
    return rarityConfig[rarity].label
  }

  const progressPercentage = progress ? Math.round((progress.processed / progress.total) * 100) : 0

  // Предотвращаем закрытие через ESC во время загрузки
  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isLoading) {
        event.preventDefault()
        event.stopPropagation()
      }
    }

    if (isLoading) {
      document.addEventListener('keydown', handleEscKey)
      return () => document.removeEventListener('keydown', handleEscKey)
    }
  }, [isLoading])

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => {
      if (!open || isLoading) {
        return;
      }
      onClose();
    }}>
      <AlertDialogContent className={`max-w-lg bg-slate-900 border-slate-700 text-white`}>
        <AlertDialogHeader>
          <AlertDialogTitle className="sr-only">
            {isLoading ? "Распыление..." : "Массовое распыление"}
          </AlertDialogTitle>
          <AlertDialogDescription className="sr-only">
            {isLoading ? `Распыление ${cardsCount} карт редкости ${getRarityText(selectedRarity)}` : `Подтверждение массового распыления ${cardsCount} карт редкости ${getRarityText(selectedRarity)} за ${totalDustAmount} пыли`}
          </AlertDialogDescription>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-full border bg-amber-500/20 border-amber-500/30">
              {isLoading ? (
                <Loader2 className="w-6 h-6 text-amber-400 animate-spin" />
              ) : (
                <RefreshCcw className="w-6 h-6 text-amber-400" />
              )}
            </div>
            <div className="text-xl font-bold text-white">
              {isLoading ? "Распыление..." : "Массовое распыление"}
            </div>
            {!isLoading && (
              <button
                onClick={onClose}
                className="ml-auto p-1 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="space-y-4">
            {!isLoading ? (
              <>
                <p className="text-slate-300 text-base leading-relaxed">
                  Вы уверены, что хотите распылить <span className="font-bold text-amber-400">{cardsCount}</span> карт(ы) редкости <span className="font-bold text-amber-400">{getRarityText(selectedRarity)}</span>?
                </p>
                <div className="p-3 bg-amber-500/10 rounded-lg border border-amber-500/30">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <span className="font-semibold text-amber-300">Общая награда за распыление</span>
                  </div>
                  <div className="space-y-1 text-sm">
                    <div>Количество карт: <span className="text-white font-medium">{cardsCount}</span></div>
                    <div>Общая пыль: <span className="text-amber-400 font-bold text-lg">+{totalDustAmount.toLocaleString()}</span></div>
                  </div>
                </div>
                <p className="text-slate-400 text-sm">
                  ⚠️ Это действие нельзя отменить. Все выбранные карты будут навсегда удалены из вашей коллекции.
                </p>
              </>
            ) : (
              <>
                <p className="text-slate-300 text-base leading-relaxed">
                  Распыление <span className="font-bold text-amber-400">{cardsCount}</span> карт(ы) редкости <span className="font-bold text-amber-400">{getRarityText(selectedRarity)}</span>...
                </p>
                
                {/* Progress Bar */}
                {progress && (
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm text-slate-300 font-medium">
                      <span>Прогресс: {progress.processed} / {progress.total}</span>
                      <span className="text-amber-400 font-bold">{progressPercentage}%</span>
                    </div>
                    <div className="w-full bg-slate-700 rounded-full h-4 overflow-hidden relative">
                      <div 
                        className="h-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all duration-300 ease-out relative"
                        style={{ width: `${progressPercentage}%` }}
                      >
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse" />
                        <div className="absolute right-0 top-0 bottom-0 w-2 bg-white/30 animate-pulse" />
                      </div>
                    </div>
                    <div className="text-xs text-slate-400 text-center space-y-1">
                      <div className="font-medium">⏳ Пожалуйста, подождите завершения процесса...</div>
                      <div className="text-amber-300/70">🚫 Не закрывайте это окно до завершения</div>
                    </div>
                  </div>
                )}
                
                <div className="p-3 bg-amber-500/10 rounded-lg border border-amber-500/30">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <span className="font-semibold text-amber-300">Ожидаемая награда</span>
                  </div>
                  <div className="space-y-1 text-sm">
                    <div>Количество карт: <span className="text-white font-medium">{cardsCount}</span></div>
                    <div>Пыль: <span className="text-amber-400 font-bold text-lg">+{totalDustAmount.toLocaleString()}</span></div>
                  </div>
                </div>
              </>
            )}
          </div>
        </AlertDialogHeader>
        <AlertDialogFooter>
          {!isLoading && (
            <>
              <AlertDialogCancel 
                className="bg-slate-700 hover:bg-slate-600 text-white border-slate-600"
                disabled={isLoading}
              >
                Отмена
              </AlertDialogCancel>
              <AlertDialogAction 
                onClick={onConfirm}
                className="bg-amber-600 hover:bg-amber-700 text-white border-amber-500"
                disabled={isLoading}
              >
                Распылить все
              </AlertDialogAction>
            </>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
