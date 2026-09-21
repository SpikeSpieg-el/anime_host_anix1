"use client"

import React, { useState, useEffect, useRef } from "react"
import { Rarity, rarityConfig } from "@/types/gacha"
import { getCardBasePower } from "@/app/battle/utils"
import { getProxiedSrc } from "@/lib/image-loader"

const RARITY_ORDER: Rarity[] = [
  "trash", "common", "uncommon", "rare", "super_rare", "epic",
  "mythic", "legendary", "ancient", "divine", "transcendent", "omnipotent"
]

// 12 взаимосвязанных ветвей трещин
const CONNECTED_CRACKS = [
  "M 50 58 L 49 53 L 52 48 L 48 43",
  "M 48 43 L 53 36 L 49 28 L 52 22",
  "M 50 58 L 53 66 L 47 75 L 51 84",
  "M 52 48 L 42 44 L 34 49 L 24 45 L 16 50",
  "M 53 36 L 63 39 L 72 33 L 82 38 L 88 44",
  "M 47 75 L 58 81 L 68 78 L 78 88 L 84 98",
  "M 51 84 L 41 91 L 32 89 L 24 101 L 18 114",
  "M 52 22 L 50 14 L 54 8 L 48 0",
  "M 51 84 L 49 98 L 53 112 L 48 126 L 52 140",
  "M 24 45 L 29 60 L 22 72 L 32 89 M 72 33 L 68 52 L 74 66 L 68 78",
  "M 16 50 L 8 52 L 0 48 M 88 44 L 94 42 L 100 46 M 18 114 L 10 120 L 0 124 M 84 98 L 92 104 L 100 102",
  "M 42 44 L 32 26 L 22 18 M 63 39 L 76 22 L 86 14 M 41 91 L 32 108 L 24 126 M 58 81 L 70 104 L 78 122"
]

const CRACK_NODES = [
  { cx: 50, cy: 58, minTap: 1 },
  { cx: 48, cy: 43, minTap: 2 },
  { cx: 52, cy: 48, minTap: 4 },
  { cx: 53, cy: 36, minTap: 5 },
  { cx: 47, cy: 75, minTap: 6 },
  { cx: 51, cy: 84, minTap: 7 },
  { cx: 24, cy: 45, minTap: 10 },
  { cx: 72, cy: 33, minTap: 10 },
]

interface GachaAnimationProps {
  isRolling: boolean
  revealedCard: any
  onComplete: () => void
}

