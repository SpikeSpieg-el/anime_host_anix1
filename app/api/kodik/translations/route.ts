import { NextRequest, NextResponse } from "next/server"
import { getAnimeTranslationsResult } from "@/lib/kodik"

export const dynamic = "force-dynamic"
export const revalidate = 3600 // кэш на 1 час — список озвучек меняется редко

/**
 * GET /api/kodik/translations?shikimoriId=21&title=One%20Piece
 *
 * Возвращает список доступных озвучек (переводов) для аниме из Kodik.
 * Используется кастомным меню выбора озвучки в плеере.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const shikimoriId = searchParams.get("shikimoriId")
  const title = searchParams.get("title") || undefined

  if (!shikimoriId) {
    return NextResponse.json(
      { error: "Параметр shikimoriId обязателен" },
      { status: 400 }
    )
  }

  try {
    const { translations, ok } = await getAnimeTranslationsResult(shikimoriId, title)

    return NextResponse.json(
      // ok=false — Kodik не ответил (сеть/токен/лимит). Пустой список в этом
      // случае НЕ означает «озвучки нет», поэтому клиент показывает «не удалось
      // загрузить», а не «озвучка не найдена».
      { translations, ok },
      {
        headers: ok
          ? {
              "Cache-Control":
                "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400",
            }
          // Сбой кэшировать на час нельзя: иначе тайтл с рабочей озвучкой
          // останется «мёртвым» для всех, кто зашёл в окно сбоя.
          : { "Cache-Control": "no-store" },
      }
    )
  } catch (error) {
    console.error("Error in /api/kodik/translations:", error)
    return NextResponse.json(
      { error: "Не удалось получить список озвучек", translations: [], ok: false },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    )
  }
}
