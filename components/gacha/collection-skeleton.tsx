"use client"

import { cn } from "@/lib/utils"

interface SkeletonProps {
  className?: string
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn("bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 animate-pulse rounded-md", className)}
      style={{
        backgroundSize: "200% 100%",
        animation: "shimmer 1.5s infinite linear"
      }}
    />
  )
}

interface CollectionCardSkeletonProps {
  count?: number
}

export function CollectionCardSkeleton({ count = 12 }: CollectionCardSkeletonProps) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="aspect-[2/3] rounded-xl overflow-hidden border border-white/10 relative bg-slate-900"
        >
          <Skeleton className="absolute inset-0 w-full h-full" />
          <div className="absolute bottom-0 inset-x-0 p-3 space-y-2">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-2 w-1/2" />
          </div>
          <Skeleton className="absolute top-2 right-2 w-3 h-3 rounded-full" />
        </div>
      ))}
    </>
  )
}
