"use client"

import Image from "next/image"
import { Swords, Store, ArrowRight, X } from "lucide-react"

interface RollRecommendationModalProps {
  isOpen: boolean
  onClose: () => void
  onContinue: () => void
  target: "battle" | "market"
  currentCards: number
}

export function RollRecommendationModal({ isOpen, onClose, onContinue, target, currentCards }: RollRecommendationModalProps) {
  if (!isOpen) return null

  const targetName = target === "battle" ? "битвы" : "маркет"
  const targetIcon = target === "battle" ? Swords : Store
  const TargetIcon = targetIcon

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 sm:p-6 bg-slate-950/90 backdrop-blur-xl animate-in fade-in duration-200">
      <div className="relative bg-slate-900 border border-white/10 rounded-2xl sm:rounded-3xl p-5 sm:p-6 md:p-8 max-w-md w-full shadow-2xl shadow-black/60 animate-in zoom-in-95 duration-300">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Cat girl mascot */}
        <div className="flex justify-center mb-4">
          <div className="relative size-28 sm:size-32">
            <Image
              src="/catgirl_tutorial.png"
              alt="Кошкодевочка-проводник"
              width={128}
              height={128}
              className="object-contain motion-safe:animate-[float_3s_ease-in-out_infinite]"
            />
          </div>
        </div>

        {/* Content */}
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-2">
            <TargetIcon className="w-6 h-6 text-indigo-400" />
            <h2 className="text-xl sm:text-2xl font-black text-white">
              Рекомендация от кошкодевочки
            </h2>
          </div>

          <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
            Ня~ Для продолжения перехода на {targetName} рекомендуется иметь минимум 8 карт в коллекции!
          </p>

          <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-xl p-4">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Swords className="w-4 h-4 text-amber-400" />
              <span className="text-amber-300 font-bold text-sm">Карт в коллекции</span>
              <Swords className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-white">
              {currentCards} <span className="text-lg text-slate-400">/ 8</span>
            </div>
            <div className="mt-2 h-2 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all duration-500"
                style={{ width: `${(currentCards / 8) * 100}%` }}
              />
            </div>
          </div>

          <p className="text-xs sm:text-sm text-slate-400">
            {currentCards === 0
              ? "Сделай хотя бы несколько круток и сохрани карты, чтобы собрать команду для туториала!"
              : `Сделай ещё ${8 - currentCards} круток, чтобы было комфортнее проходить обучение!`
            }
          </p>

          {/* Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-bold rounded-xl transition-all text-sm sm:text-base"
            >
              Вернуться к гаче
            </button>
            <button
              onClick={onContinue}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold rounded-xl transition-all text-sm sm:text-base shadow-lg shadow-indigo-500/25"
            >
              Всё равно перейти
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
