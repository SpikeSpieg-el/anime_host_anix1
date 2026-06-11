"use client"

import { useEffect } from "react"

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

interface DismantleConfirmPopupProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  cardName: string
  cardRarity: string
  dustAmount: number
  isLoading?: boolean
}

export function DismantleConfirmPopup({
  isOpen,
  onClose,
  onConfirm,
  cardName,
  cardRarity,
  dustAmount,
  isLoading = false
}: DismantleConfirmPopupProps) {
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
    <div className="z-[60]">
      <AlertDialog open={isOpen} onOpenChange={isLoading ? undefined : onClose}>
        <AlertDialogContent className="max-w-[90vw] sm:max-w-md bg-slate-900 border-slate-700 text-white">
        <AlertDialogHeader>
          <AlertDialogTitle className="sr-only">
            Распыление карты
          </AlertDialogTitle>
          <AlertDialogDescription className="sr-only">
            Подтверждение распыления карты {cardName} редкости {cardRarity} за {dustAmount} пыли
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
              {isLoading ? "Распыление..." : "Распыление карты"}
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
                  Вы уверены, что хотите распылить карту <span className="font-bold text-amber-400">{cardName}</span>?
                </p>
                <div className="p-3 bg-amber-500/10 rounded-lg border border-amber-500/30">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <span className="font-semibold text-amber-300">Награда за распыление</span>
                  </div>
                  <div className="space-y-1 text-sm">
                    <div>Редкость: <span className="text-white font-medium">{cardRarity}</span></div>
                    <div>Пыль: <span className="text-amber-400 font-bold text-lg">+{dustAmount}</span></div>
                  </div>
                </div>
                <p className="text-slate-400 text-sm">
                  ⚠️ Это действие нельзя отменить. Карта будет навсегда удалена из вашей коллекции.
                </p>
              </>
            ) : (
              <>
                <p className="text-slate-300 text-base leading-relaxed">
                  Распыление карты <span className="font-bold text-amber-400">{cardName}</span>...
                </p>
                
                <div className="space-y-3">
                  <div className="text-xs text-slate-400 text-center space-y-1">
                    <div className="font-medium">⏳ Пожалуйста, подождите завершения процесса...</div>
                    <div className="text-amber-300/70">🚫 Не закрывайте это окно до завершения</div>
                  </div>
                </div>
                
                <div className="p-3 bg-amber-500/10 rounded-lg border border-amber-500/30">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <span className="font-semibold text-amber-300">Ожидаемая награда</span>
                  </div>
                  <div className="space-y-1 text-sm">
                    <div>Редкость: <span className="text-white font-medium">{cardRarity}</span></div>
                    <div>Пыль: <span className="text-amber-400 font-bold text-lg">+{dustAmount}</span></div>
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
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                    Распыление...
                  </>
                ) : (
                  <>
                    <RefreshCcw className="w-4 h-4 mr-2" />
                    Распылить
                  </>
                )}
              </AlertDialogAction>
            </>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </div>
  )
}
