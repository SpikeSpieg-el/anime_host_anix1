import crypto from "crypto"
import { readFileSync } from "node:fs"
import { join } from "node:path"

import { loggers } from "@/lib/logger"
import {
  CONTAINER_MAX_HEIGHT,
  CONTAINER_MAX_WIDTH,
  CONTAINER_MIN_HEIGHT,
  CONTAINER_MIN_WIDTH,
  PUZZLE_EXTENT,
  PUZZLE_PATH,
  containerToImage,
  coverMapping,
} from "@/lib/captcha-geometry"

/**
 * Всё, что сервер знает о пазле, и что клиенту видеть НЕ положено.
 *
 * Клиент получает картинку, в которой дырка уже выжжена, и одну долю `targetY`
 * (по ней кусочек выравнивается по вертикали). Координата `targetX` уезжает в
 * браузер только внутри запечатанного токена.
 *
 * Честная граница защиты: браузер всё равно рисует дырку на экране, поэтому
 * скрипт в headless-браузере сможет её найти по пикселям. Задача этого модуля —
 * убрать дешёвый путь «прочитал поле из JSON», а не сделать captcha
 * неавтоматизируемой в принципе. Реальный барьер — принудительная проверка
 * токена в `/api/auth/register` плюс лимиты по IP.
 */

export interface TrajectoryPoint {
  x: number
  y: number
  t: number
}

/** Минимальный TTL токена пазла — 2 минуты. */
export const PUZZLE_TTL_MS = 120_000

/**
 * Допуск попадания в долях ширины контейнера.
 *
 * Смысл допуска поменялся вместе с дизайном. Когда координата лежала в
 * ответе, ±5% означало «ответ и так у тебя» и уже ничего не стоил. Теперь
 * координата клиенту неизвестна, и допуск — это не антибот, а вопрос «смог ли
 * человек поставить кусочек». Слишком узкое окно даёт только ложные отказы.
 *
 * Измерение на живом сервере: окно ±7px (±2%) отбивало смещения −8px, но
 * десяток живых попыток всё равно давал отказы — причину искали не в допуске,
 * а в том, что при промахе пазл молча заменялся новым.
 *
 * Измерение на живом сервере показало, что отказы идут не от допуска, а от
 * проверки траектории: короткий уверенный рывок мышью — это ~200–300 мс и
 * меньше 12 событий pointermove, а такие пороги отсекали нормального
 * человека. Допуск возвращён к исходным 5%: координата клиенту всё равно
 * неизвестна, поэтому узкое окно покупалось ценой ложных отказов и не давало
 * ничего взамен. При 5% кусочек перекрывает дырку больше чем наполовину —
 * это однозначно «поставлен», а не «угадал».
 */
export const MATCH_TOLERANCE_FRAC = 0.05

/** Сколько жив токен успешной проверки до регистрации. */
export const VERIFICATION_TTL_MS = 10 * 60_000

/**
 * Минимум точек движения.
 *
 * Было 12 — и это отсекало живых людей: уверенный рывок мышью на 360px за
 * ~250 мс при 125 Гц даёт 30 точек, но на 60 Гц-трекпаде или при быстром
 * движении — 5–8. Порог не ловил ботов (траекторию синтезируется за пару
 * строк), зато резал человека, который просто быстро ткнул.
 */
const MIN_POINTS = 5

/**
 * Минимальная длительность drag'а, мс.
 *
 * Стоял 320 мс — отбивал уверенный быстрый жест. Потом 180 мс — и это тоже
 * оказалось вплотную к реальности: разбор жалоб показал траекторию длиной
 * **178 мс**, то есть обычный флик на 250px, который человек делает, ничего
 * не проверяя на глаз.
 *
 * Настоящая ценность этого порога — отсечь мгновенную подстановку (все
 * отметки времени равны, длительность ноль). Всё, что выше, — человек, и
 * ловить это нечем: искусственную траекторию с паузами пишется за пару
 * строк. Поэтому порог стоит там, где ещё ловит ноль, но не мешает живому.
 */
