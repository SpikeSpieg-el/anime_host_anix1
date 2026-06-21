"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import Image from "next/image"
import { X, Check, RefreshCcw, Loader2, Move } from "lucide-react"
import type { Card } from "@/app/gacha/types"
import { getProxiedSrc, isPinterestUrl } from "@/app/gacha/utils"
import { useAuth } from "@/components/auth/auth-provider"

interface ArtPositionModalProps {
  card: Card | null
  onClose: () => void
  onPositionChanged: (artPosition: { x: number; y: number }) => void
}

export function ArtPositionModal({ card, onClose, onPositionChanged }: ArtPositionModalProps) {
  const { session } = useAuth()
  const [position, setPosition] = useState({ x: 50, y: 50 })
  const [isDragging, setIsDragging] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const previewRef = useRef<HTMLDivElement>(null)
  const dragStartRef = useRef<{ startX: number; startY: number; posX: number; posY: number } | null>(null)

  useEffect(() => {
    if (card) {
      setPosition(card.artPosition || { x: 50, y: 50 })
    }
  }, [card])

  const handleMouseDown = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    dragStartRef.current = {
      startX: clientX,
      startY: clientY,
      posX: position.x,
      posY: position.y
    }
  }, [position])

  useEffect(() => {
    if (!isDragging) return

    const handleMove = (clientX: number, clientY: number) => {
      if (!dragStartRef.current || !previewRef.current) return
      const rect = previewRef.current.getBoundingClientRect()
      const deltaX = clientX - dragStartRef.current.startX
      const deltaY = clientY - dragStartRef.current.startY
      const xPercent = Math.max(0, Math.min(100, dragStartRef.current.posX + (deltaX / rect.width) * 100))
      const yPercent = Math.max(0, Math.min(100, dragStartRef.current.posY + (deltaY / rect.height) * 100))
      setPosition({ x: xPercent, y: yPercent })
    }

    const handleMouseMove = (e: MouseEvent) => handleMove(e.clientX, e.clientY)
    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault()
      handleMove(e.touches[0].clientX, e.touches[0].clientY)
    }
    const handleEnd = () => {
      setIsDragging(false)
      dragStartRef.current = null
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleEnd)
    window.addEventListener('touchmove', handleTouchMove, { passive: false })
    window.addEventListener('touchend', handleEnd)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleEnd)
      window.removeEventListener('touchmove', handleTouchMove)
      window.removeEventListener('touchend', handleEnd)
    }
  }, [isDragging])

  const handleReset = () => {
    setPosition({ x: 50, y: 50 })
  }

  const handleConfirm = async () => {
    if (!card) return

    setIsSaving(true)
    setError(null)

    try {
      if (session?.user) {
        if (!session?.access_token) {
          setError("Сессия недоступна")
          setIsSaving(false)
          return
        }

        const response = await fetch("/api/card/update-art-position", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            uniqueId: card.uniqueId,
            artPosition: position,
          }),
        })

        const data = await response.json()

        if (!response.ok) {
          setError(data.message || "Ошибка сохранения позиции")
          setIsSaving(false)
          return
        }
      }

      setSuccess(true)
      setTimeout(() => {
        onPositionChanged(position)
        onClose()
      }, 800)
    } catch (err) {
      console.error("Art position error:", err)
      setError("Ошибка при сохранении позиции")
    } finally {
      setIsSaving(false)
    }
  }

  if (!card) return null

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-6 bg-slate-950/90 backdrop-blur-xl animate-in fade-in duration-200 overflow-y-auto"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 sm:top-6 right-4 sm:right-6 p-2.5 sm:p-3 rounded-full bg-white/5 hover:bg-white/10 text-white transition-colors border border-white/10 z-50"
      >
        <X className="w-5 h-5 sm:w-6 sm:h-6" />
      </button>

      <div
        className="flex flex-col items-center justify-center min-h-full py-12 w-full max-w-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-tight mb-2 flex items-center gap-3">
          <Move className="w-6 h-6 sm:w-8 sm:h-8 text-cyan-400" />
          Позиция арта
        </h2>

        <p className="text-slate-400 text-sm mb-6 text-center">
          Перетащите арт внутри рамки, чтобы выбрать нужную область отображения
        </p>

        {/* Preview with draggable image */}
        <div
          ref={previewRef}
          className="relative aspect-[2/3] w-64 sm:w-72 rounded-2xl overflow-hidden border-2 border-cyan-500/50 bg-slate-900 cursor-grab active:cursor-grabbing select-none"
          onMouseDown={handleMouseDown}
          onTouchStart={handleMouseDown}
        >
          <Image
            src={getProxiedSrc(card.imageUrl)}
            alt={card.name}
            fill
            className="object-cover pointer-events-none"
            sizes="(max-width: 640px) 256px, 288px"
            quality={70}
            referrerPolicy="no-referrer"
            unoptimized={isPinterestUrl(card.imageUrl)}
            style={{ objectPosition: `${position.x}% ${position.y}%` }}
          />
          {/* Grid overlay */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute left-1/3 top-0 bottom-0 w-px bg-white/10" />
            <div className="absolute left-2/3 top-0 bottom-0 w-px bg-white/10" />
            <div className="absolute top-1/3 left-0 right-0 h-px bg-white/10" />
            <div className="absolute top-2/3 left-0 right-0 h-px bg-white/10" />
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 border-2 border-cyan-400/60 rounded-full" />
          </div>
          {/* Position indicator */}
          <div className="absolute bottom-2 left-2 px-2 py-1 rounded bg-black/60 backdrop-blur-sm text-[10px] font-mono text-cyan-300 pointer-events-none">
            X: {Math.round(position.x)}% Y: {Math.round(position.y)}%
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="w-full px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm font-bold mb-4 text-center mt-4">
            {error}
          </div>
        )}

        {/* Success Message */}
        {success && (
          <div className="w-full px-4 py-3 rounded-xl bg-green-500/10 border border-green-500/30 text-green-400 text-sm font-bold mb-4 text-center flex items-center justify-center gap-2 mt-4">
            <Check className="w-5 h-5" />
            Позиция сохранена!
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 w-full mt-6">
          <button
            onClick={handleReset}
            disabled={isSaving}
            className="px-4 py-2.5 sm:px-5 sm:py-3 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white font-bold text-xs sm:text-sm flex items-center gap-2 transition-colors border border-slate-700"
          >
            <RefreshCcw className="w-4 h-4" />
            Сброс
          </button>

          <button
            onClick={handleConfirm}
            disabled={isSaving}
            className="px-4 py-2.5 sm:px-5 sm:py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-bold text-xs sm:text-sm flex items-center gap-2 transition-colors"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Сохранение...
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                Сохранить
              </>
            )}
          </button>

          <button
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2.5 sm:px-5 sm:py-3 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white font-bold text-xs sm:text-sm flex items-center gap-2 transition-colors border border-slate-700"
          >
            <X className="w-4 h-4" />
            Отмена
          </button>
        </div>
      </div>
    </div>
  )
}
