"use client"

import type { CatalogFilters } from "@/lib/shikimori"

// Общий хранилище активных фильтров каталога (жанры, статус, тип, год).
// Используется как в компоненте каталога, так и в «духе» для подбора случайного аниме.
const STORAGE_KEY = "catalog-active-filters-v1"

interface StoredFilters {
  genre?: string | string[]
  status?: string
  kind?: string
  year?: string | string[]
}

function sanitize(filters: CatalogFilters): StoredFilters {
  const out: StoredFilters = {}
  if (filters.genre && filters.genre !== "all") {
    out.genre = Array.isArray(filters.genre) ? filters.genre : [filters.genre]
  }
  if (filters.status && filters.status !== "all") out.status = filters.status
  if (filters.kind && filters.kind !== "all") out.kind = filters.kind
  if (filters.year && filters.year !== "all") {
    out.year = Array.isArray(filters.year) ? filters.year : [filters.year]
  }
  return out
}

export function saveCatalogFilters(filters: CatalogFilters): void {
  try {
    const safe = sanitize(filters)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(safe))
  } catch (error) {
    console.error("[catalog-preferences] Failed to persist filters:", error)
  }
}

export function loadCatalogFilters(): StoredFilters {
  if (typeof window === "undefined") return {}
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as StoredFilters
    // Валидация, чтобы не допустить мусора из localStorage
    if (parsed && typeof parsed === "object") {
      if (Array.isArray(parsed.genre)) parsed.genre = parsed.genre.filter((g) => typeof g === "string" && g !== "all")
      if (Array.isArray(parsed.year)) parsed.year = parsed.year.filter((y) => typeof y === "string")
    }
    return parsed
  } catch {
    window.localStorage.removeItem(STORAGE_KEY)
    return {}
  }
}

export function clearCatalogFilters(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch (error) {
    console.error("[catalog-preferences] Failed to clear filters:", error)
  }
}
