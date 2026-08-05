// app/news/[id]/loading.tsx
import { Navbar } from "@/components/layout/navbar"
import { Footer } from "@/components/layout/footer"
import { ArrowLeft } from "lucide-react"

export default function NewsItemLoading() {
  return (
    <main className="min-h-screen bg-background text-foreground relative">
      <Navbar />

      {/* Hero Skeleton Header */}
      <div className="relative w-full h-[38vh] min-h-[260px] max-h-[460px] overflow-hidden bg-zinc-900/60 animate-pulse">
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-transparent" />
        <div className="absolute inset-0 flex flex-col justify-end">
          <div className="container mx-auto px-4 pb-6 sm:pb-8 max-w-4xl">
            {/* Кнопка назад */}
            <div className="mb-4">
              <div className="w-24 h-9 bg-zinc-800 rounded-xl" />
            </div>

            {/* Бейджи */}
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <div className="w-20 h-6 bg-zinc-800 rounded-full" />
              <div className="w-16 h-6 bg-zinc-800 rounded-full" />
              <div className="w-24 h-6 bg-zinc-800 rounded-full" />
            </div>

            {/* Заголовок */}
            <div className="h-8 sm:h-10 bg-zinc-800 rounded-xl w-3/4 mb-2" />
            <div className="h-8 sm:h-10 bg-zinc-800 rounded-xl w-1/2" />
          </div>
        </div>
      </div>

      {/* Article Content Skeleton */}
      <div className="container mx-auto px-4 pt-6 sm:pt-8 pb-16 sm:pb-20 relative z-10 max-w-4xl">
        <div className="bg-secondary/20 dark:bg-zinc-900/40 border dark:border-zinc-800/80 rounded-2xl p-6 sm:p-8 space-y-4 animate-pulse">
          <div className="h-4 bg-zinc-800 rounded w-full" />
          <div className="h-4 bg-zinc-800 rounded w-11/12" />
          <div className="h-4 bg-zinc-800 rounded w-4/5" />
          <div className="h-48 bg-zinc-800/60 rounded-xl w-full my-6" />
          <div className="h-4 bg-zinc-800 rounded w-full" />
          <div className="h-4 bg-zinc-800 rounded w-9/12" />
          <div className="h-4 bg-zinc-800 rounded w-10/12" />
        </div>
      </div>

      <Footer />
    </main>
  )
}