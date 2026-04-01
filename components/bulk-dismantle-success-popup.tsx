"use client"

import { CheckCircle, Sparkles, X, Crown } from "lucide-react"
import { 
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction
} from "@/components/ui/alert-dialog"

interface BulkDismantleSuccessPopupProps {
  isOpen: boolean
  onClose: () => void
  cardsCount: number
  selectedRarity: string
  totalDustAmount: number
  newDustBalance?: number
  excludeMainCharacters?: boolean
}

export function BulkDismantleSuccessPopup({
  isOpen,
  onClose,
  cardsCount,
  selectedRarity,
  totalDustAmount,
  newDustBalance,
  excludeMainCharacters = false
}: BulkDismantleSuccessPopupProps) {
  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent className="max-w-md bg-slate-900 border-slate-700 text-white">
        <AlertDialogHeader>
          <AlertDialogTitle className="sr-only">
            Массовое распыление успешно!
          </AlertDialogTitle>
          <AlertDialogDescription className="sr-only">
            {cardsCount} карт редкости {selectedRarity} успешно распылены, получено {totalDustAmount} пыли
          </AlertDialogDescription>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-full border bg-green-500/20 border-green-500/30">
              <CheckCircle className="w-6 h-6 text-green-400" />
            </div>
            <div className="text-xl font-bold text-white">
              Массовое распыление успешно!
            </div>
          </div>
          <div className="space-y-4">
            <p className="text-slate-300 text-base leading-relaxed">
              <span className="font-bold text-green-400">{cardsCount}</span> карт(ы) редкости <span className="font-bold text-green-400">{selectedRarity}</span> успешно распылены!
            </p>
            
            {excludeMainCharacters && (
              <div className="p-3 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
                <div className="flex items-center gap-2 mb-1">
                  <Crown className="w-4 h-4 text-yellow-400" />
                  <span className="font-semibold text-yellow-300">Главные герои сохранены</span>
                </div>
                <div className="text-xs text-yellow-200">
                  Карты главных героев не были распылены
                </div>
              </div>
            )}
            
            <div className="p-3 bg-amber-500/10 rounded-lg border border-amber-500/30">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span className="font-semibold text-amber-300">Получено пыли</span>
              </div>
              <div className="space-y-1 text-sm">
                <div>За распыление: <span className="text-amber-400 font-bold text-lg">+{totalDustAmount.toLocaleString()}</span></div>
                {newDustBalance !== undefined && (
                  <div>Общий баланс: <span className="text-white font-medium">{newDustBalance.toLocaleString()}</span></div>
                )}
              </div>
            </div>
            <p className="text-slate-400 text-sm">
              ✨ Пыль можно использовать для создания новых карт в будущем!
            </p>
          </div>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction className="bg-green-600 hover:bg-green-700 text-white border-green-500">
            Отлично!
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
