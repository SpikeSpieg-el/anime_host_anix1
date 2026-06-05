import React from "react"
import Image from "next/image"
import { Swords, Shield, Zap, Lock, Crosshair } from "lucide-react"
import { Card, CardRole } from "../types"
import { rarityConfig } from "@/types/gacha"
import { ROLE_CONFIG } from "../config"
import { FrameOverlay, CoatingOverlay } from "@/components/gacha/card-modifiers"
import { getCardBasePower, getCardRole } from "../utils"

interface BattleCardProps {
  card: Card
  isSecret?: boolean
  isPlayerCard?: boolean
  size?: "sm" | "md" | "lg"
  className?: string
  onClick?: () => void
  onRemove?: () => void
  showPower?: boolean
  powerValue?: number
  isPending?: boolean
  roleMatchupBonus?: number
  synergyBonus?: number
  isInteractive?: boolean
  draggable?: boolean
  onDragStart?: (e: React.DragEvent, cardId: string) => void
  onDragEnd?: (e: React.DragEvent) => void
  onTouchStart?: (e: React.TouchEvent, cardId: string) => void
  onTouchMove?: (e: React.TouchEvent) => void
  onTouchEnd?: (e: React.TouchEvent) => void
  forceHidden?: boolean
}

const isPinterestUrl = (url: string) => url?.includes("i.pinimg.com") || url?.includes("pinimg.com")

const getProxiedSrc = (url: string) => {
  if (!url) return ""
  if (isPinterestUrl(url)) return `/api/image-proxy?url=${encodeURIComponent(url)}`
  return url
}

