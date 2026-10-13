import { describe, expect, it } from "vitest"
import {
  CATALOG_BASE_URL,
  buildCatalogCanonical,
  hasIndexableCatalogFilters,
  resolveCatalogGenreRedirect,
  resolveGenreParam,
} from "@/lib/seo/catalog-filters"

const sp = (query: string) => new URLSearchParams(query)

describe("resolveGenreParam", () => {
  it("понимает русское название, ID Shikimori и латинский slug", () => {
    expect(resolveGenreParam("Исекай")?.slug).toBe("isekai")
    expect(resolveGenreParam("543")?.slug).toBe("isekai")
    expect(resolveGenreParam("isekai")?.slug).toBe("isekai")
  })

  it("не превращает мусор в жанр", () => {
    expect(resolveGenreParam("anime-123")).toBeUndefined()
    expect(resolveGenreParam("all")).toBeUndefined()
    expect(resolveGenreParam("")).toBeUndefined()
    expect(resolveGenreParam(null)).toBeUndefined()
  })
})

describe("301 с фильтра одного жанра на жанровый лендинг", () => {
  it("уводит на канонический slug", () => {
    expect(resolveCatalogGenreRedirect(sp("genre=Исекай"))).toBe("/genre/isekai")
    expect(resolveCatalogGenreRedirect(sp("genre=543"))).toBe("/genre/isekai")
    expect(resolveCatalogGenreRedirect(sp("genre=isekai"))).toBe("/genre/isekai")
    expect(resolveCatalogGenreRedirect(sp("genre=%D0%A0%D0%BE%D0%BC%D0%B0%D0%BD%D1%82%D0%B8%D0%BA%D0%B0")))
      .toBe("/genre/romantika")
  })

  it("не трогает комбинации — они длинный хвост со своим canonical", () => {
    expect(resolveCatalogGenreRedirect(sp("genre=Исекай&year=2024"))).toBeNull()
    expect(resolveCatalogGenreRedirect(sp("genre=Исекай&kind=tv"))).toBeNull()
    expect(resolveCatalogGenreRedirect(sp("genre=Исекай&status=ongoing"))).toBeNull()
  })

  it("не трогает несколько жанров подряд и страницы без genre", () => {
    expect(resolveCatalogGenreRedirect(sp("genre=Исекай,Романтика"))).toBeNull()
    expect(resolveCatalogGenreRedirect(sp("genre=Исекай&genre=Драма"))).toBeNull()
    expect(resolveCatalogGenreRedirect(sp("year=2024"))).toBeNull()
    expect(resolveCatalogGenreRedirect(sp(""))).toBeNull()
  })
})

describe("canonical /catalog", () => {
  it("жанр и год получают self-canonical", () => {
    expect(hasIndexableCatalogFilters(sp("genre=Исекай&year=2024"))).toBe(true)
    expect(buildCatalogCanonical(sp("genre=Исекай&year=2024")))
      .toBe(`${CATALOG_BASE_URL}?genre=%D0%98%D1%81%D0%B5%D0%BA%D0%B0%D0%B9&year=2024`)
    expect(buildCatalogCanonical(sp("year=2024"))).toBe(`${CATALOG_BASE_URL}?year=2024`)
  })

  it("приводит жанр к русскому названию, чтобы 543/isekai/Исекай не плодили URL", () => {
    const canonical = buildCatalogCanonical(sp("genre=543&year=2024"))
    expect(canonical).toBe(buildCatalogCanonical(sp("genre=isekai&year=2024")))
    expect(canonical).toContain(encodeURIComponent("Исекай"))
  })

  it("служебные фильтры схлопываются на голый /catalog", () => {
    for (const query of ["", "sort=popular", "page=2", "search=isekai", "kind=movie", "status=ongoing", "score=8"]) {
      expect(buildCatalogCanonical(sp(query))).toBe(CATALOG_BASE_URL)
      expect(hasIndexableCatalogFilters(sp(query))).toBe(false)
    }
  })

  it("несколько жанров или лет — это комбинация, а не страница", () => {
    expect(hasIndexableCatalogFilters(sp("genre=%D0%98%D1%81%D0%B5%D0%BA%D0%B0%D0%B9&genre=%D0%94%D1%80%D0%B0%D0%BC%D0%B0"))).toBe(false)
    expect(hasIndexableCatalogFilters(sp("year=2024&year=2025"))).toBe(false)
    expect(buildCatalogCanonical(sp("genre=%D0%98%D1%81%D0%B5%D0%BA%D0%B0%D0%B9&genre=%D0%94%D1%80%D0%B0%D0%BC%D0%B0")))
      .toBe(CATALOG_BASE_URL)
  })

  it("не канонизирует пустые значения: ?genre= это тот же /catalog", () => {
    expect(buildCatalogCanonical(sp("genre=&year="))).toBe(CATALOG_BASE_URL)
    expect(hasIndexableCatalogFilters(sp("genre="))).toBe(false)
  })
})