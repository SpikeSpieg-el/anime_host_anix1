import { NextRequest, NextResponse } from "next/server"
import { getAnimeTranslations } from "@/lib/kodik"

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
    const translations = await getAnimeTranslations(shikimoriId, title)

    return NextResponse.json(
      { translations },
      {
        headers: {
          "Cache-Control":
            "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400",
        },
      }
    )
  } catch (error) {
    console.error("Error in /api/kodik/translations:", error)
    return NextResponse.json(
      { error: "Не удалось получить список озвучек", translations: [] },
      { status: 500 }
    )
  }
}
