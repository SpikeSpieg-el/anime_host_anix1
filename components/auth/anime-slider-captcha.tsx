"use client"

import React, { useState, useEffect, useRef, useCallback, useId } from "react"
import { RefreshCcw, CheckCircle2, ChevronRight, ShieldCheck, AlertCircle } from "lucide-react"

interface AnimeSliderCaptchaProps {
  onSuccess: (verificationToken: string) => void
  disabled?: boolean
}

interface Point {
  x: number
  y: number
  t: number
}

// Стандартный размер кусочка пазла
const PUZZLE_SIZE = 44
// SVG-контур классического ушка пазла
const PUZZLE_PATH =
  "M 0,0 L 14,0 C 14,6 18,9 22,9 C 26,9 30,6 30,0 L 44,0 L 44,14 C 50,14 53,18 53,22 C 53,26 50,30 44,30 L 44,44 L 30,44 C 30,38 26,35 22,35 C 18,35 14,38 14,44 L 0,44 L 0,30 C 6,30 9,26 9,22 C 9,18 6,14 0,14 Z"

export function AnimeSliderCaptcha({ onSuccess, disabled }: AnimeSliderCaptchaProps) {
  const clipId = useId()
  const [data, setData] = useState<{
    bgUrl: string
    targetX: number
    targetY: number
    token: string
  } | null>(null)

  const [sliderX, setSliderX] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [status, setStatus] = useState<"idle" | "loading" | "verifying" | "success" | "error">("loading")
  const [errorMessage, setErrorMessage] = useState("")
  const [containerDimensions, setContainerDimensions] = useState({ width: 0, height: 0 })

  const containerRef = useRef<HTMLDivElement>(null)
  const sliderXRef = useRef(0)
  const startClientX = useRef<number>(0)
  const trajectoryRef = useRef<Point[]>([])

  // Отслеживаем реальные пиксельные размеры окна пазла
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const updateSize = () => {
      setContainerDimensions({
        width: el.clientWidth,
        height: el.clientHeight,
      })
    }

    updateSize()
    const observer = new ResizeObserver(updateSize)
    observer.observe(el)

    return () => observer.disconnect()
  }, [])

  // Загрузка нового пазла
  const fetchPuzzle = useCallback(async () => {
    try {
      setStatus("loading")
      setSliderX(0)
      sliderXRef.current = 0
      setErrorMessage("")
      trajectoryRef.current = []

      const res = await fetch("/api/auth/captcha/puzzle")
      const json = await res.json()
      if (res.ok && json.token) {
        setData(json)
        setStatus("idle")
      } else {
        setStatus("error")
        setErrorMessage("Не удалось загрузить пазл")
      }
    } catch {
      setStatus("error")
      setErrorMessage("Ошибка сети")
    }
  }, [])

  useEffect(() => {
    fetchPuzzle()
  }, [fetchPuzzle])

  // Пиксельные координаты цели
  const targetPxX = data ? data.targetX * containerDimensions.width : 0
  const targetPxY = data ? data.targetY * containerDimensions.height : 0

  // Начало перетаскивания
  const handleStart = (clientX: number, clientY: number) => {
    if (status === "success" || status === "verifying" || disabled || !data) return
    setIsDragging(true)
    startClientX.current = clientX - sliderXRef.current
    trajectoryRef.current = [{ x: clientX, y: clientY, t: Date.now() }]
  }

  // Движение ползунка
  const handleMove = useCallback(
    (clientX: number, clientY: number) => {
      if (!isDragging || !containerRef.current) return

      const maxDrag = containerRef.current.clientWidth - PUZZLE_SIZE
      const newX = Math.max(0, Math.min(clientX - startClientX.current, maxDrag))

      sliderXRef.current = newX
      setSliderX(newX)
      trajectoryRef.current.push({ x: clientX, y: clientY, t: Date.now() })
    },
    [isDragging],
  )

  // Завершение движения и отправка решения
  const handleEnd = useCallback(async () => {
    if (!isDragging || !data || !containerRef.current) return
    setIsDragging(false)
    setStatus("verifying")

    const cWidth = containerRef.current.clientWidth || 1
    const finalFraction = Number((sliderXRef.current / cWidth).toFixed(4))

    try {
      const res = await fetch("/api/auth/captcha/puzzle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: data.token,
          userFraction: finalFraction,
          trajectory: trajectoryRef.current,
        }),
      })

      const result = await res.json()

      if (result.success && result.verificationToken) {
        setStatus("success")
        onSuccess(result.verificationToken)
      } else {
        setStatus("error")
        setErrorMessage(result.error || "Пазл не совпал")
        setTimeout(() => {
          fetchPuzzle()
        }, 1200)
      }
    } catch {
      setStatus("error")
      setErrorMessage("Ошибка верификации")
      setTimeout(() => fetchPuzzle(), 1200)
    }
  }, [isDragging, data, fetchPuzzle, onSuccess])

  // Слушатели мыши и тача на window
  useEffect(() => {
    if (!isDragging) return

    const onMouseMove = (e: MouseEvent) => handleMove(e.clientX, e.clientY)
    const onMouseUp = () => handleEnd()

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches[0]) {
        handleMove(e.touches[0].clientX, e.touches[0].clientY)
      }
    }
    const onTouchEnd = () => handleEnd()

    window.addEventListener("mousemove", onMouseMove)
    window.addEventListener("mouseup", onMouseUp)
    window.addEventListener("touchmove", onTouchMove, { passive: true })
    window.addEventListener("touchend", onTouchEnd)

    return () => {
      window.removeEventListener("mousemove", onMouseMove)
      window.removeEventListener("mouseup", onMouseUp)
      window.removeEventListener("touchmove", onTouchMove)
      window.removeEventListener("touchend", onTouchEnd)
    }
  }, [isDragging, handleMove, handleEnd])

  return (
    <div className="space-y-3 select-none w-full max-w-sm mx-auto">
      {/* Шапка */}
      <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
        <div className="flex items-center gap-1.5 text-indigo-400">
          <ShieldCheck className="w-4 h-4" />
          <span>Проверка безопасности</span>
        </div>
        <span className="text-[11px] text-slate-500 font-normal">
          {status === "success" ? "Пройдено" : "Сдвиньте кусочек на место"}
        </span>
      </div>

      {/* Окно с пазлом */}
      <div
        ref={containerRef}
        className="relative w-full h-[160px] rounded-xl overflow-hidden border border-slate-800 bg-slate-950 shadow-inner"
      >
        {data && containerDimensions.width > 0 && (
          <>
            {/* 1. Исходная картинка фона */}
            <img
              src={data.bgUrl}
              alt="Captcha Background"
              className="absolute inset-0 w-full h-full object-cover pointer-events-none"
            />

            {/* 2. Темная неподвижная дырка (целевая позиция) */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none">
              <path
                d={PUZZLE_PATH}
                transform={`translate(${targetPxX}, ${targetPxY})`}
                fill="rgba(5, 7, 13, 0.75)"
                stroke="rgba(255, 255, 255, 0.4)"
                strokeWidth="1.5"
                strokeDasharray="4 2"
              />
            </svg>

            {/* 3. Движущийся кусочек пазла */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                // Смещаем весь слой так, чтобы при sliderX = targetPxX кусочек вставал точно в паз
                transform: `translateX(${sliderX - targetPxX}px)`,
                transition: isDragging ? "none" : "transform 0.25s ease-out",
              }}
            >
              <svg className="w-full h-full">
                <defs>
                  <clipPath id={clipId}>
                    <path d={PUZZLE_PATH} transform={`translate(${targetPxX}, ${targetPxY})`} />
                  </clipPath>
                </defs>

                {/* Вырезанный фрагмент картинки */}
                <image
                  href={data.bgUrl}
                  width="100%"
                  height="100%"
                  preserveAspectRatio="xMidYMid slice"
                  clipPath={`url(#${clipId})`}
                />

                {/* Контур кусочка */}
                <path
                  d={PUZZLE_PATH}
                  transform={`translate(${targetPxX}, ${targetPxY})`}
                  fill="none"
                  stroke={status === "success" ? "#34d399" : "#38bdf8"}
                  strokeWidth="2"
                  style={{
                    filter:
                      status === "success"
                        ? "drop-shadow(0 0 8px rgba(52, 211, 153, 0.8))"
                        : "drop-shadow(0 2px 6px rgba(0, 0, 0, 0.9))",
                  }}
                />
              </svg>
            </div>
          </>
        )}

        {/* Кнопка обновления */}
        <button
          type="button"
          onClick={fetchPuzzle}
          disabled={isDragging || status === "success" || disabled}
          className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/60 backdrop-blur-md text-white/80 hover:text-white transition-all hover:bg-black/80 disabled:opacity-50"
          title="Обновить пазл"
        >
          <RefreshCcw className={`w-3.5 h-3.5 ${status === "loading" ? "animate-spin" : ""}`} />
        </button>

        {/* Успех */}
        {status === "success" && (
          <div className="absolute inset-0 bg-emerald-950/60 backdrop-blur-xs flex items-center justify-center gap-2 text-emerald-400 font-bold text-sm">
            <CheckCircle2 className="w-5 h-5" />
            <span>Успешно подтверждено!</span>
          </div>
        )}

        {/* Ошибка */}
        {status === "error" && (
          <div className="absolute inset-0 bg-rose-950/60 backdrop-blur-xs flex items-center justify-center gap-1.5 text-rose-300 font-semibold text-xs">
            <AlertCircle className="w-4 h-4" />
            <span>{errorMessage}</span>
          </div>
        )}
      </div>

      {/* Слайдер-трек */}
      <div className="relative h-11 w-full rounded-xl bg-slate-900 border border-slate-800 flex items-center px-1 overflow-hidden touch-none">
        {/* Полоса прогресса */}
        <div
          className={`absolute left-0 top-0 bottom-0 transition-colors ${
            status === "success" ? "bg-emerald-500/20" : "bg-indigo-500/20"
          }`}
          style={{ width: `${sliderX + PUZZLE_SIZE}px` }}
        />

        {/* Подсказка */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-xs font-semibold text-slate-500 tracking-wide">
          {status === "success" ? "Проверка завершена" : "Потяните ползунок вправо >>>"}
        </div>

        {/* Ручка слайдера */}
        <div
          onMouseDown={(e) => handleStart(e.clientX, e.clientY)}
          onTouchStart={(e) => e.touches[0] && handleStart(e.touches[0].clientX, e.touches[0].clientY)}
          className={`relative z-10 h-9 w-11 rounded-lg flex items-center justify-center cursor-grab active:cursor-grabbing transition-shadow touch-none ${
            status === "success"
              ? "bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/30"
              : isDragging
              ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/40 scale-105"
              : "bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white"
          }`}
          style={{
            transform: `translateX(${sliderX}px)`,
            transition: isDragging ? "none" : "transform 0.25s ease-out",
          }}
        >
          {status === "success" ? (
            <CheckCircle2 className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-5 h-5 animate-pulse" />
          )}
        </div>
      </div>
    </div>
  )
}