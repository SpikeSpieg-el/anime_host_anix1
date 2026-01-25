"use client"

import { cn } from "@/lib/utils"

interface SkeletonProps {
  className?: string
  children?: React.ReactNode
}

export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      className={cn("skeleton rounded-md", className)}
      {...props}
    />
  )
}

export function AnimeCardSkeleton() {
  return (
    <div className="group">
      <div className="relative aspect-[2/3] overflow-hidden rounded-lg skeleton" />
      <div className="mt-2 min-h-[3.5rem] space-y-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    </div>
  )
}

export function HeroBannerSkeleton() {
  return (
    <div className="relative h-[70vh] w-full overflow-hidden skeleton">
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center space-y-4">
          <Skeleton className="h-12 w-96 mx-auto" />
          <Skeleton className="h-6 w-64 mx-auto" />
          <Skeleton className="h-10 w-32 mx-auto" />
        </div>
      </div>
    </div>
  )
}

export function TextSkeleton({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn(
            "h-4",
            i === lines - 1 && "w-3/4"
          )}
        />
      ))}
    </div>
  )
}

export function GridSkeleton({ 
  items = 6, 
  component: Component = AnimeCardSkeleton 
}: { 
  items?: number
  component?: React.ComponentType
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
      {Array.from({ length: items }).map((_, i) => (
        <Component key={i} />
      ))}
    </div>
  )
}

export function HistorySkeleton({ items = 6 }: { items?: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 sm:gap-4">
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="group relative block">
          <div className="relative aspect-[16/9] md:aspect-[2/3] overflow-hidden rounded-lg bg-card border border-border skeleton" />
          <div className="mt-2">
            <div className="h-3 w-full bg-muted rounded animate-pulse mb-1" />
            <div className="h-2 w-2/3 bg-muted rounded animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function BookmarksSkeleton({ items = 6 }: { items?: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-3 sm:gap-x-4 gap-y-6 sm:gap-y-8">
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="group">
          <div className="relative aspect-[2/3] overflow-hidden rounded-lg skeleton" />
          <div className="mt-2 min-h-[3.5rem] space-y-2">
            <div className="h-4 w-full bg-muted rounded animate-pulse" />
            <div className="h-3 w-2/3 bg-muted rounded animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  )
}
