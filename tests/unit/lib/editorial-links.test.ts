import { describe, expect, it } from "vitest"
import { sanitizeEditorialLink } from "@/lib/security/editorial-links"

/**
 * Тесты на санитайзер ссылок мнения редакции.
 *
 * Это stored XSS на ПУБЛИЧНОЙ странице тайтла: контент пишет админ,
 * но видят его все гости. Значит проверка обязана быть жёсткой, а тест —
 * обязателен, иначе «полезная правка» рядом легко откатит её.
 */
describe("sanitizeEditorialLink", () => {
  describe("блокирует небезопасные схемы", () => {
    it("javascript:", () => {
      expect(sanitizeEditorialLink("javascript:alert(document.cookie)")).toBeNull()
      expect(sanitizeEditorialLink("javascript:alert(1)")).toBeNull()
    })

    it("схему со спрятанными регистром и пробелом", () => {
      expect(sanitizeEditorialLink("JavaScript:alert(1)")).toBeNull()
      expect(sanitizeEditorialLink("JAVASCRIPT:alert(1)")).toBeNull()
      // Браузер тримает ведущие пробелы — значит и мы обязаны.
      expect(sanitizeEditorialLink("  javascript:alert(1)")).toBeNull()
      expect(sanitizeEditorialLink(" javascript:alert(1)")).toBeNull()
    })

    it("схему, разбитую управляющим символом", () => {
      // Строки собираются через fromCharCode: литеральный escape или сырой
      // байт управления в исходнике невидим и делает файл «бинарным» для git.
      const TAB = String.fromCharCode(9)
      const NEWLINE = String.fromCharCode(10)
      const NUL = String.fromCharCode(0)

      // Без проверки кода символов такой URL проходил мимо сравнения строк.
      expect(sanitizeEditorialLink(`java${TAB}script:alert(1)`)).toBeNull()
      expect(sanitizeEditorialLink(`java${NEWLINE}script:alert(1)`)).toBeNull()
      expect(sanitizeEditorialLink(`java${NUL}script:alert(1)`)).toBeNull()
      expect(sanitizeEditorialLink(`jav${NUL}ascript:alert(1)`)).toBeNull()
    })

    it("data:, vbscript:, file: и blob:", () => {
      expect(sanitizeEditorialLink("data:text/html;base64,PHNjcmlwdD4=")).toBeNull()
      expect(sanitizeEditorialLink("vbscript:msgbox(1)")).toBeNull()
      expect(sanitizeEditorialLink("file:///etc/passwd")).toBeNull()
      expect(sanitizeEditorialLink("blob:https://example.com/uuid")).toBeNull()
    })
  })

  describe("блокирует схема-относительные URL", () => {
    // «//evil.com» браузер открывает как внешний домен — это увод с сайта
    // и готовая фишинговая ссылка внутри доверенного контента.
    it("протокол-относительные", () => {
      expect(sanitizeEditorialLink("//evil.com/phish")).toBeNull()
      expect(sanitizeEditorialLink("//evil.com")).toBeNull()
    })

    it("с обратным слешем", () => {
      expect(sanitizeEditorialLink("/\\evil.com")).toBeNull()
    })
  })

  describe("разрешает безопасные ссылки", () => {
    it("http и https", () => {
      expect(sanitizeEditorialLink("https://shikimori.one/animes/1")).toBe("https://shikimori.one/animes/1")
      expect(sanitizeEditorialLink("http://example.com/page")).toBe("http://example.com/page")
    })

    it("нормализует через new URL", () => {
      expect(sanitizeEditorialLink("https://example.com")).toBe("https://example.com/")
    })

    it("внутренние относительные пути", () => {
      expect(sanitizeEditorialLink("/watch/61607")).toBe("/watch/61607")
      expect(sanitizeEditorialLink("/catalog?genre=isekai")).toBe("/catalog?genre=isekai")
    })
  })

  it("не принимает мусор", () => {
    expect(sanitizeEditorialLink("")).toBeNull()
    expect(sanitizeEditorialLink("не-ссылка")).toBeNull()
    expect(sanitizeEditorialLink("example.com")).toBeNull()
  })
})