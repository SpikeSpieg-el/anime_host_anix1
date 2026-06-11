"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { X, RefreshCcw, Sparkles, Loader2, Check } from "lucide-react"
import type { Card } from "@/app/gacha/types"
import { useDust } from "@/hooks/use-dust"
import { useAuth } from "@/components/auth/auth-provider"
import { supabase } from "@/lib/supabase"

const ART_CHANGE_COST = 50

const isPinterestUrl = (url: string) => url.includes('i.pinimg.com') || url.includes('pinimg.com');
const getProxiedSrc = (url: string) => {
  if (!url) return url;
  if (isPinterestUrl(url)) return `/api/image-proxy?url=${encodeURIComponent(url)}`;
  return url;
};

interface ChangeArtModalProps {
  card: Card | null
  onClose: () => void
  onArtChanged: (newImageUrl: string, newOriginalUrl: string) => void
  dust: number
  refreshDust?: () => Promise<void>
}

export function ChangeArtModal({ card, onClose, onArtChanged, dust, refreshDust: propsRefreshDust }: ChangeArtModalProps) {
  const { user, session } = useAuth()
  const { spendDust } = useDust() // Только для операции траты
  
  // Используем refreshDust из пропсов если передан
  const refreshDust = propsRefreshDust
  const [isSpinning, setIsSpinning] = useState(false)
  const [previewArt, setPreviewArt] = useState<string | null>(null)
  const [isChanging, setIsChanging] = useState(false)
  const [isPreviewLoading, setIsPreviewLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [spinAttempts, setSpinAttempts] = useState(0)
  const [failedUrls, setFailedUrls] = useState<string[]>([])

  useEffect(() => {
    if (card) {
      setPreviewArt(card.imageUrl)
      // Обновляем баланс пыли при открытии модального окна
      console.log('[ChangeArt] Modal opened, current dust:', dust, 'refreshing...')
      console.log('[ChangeArt] User:', user ? `ID: ${user.id}` : 'null')
      console.log('[ChangeArt] Session:', session ? 'exists' : 'null')
      
      // Проверяем localStorage
      const savedDust = localStorage.getItem('gacha-dust')
      console.log('[ChangeArt] localStorage dust:', savedDust)
      
      // Временное решение: если dust === 0 но в localStorage есть значение, используем его
      if (dust === 0 && savedDust && parseInt(savedDust, 10) > 0) {
        console.log('[ChangeArt] Using localStorage dust as fallback:', savedDust)
        // Обновляем состояние через useDust если возможно
        setTimeout(() => {
          refreshDust?.()
        }, 100)
      }
      
      refreshDust?.()
    }
  }, [card, refreshDust, user, session])

  // Отслеживаем изменения dust для отладки
  useEffect(() => {
    console.log('[ChangeArt] Dust updated:', dust, 'ART_CHANGE_COST:', ART_CHANGE_COST, 'can afford:', dust >= ART_CHANGE_COST)
  }, [dust])

  const spinArt = async () => {
    if (!card) return

    setIsSpinning(true)
    setError(null)
    setSpinAttempts(prev => prev + 1)

    try {
      if (!session?.access_token) {
        setError("Сессия недоступна")
        setIsSpinning(false)
        return
      }

      // Get current blacklisted URLs for this character from localStorage
      let blacklistedUrls: string[] = [...failedUrls]
      try {
        const saved = localStorage.getItem('gacha-collection')
        if (saved) {
          const cards: any[] = JSON.parse(saved)
          blacklistedUrls = cards
            .filter((c: any) => c.characterId === card.characterId)
            .map((c: any) => c.imageUrl)
        }
      } catch (e) {
        console.error('[ChangeArt] Error loading blacklisted URLs:', e)
      }

      // Добавляем текущий арт карты в blacklist чтобы не получить тот же самый
      if (card.imageUrl && !blacklistedUrls.includes(card.imageUrl)) {
        blacklistedUrls.push(card.imageUrl)
      }

      // Добавляем previewArt если он отличается от текущего
      if (previewArt && previewArt !== card.imageUrl && !blacklistedUrls.includes(previewArt)) {
        blacklistedUrls.push(previewArt)
      }

      // Формируем customTags на основе данных карты, если они есть
      // Мы можем извлечь теги из character name или передавать их если они хранятся в карте
      const customTags = (card as any).customTags || undefined;

      const response = await fetch("/api/gacha/spin-art", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          characterId: card.characterId,
          blacklistedUrls,
          customTags,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || "Не удалось найти арт")
        setIsSpinning(false)
        return
      }

      if (data.art) {
        // Если вернулся тот же арт что и сейчас показан - добавляем в blacklist и ищем снова
        if (data.art.url === previewArt) {
          console.log('[ChangeArt] Same art returned, adding to blacklist and retrying...')
          // Обновляем blacklist и вызываем снова сразу с новым списком
          const newBlacklist = [...blacklistedUrls, data.art.url]
          setTimeout(() => {
            spinArtWithBlacklist(newBlacklist)
          }, 100)
          return
        }
        setIsPreviewLoading(true)
        setPreviewArt(data.art.url)
      }
    } catch (err) {
      console.error("Spin art error:", err)
      setError("Ошибка при поиске арта")
    } finally {
      setIsSpinning(false)
    }
  }

  // Вспомогательная функция для поиска с дополнительным blacklist
  const spinArtWithBlacklist = async (additionalBlacklist: string[]) => {
    if (!card) return

    setIsSpinning(true)
    setError(null)

    try {
      if (!session?.access_token) {
        setError("Сессия недоступна")
        setIsSpinning(false)
        return
      }

      const customTags = (card as any).customTags || undefined;

      const response = await fetch("/api/gacha/spin-art", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          characterId: card.characterId,
          blacklistedUrls: additionalBlacklist,
          customTags,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || "Не удалось найти арт")
        setIsSpinning(false)
        return
      }

      if (data.art) {
        setIsPreviewLoading(true)
        setPreviewArt(data.art.url)
      }
    } catch (err) {
      console.error("Spin art error:", err)
      setError("Ошибка при поиске арта")
    } finally {
      setIsSpinning(false)
    }
  }

  const confirmChange = async () => {
    console.log('[ChangeArt] confirmChange called - dust:', dust, 'ART_CHANGE_COST:', ART_CHANGE_COST, 'dust < cost:', dust < ART_CHANGE_COST)
    if (!card || !previewArt || previewArt === card.imageUrl) return
    if (dust < ART_CHANGE_COST) {
      setError(`Недостаточно пыли. Нужно ${ART_CHANGE_COST}`)
      return
    }

    setIsChanging(true)
    setError(null)

    try {
      if (!session?.access_token) {
        setError("Сессия недоступна")
        setIsChanging(false)
        return
      }

      const response = await fetch("/api/card/change-art", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          uniqueId: card.uniqueId,
          newImageUrl: previewArt,
          newOriginalUrl: previewArt,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        if (data.have !== undefined) {
          setError(`Недостаточно пыли. Нужно ${ART_CHANGE_COST}, есть ${data.have}`)
        } else {
          setError(data.message || "Ошибка смены арта")
        }
        setIsChanging(false)
        return
      }

      setSuccess(true)
      setTimeout(() => {
        onArtChanged(previewArt, previewArt)
        // Обновляем баланс пыли после успешной операции
        refreshDust?.()
        onClose()
      }, 1500)
    } catch (err) {
      console.error("Change art error:", err)
      setError("Ошибка при смене арта")
    } finally {
      setIsChanging(false)
    }
  }

  const handleImageError = () => {
    if (previewArt) {
      console.warn(`[ChangeArt] Image failed to load: ${previewArt}. Skipping and finding new art...`)
      setFailedUrls(prev => [...prev, previewArt])
      setIsPreviewLoading(false)
      // Автоматически ищем новый арт, если текущий не загрузился
      setTimeout(() => {
        spinArt()
      }, 100)
    }
  }

  if (!card) return null

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-6 bg-slate-950/90 backdrop-blur-xl animate-in fade-in duration-200 overflow-y-auto">
      <button
        onClick={onClose}
        className="absolute top-4 sm:top-6 right-4 sm:right-6 p-2.5 sm:p-3 rounded-full bg-white/5 hover:bg-white/10 text-white transition-colors border border-white/10 z-50"
      >
        <X className="w-5 h-5 sm:w-6 sm:h-6" />
      </button>

      <div className="flex flex-col items-center justify-center min-h-full py-12 w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-tight mb-6 flex items-center gap-3">
          <RefreshCcw className="w-6 h-6 sm:w-8 sm:h-8 text-amber-400" />
          Смена арта
        </h2>

        <p className="text-slate-400 text-sm mb-6 text-center">
          Найдите новый арт для <span className="text-white font-bold">{card.name}</span>
        </p>

        {/* Current vs New Art Comparison */}
        <div className="flex gap-4 mb-6 w-full">
          <div className="flex-1">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-2 text-center">Текущий</p>
            <div className="aspect-[2/3] rounded-xl overflow-hidden border border-slate-700 bg-slate-900 relative">
              <Image
                src={getProxiedSrc(card.imageUrl)}
                alt="Current art"
                fill
                unoptimized={isPinterestUrl(card.imageUrl)}
                className="object-cover"
                sizes="(max-width: 640px) 50vw, 33vw"
                quality={60}
                referrerPolicy="no-referrer"
              />
            </div>
          </div>

          <div className="flex-1 relative">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-2 text-center">Новый</p>
            <div className="aspect-[2/3] rounded-xl overflow-hidden border-2 border-amber-500/50 bg-slate-900 relative">
              {previewArt ? (
                <>
                  <Image
                    src={previewArt}
                    alt="New art preview"
                    fill
                    className={`object-cover transition-opacity duration-300 ${isPreviewLoading ? 'opacity-0' : 'opacity-100'}`}
                    sizes="(max-width: 640px) 50vw, 33vw"
                    quality={60}
                    referrerPolicy="no-referrer"
                    onLoad={() => setIsPreviewLoading(false)}
                    onError={handleImageError}
                  />
                  {isPreviewLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
                      <Loader2 className="w-10 h-10 text-amber-500 animate-spin" />
                    </div>
                  )}
                </>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-16 h-16 border-3 border-slate-700 border-t-amber-500 rounded-full animate-spin" />
                </div>
              )}
              {previewArt && previewArt !== card.imageUrl && !isPreviewLoading && (
                <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-green-500 flex items-center justify-center animate-in zoom-in duration-300">
                  <Check className="w-4 h-4 text-white" />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Dust Cost */}
        <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 mb-6">
          <Sparkles className="w-5 h-5 text-amber-400" />
          <span className="text-amber-300 font-bold">Стоимость: {ART_CHANGE_COST} пыли</span>
          <span className="text-amber-200 text-sm">(Ваш баланс: {dust})</span>
        </div>

        {/* Error Message */}
        {error && (
          <div className="w-full px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm font-bold mb-4 text-center">
            {error}
          </div>
        )}

        {/* Success Message */}
        {success && (
          <div className="w-full px-4 py-3 rounded-xl bg-green-500/10 border border-green-500/30 text-green-400 text-sm font-bold mb-4 text-center flex items-center justify-center gap-2">
            <Check className="w-5 h-5" />
            Арт успешно изменён!
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 w-full">
          <button
            onClick={spinArt}
            disabled={isSpinning || isChanging}
            className="px-4 py-2.5 sm:px-5 sm:py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs sm:text-sm flex items-center gap-2 transition-colors"
          >
            {isSpinning ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Поиск арта...
              </>
            ) : (
              <>
                <RefreshCcw className="w-4 h-4" />
                Найти арт
              </>
            )}
          </button>

          <button
            onClick={confirmChange}
            disabled={!previewArt || previewArt === card.imageUrl || isChanging || dust < ART_CHANGE_COST}
            className="px-4 py-2.5 sm:px-5 sm:py-3 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-bold text-xs sm:text-sm flex items-center gap-2 transition-colors"
          >
            {isChanging ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Смена арта...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Применить ({ART_CHANGE_COST} 🜛)
              </>
            )}
          </button>

          <button
            onClick={onClose}
            disabled={isChanging}
            className="px-4 py-2.5 sm:px-5 sm:py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs sm:text-sm flex items-center gap-2 transition-colors border border-slate-700"
          >
            <X className="w-4 h-4" />
            Отмена
          </button>
        </div>
      </div>
    </div>
  )
}
