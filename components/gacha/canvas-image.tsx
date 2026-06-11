"use client"

import { useEffect, useRef, useState } from 'react'

interface CanvasImageProps {
  src: string
  alt: string
  className?: string
  style?: React.CSSProperties
  onLoad?: () => void
  onError?: (e: any) => void
  objectFit?: 'cover' | 'contain'
  opacity?: number
}

export function CanvasImage({
  src,
  alt,
  className = '',
  style = {},
  onLoad,
  onError,
  objectFit = 'cover',
  opacity = 1
}: CanvasImageProps) {
  const isGif = src.toLowerCase().includes('.gif')

  // For GIFs, use regular img tag for native animation support
  if (isGif) {
    return (
      <img
        src={src}
        alt={alt}
        className={className}
        style={{
          ...style,
          width: '100%',
          height: '100%',
          objectFit,
          opacity,
          display: 'block',
          borderRadius: 'inherit'
        }}
        onLoad={onLoad}
        onError={onError}
      />
    )
  }

  // For static images, use Canvas for GPU acceleration
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imageRef = useRef<HTMLImageElement | null>(null)
  const animationFrameRef = useRef<number | undefined>(undefined)
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d', {
      alpha: true,
      desynchronized: true, // Оптимизация для анимаций
      willReadFrequently: false
    })
    if (!ctx) return

    // Создаём изображение
    const img = new Image()
    // Не устанавливаем crossOrigin для Next.js проксированных изображений
    // Next.js Image Optimization API уже обрабатывает CORS
    imageRef.current = img

    const drawImage = () => {
      if (!canvas || !ctx || !img.complete) return

      const canvasWidth = canvas.offsetWidth
      const canvasHeight = canvas.offsetHeight
      
      // Устанавливаем размер canvas с учётом devicePixelRatio для чёткости
      const dpr = window.devicePixelRatio || 1
      canvas.width = canvasWidth * dpr
      canvas.height = canvasHeight * dpr
      
      ctx.scale(dpr, dpr)
      
      // Очищаем canvas
      ctx.clearRect(0, 0, canvasWidth, canvasHeight)
      
      // Отключаем сглаживание для чёткости
      ctx.imageSmoothingEnabled = false
      
      // Устанавливаем прозрачность
      ctx.globalAlpha = opacity

      let sx = 0, sy = 0, sWidth = img.width, sHeight = img.height
      let dx = 0, dy = 0, dWidth = canvasWidth, dHeight = canvasHeight

      if (objectFit === 'cover') {
        // Вычисляем aspect ratio
        const imgRatio = img.width / img.height
        const canvasRatio = canvasWidth / canvasHeight

        if (imgRatio > canvasRatio) {
          // Изображение шире - обрезаем по бокам
          sWidth = img.height * canvasRatio
          sx = (img.width - sWidth) / 2
        } else {
          // Изображение выше - обрезаем сверху/снизу
          sHeight = img.width / canvasRatio
          sy = (img.height - sHeight) / 2
        }
      } else if (objectFit === 'contain') {
        // Вписываем изображение целиком
        const imgRatio = img.width / img.height
        const canvasRatio = canvasWidth / canvasHeight

        if (imgRatio > canvasRatio) {
          dHeight = canvasWidth / imgRatio
          dy = (canvasHeight - dHeight) / 2
        } else {
          dWidth = canvasHeight * imgRatio
          dx = (canvasWidth - dWidth) / 2
        }
      }

      // Рисуем изображение
      ctx.drawImage(img, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight)
    }

    img.onload = (e) => {
      setIsLoaded(true)
      // Ensure canvas is ready before drawing and calling onLoad
      requestAnimationFrame(() => {
        drawImage()
        onLoad?.()
      })
    }

    img.onerror = (e) => {
      onError?.(e)
    }

    img.src = src

    // Перерисовываем при ресайзе
    const handleResize = () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      animationFrameRef.current = requestAnimationFrame(drawImage)
    }

    window.addEventListener('resize', handleResize)

    // Для GIF: запускаем непрерывную анимацию
    if (isGif) {
      const animate = () => {
        drawImage()
        animationFrameRef.current = requestAnimationFrame(animate)
      }
      animationFrameRef.current = requestAnimationFrame(animate)
    }

    return () => {
      window.removeEventListener('resize', handleResize)
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      if (imageRef.current) {
        imageRef.current.onload = null
        imageRef.current.onerror = null
      }
    }
  }, [src, objectFit, opacity, isGif])

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{
        ...style,
        width: '100%',
        height: '100%',
        display: 'block',
        borderRadius: 'inherit' // Наследует border-radius от родителя
      }}
      aria-label={alt}
    />
  )
}
