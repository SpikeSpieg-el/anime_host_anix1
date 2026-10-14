import { describe, expect, it } from "vitest"

import { friendlyAuthError } from "@/lib/auth-errors"

/**
 * Тексты ошибок авторизации — часть интерфейса, а не логов.
 *
 * Проверяем две вещи, которые ломались по отдельности:
 * 1. пользователю не показывается английский текст Supabase и внутренние детали;
 * 2. форма входа не превращается в способ перебрать зарегистрированные адреса.
 */

const TECHNO = /supabase|токен|token|код|code|http|sql|undefined|null|NaN/i
/**
 * Латиница допустима только в слове «email» — его русский интерфейс использует
 * без перевода. Любая другая английская слова в тексте ошибки — это утечка
 * сообщения Supabase.
 */
function foreignWords(text: string): string[] {
  return (text.replace(/email/gi, "").match(/[A-Za-z]+/g) ?? [])
}

describe("friendlyAuthError", () => {
  it("переводит частые ошибки Supabase на русский по error_code", () => {
    expect(friendlyAuthError({ code: "user_already_exists" }, "register")).toBe(
      "Аккаунт с таким email уже есть. Попробуйте войти."
    )
    expect(friendlyAuthError({ code: "weak_password" }, "register")).toContain(
      "Пароль слишком простой"
    )
    expect(friendlyAuthError({ code: "invalid_email" }, "register")).toContain("email")
    expect(friendlyAuthError({ code: "email_not_confirmed" }, "register")).toContain(
      "подтвердить email"
    )
  })

  it("понимает текст, когда кода нет", () => {
    // Обе формулировки встречаются в разных версиях GoTrue.
    expect(friendlyAuthError({ message: "User already registered" }, "register")).toBe(
      "Аккаунт с таким email уже есть. Попробуйте войти."
    )
    expect(
      friendlyAuthError(
        { message: "A user with this email address has already been registered" },
        "register"
      )
    ).toBe("Аккаунт с таким email уже есть. Попробуйте войти.")
    expect(
      friendlyAuthError({ message: "Invalid login credentials" }, "login")
    ).toBe("Неверный email или пароль")
  })

  it("никогда не показывает пользователю латиницу и внутренние детали", () => {
    const inputs: Array<Record<string, unknown> | string | null | undefined> = [
      { message: "Something nobody has ever seen before" },
      { message: "Database error saving new user" },
      { message: "Internal error: connect ECONNREFUSED 127.0.0.1:5432" },
      { message: "supabaseUrl=true, serviceKey=false" },
      { message: "err: undefined" },
      { code: "totally_unknown_code", message: "boom" },
      "Fatal: unexpected token" as string,
      null,
      undefined,
      {},
    ]

    for (const input of inputs) {
      for (const mode of ["login", "register"] as const) {
        const text = friendlyAuthError(input, mode)
        expect(foreignWords(text), String(input)).toEqual([])
        expect(text, String(input)).not.toMatch(TECHNO)
        expect(text.length, String(input)).toBeGreaterThan(10)
      }
    }
  })

  it("при входе не подтверждает, что аккаунт существует", () => {
    // Иначе форма входа становится способом проверить, какие email заняты.
    const exists = friendlyAuthError({ code: "user_already_exists" }, "register")
    const viaLogin = friendlyAuthError({ code: "user_already_exists" }, "login")
    const viaLoginText = friendlyAuthError({ message: "User already registered" }, "login")

    expect(viaLogin).toBe("Неверный email или пароль")
    expect(viaLoginText).toBe("Неверный email или пароль")
    expect(viaLogin).not.toBe(exists)
  })

  it("отдельно обрабатывает лимиты и ошибки сервера", () => {
    expect(friendlyAuthError({ status: 429 }, "register")).toContain("Слишком много попыток")
    expect(friendlyAuthError({ status: 503 }, "register")).toContain("на нашей стороне")
    expect(friendlyAuthError({ message: "Too many requests", status: 429 }, "login")).toContain(
      "Подождите"
    )
  })

  it("по умолчанию считает, что это вход", () => {
    // Забытый аргумент не должен молча менять тон сообщения.
    expect(friendlyAuthError({ message: "User already registered" })).toBe(
      "Неверный email или пароль"
    )
  })
})
