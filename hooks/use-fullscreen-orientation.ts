"use client"

import { useEffect, useState } from "react"

/**
 * В установленной PWA (display: standalone) браузер залочивает ориентацию
 * ВСЕГО окна приложения значением из web app manifest (`orientation: "portrait-*"`).
 * Пока этот лок активен, автоповорот не работает нигде — в том числе когда
 * плеер уже на весь экран: телефон крутишь, а картинка стоит в портрете.
 *
 * Что делаем:
 *   1) в манифесте стоит `orientation: "any"` — не лочим портрет;
 *   2) этот хук сам просит систему повернуть экран в landscape, когда элемент
 *      вошёл в fullscreen, и снимает лок при выходе из него.
 *
 * Поддержка: `screen.orientation.lock()` есть в Chrome/Edge на Android, в Safari
 * (iOS/macOS) его нет — там мы ничего не делаем и не падаем.
 */

export type OrientationLock = "landscape" | "portrait" | "any"

type AnyDocument = Document & {
  webkitFullscreenElement?: Element | null
  mozFullScreenElement?: Element | null
  msFullscreenElement?: Element | null
}

type AnyScreenOrientation = ScreenOrientation & {
  lock?: (type: string) => Promise<void> | void
  unlock?: () => void
}

export function getFullscreenElement(): Element | null {
  if (typeof document === "undefined") return null
  const doc = document as AnyDocument
  return (
    doc.fullscreenElement ||
    doc.webkitFullscreenElement ||
    doc.mozFullScreenElement ||
    doc.msFullscreenElement ||
    null
  )
}

function getOrientationApi(): AnyScreenOrientation | null {
  if (typeof screen === "undefined") return null
  const orientation = screen.orientation as AnyScreenOrientation | undefined
  return orientation ?? null
}

/** Есть ли у браузера Screen Orientation API с lock(). */
export function canLockOrientation(): boolean {
  const orientation = getOrientationApi()
  return !!orientation && typeof orientation.lock === "function"
}

/** Просим систему повернуть экран. false — если браузер это не умеет или отказал. */
export async function lockOrientation(target: OrientationLock = "landscape"): Promise<boolean> {
  const orientation = getOrientationApi()
  const lock = orientation?.lock
  if (!orientation || typeof lock !== "function") return false
  try {
    await lock.call(orientation, target)
    return true
  } catch {
    // NotSupportedError: десктопный Chrome вне fullscreen, iOS Safari и т.п.
    return false
  }
}

/** Снимаем лок — после выхода из fullscreen приложение снова живёт как обычно. */
export function unlockOrientation(): void {
  const orientation = getOrientationApi()
  const unlock = orientation?.unlock
  if (!orientation || typeof unlock !== "function") return
  try {
    unlock.call(orientation)
  } catch {
    // игнорируем
  }
}

/**
 * Возвращает актуальный признак fullscreen (обновляется и при закрытии по Esc /
 * системному жесту, а не только по нашей кнопке) и заодно рулит ориентацией:
 * зашли в fullscreen → landscape, вышли → отпускаем.
 */
export function useFullscreenOrientation(target: OrientationLock = "landscape") {
  const [isFullscreen, setIsFullscreen] = useState(false)

  useEffect(() => {
    const handleChange = () => {
      const fullscreen = !!getFullscreenElement()
      setIsFullscreen(fullscreen)
      if (fullscreen) {
        void lockOrientation(target)
      } else {
        unlockOrientation()
      }
    }

    const events = [
      "fullscreenchange",
      "webkitfullscreenchange",
      "mozfullscreenchange",
      "MSFullscreenChange",
    ] as const

    events.forEach((event) =>
      document.addEventListener(event, handleChange as EventListener)
    )

    // На случай, если fullscreen уже активен (например, после hot reload)
    handleChange()

    return () => {
      events.forEach((event) =>
        document.removeEventListener(event, handleChange as EventListener)
      )
      unlockOrientation()
    }
  }, [target])

  return isFullscreen
}
