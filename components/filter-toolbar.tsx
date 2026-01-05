"use client"

import { ChevronDown, X } from "lucide-react"
import { genres, years, countries, sortOptions } from "@/lib/anime-data"

interface FilterToolbarProps {
  selectedGenre: string
  selectedYear: string
  selectedCountry: string
  selectedSort: string
  onGenreChange: (genre: string) => void
  onYearChange: (year: string) => void
  onCountryChange: (country: string) => void
  onSortChange: (sort: string) => void
  onClearFilters: () => void
}

export function FilterToolbar({
  selectedGenre,
  selectedYear,
  selectedCountry,
  selectedSort,
  onGenreChange,
  onYearChange,
  onCountryChange,
  onSortChange,
  onClearFilters,
}: FilterToolbarProps) {
  const hasActiveFilters = selectedGenre || selectedYear || selectedCountry || selectedSort !== "Popular"

  return (
    <div className="sticky top-16 z-40 w-full border-b border-zinc-800 bg-zinc-900/95 backdrop-blur">
      <div className="container mx-auto flex flex-wrap items-center gap-3 px-4 py-3 lg:px-8">
        {/* Genre Dropdown */}
        <div className="relative">
          <select
            value={selectedGenre}
            onChange={(e) => onGenreChange(e.target.value)}
            className="appearance-none rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 pr-10 text-sm text-white hover:border-zinc-600 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
          >
            <option value="">All Genres</option>
            {genres.map((genre) => (
              <option key={genre} value={genre}>
                {genre}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400 pointer-events-none" />
        </div>

        {/* Year Dropdown */}
        <div className="relative">
          <select
            value={selectedYear}
            onChange={(e) => onYearChange(e.target.value)}
            className="appearance-none rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 pr-10 text-sm text-white hover:border-zinc-600 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
          >
            <option value="">All Years</option>
            {years.map((year) => (
              <option key={year} value={year.toString()}>
                {year}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400 pointer-events-none" />
        </div>

        {/* Country Dropdown */}
        <div className="relative">
          <select
            value={selectedCountry}
            onChange={(e) => onCountryChange(e.target.value)}
            className="appearance-none rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 pr-10 text-sm text-white hover:border-zinc-600 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
          >
            <option value="">All Countries</option>
            {countries.map((country) => (
              <option key={country} value={country}>
                {country}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400 pointer-events-none" />
        </div>

        {/* Sort Dropdown */}
        <div className="relative">
          <select
            value={selectedSort}
            onChange={(e) => onSortChange(e.target.value)}
            className="appearance-none rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 pr-10 text-sm text-white hover:border-zinc-600 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
          >
            {sortOptions.map((option) => (
              <option key={option} value={option}>
                Sort: {option}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400 pointer-events-none" />
        </div>

        {/* Clear Filters */}
        {hasActiveFilters && (
          <button
            onClick={onClearFilters}
            className="flex items-center gap-1 rounded-lg border border-orange-500/50 bg-orange-500/10 px-3 py-2 text-sm text-orange-500 hover:bg-orange-500/20 transition-colors"
          >
            <X className="h-4 w-4" />
            Clear
          </button>
        )}
      </div>
    </div>
  )
}
