"use client"

import { cn } from "@/lib/utils"
import { Play, Bookmark, Star, Calendar, Flame, Sparkles, Zap, Search, Clock, Home, Compass, BookMarked, Settings, History, GraduationCap, Tv, MoreHorizontal, Eye, Info, Hash, TrendingUp, ChevronRight, ExternalLink, HardDrive, FileVideo, Download, ArrowLeft } from "lucide-react"

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

export function AnimeCardSkeleton({ variant = 'default' }: { variant?: 'default' | 'compact' | 'table' }) {
  const isTable = variant === 'table'
  
  if (isTable) {
    return (
      <div className="group relative block bg-secondary/50 rounded-lg border p-3">
        <div className="flex gap-3">
          <div className="relative w-16 h-20 sm:w-20 sm:h-28 flex-shrink-0 overflow-hidden rounded-md bg-secondary skeleton" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-3 w-2/3" />
            <div className="flex items-center justify-between">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-6 w-6 rounded" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="group relative block h-full flex flex-col">
      <div className="relative aspect-[2/3] w-full overflow-hidden rounded-lg bg-secondary skeleton shadow-lg">
        <div className="absolute top-2 right-2 flex flex-col gap-1">
          <Skeleton className="h-4 w-12 rounded" />
          <Skeleton className="h-4 w-16 rounded" />
        </div>
        <div className="absolute top-2 left-2">
          <Skeleton className="h-7 w-7 rounded-full" />
        </div>
        <div className="absolute bottom-2 left-2">
          <Skeleton className="h-4 w-10 rounded" />
        </div>
      </div>
      <div className="mt-2 space-y-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-3 w-2/3" />
      </div>
    </div>
  )
}

export function HeroBannerSkeleton() {
  return (
    <div className="relative w-full min-h-[550px] lg:h-[750px] mb-8 lg:mb-12 overflow-hidden bg-background border-b border-border">
      <div className="absolute inset-0 z-0 skeleton" />
      <div className="relative h-full container mx-auto px-4 z-10 flex flex-col justify-center">
        <div className="flex flex-col lg:flex-row h-full items-center">
          <div className="order-first lg:order-last lg:absolute lg:right-4 lg:top-1/2 lg:-translate-y-1/2 lg:w-5/12 flex justify-center mb-4 lg:mb-0 w-full">
            <div className="relative w-[160px] aspect-[2/3] sm:w-[240px] lg:w-[340px] skeleton rounded-xl lg:rounded-2xl" />
          </div>
          <div className="w-full lg:w-8/12 flex flex-col items-center lg:items-start text-center lg:text-left justify-center relative z-30 pt-2 lg:pt-0 space-y-4">
            <Skeleton className="h-12 sm:h-16 lg:h-20 w-full max-w-lg" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-10 w-24 rounded-lg" />
              <Skeleton className="h-10 w-24 rounded-lg" />
            </div>
            <div className="flex flex-wrap gap-2 justify-center lg:justify-start">
              <Skeleton className="h-8 w-20 rounded-md" />
              <Skeleton className="h-8 w-16 rounded-md" />
              <Skeleton className="h-8 w-24 rounded-md" />
            </div>
            <div className="flex flex-wrap gap-2 justify-center lg:justify-start">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-6 w-16 rounded-full" />
              ))}
            </div>
            <div className="flex gap-3">
              <Skeleton className="h-12 w-32 rounded-xl" />
              <Skeleton className="h-12 w-28 rounded-xl" />
            </div>
          </div>
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
  component?: React.ComponentType<{ variant?: 'default' | 'compact' | 'table' }>
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
          <div className="mt-2 space-y-2">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-2 w-2/3" />
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
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  )
}

// Navbar Skeleton
export function NavbarSkeleton() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 w-full border-b bg-background/80 backdrop-blur-xl">
      <div className="container mx-auto px-4 h-16 md:h-20 flex items-center justify-between gap-4">
        <Skeleton className="h-8 w-32" />
        <div className="hidden md:block flex-1 max-w-sm">
          <Skeleton className="h-9 w-full rounded-xl" />
        </div>
        <div className="flex items-center gap-3 md:gap-6">
          <Skeleton className="h-9 w-9 md:h-10 md:w-10 rounded-full" />
          <Skeleton className="h-9 w-9 md:h-10 md:w-10 rounded-full" />
        </div>
      </div>
    </header>
  )
}

