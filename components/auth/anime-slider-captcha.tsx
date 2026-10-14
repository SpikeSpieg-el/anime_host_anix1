"use client"

import React, { useState, useEffect, useRef, useCallback } from "react"
import { RefreshCcw, CheckCircle2, ChevronRight, ShieldCheck, AlertCircle } from "lucide-react"

import {
  PUZZLE_BOX,
} from "@/lib/captcha-geometry"

interface AnimeSliderCaptchaProps {
  onSuccess: (verificationToken: string) => void
  disabled?: boolean
}

interface Point {
  x: number
  y: number
  t: number
}

/**
 * Текст ошибки для показа в оверлее пазла.
 *
 * Серверные сообщения о проверке приходят готовыми («Кусочек не совпал с
 * дыркой»), но ответ общего рейт-лимита остаётся машинным и английским
 * («Too many requests»). Поэтому сообщение сервера берём только если оно
 * действительно наше, русское, а всё остальное заменяем нейтральной
 * формулировкой: пользователю незачем видеть внутренние коды и статусы.
 */
function puzzleErrorMessage(serverMessage: unknown, fallbackText: string): string {
  if (typeof serverMessage !== "string") return fallbackText
  const trimmed = serverMessage.trim()
  return /[\u0400-\u04FF]/.test(trimmed) ? trimmed : fallbackText
}

/** Запасной текст по статусу ответа: про лимит нужно говорить про лимит. */
function puzzleFallback(status: number, kind: "load" | "solve"): string {
  if (status === 429) {
    return "Слишком много попыток. Подождите немного и попробуйте снова."
  }
  if (status >= 500) {
    return "Что-то пошло не так на нашей стороне. Попробуйте позже."
  }
  return kind === "load"
    ? "Не получилось загрузить пазл. Попробуйте обновить его."
    : "Кусочек не совпал с дыркой. Попробуйте ещё раз."
}

/**
 * Отметка времени события для траектории.
 *
 * Берётся `event.timeStamp` — у него субмиллисекундное разрешение и общая
 * шкала для всех событий страницы. `Date.now()` для этой задачи не годится:
 * два события внутри одной миллисекунды получают одинаковую метку, а
 * скорость, посчитанная по такой дельте, превращается в деление на ноль.
 */
function eventTime(e: { timeStamp?: number }): number {
  const ts = e.timeStamp
  return typeof ts === "number" && Number.isFinite(ts) && ts > 0 ? ts : Date.now()
}

/**
 * Пазл с дыркой, выжженной в картинку на сервере.
 *
 * Клиент НЕ знает, где дырка по X: в ответе только два адреса готовых
 * картинок (фон с дыркой и сам кусочек), `targetY` — по нему кусочек
 * выравнивается по вертикали — и запечатанный токен.
 */
