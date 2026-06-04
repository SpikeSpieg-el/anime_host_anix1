import React, { useState, useRef, useCallback, useEffect } from "react"
import Image from "next/image"
import { Star, Swords, Shield, Zap, RefreshCcw, HelpCircle } from "lucide-react"
import { Card, CardRole } from "../types"
import { rarityConfig } from "@/types/gacha"
import { ROLE_CONFIG } from "../config"
import { FrameOverlay, CoatingOverlay } from "@/components/gacha/card-modifiers"
import { getCardBasePower, getCardRole } from "../utils"

interface BattleCardProps {
  card: Card
  isSecret?: boolean
  size?: "sm" | "md" | "lg"
  className?: string
  onClick?: () => void
  onRemove?: () => void
  showPower?: boolean
  powerValue?: number
  isPending?: boolean
  roleMatchupBonus?: number
  isInteractive?: boolean
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
  size = "md",
  className = "",
  onClick,
  onRemove,
  showPower = true,
  powerValue,
  isPending = false,
  roleMatchupBonus = 0,
  isInteractive = true,
}) => {
  const [rotation, setRotation] = useState({ x: 0, y: 0 })
  const [isHovered, setIsHovered] = useState(false)
  const [isTouching, setIsTouching] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)
  const animationFrameRef = useRef<number | null>(null)

  const role = card.role || getCardRole(card)
  const roleConf = ROLE_CONFIG[role] || ROLE_CONFIG.vanguard
  const finalPower = powerValue !== undefined ? powerValue : getCardBasePower(card)

  const rarity = card.rarity || "common"
  const config = rarityConfig[rarity] || rarityConfig.common

  // Dynamic dimension styles
  const sizeClasses = {
    sm: "w-[72px] h-[102px] sm:w-[84px] sm:h-[120px] text-[9px] rounded-lg",
    md: "w-[85px] h-[125px] sm:w-[115px] sm:h-[165px] md:w-[135px] md:h-[195px] text-xs rounded-xl",
    lg: "w-[145px] h-[210px] sm:w-[170px] sm:h-[245px] text-sm rounded-2xl",
  }

  // 3D Motion Event Handlers
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!isInteractive || isTouching) return
    const cardEl = cardRef.current
    if (!cardEl) return

    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current)

    animationFrameRef.current = requestAnimationFrame(() => {
      const rect = cardEl.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      const xc = rect.width / 2
      const yc = rect.height / 2
      const angleX = -(yc - y) / (yc / 12) // Max 12 deg
      const angleY = (xc - x) / (xc / 12)

      setRotation({ x: angleX, y: angleY })
      setIsHovered(true)
    })
  }, [isInteractive, isTouching])

  const handleMouseLeave = useCallback(() => {
    if (!isInteractive) return
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current)

    animationFrameRef.current = requestAnimationFrame(() => {
      setRotation({ x: 0, y: 0 })
      setIsHovered(false)
    })
  }, [isInteractive])

  const handleTouchStart = useCallback(() => {
    if (!isInteractive) return
    setIsTouching(true)
  }, [isInteractive])

  const handleTouchMove = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (!isInteractive || e.touches.length === 0) return
    const cardEl = cardRef.current
    if (!cardEl) return

    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current)

    const touch = e.touches[0]
    animationFrameRef.current = requestAnimationFrame(() => {
      const rect = cardEl.getBoundingClientRect()
      const x = touch.clientX - rect.left
      const y = touch.clientY - rect.top
      const xc = rect.width / 2
      const yc = rect.height / 2
      const angleX = -(yc - y) / (yc / 12)
      const angleY = (xc - x) / (xc / 12)

      setRotation({ x: angleX, y: angleY })
      setIsHovered(true)
    })
  }, [isInteractive])

  const handleTouchEnd = useCallback(() => {
    if (!isInteractive) return
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current)

    animationFrameRef.current = requestAnimationFrame(() => {
      setRotation({ x: 0, y: 0 })
      setIsHovered(false)
      setIsTouching(false)
    })
  }, [isInteractive])

  useEffect(() => {
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current)
    }
  }, [])

  const highlightX = -rotation.y * 1.5
  const highlightY = rotation.x * 1.5

  // Get Role Icon
  const getRoleIcon = (cardRole: CardRole, iconSize = "w-3 h-3") => {
    switch (cardRole) {
      case "vanguard":
        return <Swords className={`${iconSize} text-rose-400`} />
      case "guard":
        return <Shield className={`${iconSize} text-blue-400`} />
      case "trickster":
        return <Zap className={`${iconSize} text-amber-400`} />
    }
  }

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onClick={onClick}
      className={`relative select-none transition-transform duration-300 ease-out cursor-pointer overflow-hidden border-2 ${
        isPending ? "border-dashed border-indigo-500/80 animate-pulse" : "border-white/10"
      } ${sizeClasses[size]} ${config.glow} shadow-lg ${className}`}
      style={{
        transform: `perspective(800px) rotateX(${rotation.x}deg) rotateY(${rotation.y}deg)`,
        transformStyle: "preserve-3d",
        touchAction: isTouching ? "none" : "auto",
      }}
    >
      {/* 1. SECRET / FACE DOWN CARD BACK */}
      {isSecret ? (
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-950 via-slate-900 to-indigo-900 flex flex-col justify-between p-2 sm:p-2.5 overflow-hidden">
          {/* Neon Runes Pattern Background */}
          <div className="absolute inset-0 opacity-20 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-indigo-500 via-transparent to-transparent pointer-events-none" />
          <div className="absolute inset-2 border border-indigo-500/20 rounded-md pointer-events-none flex items-center justify-center">
            <div className="w-10 h-10 rounded-full border border-dashed border-indigo-500/30 animate-spin" style={{ animationDuration: "10s" }} />
          </div>

          {/* Central Logo */}
          <div className="absolute inset-0 m-auto w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-slate-950/80 border border-indigo-500/40 flex items-center justify-center shadow-[0_0_15px_rgba(99,102,241,0.4)] animate-pulse z-10">
            <HelpCircle className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-400" />
          </div>

          {/* Top Info */}
          <div className="relative z-10 flex justify-between items-center w-full">
            <div className="px-1.5 py-0.5 rounded bg-black/60 border border-indigo-500/30 text-[7px] sm:text-[8px] font-black uppercase tracking-wider text-indigo-300">
              Скрыто
            </div>
          </div>

          {/* Right Role Stripe (Always visible!) */}
          <div className={`absolute right-0 top-0 bottom-0 w-[20px] sm:w-[22px] md:w-[26px] bg-black/80 backdrop-blur-sm border-l border-white/5 flex flex-col items-center justify-center py-2 z-10`}>
            {getRoleIcon(role, "w-3 h-3 sm:w-3.5 sm:h-3.5")}
            <div className="mt-1 flex flex-col justify-center items-center h-full">
              {roleConf.name.split("").map((char, index) => (
                <span
                  key={index}
                  className={`text-[7px] sm:text-[8px] md:text-[9px] font-black leading-none uppercase ${roleConf.color}`}
                >
                  {char}
                </span>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* 2. FACE UP FRONT SIDE */
        <div className="absolute inset-0 w-full h-full flex flex-col justify-between overflow-hidden bg-slate-950">
          {/* Card Portrait */}
          <div className="absolute inset-0 w-full h-full pointer-events-none">
            <Image
              src={getProxiedSrc(card.imageUrl)}
              alt={card.name}
              unoptimized={true}
              className="absolute inset-0 w-full h-full object-cover scale-[1.01]"
              fill
              sizes="(max-width: 640px) 150px, 300px"
              quality={80}
              referrerPolicy="no-referrer"
            />
            {/* Shading/Vignette */}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/95 via-slate-950/30 to-slate-950/30" />
          </div>

          {/* Gacha Cosmetics Overlays */}
          {card.coatingModifier && <CoatingOverlay coating={card.coatingModifier} />}
          {card.frameModifier && <FrameOverlay frame={card.frameModifier} />}

          {/* Holographic light highlight sheen */}
          <div
            className="absolute inset-0 opacity-0 transition-opacity duration-300 pointer-events-none z-10"
            style={{
              background: `radial-gradient(circle at ${50 + highlightX}% ${50 + highlightY}%, rgba(255,255,255,0.18) 0%, transparent 60%)`,
              opacity: isHovered ? 1 : 0,
            }}
          />

          {/* FRONT TOP UI HEADER */}
          <div className="relative top-2 inset-x-2 flex justify-between items-start pointer-events-none z-10 pr-[20px] sm:pr-[24px]">
            <div className="flex flex-col gap-0.5 sm:gap-1">
              {/* Rarity Label (hidden on small size to save space) */}
              {size !== "sm" && (
                <div className="px-1.5 py-0.5 rounded-md text-[8px] sm:text-[9px] font-black uppercase tracking-wider backdrop-blur-md bg-black/50 border border-white/10 shadow-md w-fit">
                  <span className={`bg-gradient-to-r ${config.color} bg-clip-text text-transparent`}>
                    {config.label}
                  </span>
                </div>
              )}
            </div>

            {/* Score Star */}
            {size !== "sm" && card.score && (
              <div className="flex items-center gap-0.5 bg-black/60 backdrop-blur-md px-1 py-0.5 rounded-full border border-white/10 shadow-md">
                <Star className="w-2.5 h-2.5 text-yellow-400 fill-yellow-400" />
                <span className="text-[8px] font-black text-white">{card.score.toFixed(1)}</span>
              </div>
            )}
          </div>

          {/* FRONT BOTTOM UI FOOTER */}
          <div className="relative bottom-2 inset-x-2 pointer-events-none z-10 pr-[20px] sm:pr-[24px]">
            {/* Title / Name */}
            <h4 className="text-[10px] sm:text-[11px] font-black text-white leading-tight drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)] truncate">
              {card.name}
            </h4>

            {/* Anime / Bonus info */}
            <div className="flex items-center mt-0.5 sm:mt-1">
              {roleMatchupBonus > 0 ? (
                <div className="bg-emerald-500 text-white text-[8px] font-black px-1 rounded shadow-lg animate-pulse">
                  +{Math.round(roleMatchupBonus * 100)}%
                </div>
              ) : (
                <span className="text-[8px] text-slate-400 font-bold uppercase truncate max-w-[50px] sm:max-w-[60px]">
                  {card.anime}
                </span>
              )}
            </div>
          </div>

          {/* RIGHT ROLE STRIPE (PROMINENT - AS REQUESTED!) */}
          <div className={`absolute right-0 top-0 bottom-0 w-[20px] sm:w-[22px] md:w-[26px] bg-black/80 backdrop-blur-md border-l border-white/5 flex flex-col items-center py-2 z-20`}>
            {getRoleIcon(role, "w-3 h-3 sm:w-3.5 sm:h-3.5")}
            <div className="mt-1 flex-1 flex flex-col justify-center items-center">
              {roleConf.name.split("").map((char, index) => (
                <span
                  key={index}
                  className={`text-[7px] sm:text-[8px] md:text-[9px] font-black leading-none uppercase ${roleConf.color}`}
                >
                  {char}
                </span>
              ))}
            </div>
            {showPower && (
              <div className="mt-auto flex flex-col items-center">
                <span className="text-[7px] sm:text-[8px] text-emerald-400 font-black leading-none">⚡</span>
                <span className="text-[8px] sm:text-[9px] text-emerald-400 font-black leading-none">{finalPower}</span>
              </div>
            )}
          </div>

          {/* Delete/Remove button if onRemove is provided (useful in deck building pending list) */}
          {onRemove && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onRemove()
              }}
              className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-rose-500 hover:bg-rose-600 text-white flex items-center justify-center text-[10px] shadow-lg border border-white/10 z-30 pointer-events-auto"
            >
              X
            </button>
          )}
        </div>
      )}
    </div>
  )
}
