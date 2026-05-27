"use client"

interface GachaLoadingProps {
  message?: string
}

export function GachaLoading({
  message = "Загрузка..."
}: GachaLoadingProps) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="w-8 h-8 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
      <p className="text-sm text-orange-400/80">{message}</p>
    </div>
  )
}
