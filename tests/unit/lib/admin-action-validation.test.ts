import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"

/**
 * Инварианты безопасности мутирующих админ-экшенов.
 *
 * ПОЧЕМУ ЭТО ЧИТАЕТСЯ ИЗ ИСХОДНИКА, А НЕ ВЫЗЫВАЕТСЯ
 *   Экшены помечены "use server" и внутри дергают next/headers, поэтому
 *   вызвать их из unit-теста нельзя без поднятого сервера. Вместо этого
 *   проверяем здесь ровно то, что легко сломать правкой соседнего кода:
 *   наличие обязательных проверок в теле функции. Такой тест не заменяет
 *   проверку поведения, но ловит регрессию «удалили строку валидации».
 */

const ACTIONS_SOURCE = readFileSync(
  join(process.cwd(), "app", "admin", "actions.ts"),
  "utf8",
)

/** Возвращает тело функции от `export ... function name(` до следующей функции верхнего уровня. */
function functionBody(source: string, name: string): string {
  const start = source.search(new RegExp(`^export (?:async )?function ${name}\\b`, "m"))
  if (start === -1) throw new Error(`Функция ${name} не найдена в actions.ts`)

  const rest = source.slice(start + 1)
  const next = rest.search(/^(?:export )?(?:async )?function \w+/m)
  return next === -1 ? rest : rest.slice(0, next)
}

