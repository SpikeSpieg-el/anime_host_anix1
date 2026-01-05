"use client"

import { useState, useMemo, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { Navbar } from "@/components/navbar"
import { FilterToolbar } from "@/components/filter-toolbar"
import { CatalogGrid } from "@/components/catalog-grid"
import { RecentlyViewed } from "@/components/recently-viewed"
import { animeData } from "@/lib/anime-data"

export default function AnimeCatalogPage() {
  const searchParams = useSearchParams()

  const [selectedGenre, setSelectedGenre] = useState("")
  const [selectedYear, setSelectedYear] = useState("")
  const [selectedCountry, setSelectedCountry] = useState("")
  const [selectedSort, setSelectedSort] = useState("Popular")

  // Initialize filters from URL params
  useEffect(() => {
    const genre = searchParams.get("genre") || ""
    const year = searchParams.get("year") || ""
    const country = searchParams.get("country") || ""
    const sort = searchParams.get("sort") || "Popular"
    const search = searchParams.get("search") || ""

    setSelectedGenre(genre)
    setSelectedYear(year)
    setSelectedCountry(country)
    setSelectedSort(sort)
  }, [searchParams])

  const searchQuery = searchParams.get("search") || ""

  const filteredAnime = useMemo(() => {
    let result = [...animeData]

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      result = result.filter(
        (anime) =>
          anime.title.toLowerCase().includes(query) ||
          anime.originalTitle.toLowerCase().includes(query) ||
          anime.genres.some((g) => g.toLowerCase().includes(query)),
      )
    }

    // Genre filter
    if (selectedGenre) {
      result = result.filter((anime) => anime.genres.includes(selectedGenre))
    }

    // Year filter
    if (selectedYear) {
      result = result.filter((anime) => anime.year === Number.parseInt(selectedYear))
    }

    // Country filter
    if (selectedCountry) {
      result = result.filter((anime) => anime.country === selectedCountry)
    }

    // Sorting
    switch (selectedSort) {
      case "Newest":
        result.sort((a, b) => b.year - a.year)
        break
      case "Popular":
        result.sort((a, b) => b.rating - a.rating)
        break
      case "Rating":
        result.sort((a, b) => b.rating - a.rating)
        break
      case "A-Z":
        result.sort((a, b) => a.title.localeCompare(b.title))
        break
    }

    return result
  }, [searchQuery, selectedGenre, selectedYear, selectedCountry, selectedSort])

  const clearFilters = () => {
    setSelectedGenre("")
    setSelectedYear("")
    setSelectedCountry("")
    setSelectedSort("Popular")
  }

  return (
    <div className="min-h-screen bg-black">
      <Navbar />
      <FilterToolbar
        selectedGenre={selectedGenre}
        selectedYear={selectedYear}
        selectedCountry={selectedCountry}
        selectedSort={selectedSort}
        onGenreChange={setSelectedGenre}
        onYearChange={setSelectedYear}
        onCountryChange={setSelectedCountry}
        onSortChange={setSelectedSort}
        onClearFilters={clearFilters}
      />

      <main className="container mx-auto px-4 py-8 lg:px-8">
        {/* Results Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">
            {searchQuery ? `Search: "${searchQuery}"` : "Anime Catalog"}
          </h1>
          <p className="text-sm text-zinc-500 mt-1">{filteredAnime.length} titles found</p>
        </div>

        {/* Catalog Grid */}
        <CatalogGrid anime={filteredAnime} />

        {/* Recently Viewed */}
        <RecentlyViewed />
      </main>
    </div>
  )
}
