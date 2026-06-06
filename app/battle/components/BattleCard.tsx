import React, { useRef, useEffect, useState } from "react"
import { Lock } from "lucide-react"
import { Card, CardRole } from "../types"
import { rarityConfig } from "@/types/gacha"
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
  forceHidden?: boolean
}

// Глобальный кэш изображений для предотвращения повторных сетевых запросов при рендере
const imageCache: Record<string, HTMLImageElement> = {}

const isExternalUrl = (url: string) => {
  if (!url) return false
  // Check if URL is from external domains that need proxy
  const externalDomains = [
    'i.pinimg.com',
    'pinimg.com',
    'konachan.net',
    'safebooru.org',
    'zerochan.net',
    's3.zerochan.net',
    'shikimori.one'
  ]
  return externalDomains.some(domain => url.includes(domain))
}

const getProxiedSrc = (url: string) => {
  if (!url) return ""
  if (isExternalUrl(url)) return `/api/image-proxy?url=${encodeURIComponent(url)}`
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
  synergyBonus = 0,
  isInteractive = true,
  forceHidden = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const imageRef = useRef<HTMLImageElement | null>(null)
  const [redrawTrigger, setRedrawTrigger] = useState(0)

  const role = card.role || getCardRole(card)
  const finalPower = powerValue !== undefined ? powerValue : getCardBasePower(card)
  const hasKnbBonus = roleMatchupBonus > 0
  const hasSynergyBonus = synergyBonus > 0

  const sizeClasses = {
    sm: "w-[72px] h-[108px] lg:w-[90px] lg:h-[135px]",
    md: "w-[100px] h-[150px] lg:w-[120px] lg:h-[180px]",
    lg: "w-[140px] h-[210px] lg:w-[160px] lg:h-[240px]",
  }

  const baseDimensions = {
    sm: { width: 90, height: 135 },
    md: { width: 120, height: 180 },
    lg: { width: 160, height: 240 },
  }

  const { width, height } = baseDimensions[size]

  const themeColors = {
    vanguard: { primary: "#f43f5e", secondary: "#be123c", light: "#fda4af", dark: "#4c0519" },
    guard: { primary: "#06b6d4", secondary: "#0e7490", light: "#67e8f9", dark: "#083344" },
    trickster: { primary: "#f59e0b", secondary: "#b45309", light: "#fde047", dark: "#451a03" },
  }
  const theme = themeColors[role] || themeColors.vanguard

  // Оптимизированный загрузчик изображений без CORS-запросов
  useEffect(() => {
    const src = getProxiedSrc(card.imageUrl)
    if (!src) return

    if (imageCache[src]) {
      imageRef.current = imageCache[src]
      setRedrawTrigger(prev => prev + 1)
      return
    }

    const img = new Image()
    // НЕ устанавливаем crossOrigin, чтобы избежать CORS блокировок внешних серверов
    img.src = src

    const handleLoad = () => {
      imageCache[src] = img
      imageRef.current = img
      setRedrawTrigger(prev => prev + 1)
    }

    if (img.complete && img.naturalWidth > 0) {
      handleLoad()
    } else {
      img.addEventListener("load", handleLoad)
      img.addEventListener("error", (e) => {
        console.warn("Не удалось загрузить арт карты на canvas:", src, e)
      })
    }

    return () => {
      img.removeEventListener("load", handleLoad)
    }
  }, [card.imageUrl])

  // Векторные иконки для canvas
  const drawShield = (ctx: CanvasRenderingContext2D, x: number, y: number, rSize: number) => {
    ctx.beginPath()
    ctx.moveTo(x, y - rSize / 2)
    ctx.lineTo(x + rSize / 2, y - rSize / 2)
    ctx.quadraticCurveTo(x + rSize / 2, y, x, y + rSize / 2)
    ctx.quadraticCurveTo(x - rSize / 2, y, x - rSize / 2, y - rSize / 2)
    ctx.closePath()
    ctx.fill()
  }

  const drawSwords = (ctx: CanvasRenderingContext2D, x: number, y: number, rSize: number) => {
    ctx.lineWidth = 1.8
    ctx.lineCap = "round"
    ctx.beginPath()
    ctx.moveTo(x - rSize / 2, y + rSize / 2)
    ctx.lineTo(x + rSize / 2, y - rSize / 2)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(x - rSize / 3, y + rSize / 3 - 2)
    ctx.lineTo(x - rSize / 3 + 2, y + rSize / 3)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(x + rSize / 2, y + rSize / 2)
    ctx.lineTo(x - rSize / 2, y - rSize / 2)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(x + rSize / 3, y + rSize / 3 - 2)
    ctx.lineTo(x + rSize / 3 - 2, y + rSize / 3)
    ctx.stroke()
  }

  const drawZap = (ctx: CanvasRenderingContext2D, x: number, y: number, rSize: number) => {
    ctx.beginPath()
    ctx.moveTo(x + rSize / 5, y - rSize / 2)
    ctx.lineTo(x - rSize / 3, y + rSize / 15)
    ctx.lineTo(x - rSize / 20, y + rSize / 15)
    ctx.lineTo(x - rSize / 4, y + rSize / 2)
    ctx.lineTo(x + rSize / 3, y - rSize / 15)
    ctx.lineTo(x + rSize / 20, y - rSize / 15)
    ctx.closePath()
    ctx.fill()
  }

  // Основной цикл рендеринга
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Поддержка экранов повышенной четкости (Retina)
    const dpr = window.devicePixelRatio || 1
    canvas.width = width * dpr
    canvas.height = height * dpr
    ctx.scale(dpr, dpr)

    let animId: number
    let lockAngle = 0

    const render = () => {
      ctx.clearRect(0, 0, width, height)

      if ((isSecret && !isPlayerCard) || forceHidden) {
        // --- РУБАШКА КАРТЫ ---
        ctx.fillStyle = "#020617"
        ctx.fillRect(0, 0, width, height)

        ctx.strokeStyle = "rgba(99, 102, 241, 0.08)"
        ctx.lineWidth = 1
        const gridSize = 10
        for (let x = 0; x < width; x += gridSize) {
          ctx.beginPath()
          ctx.moveTo(x, 0)
          ctx.lineTo(x, height)
          ctx.stroke()
        }
        for (let y = 0; y < height; y += gridSize) {
          ctx.beginPath()
          ctx.moveTo(0, y)
          ctx.lineTo(width, y)
          ctx.stroke()
        }

        const backgroundGradient = ctx.createLinearGradient(0, 0, 0, height)
        backgroundGradient.addColorStop(0, "transparent")
        backgroundGradient.addColorStop(0.5, "rgba(99, 102, 241, 0.05)")
        backgroundGradient.addColorStop(1, "transparent")
        ctx.fillStyle = backgroundGradient
        ctx.fillRect(0, 0, width, height)

        ctx.save()
        ctx.translate(width / 2, height / 2)
        ctx.rotate(lockAngle)
        ctx.strokeStyle = "rgba(99, 102, 241, 0.35)"
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(0, 0, 20, 0, Math.PI * 1.5)
        ctx.stroke()
        ctx.restore()

        ctx.fillStyle = "rgba(0, 0, 0, 0.65)"
        ctx.beginPath()
        ctx.arc(width / 2, height / 2, 16, 0, Math.PI * 2)
        ctx.fill()
        ctx.strokeStyle = "rgba(99, 102, 241, 0.25)"
        ctx.stroke()

        lockAngle += 0.045
      } else {
        // --- ЛИЦЕВАЯ СТОРОНА КАРТЫ ---
        const img = imageRef.current
        if (img && img.complete && img.naturalWidth > 0) {
          // Отрисовка арта с сохранением пропорций (object-cover)
          const imgRatio = img.width / img.height
          const cardRatio = width / height
          let sWidth = img.width
          let sHeight = img.height
          let sx = 0
          let sy = 0

          if (imgRatio > cardRatio) {
            sWidth = img.height * cardRatio
            sx = (img.width - sWidth) / 2
          } else {
            sHeight = img.width / cardRatio
            sy = (img.height - sHeight) / 2
          }

          ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, width, height)
        } else {
          // Заглушка, пока загружается изображение
          ctx.fillStyle = "#0f172a"
          ctx.fillRect(0, 0, width, height)
        }

        // Эффект покрытия (holo/coating)
        if (card.coatingModifier) {
          ctx.save()
          ctx.globalCompositeOperation = "overlay"
          const shimmer = ctx.createLinearGradient(0, 0, width, height)
          shimmer.addColorStop(0, "rgba(255,255,255,0.15)")
          shimmer.addColorStop(0.5, "rgba(139, 92, 246, 0.25)")
          shimmer.addColorStop(1, "rgba(255,255,255,0.15)")
          ctx.fillStyle = shimmer
          ctx.fillRect(0, 0, width, height)
          ctx.restore()
        }

        // Рамка карты
        if (card.frameModifier) {
          ctx.strokeStyle = "rgba(234, 179, 8, 0.6)"
          ctx.lineWidth = 3
          ctx.strokeRect(0, 0, width, height)
        }

        // Мягкое затемнение для читаемости текста
        const shadowGrad = ctx.createLinearGradient(0, 0, 0, height)
        shadowGrad.addColorStop(0, "rgba(0, 0, 0, 0.35)")
        shadowGrad.addColorStop(0.35, "transparent")
        shadowGrad.addColorStop(0.7, "transparent")
        shadowGrad.addColorStop(1, "rgba(0, 0, 0, 0.85)")
        ctx.fillStyle = shadowGrad
        ctx.fillRect(0, 0, width, height)

        // Иконка Роли (Правый верхний угол)
        ctx.save()
        ctx.beginPath()
        ctx.moveTo(width - 24, 0)
        ctx.lineTo(width, 0)
        ctx.lineTo(width, 24)
        ctx.lineTo(width - 14, 24)
        ctx.closePath()
        
        const badgeGrad = ctx.createLinearGradient(width - 24, 0, width, 24)
        badgeGrad.addColorStop(0, theme.secondary)
        badgeGrad.addColorStop(1, "rgba(15, 23, 42, 0.95)")
        ctx.fillStyle = badgeGrad
        ctx.fill()
        ctx.strokeStyle = theme.primary
        ctx.lineWidth = 1
        ctx.stroke()
        ctx.restore()

        ctx.save()
        ctx.fillStyle = "#ffffff"
        ctx.strokeStyle = "#ffffff"
        if (role === "vanguard") drawSwords(ctx, width - 10, 10, 8)
        if (role === "guard") drawShield(ctx, width - 10, 10, 8)
        if (role === "trickster") drawZap(ctx, width - 10, 10, 8)
        ctx.restore()

        // Значок Силы (Левый верхний угол)
        if (showPower) {
          const px = 18
          const py = 18
          const pSize = 13

          ctx.save()
          ctx.translate(px, py)
          ctx.rotate(45 * Math.PI / 180)

          ctx.fillStyle = "rgba(0,0,0,0.55)"
          ctx.fillRect(-pSize + 1, -pSize + 1, pSize * 2, pSize * 2)

          const diamondGrad = ctx.createLinearGradient(-pSize, -pSize, pSize, pSize)
          diamondGrad.addColorStop(0, "#1e293b")
          diamondGrad.addColorStop(1, "#020617")
          ctx.fillStyle = diamondGrad
          ctx.beginPath()
          ctx.rect(-pSize, -pSize, pSize * 2, pSize * 2)
          ctx.fill()

          ctx.strokeStyle = hasKnbBonus ? "#10b981" : hasSynergyBonus ? "#8b5cf6" : "#64748b"
          ctx.lineWidth = hasKnbBonus || hasSynergyBonus ? 2 : 1
          ctx.stroke()
          ctx.restore()

          ctx.save()
          ctx.translate(px, py)
          ctx.rotate(45 * Math.PI / 180)
          ctx.fillStyle = "rgba(226, 232, 240, 0.9)"
          ctx.beginPath()
          ctx.rect(-pSize + 2, -pSize + 2, (pSize - 2) * 2, (pSize - 2) * 2)
          ctx.fill()
          ctx.strokeStyle = theme.primary
          ctx.lineWidth = 1
          ctx.stroke()
          ctx.restore()

          ctx.save()
          ctx.fillStyle = "#0f172a"
          ctx.font = "900 12px system-ui, -apple-system, sans-serif"
          ctx.textAlign = "center"
          ctx.textBaseline = "middle"
          ctx.fillText(finalPower.toString(), px, py - 0.5) 
          ctx.restore()
        }

        // Подложка под Имя (Нижний блок)
        const nameplateHeight = 32
        ctx.save()
        ctx.beginPath()
        ctx.moveTo(0, height - nameplateHeight + 6)
        ctx.lineTo(6, height - nameplateHeight)
        ctx.lineTo(width, height - nameplateHeight)
        ctx.lineTo(width, height)
        ctx.lineTo(0, height)
        ctx.closePath()

        ctx.fillStyle = "rgba(2, 6, 23, 0.92)"
        ctx.fill()
        ctx.strokeStyle = "rgba(255, 255, 255, 0.15)"
        ctx.lineWidth = 1
        ctx.stroke()

        ctx.fillStyle = theme.primary
        ctx.fillRect(0, height - nameplateHeight, width, 2)
        ctx.restore()

        // Название Карты и Франшизы
        ctx.save()
        ctx.textAlign = "left"
        
        ctx.fillStyle = "#ffffff"
        const nameFontSize = width < 100 ? 8 : 10
        ctx.font = `900 ${nameFontSize}px system-ui, -apple-system, sans-serif`
        const displayName = card.name.toUpperCase()
        
        const maxTextWidth = width - 12
        let measuredWidth = ctx.measureText(displayName).width
        if (measuredWidth > maxTextWidth) {
          ctx.font = `900 ${nameFontSize - 1.5}px system-ui, -apple-system, sans-serif`
        }
        ctx.fillText(displayName, 6, height - 16)

        ctx.fillStyle = theme.light
        const subFontSize = width < 100 ? 5.5 : 6.5
        ctx.font = `700 ${subFontSize}px system-ui, -apple-system, sans-serif`
        const displayAnime = (card.anime || "UNKNOWN ENTITY").toUpperCase()
        ctx.fillText(displayAnime, 6, height - 6)
        ctx.restore()
      }

      if ((isSecret && !isPlayerCard) || forceHidden) {
        animId = requestAnimationFrame(render)
      }
    }

    render()

    return () => {
      cancelAnimationFrame(animId)
    }
  }, [
    redrawTrigger,
    card,
    isSecret,
    isPlayerCard,
    size,
    powerValue,
    roleMatchupBonus,
    synergyBonus,
    forceHidden,
    width,
    height,
    finalPower,
  ])

  return (
    <div
      onClick={isInteractive ? onClick : undefined}
      className={`
        relative select-none rounded-xl overflow-hidden
        shadow-[0_8px_16px_rgba(0,0,0,0.6)] ring-1 ring-white/10
        ${sizeClasses[size]} ${className}
        ${isInteractive ? "cursor-pointer" : "cursor-default"}
        ${isPending ? "scale-95 opacity-80" : "hover:scale-[1.02] active:scale-[0.99] transition-all duration-200"}
        ${hasKnbBonus ? "animate-knbHighlight" : ""}
      `}
      style={{
        transformStyle: "preserve-3d",
        transform: "translateZ(0)",
      }}
    >
      <canvas
        ref={canvasRef}
        className="block w-full h-full pointer-events-none"
      />

      {isSecret && !isPlayerCard && (
        <div className="absolute inset-0 z-30 pointer-events-none flex flex-col justify-between items-center p-3">
          <div className="w-8 h-8 rounded-full border border-indigo-500/20 bg-black/40 backdrop-blur-sm flex items-center justify-center mt-5">
            <Lock className="w-3.5 h-3.5 text-indigo-400/90 animate-pulse" />
          </div>
          <div className="bg-indigo-950/80 border border-indigo-500/30 rounded px-1.5 py-0.5 text-center backdrop-blur-md mb-1">
            <span className="text-[6.5px] font-mono text-indigo-300 uppercase tracking-widest block">
              SIGNAL LOST
            </span>
          </div>
        </div>
      )}

      {!isSecret && hasKnbBonus && (
        <div className="absolute top-[82%] left-1/2 -translate-x-1/2 z-40 flex items-center gap-0.5 bg-emerald-500 text-white text-[7.5px] lg:text-[8px] font-black px-1.5 py-0.5 rounded-t-lg shadow-[0_0_12px_rgba(16,185,129,0.9)] border-t border-x border-emerald-300 animate-bounce pointer-events-none whitespace-nowrap">
          +{Math.round(roleMatchupBonus * 100)}%
        </div>
      )}
      {!isSecret && hasSynergyBonus && !hasKnbBonus && (
        <div className="absolute top-[82%] left-1/2 -translate-x-1/2 z-40 flex items-center gap-0.5 bg-violet-500 text-white text-[7.5px] lg:text-[8px] font-black px-1.5 py-0.5 rounded-t-lg shadow-[0_0_12px_rgba(139,92,246,0.9)] border-t border-x border-violet-300 animate-pulse pointer-events-none whitespace-nowrap">
          +{synergyBonus}
        </div>
      )}

      {isSecret && isPlayerCard && (
        <div className="absolute inset-0 z-30 pointer-events-none rounded-xl border-2 border-indigo-400/50 mix-blend-overlay">
          <div className="absolute top-2 right-2 w-1.5 h-1.5 bg-indigo-400 rounded-full animate-ping" />
        </div>
      )}
    </div>
  )
}