/**
 * Чёрный список IP: разбор адресов, сравнение с IP/CIDR,
 * извлечение адреса клиента, вычисление подсети.
 */
import { describe, expect, it } from "vitest"
import {
  getClientIp,
  ipMatchesTarget,
  isIpBlocked,
  isValidIp,
  normalizeBlockTarget,
  parseBlocklistEnv,
  parseIpv4,
  parseIpv6,
  subnetForIp,
} from "@/lib/ip-block"

describe("ip-block: разбор IPv4", () => {
  it("парсит валидные адреса", () => {
    expect(parseIpv4("0.0.0.0")).toBe(0)
    expect(parseIpv4("255.255.255.255")).toBe(4294967295)
    expect(parseIpv4("5.128.192.7")).toBe(5 * 256 ** 3 + 128 * 256 ** 2 + 192 * 256 + 7)
  })

  it("отклоняет мусор", () => {
    for (const bad of ["", "5.128.192", "5.128.192.7.1", "256.1.1.1", "5.128.192.a", "5.128.192.7/24", "hello"]) {
      expect(parseIpv4(bad), bad).toBeNull()
    }
  })
})

describe("ip-block: разбор IPv6", () => {
  it("парсит полные и сжатые формы", () => {
    expect(parseIpv6("2a03:d000:0000:0000:0000:0000:0000:0001")).toBe(parseIpv6("2a03:d000::1"))
    expect(parseIpv6("::")).toBe(BigInt(0))
    expect(parseIpv6("::1")).toBe(BigInt(1))
    expect(parseIpv6("ffff::")).toBe(BigInt(0xffff) << BigInt(112))
  })

  it("понимает IPv4-mapped адреса", () => {
    expect(parseIpv6("::ffff:5.128.192.7")).toBe(
      (BigInt(0xffff) << BigInt(32)) | BigInt(parseIpv4("5.128.192.7")!)
    )
  })

  it("отклоняет мусор", () => {
    for (const bad of ["", "1::2::3", "gggg::1", "1:2:3:4:5:6:7", "::ffff:999.1.1.1"]) {
      expect(parseIpv6(bad), bad).toBeNull()
    }
  })
})

describe("ip-block: нормализация записей", () => {
  it("одиночные адреса остаются одиночными", () => {
    expect(normalizeBlockTarget("5.128.192.7")).toBe("5.128.192.7")
    expect(normalizeBlockTarget("2A03:D000::1")).toBe("2a03:d000::1")
  })

  it("хостовые биты подсети обнуляются", () => {
    expect(normalizeBlockTarget("5.128.192.77/24")).toBe("5.128.192.0/24")
    expect(normalizeBlockTarget("10.0.0.0/8")).toBe("10.0.0.0/8")
  })

  it("отклоняет невалидные записи", () => {
    for (const bad of ["", "не ip", "5.128.192.7/33", "2a03::1/129", "5.128.192.0/24/24"]) {
      expect(normalizeBlockTarget(bad), bad).toBeNull()
    }
  })
})

describe("ip-block: вхождение в запись", () => {
  it("одиночный IPv4 банит только себя", () => {
    expect(ipMatchesTarget("5.128.192.7", "5.128.192.7")).toBe(true)
    expect(ipMatchesTarget("5.128.192.8", "5.128.192.7")).toBe(false)
  })

  it("CIDR IPv4 банит всю подсеть", () => {
    expect(ipMatchesTarget("5.128.192.1", "5.128.192.0/24")).toBe(true)
    expect(ipMatchesTarget("5.128.192.254", "5.128.192.0/24")).toBe(true)
    expect(ipMatchesTarget("5.128.193.1", "5.128.192.0/24")).toBe(false)
    // Запись с необнулёнными хостовыми битами всё равно матчит по сети
    expect(ipMatchesTarget("5.128.192.33", "5.128.192.77/24")).toBe(true)
  })

  it("CIDR IPv6 банит подсеть", () => {
    expect(ipMatchesTarget("2a03:d000::dead:beef", "2a03:d000::/32")).toBe(true)
    expect(ipMatchesTarget("2a04:d000::1", "2a03:d000::/32")).toBe(false)
  })

  it("v4-клиент не матчится в v6-подсеть и наоборот", () => {
    expect(ipMatchesTarget("5.128.192.7", "2a03:d000::/32")).toBe(false)
    expect(ipMatchesTarget("2a03:d000::1", "5.128.192.0/24")).toBe(false)
  })
})

