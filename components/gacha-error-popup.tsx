"use client"

import { AlertTriangle, Package, X, Info } from "lucide-react"
import { 
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction
} from "@/components/ui/alert-dialog"

interface GachaErrorPopupProps {
  isOpen: boolean
  onClose: () => void
  title: string
  message: string
  type?: "error" | "warning" | "info"
  packName?: string
  collectedCount?: number
  availableCount?: number
  totalCharacters?: number
}

export function GachaErrorPopup({
  isOpen,
  onClose,
  title,
  message,
  type = "error",
  packName,
  collectedCount,
  availableCount,
  totalCharacters
}: GachaErrorPopupProps) {
  const getIcon = () => {
    switch (type) {
      case "warning":
        return <AlertTriangle className="w-6 h-6 text-yellow-400" />
      case "info":
        return <Info className="w-6 h-6 text-blue-400" />
      default:
        return <AlertTriangle className="w-6 h-6 text-red-400" />
    }
  }

  const getIconBg = () => {
    switch (type) {
      case "warning":
        return "bg-yellow-500/20 border-yellow-500/30"
      case "info":
        return "bg-blue-500/20 border-blue-500/30"
      default:
        return "bg-red-500/20 border-red-500/30"
    }
  }

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent className="max-w-md bg-slate-900 border-slate-700 text-white">
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className={`p-2 rounded-full border ${getIconBg()}`}>
              {getIcon()}
            </div>
            <AlertDialogTitle className="text-xl font-bold text-white">
              {title}
            </AlertDialogTitle>
          </div>
          <div className="space-y-4">
            <p className="text-slate-300 text-base leading-relaxed">
              {message}
            </p>
            {packName && collectedCount !== undefined && availableCount !== undefined && totalCharacters !== undefined && (
              <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-600/50">
                <div className="flex items-center gap-2 mb-2">
                  <Package className="w-4 h-4 text-indigo-400" />
                  <span className="font-semibold text-indigo-300">Статистика пака "{packName}"</span>
                </div>
                <div className="space-y-1 text-sm text-slate-400">
                  <div>Собрано персонажей: <span className="text-white font-medium">{collectedCount}</span></div>
                  <div>Доступно персонажей: <span className="text-green-400 font-medium">{availableCount}</span></div>
                  <div>Всего персонажей в паке: <span className="text-slate-300 font-medium">{totalCharacters}</span></div>
                  <div>Прогресс коллекции: <span className="text-yellow-400 font-medium">{Math.round((collectedCount / totalCharacters) * 100)}%</span></div>
                </div>
              </div>
            )}
          </div>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction className="bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-500">
            Понятно
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
