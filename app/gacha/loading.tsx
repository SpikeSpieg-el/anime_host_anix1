"use client"

import { GachaLoading } from "@/components/gacha-loading"
import { CollectionCardSkeleton } from "@/components/collection-skeleton"
import { Package, Coins } from "lucide-react"

export default function GachaLoadingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950/20 to-slate-950">
      {/* Background decorations */}
      <div className="fixed top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-900/20 blur-[120px] pointer-events-none" />
      <div className="fixed bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-purple-900/10 blur-[120px] pointer-events-none" />
      
      <div className="container mx-auto px-4 sm:px-6 py-8 sm:py-12 lg:py-16 max-w-7xl relative z-10">
        {/* Header skeleton */}
        <div className="text-center mb-10 sm:mb-16">
          <div className="h-12 sm:h-16 md:h-20 lg:h-24 w-64 sm:w-80 md:w-96 lg:w-[32rem] mx-auto bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 rounded-lg animate-pulse mb-4" />
          <div className="h-4 w-64 sm:w-80 md:w-96 mx-auto bg-slate-700 rounded animate-pulse" />
          
          {/* Coins display skeleton */}
          <div className="flex justify-center items-center gap-3 sm:gap-4 mt-8">
            <div className="flex items-center gap-2.5 px-5 py-2.5 rounded-2xl bg-slate-900/80 backdrop-blur-md border border-slate-800 shadow-xl animate-pulse">
              <div className="w-5 h-5 sm:w-6 sm:h-6 bg-slate-600 rounded-full" />
              <div className="h-6 w-16 bg-slate-600 rounded animate-pulse" />
            </div>
          </div>
        </div>

        {/* Main content area */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left column - Gacha area */}
          <div className="lg:col-span-2">
            <div className="bg-slate-900/50 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
              <div className="flex justify-center items-center min-h-[400px] sm:min-h-[500px]">
                <div className="flex flex-col items-center w-full max-w-md mx-auto">
                  <div className="w-64 sm:w-72 md:w-80 h-[380px] sm:h-[420px] md:h-[480px] rounded-[2rem] sm:rounded-[2.5rem] bg-slate-900/40 border border-slate-700/50 animate-pulse flex flex-col items-center justify-center relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-slate-800 via-slate-900 to-indigo-950/40 opacity-50" />
                    <div className="relative z-10 flex flex-col items-center gap-4">
                      <div className="w-16 h-16 border-3 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
                      <p className="text-slate-400 font-medium text-sm">Загрузка гачи...</p>
                    </div>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mt-6 sm:mt-8 w-full">
                    <div className="flex-1 h-12 bg-slate-800/50 rounded-xl animate-pulse border border-slate-700/50 flex items-center justify-center gap-2">
                      <Package className="w-5 h-5 text-slate-600" />
                      <span className="text-slate-600 text-sm">Выбрать набор</span>
                    </div>
                    <div className="flex-1 h-12 bg-slate-800/50 rounded-xl animate-pulse border border-slate-700/50" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right column - Collection */}
          <div className="lg:col-span-1">
            <div className="bg-slate-900/50 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
              <div className="mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 bg-slate-700 rounded-lg animate-pulse" />
                  <div className="h-6 w-24 bg-slate-700 rounded animate-pulse" />
                  <div className="h-5 w-8 bg-slate-800 rounded animate-pulse" />
                </div>
              </div>
              
              {/* Collection skeleton */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <CollectionCardSkeleton count={6} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
