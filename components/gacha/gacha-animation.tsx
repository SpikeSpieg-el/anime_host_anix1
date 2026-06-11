"use client"

import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Sparkles, Star, Zap, Flame, Crown, Loader2 } from "lucide-react"
import { Rarity, rarityConfig } from "@/types/gacha"

interface GachaAnimationProps {
  isRolling: boolean
  revealedCard: any
  onComplete: () => void
}

export function GachaAnimation({ isRolling, revealedCard, onComplete }: GachaAnimationProps) {
  const [phase, setPhase] = useState<'idle' | 'charging' | 'impact' | 'reveal'>('idle')
  const [showRarityEffect, setShowRarityEffect] = useState(false)
  
  // Определяем интенсивность эффектов от редкости
  const rarityInfo = revealedCard ? rarityConfig[revealedCard.rarity as Rarity] : null
  const isHighRarity = revealedCard && ["mythic", "legendary", "ancient", "divine", "transcendent", "omnipotent"].includes(revealedCard.rarity)
  const isGodlyRarity = revealedCard && ["divine", "transcendent", "omnipotent"].includes(revealedCard.rarity)

  useEffect(() => {
    if (isRolling) {
      setPhase('charging')
      const timer = setTimeout(() => {
        if (revealedCard) {
          setPhase('impact')
        }
      }, 2000) // Фаза подготовки
      return () => clearTimeout(timer)
    } else {
      setPhase('idle')
      setShowRarityEffect(false)
    }
  }, [isRolling, revealedCard])

  useEffect(() => {
    if (phase === 'impact') {
      const timer = setTimeout(() => {
        setPhase('reveal')
        setShowRarityEffect(true)
        onComplete()
      }, 800) // Фаза удара/вспышки
      return () => clearTimeout(timer)
    }
  }, [phase, onComplete])

  return (
    <div className="relative w-[280px] sm:w-80 h-[420px] sm:h-[480px] flex items-center justify-center overflow-hidden rounded-[2.5rem] bg-slate-950 shadow-2xl">
      <AnimatePresence mode="wait">
        {/* ФАЗА 1: ЗАРЯДКА/ПОДГОТОВКА */}
        {phase === 'charging' && (
          <motion.div
            key="charging"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 2, filter: 'blur(20px)' }}
            className="absolute inset-0 flex flex-col items-center justify-center"
          >
            {/* Вращающиеся кольца энергии */}
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              className="absolute w-48 h-48 border-2 border-dashed border-indigo-500/30 rounded-full"
            />
            <motion.div
              animate={{ rotate: -360 }}
              transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
              className="absolute w-64 h-64 border border-indigo-400/20 rounded-full"
            />
            
            {/* Центр энергии */}
            <div className="relative">
              <motion.div
                animate={{ 
                  scale: [1, 1.2, 1],
                  opacity: [0.5, 1, 0.5]
                }}
                transition={{ duration: 1, repeat: Infinity }}
                className="w-16 h-16 bg-indigo-500 rounded-full blur-xl"
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-white animate-spin" />
              </div>
            </div>
            
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-8 text-indigo-300 font-black uppercase tracking-[0.2em] text-xs"
            >
              Призыв героя...
            </motion.p>
          </motion.div>
        )}

        {/* ФАЗА 2: УДАР/ИМПУЛЬС */}
        {phase === 'impact' && (
          <motion.div
            key="impact"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ 
              opacity: [0, 1, 0.8],
              scale: [0.5, 1.2, 1],
              backgroundColor: ["rgba(255,255,255,0)", "rgba(79, 70, 229, 0.2)", "rgba(79, 70, 229, 0)"]
            }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="absolute inset-0 z-50 flex items-center justify-center overflow-hidden"
          >
            {/* Динамическое свечение в цвет редкости */}
            {rarityInfo && (
              <motion.div 
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: [1, 4], opacity: [0.5, 0] }}
                transition={{ duration: 0.8 }}
                className={`absolute inset-0 bg-gradient-to-r ${rarityInfo.color} blur-3xl opacity-40`}
              />
            )}
            <motion.div
              animate={{ 
                scale: [1, 1.5, 1],
                filter: ["brightness(1)", "brightness(2)", "brightness(1)"]
              }}
              transition={{ duration: 0.5 }}
            >
              <Zap className="w-20 h-20 text-indigo-400 drop-shadow-[0_0_15px_rgba(129,140,248,0.8)]" />
            </motion.div>
          </motion.div>
        )}

        {/* ФАЗА 3: ПОЯВЛЕНИЕ (через родительский компонент, но здесь мы можем добавить оверлей эффектов) */}
        {phase === 'reveal' && showRarityEffect && rarityInfo && (
          <motion.div
            key="reveal-fx"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 z-40 pointer-events-none"
          >
            {/* Фоновое свечение в зависимости от редкости */}
            <div className={`absolute inset-0 opacity-30 bg-gradient-to-t ${rarityInfo.color}`} />
            
            {/* Частицы для высокой редкости */}
            {isHighRarity && (
              <div className="absolute inset-0">
                {[...Array(20)].map((_, i) => (
                  <motion.div
                    key={i}
                    initial={{ 
                      x: Math.random() * 300 - 150, 
                      y: 500,
                      opacity: 0,
                      scale: 0
                    }}
                    animate={{ 
                      y: -100,
                      opacity: [0, 1, 0],
                      scale: [0, 1, 0.5]
                    }}
                    transition={{ 
                      duration: 2 + Math.random() * 2,
                      repeat: Infinity,
                      delay: Math.random() * 2
                    }}
                    className={`absolute w-1 h-1 rounded-full bg-gradient-to-b ${rarityInfo.color}`}
                  />
                ))}
              </div>
            )}

            {/* Особые иконки для легендарок+ */}
            {isGodlyRarity && (
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: [1, 1.2, 1], opacity: 1 }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="absolute top-10 left-1/2 -translate-x-1/2 flex gap-2"
              >
                <Crown className="w-6 h-6 text-amber-400 drop-shadow-[0_0_10px_rgba(251,191,36,0.8)]" />
                <Sparkles className="w-6 h-6 text-white animate-pulse" />
                <Crown className="w-6 h-6 text-amber-400 drop-shadow-[0_0_10px_rgba(251,191,36,0.8)]" />
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