// Mobile Bottom Nav Skeleton
export function MobileNavSkeleton() {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-[400px] md:hidden">
      <div className="bg-background/80 backdrop-blur-xl border rounded-2xl shadow-2xl flex items-center justify-between px-2 py-2 h-[68px]">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex flex-col items-center justify-center gap-1 w-full">
            <Skeleton className="h-5 w-5" />
            <Skeleton className="h-2 w-8" />
          </div>
        ))}
      </div>
    </div>
  )
}

// Footer Skeleton
export function FooterSkeleton() {
  return (
    <footer className="bg-background border-t pt-12 sm:pt-16 pb-8">
      <div className="container mx-auto px-3 sm:px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
          {[1, 2, 3, 4].map((col) => (
            <div key={col} className="space-y-4">
              <Skeleton className="h-6 w-32" />
              <div className="space-y-2">
                {[1, 2, 3, 4].map((item) => (
                  <Skeleton key={item} className="h-4 w-full" />
                ))}
              </div>
            </div>
          ))}
        </div>
        <Skeleton className="h-4 w-full" />
      </div>
    </footer>
  )
}

// Player Loading Skeleton
export function PlayerSkeleton() {
  return (
    <div className="rounded-2xl overflow-hidden border border-border bg-background shadow-2xl relative aspect-video">
      <div className="absolute inset-0 skeleton flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Skeleton className="h-12 w-12 rounded-full" />
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
    </div>
  )
}

// Episode Selector Skeleton
export function EpisodeSelectorSkeleton({ totalEpisodes = 12 }: { totalEpisodes?: number }) {
  return (
    <div className="bg-card/20 border border-border rounded-2xl p-4 md:p-6 backdrop-blur-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-6 w-20" />
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-12 gap-2">
        {Array.from({ length: Math.min(totalEpisodes, 24) }).map((_, i) => (
          <Skeleton key={i} className="aspect-square rounded-lg" />
        ))}
      </div>
    </div>
  )
}

// Search Suggestions Skeleton
export function SearchSuggestionsSkeleton() {
  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Skeleton className="w-full h-9 rounded-xl pl-10 pr-10" />
      </div>
    </div>
  )
}

