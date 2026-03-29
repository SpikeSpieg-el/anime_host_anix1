"use client"

import { Loader2, Sparkles } from "lucide-react"

interface GachaLoadingProps {
  message?: string
  size?: "sm" | "md" | "lg"
  variant?: "default" | "sketch"
}

export function GachaLoading({ 
  message = "Загрузка...", 
  size = "md",
  variant = "default"
}: GachaLoadingProps) {
  const sizeClasses = {
    sm: "w-6 h-6",
    md: "w-12 h-12", 
    lg: "w-16 h-16"
  }

  const textSizeClasses = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base"
  }

  if (variant === "sketch") {
    return (
      <div className="flex flex-col items-center gap-4">
        {/* Sketch-style animated container */}
        <div className="relative">
          {/* Outer rotating ring */}
          <div className={`${sizeClasses[size]} absolute inset-0 border-2 border-dashed border-orange-500/30 rounded-full animate-spin`} />
          
          {/* Middle pulsing ring */}
          <div className={`${sizeClasses[size]} absolute inset-1 border border-orange-500/50 rounded-full animate-pulse`} />
          
          {/* Inner solid ring */}
          <div className={`${sizeClasses[size]} absolute inset-2 border-2 border-orange-500 rounded-full border-t-transparent border-r-transparent animate-spin`} />
          
          {/* Center icon */}
          <div className={`${sizeClasses[size]} flex items-center justify-center`}>
            <Sparkles className={`${size === "sm" ? "w-3 h-3" : size === "md" ? "w-6 h-6" : "w-8 h-8"} text-orange-400 animate-pulse`} />
          </div>
        </div>
        
        {/* Animated text with sketch effect */}
        <div className="relative">
          <p className={`${textSizeClasses[size]} text-orange-400 font-medium animate-pulse`}>
            {message}
          </p>
          {/* Sketch underline effect */}
          <div className="absolute -bottom-1 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-orange-500 to-transparent animate-pulse" />
        </div>
        
        {/* Floating particles */}
        <div className="relative w-20 h-20">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 bg-orange-400 rounded-full animate-pulse"
              style={{
                top: `${20 + Math.sin(i * 60 * Math.PI / 180) * 15}px`,
                left: `${40 + Math.cos(i * 60 * Math.PI / 180) * 15}px`,
                animationDelay: `${i * 0.2}s`,
                animationDuration: '2s'
              }}
            />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <Loader2 className={`${sizeClasses[size]} text-indigo-500 animate-spin`} />
      <p className={`${textSizeClasses[size]} text-indigo-400 font-medium animate-pulse`}>
        {message}
      </p>
    </div>
  )
}
