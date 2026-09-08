import { describe, expect, it, beforeEach } from "vitest"
import {
  saveCatalogFilters,
  loadCatalogFilters,
  clearCatalogFilters,
} from "@/lib/catalog-preferences"

describe("catalog-preferences", () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it("starts empty", () => {
    expect(loadCatalogFilters()).toEqual({})
  })

  it("persists non-all filters", () => {
    saveCatalogFilters({ genre: "Экшен", status: "ongoing", kind: "tv", year: "2024" })
    expect(loadCatalogFilters()).toEqual({
      genre: ["Экшен"],
      status: "ongoing",
      kind: "tv",
      year: ["2024"],
    })
  })

  it("drops 'all' values", () => {
    saveCatalogFilters({ genre: "all", status: "all", kind: "all", year: "all" })
    expect(loadCatalogFilters()).toEqual({})
  })

  it("keeps arrays of genres/years", () => {
    saveCatalogFilters({ genre: ["Экшен", "Драма"], year: ["2023", "2024"] })
    expect(loadCatalogFilters()).toMatchObject({
      genre: ["Экшен", "Драма"],
      year: ["2023", "2024"],
    })
  })

  it("clearCatalogFilters removes storage", () => {
    saveCatalogFilters({ status: "ongoing" })
    clearCatalogFilters()
    expect(loadCatalogFilters()).toEqual({})
  })

  it("recovers from corrupted JSON", () => {
    localStorage.setItem("catalog-active-filters-v1", "{not-json")
    expect(loadCatalogFilters()).toEqual({})
    expect(localStorage.getItem("catalog-active-filters-v1")).toBeNull()
  })
})
