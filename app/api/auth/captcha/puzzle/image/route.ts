import { NextRequest, NextResponse } from "next/server"

import {
  BACKGROUNDS,
  PUZZLE_TTL_MS,
  buildPuzzlePieceSvg,
  buildPuzzleSvg,
  unsealPuzzle,
} from "@/lib/captcha-puzzle"
import { loggers } from "@/lib/logger"

// Секрет captcha берётся из окружения без дефолта — см. lib/captcha-secret.ts.
// Раньше здесь стоял литерал из git, из-за которого капча была обходима.
import { getCaptchaSecret } from "@/lib/captcha-secret"

/**
 * Картинки пазла: и фон с выжженной дыркой, и сам кусочек.
 *
 * Отдельный эндпоинт, а не `data:`-URI внутри JSON: браузер не грузит внешние
 * ресурсы из SVG в data-URI, и картинка приходила пустой. Здесь документ
 * same-origin, поэтому вложенный webp грузится.
 *
 * Вся информация для отрисовки лежит в запечатанном токене, поэтому ручка
 * ничего не хранит и работает одинаково на любой реплике.
 *
 * `?part=piece` отдаёт кадр из-под дырки без затемнения — это кусочек, который
 * человек тянет. Без него кусочек пришлось бы делать полупрозрачным, и тогда
 * дырка просвечивала бы даже при правильном попадании: совпадение нельзя было
 * увидеть глазами.
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token")
  const part = request.nextUrl.searchParams.get("part")
  const wantPiece = part === "piece"
  const solved = request.nextUrl.searchParams.get("solved") === "1"

  const payload = token ? unsealPuzzle(token, getCaptchaSecret()) : null
  if (!payload) {
    return NextResponse.json({ error: "Неизвестный пазл" }, { status: 404 })
  }

  if (Date.now() - payload.ts > PUZZLE_TTL_MS) {
    return NextResponse.json({ error: "Пазл обновился, попробуйте ещё раз" }, { status: 410 })
  }

  const background = BACKGROUNDS[payload.bg]
  if (!background) {
    loggers?.api?.warn?.("captcha image: unknown background", { bg: payload.bg })
    return NextResponse.json({ error: "Неизвестный пазл" }, { status: 404 })
  }

  const options = {
    background,
    containerWidth: payload.w,
    containerHeight: payload.h,
    targetXFrac: payload.tX / 1000,
    targetYFrac: payload.tY / 1000,
  }

  const svg = wantPiece ? buildPuzzlePieceSvg({ ...options, solved }) : buildPuzzleSvg(options)

  return new NextResponse(svg, {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      // Приватный кэш: картинка привязана к токену и живёт 2 минуты.
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  })
}