export function AnimeSliderCaptcha({ onSuccess, disabled }: AnimeSliderCaptchaProps) {
  const [data, setData] = useState<{
    puzzle: string
    piece: string
    targetY: number
    token: string
  } | null>(null)

  const [sliderX, setSliderX] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [status, setStatus] = useState<"idle" | "loading" | "verifying" | "success" | "error">(
    "loading"
  )
  const [errorMessage, setErrorMessage] = useState("")
  const [containerDimensions, setContainerDimensions] = useState({ width: 0, height: 0 })

  const containerRef = useRef<HTMLDivElement>(null)
  const sliderXRef = useRef(0)
  const startClientX = useRef<number>(0)
  const trajectoryRef = useRef<Point[]>([])

  // Отслеживаем реальные пиксельные размеры окна пазла: серверу они нужны,
  // чтобы выжечь дырку под те же пропорции, которые браузер покажет через
  // object-cover.
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

  const fetchPuzzle = useCallback(async () => {
    const el = containerRef.current
    const width = el?.clientWidth ?? 0
    const height = el?.clientHeight ?? 0

    try {
      setStatus("loading")
      setSliderX(0)
      sliderXRef.current = 0
      setErrorMessage("")
      trajectoryRef.current = []

      const params = new URLSearchParams()
      if (width > 0) params.set("w", String(Math.round(width)))
      if (height > 0) params.set("h", String(Math.round(height)))
      const query = params.toString()

      const res = await fetch(`/api/auth/captcha/puzzle${query ? `?${query}` : ""}`)
      const json = await res.json()
      if (res.ok && json.token && json.puzzle && json.piece) {
        setData({
          puzzle: json.puzzle,
          piece: json.piece,
          targetY: json.targetY,
          token: json.token,
        })
        setStatus("idle")
      } else {
        setStatus("error")
        setErrorMessage(
          puzzleErrorMessage(json.error, puzzleFallback(res.status, "load"))
        )
      }
    } catch {
      setStatus("error")
      setErrorMessage("Нет связи с сервером. Проверьте интернет и попробуйте ещё раз.")
    }
  }, [])

  // Первый пазл берём только когда размеры контейнера известны — иначе сервер
  // выжигает дырку под дефолт 360×160, а на телефоне она уезжает за кадр.
  const requestedFor = useRef<string>("")
  useEffect(() => {
    const { width, height } = containerDimensions
    if (width === 0 || height === 0) return

    // Не перезапрашиваем на каждый чих ресайза: пазл живёт 2 минуты, а
    // перезапуск посреди перетаскивания сбрасывает траекторию.
    const key = `${Math.round(width / 20)}:${Math.round(height / 20)}`
    if (requestedFor.current === key) return
    requestedFor.current = key

    fetchPuzzle()
  }, [containerDimensions, fetchPuzzle])

  // Вертикальная позиция кусочка в пикселях контейнера.
  const targetPxY = data ? data.targetY * containerDimensions.height : 0

  // Начало перетаскивания.
  const handleStart = (clientX: number, clientY: number, at: number) => {
    if (status === "success" || status === "verifying" || disabled || !data) return
    setIsDragging(true)
    startClientX.current = clientX - sliderXRef.current
    trajectoryRef.current = [{ x: clientX, y: clientY, t: at }]
  }

  // Движение кусочка.
  const handleMove = useCallback(
    (clientX: number, clientY: number, at: number, coalesced?: Point[]) => {
      if (!isDragging || !containerRef.current) return

      const maxDrag = containerRef.current.clientWidth - PUZZLE_BOX
      const newX = Math.max(0, Math.min(clientX - startClientX.current, maxDrag))

      sliderXRef.current = newX
      setSliderX(newX)

      if (coalesced && coalesced.length > 0) {
        // PointerEvent'ы приходят пачками по 4–8 точек за кадр: это реальная
        // траектория пера/мыши, а не синтетика.
        //
        // Время у каждой точки своё — из её собственного события. Раньше здесь
        // стояло `Date.now()` для всех точек пакета, и все они получали одну
        // отметку: чем быстрее и точнее шёл человек, тем длиннее пакет и тем
        // вернее сервер считал траекторию подделанной. Именно на этом
        // ломалось место с «Проверка не пройдена» при очень аккуратном drag'е.
        for (const p of coalesced) {
          trajectoryRef.current.push({ x: p.x, y: p.y, t: p.t })
        }
      } else {
        trajectoryRef.current.push({ x: clientX, y: clientY, t: at })
      }
    },
    [isDragging],
  )

  // Завершение движения и отправка решения.
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
        setErrorMessage(
          puzzleErrorMessage(result.error, puzzleFallback(res.status, "solve"))
        )

        // Промах больше не выбрасывает всю работу: пазл остаётся, кусочек
        // возвращается в ноль, и человек просто пробует снова. Раньше любой
        // отказ через 1.2 секунды подменялся новым пазлом — десять попыток
        // означали десять разных картинок, и придраться было не к чему.
        const keepPuzzle = result.reason === "position" || result.reason === "trajectory"
        setSliderX(0)
        sliderXRef.current = 0

        if (keepPuzzle) {
          // Показываем причину и убираем красную плёнку: человек должен видеть
          // дырку, чтобы сдвинуть кусочек точнее.
          setTimeout(() => setStatus("idle"), 1800)
        } else {
          setTimeout(() => {
            requestedFor.current = ""
            fetchPuzzle()
          }, 1200)
        }
      }
    } catch {
      setStatus("error")
      setErrorMessage("Нет связи с сервером. Проверьте интернет и попробуйте ещё раз.")
      setTimeout(() => {
        requestedFor.current = ""
        fetchPuzzle()
      }, 1200)
    }
  }, [isDragging, data, fetchPuzzle, onSuccess])

  // Слушатели указателя на window.
  useEffect(() => {
    if (!isDragging) return

    const onPointerMove = (e: PointerEvent) => {
      // Склеенные события — реальная траектория, а не один сэмпл на кадр.
      // Время берём у каждого события своё (`event.timeStamp`): у пакета
      // событий отметки разные, и именно поэтому их можно различать.
      const native = e as PointerEvent & {
        getCoalescedEvents?: () => PointerEvent[]
      }
      const coalesced = native.getCoalescedEvents?.() ?? []
      const points: Point[] | undefined =
        coalesced.length > 0
          ? coalesced.map((c) => ({ x: c.clientX, y: c.clientY, t: c.timeStamp }))
          : undefined
      handleMove(e.clientX, e.clientY, eventTime(e), points)
    }

    const onPointerUp = () => handleEnd()
    // pointercancel означает, что жест отменён системой (скролл, палец увели
    // за край). Отправлять обрезанную траекторию бессмысленно — сервер
    // справедливо скажет «не пройдена». Молча откатываем перетаскивание.
    const onPointerCancel = () => {
      setIsDragging(false)
      setSliderX(0)
      sliderXRef.current = 0
      trajectoryRef.current = []
    }

    window.addEventListener("pointermove", onPointerMove)
    window.addEventListener("pointerup", onPointerUp)
    window.addEventListener("pointercancel", onPointerCancel)

    return () => {
      window.removeEventListener("pointermove", onPointerMove)
      window.removeEventListener("pointerup", onPointerUp)
      window.removeEventListener("pointercancel", onPointerCancel)
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
            {/* 1. Картинка с дыркой, выжженной на сервере */}
            <img
              src={data.puzzle}
              alt="Captcha Background"
              className="absolute inset-0 w-full h-full object-cover pointer-events-none"
            />

            {/* 2. Кусочек. Это кадр из-под дырки, отрисованный на сервере:
                   при попадании встык он заполняет её, и «зажившую» картинку
                   видно сразу. Вариант с полупрозрачным стеклом не годился:
                   дырка просвечивала даже при правильном положении, и совпадение
                   было невозможно увидеть глазами. */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                transform: `translateX(${sliderX}px)`,
                transition: isDragging ? "none" : "transform 0.25s ease-out",
              }}
            >
              <img
                src={
                  status === "success"
                    ? `${data.piece}&solved=1`
                    : data.piece
                }
                alt="Кусочек пазла"
                draggable={false}
                className="absolute left-0 pointer-events-none select-none"
                style={{ top: targetPxY }}
              />
            </div>
          </>
        )}

        {/* Кнопка обновления */}
        <button
          type="button"
          onClick={() => {
            requestedFor.current = ""
            fetchPuzzle()
          }}
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
          style={{ width: `${sliderX + PUZZLE_BOX}px` }}
        />

        {/* Подсказка */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-xs font-semibold text-slate-500 tracking-wide">
          {status === "success" ? "Проверка завершена" : "Потяните ползунок вправо >>>"}
        </div>

        {/* Ручка слайдера */}
        <div
          onPointerDown={(e) => handleStart(e.clientX, e.clientY, eventTime(e))}
          style={{
            transform: `translateX(${sliderX}px)`,
            transition: isDragging ? "none" : "transform 0.25s ease-out",
          }}
          // touch-action не наследуется от трека: без него палец на телефоне
          // начинает скроллить страницу вместо перетаскивания, и жест
          // прерывается pointercancel'ом на середине.
          className={`relative z-10 h-9 w-11 rounded-lg flex items-center justify-center cursor-grab active:cursor-grabbing transition-shadow touch-none select-none ${
            status === "success"
              ? "bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/30"
              : isDragging
              ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/40 scale-105"
              : "bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white"
          }`}
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
