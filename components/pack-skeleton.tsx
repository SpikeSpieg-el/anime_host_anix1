"use client"

interface PackCardSkeletonProps {
  count?: number
}

export function PackCardSkeleton({ count = 6 }: PackCardSkeletonProps) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="relative rounded-2xl sm:rounded-3xl overflow-hidden border border-white/10 p-5 sm:p-6 animate-pulse"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-slate-800 via-slate-900 to-slate-800 opacity-60" />
          <div className="absolute inset-0 bg-black/20" />
          
          <div className="relative z-10 h-full flex flex-col">
            <div className="flex items-start justify-between mb-4">
              <div className="p-2 sm:p-2.5 bg-white/10 backdrop-blur-md rounded-xl border border-white/20">
                <div className="w-6 h-6 sm:w-7 sm:h-7 bg-slate-600 rounded" />
              </div>
              <div className="flex items-center gap-1.5 bg-slate-900/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 shadow-lg">
                <div className="w-4 h-4 bg-yellow-600 rounded-full" />
                <div className="h-4 w-8 bg-slate-600 rounded" />
              </div>
            </div>
            
            <div className="mt-auto">
              <div className="h-6 w-full bg-slate-600 rounded mb-2" />
              <div className="h-4 w-3/4 bg-slate-700 rounded mb-4" />
              
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-indigo-500/20 backdrop-blur-md border border-indigo-500/30">
                <div className="w-3.5 h-3.5 bg-indigo-400 rounded" />
                <div className="h-3 w-20 bg-indigo-300 rounded" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </>
  )
}
