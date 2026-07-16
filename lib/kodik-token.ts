/**
 * Менеджер бесплатных токенов Kodik API.
 *
 * Kodik API (https://kodik-api.com) требует токен для любого запроса.
 * Токен можно получить бесплатно: существует публичный репозиторий
 * YaNesyTortiK/AnimeParsers, в котором хранятся зашифрованные токены.
 *
 * Стратегия:
 *   1. Если задана переменная окружения KODIK_API_TOKEN — используем её.
 *   2. Иначе пытаемся получить и расшифровать бесплатный токен из
 *      публичного списка и валидируем его тестовым запросом.
 *   3. Результат кэшируется в памяти на TTL_TOKEN, чтобы не дёргать
 *      GitHub на каждый запрос.
 */

const TOKENS_URL =
  "https://raw.githubusercontent.com/YaNesyTortiK/AnimeParsers/main/kdk_tokns/tokens.json"

const KODIK_API_BASE = "https://kodik-api.com"

const TTL_TOKEN = 1000 * 60 * 60 * 6 // 6 часов — токены живут долго
const TTL_FALLBACK = 1000 * 60 * 5 // 5 минут — при неудаче повторяем быстрее

interface CachedToken {
  token: string
  expiresAt: number
}

let cached: CachedToken | null = null
let inflight: Promise<string | null> | null = null

/**
 * Расшифровка токена по алгоритму из anime-parsers-js / AnimeParsers.
 * Токен в репозитории хранится как две реверснутые base64-половины.
 */
function decryptToken(tkn: string): string {
  const half = Math.floor(tkn.length / 2)
  const p1 = tkn.slice(0, half).split("").reverse().join("")
  const p2 = tkn.slice(half).split("").reverse().join("")

  // Buffer доступен в Node.js. В edge-runtime можно использовать atob.
  const d1 = typeof Buffer !== "undefined"
    ? Buffer.from(p1, "base64").toString("utf-8")
    : atob(p1)
  const d2 = typeof Buffer !== "undefined"
    ? Buffer.from(p2, "base64").toString("utf-8")
    : atob(p2)

  return d2 + d1
}

/**
 * Быстрая валидация токена — тестовый поиск.
 * Если токен невалиден, Kodik вернёт { error: "Отсутствует или неверный токен" }.
 */
async function validateToken(token: string): Promise<boolean> {
  try {
    const params = new URLSearchParams({
      token,
      title: "Наруто",
      limit: "1",
      with_material_data: "false",
    })
    const res = await fetch(`${KODIK_API_BASE}/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      body: params.toString(),
      // Не хотим зависать надолго при проверке.
      signal: AbortSignal.timeout?.(8000),
    })
    if (!res.ok) return false
    const data = await res.json()
    if (data?.error === "Отсутствует или неверный токен") return false
    if (data?.error) return false
    return true
  } catch {
    return false
  }
}

interface TokensFile {
  stable?: Array<{ tokn: string }>
  unstable?: Array<{ tokn: string }>
  legacy?: Array<{ tokn: string }>
}

/**
 * Получить бесплатный токен из публичного списка.
 * Перебираем stable → unstable → legacy, возвращаем первый валидный.
 */
async function fetchFreeToken(): Promise<string | null> {
  try {
    const res = await fetch(TOKENS_URL, {
      // Список обновляется редко — можно кэшировать.
      next: { revalidate: 3600 },
    })
    if (!res.ok) return null
    const tokens = (await res.json()) as TokensFile

    const buckets: Array<keyof TokensFile> = ["stable", "unstable", "legacy"]
    for (const bucket of buckets) {
      const list = tokens[bucket]
      if (!list || !Array.isArray(list)) continue
      for (const entry of list) {
        if (!entry?.tokn) continue
        const token = decryptToken(entry.tokn)
        if (await validateToken(token)) {
          return token
        }
        // Небольшая пауза между проверками, чтобы не спамить API.
        await new Promise((r) => setTimeout(r, 800))
      }
    }
  } catch {
    // Падаем в фоллбэк ниже.
  }

  // Резервный вариант — попытка вытащить токен из публичного JS Kodik.
  try {
    const res = await fetch("https://kodik-add.com/add-players.min.js?v=2", {
      signal: AbortSignal.timeout?.(8000),
    })
    if (res.ok) {
      const data = await res.text()
      const start = data.indexOf("token=")
      if (start !== -1) {
        const tokenStart = start + 7
        const tokenEnd = data.indexOf('"', tokenStart)
        if (tokenEnd !== -1) {
          const token = data.substring(tokenStart, tokenEnd)
          if (token && (await validateToken(token))) return token
        }
      }
    }
  } catch {
    // ignore
  }

  return null
}

/**
 * Возвращает рабочий токен Kodik API.
 * Приоритет: KODIK_API_TOKEN (env) → бесплатный публичный токен.
 * Результат кэшируется.
 */
export async function getKodikToken(): Promise<string | null> {
  // 1. Явно заданный токен в окружении — высший приоритет.
  const envToken = process.env.KODIK_API_TOKEN
  if (envToken && envToken.trim()) {
    return envToken.trim()
  }

  // 2. Кэш в памяти.
  if (cached && cached.expiresAt > Date.now()) {
    return cached.token
  }

  // 3. Дедупликация параллельных запросов.
  if (inflight) {
    return inflight
  }

  inflight = (async () => {
    try {
      const token = await fetchFreeToken()
      if (token) {
        cached = { token, expiresAt: Date.now() + TTL_TOKEN }
        return token
      }
      // Не получилось — ставим короткий TTL, чтобы быстро повторить.
      cached = { token: "", expiresAt: Date.now() + TTL_FALLBACK }
      return null
    } finally {
      inflight = null
    }
  })()

  return inflight
}

/**
 * Сбросить кэш токена (полезно при ошибках 401/403 — токен мог протухнуть).
 */
export function invalidateKodikToken(): void {
  cached = null
}

export const KODIK_API_URL = KODIK_API_BASE