const MIN_DURATION_MS = 120
const MAX_DURATION_MS = 20_000

/**
 * Разброс по Y намеренно не проверяется — см. длинный комментарий над
 * analyzeTrajectory: требование к нему ловит настоящих людей, которые ведут
 * кусочек строго по горизонтали.
 */

/**
 * Максимальный скачок между соседними точками, px. Мышь не может перелететь
 * пол-экрана между двумя событиями pointermove — скрипт, ставящий конечную
 * точку сразу, отсекается здесь.
 */
const MAX_STEP_PX = 240

/**
 * Коэффициент вариации скорости. Идеально ровный ход (как у `x += 5` в цикле)
 * даёт 0; живая рука — единицы процентов и больше.
 */
const MIN_SPEED_VARIATION = 0.02

/**
 * Биометрический анализ траектории.
 *
 * Проверяет:
 * - A) достаточное число точек движения;
 * - B) реалистичную длительность (не мгновенно, не полчаса);
 * - C) строгий рост времени — переупорядоченные или подделанные точки;
 * - D) отсутствие телепортов между соседними точками;
 * - E) неравномерность скорости (человек тормозит перед целью);
 * - F) что курсор действительно двигался.
 *
 * Чего здесь намеренно нет: требования к микро-дрожанию по Y. Оно было в
 * предыдущей версии (`maxY - minY >= 0`, тождественно истинно) и в варианте
 * `>= 1` — но это ловушка на живых людей: мышь, которую ведут строго
 * горизонтально, даёт ровно нулевой разброс по вертикали, и настоящего
 * пользователя с правильным кусочком блокировало бы с «Обнаружено
 * неестественное движение». Придумывать требование, которое нельзя выполнить
 * мышью, — значит чинить антибот ценой ложных срабатываний.
 */
export function analyzeTrajectory(points: TrajectoryPoint[]): boolean {
  if (!Array.isArray(points)) return false
  if (points.length < MIN_POINTS) return false

  const start = points[0]
  const end = points[points.length - 1]
  if (!start || !end) return false

  for (const p of points) {
    if (
      !p ||
      !Number.isFinite(p.x) ||
      !Number.isFinite(p.y) ||
      !Number.isFinite(p.t)
    ) {
      return false
    }
  }

  const totalDuration = end.t - start.t
  if (totalDuration < MIN_DURATION_MS || totalDuration > MAX_DURATION_MS) return false

  // Время должно идти вперёд. Именно «не убывать», а не «строго расти»:
  // устройство отдаёт события пачками, и две соседние точки с одной и той же
  // отметкой — норма, а не подделка. Строгое сравнение отказывало человеку
  // на каждом быстром движении.
  for (let i = 1; i < points.length; i++) {
    if (points[i].t < points[i - 1].t) return false
  }

  const speeds: number[] = []
  let movedPx = 0

  for (let i = 1; i < points.length; i++) {
    const dt = points[i].t - points[i - 1].t
    const dx = points[i].x - points[i - 1].x
    const dy = points[i].y - points[i - 1].y

    if (Math.abs(dx) > MAX_STEP_PX || Math.abs(dy) > MAX_STEP_PX) return false

    movedPx += Math.abs(dx)
    // dt === 0 бывает у событий, пришедших в одном тике. Делить на ноль нельзя:
    // в среднем попадает Infinity или NaN, и проверка вариации скорости
    // начинает срабатывать случайно.
    if (dt > 0) speeds.push(Math.abs(dx) / dt)
  }

  // Совсем без движения кусочек не поставят — значит траектория не про drag.
  if (movedPx < 8) return false

  // Отбрасываем точки, где курсор почти стоял: из-за них коэффициент
  // вариации скорости занижается нулём у настоящего человека, который
  // замер перед финальным движением.
  const moving = speeds.filter((s) => s > 0.002)
  if (moving.length < 5) return false

  const mean = moving.reduce((sum, s) => sum + s, 0) / moving.length
  if (mean <= 0) return false

  const variance =
    moving.reduce((sum, s) => sum + (s - mean) * (s - mean), 0) / moving.length
  const variation = Math.sqrt(variance) / mean

  if (variation < MIN_SPEED_VARIATION) return false

  return true
}

