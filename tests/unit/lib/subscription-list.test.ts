/**
 * Список отслеживаемых (`/api/subscriptions`).
 *
 * Данные лежат в двух таблицах — `title_subscriptions` (каналы) и
 * `translation_alerts` (конкретное ожидание озвучки). Их рассинхрон и портил
 * обещания, поэтому отбор и склейку проверяем отдельно: правила обязаны быть
 * в одном месте, иначе страница и проверка ожиданий начнут считать разное.
 */
import { describe, expect, it } from "vitest"
import { toInt, toBool } from "@/lib/subscription-list"

describe("приведение типов из БД", () => {
  it("строки и числа трактуются одинаково", () => {
    // Supabase/postgrest отдаёт boolean, но в JSON-пути через RLS и в тестовых
    // фикстурах значения приходят строками. «notify_dub: "false"» должно
    // значить false, а не «истина, потому что строка непустая».
    expect(toBool(true)).toBe(true)
    expect(toBool("true")).toBe(true)
    expect(toBool(false)).toBe(false)
    expect(toBool("false")).toBe(false)
    expect(toBool(null)).toBe(false)
    expect(toBool(undefined)).toBe(false)
    expect(toBool(1)).toBe(false)
    expect(toBool("да")).toBe(false)
  })

  it("мусор в числах не превращается в NaN", () => {
    expect(toInt(3)).toBe(3)
    expect(toInt("4")).toBe(4)
    expect(toInt(2.7)).toBe(2)
    expect(toInt(-1)).toBe(0)
    expect(toInt(null)).toBe(0)
    expect(toInt("лес")).toBe(0)
  })
})