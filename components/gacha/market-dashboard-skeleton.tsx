"use client"

export function MarketDashboardSkeleton() {
  return (
    <div className="min-h-screen bg-[#020617] p-4 md:p-8 lg:p-12 relative overflow-hidden">
      {/* Background blobs */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-cyan-500/5 blur-[120px] rounded-full -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-purple-500/5 blur-[120px] rounded-full translate-y-1/2 -translate-x-1/2" />

      <div className="max-w-7xl mx-auto space-y-8 relative">
        {/* Header skeleton */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-clate-500/20 animate-pulse" />
              <div className="space-y-2">
                <div className="h-10 w-64 bg-slate-800 rounded animate-pulse" />
                <div className="h-4 w-48 bg-slate-800/60 rounded animate-pulse" />
              </div>
            </div>
          </div>
          <div className="h-12 w-40 bg-slate-900 border border-slate-700 rounded-xl animate-pulse" />
        </div>

        {/* Stats Overview skeleton */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="group relative bg-[#0f172a]/40 backdrop-blur-xl border border-slate-800/60 rounded-3xl p-5">
              <div className="w-12 h-12 rounded-xl bg-slate-800 mb-4 animate-pulse" />
              <div className="space-y-1">
                <div className="h-3 w-24 bg-slate-800/60 rounded animate-pulse" />
                <div className="h-8 w-20 bg-slate-800 rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>

        {/* Tabs skeleton */}
        <div className="p-1.5 bg-slate-900/50 backdrop-blur-xl border border-slate-800/80 rounded-2xl flex gap-1.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex-1 h-12 bg-slate-800/50 rounded-xl animate-pulse" />
          ))}
        </div>

        {/* Filter Bar skeleton */}
        <div className="flex items-center justify-between gap-4 py-2 px-4 bg-slate-900/30 border border-slate-800/50 rounded-2xl">
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 bg-slate-800/50 rounded-lg animate-pulse" />
            <div className="h-4 w-32 bg-slate-800/60 rounded animate-pulse hidden lg:block" />
            <div className="h-10 w-48 bg-[#0f172a] border border-slate-800 rounded-xl animate-pulse" />
          </div>
          <div className="h-4 w-32 bg-slate-800/60 rounded animate-pulse hidden sm:block" />
        </div>

        {/* Listings skeleton */}
        <div className="group/container relative">
          <div className="absolute inset-0 bg-cyan-500/5 blur-3xl rounded-full animate-pulse" />
          <div className="relative bg-[#0f172a]/60 backdrop-blur-2xl border border-slate-800/80 rounded-[2.5rem] p-6 md:p-8">
            <div className="flex items-center justify-between mb-8">
              <div className="space-y-1">
                <div className="h-8 w-48 bg-slate-800 rounded animate-pulse" />
                <div className="h-4 w-64 bg-slate-800/60 rounded animate-pulse" />
              </div>
            </div>
            
            <div className="space-y-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="group relative bg-slate-900/40 border border-slate-800/80 rounded-3xl p-5">
                  <div className="absolute inset-y-0 left-0 w-1.5 rounded-l-full bg-slate-700 animate-pulse" />
                  
                  <div className="flex flex-col lg:flex-row justify-between items-center gap-6">
                    <div className="flex flex-col md:flex-row items-center gap-6 flex-1 w-full">
                      <div className="relative shrink-0">
                        <div className="w-20 h-20 md:w-24 md:h-24 bg-slate-800 rounded-2xl border-2 border-slate-800 animate-pulse" />
                      </div>

                      <div className="flex-1 space-y-3 w-full">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="h-5 w-20 bg-slate-800/60 rounded-full animate-pulse" />
                          <div className="h-6 w-48 bg-slate-800 rounded animate-pulse" />
                          <div className="h-4 w-32 bg-slate-800/60 rounded animate-pulse" />
                        </div>
                        
                        <div className="grid grid-cols-5 gap-1 max-w-sm">
                          {Array.from({ length: 5 }).map((_, j) => (
                            <div key={j} className="h-10 bg-slate-950/50 rounded-xl border border-slate-800/50 animate-pulse" />
                          ))}
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                          <div className="h-5 w-32 bg-slate-950/50 rounded-lg border border-slate-800/50 animate-pulse" />
                          <div className="h-5 w-24 bg-slate-800/60 rounded-lg animate-pulse" />
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-center gap-3 min-w-[140px] p-6 lg:p-0 bg-slate-950/20 rounded-3xl border border-slate-800/50">
                      <div className="space-y-0.5">
                        <div className="h-10 w-32 bg-slate-800 rounded animate-pulse" />
                        <div className="h-3 w-20 bg-slate-800/60 rounded animate-pulse" />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
