/**
 * Человеческие формулировки для ошибок авторизации.
 *
 * Раньше клиент показывал пользователю то, что прислал Supabase: английские
 * фразы вида «User already registered» и «Database error saving new user», а
 * запасной вариант в духе «Проверьте настройки Supabase Auth». Для человека,
 * который просто хочет зарегистрироваться, это шум и тревога.
 *
 * Правило здесь одно: наружу уходит только русский текст отсюда. Исходное
 * сообщение Supabase не показывается никогда — оно уходит в лог, где его
 * видно разработчику и не видно пользователю.
 */

export type AuthErrorMode = "login" | "register"

export interface AuthErrorLike {
  message?: string
  status?: number
  code?: string
}

/** Запасные тексты. Никаких «Supabase», «Auth», «токен» и кодов ошибок. */
function fallback(mode: AuthErrorMode): string {
  return mode === "register"
    ? "Не получилось создать аккаунт. Попробуйте ещё раз — если не выйдет, напишите нам."
    : "Не получилось войти. Проверьте email и пароль и попробуйте ещё раз."
}

/**
 * Сопоставление по `error_code` из Supabase.
 *
 * Коды надёжнее текста: формулировки GoTrue менялись уже несколько раз
 * («User already registered» → «A user with this email address has already
 * been registered»), а коды — нет.
 */
const BY_CODE: Record<string, string> = {
  user_already_exists: "Аккаунт с таким email уже есть. Попробуйте войти.",
  email_exists: "Аккаунт с таким email уже есть. Попробуйте войти.",
  email_taken: "Аккаунт с таким email уже есть. Попробуйте войти.",
  weak_password: "Пароль слишком простой. Придумайте подлиннее и попробуйте снова.",
  over_password_length: "Пароль слишком длинный. Сократите его немного.",
  invalid_email: "Проверьте email — похоже, в нём опечатка.",
  validation_failed: "Проверьте email и пароль и попробуйте снова.",
  email_not_confirmed: "Осталось подтвердить email по ссылке из письма.",
  signup_disabled: "Регистрация по email сейчас недоступна. Попробуйте позже.",
  user_banned: "Этот аккаунт заблокирован.",
  over_email_send_rate_limit:
    "Мы отправили слишком много писем подряд. Подождите пару минут и попробуйте снова.",
  over_email_send_limit:
    "Мы отправили слишком много писем подряд. Подождите пару минут и попробуйте снова.",
  over_request_rate_limit: "Слишком много попыток подряд. Подождите немного и попробуйте снова.",
  over_confirmation_rate_limit:
    "Слишком много попыток подтверждения. Подождите немного и попробуйте снова.",
  unexpected_failure: "Что-то пошло не так на нашей стороне. Попробуйте позже.",
  database_error: "Что-то пошло не так на нашей стороне. Попробуйте позже.",
  provider_disabled: "Этот способ входа сейчас недоступен.",
}

/**
 * Сопоставление по тексту — на случай старых версий GoTrue, где кода нет.
 * Порядок важен: более специфичные проверки идут раньше общих.
 */
const BY_TEXT: Array<[RegExp, string]> = [
  [/already (been )?registered/i, "Аккаунт с таким email уже есть. Попробуйте войти."],
  [/user already exists/i, "Аккаунт с таким email уже есть. Попробуйте войти."],
  [/invalid login credentials|invalid_grant/i, "Неверный email или пароль"],
  [/email not confirmed/i, "Осталось подтвердить email по ссылке из письма."],
  [
    /password (should be|is known to be weak|is too weak)|weak password/i,
    "Пароль слишком простой. Придумайте подлиннее и попробуйте снова.",
  ],
  [/unable to validate email|invalid email|invalid format/i, "Проверьте email — похоже, в нём опечатка."],
  [/rate limit|too many|security purposes/i, "Слишком много попыток подряд. Подождите немного и попробуйте снова."],
  [/signup is disabled|signups not allowed|email signups are disabled/i, "Регистрация по email сейчас недоступна. Попробуйте позже."],
  [/sending (confirmation )?email|error sending/i, "Не получилось отправить письмо. Попробуйте позже."],
  [/database error|saving new user|internal|unexpected/i, "Что-то пошло не так на нашей стороне. Попробуйте позже."],
]

/**
 * Единственная точка превращения ошибки в текст для пользователя.
 *
 * В режиме входа сообщение «аккаунт уже есть» намеренно превращается в
 * «неверный email или пароль»: иначе форма входа превращается в способ
 * перебрать, какие адреса зарегистрированы.
 */
export function friendlyAuthError(
  err: AuthErrorLike | string | null | undefined,
  mode: AuthErrorMode = "login"
): string {
  const source: AuthErrorLike =
    typeof err === "string" ? { message: err } : err ?? {}

  const isRegister = mode === "register"

  if (source.code && BY_CODE[source.code]) {
    const mapped = BY_CODE[source.code]
    // Не подтверждаем существование аккаунта при входе.
    if (!isRegister && mapped.startsWith("Аккаунт с таким email")) {
      return "Неверный email или пароль"
    }
    return mapped
  }

  const message = (source.message ?? "").trim()
  if (message) {
    for (const [pattern, mapped] of BY_TEXT) {
      if (pattern.test(message)) {
        if (!isRegister && mapped.startsWith("Аккаунт с таким email")) {
          return "Неверный email или пароль"
        }
        return mapped
      }
    }
  }

  if (source.status === 429) {
    return "Слишком много попыток подряд. Подождите немного и попробуйте снова."
  }

  if (typeof source.status === "number" && source.status >= 500) {
    return "Что-то пошло не так на нашей стороне. Попробуйте позже."
  }

  return fallback(mode)
}
