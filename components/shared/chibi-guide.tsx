"use client"

import { useState, useEffect, useRef, useCallback, useMemo, useTransition } from "react"
import { usePathname } from "next/navigation"
import Link from "next/link"
import { X, ChevronRight, Sparkles, Dices, Quote, Moon, ArrowUp, Bell, BellOff, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Anime } from "@/lib/shikimori"
import { AnimeCard } from "@/components/shared/anime-card"
import { fetchRandomAnime } from "@/app/catalog/actions/get-random-anime"

export const CHIBI_STORAGE_KEY = "chibi-guide-enabled"
export const CHIBI_SPEECH_MODE_KEY = "chibi-speech-mode"
export const CHIBI_TOGGLE_EVENT = "chibi-toggle-event"

export type ActionType = 
  | 'none'
  | 'wave'       // Взмах ручкой
  | 'love'       // Сердечко
  | 'peek'       // Антенна
  | 'star'       // Звезда
  | 'spin'       // Вихрь
  | 'surprise'   // Испуг от скролла
  | 'yawn'       // Зевок
  | 'giggle'     // Щекотка
  | 'spark'      // Вспышка
  | 'dizzy'      // Оффлайн

const ANIME_QUOTES = [
  { text: "«Если не сдаваться, мечта обязательно станет реальностью.»", author: "Наруто" },
  { text: "«Тот, кто не умеет ценить прошлое, не построит будущее.»", author: "Ковбой Бибоп" },
  { text: "«Слабые люди не имеют права выбирать, как они умрут.»", author: "Клинок, рассекающий демонов" },
  { text: "«Нет ничего постыдного в том, чтобы упасть. Позорно не подняться.»", author: "Баскетбол Куроко" },
  { text: "«Человек силен потому, что может меняться.»", author: "Ванпанчмен" },
  { text: "«Я становлюсь сильнее каждый день. Даже когда сплю.»", author: "Гочису Макфреш" },
  { text: "«Самые сильные духом — те, кто умеет быть слабым.»", author: "Хаято" },
  { text: "«Потеряв всё, я понял: главное — это то, что внутри.»", author: "Дзедзиро Окадзаки" },
  { text: "«Мне нечего терять. Я уже проиграл свою жизнь.»", author: "Окисари" },
  { text: "«Счастье — это когда тебя понимают, даже если ты смотришь аниме в три часа ночи.»", author: "Анонимный зритель" },
  { text: "«Лучше один раз попробовать, чем сто раз пожалеть. Особенно перед финальной серией.»", author: "Фанат дорама" }
]

// ====================================================================
// 🌌 Процедурный Dot-Matrix Сгусток
// ====================================================================
interface FluidWispProps {
  size?: number
  actionRef: React.MutableRefObject<{ type: ActionType; startTime: number; duration: number }>
  lastActiveRef: React.MutableRefObject<number>
  isSleepingRef: React.MutableRefObject<boolean>
  mousePosRef: React.MutableRefObject<{ x: number; y: number; isNear: boolean; isPressing: boolean }>
  pettingScoreRef: React.MutableRefObject<number>
  onHideChange?: (hidingProgress: number) => void
  isOffline?: boolean
  className?: string
}

