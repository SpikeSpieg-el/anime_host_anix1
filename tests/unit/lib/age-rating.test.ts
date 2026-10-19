import { describe, expect, it } from "vitest"
import { getAgeRatingInfo } from "@/lib/age-rating"

describe("getAgeRatingInfo", () => {
  it("переводит сетку Shikimori в понятные метки", () => {
    expect(getAgeRatingInfo("g")?.label).toBe("0+")
    expect(getAgeRatingInfo("pg")?.label).toBe("6+")
    expect(getAgeRatingInfo("pg_13")?.label).toBe("12+")
    expect(getAgeRatingInfo("r")?.label).toBe("16+")
    expect(getAgeRatingInfo("r_plus")?.label).toBe("18+ Этти")
    expect(getAgeRatingInfo("rx")?.label).toBe("18+ Хентай")
  })

  it("не зависит от регистра и пробелов", () => {
    expect(getAgeRatingInfo("R_PLUS")?.label).toBe("18+ Этти")
    expect(getAgeRatingInfo(" rx ")?.description).toContain("хентай")
  })

  it("неизвестный и пустой код → null (не рисуем выдуманного)", () => {
    expect(getAgeRatingInfo(undefined)).toBeNull()
    expect(getAgeRatingInfo("")).toBeNull()
    expect(getAgeRatingInfo("zzz")).toBeNull()
  })

  it("18+ идёт с красным бейджем, детский — с зелёным", () => {
    expect(getAgeRatingInfo("r_plus")?.badgeClass).toContain("bg-red-600")
    expect(getAgeRatingInfo("g")?.badgeClass).toContain("bg-emerald-600")
  })
})
