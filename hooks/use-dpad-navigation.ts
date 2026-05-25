"use client"

import { useEffect, useRef, useCallback } from 'react'

interface UseDpadNavigationOptions {
  enabled?: boolean
  onSelect?: () => void
  onBack?: () => void
}

export function useDpadNavigation(options: UseDpadNavigationOptions = {}) {
  const { enabled = true, onSelect, onBack } = options
  const elementRef = useRef<HTMLElement>(null)

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!enabled) return

    const focusableElements = Array.from(
      document.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
    )

    const currentIndex = focusableElements.findIndex(el => el === document.activeElement)

    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault()
        if (currentIndex > 0) {
          focusableElements[currentIndex - 1]?.focus()
        }
        break

      case 'ArrowDown':
        e.preventDefault()
        if (currentIndex < focusableElements.length - 1) {
          focusableElements[currentIndex + 1]?.focus()
        }
        break

      case 'ArrowLeft':
        e.preventDefault()
        const leftElement = findElementInDirection('left', focusableElements, currentIndex)
        leftElement?.focus()
        break

      case 'ArrowRight':
        e.preventDefault()
        const rightElement = findElementInDirection('right', focusableElements, currentIndex)
        rightElement?.focus()
        break

      case 'Enter':
        e.preventDefault()
        if (onSelect) {
          onSelect()
        } else {
          (document.activeElement as HTMLElement)?.click()
        }
        break

      case 'Escape':
      case 'Backspace':
        e.preventDefault()
        onBack?.()
        break
    }
  }, [enabled, onSelect, onBack])

  useEffect(() => {
    if (enabled) {
      window.addEventListener('keydown', handleKeyDown)
      return () => window.removeEventListener('keydown', handleKeyDown)
    }
  }, [enabled, handleKeyDown])

  return elementRef
}

function findElementInDirection(
  direction: 'left' | 'right',
  elements: HTMLElement[],
  currentIndex: number
): HTMLElement | null {
  if (currentIndex === -1) return null

  const current = elements[currentIndex]
  const currentRect = current.getBoundingClientRect()

  const candidates = elements.filter((el, idx) => {
    if (idx === currentIndex) return false
    const rect = el.getBoundingClientRect()

    const verticalOverlap = 
      Math.max(0, Math.min(currentRect.bottom, rect.bottom) - Math.max(currentRect.top, rect.top))

    if (verticalOverlap < 10) return false

    if (direction === 'left') {
      return rect.right <= currentRect.left + 10
    } else {
      return rect.left >= currentRect.right - 10
    }
  })

  if (candidates.length === 0) return null

  return candidates.reduce((closest, el) => {
    const closestRect = closest.getBoundingClientRect()
    const elRect = el.getBoundingClientRect()

    const closestDist = Math.abs(closestRect.left - currentRect.left)
    const elDist = Math.abs(elRect.left - currentRect.left)

    return elDist < closestDist ? el : closest
  })
}