function FluidWisp({
  size = 80,
  actionRef,
  lastActiveRef,
  isSleepingRef,
  mousePosRef,
  pettingScoreRef,
  onHideChange,
  isOffline = false,
  className
}: FluidWispProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const onHideChangeRef = useRef(onHideChange)
  onHideChangeRef.current = onHideChange

  const isOfflineRef = useRef(isOffline)
  isOfflineRef.current = isOffline

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    let animId: number
    const GRID = 13
    const SPACING = size / (GRID + 1)
    const MAX_DOT_R = SPACING * 0.44
    const scale = size / 80

    const physics = {
      coreX: 0,
      coreY: 0,
      lookX: 0,
      lookY: 0,
      armWeight: 0,
      heartWeight: 0,
      starWeight: 0,
      antennaWeight: 0,
      mouthOpen: 0,
      spinAngle: 0,
      giggleOffset: 0,
      squishX: 1,
      squishY: 1,
      noiseAmp: 0.8,
      sleepWeight: 0,
      hideProgress: 0,
      colorHue: 28,
      purrPulse: 0,
    }

    let lastReportedHide = 0

    const render = (now: number) => {
      const time = now * 0.002
      const isForcedSleep = isSleepingRef.current
      const offline = isOfflineRef.current
      const idleTimeSec = isForcedSleep ? 60 : Math.max(0, (now - lastActiveRef.current) / 1000)

      const action = actionRef.current
      const actionElapsed = now - action.startTime
      const isActionActive = !isForcedSleep && actionElapsed < action.duration
      const actionProgress = isActionActive ? actionElapsed / action.duration : 1
      const actionCurve = isActionActive ? Math.sin(actionProgress * Math.PI) : 0
      const currentActionType = isActionActive ? action.type : 'none'

      // Поглаживание
      const isBeingPetted = !isForcedSleep && pettingScoreRef.current > 60
      physics.purrPulse = isBeingPetted ? Math.sin(time * 24) * 0.08 : 0

      // Логика сна
      const targetSleep = isForcedSleep ? 1 : (!isActionActive && idleTimeSec > 16) ? Math.min(1, (idleTimeSec - 16) / 4) : 0
      const targetHide = isForcedSleep ? 0.85 : (!isActionActive && idleTimeSec > 34) ? Math.min(1, (idleTimeSec - 34) / 5) : 0
      const isAutoYawning = !isForcedSleep && idleTimeSec >= 13.5 && idleTimeSec <= 16 && !isActionActive
      const autoYawnWeight = isAutoYawning ? Math.sin(((idleTimeSec - 13.5) / 2.5) * Math.PI) : 0

      physics.sleepWeight += (targetSleep - physics.sleepWeight) * (isForcedSleep ? 0.1 : 0.04)
      physics.hideProgress += (targetHide - physics.hideProgress) * (isForcedSleep ? 0.08 : 0.03)

      // Оповещаем родителя без лишних вызовов
      if (Math.abs(lastReportedHide - physics.hideProgress) > 0.03) {
        lastReportedHide = physics.hideProgress
        if (onHideChangeRef.current) {
          onHideChangeRef.current(physics.hideProgress)
        }
      }

      // Веса трансформаций (во сне они плавно затухают)
      const targetArm = (!isForcedSleep && currentActionType === 'wave') ? actionCurve : 0
      const targetHeart = (!isForcedSleep && (currentActionType === 'love' ? actionCurve : 0)) || (isBeingPetted ? 1 : 0)
      const targetStar = (!isForcedSleep && (currentActionType === 'star' || currentActionType === 'spark')) ? actionCurve : 0
      const targetAntenna = !isForcedSleep ? ((currentActionType === 'peek' ? actionCurve : 0) || (mousePosRef.current.isNear && physics.sleepWeight < 0.2 ? 0.8 : 0)) : 0
      const targetMouth = (!isForcedSleep ? (currentActionType === 'yawn' ? actionCurve : 0) : 0) || autoYawnWeight
      const targetSurprise = (!isForcedSleep && currentActionType === 'surprise') ? actionCurve : 0
      const isGiggling = !isForcedSleep && currentActionType === 'giggle'

      physics.armWeight += (targetArm - physics.armWeight) * 0.12
      physics.heartWeight += (targetHeart - physics.heartWeight) * 0.1
      physics.starWeight += (targetStar - physics.starWeight) * 0.1
      physics.antennaWeight += (targetAntenna - physics.antennaWeight) * 0.08
      physics.mouthOpen += (targetMouth - physics.mouthOpen) * 0.12

      if (currentActionType === 'spin' && isActionActive && !isForcedSleep) {
        physics.spinAngle += 0.14
      } else {
        physics.spinAngle *= 0.85
      }

      physics.giggleOffset = isGiggling ? Math.sin(time * 30) * 3 : 0

      const isPressing = mousePosRef.current.isPressing
      const pressSquishX = isPressing ? 1.25 : 1
      const pressSquishY = isPressing ? 0.72 : 1

      // Плавное спокойное дыхание во сне
      const sleepBreath = physics.sleepWeight * Math.sin(time * 2.5) * 0.05

      let targetSquishX = (1 + physics.sleepWeight * 0.35 - targetSurprise * 0.15 - autoYawnWeight * 0.18 + (isGiggling ? 0.15 : 0) + sleepBreath) * pressSquishX + physics.purrPulse
      let targetSquishY = (1 - physics.sleepWeight * 0.3 + targetSurprise * 0.25 + autoYawnWeight * 0.25 - (isGiggling ? 0.15 : 0) - sleepBreath) * pressSquishY - physics.purrPulse
      physics.squishX += (targetSquishX - physics.squishX) * 0.1
      physics.squishY += (targetSquishY - physics.squishY) * 0.1

      let targetHue = 28
      if (offline || currentActionType === 'dizzy') targetHue = 210
      else if (physics.heartWeight > 0.1) targetHue = 345
      else if (targetStar > 0.1) targetHue = 48
      else if (targetSurprise > 0.1) targetHue = 15

      physics.colorHue += (targetHue - physics.colorHue) * 0.08
      physics.noiseAmp = (0.7 - physics.sleepWeight * 0.5 + targetSurprise * 1.2 + (offline ? 0.6 : 0))

      const mouse = mousePosRef.current
      const clampedMouseX = Math.max(-25, Math.min(25, mouse.x))
      const clampedMouseY = Math.max(-25, Math.min(25, mouse.y))

      // Траектория центра
      const targetCoreX = isForcedSleep 
        ? Math.sin(time * 0.6) * 1.2 
        : Math.sin(time * 0.8) * 4.5 + (mouse.isNear ? clampedMouseX * 0.12 : 0) + physics.giggleOffset

      const targetCoreY = isForcedSleep
        ? Math.cos(time * 0.5) * 1.0 + physics.sleepWeight * 4
        : Math.cos(time * 0.6) * 3.5 + (mouse.isNear ? clampedMouseY * 0.12 : 0) + physics.sleepWeight * 4

      physics.coreX += (targetCoreX - physics.coreX) * 0.06
      physics.coreY += (targetCoreY - physics.coreY) * 0.06

      const targetLookX = (!isForcedSleep && mouse.isNear) ? Math.max(-4, Math.min(4, clampedMouseX * 0.14)) : Math.sin(time * 0.5) * 2.5
      const targetLookY = (!isForcedSleep && mouse.isNear) ? Math.max(-3.5, Math.min(3.5, clampedMouseY * 0.14)) : Math.cos(time * 0.4) * 1.8
      physics.lookX += (targetLookX - physics.lookX) * 0.08
      physics.lookY += (targetLookY - physics.lookY) * 0.08

      const isBlinking = (Math.sin(time * 1.8) > 0.96 || Math.sin(time * 0.47 + 2) > 0.97) && physics.sleepWeight < 0.3

      // Масштабированные координаты глаз
      const eyeL_WorldX = size / 2 + (physics.coreX - 7 * scale + physics.lookX * (1 - physics.sleepWeight)) * physics.squishX
      const eyeL_WorldY = size / 2 + (physics.coreY - 2.5 * scale + physics.lookY * (1 - physics.sleepWeight)) * physics.squishY
      const eyeR_WorldX = size / 2 + (physics.coreX + 7 * scale + physics.lookX * (1 - physics.sleepWeight)) * physics.squishX
      const eyeR_WorldY = size / 2 + (physics.coreY - 2.5 * scale + physics.lookY * (1 - physics.sleepWeight)) * physics.squishY

      const eyeL_gx = Math.max(0, Math.min(GRID - 1, Math.round(eyeL_WorldX / SPACING) - 1))
      const eyeL_gy = Math.max(0, Math.min(GRID - 1, Math.round(eyeL_WorldY / SPACING) - 1))
      const eyeR_gx = Math.max(0, Math.min(GRID - 1, Math.round(eyeR_WorldX / SPACING) - 1))
      const eyeR_gy = Math.max(0, Math.min(GRID - 1, Math.round(eyeR_WorldY / SPACING) - 1))

      ctx.clearRect(0, 0, size, size)

      const centerX = size / 2
      const centerY = size / 2

      const armWaveY = Math.sin(time * 8) * 4.5
      const armX = physics.coreX + 15 * scale
      const armY = physics.coreY - 9 * scale + armWaveY

      const antennaX = physics.coreX + Math.sin(time * 4) * 2
      const antennaY = physics.coreY - 21 * scale

      for (let gy = 0; gy < GRID; gy++) {
        for (let gx = 0; gx < GRID; gx++) {
          const rawX = (gx + 1) * SPACING
          const rawY = (gy + 1) * SPACING

          let dx = (rawX - centerX) / physics.squishX
          let dy = (rawY - centerY) / physics.squishY

          if (physics.spinAngle > 0.01) {
            const cosA = Math.cos(physics.spinAngle)
            const sinA = Math.sin(physics.spinAngle)
            const rx = dx * cosA - dy * sinA
            const ry = dx * sinA + dy * cosA
            dx = rx
            dy = ry
          }

          const distToCenter = Math.sqrt(dx * dx + dy * dy)
          const angle = Math.atan2(dy, dx)

          const noise = (Math.sin(angle * 3 + time * 1.5) * 3 + Math.cos(angle * 5 - time) * 2) * physics.noiseAmp
          const baseRadius = size * 0.29 + noise

          let armInfluence = 0
          if (physics.armWeight > 0.01) {
            const distArm = Math.hypot(dx - armX, dy - armY)
            armInfluence = Math.max(0, 1 - distArm / (7 * scale)) * 8.5 * physics.armWeight
          }

          let antennaInfluence = 0
          if (physics.antennaWeight > 0.01) {
            const distAntenna = Math.hypot(dx - antennaX, dy - antennaY)
            antennaInfluence = Math.max(0, 1 - distAntenna / (6 * scale)) * 7.5 * physics.antennaWeight
          }

          let heartMod = 0
          if (physics.heartWeight > 0.01) {
            const hAngle = angle + Math.PI / 2
            const heartCurve = (Math.sin(hAngle) * Math.sqrt(Math.abs(Math.cos(hAngle)))) / (Math.sin(hAngle) + 1.4) - 0.2
            heartMod = heartCurve * 11 * physics.heartWeight
          }

          const starMod = Math.cos(angle * 4) * 6.5 * physics.starWeight
          const totalRadius = baseRadius + armInfluence + antennaInfluence + heartMod + starMod
          const delta = totalRadius - distToCenter

          if (delta > -3.2) {
            const edgeFactor = Math.min(Math.max((delta + 3.2) / 7.2, 0), 1)
            let dotR = MAX_DOT_R * edgeFactor

            const isSingleLeftEye = (gx === eyeL_gx && gy === eyeL_gy)
            const isSingleRightEye = (gx === eyeR_gx && gy === eyeR_gy)
            const isEye = isSingleLeftEye || isSingleRightEye

            const mouthX = physics.coreX
            const mouthY = physics.coreY + 5 * scale
            const distMouth = Math.hypot(dx - mouthX, dy - mouthY)

            let fillStyle = ""

            // 🌙 Глаза во сне: аккуратные дуги (— —)
            if (physics.sleepWeight > 0.35) {
              const isSleepEyeRow = (gy === eyeL_gy) && (
                (gx >= eyeL_gx - 1 && gx <= eyeL_gx + 1) || 
                (gx >= eyeR_gx - 1 && gx <= eyeR_gx + 1)
              )
              if (isSleepEyeRow) {
                fillStyle = "rgba(15, 23, 42, 0.9)"
                dotR = MAX_DOT_R * 0.55
              } else {
                const distToCore = Math.hypot(dx - physics.coreX, dy - physics.coreY)
                const isCore = distToCore < totalRadius * 0.42
                const lightness = isCore ? 63 : 50
                const alpha = Math.min(0.85, Math.max(0.12, edgeFactor * (0.8 - physics.hideProgress * 0.25)))
                fillStyle = `hsla(${physics.colorHue}, 90%, ${lightness}%, ${alpha})`
              }
            } else if (isEye && !isBlinking) {
              if (physics.heartWeight > 0.2 || physics.starWeight > 0.2) {
                fillStyle = "#ffffff"
                dotR = MAX_DOT_R * 1.2
              } else {
                fillStyle = "#0f172a"
                dotR = MAX_DOT_R * 1.05
              }
            } else if (distMouth < 3.8 && (physics.mouthOpen > 0.25 || isGiggling)) {
              fillStyle = "#991b1b"
              dotR = MAX_DOT_R * 0.8
            } else {
              const distToCore = Math.hypot(dx - physics.coreX, dy - physics.coreY)
              const isCore = distToCore < totalRadius * 0.42
              const lightness = isCore ? 64 : 52
              const alpha = Math.min(0.95, Math.max(0.15, edgeFactor * 0.95))
              fillStyle = `hsla(${physics.colorHue}, 95%, ${lightness}%, ${alpha})`
            }

            const renderX = centerX + dx * physics.squishX
            const renderY = centerY + dy * physics.squishY

            ctx.beginPath()
            ctx.arc(renderX, renderY, Math.max(0.4, dotR), 0, Math.PI * 2)
            ctx.fillStyle = fillStyle
            ctx.fill()
          }
        }
      }

      animId = requestAnimationFrame(render)
    }

    animId = requestAnimationFrame(render)
    return () => cancelAnimationFrame(animId)
  }, [size, actionRef, lastActiveRef, isSleepingRef, mousePosRef, pettingScoreRef])

  return (
    <div className={cn("relative flex items-center justify-center select-none touch-none", className)}>
      <canvas ref={canvasRef} width={size} height={size} />
    </div>
  )
}