export const BattleCard: React.FC<BattleCardProps> = ({
  card,
  isSecret = false,
  isPlayerCard = true,
  size = "md",
  className = "",
  onClick,
  onRemove,
  showPower = true,
  powerValue,
  isPending = false,
  roleMatchupBonus = 0,
  isInteractive = true,
  draggable = false,
  onDragStart,
  onDragEnd,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
  forceHidden = false,
}) => {
  const role = card.role || getCardRole(card)
  const finalPower = powerValue !== undefined ? powerValue : getCardBasePower(card)

  const sizeClasses = {
    sm: "w-[72px] h-[108px]",
    md: "w-[100px] h-[150px]",
    lg: "w-[140px] h-[210px]",
  }

  const roleTheme = {
    vanguard: { text: "text-rose-400", border: "border-rose-500/50", innerBorder: "border-rose-400", gradient: "from-rose-600/80", line: "bg-rose-500" },
    guard: { text: "text-cyan-400", border: "border-cyan-500/50", innerBorder: "border-cyan-400", gradient: "from-cyan-600/80", line: "bg-cyan-500" },
    trickster: { text: "text-amber-400", border: "border-amber-500/50", innerBorder: "border-amber-400", gradient: "from-amber-600/80", line: "bg-amber-500" },
  }

  const theme = roleTheme[role] || roleTheme.vanguard

  const getRoleIcon = (cardRole: CardRole, iconSize = "w-4 h-4") => {
    switch (cardRole) {
      case "vanguard": return <Swords className={`${iconSize} text-white drop-shadow-md`} />
      case "guard": return <Shield className={`${iconSize} text-white drop-shadow-md`} />
      case "trickster": return <Zap className={`${iconSize} text-white drop-shadow-md`} />
    }
  }

  return (
    <div
      onClick={onClick}
      draggable={draggable}
      onDragStart={(e) => draggable && onDragStart?.(e, card.uniqueId)}
      onDragEnd={(e) => onDragEnd?.(e)}
      onTouchStart={(e) => onTouchStart?.(e, card.uniqueId)}
      onTouchMove={(e) => onTouchMove?.(e)}
      onTouchEnd={(e) => onTouchEnd?.(e)}
      className={`
        relative select-none rounded-xl overflow-hidden
        shadow-[0_8px_16px_rgba(0,0,0,0.6)] ring-1 ring-white/10
        ${sizeClasses[size]} ${className}
        ${draggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}
        ${isPending ? "scale-95 opacity-80" : "hover:scale-[1.02] transition-transform duration-200"}
      `}
      style={{
        transformStyle: "preserve-3d",
        transform: "translateZ(0)", // Исправляет баги с обрезкой углов (overflow-hidden) в мобильном Safari
      }}
    >
      {/* 1. РУБАШКА (СКРЫТАЯ КАРТА) */}
      {(isSecret && !isPlayerCard) || forceHidden ? (
        <div className="absolute inset-0 bg-slate-950 flex items-center justify-center">
          <div className="absolute inset-0 bg-[linear-gradient(rgba(99,102,241,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(99,102,241,0.1)_1px,transparent_1px)] bg-[size:10px_10px]" />
          <div className="absolute top-0 left-0 w-full h-[200%] bg-gradient-to-b from-transparent via-indigo-500/20 to-transparent animate-[pulse_3s_ease-in-out_infinite]" />
          
          <div className="relative z-10 w-12 h-12 rounded-full border-2 border-indigo-500/30 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="absolute w-full h-full rounded-full border-t-2 border-indigo-400 animate-spin" style={{ animationDuration: "2s" }} />
            <Lock className="w-5 h-5 text-indigo-400" />
          </div>

          <div className="absolute bottom-3 inset-x-2 bg-indigo-950/80 border border-indigo-500/30 rounded px-1 py-1 text-center backdrop-blur-md">
             <span className="text-[8px] font-mono text-indigo-300 uppercase tracking-widest block">Signal Lost</span>
          </div>
        </div>
      ) : (
        /* 2. ЛИЦЕВАЯ СТОРОНА КАРТЫ */
        <div className="absolute inset-0 w-full h-full bg-slate-900 group">
          
          {/* Арт Карты */}
          <Image
            src={getProxiedSrc(card.imageUrl)}
            alt={card.name}
            unoptimized={true}
            className="absolute inset-0 w-full h-full object-cover scale-[1.03]"
            fill
            sizes="(max-width: 640px) 150px, 300px"
            quality={85}
          />
          
          {/* Gacha декорации */}
          {card.coatingModifier && <CoatingOverlay coating={card.coatingModifier} />}
          {card.frameModifier && <FrameOverlay frame={card.frameModifier} />}

          {/* Затемнение под текст */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/80 pointer-events-none mix-blend-multiply" />

          {/* === ЭЛЕМЕНТЫ ВНУТРИ КАРТЫ === */}

          {/* РОЛЬ КАРТЫ (Правый верхний угол) */}
          <div className="absolute top-0 right-0 z-20 rounded-bl-xl overflow-hidden backdrop-blur-md">
            <div className={`px-2.5 pt-1.5 pb-2.5 bg-gradient-to-bl ${theme.gradient} to-slate-900/90 border-b border-l ${theme.border}`}>
              {getRoleIcon(role)}
            </div>
          </div>

          {/* ПОКАЗАТЕЛЬ СИЛЫ (Левый верхний угол, внутри карты) */}
          {showPower && (
            <div className="absolute top-1.5 left-1.5 z-30 drop-shadow-md">
              <div className="relative flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9">
                {/* Внешний фон (ромб) */}
                <div className={`absolute inset-0 bg-gradient-to-br from-slate-800 to-black rounded-[0.3rem] rotate-45 border border-slate-600 ${roleMatchupBonus > 0 ? 'border-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : ''}`} />
                {/* Внутренняя металлическая вставка */}
                <div className={`absolute inset-[3px] bg-gradient-to-br from-slate-200 to-slate-400 rounded-sm rotate-45 border-2 ${theme.innerBorder} flex items-center justify-center`} />
                {/* Текст Силы */}
                <span className="relative z-10 text-[13px] sm:text-[15px] font-black text-slate-900 drop-shadow-sm translate-y-[-1px]">
                  {finalPower}
                </span>
              </div>
            </div>
          )}

          {/* БЛОК ИНФОРМАЦИИ (Внизу) */}
          <div className="absolute bottom-0 inset-x-0 z-20 flex flex-col justify-end">
            
            {/* АНИМАЦИЯ БАФФА (Парит прямо над плашкой имени) */}
            {roleMatchupBonus > 0 && (
              <div className="absolute -top-5 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1 bg-emerald-500 text-white text-[9px] font-black px-2 py-0.5 rounded-t-lg shadow-[0_0_10px_rgba(16,185,129,0.8)] border-t border-x border-emerald-300 animate-bounce">
                <Crosshair className="w-2 h-2" />
                +{Math.round(roleMatchupBonus * 100)}%
              </div>
            )}

            {/* Сама плашка имени */}
            <div 
              className="relative w-full bg-slate-950/90 backdrop-blur-sm pt-2.5 pb-1 px-2 border-t border-white/20"
              style={{ clipPath: "polygon(0 8px, 8px 0, 100% 0, 100% 100%, 0 100%)" }}
            >
              {/* Цветовая линия роли */}
              <div className={`absolute top-0 left-0 w-full h-[2px] ${theme.line}`} />
              
              <div className="flex flex-col">
                <h4 className="text-[10px] sm:text-xs font-black text-white leading-none tracking-tight uppercase truncate">
                  {card.name}
                </h4>
                <span className={`text-[7px] font-bold ${theme.text} uppercase tracking-widest truncate mt-0.5 opacity-80`}>
                  {card.anime || "Unknown Entity"}
                </span>
              </div>
            </div>
          </div>

          {/* FX для игрока (подготовка к ходу) */}
          {isSecret && isPlayerCard && (
            <div className="absolute inset-0 z-30 pointer-events-none rounded-xl border-2 border-indigo-400/50 mix-blend-overlay">
              <div className="absolute top-2 right-2 w-2 h-2 bg-indigo-400 rounded-full animate-ping" />
            </div>
          )}
        </div>
      )}
    </div>
  )
}