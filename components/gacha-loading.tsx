"use client"

import { Loader2 } from "lucide-react"

interface GachaLoadingProps {
  message?: string
  size?: "sm" | "md" | "lg"
}

export function GachaLoading({ 
  message = "Загрузка...", 
  size = "md"
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

  return (
    <div className="flex flex-col items-center gap-3">
      <Loader2 className={`${sizeClasses[size]} text-orange-500 animate-spin`} />
      <p className={`${textSizeClasses[size]} text-orange-400 font-medium animate-pulse`}>
        {message}
      </p>
    </div>
  )
}