// ====================================================================
// Основной контроллер
// ====================================================================
export function ChibiGuide() {
  const [isEnabled, setIsEnabled] = useState<boolean>(true)
  const [isBubbleOpen, setIsBubbleOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [activeTab, setActiveTab] = useState<'main' | 'oracle' | 'quote'>('main')
  const [hideFraction, setHideFraction] = useState(0)
  const [isPettedActive, setIsPettedActive] = useState(false)
  const [isOffline, setIsOffline] = useState(false)
  const [atBottom, setAtBottom] = useState(false)

  // Режим реплик ('auto' | 'click')
  const [speechMode, setSpeechMode] = useState<'auto' | 'click'>('auto')

  const [quoteIndex, setQuoteIndex] = useState(0)
  const [randomAnime, setRandomAnime] = useState<Anime | null>(null)
  const [isRandomLoading, setIsRandomLoading] = useState(false)

  // Реф сна и таймеры
  const isSleepingRef = useRef<boolean>(false)
  const autoBubbleTimeout = useRef<NodeJS.Timeout | null>(null)

  const lastActiveTimestamp = useRef<number>(performance.now())
  const currentAction = useRef<{ type: ActionType; startTime: number; duration: number }>({
    type: 'none',
    startTime: 0,
    duration: 0
  })

  const mousePos = useRef<{ x: number; y: number; isNear: boolean; isPressing: boolean }>({
    x: 0,
    y: 0,
    isNear: false,
    isPressing: false
  })

  const tapHistory = useRef<number[]>([])
  const pettingScore = useRef(0)
  const lastStrokePos = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const lastScrollY = useRef(0)
  const isFirstMount = useRef(true)
  const pathname = usePathname()

  // Запуск действия
  const triggerAction = useCallback((type: ActionType, durationMs: number = 1800) => {
    if (isSleepingRef.current && type !== 'wave' && type !== 'love') return
    lastActiveTimestamp.current = performance.now()
    currentAction.current = {
      type,
      startTime: performance.now(),
      duration: durationMs
    }
  }, [])

  // Автоматический показ подсказки
  const triggerAutoBubble = useCallback(() => {
    if (speechMode !== 'auto' || isSleepingRef.current) return
    setIsBubbleOpen(true)
    setActiveTab('main')

    if (autoBubbleTimeout.current) clearTimeout(autoBubbleTimeout.current)
    autoBubbleTimeout.current = setTimeout(() => {
      setIsBubbleOpen(false)
    }, 5500)
  }, [speechMode])

  const [, startTransition] = useTransition()

  // Загрузка случайного аниме для оракула
  const fetchRandomAnimeAction = useCallback(async () => {
    if (isSleepingRef.current) return
    setIsRandomLoading(true)
    startTransition(() => {
      fetchRandomAnime()
        .then(setRandomAnime)
        .catch((error) => {
          console.error("Error fetching random anime:", error)
          setRandomAnime(null)
        })
        .finally(() => setIsRandomLoading(false))
    })
  }, [])

  // Обработка активности пользователя
  const handleUserActivity = useCallback((isDirect = false) => {
    if (isSleepingRef.current) {
      if (!isDirect) return // Во сне игнорируем случайные движения
      isSleepingRef.current = false // Просыпается только от прямого клика по маскоту
    }

    const now = performance.now()
    const wasDeepSleep = (now - lastActiveTimestamp.current) > 16000
    lastActiveTimestamp.current = now

    if (wasDeepSleep && currentAction.current.type === 'none') {
      triggerAction('wave', 1800)
    }
  }, [triggerAction])

  // Поглаживание
  const handlePettingStroke = useCallback((clientX: number, clientY: number) => {
    if (isSleepingRef.current) return

    handleUserActivity(true)
    const dx = clientX - lastStrokePos.current.x
    const dy = clientY - lastStrokePos.current.y
    const dist = Math.hypot(dx, dy)

    lastStrokePos.current = { x: clientX, y: clientY }

    if (dist > 3 && dist < 45) {
      pettingScore.current = Math.min(100, pettingScore.current + dist * 1.5)
      if (pettingScore.current > 60) {
        setIsPettedActive(true)
        triggerAction('love', 2200)
      }
    }
  }, [handleUserActivity, triggerAction])

  // Щекотка
  const registerTap = useCallback(() => {
    const now = performance.now()
    tapHistory.current = [...tapHistory.current.filter(t => now - t < 700), now]
    if (tapHistory.current.length >= 3) {
      triggerAction('giggle', 1600)
      tapHistory.current = []
    }
  }, [triggerAction])

  useEffect(() => {
    const interval = setInterval(() => {
      pettingScore.current = Math.max(0, pettingScore.current * 0.85 - 2)
      if (pettingScore.current < 20) {
        setIsPettedActive(false)
      }
    }, 100)
    return () => clearInterval(interval)
  }, [])

  // Слушатели событий
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (isMobile || isSleepingRef.current) return
      handleUserActivity(false)
      const w = window.innerWidth
      const h = window.innerHeight
      const mascotX = 50
      const mascotY = h - 50
      const dx = e.clientX - mascotX
      const dy = e.clientY - mascotY

      mousePos.current.x = dx
      mousePos.current.y = dy
      mousePos.current.isNear = Math.hypot(dx, dy) < 220
    }

    const onScroll = () => {
      if (isSleepingRef.current) return
      handleUserActivity(false)
      const delta = Math.abs(window.scrollY - lastScrollY.current)
      if (delta > 360 && currentAction.current.type === 'none') {
        triggerAction('surprise', 1200)
      }
      lastScrollY.current = window.scrollY
      setAtBottom(window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 60)
    }

    const onCopy = () => {
      if (isSleepingRef.current) return
      handleUserActivity(false)
      triggerAction('spark', 2000)
      triggerAutoBubble()
    }

    const onOnline = () => {
      setIsOffline(false)
      if (!isSleepingRef.current) {
        triggerAction('wave', 2000)
        triggerAutoBubble()
      }
    }
    const onOffline = () => {
      setIsOffline(true)
      if (!isSleepingRef.current) {
        triggerAction('dizzy', 3000)
        triggerAutoBubble()
      }
    }

    const onVisibility = () => {
      if (!document.hidden && !isSleepingRef.current) handleUserActivity(false)
    }

    window.addEventListener("mousemove", onMove, { passive: true })
    window.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("copy", onCopy)
    window.addEventListener("online", onOnline)
    window.addEventListener("offline", onOffline)
    document.addEventListener("visibilitychange", onVisibility)

    setIsOffline(!navigator.onLine)

    return () => {
      window.removeEventListener("mousemove", onMove)
      window.removeEventListener("scroll", onScroll)
      window.removeEventListener("copy", onCopy)
      window.removeEventListener("online", onOnline)
      window.removeEventListener("offline", onOffline)
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [handleUserActivity, triggerAction, atBottom, triggerAutoBubble, isMobile])

  // Реакция на смену страниц
  useEffect(() => {
    if (!isEnabled || isSleepingRef.current) return

    if (isFirstMount.current) {
      isFirstMount.current = false
      triggerAction('wave', 1800)
      triggerAutoBubble()
      return
    }

    handleUserActivity(false)

    // 🎮 Разделы с уникальными реакциями
    const path = pathname.toLowerCase()

    if (path.includes("/gacha")) {
      triggerAction('star', 2500) // Звезда для гачи
    } else if (path.includes("/battle")) {
      triggerAction('spin', 1800) // Вихрь для битвы
    } else if (path.includes("/watch") || path.includes("/manga/")) {
      triggerAction('love', 1800) // Сердечко для контента
    } else if (path.includes("/catalog") || path.includes("/bookmarks")) {
      triggerAction('peek', 1600) // Антенна для каталога
    } else if (path.includes("/watch")) {
      triggerAction('wave', 1500) // Взмах для просмотра
    } else if (path.includes("/market")) {
      triggerAction('spark', 2000) // Вспышка для торговли
    } else if (path.includes("/schedule")) {
      triggerAction('wave', 1400) // Взмах для расписания
    } else if (path.includes("/news") || path.includes("/faq")) {
      triggerAction('peek', 1500) // Антенна для новостей
    }

    triggerAutoBubble()
  }, [pathname, isEnabled, triggerAction, handleUserActivity, triggerAutoBubble])

  // Контекстные подсказки
  const contextualMessage = useMemo(() => {
    const hour = new Date().getHours()

    if (isOffline) {
      return { text: "Кажется, связь с космосом пропала! Проверь интернет 📡" }
    }

    if (atBottom) {
      return {
        text: "Ты долистал до самого дна! Поднимемся наверх?",
        action: { label: "Наверх", onClick: () => window.scrollTo({ top: 0, behavior: "smooth" }) }
      }
    }

    // 🎮 Разделы с персонализированными сообщениями
    if (pathname.includes("/gacha")) {
      const gachaPhrases = [
        "Чувствую скорый дроп легендарки! Крути с верой в удачу ✨",
        "Сегодня день рожденья для твоего арсенала! 🎁",
        "Не забудь про пакеты — там спрятаны жемчужины! 💎",
        "Удача любит смелых! Попробуй редкий дроп! 🎲",
        "Крутишь, крутишь... и снова нуб? Не сдавайся, следующий раз повезёт! 🎰",
        "Легендарный предмет уже смотрит на тебя из-за угла 😏",
        "Совет мудрого духа: не продавай редкое в панике! Подожди пару дней 💸",
        "Твой баг-хант готов? Иногда лучший дроп — это найденная ошибка 🐛",
        "Судьба решает! А судьба, как известно, любит тех, кто верит ✨"
      ]
      return { text: gachaPhrases[Math.floor(Math.random() * gachaPhrases.length)] }
    }

    if (pathname.includes("/battle")) {
      const battlePhrases = [
        "Арена полна соперников. Покажи силу своей колоды! ⚔️",
        "Твоя колода готова к бою? Проверь синергию! 🃏",
        "Соперники ждут — не откладывай победу на потом! 🏆",
        "Используй способности умно, каждый ход важен! ⚡",
        "Победа за 1 секунду до поражения — это лучший адреналин! 🔥",
        "Не полагайся только на удачу, в битве решает стратегия 🧠",
        "Секретный синер-комбо готов? Тогда вперёд к трону чемпиона! 👑",
        "Проиграл не значит провалился — просто собери новую колоду 💪"
      ]
      return { text: battlePhrases[Math.floor(Math.random() * battlePhrases.length)] }
    }

    if (pathname.includes("/watch")) {
      // Определение жанра по URL (например /watch/[id]?genre=action)
      const genreMatch = pathname.match(/genre=(\w+)/)
      const genre = genreMatch ? genreMatch[1] : "default"
      
      const animePhrases: Record<string, string[]> = {
        action: [
          "Готов к экшену! Битвы будут жаркими! ⚔️",
          "Адаптируйся или проиграешь в этом мире боевых искусств! 🥋",
          "Сила — это не всё, но она помогает выживать! 💪",
          "Твой хай-рок готов? Тогда включай и рви экран от адреналина! 🔥",
          "Лучший финал битвы — неожиданный поворот в последнюю секунду 🌀"
        ],
        romance: [
          "Сердце бьётся чаще! Романтика на полную! 💕",
          "Любовь побеждает все преграды! ❤️",
          "Кто твой идеальный партнёр? 🌸",
          "Иногда лучший сюжет — это просто два человека и много диалогов 😍",
          "Не бойся признать чувства — даже в аниме так делают! 💗"
        ],
        fantasy: [
          "Магия и мистика ждут тебя! ✨",
          "Древние силы просыпаются... 🔮",
          "Легендарные существа уже рядом! 🐉",
          "Где-то там дракон ждёт своего героя... это ты! 🧙‍♂️",
          "В этом мире правила не существуют — только воля и меч ⚔️"
        ],
        sciFi: [
          "Киберпанк или научная фантастика на вечер! 🚀",
          "Технологии изменили всё, но человечность осталась! 🤖",
          "Космос — бесконечные возможности! 🌌",
          "ИИ уже думает о будущем... а ты уже смотрел? 🛸",
          "Межгалактический закат начинается прямо сейчас ✨"
        ],
        horror: [
          "Осторожно, здесь страшно! 👻",
          "Не оборачивайся... 🕯️",
          "Тьма скрывает свои тайны... 🦇",
          "Лучший способ победить монстра — это понять его мотивацию 🧟",
          "Выключи свет, если осмелишься досмотреть до конца 😱"
        ],
        comedy: [
          "Смех — лучшее лекарство! 😂",
          "Жизнь полна абсурда, но это весело! 🎭",
          "Не смейся слишком громко, иначе все узнают! 🤪",
          "Если смешно — значит, ты выбрал правильно! 🎉",
          "Смешные тайтлы лечат лучше любого сериала 😄"
        ],
        sliceOfLife: [
          "Уютная слайс-оф-лайф комедия для души! ☕",
          "Мелочи жизни — самые ценные моменты 🌸",
          "Просто наслаждайся моментом! 🎨",
          "Иногда лучший сюжет — это тишина и чашка чая 🍵",
          "Здесь нет драмы, только теплое чувство уюта 🏡"
        ],
        mystery: [
          "Загадка за загадкой! Раскрой тайну! 🔍",
          "Логика и интуиция на страже! 🕵️",
          "Истина где-то рядом... 💡",
          "Подсказка от духа: не верь всему, что видишь 👀",
          "Разгадка ближе, чем ты думаешь — просто перемотай назад 🔙"
        ],
        psychological: [
          "Глубокий психологический триллер ждёт тебя! 🧠",
          "Реальность — это иллюзия? 🌀",
          "Твоя психика готова к испытаниям? 🎭",
          "Смотри внимательно — детали решают всё 🕶️",
          "Некоторые вопросы лучше не задавать вслух... 🤫"
        ],
        isekai: [
          "Другой мир, другая жизнь! 🌍",
          "Второе рождение начинается здесь! ⚡",
          "Новые возможности в новом мире! 🗡️",
          "Пробудись, герой! Твой призыв уже звучит 🔔",
          "Иногда лучший способ сбежать от проблем — это телепортация ✨"
        ],
        default: [
          "Отличный выбор тайтла! Не забудь поставить в избранное 📺",
          "Эпизоды уже ждут тебя — включай и наслаждайся! 🎬",
          "Хочешь узнать спойлеры? Я не подскажу 😉",
          "Добавь в список просмотра, чтобы не потерять нить сюжета!"
        ]
      }

      const genrePhrases = animePhrases[genre] || animePhrases.default
      return { text: genrePhrases[Math.floor(Math.random() * genrePhrases.length)] }
    }

    if (pathname.includes("/manga/")) {
      const mangaPhrases = [
        "Отличный манга! Читай главу за главой 📖",
        "Не забудь поставить оценку после прочтения ⭐",
        "Хочешь найти похожие тайтлы? Используй фильтры!",
        "Манга-марафон — это круто, но не забывай отдыхать!",
        "Панели и диалоги — лучший способ провести вечер! 📚",
        "Не пропусти финальную главу — она всегда самая сильная! 🎬",
        "Спойлер от духа: обложка часто врёт... но иногда и правда 😏"
      ]
      return { text: mangaPhrases[Math.floor(Math.random() * mangaPhrases.length)] }
    }

    if (pathname.includes("/watch")) {
      const watchPhrases = [
        "Твой список просмотра готов! Выбирай тайтл 📺",
        "Не забудь поставить отметку «Смотрел» после серии ✅",
        "Хочешь продолжить просмотр? Я помогу найти последний эпизод!",
        "Отличный выбор! Наслаждайся атмосферой тайтла 🎭",
        "12 серий в неделю — это не шутка, но и не приговор 😅",
        "Не забудь поставить «Смотрел», иначе духа разбудить будет сложно 💤"
      ]
      return { text: watchPhrases[Math.floor(Math.random() * watchPhrases.length)] }
    }

    if (pathname.includes("/schedule")) {
      const schedulePhrases = [
        "Расписание обновлено! Проверь новые серии 📅",
        "Новые тайтлы ждут своего часа — не пропусти релиз! ⏰",
        "Лучшее время для просмотра — когда все готовы к экшену 🎬"
      ]
      return { text: schedulePhrases[Math.floor(Math.random() * schedulePhrases.length)] }
    }

    if (pathname.includes("/news")) {
      const newsPhrases = [
        "Новости аниме-мира — свежо и актуально! 📰",
        "Свежие слухи уже на столе — разбираем вместе 🔎",
        "Аниме-индустрия не спит, как и ты в ночной сессии 😴"
      ]
      return { text: newsPhrases[Math.floor(Math.random() * newsPhrases.length)] }
    }

    if (pathname.includes("/faq")) {
      const faqPhrases = [
        "Ответы на частые вопросы найдены! 🤔",
        "Все твои вопросы уже были заданы раньше — вот ответы 💡",
        "Не паникуй, помощь рядом и она бесплатна 😌"
      ]
      return { text: faqPhrases[Math.floor(Math.random() * faqPhrases.length)] }
    }

    // 🎉 Праздничные и сезонные сообщения (еaster eggs)
    const now = new Date()
    const month = now.getMonth()
    const dayOfYear = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000)

    if ((month === 1 && dayOfYear >= 20 && dayOfYear <= 23) || (month === 3 && dayOfYear <= 1)) {
      return { text: "🎄 Новый год! Время праздничных тайтлов и горячего чая! 🍵" }
    }
    if (month === 4 && dayOfYear >= 30 && dayOfYear <= 32) {
      return { text: "🌸 Ханами-сезон! Идеальное время для уютных слайс-оф-лайф аниме! 🍃" }
    }
    if (month === 5 && dayOfYear >= 4 && dayOfYear <= 6) {
      return { text: "🌸 День цветущей сакуры! Красота вокруг и отличный повод для романтики 💕" }
    }
    if (month === 7 && dayOfYear >= 19 && dayOfYear <= 22) {
      return { text: "⛩️ Обон! Праздник духов — время для глубоких тайтлов о традициях 🏯" }
    }
    if (month === 8 && dayOfYear >= 30 && dayOfYear <= 31) {
      return { text: "🎆 Ханэсэки! Фейерверки и летние тайтлы — лучший дуэт! 🌙" }
    }
    if (month === 12 && dayOfYear >= 24 && dayOfYear <= 26) {
      return { text: "🎄 Рождество! Уютные тайтлы и горячий шоколад — идеальное сочетание ☕" }
    }

    // 🥳 День рождения духа (каждый 100-й день года)
    if (dayOfYear % 100 === 0 && dayOfYear > 0) {
      return { text: "🎂 Сегодня мой день рождения! Спасибо, что ты со мной! Погладь меня в честь праздника! 💖" }
    }

    // 🐱 Пасхалка для разработчиков
    if (pathname.includes("easter-eggs") || pathname.includes("/easter")) {
      const easterPhrases = [
        "Поздравляю с находкой пасхалки! Ты настоящий искатель сокровищ! 🏴‍☠️",
        "Скрытое сообщение: дух гордится тем, что ты его нашёл! 🎉",
        "Разработчик улыбнулся, увидев тебя здесь! Спасибо за любовь к деталям! 💝"
      ]
      return { text: easterPhrases[Math.floor(Math.random() * easterPhrases.length)] }
    }

    if (pathname.includes("/dmca") || pathname.includes("/privacy") || pathname.includes("/terms")) {
      const legalPhrases = [
        "Юридические документы важны, но не скучны! ⚖️",
        "Читай мелкий шрифт — вдруг там спрятаны бонусы 📜",
        "Правовая база крепка, как финальный бой аниме 💪"
      ]
      return { text: legalPhrases[Math.floor(Math.random() * legalPhrases.length)] }
    }

    if (pathname.includes("/help")) {
      const helpPhrases = [
        "Нужна помощь? Я здесь, чтобы поддержать! 💬",
        "Сложный вопрос? Разберём его по полочкам 🧩",
        "Помощь на связи — как любимый герой в критический момент 🦸"
      ]
      return { text: helpPhrases[Math.floor(Math.random() * helpPhrases.length)] }
    }

    if (pathname.includes("/market")) {
      const marketPhrases = [
        "Торговая площадка оживает! Обменяйся редкими картами 🎴",
        "Лучший момент для сделки — когда все готовы торговать 💹",
        "Не переплачивай за легенду в панике, подожди пару дней 🧐"
      ]
      return { text: marketPhrases[Math.floor(Math.random() * marketPhrases.length)] }
    }

    if (pathname.includes("/catalog") || pathname.includes("/bookmarks")) {
      const catalogPhrases = [
        "Используй фильтры каталога для поиска скрытых шедевров 🔍",
        "Сортируй по рейтингу — найди лучшие тайтлы! 🏅",
        "Не забудь добавить в избранное понравившиеся аниме 📌",
        "Фильтр по жанрам поможет найти идеальное настроение!",
        "Каталог безграничен, как и твои возможности для просмотра 🌟",
        "Скрытый жемчужина может быть прямо на первой странице! 💎"
      ]
      return { text: catalogPhrases[Math.floor(Math.random() * catalogPhrases.length)] }
    }

    // 🕒 Временные сообщения
    if (hour >= 0 && hour < 6) {
      const nightMessages = [
        "Ночной марафон тайтлов? Не забывай про воду и сон 🌙",
        "Поздний сеанс — это круто, но не забудь про завтрашний день ☕",
        "Космос наблюдает за твоим ночным просмотром... он одобряет ✨"
      ]
      return { text: nightMessages[Math.floor(Math.random() * nightMessages.length)] }
    }
    if (hour >= 6 && hour < 12) {
      const morningMessages = [
        "Доброе утро! Прекрасный день для новой серии ☀️",
        "Свежий ум — лучший зритель. Наслаждайся утренним тайтлом 🌅",
        "Новый день, новые эпизоды — жизнь прекрасна! 🎬"
      ]
      return { text: morningMessages[Math.floor(Math.random() * morningMessages.length)] }
    }
    if (hour >= 12 && hour < 18) {
      const afternoonMessages = [
        "День в разгаре! Идеальное время для аниме-паузы ☕",
        "Обед закончился? Пора загрузиться полезным контентом 🍱",
        "После обеда лучший отдых — это хорошая серия 😴"
      ]
      return { text: afternoonMessages[Math.floor(Math.random() * afternoonMessages.length)] }
    }
    if (hour >= 18 && hour < 23) {
      const eveningMessages = [
        "Вечер настал — пора включать любимый тайтл! 🌆",
        "Закат идеален для уютного просмотра с попкорном 🍿",
        "Лучшее время суток для эпической истории наступило! ⭐"
      ]
      return { text: eveningMessages[Math.floor(Math.random() * eveningMessages.length)] }
    }

    // 🎉 Общие приветственные сообщения
    const greetingMessages = [
      "Привет! Я твой дух-проводник. Можешь погладить меня или спросить совет ✨",
      "Добро пожаловать в мир аниме! Готов помочь с выбором тайтла 🌟",
      "Я здесь, чтобы сделать просмотр ещё веселее — не стесняйся гладить 💖"
    ]
    return {
      text: greetingMessages[Math.floor(Math.random() * greetingMessages.length)],
      action: { label: "В Каталог", href: "/catalog" }
    }
  }, [pathname, atBottom, isOffline])

  // Загрузка настроек
  useEffect(() => {
    const saved = localStorage.getItem(CHIBI_STORAGE_KEY)
    if (saved !== null) setIsEnabled(saved === "true")

    const savedSpeechMode = localStorage.getItem(CHIBI_SPEECH_MODE_KEY)
    if (savedSpeechMode === 'auto' || savedSpeechMode === 'click') {
      setSpeechMode(savedSpeechMode)
    }

    const handleToggle = (e: CustomEvent<{ enabled: boolean }>) => setIsEnabled(e.detail.enabled)
    window.addEventListener(CHIBI_TOGGLE_EVENT as any, handleToggle as any)
    return () => window.removeEventListener(CHIBI_TOGGLE_EVENT as any, handleToggle as any)
  }, [])

  const toggleSpeechMode = () => {
    const nextMode = speechMode === 'auto' ? 'click' : 'auto'
    setSpeechMode(nextMode)
    localStorage.setItem(CHIBI_SPEECH_MODE_KEY, nextMode)
  }

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640 || 'ontouchstart' in window)
    checkMobile()
    window.addEventListener("resize", checkMobile)
    return () => window.removeEventListener("resize", checkMobile)
  }, [])

  // Клик по маскоту (Прямой клик)
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (autoBubbleTimeout.current) clearTimeout(autoBubbleTimeout.current)

    // Если спал — будим мягко
    if (isSleepingRef.current) {
      isSleepingRef.current = false
      lastActiveTimestamp.current = performance.now()
      triggerAction('wave', 1800)
      return
    }

    handleUserActivity(true)
    registerTap()

    setIsBubbleOpen((prev) => !prev)
    setActiveTab('main')
  }

  // Принудительный сон
  const putToSleep = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    isSleepingRef.current = true
    currentAction.current = { type: 'none', startTime: 0, duration: 0 }
    lastActiveTimestamp.current = performance.now() - 60000
    setIsBubbleOpen(false)
    if (autoBubbleTimeout.current) clearTimeout(autoBubbleTimeout.current)
  }

  if (!isEnabled) return null

  const dynamicBottom = isMobile
    ? "calc(var(--bottom-nav-height, 88px) + 8px)"
    : "16px"

  const isHidden = hideFraction > 0.5
  const slideX = hideFraction * (isMobile ? 38 : -38)
  const slideY = hideFraction * 14

  return (
    <div
      style={{
        bottom: dynamicBottom,
        transform: `translate(${slideX}px, ${slideY}px)`
      }}
      className={cn(
        "fixed right-3 sm:left-4 sm:right-auto z-40 flex flex-col items-end sm:items-start select-none transition-transform duration-500 ease-out",
        isHidden && "opacity-75 hover:opacity-100"
      )}
    >
      {/* 💬 Диалоговое облачко */}
      {isBubbleOpen && (
        <div 
          onMouseEnter={() => {
            if (autoBubbleTimeout.current) clearTimeout(autoBubbleTimeout.current)
          }}
          className="pointer-events-auto mb-2 w-[240px] sm:w-[270px] bg-background/95 backdrop-blur-md border border-orange-500/25 p-3 rounded-2xl shadow-2xl animate-in fade-in zoom-in-95 duration-200 relative"
        >
          {/* Хедер */}
          <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-border/40">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setActiveTab('main')}
                className={cn(
                  "text-[10px] font-semibold tracking-wider uppercase px-1.5 py-0.5 rounded transition-colors",
                  activeTab === 'main' ? "bg-orange-500/15 text-orange-500" : "text-muted-foreground hover:text-foreground"
                )}
              >
                ✦ Дух
              </button>
              <button
                onClick={() => {
                  setActiveTab('oracle')
                  triggerAction('star', 1500)
                }}
                className={cn(
                  "p-1 rounded transition-colors",
                  activeTab === 'oracle' ? "bg-orange-500/15 text-orange-500" : "text-muted-foreground hover:text-foreground"
                )}
                title="Случайная идея"
              >
                <Dices className="w-3 h-3" />
              </button>
              <button
                onClick={() => {
                  setActiveTab('quote')
                  setQuoteIndex((prev) => (prev + 1) % ANIME_QUOTES.length)
                  triggerAction('peek', 1500)
                }}
                className={cn(
                  "p-1 rounded transition-colors",
                  activeTab === 'quote' ? "bg-orange-500/15 text-orange-500" : "text-muted-foreground hover:text-foreground"
                )}
                title="Цитата дня"
              >
                <Quote className="w-3 h-3" />
              </button>
            </div>

            <div className="flex items-center gap-1">
              {/* Переключатель режима авто/клик */}
              <button
                onClick={toggleSpeechMode}
                className={cn(
                  "p-0.5 rounded transition-colors",
                  speechMode === 'auto' ? "text-orange-500 hover:text-orange-600" : "text-muted-foreground hover:text-foreground"
                )}
                title={speechMode === 'auto' ? "Режим: Авто-показ реплик (нажмите для режима «По клику»)" : "Режим: Только по клику (нажмите для «Авто-показа»)"}
              >
                {speechMode === 'auto' ? <Bell className="w-3.5 h-3.5" /> : <BellOff className="w-3.5 h-3.5" />}
              </button>

              {/* Кнопка сна */}
              <button
                onClick={putToSleep}
                className="text-muted-foreground hover:text-orange-400 p-0.5 rounded transition-colors"
                title="Усыпить духа"
              >
                <Moon className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setIsBubbleOpen(false)}
                className="text-muted-foreground hover:text-foreground p-0.5 rounded"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Контент вкладки */}
          {activeTab === 'main' && (
            <div>
              <p className="text-xs text-foreground/90 leading-relaxed">
                {contextualMessage.text}
              </p>
              {contextualMessage.action && (
                <div className="mt-2.5 pt-1.5 border-t border-border/30 flex items-center justify-between">
                  {'href' in contextualMessage.action ? (
                    <Link
                      href={contextualMessage.action.href!}
                      onClick={() => setIsBubbleOpen(false)}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-orange-500 hover:text-orange-600 transition-colors"
                    >
                      <span>{contextualMessage.action.label}</span>
                      <ChevronRight className="w-3 h-3" />
                    </Link>
                  ) : (
                    <button
                      onClick={() => {
                        contextualMessage.action?.onClick?.()
                        setIsBubbleOpen(false)
                      }}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-orange-500 hover:text-orange-600 transition-colors"
                    >
                      <span>{contextualMessage.action.label}</span>
                      <ArrowUp className="w-3 h-3" />
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'oracle' && (
            <div className="space-y-2">
              <div className="flex items-center gap-1 text-[10px] text-orange-500 font-medium">
                <Sparkles className="w-3 h-3" />
                <span>Случайное аниме</span>
              </div>
              {isRandomLoading ? (
                <div className="flex flex-col items-center gap-2 py-4">
                  <Loader2 className="w-5 h-5 text-orange-500 animate-spin" />
                  <p className="text-[10px] text-muted-foreground">Ищу тайтл...</p>
                </div>
              ) : randomAnime ? (
                <Link
                  href={`/watch/${randomAnime.id}`}
                  onClick={() => setIsBubbleOpen(false)}
                  className="w-full"
                >
                  <AnimeCard anime={randomAnime} variant="default" className="w-full shadow-lg" />
                </Link>
              ) : (
                <button
                  onClick={() => {
                    fetchRandomAnimeAction()
                    triggerAction('star', 1200)
                  }}
                  className="text-[10px] text-orange-500 hover:underline pt-1 block"
                >
                  Показать случайное аниме →
                </button>
              )}
            </div>
          )}

          {activeTab === 'quote' && (
            <div className="space-y-1.5">
              <p className="text-xs text-foreground/90 italic leading-relaxed">
                {ANIME_QUOTES[quoteIndex].text}
              </p>
              <p className="text-[10px] text-muted-foreground text-right font-medium">
                — {ANIME_QUOTES[quoteIndex].author}
              </p>
              <button
                onClick={() => setQuoteIndex((prev) => (prev + 1) % ANIME_QUOTES.length)}
                className="text-[10px] text-orange-500 hover:underline block pt-1"
              >
                Следующая цитата →
              </button>
            </div>
          )}
        </div>
      )}

      {/* 🔮 Сам дух-сгусток */}
      <div
        onClick={handleClick}
        onPointerDown={(e) => {
          mousePos.current.isPressing = true
          lastStrokePos.current = { x: e.clientX, y: e.clientY }
        }}
        onPointerUp={() => {
          mousePos.current.isPressing = false
        }}
        onPointerMove={(e) => {
          if (e.buttons > 0 && !isMobile) {
            handlePettingStroke(e.clientX, e.clientY)
          }
        }}
        onTouchStart={(e) => {
          mousePos.current.isPressing = true
          if (e.touches[0]) {
            lastStrokePos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
          }
        }}
        onTouchMove={(e) => {
          if (e.touches[0] && mousePos.current.isPressing) {
            handlePettingStroke(e.touches[0].clientX, e.touches[0].clientY)
          }
        }}
        onTouchEnd={() => {
          mousePos.current.isPressing = false
        }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && handleClick(e as any)}
        className={cn(
          "pointer-events-auto relative cursor-pointer flex flex-col items-center touch-none select-none",
          !isHidden && "transition-transform active:scale-95"
        )}
        title={isSleepingRef.current ? "Дух спит. Нажмите, чтобы разбудить" : "Нажмите или погладьте"}
      >
        {isPettedActive && !isHidden && (
          <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-xs select-none pointer-events-none drop-shadow animate-bounce">
            💖
          </div>
        )}

        <FluidWisp
          size={isMobile ? 68 : 80}
          actionRef={currentAction}
          lastActiveRef={lastActiveTimestamp}
          isSleepingRef={isSleepingRef}
          mousePosRef={mousePos}
          pettingScoreRef={pettingScore}
          isOffline={isOffline}
          onHideChange={(p) => setHideFraction(p)}
        />

        {!isHidden && (
          <div className={cn(
            "w-7 sm:w-9 h-1 rounded-full blur-[2px] -mt-1 transition-all duration-500",
            isOffline ? "bg-blue-500/20" : "bg-orange-500/15"
          )} />
        )}
      </div>
    </div>
  )
}