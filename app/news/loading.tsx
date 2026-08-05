// app/news/loading.tsx
import { Navbar } from "@/components/layout/navbar"
import { Footer } from "@/components/layout/footer"
import { Newspaper } from "lucide-react"

export default function NewsLoading() {
  return (
    <main className="min-h-screen bg-background text-foreground pb-20 md:pb-24 relative">
      <Navbar />

      <div className="container mx-auto px-4 pt-8 pb-12 relative z-10">
        <div className="mb-8">
          <div className="w-32 h-9 bg-zinc-800 rounded-xl mb-4 animate-pulse" />

          <div className="flex items-center gap-3">
            <Newspaper size={28} className="text-blue-400" />
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold text-foreground dark:text-white">
                Новости аниме
              </h1>
              <p className="text-muted-foreground mt-1 dark:text-zinc-500">
                Загрузка последних событий...
              </p>
            </div>
          </div>
        </div>

        {/* Сетка скелетонов карточек новостей */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {Array.from({ length: 9 }).map((_, i) => (
            <div
              key={i}
              className="flex flex-col h-full bg-secondary/30 dark:bg-zinc-900/40 border dark:border-zinc-800/80 rounded-2xl overflow-hidden animate-pulse"
            >
              {/* Картинка */}
              <div className="w-full h-44 bg-zinc-800" />

              <div className="flex flex-col flex-1 p-5 space-y-3">
                {/* Дата и источник */}
                <div className="flex items-center gap-2">
                  <div className="w-16 h-5 bg-zinc-800 rounded-md" />
                  <div className="w-14 h-5 bg-zinc-800 rounded-md" />
                </div>

                {/* Заголовок */}
                <div className="h-5 bg-zinc-800 rounded w-full" />
                <div className="h-5 bg-zinc-800 rounded w-2/3" />

                {/* Текст */}
                <div className="space-y-2 pt-2">
                  <div className="h-3 bg-zinc-800/60 rounded w-full" />
                  <div className="h-3 bg-zinc-800/60 rounded w-4/5" />
                </div>

                {/* Подвал карточки */}
                <div className="flex items-center justify-between pt-4 border-t dark:border-white/5 mt-auto">
                  <div className="w-20 h-4 bg-zinc-800 rounded" />
                  <div className="w-12 h-4 bg-zinc-800 rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Footer />
    </main>
  )
}