describe("ip-block: isIpBlocked", () => {
  const targets = ["5.128.192.0/24", "2a03:d000::/32", "185.4.6.2"]

  it("банит по списку и пропускает остальных", () => {
    expect(isIpBlocked("5.128.192.200", targets)).toBe(true)
    expect(isIpBlocked("2a03:d000::abcd", targets)).toBe(true)
    expect(isIpBlocked("185.4.6.2", targets)).toBe(true)
    expect(isIpBlocked("185.4.6.3", targets)).toBe(false)
    expect(isIpBlocked("8.8.8.8", targets)).toBe(false)
    expect(isIpBlocked(null, targets)).toBe(false)
    expect(isIpBlocked("мусор", targets)).toBe(false)
  })
})

describe("ip-block: getClientIp", () => {
  it("приоритет у заголовков прокси", () => {
    const headers = new Headers({
      "cf-connecting-ip": "5.128.192.7",
      "x-forwarded-for": "1.2.3.4, 10.0.0.1",
    })
    expect(getClientIp(headers)).toBe("5.128.192.7")
  })

  it("без cf/x-real берёт первый валидный из X-Forwarded-For", () => {
    const headers = new Headers({ "x-forwarded-for": "185.4.6.2, 10.0.0.1" })
    expect(getClientIp(headers)).toBe("185.4.6.2")
  })

  it("мусор в заголовках пропускается, пустота → null", () => {
    expect(getClientIp(new Headers({ "x-forwarded-for": "не-ип, 185.4.6.2" }))).toBe("185.4.6.2")
    expect(getClientIp(new Headers())).toBeNull()
    expect(getClientIp(new Headers({ "x-forwarded-for": "garbage" }))).toBeNull()
  })
})

describe("ip-block: вычисление подсети", () => {
  it("IPv4 → /24", () => {
    expect(subnetForIp("5.128.192.77")).toBe("5.128.192.0/24")
  })

  it("IPv6 → /64", () => {
    expect(subnetForIp("2a03:d000::1")).toBe("2a03:d000::/64")
  })

  it("мусор → null", () => {
    expect(subnetForIp("не-ип")).toBeNull()
  })
})

describe("ip-block: env-список", () => {
  it("разбирает запятые, переносы и комментарии", () => {
    const env = `5.128.192.0/24, 185.4.6.2
# комментарий
2a03:d000::/48;;,`
    expect(parseBlocklistEnv(env)).toEqual(["5.128.192.0/24", "185.4.6.2", "2a03:d000::/48"])
  })

  it("пустой/мусорный список → пусто", () => {
    expect(parseBlocklistEnv(undefined)).toEqual([])
    expect(parseBlocklistEnv("мусор, #коммент")).toEqual([])
  })

  it("дубликаты схлопываются", () => {
    expect(parseBlocklistEnv("5.128.192.77/24, 5.128.192.0/24")).toEqual(["5.128.192.0/24"])
  })
})

describe("ip-block: isValidIp", () => {
  it("различает адреса и мусор", () => {
    expect(isValidIp("5.128.192.7")).toBe(true)
    expect(isValidIp("2a03:d000::1")).toBe(true)
    expect(isValidIp("::ffff:5.128.192.7")).toBe(true)
    expect(isValidIp("5.128.192.7/24")).toBe(false)
    expect(isValidIp("hello")).toBe(false)
  })
})