describe("валидация мутирующих админ-экшенов", () => {
  it("adminGrantCurrency проверяет валюту, сумму и user_id", () => {
    const body = functionBody(ACTIONS_SOURCE, "adminGrantCurrency")
    // currency используется как ИМЯ КОЛОНКИ — произвольная строка выбрала бы
    // другую колонку той же таблицы.
    expect(body).toMatch(/currency !== "coins" && currency !== "dust"/)
    // amount складывается с балансом: NaN/Infinity/дробь писали бы мусор.
    expect(body).toMatch(/Number\.isSafeInteger\(amount\)/)
    expect(body).toMatch(/MAX_CURRENCY_GRANT/)
    expect(body).toMatch(/USER_ID_PATTERN/)
  })

  it("adminGrantCurrency валидирует amount ДО сложения с балансом", () => {
    const body = functionBody(ACTIONS_SOURCE, "adminGrantCurrency")
    const validateAt = body.indexOf("Number.isSafeInteger(amount)")
    const addAt = body.indexOf("Math.max(0, currentBalance + amount)")

    // Оба шага обязаны присутствовать, и валидация — раньше сложения.
    // Иначе мусорное значение успеет попасть в вычисление баланса.
    expect(validateAt).toBeGreaterThan(-1)
    expect(addAt).toBeGreaterThan(-1)
    expect(validateAt).toBeLessThan(addAt)
  })

  it("adminSendMailBulk ограничивает размер рассылки и чистит список", () => {
    const body = functionBody(ACTIONS_SOURCE, "adminSendMailBulk")
    expect(body).toMatch(/MAIL_BULK_MAX/)
    // Список приходит из клиента: мусорные значения и дубликаты — в базу нельзя.
    expect(body).toMatch(/new Set\(/)
    expect(body).toMatch(/USER_ID_PATTERN/)
  })

  it("normalizeMailPayload проверяет тип письма", () => {
    // type определяет семантику получения письма на клиенте.
    expect(ACTIONS_SOURCE).toMatch(/MAIL_TYPES\.has\(input\?\.type\)/)
  })

  it("adminSendPushNotification отсекает внешние адреса в url", () => {
    // url попадает в public/sw.js → clients.openWindow(url).
    expect(ACTIONS_SOURCE).toMatch(/function sanitizePushUrl/)
    const body = functionBody(ACTIONS_SOURCE, "adminSendPushNotification")
    expect(body).toMatch(/sanitizePushUrl\(url\)/)
  })

  it("выборки ограничены потолком", () => {
    // limit/page приходят из клиента: без клампа один запрос читал таблицу целиком.
    expect(ACTIONS_SOURCE).toMatch(/function clampAdminLimit/)
    expect(functionBody(ACTIONS_SOURCE, "getPvPLogs")).toMatch(/clampAdminLimit/)
    expect(functionBody(ACTIONS_SOURCE, "getCustomNews")).toMatch(/clampAdminLimit/)
  })
})

describe("mass assignment в мутирующих админ-экшенах", () => {
  it("updatePvPRule фильтрует поля по белому списку", () => {
    const body = functionBody(ACTIONS_SOURCE, "updatePvPRule")
    // Спред `{ ...updates }` позволял подменить id и любую другую колонку.
    expect(body).not.toMatch(/\.update\(\{ \.\.\.updates/)
    expect(body).toMatch(/PVP_RULE_WRITABLE/)
  })

  it("updateBanner фильтрует поля по белому списку", () => {
    const body = functionBody(ACTIONS_SOURCE, "updateBanner")
    expect(body).not.toMatch(/\.update\(\{ \.\.\.updates/)
    expect(body).toMatch(/BANNER_WRITABLE/)
  })

  it("updateBattleBackground фильтрует поля по белому списку", () => {
    const body = functionBody(ACTIONS_SOURCE, "updateBattleBackground")
    expect(body).not.toMatch(/\.update\(updates\)/)
    expect(body).toMatch(/normalizeBattleBg\(updates, true\)/)
  })

  it("getAdminUsers не тянет select('*') из profiles", () => {
    const body = functionBody(ACTIONS_SOURCE, "getAdminUsers")
    // Спред `...profile` в ответ отправлял ВСЮ строку профиля в браузер.
    const profilesSelect = body.match(/\.from\("profiles"\)[\s\S]{0,120}?\.select\(([^)]*)\)/)
    expect(profilesSelect).toBeTruthy()
    expect(profilesSelect![1]).not.toMatch(/["']\*["']/)
  })
})

describe("доступ к мнениям редакции", () => {
  it("редактирование идёт через server action, а не из браузера", () => {
    expect(ACTIONS_SOURCE).toMatch(/export async function upsertEditorialReview/)
    expect(ACTIONS_SOURCE).toMatch(/export async function deleteEditorialReview/)
    for (const name of ["getEditorialReviews", "upsertEditorialReview", "deleteEditorialReview"]) {
      // Каждая операция обязана проходить через getAdminSupabase(),
      // внутри которого живёт checkAdminAuth().
      expect(functionBody(ACTIONS_SOURCE, name)).toMatch(/getAdminSupabase\(\)/)
    }
  })

  it("вкладка редакции не импортирует браузерный Supabase-клиент", () => {
    const tab = readFileSync(join(process.cwd(), "app", "admin", "components", "EditorialTab.tsx"), "utf8")
    // Прямой upsert/delete через anon-ключ означал авторизацию только на RLS.
    expect(tab).not.toMatch(/from "@\/lib\/supabase"/)
    expect(tab).not.toMatch(/\.from\("editorial_reviews"\)/)
    expect(tab).toMatch(/from "\.\.\/actions"/)
  })
})

describe("вход в админку", () => {
  it("клиентский IP валидируется перед ключом рейт-лимита", () => {
    const body = functionBody(ACTIONS_SOURCE, "adminLogin")
    // Без isValidIp мусор в заголовке позволял обнулять счётчик попыток
    // каждым запросом и выводить белый список ADMIN_ALLOWED_IPS из любого адреса.
    expect(body).toMatch(/isValidIp\(forwardedIp\)/)
  })

  it("ошибка конфигузации не раскрывает деталей на клиенте", () => {
    const body = functionBody(ACTIONS_SOURCE, "adminLogin")
    // Детали — только в лог сервера.
    expect(body).toMatch(/console\.error\(`\[admin-auth\]/)
    expect(body).toMatch(/Админ-вход отключён/)
  })
})