/* ------------------------------------------------------------------ */
/*  Запечатывание пазла (AES-256-GCM)                                  */
/* ------------------------------------------------------------------ */

export interface PuzzlePayload {
  /** Позиция по X в тысячных долях контейнера. */
  tX: number
  /** Позиция по Y в тысячных долях контейнера. */
  tY: number
  /** Момент генерации, мс. */
  ts: number
  /** Случайная соль, она же идентификатор пазла. */
  nonce: string
  /** Индекс фона в BACKGROUNDS. */
  bg: number
  /** Ширина контейнера на момент генерации — нужна картинке, чтобы повторить object-cover. */
  w: number
  /** Высота контейнера на момент генерации. */
  h: number
}

function deriveKey(secret: string): Buffer {
  return crypto.createHash("sha256").update(`captcha-puzzle:v2:${secret}`).digest()
}

/**
 * Прячет позицию дырки внутрь токена.
 *
 * Раньше токен выглядел как `640.380.<ts>.<nonce>.<hmac>`: первый компонент —
 * это ровно `targetX`, и разобрать его можно было grep'ом по ответу, не
 * открывая ни картинку, ни вкладку Network глазами. Теперь payload зашифрован
 * и подписан, а снаружи — три случайных base64url-блоба.
 */
export function sealPuzzle(payload: PuzzlePayload, secret: string): string {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv("aes-256-gcm", deriveKey(secret), iv)

  const encrypted = Buffer.concat([
    cipher.update(Buffer.from(JSON.stringify(payload), "utf8")),
    cipher.final(),
  ])
  const tag = cipher.getAuthTag()

  return [
    iv.toString("base64url"),
    encrypted.toString("base64url"),
    tag.toString("base64url"),
  ].join(".")
}

/** Расшифровка пазла. Любая подмена или другой секрет → `null`. */
export function unsealPuzzle(token: string, secret: string): PuzzlePayload | null {
  if (!token || typeof token !== "string") return null

  try {
    const parts = token.split(".")
    if (parts.length !== 3) return null

    const [ivPart, dataPart, tagPart] = parts
    if (!ivPart || !dataPart || !tagPart) return null

    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      deriveKey(secret),
      Buffer.from(ivPart, "base64url")
    )
    decipher.setAuthTag(Buffer.from(tagPart, "base64url"))

    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(dataPart, "base64url")),
      decipher.final(),
    ])

    const parsed = JSON.parse(decrypted.toString("utf8")) as PuzzlePayload

    if (
      !parsed ||
      typeof parsed.tX !== "number" ||
      typeof parsed.tY !== "number" ||
      typeof parsed.ts !== "number" ||
      typeof parsed.nonce !== "string" ||
      parsed.nonce.length === 0 ||
      typeof parsed.bg !== "number" ||
      typeof parsed.w !== "number" ||
      typeof parsed.h !== "number"
    ) {
      return null
    }

    return parsed
  } catch {
    // Сюда попадает и неверный тег GCM — то есть подделка токена.
    return null
  }
}

/* ------------------------------------------------------------------ */
/*  Токен успешной проверки                                            */
/* ------------------------------------------------------------------ */

/**
 * Токен, который `/api/auth/register` требует как доказательство, что пазл
 * реально собран. Формат `${hmac}.${timestamp}.${nonce}`.
 *
 * `nonce` связывает токен с конкретным пазлом: регистрация может использовать
 * его один раз, а счётчик одноразовости живёт в памяти процесса.
 */
export function generateVerificationToken(
  timestamp: number,
  nonce: string,
  secret: string
): string {
  const hash = crypto
    .createHmac("sha256", secret)
    .update(`verified:${timestamp}:${nonce}`)
    .digest("hex")
  return `${hash}.${timestamp}.${nonce}`
}

