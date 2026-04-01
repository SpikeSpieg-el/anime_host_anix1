"use client"

import { CheckCircle, Sparkles, X } from "lucide-react"
import { 
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction
} from "@/components/ui/alert-dialog"

interface DismantleSuccessPopupProps {
  isOpen: boolean
  onClose: () => void
  cardName: string
  dustAmount: number
  newDustBalance?: number
}

export function DismantleSuccessPopup({
  isOpen,
  onClose,
  cardName,
  dustAmount,
  newDustBalance
}: DismantleSuccessPopupProps) {
  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent className="max-w-md bg-slate-900 border-slate-700 text-white">
        <AlertDialogHeader>
          <AlertDialogTitle className="sr-only">
            Распыление успешно!
          </AlertDialogTitle>
          <AlertDialogDescription className="sr-only">
            Карта {cardName} успешно распылена, получено {dustAmount} пыли
          </AlertDialogDescription>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-full border bg-green-500/20 border-green-500/30">
              <CheckCircle className="w-6 h-6 text-green-400" />
            </div>
            <div className="text-xl font-bold text-white">
              Распыление успешно!
            </div>
          </div>
          <div className="space-y-4">
            <p className="text-slate-300 text-base leading-relaxed">
              Карта <span className="font-bold text-green-400">{cardName}</span> успешно распылена!
            </p>
            <div className="p-3 bg-amber-500/10 rounded-lg border border-amber-500/30">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span className="font-semibold text-amber-300">Получено пыли</span>
              </div>
              <div className="space-y-1 text-sm">
                <div>За распыление: <span className="text-amber-400 font-bold text-lg">+{dustAmount}</span></div>
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
