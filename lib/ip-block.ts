/**
 * Чёрный список IP: чистые функции разбора адресов и сравнения с
 * IP/CIDR-записями. Используется в middleware (отсечение сканеров до
 * отдачи страницы) и в админ-панели (добавление записей).
 *
 * Формат записи чёрного списка:
 *  - одиночный IPv4:          `5.128.0.1`        (эквивалент /32)
 *  - одиночный IPv6:          `2a03:d000::1`     (эквивалент /128)
 *  - подсеть IPv4:            `5.128.0.0/24`
 *  - подсеть IPv6:            `2a03:d000::/48`
 *
 * Примечание: в проекте target ES6, поэтому BigInt создаётся через
 * функцию `BigInt(...)`, а не литералами вида `0n`.
 */

const BITS_V6 = BigInt(128)

/* ------------------------------------------------------------------ */
/* Разбор адресов                                                      */
/* ------------------------------------------------------------------ */

/** Валиден ли IP (v4 или v6, включая IPv4-mapped IPv6). */
export function isValidIp(ip: string): boolean {
  return parseIpv4(ip) !== null || parseIpv6(ip) !== null
}

/** IPv4 → 32-битное число, либо null. */
export function parseIpv4(ip: string): number | null {
  const trimmed = ip.trim()
  const parts = trimmed.split(".")
  if (parts.length !== 4) return null

  let result = 0
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null
    const octet = Number(part)
    if (octet > 255) return null
    result = result * 256 + octet
  }
  return result >>> 0
}

/** IPv6 → 128-битное число (BigInt), либо null. Понимает `::` и `::ffff:1.2.3.4`. */
export function parseIpv6(ip: string): bigint | null {
  const trimmed = ip.trim()
  if (!trimmed || !trimmed.includes(":")) return null

  let address = trimmed

  // IPv4-mapped (::ffff:1.2.3.4) → раскладываем хвост в шестнадцатеричные группы
  const v4Tail = address.match(/:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/)
  if (v4Tail) {
    const v4 = parseIpv4(v4Tail[1])
    if (v4 === null) return null
    const high = ((v4 >>> 16) & 0xffff).toString(16)
    const low = (v4 & 0xffff).toString(16)
    address = address.slice(0, -v4Tail[1].length) + `${high}:${low}`
  }

  const halves = address.split("::")
  if (halves.length > 2) return null

  const parseGroups = (half: string): number[] | null => {
    if (!half) return []
    const groups = half.split(":")
    const values: number[] = []
    for (const group of groups) {
      if (!/^[0-9a-fA-F]{1,4}$/.test(group)) return null
      values.push(parseInt(group, 16))
    }
    return values
  }

  const head = parseGroups(halves[0])
  const tail = halves.length === 2 ? parseGroups(halves[1]) : null
  if (!head || (halves.length === 2 && tail === null)) return null

  let groups: number[]
  if (halves.length === 1) {
    if (head.length !== 8) return null
    groups = head
  } else {
    const missing = 8 - head.length - (tail?.length ?? 0)
    if (missing < 0) return null
    groups = [...head, ...Array(missing).fill(0), ...(tail ?? [])]
  }

  let value = BigInt(0)
  for (const group of groups) {
    value = (value << BigInt(16)) | BigInt(group)
  }
  return value
}

/* ------------------------------------------------------------------ */
/* Нормализация записей чёрного списка                                 */
/* ------------------------------------------------------------------ */

/** Маска для IPv6 на `bits` старших бит. */
function v6Mask(bits: number): bigint {
  if (bits <= 0) return BigInt(0)
  const allOnes = (BigInt(1) << BITS_V6) - BigInt(1)
  const hostBits = BITS_V6 - BigInt(bits)
  return allOnes ^ ((BigInt(1) << hostBits) - BigInt(1))
}

/**
 * Приводит строку к каноничной записи чёрного списка.
 * Возвращает `null`, если это не IP и не CIDR.
 */
export function normalizeBlockTarget(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  const slash = trimmed.indexOf("/")
  const ipPart = slash === -1 ? trimmed : trimmed.slice(0, slash)
  const prefixPart = slash === -1 ? null : trimmed.slice(slash + 1)

  const v4 = parseIpv4(ipPart)
  if (v4 !== null) {
    let bits = 32
    if (prefixPart !== null) {
      if (!/^\d{1,2}$/.test(prefixPart)) return null
      bits = Number(prefixPart)
      if (bits > 32) return null
    }
    const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0
    const network = (v4 & mask) >>> 0
    return bits === 32 ? ipPart : `${formatIpv4(network)}/${bits}`
  }

  const v6 = parseIpv6(ipPart)
  if (v6 !== null) {
    let bits = 128
    if (prefixPart !== null) {
      if (!/^\d{1,3}$/.test(prefixPart)) return null
      bits = Number(prefixPart)
      if (bits > 128) return null
    }
    if (bits === 128) return ipPart.toLowerCase()
    const network = v6 & v6Mask(bits)
    return `${formatIpv6(network)}/${bits}`
  }

  return null
}