export function SearchResultsSkeleton() {
  return (
    <div className="absolute top-full left-0 right-0 mt-2 bg-background/95 backdrop-blur-xl border rounded-xl shadow-2xl z-50 max-h-[80vh] overflow-y-auto">
      <div className="p-2 space-y-2">
        <Skeleton className="h-4 w-32 px-3" />
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-start gap-3 p-2">
            <Skeleton className="w-10 h-14 rounded" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-full" />
              <div className="flex items-center gap-2">
                <Skeleton className="h-3 w-12" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// Updates Banner Skeleton
export function UpdatesBannerSkeleton() {
  return (
    <section className="w-full mb-10 sm:mb-16">
      <div className="mb-4 sm:mb-6">
        <div className="flex items-center gap-2">
          <Skeleton className="h-7 w-7 rounded" />
          <Skeleton className="h-8 w-40" />
        </div>
        <Skeleton className="h-4 w-32 mt-2" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {[1, 2].map((col) => (
          <div key={col} className="bg-secondary/40 border rounded-xl sm:rounded-2xl p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-5 rounded" />
                <Skeleton className="h-5 w-28" />
              </div>
              <Skeleton className="h-4 w-20" />
            </div>
            {[1, 2, 3].map((item) => (
              <div key={item} className="flex items-center gap-4 rounded-xl p-3 bg-secondary/40">
                <Skeleton className="w-12 h-16 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
                <Skeleton className="w-9 h-9 rounded-lg" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </section>
  )
}

// Schedule Skeleton
export function ScheduleSkeleton() {
  const days = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]
  
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Skeleton className="h-8 w-8 rounded" />
        <Skeleton className="h-8 w-48" />
      </div>
      
      <div className="flex gap-2 overflow-x-auto pb-2">
        {days.map((day, i) => (
          <Skeleton key={i} className="h-10 w-16 flex-shrink-0 rounded-xl" />
        ))}
      </div>

      <div className="space-y-4">
        {[1, 2, 3].map((day) => (
          <div key={day} className="space-y-3">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-5 rounded" />
              <Skeleton className="h-5 w-32" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {[1, 2, 3, 4].map((item) => (
                <div key={item} className="space-y-2">
                  <Skeleton className="aspect-[2/3] rounded-lg" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-2/3" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// Watch Page Header Skeleton
export function WatchPageHeaderSkeleton() {
  return (
    <div className="flex flex-col gap-6 pt-4 mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Skeleton className="h-9 w-24" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-9 w-28" />
        </div>
      </div>

      <div className="relative overflow-hidden rounded-3xl bg-card/30 border border-border p-4 md:p-8">
        <div className="absolute inset-0 z-0 skeleton" />
        <div className="flex flex-row items-center gap-4 md:gap-8 relative z-10">
          <Skeleton className="relative w-24 aspect-[2/3] md:w-44 shrink-0 rounded-lg md:rounded-xl" />
          <div className="flex flex-col gap-2 md:gap-4 flex-1 space-y-3">
            <Skeleton className="h-8 md:h-12 w-full max-w-lg" />
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <Skeleton className="h-6 w-16" />
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-6 w-32" />
            </div>
            <Skeleton className="h-5 w-48" />
            <div className="flex flex-wrap gap-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-7 w-20 rounded-full" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Catalog Filters Skeleton
export function CatalogFiltersSkeleton() {
  return (
    <div className="bg-card/30 border border-border rounded-2xl p-4 mb-6">
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-9 w-28 rounded-lg" />
        <Skeleton className="h-9 w-24 rounded-lg" />
        <Skeleton className="h-9 w-32 rounded-lg" />
        <Skeleton className="h-9 w-20 rounded-lg" />
        <Skeleton className="h-9 w-24 rounded-lg" />
      </div>
    </div>
  )
}

// Section Skeleton
export function SectionSkeleton({ title = "Раздел", items = 6 }: { title?: string; items?: number }) {
  return (
    <section className="w-full mb-10 sm:mb-12">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-7 w-7 rounded" />
          <Skeleton className="h-7 w-40" />
        </div>
        <Skeleton className="h-8 w-24 rounded-xl" />
      </div>
      <GridSkeleton items={items} />
    </section>
  )
}

// AI Advisor Skeleton
export function AIAdvisorSkeleton() {
  return (
    <div className="bg-gradient-to-br from-orange-500/10 to-purple-500/10 border border-orange-500/20 rounded-2xl p-6">
      <div className="flex items-center gap-3 mb-4">
        <Skeleton className="h-10 w-10 rounded-full" />
        <Skeleton className="h-6 w-48" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-5/6" />
      </div>
    </div>
  )
}

// Dialog Content Skeleton
export function DialogContentSkeleton() {
  return (
    <div className="flex flex-col md:grid md:grid-cols-12 h-full w-full">
      <div className="shrink-0 h-32 sm:h-52 md:h-full md:col-span-5 skeleton" />
      <div className="flex-1 md:col-span-7 flex flex-col min-h-0 p-5 sm:p-8 space-y-4">
        <Skeleton className="h-8 w-full" />
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-6 w-16 rounded" />
          ))}
        </div>
        <TextSkeleton lines={5} />
        <div className="flex gap-3">
          <Skeleton className="h-12 flex-1 rounded-xl" />
          <Skeleton className="h-12 w-12 rounded-xl" />
        </div>
      </div>
    </div>
  )
}

// News Section Skeleton
export function NewsSkeleton({ items = 4 }: { items?: number }) {
  return (
    <section className="mb-14 sm:mb-20">
      <div className="flex flex-row items-center justify-between mb-4 sm:mb-6">
        <div>
          <div className="flex items-center gap-2 sm:gap-3 mb-1">
            <Skeleton className="h-7 w-7 rounded" />
            <Skeleton className="h-8 w-28" />
            <Skeleton className="h-5 w-14 rounded hidden sm:block" />
          </div>
          <Skeleton className="h-4 w-44 hidden xs:block" />
        </div>
        <Skeleton className="h-8 w-28 rounded-full" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
        {Array.from({ length: items }).map((_, i) => (
          <div key={i} className="flex flex-col h-full bg-secondary/40 border rounded-xl sm:rounded-2xl p-4 sm:p-5">
            <Skeleton className="h-4 w-24 mb-2 sm:mb-3" />
            <Skeleton className="h-5 w-full mb-1" />
            <Skeleton className="h-5 w-4/5 mb-2" />
            <Skeleton className="h-4 w-full mb-1 flex-1" />
            <Skeleton className="h-4 w-3/4 mb-3 sm:mb-4" />
            <div className="flex items-center justify-between pt-3 sm:pt-4 border-t">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-6 w-10 rounded-md" />
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

// Loading Bar for global loading states
export function LoadingBarSkeleton({ progress = 30 }: { progress?: number }) {
  return (
    <div className="fixed top-16 left-0 right-0 z-50">
      <div className="h-1 bg-muted">
        <div 
          className="h-full bg-primary transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  )
}
