import { NextRequest, NextResponse } from "next/server"
import { getAnimeTranslationsResult } from "@/lib/kodik"
import { createRateLimiter, getRateLimitKey } from "@/lib/rate-limit"
import {
  createPlayerToken,
  isCrawlerRequest,
  scrubSeasons,
} from "@/lib/player-protect"

export const dynamic = "force-dynamic"
// `revalidate` здесь не действует: force-dynamic принудительно обнуляет
// revalidate и fetchCache. Кэширования здесь нет вообще — ответ отдаётся с
// `private`, чтобы CDN его не хранил, и рейт-лимит ниже всегда срабатывал.
// Раньше здесь стояло `revalidate = 3600` с комментарием «кэш на час», что
// вводило в заблуждение: такого кэша не было.

/**
 * GET /api/player/translations?shikimoriId=21&title=One%20Piece
 *
 * Возвращает список доступных озвучек (переводов) для аниме.
 *
 * ЗАЩИТА ОТ СКАНЕРОВ: вместо прямой ссылки на внешний видеохостинг
 * поле `playerLink` содержит наш внутренний зашифрованный адрес
 * `/embed/<токен>` (см. lib/player-protect.ts). Прямые ссылки на серии
 * из карты сезонов вычищены. Боты по User-Agent получают 404.
 *
 * РЕЙТ-ЛИМИТ (добавлен после аудита)
 * ----------------------------------
 * Шифрованный токен скрывает прямую ссылку ОТ ВЗГЛЯДА, но не от владельца:
 * запросив список озвучек, можно получить валидный `/embed/<токен>` и за
 * два запроса дойти до `kodikplayer.com`. Именно этот маршрут и обходили
 * антипиратские сканеры, подставляя обычный User-Agent Chrome.
 *
 * Замер на боевом сайте до правки: 40 параллельных запросов — 40 ответов
 * 200, ни одного 429. Теперь на адрес стоит предел, и перебор тайтлов
 * упирается в него, а уходит на 429.
 */
const translationsLimiter = createRateLimiter({ interval: 60_000, maxRequests: 20 })

export async function GET(request: NextRequest) {
  if (isCrawlerRequest(request.headers)) {
    return NextResponse.json(
      { error: "Not Found", translations: [], ok: false },
      { status: 404, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } }
    )
  }

  // Лимит ставим ДО похода в Kodik: иначе сканер успевает выбрать дорогой
  // кэш и нагрузить и нас, и Kodik, прежде чем получит 429.
  //
  // Адрес клиента может быть неизвестен (прокси не передал заголовки) — тогда
  // ограничение ПРОПУСКАЕМ. Подставлять вместо него общий ключ нельзя: все
  // посетители сайта делили бы один лимит, и плеер перестал бы открываться
  // у живых людей. Не знать, кто пришёл, — повод не ограничивать, а не
  // повод всех заблокировать.
  const clientKey = getRateLimitKey(request)
  const limit = clientKey ? translationsLimiter.checkLimit(clientKey) : null
  if (limit && !limit.success) {
    return NextResponse.json(
      { error: "Too many requests", translations: [], ok: false },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil((limit.reset - Date.now()) / 1000)),
          "X-Robots-Tag": "noindex",
          // Тело намеренно пустое по смыслу: сканеру полезно знать, что он
          // упёрся в лимит, а человеку — нет.
          "Cache-Control": "no-store",
        },
      },
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
              // Кэшируем только в браузере, и НЕ отдаём общий кэш (CDN).
              //
              // Раньше стояло `s-maxage=3600`: ответ с готовым `/embed/<токен>`
              // складывался в кэш CDN и раздавался всем, включая сканеры, —
              // то есть рейт-лимит выше просто не срабатывал бы. Теперь
              // `private` запрещает прокси и CDN хранить ответ, и каждый
              // запрос доходит до сервера, где стоит предел.
              //
              // `max-age` оставлен: это кэш самого зрителя, он ускоряет
              // повторное открытие того же тайтла и ни на что не влияет.
              "Cache-Control": "private, max-age=900",
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