export interface ParsedVerificationToken {
  timestamp: number
  nonce: string
}

function parseVerificationToken(
  token: string,
  secret: string
): ParsedVerificationToken | null {
  if (!token || !secret || typeof token !== "string") return null

  const parts = token.split(".")
  if (parts.length !== 3) return null

  const [hash, timestampStr, nonce] = parts
  if (!hash || !timestampStr || !nonce) return null

  const timestamp = parseInt(timestampStr, 10)
  if (!Number.isFinite(timestamp)) return null

  const expectedHash = crypto
    .createHmac("sha256", secret)
    .update(`verified:${timestamp}:${nonce}`)
    .digest("hex")

  // Сравнение постоянного времени: наивное `===` по hex-строке коротких
  // секретов теоретически позволяет подбирать хэш покомпонентно.
  if (!timingSafeEqualHex(hash, expectedHash)) return null

  return { timestamp, nonce }
}

function timingSafeEqualHex(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "hex")
  const bufB = Buffer.from(b, "hex")
  if (bufA.length !== bufB.length || bufA.length === 0) return false
  return crypto.timingSafeEqual(bufA, bufB)
}

/**
 * Разбор токена проверки с проверкой подписи.
 *
 * В отличие от прежнего `verifyRegistrationToken` проверяет протухание: раньше
 * токен был вечным, и один раз собранный пазл годами кормил регистрации.
 */
export function readVerificationToken(
  token: string,
  secret: string,
  options: { now?: number; ttlMs?: number } = {}
): ParsedVerificationToken | null {
  const parsed = parseVerificationToken(token, secret)
  if (!parsed) return null

  const now = options.now ?? Date.now()
  const ttlMs = options.ttlMs ?? VERIFICATION_TTL_MS

  const age = now - parsed.timestamp
  if (age < 0) return null // будущее время — подделка или рассинхрон часов
  if (age > ttlMs) return null

  return parsed
}

/** Проверка проверочного токена регистрации. */
export function verifyRegistrationToken(
  token: string,
  secret: string,
  options: { now?: number; ttlMs?: number } = {}
): boolean {
  return readVerificationToken(token, secret, options) !== null
}

/* ------------------------------------------------------------------ */
/*  Отрисовка пазла на сервере                                         */
/* ------------------------------------------------------------------ */

export interface PuzzleBackground {
  url: string
  width: number
  height: number
}

/**
 * Фоны пазла.
 *
 * Натуральный размер нужен, чтобы повторить `object-cover` браузера при
 * выжигании дырки. Захардкожен, потому что это статические файлы в
 * `public/captcha/` — при замене картинок таблицу нужно поправить.
 */
export const BACKGROUNDS: PuzzleBackground[] = [
  { url: "/captcha/bg (1).webp", width: 480, height: 480 },
  { url: "/captcha/bg (2).webp", width: 480, height: 480 },
  { url: "/captcha/bg (3).webp", width: 480, height: 480 },
  { url: "/captcha/bg (4).webp", width: 1024, height: 651 },
]

/** Кэш инлайновых data-URI фонов на процесс: файлы статичные. */
const inlineBackgroundCache = new Map<string, string>()

/**
 * Читает фон с диска и отдаёт его как data-URI.
 *
 * Почему не ссылка: Chrome не рисует внешние растровые ресурсы внутри SVG,
 * подставленного в `<img>` — картинка загружается, но остаётся чёрной
 * (проверено: средняя яркость 2 из 255). Рабочий вариант — только data-URI
 * внутри SVG.
 *
 * Плата — примерно треть от размера файла на каждый запрос пазла (фоны весят
 * 45–177 КБ). Запросов мало: пазл нужен один раз на регистрацию, плюс лимит
 * 20/мин на IP. Если вес окажется заметен, правильное лечение — пережать сами
 * фоны.
 */