export function GachaAnimation({ isRolling, revealedCard, onComplete }: GachaAnimationProps) {
  const [phase, setPhase] = useState<'idle' | 'summon' | 'seal' | 'overload' | 'blackout' | 'supernova' | 'reveal' | 'transition'>('idle')
  const [climbIndex, setClimbIndex] = useState(0)
  const [tapCount, setTapCount] = useState(0)
  const [isImpact, setIsImpact] = useState(false)
  const [justUnlocked, setJustUnlocked] = useState(false)
  const [imageLoaded, setImageLoaded] = useState(false)

  const completedRef = useRef(false)
  const imagePreloadedRef = useRef(false)
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete

  // Флаг полной готовности к интерактиву
  const isReady = phase === 'seal' && Boolean(revealedCard)

  const targetRarityIndex = revealedCard
    ? Math.max(0, RARITY_ORDER.indexOf(revealedCard.rarity as Rarity))
    : 0

  const currentRarity = RARITY_ORDER[climbIndex] || 'trash'
  const currentRarityInfo = rarityConfig[currentRarity]
  const finalRarity = revealedCard?.rarity as Rarity | undefined
  const finalRarityInfo = finalRarity ? rarityConfig[finalRarity] : null

  const isHighRarity = revealedCard && ["epic", "mythic", "legendary", "ancient", "divine", "transcendent", "omnipotent"].includes(revealedCard.rarity)
  const isGodlyRarity = revealedCard && ["divine", "transcendent", "omnipotent"].includes(revealedCard.rarity)
  const isUltraRarity = revealedCard && ["ancient", "divine", "transcendent", "omnipotent"].includes(revealedCard.rarity)
  const isMainCharacter = revealedCard?.isMainCharacter === true

  const ccgPower = revealedCard?.stats ? getCardBasePower(revealedCard) : 0

  const activeRgb = phase === 'reveal' || phase === 'transition'
    ? (finalRarityInfo?.rgb || '147, 51, 234')
    : isReady
      ? (currentRarityInfo?.rgb || '147, 51, 234')
      : '99, 102, 241' // Спокойный индиго пока грузится

  useEffect(() => {
    if (isRolling) {
      completedRef.current = false
      imagePreloadedRef.current = false
      setClimbIndex(0)
      setTapCount(0)
      setIsImpact(false)
      setJustUnlocked(false)
      setImageLoaded(false)
      setPhase('summon')

      const t1 = setTimeout(() => setPhase('seal'), 450)
      return () => clearTimeout(t1)
    } else {
      setPhase('idle')
      setClimbIndex(0)
      setTapCount(0)
      completedRef.current = false
    }
  }, [isRolling])

  // Эффект вспышки разблокировки, когда карта загрузилась
  useEffect(() => {
    if (phase === 'seal' && revealedCard && !justUnlocked) {
      setJustUnlocked(true)
      const t = setTimeout(() => setJustUnlocked(false), 500)
      return () => clearTimeout(t)
    }
  }, [phase, revealedCard])

  // Предзагрузка арта в фоне
  useEffect(() => {
    if (!revealedCard?.imageUrl || imagePreloadedRef.current) return
    imagePreloadedRef.current = true
    const img = new window.Image()
    img.onload = () => setImageLoaded(true)
    img.onerror = () => setImageLoaded(true)
    img.src = getProxiedSrc(revealedCard.imageUrl)
  }, [revealedCard])

  const handleTap = () => {
    if (!isReady || completedRef.current) return

    setIsImpact(true)
    setTimeout(() => setIsImpact(false), 180)

    const nextTaps = tapCount + 1
    setTapCount(nextTaps)

    const isFinalStep = climbIndex >= targetRarityIndex
    if (isFinalStep) {
      triggerDetonation()
    } else {
      setClimbIndex(prev => prev + 1)
    }
  }

  const triggerDetonation = () => {
    setPhase('overload')

    setTimeout(() => {
      setPhase('blackout')
      setTimeout(() => {
        setPhase('supernova')
        setTimeout(() => {
          setPhase('reveal')
        }, 420)
      }, 100)
    }, 400)
  }

  useEffect(() => {
    if (phase !== 'reveal') return
    const revealDuration = isUltraRarity ? 3000 : isHighRarity ? 2600 : 2000
    const t = setTimeout(() => setPhase('transition'), revealDuration)
    return () => clearTimeout(t)
  }, [phase, isUltraRarity, isHighRarity])

  useEffect(() => {
    if (phase !== 'transition') return
    const t = setTimeout(() => {
      if (!completedRef.current) {
        completedRef.current = true
        onCompleteRef.current()
      }
    }, 450)
    return () => clearTimeout(t)
  }, [phase])

  if (phase === 'idle') return null

  return (
    <div
      className="relative w-[290px] sm:w-[330px] h-[470px] sm:h-[510px] flex items-center justify-center overflow-hidden rounded-[2.5rem] bg-[#06070d] shadow-[0_0_50px_rgba(0,0,0,0.9)] select-none border border-slate-800/80"
      style={{ contain: 'layout style paint' }}
    >
      <style>{`
        @keyframes astralAura {
          0%, 100% { transform: scale(1) rotate(0deg); opacity: 0.35; }
          50% { transform: scale(1.1) rotate(180deg); opacity: 0.55; }
        }
        @keyframes runeTurnSlow {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes monolithHover {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-5px); }
        }
        @keyframes tapRecoil {
          0% { transform: scale(0.96); }
          50% { transform: scale(1.03); }
          100% { transform: scale(1); }
        }
        @keyframes collapseVacuum {
          0% { transform: scale(1); opacity: 1; }
          60% { transform: scale(1.15); filter: brightness(2.5); }
          100% { transform: scale(0); opacity: 0; }
        }
        @keyframes blastSupernova {
          0% { opacity: 0; transform: scale(0.2); }
          30% { opacity: 1; transform: scale(1.6); }
          100% { opacity: 0; transform: scale(2.8); }
        }
        @keyframes shardFly {
          0% { opacity: 1; transform: translate(0, 0) scale(1) rotate(0deg); }
          100% { opacity: 0; transform: translate(var(--dx), var(--dy)) scale(0.2) rotate(var(--rot)); }
        }
        @keyframes cardArrival {
          0% { opacity: 0; transform: translateY(50px) scale(0.7) rotateX(25deg); filter: blur(5px) brightness(2); }
          55% { opacity: 1; transform: translateY(-6px) scale(1.03) rotateX(-3deg); filter: blur(0px) brightness(1.2); }
          100% { opacity: 1; transform: translateY(0) scale(1) rotateX(0deg); filter: brightness(1); }
        }
        @keyframes holoShine {
          0% { transform: translateX(-150%) skewX(-25deg); }
          100% { transform: translateX(250%) skewX(-25deg); }
        }
        @keyframes popBadge {
          0% { opacity: 0; transform: translateY(12px) scale(0.9); }
          70% { opacity: 1; transform: translateY(-2px) scale(1.03); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes shockwaveRing {
          0% { transform: scale(0.6); opacity: 0.8; }
          100% { transform: scale(2.2); opacity: 0; }
        }
        @keyframes readyPulseRings {
          0% { transform: scale(0.85); opacity: 0.8; }
          50% { transform: scale(1.2); opacity: 0.2; }
          100% { transform: scale(1.45); opacity: 0; }
        }
        @keyframes energyPulse {
          0% { stroke-dashoffset: 60; }
          100% { stroke-dashoffset: 0; }
        }
        @keyframes veinGlowBreathe {
          0%, 100% { opacity: 0.7; filter: drop-shadow(0 0 3px rgba(var(--active-rgb), 0.8)); }
          50% { opacity: 1; filter: drop-shadow(0 0 7px rgba(var(--active-rgb), 1)); }
        }
        @keyframes ctaBounce {
          0%, 100% { transform: translateY(0px) scale(1); }
          50% { transform: translateY(-3px) scale(1.03); }
        }
      `}</style>

      {/* Космический фон */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute -inset-16 mix-blend-screen transition-all duration-700"
          style={{
            background: `radial-gradient(circle at 50% 50%, rgba(${activeRgb}, ${isReady ? '0.42' : '0.2'}), transparent 68%)`,
            animation: 'astralAura 12s ease-in-out infinite',
          }}
        />
        <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.12)_1px,transparent_1px)] [background-size:16px_16px] opacity-20" />
      </div>

      {/* Сингулярность перед взрывом */}
      {phase === 'blackout' && (
        <div className="absolute inset-0 z-50 bg-black animate-none" />
      )}

      {/* Взрыв Supernova */}
      {phase === 'supernova' && (
        <>
          <div
            className="absolute inset-0 z-40 pointer-events-none"
            style={{
              background: `radial-gradient(circle, #ffffff 0%, rgba(${activeRgb}, 0.85) 45%, transparent 75%)`,
              animation: 'blastSupernova 0.48s ease-out forwards',
            }}
          />
          <div className="absolute inset-0 z-40 pointer-events-none">
            {[...Array(14)].map((_, i) => {
              const angle = (i / 14) * Math.PI * 2
              const dist = 130 + Math.random() * 50
              const dx = `${Math.cos(angle) * dist}px`
              const dy = `${Math.sin(angle) * dist}px`
              const rot = `${(Math.random() - 0.5) * 480}deg`
              return (
                <div
                  key={i}
                  className="absolute left-1/2 top-1/2 w-3 h-5 rounded-sm"
                  style={{
                    background: `linear-gradient(135deg, #ffffff, rgba(${activeRgb}, 0.9))`,
                    '--dx': dx,
                    '--dy': dy,
                    '--rot': rot,
                    animation: 'shardFly 0.5s cubic-bezier(0.1, 0.9, 0.2, 1) forwards',
                  } as React.CSSProperties}
                />
              )
            })}
          </div>
        </>
      )}

      {/* ЭКРАН 1: БЛОК АРКАНЫ И СТАТУС ГОТОВНОСТИ */}
      {(phase === 'summon' || phase === 'seal' || phase === 'overload') && (
        <div
          className={`relative z-20 flex flex-col items-center justify-center w-full h-full ${
            isReady ? 'cursor-pointer' : 'cursor-wait'
          }`}
          onClick={handleTap}
          style={{ '--active-rgb': activeRgb } as React.CSSProperties}
        >
          {/* Внешнее руническое кольцо */}
          <div
            className="absolute w-64 h-64 rounded-full border pointer-events-none transition-colors duration-500"
            style={{
              borderColor: isReady ? `rgba(${activeRgb}, 0.35)` : 'rgba(255,255,255,0.08)',
              animation: 'runeTurnSlow 30s linear infinite',
            }}
          >
            <div className="absolute inset-2 rounded-full border border-dashed border-white/15" />
          </div>

          {/* Волна отдачи при тапе или вспышка при разблокировке */}
          {(isImpact || justUnlocked) && (
            <div
              className="absolute w-44 h-44 rounded-full border pointer-events-none"
              style={{
                borderColor: `rgba(${activeRgb}, 0.85)`,
                animation: 'shockwaveRing 0.35s ease-out forwards',
              }}
            />
          )}

          {/* Приглашающие пульсирующие кольца (пока игрок еще не нажал 1-й раз) */}
          {isReady && tapCount === 0 && (
            <div
              className="absolute w-36 h-52 rounded-[2rem] border pointer-events-none"
              style={{
                borderColor: `rgba(${activeRgb}, 0.6)`,
                animation: 'readyPulseRings 1.8s ease-out infinite',
              }}
            />
          )}

          {/* ЯДРО МОНОЛИТА */}
          <div
            className="relative flex items-center justify-center"
            style={{
              animation: phase === 'overload'
                ? 'collapseVacuum 0.42s ease-in forwards'
                : isImpact
                  ? 'tapRecoil 0.18s ease-out'
                  : 'monolithHover 3.5s ease-in-out infinite',
            }}
          >
            {/* Свечение позади блока */}
            <div
              className="absolute w-44 h-56 rounded-3xl blur-2xl transition-all duration-500 pointer-events-none"
              style={{
                background: `rgb(${activeRgb})`,
                opacity: isReady ? 0.38 + (tapCount / 12) * 0.45 : 0.15,
                transform: `scale(${isReady ? 1 + (tapCount / 12) * 0.25 : 0.85})`,
              }}
            />

            {/* ТЕЛО МОНОЛИТА */}
            <div
              className={`relative w-36 h-52 rounded-[1.8rem] flex flex-col items-center justify-center overflow-hidden transition-all duration-500 shadow-2xl ${
                isReady ? 'hover:scale-[1.03] active:scale-[0.98]' : 'opacity-85'
              }`}
              style={{
                background: isReady
                  ? `radial-gradient(ellipse at 50% 45%, rgba(${activeRgb}, 0.22) 0%, rgba(15, 23, 42, 0.95) 60%, rgba(3, 7, 18, 0.98) 100%)`
                  : 'radial-gradient(ellipse at 50% 50%, rgba(30, 41, 59, 0.6) 0%, rgba(8, 12, 22, 0.98) 100%)',
                borderColor: isReady
                  ? `rgba(${activeRgb}, ${0.5 + (tapCount / 12) * 0.5})`
                  : 'rgba(99, 102, 241, 0.3)',
                boxShadow: isReady
                  ? `0 0 28px rgba(${activeRgb}, ${0.35 + (tapCount / 12) * 0.45}), inset 0 0 16px rgba(${activeRgb}, 0.25)`
                  : '0 0 15px rgba(0,0,0,0.8), inset 0 0 10px rgba(99, 102, 241, 0.15)',
                borderWidth: '1.5px',
                borderStyle: 'solid',
              }}
            >
              {/* Рамка с золотыми уголками */}
              <div
                className="absolute inset-1.5 rounded-[1.4rem] border pointer-events-none transition-colors duration-500"
                style={{ borderColor: isReady ? `rgba(${activeRgb}, 0.35)` : 'rgba(255,255,255,0.08)' }}
              >
                <div className={`absolute top-1 left-1 w-2 h-2 border-t-2 border-l-2 transition-colors duration-500 ${isReady ? 'border-amber-300/80' : 'border-white/20'}`} />
                <div className={`absolute top-1 right-1 w-2 h-2 border-t-2 border-r-2 transition-colors duration-500 ${isReady ? 'border-amber-300/80' : 'border-white/20'}`} />
                <div className={`absolute bottom-1 left-1 w-2 h-2 border-b-2 border-l-2 transition-colors duration-500 ${isReady ? 'border-amber-300/80' : 'border-white/20'}`} />
                <div className={`absolute bottom-1 right-1 w-2 h-2 border-b-2 border-r-2 transition-colors duration-500 ${isReady ? 'border-amber-300/80' : 'border-white/20'}`} />
              </div>

              {/* РЕЖИМ 1: ЛОАДЕР (Пока карта загружается) */}
              {!isReady && (
                <div className="relative z-10 flex flex-col items-center justify-center gap-2">
                  <div className="relative w-12 h-12 flex items-center justify-center">
                    <svg className="w-10 h-10 animate-spin text-indigo-400" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                      <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <span className="absolute text-xs animate-pulse text-indigo-200">✦</span>
                  </div>
                </div>
              )}

              {/* РЕЖИМ 2: ГОТОВ — ЦЕНТРАЛЬНЫЙ ЗВЕЗДНЫЙ ГЛИФ */}
              {isReady && (
                <div
                  className="absolute pointer-events-none transition-all duration-500 flex items-center justify-center"
                  style={{
                    width: '64px',
                    height: '64px',
                    opacity: 0.35 + (tapCount / 12) * 0.4,
                    transform: `scale(${1 + (tapCount / 12) * 0.15})`,
                  }}
                >
                  <div
                    className="w-10 h-10 rounded-full border border-dashed transition-colors duration-500 animate-[runeTurnSlow_20s_linear_infinite]"
                    style={{ borderColor: `rgba(${activeRgb}, 0.6)` }}
                  />
                  <span
                    className="absolute text-xl font-black transition-colors duration-500 drop-shadow-[0_0_8px_currentColor]"
                    style={{ color: `rgb(${activeRgb})` }}
                  >
                    ✦
                  </span>
                </div>
              )}

              {/* СВЯЗАННЫЕ ТОНКИЕ ПРОЖИЛКИ (Только после первого клика) */}
              {isReady && tapCount > 0 && (
                <svg className="absolute inset-0 w-full h-full pointer-events-none z-20" viewBox="0 0 100 140" fill="none">
                  <defs>
                    <linearGradient id="veinPulseGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor={`rgb(${activeRgb})`} stopOpacity="0.8" />
                      <stop offset="50%" stopColor="#ffffff" stopOpacity="1" />
                      <stop offset="100%" stopColor={`rgb(${activeRgb})`} stopOpacity="0.8" />
                    </linearGradient>
                  </defs>

                  {CONNECTED_CRACKS.slice(0, tapCount).map((pathD, i) => {
                    const isLatest = i === tapCount - 1
                    const isHot = tapCount >= 7

                    return (
                      <g key={i}>
                        <path
                          d={pathD}
                          stroke={`rgb(${activeRgb})`}
                          strokeWidth="2.4"
                          strokeLinecap="round"
                          strokeLinejoin="miter"
                          opacity={0.45}
                          style={{
                            filter: `drop-shadow(0 0 4px rgb(${activeRgb}))`,
                            animation: 'veinGlowBreathe 2s ease-in-out infinite',
                          }}
                        />
                        <path
                          d={pathD}
                          stroke={isHot ? 'url(#veinPulseGradient)' : `rgb(${activeRgb})`}
                          strokeWidth="1.0"
                          strokeLinecap="round"
                          strokeLinejoin="miter"
                          strokeDasharray="8 3"
                          style={{
                            animation: 'energyPulse 1.8s linear infinite',
                            filter: isLatest ? 'drop-shadow(0 0 5px #ffffff)' : undefined,
                          }}
                        />
                      </g>
                    )
                  })}

                  {CRACK_NODES.map((node, idx) => {
                    if (tapCount < node.minTap) return null
                    return (
                      <circle
                        key={idx}
                        cx={node.cx}
                        cy={node.cy}
                        r="1.3"
                        fill="#ffffff"
                        style={{
                          filter: `drop-shadow(0 0 4px rgb(${activeRgb}))`,
                        }}
                      />
                    )
                  })}
                </svg>
              )}

              {/* Блик */}
              <div
                className="absolute inset-0 pointer-events-none bg-gradient-to-r from-transparent via-white/12 to-transparent skew-x-[-25deg]"
                style={{ animation: 'holoShine 3.4s ease-in-out infinite' }}
              />
            </div>
          </div>

          {/* ИНФОРМАЦИОННЫЙ БЛОК ВНИЗУ (ЧЕТКИЙ СТАТУС ЗАГРУЗКИ / ПРИЗЫВ К ТАПУ) */}
          <div className="mt-5 flex flex-col items-center gap-2 z-20">
            {/* Состояние 1: Загрузка карты */}
            {!isReady && (
              <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900/90 border border-indigo-500/30 text-indigo-300 shadow-[0_0_15px_rgba(99,102,241,0.2)]">
                <svg className="w-3.5 h-3.5 animate-spin text-indigo-400" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span className="text-[11px] font-black uppercase tracking-[0.18em] animate-pulse">
                  Формирование монолита...
                </span>
              </div>
            )}

            {/* Состояние 2: Монолит готов, ждет кликов */}
            {isReady && (
              <>
                {/* Бейдж текущей редкости */}
                <div
                  key={climbIndex}
                  className="px-4 py-1 rounded-full border backdrop-blur-md transition-all duration-500 shadow-md flex items-center gap-1.5"
                  style={{
                    borderColor: `rgba(${activeRgb}, 0.55)`,
                    background: `linear-gradient(90deg, rgba(${activeRgb}, 0.2), rgba(15,23,42,0.9), rgba(${activeRgb}, 0.2))`,
                    boxShadow: `0 0 14px rgba(${activeRgb}, 0.3)`,
                  }}
                >
                  <div
                    className="w-1.5 h-1.5 rounded-full animate-ping"
                    style={{ background: `rgb(${activeRgb})` }}
                  />
                  <span
                    className="text-[11px] sm:text-xs font-black uppercase tracking-[0.2em] transition-colors duration-500"
                    style={{ color: `rgb(${activeRgb})` }}
                  >
                    {currentRarityInfo.label}
                  </span>
                </div>

                {/* ЯРКАЯ КНОПКА-ПОДСКАЗКА: СРАЗУ ПОНЯТНО, ЧТО НАДО ТАПАТЬ */}
                <div
                  className="flex items-center gap-2 px-4 py-1.5 rounded-xl border transition-all duration-300 shadow-lg cursor-pointer"
                  style={{
                    background: tapCount === 0
                      ? `linear-gradient(90deg, rgba(6,182,212,0.25), rgba(99,102,241,0.3), rgba(6,182,212,0.25))`
                      : `linear-gradient(90deg, rgba(${activeRgb},0.2), rgba(15,23,42,0.8), rgba(${activeRgb},0.2))`,
                    borderColor: tapCount === 0 ? 'rgba(34,211,238,0.7)' : `rgba(${activeRgb}, 0.6)`,
                    boxShadow: tapCount === 0
                      ? '0 0 16px rgba(34,211,238,0.4)'
                      : `0 0 12px rgba(${activeRgb}, 0.3)`,
                    animation: 'ctaBounce 1.6s ease-in-out infinite',
                  }}
                >
                  <span className="text-sm select-none">👆</span>
                  <span
                    className="text-[11px] font-black uppercase tracking-[0.22em] text-white select-none drop-shadow-sm"
                  >
                    {tapCount === 0 ? 'Нажмите на монолит' : 'Ударьте еще раз'}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ЭКРАН 2: РАСКРЫТИЕ КАРТЫ */}
      {(phase === 'reveal' || phase === 'transition') && finalRarityInfo && (
        <div
          className="relative z-30 flex flex-col items-center justify-center w-full h-full"
          style={{ perspective: '900px' }}
        >
          <div
            className="absolute w-60 h-76 rounded-3xl blur-3xl pointer-events-none -z-10"
            style={{
              background: `radial-gradient(circle, rgba(${activeRgb}, 0.7) 0%, transparent 70%)`,
            }}
          />

          {/* САМА КАРТА */}
          <div
            className="relative w-44 h-64 sm:w-48 sm:h-72 rounded-2xl overflow-hidden border-2 shadow-2xl"
            style={{
              animation: 'cardArrival 0.7s cubic-bezier(0.2, 0.85, 0.25, 1) forwards',
              borderColor: `rgb(${activeRgb})`,
              boxShadow: `0 0 ${isUltraRarity ? '55px' : '30px'} rgba(${activeRgb}, 0.75)`,
            }}
          >
            {revealedCard?.imageUrl ? (
              <img
                src={getProxiedSrc(revealedCard.imageUrl)}
                alt={revealedCard?.name || 'Card'}
                className="w-full h-full object-cover select-none"
              />
            ) : (
              <div className="w-full h-full bg-slate-900 flex items-center justify-center text-slate-500 font-bold">
                No Art
              </div>
            )}

            <div
              className="absolute inset-0 pointer-events-none bg-gradient-to-tr from-transparent via-white/30 to-transparent skew-x-[-25deg]"
              style={{ animation: 'holoShine 2.5s ease-in-out infinite' }}
            />
            <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/30 pointer-events-none" />
          </div>

          {/* Финальный бейдж */}
          <div
            className="mt-5 flex flex-col items-center z-30"
            style={{ animation: 'popBadge 0.4s cubic-bezier(0.2, 0.85, 0.25, 1) 0.25s both' }}
          >
            <div
              className="px-4 py-1.5 rounded-full border border-white/25 backdrop-blur-md shadow-lg"
              style={{
                background: `linear-gradient(90deg, rgba(${activeRgb}, 0.2), rgba(15,23,42,0.9), rgba(${activeRgb}, 0.2))`,
              }}
            >
              <span
                className={`text-sm sm:text-base font-black uppercase tracking-[0.2em] bg-gradient-to-r ${finalRarityInfo.color} bg-clip-text text-transparent`}
              >
                ✦ {finalRarityInfo.label} ✦
              </span>
            </div>
          </div>

          {/* Бейдж Главного Героя / Силы */}
          {isMainCharacter ? (
            <div
              className="absolute top-5 left-1/2 -translate-x-1/2 z-40"
              style={{ animation: 'popBadge 0.4s cubic-bezier(0.2, 0.85, 0.25, 1) 0.35s both' }}
            >
              <div className="flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 border border-yellow-200 shadow-[0_0_16px_rgba(245,158,11,0.7)]">
                <span className="text-sm">👑</span>
                <span className="text-xs font-black uppercase tracking-wider text-slate-950">
                  Главный герой
                </span>
                {revealedCard?.stats && (
                  <span className="text-xs font-black tabular-nums text-slate-950 ml-1">
                    · {ccgPower}
                  </span>
                )}
              </div>
            </div>
          ) : revealedCard?.stats ? (
            <div
              className="absolute top-5 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-slate-900/85 border border-white/15 backdrop-blur-sm"
              style={{ animation: 'popBadge 0.4s ease-out 0.35s both' }}
            >
              <span className="text-[10px] font-bold uppercase tracking-widest text-white/50">Сила</span>
              <span className="text-xs font-black tabular-nums text-white" style={{ textShadow: `0 0 8px rgba(${activeRgb}, 0.8)` }}>
                {ccgPower}
              </span>
            </div>
          ) : null}

          {/* Корона для богоподобных редкостей */}
          {isGodlyRarity && (
            <div className="absolute top-2.5 left-1/2 -translate-x-1/2 flex items-center gap-2 text-yellow-300 opacity-90 drop-shadow-[0_0_10px_rgba(253,224,71,0.9)] animate-pulse">
              <span>✦</span>
              <span className="text-lg">♚</span>
              <span>✦</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}