function formatIpv4(value: number): string {
  return [
    (value >>> 24) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 8) & 0xff,
    value & 0xff,
  ].join(".")
}

function formatIpv6(value: bigint): string {
  const groups: string[] = []
  for (let i = 7; i >= 0; i--) {
    const group = (value >> BigInt(i * 16)) & BigInt(0xffff)
    groups.push(group.toString(16))
  }
  // Схлопываем самую длинную последовательность нулевых групп в `::`
  let bestStart = -1
  let bestLen = 0
  let curStart = -1
  let curLen = 0
  for (let i = 0; i < 8; i++) {
    if (groups[i] === "0") {
      if (curStart === -1) curStart = i
      curLen = i - curStart + 1
      if (curLen > bestLen) {
        bestLen = curLen
        bestStart = curStart
      }
    } else {
      curStart = -1
      curLen = 0
    }
  }
  if (bestLen >= 2) {
    const head = groups.slice(0, bestStart)
    const tail = groups.slice(bestStart + bestLen)
    return `${head.join(":")}::${tail.join(":")}`
  }
  return groups.join(":")
}

/* ------------------------------------------------------------------ */
/* Проверка вхождения                                                  */
/* ------------------------------------------------------------------ */

/** Попадает ли IP в запись чёрного списка (одиночный адрес или CIDR). */
export function ipMatchesTarget(ip: string, target: string): boolean {
  const slash = target.indexOf("/")
  const targetIp = slash === -1 ? target : target.slice(0, slash)
  const bits = slash === -1 ? null : Number(target.slice(slash + 1))

  const ipV4 = parseIpv4(ip)
  if (ipV4 !== null) {
    const targetV4 = parseIpv4(targetIp)
    if (targetV4 === null) return false
    const maskBits = bits === null ? 32 : bits
    if (!Number.isFinite(maskBits) || maskBits < 0 || maskBits > 32) return false
    const mask = maskBits === 0 ? 0 : (~0 << (32 - maskBits)) >>> 0
    return ((ipV4 & mask) >>> 0) === ((targetV4 & mask) >>> 0)
  }

  const ipV6 = parseIpv6(ip)
  if (ipV6 !== null) {
    const targetV6 = parseIpv6(targetIp)
    if (targetV6 === null) {
      // v4-запись против ::ffff:1.2.3.4 у клиента
      const mapped = parseIpv6(`::ffff:${targetIp}`)
      if (mapped === null) return false
      return bits === null && ipV6 === mapped
    }
    const maskBits = bits === null ? 128 : bits
    if (!Number.isFinite(maskBits) || maskBits < 0 || maskBits > 128) return false
    const mask = v6Mask(maskBits)
    return (ipV6 & mask) === (targetV6 & mask)
  }

  return false
}

/** Забанен ли адрес в списке записей. Пустой/невалидный адрес не банится. */
export function isIpBlocked(ip: string | null, targets: readonly string[]): boolean {
  if (!ip || !isValidIp(ip)) return false
  return targets.some((target) => ipMatchesTarget(ip, target))
}

/* ------------------------------------------------------------------ */
/* Извлечение IP клиента                                               */
/* ------------------------------------------------------------------ */

/**
 * Реальный адрес посетителя. Приоритет совпадает с админ-входом:
 * заголовки, которые ставит прокси/CDN, затем первый валидный адрес
 * из X-Forwarded-For.
 */
export function getClientIp(headers: Headers): string | null {
  const direct = headers.get("cf-connecting-ip") || headers.get("x-real-ip")
  if (direct) {
    const ip = direct.trim()
    if (isValidIp(ip)) return ip
  }

  const xff = headers.get("x-forwarded-for")
  if (xff) {
    for (const part of xff.split(",")) {
      const ip = part.trim()
      if (isValidIp(ip)) return ip
    }
  }

  return null
}

/**
 * «Забанить всю подсеть»: для IPv4 — /24, для IPv6 — /64.
 * Возвращает нормализованную запись либо null.
 */
export function subnetForIp(ip: string): string | null {
  if (parseIpv4(ip) !== null) {
    const parts = ip.trim().split(".")
    return normalizeBlockTarget(`${parts[0]}.${parts[1]}.${parts[2]}.0/24`)
  }
  if (parseIpv6(ip) !== null) {
    return normalizeBlockTarget(`${ip}/64`)
  }
  return null
}

/** Разбор чёрного списка из env (запятые, переносы строк, комментарии #). */
export function parseBlocklistEnv(env: string | undefined): string[] {
  if (!env) return []
  const targets: string[] = []
  for (const chunk of env.split(/[,\n;]+/)) {
    const value = chunk.trim()
    if (!value || value.startsWith("#")) continue
    const normalized = normalizeBlockTarget(value)
    if (normalized) targets.push(normalized)
  }
  return [...new Set(targets)]
}
