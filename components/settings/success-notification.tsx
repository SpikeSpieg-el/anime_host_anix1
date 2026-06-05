"use client"

import { useEffect, useState } from "react"
import { CheckCircle, X } from "lucide-react"
import { cn } from "@/lib/utils"

interface SuccessNotificationProps {
  isOpen: boolean
  onClose: () => void
  title: string
  message: string
  icon?: React.ReactNode
}

export function SuccessNotification({
  isOpen,
  onClose,
  title,
  message,
  icon
}: SuccessNotificationProps) {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true)
      const timer = setTimeout(() => {
        setIsVisible(false)
        setTimeout(onClose, 300)
      }, 4000)
      return () => clearTimeout(timer)
    }
  }, [isOpen, onClose])

  if (!isOpen && !isVisible) return null

  return (
    <div className={cn(
      "fixed top-4 right-4 z-[100] max-w-sm transition-all duration-300",
      isVisible ? "opacity-100 translate-x-0" : "opacity-0 translate-x-full"
    )}>
      <div className="bg-slate-900 border border-green-500/30 rounded-lg shadow-lg p-4">
        <div className="flex items-start gap-3">
          <div className="p-1.5 rounded-full bg-green-500/20 border border-green-500/30 flex-shrink-0">
            {icon || <CheckCircle className="w-5 h-5 text-green-400" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-white text-sm mb-1">
              {title}
            </div>
            <div className="text-slate-300 text-xs leading-relaxed">
              {message}
            </div>
          </div>
          <button
            onClick={() => {
              setIsVisible(false)
              setTimeout(onClose, 300)
            }}
            className="flex-shrink-0 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
