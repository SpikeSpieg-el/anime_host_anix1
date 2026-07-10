"use client"

import React, { useState, useEffect, useRef } from "react"
import { Rarity, rarityConfig } from "@/types/gacha"
import { getCardBasePower } from "@/app/battle/utils"

const RARITY_ORDER: Rarity[] = [
  "trash", "common", "uncommon", "rare", "super_rare", "epic",
  "mythic", "legendary", "ancient", "divine", "transcendent", "omnipotent"
]

interface GachaAnimationProps {
  isRolling: boolean
  revealedCard: any
  onComplete: () => void
}

export function GachaAnimation({ isRolling, revealedCard, onComplete }: GachaAnimationProps) {
  const [phase, setPhase] = useState<'idle' | 'drop' | 'shake' | 'loading' | 'reveal' | 'transition'>('idle')
  const [imageLoaded, setImageLoaded] = useState(false)
  const [climbIndex, setClimbIndex] = useState(0)
  const [showFlash, setShowFlash] = useState(false)
  const completedRef = useRef(false)
  const imagePreloadedRef = useRef(false)
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete

  const targetRarityIndex = revealedCard
    ? RARITY_ORDER.indexOf(revealedCard.rarity as Rarity)
    : 0

  const currentClimbRarity = RARITY_ORDER[climbIndex]
  const currentRarityInfo = rarityConfig[currentClimbRarity]
  const rarityInfo = revealedCard ? rarityConfig[revealedCard.rarity as Rarity] : null
  const isHighRarity = revealedCard && ["mythic", "legendary", "ancient", "divine", "transcendent", "omnipotent"].includes(revealedCard.rarity)
  const isGodlyRarity = revealedCard && ["divine", "transcendent", "omnipotent"].includes(revealedCard.rarity)
  const isUltraRarity = revealedCard && ["ancient", "divine", "transcendent", "omnipotent"].includes(revealedCard.rarity)
  const isLegendaryRarity = revealedCard && revealedCard.rarity === 'legendary'
  const isMainCharacter = revealedCard?.isMainCharacter === true

  const ccgPower = revealedCard?.stats ? getCardBasePower(revealedCard) : 0

  useEffect(() => {
    if (isRolling) {
      completedRef.current = false
      imagePreloadedRef.current = false
      setClimbIndex(0)
      setPhase('drop')
      const t1 = setTimeout(() => setPhase('shake'), 700)
      return () => clearTimeout(t1)
    } else {
      setPhase('idle')
      setClimbIndex(0)
      completedRef.current = false
    }
  }, [isRolling])

  useEffect(() => {
    if (revealedCard && !completedRef.current && phase === 'shake') {
      setClimbIndex(0)
    }
  }, [revealedCard, phase])

  // Early preload — start fetching card art as soon as revealedCard arrives (during shake)
  useEffect(() => {
    if (!revealedCard || !revealedCard.imageUrl || imagePreloadedRef.current) return
    imagePreloadedRef.current = true
    const img = new window.Image()
    img.src = revealedCard.imageUrl
  }, [revealedCard])

  const handleTap = () => {
    if (phase !== 'shake' || !revealedCard || completedRef.current) return

    const isLastStep = climbIndex >= targetRarityIndex
    if (isLastStep) {
      setPhase('loading')
    } else {
      setClimbIndex(prev => prev + 1)
    }
  }

  // Loading phase — image already preloading since shake, just wait for it + flash
  useEffect(() => {
    if (phase !== 'loading' || !revealedCard) return

    let cancelled = false
    const minDelay = 400
    const startTime = Date.now()

    const finish = () => {
      if (cancelled) return
      const elapsed = Date.now() - startTime
      const remaining = Math.max(0, minDelay - elapsed)
      setTimeout(() => {
        if (cancelled) return
        setShowFlash(true)
        setTimeout(() => {
          if (cancelled) return
          setShowFlash(false)
          setPhase('reveal')
        }, 250)
      }, remaining)
    }

    if (revealedCard.imageUrl) {
      const img = new window.Image()
      img.onload = () => { if (!cancelled) { setImageLoaded(true); finish() } }
      img.onerror = () => { if (!cancelled) { setImageLoaded(true); finish() } }
      img.src = revealedCard.imageUrl
    } else {
      finish()
    }

    return () => { cancelled = true }
  }, [phase, revealedCard])

  // Reveal phase — auto-transition after effects play, no tap required
  useEffect(() => {
    if (phase !== 'reveal') return
    const revealDuration = isUltraRarity ? 3000 : isHighRarity ? 2500 : 1800
    const t1 = setTimeout(() => {
      setPhase('transition')
    }, revealDuration)
    return () => clearTimeout(t1)
  }, [phase, isUltraRarity, isHighRarity])

  // Transition phase — fade out effects, scale card up, then auto-complete
  useEffect(() => {
    if (phase !== 'transition') return
    const t1 = setTimeout(() => {
      if (!completedRef.current) {
        completedRef.current = true
        onCompleteRef.current()
      }
    }, 600)
    return () => clearTimeout(t1)
  }, [phase])

  if (phase === 'idle') return null

  const isTransitioning = phase === 'transition'

  const rarityRgb = (phase === 'shake' && revealedCard ? currentRarityInfo : rarityInfo)?.rgb || '129, 140, 248'
  const activeRarityInfo = phase === 'shake' && revealedCard ? currentRarityInfo : rarityInfo

  return (
    <div className="relative w-[280px] sm:w-80 h-[420px] sm:h-[480px] flex items-center justify-center overflow-hidden rounded-[2.5rem] bg-slate-950 shadow-2xl" style={{ contain: 'layout style paint' }}>
      <style>{`
        @keyframes packDrop {
          0% { transform: translate3d(0,-400px,0) scale(0.8); opacity: 0; }
          60% { transform: translate3d(0,20px,0) scale(1.05); opacity: 1; }
          80% { transform: translate3d(0,-8px,0) scale(0.98); }
          100% { transform: translate3d(0,0,0) scale(1); opacity: 1; }
        }
        @keyframes packShake {
          0%,100% { transform: translate3d(0,0,0) rotate(0); }
          20% { transform: translate3d(-4px,0,0) rotate(-1deg); }
          40% { transform: translate3d(4px,0,0) rotate(1deg); }
          60% { transform: translate3d(-3px,0,0) rotate(-0.5deg); }
          80% { transform: translate3d(3px,0,0) rotate(0.5deg); }
        }
        @keyframes packSpin3D {
          0% { transform: rotateY(0deg) rotateX(0deg); }
          25% { transform: rotateY(90deg) rotateX(10deg); }
          50% { transform: rotateY(180deg) rotateX(0deg); }
          75% { transform: rotateY(270deg) rotateX(-10deg); }
          100% { transform: rotateY(360deg) rotateX(0deg); }
        }
        @keyframes packShakeSpin {
          0% { transform: translate3d(0,0,0) rotateY(0deg) rotateZ(0); }
          10% { transform: translate3d(-4px,0,0) rotateY(36deg) rotateZ(-1deg); }
          20% { transform: translate3d(4px,0,0) rotateY(72deg) rotateZ(1deg); }
          30% { transform: translate3d(-3px,0,0) rotateY(108deg) rotateZ(-0.5deg); }
          40% { transform: translate3d(3px,0,0) rotateY(144deg) rotateZ(0.5deg); }
          50% { transform: translate3d(-4px,0,0) rotateY(180deg) rotateZ(-1deg); }
          60% { transform: translate3d(4px,0,0) rotateY(216deg) rotateZ(1deg); }
          70% { transform: translate3d(-3px,0,0) rotateY(252deg) rotateZ(-0.5deg); }
          80% { transform: translate3d(3px,0,0) rotateY(288deg) rotateZ(0.5deg); }
          90% { transform: translate3d(-2px,0,0) rotateY(324deg) rotateZ(-0.3deg); }
          100% { transform: translate3d(0,0,0) rotateY(360deg) rotateZ(0); }
        }
        @keyframes glowPulse {
          0%,100% { opacity: 0.3; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(1.15); }
        }
        @keyframes burstFlash {
          0% { opacity: 0; transform: scale(0.5); }
          40% { opacity: 1; transform: scale(1.8); }
          100% { opacity: 0; transform: scale(3); }
        }
        @keyframes cardSlideUp {
          0% { transform: translate3d(0,120%,0) scale(0.8); opacity: 0; }
          55% { transform: translate3d(0,-8%,0) scale(1.05); opacity: 1; }
          100% { transform: translate3d(0,0,0) scale(1); opacity: 1; }
        }
        @keyframes shimmer {
          0% { transform: translate3d(-100%,0,0); }
          100% { transform: translate3d(200%,0,0); }
        }
        @keyframes floatParticle {
          0% { transform: translate3d(0,0,0) scale(0); opacity: 0; }
          25% { opacity: 1; }
          100% { transform: translate3d(0,-180px,0) scale(1); opacity: 0; }
        }
        @keyframes crownPulse {
          0%,100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.15); opacity: 0.8; }
        }
        @keyframes climbFlash {
          0% { opacity: 0; transform: scale(0.6); }
          30% { opacity: 1; transform: scale(1.4); }
          70% { opacity: 0.6; transform: scale(1.1); }
          100% { opacity: 0; transform: scale(0.8); }
        }
        @keyframes jackpotBurst {
          0% { opacity: 0; transform: scale(0); }
          20% { opacity: 1; transform: scale(1.5); }
          50% { opacity: 0.7; transform: scale(2.2); }
          100% { opacity: 0; transform: scale(3.5); }
        }
        @keyframes cardGlowIn {
          0% { opacity: 0; transform: scale(0.5) rotateY(180deg); }
          50% { opacity: 1; transform: scale(1.1) rotateY(0deg); }
          70% { transform: scale(0.95) rotateY(0deg); }
          100% { opacity: 1; transform: scale(1) rotateY(0deg); }
        }
        @keyframes rayBurst {
          0% { opacity: 0; transform: scale(0) rotate(0deg); }
          40% { opacity: 0.6; transform: scale(1.5) rotate(45deg); }
          100% { opacity: 0; transform: scale(2.5) rotate(90deg); }
        }
        @keyframes winShake {
          0%,100% { transform: translateX(0); }
          10% { transform: translateX(-6px); }
          20% { transform: translateX(6px); }
          30% { transform: translateX(-4px); }
          40% { transform: translateX(4px); }
          50% { transform: translateX(-2px); }
          60% { transform: translateX(2px); }
        }
        @keyframes climbLabelIn {
          0% { opacity: 0; transform: translateY(12px) scale(0.8); }
          40% { opacity: 1; transform: translateY(0) scale(1.1); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes climbBar {
          0% { width: 0%; }
          100% { width: var(--target-width); }
        }
        @keyframes dotPopIn {
          0% { opacity: 0; transform: scale(0); }
          50% { opacity: 1; transform: scale(2); }
          100% { opacity: 1; transform: scale(1.5); }
        }
        @keyframes screenFlash {
          0% { opacity: 0; }
          30% { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes tapHint {
          0%, 100% { opacity: 0.3; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.05); }
        }
        @keyframes mainCharBadge {
          0% { opacity: 0; transform: translateY(-20px) scale(0.5); }
          50% { opacity: 1; transform: translateY(0) scale(1.15); }
          70% { transform: scale(0.95); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes mainCharGlow {
          0%, 100% { box-shadow: 0 0 15px rgba(251,191,36,0.6), 0 0 30px rgba(251,191,36,0.3); }
          50% { box-shadow: 0 0 25px rgba(251,191,36,0.9), 0 0 50px rgba(251,191,36,0.5); }
        }
        @keyframes ultraScreenShake {
          0%, 100% { transform: translate(0, 0); }
          10% { transform: translate(-8px, -4px); }
          20% { transform: translate(8px, 4px); }
          30% { transform: translate(-6px, 6px); }
          40% { transform: translate(6px, -6px); }
          50% { transform: translate(-4px, -2px); }
          60% { transform: translate(4px, 2px); }
          70% { transform: translate(-3px, 3px); }
          80% { transform: translate(3px, -3px); }
          90% { transform: translate(-1px, 1px); }
        }
        @keyframes ultraFlashSeq {
          0% { opacity: 0; }
          5% { opacity: 1; }
          10% { opacity: 0; }
          15% { opacity: 0.8; }
          20% { opacity: 0; }
          30% { opacity: 1; }
          35% { opacity: 0; }
          50% { opacity: 0.6; }
          55% { opacity: 0; }
          100% { opacity: 0; }
        }
        @keyframes ultraLightning {
          0% { opacity: 0; transform: scaleY(0) scaleX(0.3); }
          10% { opacity: 1; transform: scaleY(1) scaleX(1); }
          15% { opacity: 0; transform: scaleY(1) scaleX(1); }
          20% { opacity: 1; transform: scaleY(0.8) scaleX(0.8); }
          25% { opacity: 0; }
          100% { opacity: 0; }
        }
        @keyframes ultraPrism {
          0% { opacity: 0; transform: scale(0) rotate(0deg); }
          30% { opacity: 0.5; transform: scale(1.5) rotate(120deg); }
          60% { opacity: 0.3; transform: scale(2) rotate(240deg); }
          100% { opacity: 0; transform: scale(3) rotate(360deg); }
        }
        @keyframes ultraFirework {
          0% { transform: translate(0, 0) scale(0); opacity: 0; }
          30% { transform: translate(var(--fx), var(--fy)) scale(1); opacity: 1; }
          60% { opacity: 0.8; }
          100% { transform: translate(calc(var(--fx) * 1.5), calc(var(--fy) * 1.5)) scale(0.3); opacity: 0; }
        }
        @keyframes ultraCardPulse {
          0%, 100% { transform: scale(1); filter: brightness(1); }
          50% { transform: scale(1.08); filter: brightness(1.4); }
        }
        @keyframes ultraRingExpand {
          0% { transform: scale(0); opacity: 1; border-width: 4px; }
          100% { transform: scale(3); opacity: 0; border-width: 0px; }
        }
        @keyframes ultraGlowPulse {
          0%, 100% { opacity: 0.4; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.3); }
        }
        @keyframes ultraTapPulse {
          0%, 100% { opacity: 0.4; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.1); }
        }
        @keyframes legendaryCardEntrance {
          0% { opacity: 0; transform: scale(0.3) rotateY(180deg) rotateZ(-15deg); }
          40% { opacity: 1; transform: scale(1.15) rotateY(0deg) rotateZ(5deg); }
          60% { transform: scale(0.95) rotateY(0deg) rotateZ(-2deg); }
          80% { transform: scale(1.05) rotateY(0deg) rotateZ(1deg); }
          100% { opacity: 1; transform: scale(1) rotateY(0deg) rotateZ(0deg); }
        }
        @keyframes legendaryGlowPulse {
          0%, 100% { opacity: 0.4; transform: scale(1); }
          50% { opacity: 0.75; transform: scale(1.15); }
        }
        @keyframes revealCardZoom {
          0% { transform: scale(1); }
          100% { transform: scale(1.15); }
        }
        @keyframes effectsFadeOut {
          0% { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes bgFadeOut {
          0% { opacity: 1; }
          100% { opacity: 0; }
        }
      `}</style>

      {/* Screen flash transition between loading and reveal */}
      {showFlash && (
        <div className="absolute inset-0 z-50 pointer-events-none" style={{ background: `radial-gradient(circle, rgba(${rarityRgb},0.9), rgba(255,255,255,0.5))`, animation: 'screenFlash 0.3s ease-out forwards' }} />
      )}

      {/* Pack drop + shake phase (with integrated rarity climb) */}
      {(phase === 'drop' || phase === 'shake') && (
        <div
          className="relative flex flex-col items-center justify-center cursor-pointer select-none"
          onClick={handleTap}
        >
          {/* Step flash on rarity change */}
          {phase === 'shake' && revealedCard && activeRarityInfo && (
            <div
              key={`flash-${climbIndex}`}
              className="absolute w-48 h-48 rounded-full pointer-events-none"
              style={{
                background: `radial-gradient(circle, rgba(${activeRarityInfo.rgb},0.7), transparent 70%)`,
                animation: 'climbFlash 0.35s ease-out forwards',
                willChange: 'transform,opacity',
              }}
            />
          )}

          {/* Glow behind pack — color changes with rarity climb */}
          <div
            className="absolute w-44 h-60 rounded-2xl transition-all duration-200"
            style={{
              background: `radial-gradient(ellipse, rgba(${rarityRgb},0.35), transparent 70%)`,
              animation: phase === 'shake' ? 'glowPulse 1s ease-in-out infinite' : 'none',
              willChange: 'transform,opacity',
            }}
          />

          {/* Pack body — 3D spinning + shaking, border color changes with rarity climb */}
          <div
            style={{
              perspective: '800px',
            }}
            className="relative"
          >
          <div
            style={{
              animation: phase === 'drop'
                ? 'packDrop 0.6s cubic-bezier(0.34,1.56,0.64,1) forwards'
                : revealedCard
                  ? 'packShakeSpin 1.2s linear infinite'
                  : 'packShake 0.4s ease-in-out infinite',
              willChange: 'transform',
              transformStyle: 'preserve-3d',
              backfaceVisibility: 'visible',
              borderColor: phase === 'shake' && revealedCard ? `rgba(${rarityRgb},0.6)` : undefined,
              boxShadow: phase === 'shake' && revealedCard ? `0 0 25px rgba(${rarityRgb},0.4)` : undefined,
            }}
            className="relative w-36 h-52 rounded-2xl bg-gradient-to-br from-indigo-600 via-purple-600 to-indigo-900 border-2 border-indigo-400/40 shadow-2xl flex flex-col items-center justify-center overflow-hidden transition-all duration-200"
          >
            {/* Shine sweep */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div
                className="absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                style={{ animation: 'shimmer 2s ease-in-out infinite', willChange: 'transform' }}
              />
            </div>

            {/* Pack icon */}
            <div className="relative z-10 flex flex-col items-center gap-2">
              <div className="w-12 h-12 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center">
                <svg className="w-7 h-7 text-white/80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              <div className="text-white/60 text-[10px] font-bold uppercase tracking-widest">Pack</div>
            </div>

            {/* Bottom seal strip — color changes with rarity */}
            <div
              className="absolute bottom-0 inset-x-0 h-1.5 transition-all duration-200"
              style={{
                background: phase === 'shake' && revealedCard
                  ? `linear-gradient(to right, rgb(${rarityRgb}))`
                  : 'linear-gradient(to right, #fbbf24, #fde047, #fbbf24)',
              }}
            />
          </div>
          </div>

          {/* Rarity climb indicators below pack */}
          {phase === 'shake' && revealedCard && activeRarityInfo && (
            <div className="mt-5 flex flex-col items-center gap-2" key={`climb-${climbIndex}`}>
              {/* Current rarity label */}
              <div
                key={`label-${climbIndex}`}
                className="text-sm font-black uppercase tracking-widest"
                style={{ animation: 'climbLabelIn 0.3s ease-out forwards' }}
              >
                <span className={`bg-gradient-to-r ${activeRarityInfo.color} bg-clip-text text-transparent`}>
                  {activeRarityInfo.label}
                </span>
              </div>

              {/* Rarity tier dots — appear progressively, no hint of how many remain */}
              <div className="flex gap-1.5 items-center">
                {RARITY_ORDER.slice(0, climbIndex + 1).map((r, i) => (
                  <div
                    key={r}
                    className="w-2 h-2 rounded-full transition-all duration-200"
                    style={{
                      background: `rgb(${rarityConfig[r].rgb})`,
                      transform: i === climbIndex ? 'scale(1.5)' : 'scale(1)',
                      boxShadow: i === climbIndex ? `0 0 8px rgb(${rarityConfig[r].rgb})` : 'none',
                      animation: i === climbIndex ? 'dotPopIn 0.3s ease-out' : 'none',
                    }}
                  />
                ))}
              </div>

              {/* Status text — always same, no hint if this is the last step */}
              <div className="text-white/50 text-[10px] font-bold uppercase tracking-[0.2em] animate-pulse mt-1">
                ▲ Тап для улучшения ▲
              </div>
            </div>
          )}

          {/* Loading text — only before revealedCard arrives */}
          {phase === 'shake' && !revealedCard && (
            <div className="mt-6 text-indigo-300 font-black uppercase tracking-[0.2em] text-xs animate-pulse">
              Открытие набора...
            </div>
          )}
        </div>
      )}

      {/* Loading phase — quick preload with rarity glow */}
      {phase === 'loading' && rarityInfo && (
        <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ contain: 'content' }}>
          <div className={`absolute inset-0 opacity-20 bg-gradient-to-t ${rarityInfo.color}`} />
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center"
            style={{
              background: `radial-gradient(circle, rgba(${rarityInfo.rgb},0.4), transparent 70%)`,
              animation: 'glowPulse 1s ease-in-out infinite',
              willChange: 'transform,opacity',
            }}
          >
            <svg className="w-8 h-8 animate-spin" style={{ color: `rgb(${rarityInfo.rgb})` }} fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
              <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
          <div className="mt-4 text-white/60 font-black uppercase tracking-[0.2em] text-xs animate-pulse">
            {imageLoaded ? 'Готово!' : 'Загрузка...'}
          </div>
          <div className="mt-2">
            <span className={`text-sm font-black uppercase tracking-widest bg-gradient-to-r ${rarityInfo.color} bg-clip-text text-transparent`}>
              {rarityInfo.label}
            </span>
          </div>
        </div>
      )}

      {/* Card reveal phase — with jackpot effects, also visible during transition */}
      {(phase === 'reveal' || phase === 'transition') && rarityInfo && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center"
          style={{ 
            animation: phase === 'reveal' 
              ? (isUltraRarity ? 'ultraScreenShake 0.6s ease-out' : 'winShake 0.5s ease-out') 
              : 'effectsFadeOut 0.6s ease-out forwards',
          }}
        >
          {/* Rarity glow background — stronger for high rarity */}
          <div 
            className={`absolute inset-0 ${isHighRarity ? 'opacity-40' : 'opacity-25'} bg-gradient-to-t ${rarityInfo.color}`}
            style={isTransitioning ? { animation: 'bgFadeOut 0.5s ease-out forwards' } : undefined}
          />

          {/* Ultra rarity — multi-flash sequence */}
          {isUltraRarity && (
            <div
              className="absolute inset-0 z-40 pointer-events-none"
              style={{ background: `radial-gradient(circle, rgba(${rarityRgb},1), transparent 80%)`, animation: 'ultraFlashSeq 1.5s ease-out forwards' }}
            />
          )}

          {/* Ultra rarity — expanding rings */}
          {isUltraRarity && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30">
              {[0, 0.3, 0.6].map((delay, i) => (
                <div
                  key={i}
                  className="absolute w-32 h-32 rounded-full border-4"
                  style={{
                    borderColor: `rgba(${rarityRgb},0.8)`,
                    animation: `ultraRingExpand 1.2s ease-out ${delay}s forwards`,
                    willChange: 'transform,opacity',
                  }}
                />
              ))}
            </div>
          )}

          {/* Ultra rarity — lightning bolts */}
          {isUltraRarity && (
            <div className="absolute inset-0 pointer-events-none z-30 overflow-hidden">
              {[0, 0.15, 0.3, 0.45].map((delay, i) => (
                <div
                  key={i}
                  className="absolute top-0"
                  style={{
                    left: `${20 + i * 20}%`,
                    width: '3px',
                    height: '100%',
                    background: `linear-gradient(to bottom, transparent, rgba(${rarityRgb},0.9), rgba(255,255,255,0.8), rgba(${rarityRgb},0.9), transparent)`,
                    filter: 'blur(1px) drop-shadow(0 0 8px rgba(' + rarityRgb + ',0.8))',
                    transformOrigin: 'top center',
                    animation: `ultraLightning 0.8s ease-out ${delay}s forwards`,
                    willChange: 'transform,opacity',
                  }}
                />
              ))}
            </div>
          )}

          {/* Ultra rarity — rotating prism burst */}
          {isUltraRarity && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
              <div
                className="w-72 h-72 rounded-full"
                style={{
                  background: `conic-gradient(from 0deg, rgba(${rarityRgb},0.3), rgba(255,0,100,0.2), rgba(0,255,200,0.2), rgba(255,255,0,0.2), rgba(100,0,255,0.2), rgba(${rarityRgb},0.3))`,
                  animation: 'ultraPrism 2s ease-out forwards',
                  willChange: 'transform,opacity',
                  filter: 'blur(8px)',
                }}
              />
            </div>
          )}

          {/* Ultra rarity — fireworks */}
          {isUltraRarity && (
            <div className="absolute inset-0 pointer-events-none overflow-hidden z-30" style={{ contain: 'strict' }}>
              {[...Array(12)].map((_, i) => {
                const angle = (i / 12) * Math.PI * 2
                const dist = 80 + Math.random() * 60
                const fx = Math.cos(angle) * dist + 'px'
                const fy = Math.sin(angle) * dist + 'px'
                return (
                  <div
                    key={i}
                    className="absolute w-2 h-2 rounded-full"
                    style={{
                      left: '50%',
                      top: '50%',
                      background: `rgba(${rarityRgb},0.9)`,
                      boxShadow: `0 0 8px rgba(${rarityRgb},1)`,
                      '--fx': fx,
                      '--fy': fy,
                      animation: `ultraFirework ${0.8 + Math.random() * 0.4}s ease-out ${0.3 + Math.random() * 0.3}s forwards`,
                      willChange: 'transform,opacity',
                    } as React.CSSProperties}
                  />
                )
              })}
            </div>
          )}

          {/* Jackpot burst — radial explosion behind card */}
          <div
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
            style={{ perspective: '600px' }}
          >
            <div
              className="w-64 h-64 rounded-full"
              style={{
                background: `radial-gradient(circle, rgba(${rarityRgb},0.8), transparent 60%)`,
                animation: 'jackpotBurst 0.8s ease-out forwards',
                willChange: 'transform,opacity',
              }}
            />
          </div>

          {/* Ray burst — rotating rays for high rarity */}
          {isHighRarity && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div
                className="w-80 h-80"
                style={{
                  background: `conic-gradient(from 0deg, transparent 0deg, rgba(${rarityRgb},0.15) 10deg, transparent 20deg, transparent 40deg, rgba(${rarityRgb},0.15) 50deg, transparent 60deg, transparent 80deg, rgba(${rarityRgb},0.15) 90deg, transparent 100deg, transparent 120deg, rgba(${rarityRgb},0.15) 130deg, transparent 140deg, transparent 160deg, rgba(${rarityRgb},0.15) 170deg, transparent 180deg, transparent 200deg, rgba(${rarityRgb},0.15) 210deg, transparent 220deg, transparent 240deg, rgba(${rarityRgb},0.15) 250deg, transparent 260deg, transparent 280deg, rgba(${rarityRgb},0.15) 290deg, transparent 300deg, transparent 320deg, rgba(${rarityRgb},0.15) 330deg, transparent 340deg)`,
                  animation: 'rayBurst 1.5s ease-out forwards',
                  willChange: 'transform,opacity',
                }}
              />
            </div>
          )}

          {/* Card with 3D flip-in reveal */}
          <div
            style={{ perspective: '800px' }}
            className="relative z-10"
          >
            <div
                           className="w-40 h-56 rounded-xl overflow-hidden border-2 shadow-2xl"
              style={{
                animation: isTransitioning
                  ? 'revealCardZoom 0.6s cubic-bezier(0.4,0,0.2,1) forwards'
                  : isUltraRarity
                  ? 'cardGlowIn 0.8s cubic-bezier(0.34,1.56,0.64,1) forwards, ultraCardPulse 2s ease-in-out 1s infinite'
                  : isLegendaryRarity
                    ? 'legendaryCardEntrance 1s cubic-bezier(0.34,1.56,0.64,1) forwards, legendaryGlowPulse 2s ease-in-out 1.2s infinite'
                    : isHighRarity
                      ? 'cardGlowIn 0.8s cubic-bezier(0.34,1.56,0.64,1) forwards'
                      : 'cardSlideUp 0.6s cubic-bezier(0.34,1.56,0.64,1) forwards',
                willChange: 'transform,opacity',
                boxShadow: `0 0 ${isUltraRarity ? '70' : isLegendaryRarity ? '60' : isHighRarity ? '50' : '30'}px rgba(${rarityRgb},${isUltraRarity ? '0.9' : isLegendaryRarity ? '0.8' : isHighRarity ? '0.7' : '0.5'})`,
                borderColor: `rgba(${rarityRgb},0.8)`,
                transformStyle: 'preserve-3d',
                backfaceVisibility: 'visible',
              }}
            >
              {revealedCard?.imageUrl ? (
                <img
                  src={revealedCard.imageUrl}
                  alt={revealedCard.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-slate-800" />
              )}
              {/* Shine on reveal */}
              <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div
                  className="absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                  style={{ animation: 'shimmer 1.5s ease-in-out', willChange: 'transform' }}
                />
              </div>
            </div>
          </div>

          {/* Rarity label — bigger for high rarity */}
          <div className="mt-4 relative z-10" style={{ animation: 'climbLabelIn 0.4s ease-out 0.3s both' }}>
            <span
              className={`font-black uppercase tracking-widest bg-gradient-to-r ${rarityInfo.color} bg-clip-text text-transparent ${isHighRarity ? 'text-lg sm:text-xl' : 'text-sm'}`}
            >
              {rarityInfo.label}
            </span>
          </div>

          {/* Particles for high rarity — optimized count */}
          {isHighRarity && (
            <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ contain: 'strict' }}>
              {[...Array(isUltraRarity ? 14 : isGodlyRarity ? 8 : 5)].map((_, i) => (
                <div
                  key={i}
                  className="absolute w-1.5 h-1.5 rounded-full"
                  style={{
                    left: `${15 + Math.random() * 70}%`,
                    bottom: '20%',
                    background: `rgba(${rarityRgb},0.8)`,
                    animation: `floatParticle ${1.5 + Math.random()}s ease-out ${Math.random() * 0.5}s infinite`,
                    willChange: 'transform,opacity',
                  }}
                />
              ))}
            </div>
          )}

          {/* Crown for godly rarity */}
          {isGodlyRarity && (
            <div
              className="absolute top-8 left-1/2 -translate-x-1/2 flex gap-2 z-20"
              style={{ animation: 'crownPulse 1.5s ease-in-out infinite', willChange: 'transform,opacity' }}
            >
              <span className="text-amber-400 text-xl">♚</span>
              <span className="text-white text-xl">✦</span>
              <span className="text-amber-400 text-xl">♚</span>
            </div>
          )}

          {/* Main character badge — golden highlight with CCG power */}
          {isMainCharacter && (
            <div
              className="absolute top-6 left-1/2 -translate-x-1/2 z-30"
              style={{ animation: 'mainCharBadge 0.6s cubic-bezier(0.34,1.56,0.64,1) 0.4s both' }}
            >
              <div
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-amber-500 to-yellow-400 border-2 border-amber-300"
                style={{ animation: 'mainCharGlow 2s ease-in-out infinite' }}
              >
                <span className="text-base">👑</span>
                <span className="text-xs font-black uppercase tracking-wider text-slate-900 whitespace-nowrap">
                  Главный герой
                </span>
                {revealedCard?.stats && (
                  <span className="text-xs font-black tabular-nums text-slate-900 ml-1">
                    Сила {ccgPower}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* CCG Power — shown when not main character */}
          {!isMainCharacter && revealedCard?.stats && (
            <div
              className="absolute top-8 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center"
              style={{ animation: 'climbLabelIn 0.4s ease-out 0.5s both' }}
            >
              <span
                className="text-[10px] font-bold uppercase tracking-widest text-white/60"
              >
                Сила
              </span>
              <span
                className="text-lg font-black tabular-nums leading-none"
                style={{ color: `rgb(${rarityRgb})`, textShadow: `0 0 10px rgba(${rarityRgb},0.5)` }}
              >
                {ccgPower}
              </span>
            </div>
          )}

        </div>
      )}
    </div>
  )
}
