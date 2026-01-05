"use client"

import Link from "next/link"
import Image from "next/image"
import { Play, Star, Info } from "lucide-react"
import { animeData } from "@/lib/anime-data"

export function HeroSection() {
  // Выбираем аниме с самым высоким рейтингом
  const featuredAnime = [...animeData].sort((a, b) => b.rating - a.rating)[0]

  // ИСПРАВЛЕНИЕ: Вычисляем количество серий из новой структуры 'players'
  // Берем первую доступную озвучку и считаем длину массива ссылок
  const defaultVoiceover = Object.keys(featuredAnime.players)[0]
  const episodeCount = featuredAnime.players[defaultVoiceover]?.length || 0

  return (
    <section className="relative h-[70vh] min-h-[500px] w-full overflow-hidden">
      {/* Background Image */}
      <div className="absolute inset-0">
        <Image
          src={featuredAnime.poster || "/placeholder.svg"}
          alt={featuredAnime.title}
          fill
          className="object-cover object-center"
          priority
        />
        {/* Gradient Overlays */}
        <div className="absolute inset-0 bg-gradient-to-r from-black via-black/70 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
      </div>

      {/* Content */}
      <div className="relative container mx-auto flex h-full flex-col justify-end px-4 pb-16 lg:px-8">
        <div className="max-w-2xl space-y-4">
          {/* Badge */}
          <div className="flex items-center gap-2">
            <span className="rounded bg-orange-500 px-2 py-1 text-xs font-bold text-black">FEATURED</span>
            <span className="flex items-center gap-1 text-sm text-zinc-300">
              <Star className="h-4 w-4 fill-amber-500 text-amber-500" />
              {featuredAnime.rating}
            </span>
          </div>

          {/* Title */}
          <h1 className="text-4xl font-bold text-white md:text-5xl lg:text-6xl text-balance">{featuredAnime.title}</h1>

          {/* Meta */}
          <div className="flex flex-wrap items-center gap-3 text-sm text-zinc-400">
            <span>{featuredAnime.year}</span>
            <span className="h-1 w-1 rounded-full bg-zinc-600" />
            
            {/* ИСПРАВЛЕНИЕ: Используем вычисленную переменную episodeCount */}
            <span>{episodeCount} Episodes</span>
            
            <span className="h-1 w-1 rounded-full bg-zinc-600" />
            <span>{featuredAnime.quality}</span>
            <span className="h-1 w-1 rounded-full bg-zinc-600" />
            {featuredAnime.genres.slice(0, 3).map((genre, index) => (
              <span key={genre}>
                {genre}
                {index < 2 && ", "}
              </span>
            ))}
          </div>

          {/* Description */}
          <p className="text-zinc-300 line-clamp-3 leading-relaxed">{featuredAnime.description}</p>

          {/* Actions */}
          <div className="flex flex-wrap gap-3 pt-2">
            <Link
              href={`/watch/${featuredAnime.id}`}
              className="inline-flex items-center gap-2 rounded-lg bg-orange-500 px-6 py-3 font-semibold text-black hover:bg-orange-400 transition-colors"
            >
              <Play className="h-5 w-5 fill-black" />
              Watch Now
            </Link>
            <Link
              href={`/watch/${featuredAnime.id}`}
              className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900/50 px-6 py-3 font-semibold text-white hover:bg-zinc-800 transition-colors"
            >
              <Info className="h-5 w-5" />
              More Info
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}