function inlineBackground(url: string): string {
  const cached = inlineBackgroundCache.get(url)
  if (cached !== undefined) return cached

  const dataUri = (() => {
    try {
      const filePath = join(process.cwd(), "public", url.replace(/^\//, ""))
      const buffer = readFileSync(filePath)
      const mime = filePath.endsWith(".webp") ? "image/webp" : "image/png"
      return `data:${mime};base64,${buffer.toString("base64")}`
    } catch (err) {
      loggers?.api?.warn?.("captcha background unavailable", { url })
      return ""
    }
  })()

  inlineBackgroundCache.set(url, dataUri)
  return dataUri
}

/**
 * Собирает SVG-картинку пазла: исходное фото, поверх которого уже выжжена
 * дырка. Клиент показывает её как обычный `<img>` и не получает координату
 * дырки ни в JSON, ни в атрибутах.
 *
 * Отдавать приходится отдельным same-origin URL, а не `data:`-URI: браузер не
 * грузит внешние ресурсы из SVG, лежащего в data-URI (непрозрачный origin), и
 * картинка остаётся пустой. Заодно вложенный webp уходит отдельным запросом и
 * кэшируется браузером, вместо +70% base64 в каждом ответе.
 *
 * Цена решения честно описана в шапке модуля: упорный бот может открыть
 * `/api/auth/captcha/puzzle/image` и вытащить смещение из тела ответа. Выигрыш
 * в том, что из JSON исчезают и `targetX`, и чистая картинка, по которой
 * позиция находилась бы сравнением пикселей.
 */
export function buildPuzzleSvg(options: {
  background: PuzzleBackground
  containerWidth: number
  containerHeight: number
  /** Позиция дырки в долях контейнера. */
  targetXFrac: number
  targetYFrac: number
}): string {
  const {
    background,
    containerWidth,
    containerHeight,
    targetXFrac,
    targetYFrac,
  } = options

  const mapping = coverMapping(
    containerWidth,
    containerHeight,
    background.width,
    background.height
  )

  // Позиция дырки в системе координат контейнера, затем — в пикселях картинки.
  const holeInContainer = {
    x: targetXFrac * containerWidth,
    y: targetYFrac * containerHeight,
  }
  const hole = containerToImage(holeInContainer.x, holeInContainer.y, mapping)

  // Ссылка на исходник относительная: внутри SVG она резолвится от URL самого
  // документа, то есть всегда от того же origin, откуда пришёл запрос. Раньше
  // origin собирался из request.url, и за прокси или при обращении через
  // 127.0.0.1 он расходился с origin страницы — картинка не грузилась.
  const href = inlineBackground(background.url)
  const photo = href
    ? `<image href="${href}" x="0" y="0" width="${background.width}" height="${background.height}" preserveAspectRatio="none"/>`
    : `<rect width="${background.width}" height="${background.height}" fill="#0b1020"/>`

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${background.width}" height="${background.height}" viewBox="0 0 ${background.width} ${background.height}">`,
    photo,
    // Контур дырки — сплошной и светлый. Прежние 1.5px на 45% белого
    // терялись на светлых кадрах: кусочек приходилось выравнивать, целясь в
    // границу, которой почти не видно.
    `<path d="${PUZZLE_PATH}" transform="translate(${hole.x.toFixed(2)}, ${hole.y.toFixed(2)})" fill="rgba(4,6,12,0.82)" stroke="rgba(255,255,255,0.9)" stroke-width="2.5"/>`,
    `</svg>`,
  ].join("")
}

/**
 * Собирает SVG самого кусочка: тот же кадр картинки, что и под дыркой, но без
 * затемнения.
 *
 * Зачем это, если кусочек можно нарисовать стеклом: со стеклом дырка
 * просвечивает всегда, и в момент правильного положения человек не видит
 * ничего — кусочек совпал, но картинка не «зажила». Ощущение «дырка не та» как
 * раз и было следствием этого. С картинкой кусочек при попадании встык
 * заполняет дырку, и это сразу видно.
 *
 * Размер SVG уже в пикселях контейнера (с учётом object-cover), поэтому клиент
 * просто кладёт его в точку `sliderX` и не думает о масштабе.
 *
 * Позиция дырки при этом читается из тела SVG — ровно так же, как из тела
 * картинки пазла. Дополнительной утечки тут не появляется: тот, кто может
 * распарсить один SVG, может распарсить и второй.
 */
export function buildPuzzlePieceSvg(options: {
  background: PuzzleBackground
  containerWidth: number
  containerHeight: number
  targetXFrac: number
  targetYFrac: number
  /** Зелёная рамка — кусочек встал на место. */
  solved?: boolean
}): string {
  const {
    background,
    containerWidth,
    containerHeight,
    targetXFrac,
    targetYFrac,
    solved = false,
  } = options

  const mapping = coverMapping(
    containerWidth,
    containerHeight,
    background.width,
    background.height
  )

  // Габарит кусочка в пикселях контейнера.
  const pieceSize = PUZZLE_EXTENT * mapping.scale

  // Левый верхний угол дырки в координатах контейнера.
  const holeInContainer = {
    x: targetXFrac * containerWidth,
    y: targetYFrac * containerHeight,
  }

  const stroke = solved ? "#34d399" : "#38bdf8"
  const strokeWidth = (2 / mapping.scale).toFixed(3)

  const href = inlineBackground(background.url)
  if (!href) {
    return [
      `<svg xmlns="http://www.w3.org/2000/svg" width="${pieceSize.toFixed(2)}" height="${pieceSize.toFixed(2)}" viewBox="0 0 ${pieceSize.toFixed(2)} ${pieceSize.toFixed(2)}">`,
      `<path d="${PUZZLE_PATH}" transform="scale(${mapping.scale})" fill="#94a3b8" stroke="${stroke}" stroke-width="${strokeWidth}"/>`,
      `</svg>`,
    ].join("")
  }

  // Картинка целиком выкладывается тем же object-cover, что и в SVG пазла, и
  // сдвигается так, чтобы в окно кусочка попал ровно кадр из-под дырки.
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${pieceSize.toFixed(2)}" height="${pieceSize.toFixed(2)}" viewBox="0 0 ${pieceSize.toFixed(2)} ${pieceSize.toFixed(2)}">`,
    `<defs><clipPath id="piece"><path d="${PUZZLE_PATH}" transform="scale(${mapping.scale})"/></clipPath></defs>`,
    `<g clip-path="url(#piece)">`,
    `<g transform="translate(${(-holeInContainer.x).toFixed(2)}, ${(-holeInContainer.y).toFixed(2)})">`,
    `<image href="${href}" x="${mapping.offsetX.toFixed(2)}" y="${mapping.offsetY.toFixed(2)}" width="${(background.width * mapping.scale).toFixed(2)}" height="${(background.height * mapping.scale).toFixed(2)}" preserveAspectRatio="none"/>`,
    `</g></g>`,
    `<path d="${PUZZLE_PATH}" transform="scale(${mapping.scale})" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}"/>`,
    `</svg>`,
  ].join("")
}

/**
 * Приводит заявленный клиентом размер контейнера к безопасным границам.
 *
 * Размер нужен серверу, чтобы выжечь дырку ровно под те пропорции, которые
 * браузер покажет через `object-cover`. Без него пришлось бы угадывать
 * дефолтом, и на узком экране дырка уезжала бы за кадр.
 */
export function sanitizeContainerSize(
  rawWidth: string | null,
  rawHeight: string | null
): { width: number; height: number } {
  const width = Number.parseInt(rawWidth ?? "", 10)
  const height = Number.parseInt(rawHeight ?? "", 10)

  return {
    width:
      Number.isFinite(width) && width >= CONTAINER_MIN_WIDTH && width <= CONTAINER_MAX_WIDTH
        ? width
        : 360,
    height:
      Number.isFinite(height) &&
      height >= CONTAINER_MIN_HEIGHT &&
      height <= CONTAINER_MAX_HEIGHT
        ? height
        : 160,
  }
}
