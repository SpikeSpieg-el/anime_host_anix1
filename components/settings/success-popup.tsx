"use client"

import { CheckCircle, X } from "lucide-react"
import { 
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction
} from "@/components/ui/alert-dialog"

interface SuccessPopupProps {
  isOpen: boolean
  onClose: () => void
  title: string
  message: string
  icon?: React.ReactNode
}

export function SuccessPopup({
  isOpen,
  onClose,
  title,
  message,
  icon
}: SuccessPopupProps) {
  return (
    <div className="z-[60]">
      <AlertDialog open={isOpen} onOpenChange={onClose}>
        <AlertDialogContent className="max-w-[90vw] sm:max-w-md bg-slate-900 border-slate-700 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="sr-only">
              {title}
            </AlertDialogTitle>
            <AlertDialogDescription className="sr-only">
              {message}
            </AlertDialogDescription>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-full border bg-green-500/20 border-green-500/30">
                {icon || <CheckCircle className="w-6 h-6 text-green-400" />}
              </div>
              <div className="text-xl font-bold text-white">
                {title}
              </div>
            </div>
            <div className="space-y-4">
              <p className="text-slate-300 text-base leading-relaxed">
                {message}
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
    </div>
  )
}
