"use client"

interface MarketCardSkeletonProps {
  count?: number
}

export function MarketCardSkeleton({ count = 8 }: MarketCardSkeletonProps) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="group rounded-2xl overflow-hidden border bg-slate-900/90 relative flex flex-col"
          style={{
            borderColor: 'rgba(148, 163, 184, 0.35)',
            boxShadow: '0 0 0 1px rgba(148, 163, 184, 0.12), 0 12px 40px rgba(0,0,0,0.55), 0 0 32px rgba(148, 163, 184, 0.18)',
          }}
        >
          {/* Image area skeleton */}
          <div className="aspect-[2/3] relative w-full">
            <div className="absolute inset-0 bg-gradient-to-br from-slate-800 via-slate-700 to-slate-800 animate-pulse"
                 style={{ backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite linear" }} />
            
            {/* Top gradient bar */}
            <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-transparent via-slate-600 to-transparent animate-pulse" />
            
            {/* Rarity badge skeleton */}
            <div className="absolute top-2 right-2 px-2 py-0.5 rounded-lg h-5 w-16 bg-black/60 border border-white/10 animate-pulse" />
            
            {/* Modifiers skeleton */}
            <div className="absolute bottom-2 left-2 flex flex-col gap-1">
              <div className="px-1.5 py-0.5 rounded h-4 w-12 bg-slate-800/60 animate-pulse" />
              <div className="px-1.5 py-0.5 rounded h-4 w-12 bg-slate-800/60 animate-pulse" />
            </div>
          </div>
          
          {/* Content area skeleton */}
          <div className="p-3 flex-1 flex flex-col gap-2">
            <div className="h-3 w-full bg-slate-800/60 rounded animate-pulse" />
            <div className="h-5 w-3/4 bg-slate-800 rounded animate-pulse" />
            <div className="flex items-center gap-2">
              <div className="h-3 w-8 bg-slate-800/60 rounded animate-pulse" />
              <div className="h-3 w-6 bg-slate-800/60 rounded animate-pulse" />
              <div className="h-3 w-2 bg-slate-800/60 rounded animate-pulse" />
              <div className="h-3 w-8 bg-slate-800/60 rounded animate-pulse" />
              <div className="h-3 w-6 bg-slate-800/60 rounded animate-pulse" />
            </div>
            <div className="inline-flex items-center gap-2 w-fit px-2.5 py-1 rounded-full h-6 w-20 bg-slate-800/60 border border-slate-700 animate-pulse" />
            <div className="flex items-center gap-1 h-6 w-24 bg-slate-800/60 rounded animate-pulse" />
            <div className="h-3 w-32 bg-slate-800/60 rounded animate-pulse" />
            <div className="mt-auto pt-1 flex flex-col gap-2">
              <div className="h-9 w-full bg-slate-800/60 rounded-xl animate-pulse" />
            </div>
          </div>
        </div>
      ))}
    </>
  )
}
