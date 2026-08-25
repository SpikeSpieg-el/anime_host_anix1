"use client"

interface BannerSkeletonProps {
  count?: number
}

export function BannerSkeleton({ count = 6 }: BannerSkeletonProps) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="relative rounded-2xl sm:rounded-3xl overflow-hidden border border-pink-500/20 animate-pulse bg-slate-900"
        >
          {/* Background shimmer */}
          <div
            className="absolute inset-0 w-full h-full"
            style={{
              backgroundSize: "200% 100%",
              animation: "shimmer 1.5s infinite linear",
            }}
          >
            <div className="w-full h-full bg-gradient-to-br from-slate-800 via-slate-900 to-pink-900 opacity-70" />
            <div className="absolute inset-0 bg-black/30" />
          </div>

          {/* Promo art placeholder */}
          <div className="relative z-10 w-full h-[56%] bg-slate-800/40" />

          {/* Top badges row */}
          <div className="relative z-10 p-5 sm:p-6 flex items-start justify-between">
            <div className="p-2.5 bg-pink-500/30 backdrop-blur-md rounded-xl border border-pink-400/40 shadow-lg">
              <div className="w-4 h-4 bg-slate-600 rounded" />
            </div>
            <div className="flex items-center gap-2">
              <button className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-900/80 backdrop-blur-md border border-white/10 shadow-lg">
                <div className="w-3.5 h-3.5 bg-slate-600 rounded" />
              </button>
              <div className="flex items-center gap-1.5 bg-slate-900/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 shadow-lg">
                <div className="w-4 h-4 bg-yellow-600 rounded" />
                <div className="h-4 w-8 bg-slate-600 rounded" />
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="relative z-10 p-5 sm:p-6 pt-2 space-y-3">
            <div className="h-6 w-full bg-slate-700 rounded mb-1" />
            <div className="h-4 w-2/3 bg-slate-800 rounded" />

            {/* Featured cards */}
            <div className="flex gap-2">
              {[0, 1, 2].map((fc) => (
                <div key={fc} className="relative w-16 h-24 sm:w-20 sm:h-28 rounded-lg border-2 border-amber-400/70 shadow-lg shadow-amber-500/20 overflow-hidden">
                  <div className="w-full h-full bg-slate-800" />
                  <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-400 to-yellow-500" />
                </div>
              ))}
            </div>

            {/* Badges */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900/70 backdrop-blur-md border border-white/10">
                <div className="w-3.5 h-3.5 bg-pink-300 rounded" />
                <div className="h-3 w-14 bg-slate-600 rounded" />
              </div>
              <div className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-pink-500/20 backdrop-blur-md border border-pink-500/30">
                <div className="w-3.5 h-3.5 bg-pink-300 rounded" />
                <div className="h-3 w-24 bg-slate-600 rounded" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </>
  )
}
