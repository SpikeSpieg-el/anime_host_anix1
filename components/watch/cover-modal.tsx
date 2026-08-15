"use client"

import { useState } from "react"
import Image from "next/image"
import { X } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

interface CoverModalProps {
  isOpen: boolean
  onClose: () => void
  imageUrl: string
  title: string
  subtitle?: string
}

export function CoverModal({
  isOpen,
  onClose,
  imageUrl,
  title,
  subtitle,
}: CoverModalProps) {
  const [imageLoaded, setImageLoaded] = useState(false)

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="max-w-[100vw] w-screen h-[100dvh] p-0 bg-black/90 sm:bg-black/85 backdrop-blur-md border-none shadow-none flex flex-col items-center justify-center z-[110] outline-none select-none"
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">Обложка аниме {title}</DialogTitle>
        <DialogDescription className="sr-only">
          Просмотр обложки для {title}
        </DialogDescription>

        {/* Верхняя плашка с заголовком и кнопкой закрытия */}
        <div className="absolute top-0 left-0 right-0 z-50 p-4 sm:p-6 flex items-center justify-between bg-gradient-to-b from-black/80 via-black/40 to-transparent pointer-events-none">
          <div className="flex flex-col max-w-[80%]">
            <h3 className="text-sm sm:text-base font-bold text-white/95 line-clamp-1 drop-shadow-md">
              {title}
            </h3>
            {subtitle && (
              <p className="text-xs text-white/60 line-clamp-1">
                {subtitle}
              </p>
            )}
          </div>

          <button
            onClick={onClose}
            aria-label="Закрыть"
            className="pointer-events-auto p-2 sm:p-2.5 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-white/90 hover:text-white transition-all backdrop-blur-md border border-white/10"
          >
            <X className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </div>

        {/* Контейнер обложки на весь экран (80% высоты/ширины экрана) */}
        <div 
          className="relative w-full h-full flex items-center justify-center p-2 sm:p-4 cursor-pointer"
          onClick={onClose}
        >
          <div
            className="relative w-full h-[80dvh] max-w-[90vw] sm:max-w-[80vw] flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            {imageUrl ? (
              <div className="relative w-full h-full flex items-center justify-center">
                <Image
                  src={imageUrl}
                  alt={title}
                  fill
                  className={cn(
                    "object-contain rounded-xl sm:rounded-2xl shadow-2xl border border-white/15 ring-1 ring-white/10 transition-all duration-300",
                    imageLoaded ? "opacity-100 scale-100" : "opacity-0 scale-95"
                  )}
                  sizes="(max-width: 640px) 90vw, 80vw"
                  priority
                  quality={85}
                  onLoad={() => setImageLoaded(true)}
                />
              </div>
            ) : null}

            {!imageLoaded && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-8 h-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
