import { NextRequest, NextResponse } from "next/server"
import { getAnimeTranslationsResult } from "@/lib/kodik"
import {
  createPlayerToken,
  isCrawlerRequest,
  scrubSeasons,
} from "@/lib/player-protect"

export const dynamic = "force-dynamic"
export const revalidate = 3600 // кэш на 1 час — список озвучек меняется редко

/**
 * GET /api/player/translations?shikimoriId=21&title=One%20Piece
 *
 * Возвращает список доступных озвучек (переводов) для аниме.
 *
 * ЗАЩИТА ОТ СКАНЕРОВ: вместо прямой ссылки на внешний видеохостинг
 * поле `playerLink` содержит наш внутренний зашифрованный адрес
 * `/embed/<токен>` (см. lib/player-protect.ts). Прямые ссылки на серии
 * из карты сезонов вычищены. Боты по User-Agent получают 404.
 */
export async function GET(request: NextRequest) {
  if (isCrawlerRequest(request.headers)) {
    return NextResponse.json(
      { error: "Not Found", translations: [], ok: false },
      { status: 404, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } }
    )
  }

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

    const safeTranslations = translations.map((tr) => {
      // Прямая ссылка не покидает сервер: наружу уходит только токен.
      const token = createPlayerToken(tr.playerLink)
      return {
        id: tr.id,
        translationId: tr.translationId,
        title: tr.title,
        type: tr.type,
        quality: tr.quality,
        episodesCount: tr.episodesCount,
        playerLink: token ? `/embed/${token}` : "",
        seasons: scrubSeasons(tr.seasons),
      }
    })

    return NextResponse.json(
      // ok=false — Kodik не ответил (сеть/токен/лимит). Пустой список в этом
      // случае НЕ означает «озвучки нет», поэтому клиент показывает «не удалось
      // загрузить», а не «озвучка не найдена».
      { translations: safeTranslations, ok },
      {
        headers: ok
          ? {
              "Cache-Control":
                "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400",
              "X-Robots-Tag": "noindex",
            }
          // Сбой кэшировать на час нельзя: иначе тайтл с рабочей озвучкой
          // останется «мёртвым» для всех, кто зашёл в окно сбоя.
          : { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" },
      }
    )
  } catch (error) {
    console.error("Error in /api/player/translations:", error)
    return NextResponse.json(
      { error: "Не удалось получить список озвучек", translations: [], ok: false },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    )
  }
}
