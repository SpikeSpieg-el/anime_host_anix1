"use server"

import { cookies, headers } from "next/headers"
import { redirect } from "next/navigation"
import { createHash } from "node:crypto"
import { createClient } from "@supabase/supabase-js"
import webpush from "web-push"
import { ADMIN_AUTH_COOKIE, ADMIN_SESSION_TTL_SECONDS, constantTimeStringEqual, consumeAdminTotp, createAdminSessionToken, getAdminAuthConfigurationError, isAdminTotpRequired, isValidAdminSession } from "@/lib/admin-auth"
import { rateLimiters } from "@/lib/rate-limit"
import { sanitizeNewsHtml } from "@/lib/news/sanitize-html"
import { isValidIp, normalizeBlockTarget, subnetForIp } from "@/lib/ip-block"

export async function adminLogin(formData: FormData) {
  const fieldValue = (name: string) => {
    const value = formData.get(name)
    return typeof value === "string" ? value : ""
  }
  const username = fieldValue("username")
  const password = fieldValue("password")
  const totpCode = fieldValue("totpCode")

  const configurationError = getAdminAuthConfigurationError()
  if (configurationError) {
    console.error(`[admin-auth] Refusing login: ${configurationError}`)
    return { error: "Админ-вход отключён: не настроены обязательные параметры защиты." }
  }

  const requestHeaders = await headers()
  // Клиентский IP берётся из тех же заголовков, что и getClientIp в
  // lib/ip-block, и — важно — ПРОВЕРЯЕТСЯ через isValidIp. Раньше строка
  // подрезалась до 128 символов и шла в ключ рейт-лимита как есть: если
  // прокси не перезаписывает x-forwarded-for, атакующий подставлял туда
  // мусор и каждым новым значением обходил счётчик 5 попыток, получая
  // неограниченный перебор пароля + TOTP с одного адреса.
  const forwardedIp = (
    requestHeaders.get("cf-connecting-ip") ||
    requestHeaders.get("x-real-ip") ||
    requestHeaders.get("x-forwarded-for")?.split(",")[0] ||
    ""
  ).trim()
  const clientIp = isValidIp(forwardedIp) ? forwardedIp : "unknown"

  const allowlistedIps = (process.env.ADMIN_ALLOWED_IPS || "")
    .split(",")
    .map((ip) => ip.trim())
    .filter(Boolean)
  if (allowlistedIps.length > 0 && !allowlistedIps.includes(clientIp)) {
    return { error: "Неверные данные для входа." }
  }

  // Process-local throttling is a backstop. Production should also rate-limit
  // /admin at its trusted CDN/WAF so attempts are capped across instances.
  // Если адрес определить не удалось, ключ общий для всех таких посетителей —
  // это осознанно: для неизвестного адреса ограничение строже, а не слабее.
  const rateLimitKey = `admin-login:${createHash("sha256").update(clientIp).digest("hex")}`
  const rateLimit = rateLimiters.adminLogin.checkLimit(rateLimitKey)
  if (!rateLimit.success) return { error: "Слишком много попыток. Попробуйте позже." }

  const expectedUsername = process.env.ADMIN_USERNAME?.trim() || ""
  const expectedPassword = process.env.ADMIN_PASSWORD || ""
  const usernameMatches = constantTimeStringEqual(username, expectedUsername)
  const passwordMatches = constantTimeStringEqual(password, expectedPassword)

  if (!usernameMatches || !passwordMatches) {
    return { error: "Неверные данные для входа." }
  }

  // Do not consume a valid TOTP step when the primary credentials are wrong.
  if (isAdminTotpRequired() && !consumeAdminTotp(totpCode, process.env.ADMIN_TOTP_SECRET || "")) {
    return { error: "Неверные данные для входа." }
  }

  rateLimiters.adminLogin.resetLimit(rateLimitKey)
  const cookieStore = await cookies()
  cookieStore.delete("admin_attempts") // remove the old client-controlled lockout cookie
  cookieStore.set(ADMIN_AUTH_COOKIE, createAdminSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: ADMIN_SESSION_TTL_SECONDS,
    path: "/",
  })

  redirect("/admin")
}

export async function adminLogout() {
  const cookieStore = await cookies()
  cookieStore.delete(ADMIN_AUTH_COOKIE)
  redirect("/admin")
}

export async function checkAdminAuth(): Promise<boolean> {
  const cookieStore = await cookies()
  return isValidAdminSession(cookieStore.get(ADMIN_AUTH_COOKIE)?.value)
}

const ADMIN_DATA_PAGE_SIZE = 1000
const USER_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * Потолок одной разовой выдачи валюты.
 *
 * Не «магическое» ограничение, а страховка от опечатки в админке: раньше
 * amount шёл в баланс без проверки, и 1e15 отправлялось одним кликом.
 * Для нормальных начислений (сотни — миллионы) запас огромный.
 */
const MAX_CURRENCY_GRANT = 100_000_000

/** Потолок размера выборки в «страничных» админ-экшенах. */
const MAX_ADMIN_PAGE_SIZE = 200

/**
 * Выборка из клиентского аргумента.
 *
 * Раньше limit/page уходили в .range()/.limit() как есть, и один
 * сформированный вручную запрос читал таблицу целиком. Значение по
 * умолчанию — не «сколько просил», а безопасный максимум.
 */
function clampAdminLimit(limit: unknown, fallback = 50, max = MAX_ADMIN_PAGE_SIZE): number {
  const parsed = Number(limit)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(Math.max(Math.trunc(parsed), 1), max)
}

/** Проверка UUID. Единая точка для всех экшенов, принимающих user_id. */
function assertUserId(value: unknown, field = "user ID"): string {
  const userId = String(value ?? "").trim()
  if (!USER_ID_PATTERN.test(userId)) throw new Error(`Некорректный ${field}`)
  return userId
}

/** Обрезка строки с жёстким лимитом — защита от раздувания полей. */
function clampText(value: unknown, max: number): string {
  return String(value ?? "").trim().slice(0, max)
}

/**
 * Отсечение набора ключей для .update()/.insert().
 *
 * Типы TypeScript не работают на границе server action: клиент может
 * прислать любой объект и подменить id, created_at или любую другую
 * колонку, которой нет в UI. Поэтому пишем явный белый список полей,
 * а не спредим входной объект.
 */
function pickWritableFields<T extends Record<string, unknown>>(
  input: unknown,
  allowed: readonly (keyof T)[],
): Partial<T> {
  const source = (input ?? {}) as Record<string, unknown>
  const result: Record<string, unknown> = {}
  for (const key of allowed) {
    if (source[key as string] !== undefined) result[key as string] = source[key as string]
  }
  return result as Partial<T>
}

function isMissingTableError(error: any): boolean {
  const message = String(error?.message ?? error ?? "").toLowerCase()
  return error?.code === "42P01" || error?.code === "PGRST205" ||
    message.includes("does not exist") || message.includes("could not find the table")
}

async function fetchAllPages<T>(buildQuery: (from: number, to: number) => any): Promise<T[]> {
  const rows: T[] = []
  for (let from = 0; ; from += ADMIN_DATA_PAGE_SIZE) {
    const { data, error } = await buildQuery(from, from + ADMIN_DATA_PAGE_SIZE - 1)
    if (error) throw error
    const page = (data ?? []) as T[]
    rows.push(...page)
    if (page.length < ADMIN_DATA_PAGE_SIZE) return rows
  }
}

async function fetchOptionalPages<T>(buildQuery: (from: number, to: number) => any): Promise<{ rows: T[]; available: boolean }> {
  try {
    return { rows: await fetchAllPages<T>(buildQuery), available: true }
  } catch (error) {
    if (isMissingTableError(error)) return { rows: [], available: false }
    throw error
  }
}

async function listAllAuthUsers(supabase: any): Promise<any[]> {
  const users: any[] = []
  for (let page = 1; ; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: ADMIN_DATA_PAGE_SIZE })
    if (error) throw error
    const pageUsers = data?.users ?? []
    users.push(...pageUsers)
    if (pageUsers.length < ADMIN_DATA_PAGE_SIZE) return users
  }
}

function toIsoDate(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    const milliseconds = value < 1_000_000_000_000 ? value * 1000 : value
    const date = new Date(milliseconds)
    return Number.isNaN(date.getTime()) ? null : date.toISOString()
  }
  if (typeof value === "string" && value.trim()) {
    const numericValue = /^-?\d+(?:\.\d+)?$/.test(value.trim()) ? Number(value) : null
    if (numericValue !== null && Number.isFinite(numericValue)) {
      const milliseconds = Math.abs(numericValue) < 1_000_000_000_000 ? numericValue * 1000 : numericValue
      const date = new Date(milliseconds)
      return Number.isNaN(date.getTime()) ? null : date.toISOString()
    }
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? null : date.toISOString()
  }
  return null
}

function newestDate(values: unknown[]): string | null {
  const dates = values.map(toIsoDate).filter((value): value is string => Boolean(value))
  return dates.sort((a, b) => b.localeCompare(a))[0] ?? null
}

function isFutureDate(value: string | null | undefined): boolean {
  if (!value) return false
  const timestamp = new Date(value).getTime()
  return Number.isFinite(timestamp) && timestamp > Date.now()
}

/**
 * Admin user list. History/bookmark counts are aggregated across every page
 * (PostgREST otherwise silently returns only the first 1,000 rows). Details are
 * loaded per-user on demand to keep the initial admin screen small.
 */
export async function getAdminUsers() {
  const supabase = await getAdminSupabase()

  const [profiles, authUsers, historyRows, bookmarkRows, statsResult, aiStatsResult] = await Promise.all([
    // Явный список колонок вместо select("*").
    //
    // Действующие вкладки Users/Рассылка/События используют из профиля
    // только эти поля. Спред `...profile` в ответ отправлял ВСЮ строку, то
    // есть любая новая колонка profiles (внутренние флаги, tg-id, коды
    // рефералов) автоматически уезжала бы в браузер администратора.
    fetchAllPages<any>((from, to) => supabase
      .from("profiles")
      .select("id, username, avatar_url, updated_at, referral_code, referred_by")
      .order("updated_at", { ascending: false, nullsFirst: false })
      .order("id", { ascending: true })
      .range(from, to)),
    listAllAuthUsers(supabase),
    fetchAllPages<any>((from, to) => supabase
      .from("watch_history")
      .select("user_id, anime_id, timestamp")
      .order("timestamp", { ascending: false })
      .order("user_id", { ascending: true })
      .order("anime_id", { ascending: true })
      .range(from, to)),
    fetchAllPages<any>((from, to) => supabase
      .from("bookmarks")
      .select("user_id, anime_id, created_at")
      .order("created_at", { ascending: false })
      .order("user_id", { ascending: true })
      .order("anime_id", { ascending: true })
      .range(from, to)),
    fetchOptionalPages<any>((from, to) => supabase
      .from("account_stats")
      .select("*")
      .order("user_id", { ascending: true })
      .range(from, to)),
    fetchOptionalPages<any>((from, to) => supabase
      .from("ai_learning_stats")
      .select("*")
      .order("user_id", { ascending: true })
      .range(from, to)),
  ])

  const profileById = new Map<string, any>((profiles || []).map((profile: any) => [profile.id, profile]))
  const authById = new Map<string, any>((authUsers || []).map((user: any) => [user.id, user]))
  const statsById = new Map<string, any>(statsResult.rows.map((stats: any) => [stats.user_id, stats]))
  const aiStatsById = new Map<string, any>(aiStatsResult.rows.map((stats: any) => [stats.user_id, stats]))
  const historyCountById = new Map<string, number>()
  const bookmarkCountById = new Map<string, number>()
  const lastHistoryById = new Map<string, string>()
  const lastBookmarkById = new Map<string, string>()

  for (const row of historyRows) {
    historyCountById.set(row.user_id, (historyCountById.get(row.user_id) ?? 0) + 1)
    const timestamp = toIsoDate(row.timestamp)
    if (timestamp && (!lastHistoryById.has(row.user_id) || timestamp > lastHistoryById.get(row.user_id)!)) {
      lastHistoryById.set(row.user_id, timestamp)
    }
  }
  for (const row of bookmarkRows) {
    bookmarkCountById.set(row.user_id, (bookmarkCountById.get(row.user_id) ?? 0) + 1)
    const timestamp = toIsoDate(row.created_at)
    if (timestamp && (!lastBookmarkById.has(row.user_id) || timestamp > lastBookmarkById.get(row.user_id)!)) {
      lastBookmarkById.set(row.user_id, timestamp)
    }
  }

  // Include Auth users even if an older/failed signup trigger did not create a profile row.
  const userIds = new Set<string>([...profileById.keys(), ...authById.keys()])
  return Array.from(userIds).map((id) => {
    const profile = profileById.get(id) ?? {}
    const authUser = authById.get(id) ?? {}
    const metadata = authUser.user_metadata ?? {}
    const accountStats = statsById.get(id) ?? null
    const bannedUntil = authUser.banned_until ?? null
    const watchHistoryCount = historyCountById.get(id) ?? 0
    const bookmarksCount = bookmarkCountById.get(id) ?? 0

    return {
      ...profile,
      id,
      username: profile.username ?? metadata.username ?? authUser.email ?? null,
      avatar_url: profile.avatar_url ?? metadata.avatar_url ?? null,
      email: authUser.email ?? null,
      created_at: authUser.created_at ?? null,
      last_sign_in_at: authUser.last_sign_in_at ?? null,
      banned_until: bannedUntil,
      is_banned: isFutureDate(bannedUntil),
      referral_code: profile.referral_code ?? null,
      referred_by: profile.referred_by ?? null,
      referrerDomain: metadata.initial_referrer_domain ?? metadata.referrer_domain ?? null,
      referralLandingPage: metadata.initial_landing_page ?? null,
      watchHistoryCount,
      bookmarksCount,
      lastActivity: newestDate([
        profile.updated_at,
        authUser.last_sign_in_at,
        lastHistoryById.get(id),
        lastBookmarkById.get(id),
        accountStats?.last_visit_at,
        accountStats?.last_updated_at,
      ]),
      recentHistory: [],
      recentBookmarks: [],
      allHistory: [],
      allBookmarks: [],
      detailsLoaded: false,
      activityEvents: [],
      activityEventsCount: 0,
      activityEventsAvailable: true,
      accountStats,
      accountStatsAvailable: statsResult.available,
      aiStats: aiStatsById.get(id) ?? null,
      aiStatsAvailable: aiStatsResult.available,
    }
  }).sort((a, b) => (b.created_at ?? b.updated_at ?? "").localeCompare(a.created_at ?? a.updated_at ?? ""))
}

/** Load a selected user's full saved/watch lists and latest event log. */
export async function getAdminUserDetails(userId: string) {
  const supabase = await getAdminSupabase()
  if (!USER_ID_PATTERN.test(userId)) throw new Error("Invalid user ID")

  const [history, bookmarks, activityResult] = await Promise.all([
    fetchAllPages<any>((from, to) => supabase
      .from("watch_history")
      .select("*")
      .eq("user_id", userId)
      .order("timestamp", { ascending: false })
      .order("anime_id", { ascending: true })
      .range(from, to)),
    fetchAllPages<any>((from, to) => supabase
      .from("bookmarks")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .order("anime_id", { ascending: true })
      .range(from, to)),
    (async () => {
      try {
        const { data, error, count } = await supabase
          .from("user_activity_events")
          .select("id, user_id, event_type, category, payload, created_at", { count: "exact" })
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .order("id", { ascending: true })
          .limit(100)
        if (error) {
          if (isMissingTableError(error)) return { rows: [], count: 0, available: false }
          throw error
        }
        return { rows: data ?? [], count: count ?? data?.length ?? 0, available: true }
      } catch (error) {
        if (isMissingTableError(error)) return { rows: [], count: 0, available: false }
        throw error
      }
    })(),
  ])

  return {
    detailsLoaded: true,
    allHistory: history,
    recentHistory: history.slice(0, 5),
    allBookmarks: bookmarks,
    recentBookmarks: bookmarks.slice(0, 5),
    watchHistoryCount: history.length,
    bookmarksCount: bookmarks.length,
    activityEvents: activityResult.rows,
    activityEventsCount: activityResult.count,
    activityEventsAvailable: activityResult.available,
  }
}

/** Block/unblock account sign-in without deleting its data. */
export async function adminSetUserBan(userId: string, banned: boolean) {
  const supabase = await getAdminSupabase()
  if (!USER_ID_PATTERN.test(userId) || typeof banned !== "boolean") throw new Error("Invalid moderation request")

  const { data, error } = await supabase.auth.admin.updateUserById(userId, {
    ban_duration: banned ? "876000h" : "none", // 100 years; reversible from this panel.
  })
  if (error) throw error

  return {
    banned_until: data.user?.banned_until ?? (banned ? new Date(Date.now() + 876000 * 60 * 60 * 1000).toISOString() : null),
    is_banned: banned,
  }
}

export async function getPvPRules() {
  const isAdmin = await checkAdminAuth()
  if (!isAdmin) throw new Error("Unauthorized")

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabase = createClient(supabaseUrl!, supabaseServiceKey!)

  const { data, error } = await supabase
    .from("pvp_rules")
    .select("*")
    .order("category")
  
  if (error) throw error
  return data
}

/**
 * Поля pvp_rules, которые вкладка PvP реально редактирует.
 * id/created_at/updated_at исключены намеренно — см. pickWritableFields.
 */
const PVP_RULE_WRITABLE = [
  "name_ru",
  "description_ru",
  "is_active",
  "category",
  "config",
] as const

export async function updatePvPRule(id: string, updates: any) {
  const isAdmin = await checkAdminAuth()
  if (!isAdmin) throw new Error("Unauthorized")

  const ruleId = String(id ?? "").trim()
  if (!ruleId || ruleId.length > 64) throw new Error("Некорректный ID правила")

  const writable = pickWritableFields(updates, PVP_RULE_WRITABLE)
  if (Object.keys(writable).length === 0) throw new Error("Нет полей для обновления")

  const supabase = await getAdminSupabase()

  const { error } = await supabase
    .from("pvp_rules")
    .update({ ...writable, updated_at: new Date().toISOString() })
    .eq("id", ruleId)

  if (error) throw error
  return { success: true }
}

export async function getPvPLogs(limit = 100) {
  const isAdmin = await checkAdminAuth()
  if (!isAdmin) throw new Error("Unauthorized")

  const supabase = await getAdminSupabase()

  const { data, error } = await supabase
    .from("pvp_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(clampAdminLimit(limit, 100))

  if (error) throw error
  if (!data || data.length === 0) return []

  const userIds = new Set<string>()
  data.forEach((log: any) => {
    if (log.player1_id) userIds.add(log.player1_id)
    if (log.player2_id) userIds.add(log.player2_id)
  })

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, username, avatar_url")
    .in("id", Array.from(userIds))

  const profileMap = new Map<string, any>()
  profiles?.forEach((p: any) => profileMap.set(p.id, p))

  return data.map((log: any) => ({
    ...log,
    player1: profileMap.get(log.player1_id) || { username: null, avatar_url: null },
    player2: profileMap.get(log.player2_id) || { username: null, avatar_url: null },
  }))
}

/** Поля pvp_locations, доступные из формы создания локации. */
const PVP_LOCATION_WRITABLE = [
  "name",
  "name_ru",
  "description",
  "description_ru",
  "is_active",
  "is_empty",
  "icon_name",
] as const

/** Поля battle_backgrounds, доступные из формы фона. */
const BATTLE_BG_WRITABLE = [
  "name",
  "image_url",
  "mode",
  "is_active",
  "sort_order",
  "scale",
  "position_x",
  "position_y",
  "opacity",
] as const

const BATTLE_BG_MODES = new Set(["pvp", "pve", "both"])

/**
 * Нормализация полей фона battle.
 *
 * Здесь нет «просто number»: scale/position/opacity уходят в CSS
 * transform/opacity превью, поэтому NaN или строка ломают рендер, а
 * mode ограничен CHECK-constraint'ом в БД — нечего доверять вводу.
 */
function normalizeBattleBg(input: unknown, partial: boolean) {
  const writable = pickWritableFields(input, BATTLE_BG_WRITABLE) as Record<string, unknown>

  if (writable.name !== undefined) writable.name = clampText(writable.name, 200)
  if (writable.image_url !== undefined) writable.image_url = clampText(writable.image_url, 2000)
  if (writable.mode !== undefined && !BATTLE_BG_MODES.has(String(writable.mode))) {
    throw new Error("Некорректный режим фона")
  }
  if (writable.is_active !== undefined) writable.is_active = Boolean(writable.is_active)

  for (const key of ["sort_order", "scale", "position_x", "position_y", "opacity"] as const) {
    if (writable[key] === undefined) continue
    const value = Number(writable[key])
    if (!Number.isFinite(value)) throw new Error(`Поле ${key} должно быть числом`)
    writable[key] = value
  }

  // На создании обязательные поля проверяем явно, чтобы БД не была
  // единственным валидатором.
  if (!partial) {
    if (!writable.name) throw new Error("Укажите название фона")
    if (!writable.image_url) throw new Error("Укажите ссылку на изображение")
    if (Object.keys(writable).length === 0) throw new Error("Нет полей для сохранения")
  }

  return writable
}

export async function getPvPLocations() {
  const isAdmin = await checkAdminAuth()
  if (!isAdmin) throw new Error("Unauthorized")

  const supabase = await getAdminSupabase()

  const { data, error } = await supabase
    .from("pvp_locations")
    .select("*, rules:pvp_location_rules(rule_id)")
    .order("created_at", { ascending: false })

  if (error) throw error
  return data
}

export async function createPvPLocation(location: any, ruleIds: string[]) {
  const isAdmin = await checkAdminAuth()
  if (!isAdmin) throw new Error("Unauthorized")

  const writable = pickWritableFields(location, PVP_LOCATION_WRITABLE) as Record<string, unknown>
  writable.name = clampText(writable.name, 120)
  writable.name_ru = clampText(writable.name_ru, 120)
  writable.description = clampText(writable.description, 2000)
  writable.description_ru = clampText(writable.description_ru, 2000)
  if (!writable.name || !writable.name_ru) throw new Error("Название локации обязательно")

  const supabase = await getAdminSupabase()

  const { data, error } = await supabase
    .from("pvp_locations")
    .insert([writable])
    .select()
    .single()

  if (error) throw error

  // ruleIds приходят из клиента: приводим к уникальным строкам, иначе
  // один сформированный вручную массив упирается в размер INSERT.
  const ruleIdList = Array.from(
    new Set((Array.isArray(ruleIds) ? ruleIds : []).map((ruleId) => String(ruleId).trim()).filter(Boolean)),
  ).slice(0, 200)

  if (ruleIdList.length > 0) {
    const { error: rulesError } = await supabase
      .from("pvp_location_rules")
      .insert(ruleIdList.map(ruleId => ({
        location_id: data.id,
        rule_id: ruleId
      })))
    if (rulesError) throw rulesError
  }

  return data
}

export async function deletePvPLocation(id: string) {
  const isAdmin = await checkAdminAuth()
  if (!isAdmin) throw new Error("Unauthorized")

  const supabase = await getAdminSupabase()

  const { error } = await supabase
    .from("pvp_locations")
    .delete()
    .eq("id", id)

  if (error) throw error
  return { success: true }
}

// ============================================================
// Battle Backgrounds CRUD
// ============================================================

export async function getBattleBackgrounds() {
  const isAdmin = await checkAdminAuth()
  if (!isAdmin) throw new Error("Unauthorized")

  const supabase = await getAdminSupabase()

  const { data, error } = await supabase
    .from("battle_backgrounds")
    .select("*")
    .order("sort_order", { ascending: true })

  if (error) throw error
  return data
}

export async function createBattleBackground(bg: { name: string; image_url: string; mode: string; is_active: boolean; sort_order: number; scale?: number; position_x?: number; position_y?: number; opacity?: number }) {
  const isAdmin = await checkAdminAuth()
  if (!isAdmin) throw new Error("Unauthorized")

  const supabase = await getAdminSupabase()

  const { data, error } = await supabase
    .from("battle_backgrounds")
    .insert([{
      ...normalizeBattleBg(bg, false),
      scale: 1.0,
      position_x: 50.0,
      position_y: 50.0,
      opacity: 0.35,
    }])
    .select()
    .single()

  if (error) throw error
  return data
}

export async function deleteBattleBackground(id: string) {
  const isAdmin = await checkAdminAuth()
  if (!isAdmin) throw new Error("Unauthorized")

  const supabase = await getAdminSupabase()

  const { error } = await supabase
    .from("battle_backgrounds")
    .delete()
    .eq("id", id)

  if (error) throw error
  return { success: true }
}

export async function toggleBattleBackground(id: string, currentStatus: boolean) {
  const isAdmin = await checkAdminAuth()
  if (!isAdmin) throw new Error("Unauthorized")

  const supabase = await getAdminSupabase()

  const { data, error } = await supabase
    .from("battle_backgrounds")
    .update({ is_active: !currentStatus })
    .eq("id", id)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateBattleBackground(id: string, updates: { name?: string; image_url?: string; mode?: string; scale?: number; position_x?: number; position_y?: number; opacity?: number }) {
  const isAdmin = await checkAdminAuth()
  if (!isAdmin) throw new Error("Unauthorized")

  const writable = normalizeBattleBg(updates, true)
  if (Object.keys(writable).length === 0) throw new Error("Нет полей для обновления")

  const supabase = await getAdminSupabase()

  const { data, error } = await supabase
    .from("battle_backgrounds")
    .update(writable)
    .eq("id", id)
    .select()
    .single()

  if (error) throw error
  return data
}

// ============================================================
// Admin helper: create a Supabase admin client
// ============================================================
async function getAdminSupabase() {
  const isAdmin = await checkAdminAuth()
  if (!isAdmin) throw new Error("Unauthorized")

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Server misconfigured: Supabase env vars missing")
  }
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export async function getBattleAIDashboard() {
  const supabase = await getAdminSupabase()
  const [locationsResult, profilesResult, profilesCountResult] = await Promise.all([
    supabase
      .from("ai_dungeon_learning")
      .select("dungeon_id, battles, wins, losses, total_turns, updated_at")
      .order("battles", { ascending: false }),
    supabase
      .from("ai_player_dungeon_profiles")
      .select("user_id, dungeon_id, battles, wins, losses, consecutive_wins, updated_at")
      .order("consecutive_wins", { ascending: false })
      .order("wins", { ascending: false })
      .limit(100),
    supabase
      .from("ai_player_dungeon_profiles")
      .select("*", { count: "exact", head: true }),
  ])

  if (locationsResult.error) throw locationsResult.error
  if (profilesResult.error) throw profilesResult.error
  if (profilesCountResult.error) throw profilesCountResult.error

  const playerProfiles = profilesResult.data || []
  const userIds = Array.from(new Set(playerProfiles.map((profile: any) => profile.user_id)))
  const { data: users, error: usersError } = userIds.length > 0
    ? await supabase.from("profiles").select("id, username, avatar_url").in("id", userIds)
    : { data: [], error: null }
  if (usersError) throw usersError

  const userMap = new Map((users || []).map((user: any) => [user.id, user]))
  const locations = (locationsResult.data || []).map((location: any) => {
    const playerWinRate = location.battles > 0 ? location.wins / location.battles : 0
    const avgTurns = location.battles > 0 ? location.total_turns / location.battles : 0
    const balanceStatus = location.battles < 20
      ? "insufficient"
      : playerWinRate > 0.65
        ? "player_advantage"
        : playerWinRate < 0.45
          ? "ai_advantage"
          : "balanced"

    return {
      ...location,
      playerWinRate,
      aiWinRate: 1 - playerWinRate,
      avgTurns,
      balanceStatus,
    }
  })
  const farmProfiles = playerProfiles.map((profile: any) => {
    const user = userMap.get(profile.user_id)
    const winRate = profile.battles > 0 ? profile.wins / profile.battles : 0
    const riskLevel = profile.battles >= 12 && winRate >= 0.8 && profile.consecutive_wins >= 5
      ? "high"
      : profile.battles >= 6 && winRate >= 0.65
        ? "medium"
        : "normal"

    return {
      ...profile,
      username: user?.username || null,
      avatar_url: user?.avatar_url || null,
      winRate,
      riskLevel,
    }
  })
  const totalBattles = locations.reduce((total, location) => total + location.battles, 0)
  const totalWins = locations.reduce((total, location) => total + location.wins, 0)
  const totalTurns = locations.reduce((total, location) => total + location.total_turns, 0)

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      totalBattles,
      playerWinRate: totalBattles > 0 ? totalWins / totalBattles : 0,
      averageTurns: totalBattles > 0 ? totalTurns / totalBattles : 0,
      activeLocations: locations.length,
      trackedProfiles: profilesCountResult.count || 0,
      highRiskProfiles: farmProfiles.filter(profile => profile.riskLevel === "high").length,
      balancedLocations: locations.filter(location => location.balanceStatus === "balanced").length,
      insufficientLocations: locations.filter(location => location.balanceStatus === "insufficient").length,
      playerAdvantageLocations: locations.filter(location => location.balanceStatus === "player_advantage").length,
      aiAdvantageLocations: locations.filter(location => location.balanceStatus === "ai_advantage").length,
    },
    locations,
    farmProfiles,
  }
}

// ============================================================
// Lightweight users list (for card-gifting / mail targeting)
// Returns: id, username, avatar_url, email, created_at
// ============================================================
export async function getAdminUsersSimple() {
  const supabase = await getAdminSupabase()
  const [profiles, authUsers] = await Promise.all([
    fetchAllPages<any>((from, to) => supabase
      .from("profiles")
      .select("id, username, avatar_url, updated_at")
      .order("updated_at", { ascending: false, nullsFirst: false })
      .order("id", { ascending: true })
      .range(from, to)),
    listAllAuthUsers(supabase),
  ])

  const profileById = new Map<string, any>(profiles.map((profile: any) => [profile.id, profile]))
  const authById = new Map<string, any>(authUsers.map((user: any) => [user.id, user]))
  const ids = new Set<string>([...profileById.keys(), ...authById.keys()])

  return Array.from(ids).map((id) => {
    const profile = profileById.get(id) ?? {}
    const authUser = authById.get(id) ?? {}
    return {
      id,
      username: profile.username ?? authUser.user_metadata?.username ?? authUser.email ?? null,
      avatar_url: profile.avatar_url ?? authUser.user_metadata?.avatar_url ?? null,
      updated_at: profile.updated_at ?? null,
      email: authUser.email ?? null,
      created_at: authUser.created_at ?? null,
    }
  }).sort((a, b) => (b.created_at ?? b.updated_at ?? "").localeCompare(a.created_at ?? a.updated_at ?? ""))
}

// ============================================================
// MAIL: send a mail with optional attachment to a user
// ============================================================
export interface AdminMailInput {
  userId: string
  type: "card_gift" | "coins" | "dust" | "event_reward" | "message"
  title: string
  body?: string
  cardPayload?: any // Card object for card_gift
  amount?: number // for coins/dust
  sender?: string
  expiresAt?: string
}

const MAIL_TYPES = new Set<string>([
  "card_gift",
  "coins",
  "dust",
  "event_reward",
  "message",
])

const MAIL_TITLE_MAX = 200
const MAIL_BODY_MAX = 4_000
/** Потолок одной рассылки. Без него массив произвольного размера уходил в один INSERT. */
const MAIL_BULK_MAX = 5_000

/**
 * Нормализация письма.
 *
 * `type` определяет семантику получения письма на клиенте, поэтому
 * произвольная строка здесь опасна; amount клампится тем же потолком,
 * что и прямая выдача валюты, чтобы письмо нельзя было использовать
 * как обход проверок adminGrantCurrency.
 */
function normalizeMailPayload(input: AdminMailInput) {
  if (!MAIL_TYPES.has(input?.type)) throw new Error("Некорректный тип письма")

  const title = clampText(input.title, MAIL_TITLE_MAX)
  if (!title) throw new Error("Укажите заголовок письма")

  const amount = Number(input.amount ?? 0)
  if (!Number.isSafeInteger(amount)) throw new Error("Сумма в письме должна быть целым числом")
  if (Math.abs(amount) > MAX_CURRENCY_GRANT) {
    throw new Error(`Сумма в письме слишком велика (максимум ${MAX_CURRENCY_GRANT})`)
  }

  let expiresAt: string | null = null
  if (input.expiresAt) {
    const parsed = new Date(input.expiresAt)
    if (Number.isNaN(parsed.getTime())) throw new Error("Некорректная дата истечения письма")
    expiresAt = parsed.toISOString()
  }

  return {
    sender: clampText(input.sender || "admin", 64),
    type: input.type,
    title,
    body: input.body ? clampText(input.body, MAIL_BODY_MAX) : null,
    card_payload: input.cardPayload ?? null,
    amount,
    is_read: false,
    is_claimed: false,
    expires_at: expiresAt,
  }
}

export async function adminSendMail(input: AdminMailInput) {
  const supabase = await getAdminSupabase()

  const payload = normalizeMailPayload(input)
  const row: any = {
    user_id: assertUserId(input.userId),
    ...payload,
  }
  if (!row.expires_at) delete row.expires_at

  const { data, error } = await supabase
    .from("user_mail")
    .insert([row])
    .select()
    .single()

  if (error) throw error

  // Send push notification if user has subscriptions
  try {
    const mailTypeLabel: Record<string, string> = {
      card_gift: "Подарок: новая карта!",
      coins: "Начислены монеты",
      dust: "Начислена пыль",
      event_reward: "Награда события",
      message: "Новое сообщение",
    }
    const pushTitle = mailTypeLabel[input.type] || "Новое письмо"
    const pushBody = input.title
    await adminSendPushNotification(input.userId, pushTitle, pushBody, "/gacha")
  } catch (e) {
    console.warn("Failed to send push for mail:", e)
  }

  return data
}

// Bulk send mail to many users (e.g. event reward to all)
export async function adminSendMailBulk(input: Omit<AdminMailInput, "userId"> & { userIds: string[] }) {
  const supabase = await getAdminSupabase()

  const payload = normalizeMailPayload({ ...input, userId: "" } as AdminMailInput)

  // userIds приходят из клиента: отбрасываем мусорные значения, снимаем
  // дубликаты и ограничиваем размер рассылки — раньше массив любой длины
  // уходил в один INSERT.
  const userIds = Array.from(
    new Set(
      (Array.isArray(input.userIds) ? input.userIds : [])
        .map((userId) => String(userId).trim())
        .filter((userId) => USER_ID_PATTERN.test(userId)),
    ),
  ).slice(0, MAIL_BULK_MAX)

  if (userIds.length === 0) throw new Error("Некорректный список получателей")

  const rows = userIds.map((userId) => ({
    user_id: userId,
    ...payload,
    ...(payload.expires_at ? { expires_at: payload.expires_at } : {}),
  }))

  const { data, error } = await supabase.from("user_mail").insert(rows).select()
  if (error) throw error

  // Send push notifications to all recipients who have subscriptions
  try {
    const mailTypeLabel: Record<string, string> = {
      card_gift: "Подарок: новая карта!",
      coins: "Начислены монеты",
      dust: "Начислена пыль",
      event_reward: "Награда события",
      message: "Новое сообщение",
    }
    const pushTitle = mailTypeLabel[input.type] || "Новое письмо"
    const pushBody = input.title
    await adminSendPushNotificationBulk(userIds, pushTitle, pushBody, "/gacha")
  } catch (e) {
    console.warn("Failed to send bulk push for mail:", e)
  }

  return { sent: data?.length ?? 0 }
}

// ============================================================
// CURRENCY: grant coins or dust to a user directly
// ============================================================
export async function adminGrantCurrency(userId: string, currency: "coins" | "dust", amount: number) {
  const supabase = await getAdminSupabase()

  // Валидация на сервере обязательна: типы TypeScript не проверяются в
  // рантайме, а значение приходит из клиентского компонента.
  //
  //  - currency идёт дальше ИМЕНЕМ КОЛОНКИ, поэтому «dust»/«coins» должны
  //    быть подтверждены явно, иначе произвольная строка выберет другую
  //    колонку той же таблицы;
  //  - amount складывается с балансом, поэтому NaN, Infinity и дробные
  //    значения писали бы в user_coins мусор, который потом ломает
  //    нормализацию экономики;
  //  - userId не проверялся, хотя в adminSetUserBan та же проверка есть.
  if (!USER_ID_PATTERN.test(String(userId ?? ""))) throw new Error("Некорректный user ID")
  if (currency !== "coins" && currency !== "dust") throw new Error("Некорректная валюта")
  if (typeof amount !== "number" || !Number.isSafeInteger(amount)) {
    throw new Error("Сумма должна быть целым числом")
  }
  if (amount === 0) return { success: true, balance: null }
  if (Math.abs(amount) > MAX_CURRENCY_GRANT) {
    throw new Error(`Сумма слишком велика (максимум ${MAX_CURRENCY_GRANT} за одну операцию)`)
  }

  const table = currency === "coins" ? "user_coins" : "user_dust"
  const column = currency

  // Get current
  const { data: current, error: fetchErr } = await supabase
    .from(table)
    .select(column)
    .eq("id", userId)
    .single()

  if (fetchErr && fetchErr.code !== "PGRST116") throw fetchErr

  const currentBalance = Number((current as any)?.[column] ?? 0) || 0
  const newBalance = Math.max(0, currentBalance + amount)

  const { error: upsertErr } = await supabase
    .from(table)
    .upsert({ id: userId, [column]: newBalance, updated_at: new Date().toISOString() }, { onConflict: "id" })

  if (upsertErr) throw upsertErr
  return { success: true, balance: newBalance }
}

// ============================================================
// CARDS: gift a card to a user via mail (letter with card attachment)
// ============================================================
export async function adminGiftCardToUser(userId: string, cardPayload: any, title?: string, body?: string) {
  return adminSendMail({
    userId,
    type: "card_gift",
    title: title ?? "Подарок: новая карта!",
    body: body ?? "Администрация подарила вам карту. Заберите её, чтобы добавить в коллекцию.",
    cardPayload,
    sender: "admin",
  })
}

export async function createGiftCardToken(cardPayload: unknown) {
  const supabase = await getAdminSupabase()
  const token = crypto.randomUUID().replace(/-/g, "")
  const { error } = await supabase.from("gift_card_tokens").insert({
    token,
    payload: cardPayload,
  })

  if (error) throw error
  return token
}

// ============================================================
// BANNERS (events) CRUD
// ============================================================
export interface BannerInput {
  name: string
  description?: string | null
  image_url?: string | null
  promo_image_url?: string | null
  featured_anime_ids?: number[]
  boosted_rarity?: string | null
  price?: number | null
  color?: string | null
  start_date?: string | null
  end_date?: string | null
  is_active?: boolean
  sort_order?: number
  guaranteed_card_payload?: any
  guaranteed_card_pity?: number
  guaranteed_cards_pool?: any[] | null
  banner_type?: string
}

export async function getBanners() {
  const supabase = await getAdminSupabase()
  const { data, error } = await supabase
    .from("banners")
    .select("*")
    .order("sort_order", { ascending: true })
  if (error) throw error
  return data
}

export async function createBanner(input: BannerInput) {
  const supabase = await getAdminSupabase()
  const { data, error } = await supabase
    .from("banners")
    .insert([{
      name: input.name,
      description: input.description ?? null,
      image_url: input.image_url ?? null,
      promo_image_url: input.promo_image_url ?? null,
      featured_anime_ids: input.featured_anime_ids ?? [],
      boosted_rarity: input.boosted_rarity ?? null,
      price: input.price ?? null,
      color: input.color ?? "from-purple-600 to-pink-700",
      start_date: input.start_date ?? new Date().toISOString(),
      end_date: input.end_date ?? null,
      is_active: input.is_active ?? true,
      sort_order: input.sort_order ?? 0,
      guaranteed_card_payload: input.guaranteed_card_payload ?? null,
      guaranteed_card_pity: input.guaranteed_card_pity ?? 0,
      guaranteed_cards_pool: input.guaranteed_cards_pool ?? null,
      banner_type: input.banner_type ?? 'standard',
    }] as any)
    .select()
    .single()
  if (error) throw error
  return data
}

/** Колонки banners, редактируемые из админки. id/created_at — нельзя. */
const BANNER_WRITABLE = [
  "name",
  "description",
  "image_url",
  "promo_image_url",
  "featured_anime_ids",
  "boosted_rarity",
  "price",
  "color",
  "start_date",
  "end_date",
  "is_active",
  "sort_order",
  "guaranteed_card_payload",
  "guaranteed_card_pity",
  "guaranteed_cards_pool",
  "banner_type",
] as const

export async function updateBanner(id: string, updates: Partial<BannerInput>) {
  const supabase = await getAdminSupabase()

  // Спред входного объекта позволял подменить колонки, которых нет в UI
  // (включая первичный ключ), поэтому фильтруем по белому списку.
  const writable = pickWritableFields(updates, BANNER_WRITABLE)
  if (Object.keys(writable).length === 0) throw new Error("Нет полей для обновления")

  const { data, error } = await supabase
    .from("banners")
    .update({ ...writable, updated_at: new Date().toISOString() } as any)
    .eq("id", id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteBanner(id: string) {
  const supabase = await getAdminSupabase()
  const { error } = await supabase.from("banners").delete().eq("id", id)
  if (error) throw error
  return { success: true }
}

// ============================================================
// BANNER CARDS: special/exclusive cards attached to a banner
// ============================================================
export interface BannerCardInput {
  bannerId: string
  cardPayload: any
  weight?: number
  isFeatured?: boolean
}

export async function getBannerCards(bannerId: string) {
  const supabase = await getAdminSupabase()
  const { data, error } = await supabase
    .from("banner_cards")
    .select("*")
    .eq("banner_id", bannerId)
    .order("created_at", { ascending: false })
  if (error) throw error
  return data
}

export async function addBannerCard(input: BannerCardInput) {
  const supabase = await getAdminSupabase()
  const { data, error } = await supabase
    .from("banner_cards")
    .insert([{
      banner_id: input.bannerId,
      card_payload: input.cardPayload,
      weight: input.weight ?? 1,
      is_featured: input.isFeatured ?? false,
    }])
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateBannerCard(id: string, updates: { weight?: number; is_featured?: boolean; card_payload?: any }) {
  const supabase = await getAdminSupabase()
  const { data, error } = await supabase
    .from("banner_cards")
    .update(updates)
    .eq("id", id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteBannerCard(id: string) {
  const supabase = await getAdminSupabase()
  const { error } = await supabase.from("banner_cards").delete().eq("id", id)
  if (error) throw error
  return { success: true }
}

// ============================================================
// Set a card as the guaranteed card of a banner with pity count
// ============================================================
export async function setBannerGuaranteedCard(bannerId: string, cardPayload: any, pity: number) {
  const supabase = await getAdminSupabase()
  const { data, error } = await supabase
    .from("banners")
    .update({
      guaranteed_card_payload: cardPayload,
      guaranteed_card_pity: pity,
      updated_at: new Date().toISOString(),
    } as any)
    .eq("id", bannerId)
    .select()
    .single()
  if (error) throw error
  return data
}

// ============================================================
// CARD PICKER: Search characters from Shikimori by anime IDs
// Returns ready-to-use card payloads for banner_cards
// ============================================================
export async function searchCharactersForBanner(animeIds: number[], query?: string) {
  const isAdmin = await checkAdminAuth()
  if (!isAdmin) throw new Error("Unauthorized")

  const results: any[] = []

  for (const animeId of animeIds) {
    try {
      const [animeRes, rolesRes] = await Promise.all([
        fetch(`https://shikimori.one/api/animes/${animeId}`),
        fetch(`https://shikimori.one/api/animes/${animeId}/roles`),
      ])

      if (!animeRes.ok || !rolesRes.ok) continue

      const anime = await animeRes.json()
      const roles = await rolesRes.json()

      const validChars = roles.filter((r: any) => {
        if (!r.character || !r.character.id || r.character.image.original.includes('missing')) return false
        if (query) {
          const q = query.toLowerCase()
          const name = (r.character.name || '').toLowerCase()
          const russian = (r.character.russian || '').toLowerCase()
          if (!name.includes(q) && !russian.includes(q)) return false
        }
        return true
      })

      for (const r of validChars) {
        const char = r.character
        const isMain = (r.roles || []).includes('Main') || (r.roles_ru || []).includes('Главный')
        const score = parseFloat(anime.score || "0")
        const originalUrl = char.image.original.startsWith("/")
          ? `https://shikimori.one${char.image.original}`
          : char.image.original

        results.push({
          name: char.russian || char.name,
          anime: anime.russian || anime.name,
          animeName: anime.russian || anime.name,
          score,
          rarity: "epic",
          shikiId: animeId,
          characterId: char.id,
          characterName: char.russian || char.name,
          imageUrl: originalUrl,
          originalUrl,
          isMainCharacter: isMain,
          stats: { hp: 50, atk: 50, def: 50, spd: 50, luck: 50 },
          serialId: `CST-${char.id}`,
          uniqueId: `picker-${char.id}-${Date.now()}`,
          orderIndex: Date.now() + char.id,
        })
      }
    } catch (e) {
      console.error(`[searchCharactersForBanner] Anime ${animeId} error:`, e)
    }
  }

  return results
}

// ============================================================
// CARD PICKER: Search all unique cards from user_cards table
// ============================================================
export async function searchUserCardsForBanner(query?: string, rarity?: string) {
  const isAdmin = await checkAdminAuth()
  if (!isAdmin) throw new Error("Unauthorized")

  const supabase = await getAdminSupabase()

  let dbQuery = supabase
    .from("user_cards")
    .select("name, anime, rarity, image_url, original_url, score, shiki_id, character_id, stats_hp, stats_atk, stats_def, stats_spd, stats_luck, is_main_character, serial_id, unique_id")

  if (rarity && rarity !== "all") {
    dbQuery = dbQuery.eq("rarity", rarity)
  }

  const { data, error } = await dbQuery.limit(200)

  if (error) throw error

  // Deduplicate by character_id
  const seen = new Set<number>()
  let cards = (data || []).filter((c: any) => {
    if (seen.has(c.character_id)) return false
    seen.add(c.character_id)
    return true
  })

  if (query) {
    const q = query.toLowerCase()
    cards = cards.filter((c: any) => {
      const name = (c.name || '').toLowerCase()
      const anime = (c.anime || '').toLowerCase()
      return name.includes(q) || anime.includes(q)
    })
  }

  return cards.map((c: any) => ({
    name: c.name,
    anime: c.anime,
    animeName: c.anime,
    score: parseFloat(c.score) || 0,
    rarity: c.rarity,
    shikiId: c.shiki_id,
    characterId: c.character_id,
    characterName: c.name,
    imageUrl: c.image_url,
    originalUrl: c.original_url,
    isMainCharacter: c.is_main_character,
    stats: {
      hp: c.stats_hp, atk: c.stats_atk, def: c.stats_def,
      spd: c.stats_spd, luck: c.stats_luck
    },
    serialId: c.serial_id,
    uniqueId: `picker-${c.unique_id}`,
    orderIndex: Date.now(),
  }))
}

// ============================================================
// PUSH NOTIFICATIONS: send to a single user or all users
// ============================================================
/**
 * Адрес, открываемый по клику на push-уведомление.
 *
 * Значение приходит из админки и попадает в public/sw.js → clients.openWindow(url).
 * Ограничиваемся путями нашего же сайта: произвольный внешний адрес здесь —
 * это готовая фишинговая ссылка, доставленная прямо в уведомление, плюс
 * возможность увести пользователя с домена через токен в URL.
 */
function sanitizePushUrl(url?: string): string {
  const raw = String(url ?? "").trim()
  if (!raw) return "/"
  if (!raw.startsWith("/")) return "/"
  // «//evil.com» и «/\evil.com» — браузер считает их схема-относительными.
  if (raw.startsWith("//") || raw.startsWith("/\\")) return "/"
  return raw.slice(0, 500)
}

export async function adminSendPushNotification(userId: string, title: string, body?: string, url?: string) {
  const supabase = await getAdminSupabase()

  const publicKey = process.env.VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY

  if (!publicKey || !privateKey) {
    throw new Error("VAPID keys not configured")
  }

  webpush.setVapidDetails("mailto:admin@weeb-x.com", publicKey, privateKey)

  const { data: subs, error } = await supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("user_id", assertUserId(userId))

  if (error) throw error
  if (!subs || subs.length === 0) {
    return { sent: 0, total: 0 }
  }

  const payload = JSON.stringify({
    title: clampText(title, 120),
    body: body ? clampText(body, 300) : undefined,
    data: { url: sanitizePushUrl(url) },
    tag: "admin-notification",
  })

  let sentCount = 0
  const failedEndpoints: string[] = []

  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload
      )
      sentCount++
    } catch (err: any) {
      if (err.statusCode === 410 || err.statusCode === 404) {
        failedEndpoints.push(sub.endpoint)
      }
    }
  }

  if (failedEndpoints.length > 0) {
    await supabase.from("push_subscriptions").delete().in("endpoint", failedEndpoints)
  }

  return { sent: sentCount, total: subs.length }
}

export async function adminSendPushNotificationBulk(userIds: string[], title: string, body?: string, url?: string) {
  const supabase = await getAdminSupabase()

  const publicKey = process.env.VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY

  if (!publicKey || !privateKey) {
    throw new Error("VAPID keys not configured")
  }

  // Список получателей приходит из клиента — фильтруем мусор и режем
  // размер, иначе .in() уходил с массивом произвольной длины.
  const recipientIds = Array.from(
    new Set(
      (Array.isArray(userIds) ? userIds : [])
        .map((id) => String(id).trim())
        .filter((id) => USER_ID_PATTERN.test(id)),
    ),
  ).slice(0, MAIL_BULK_MAX)

  if (recipientIds.length === 0) return { sent: 0, total: 0 }

  webpush.setVapidDetails("mailto:admin@weeb-x.com", publicKey, privateKey)

  const { data: subs, error } = await supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth, user_id")
    .in("user_id", recipientIds)

  if (error) throw error
  if (!subs || subs.length === 0) {
    return { sent: 0, total: 0 }
  }

  const payload = JSON.stringify({
    title: clampText(title, 120),
    body: body ? clampText(body, 300) : undefined,
    data: { url: sanitizePushUrl(url) },
    tag: "admin-notification",
  })

  let sentCount = 0
  const failedEndpoints: string[] = []

  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload
      )
      sentCount++
    } catch (err: any) {
      if (err.statusCode === 410 || err.statusCode === 404) {
        failedEndpoints.push(sub.endpoint)
      }
    }
  }

  if (failedEndpoints.length > 0) {
    await supabase.from("push_subscriptions").delete().in("endpoint", failedEndpoints)
  }

  return { sent: sentCount, total: subs.length }
}

// ============================================================
// Learning profiles
// ============================================================

// ============================================================
// CUSTOM NEWS CRUD
// ============================================================

export async function getCustomNews(page = 1, limit = 50) {
  const isAdmin = await checkAdminAuth()
  if (!isAdmin) throw new Error("Unauthorized")

  const supabase = await getAdminSupabase()
  // Аргументы приходят из клиента: без клампа один сформированный вручную
  // запрос читал всю таблицу новостей.
  const safeLimit = clampAdminLimit(limit, 50)
  const safePage = Math.min(Math.max(Number.isFinite(Number(page)) ? Math.trunc(Number(page)) : 1, 1), 10_000)
  const offset = (safePage - 1) * safeLimit

  const { data, error, count } = await supabase
    .from("custom_news")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + safeLimit - 1)

  if (error) throw error
  return { data: data || [], count: count || 0 }
}

export async function createCustomNews(news: { title: string; excerpt: string; body?: string | null; image_url?: string | null; author?: string | null; is_published?: boolean }) {
  const isAdmin = await checkAdminAuth()
  if (!isAdmin) throw new Error("Unauthorized")

  const supabase = await getAdminSupabase()
  const { data, error } = await supabase
    .from("custom_news")
    .insert([{
      title: news.title,
      excerpt: news.excerpt,
      body: news.body ? sanitizeNewsHtml(news.body) : null,
      image_url: news.image_url ?? null,
      author: news.author ?? null,
      is_published: news.is_published ?? false,
    }])
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateCustomNews(id: string, updates: { title?: string; excerpt?: string; body?: string | null; image_url?: string | null; author?: string | null; is_published?: boolean }) {
  const isAdmin = await checkAdminAuth()
  if (!isAdmin) throw new Error("Unauthorized")

  const supabase = await getAdminSupabase()
  const safeUpdates = {
    ...updates,
    ...(updates.body !== undefined
      ? { body: updates.body ? sanitizeNewsHtml(updates.body) : updates.body }
      : {}),
    updated_at: new Date().toISOString(),
  }
  const { data, error } = await supabase
    .from("custom_news")
    .update(safeUpdates)
    .eq("id", id)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function deleteCustomNews(id: string) {
  const isAdmin = await checkAdminAuth()
  if (!isAdmin) throw new Error("Unauthorized")

  const supabase = await getAdminSupabase()
  const { error } = await supabase
    .from("custom_news")
    .delete()
    .eq("id", id)

  if (error) throw error
  return { success: true }
}

export async function toggleCustomNewsPublished(id: string, currentStatus: boolean) {
  const isAdmin = await checkAdminAuth()
  if (!isAdmin) throw new Error("Unauthorized")

  const supabase = await getAdminSupabase()
  const { data, error } = await supabase
    .from("custom_news")
    .update({ is_published: !currentStatus, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function getPlayerLearningProfiles() {
  const supabase = await getAdminSupabase()
  const { data: stats, error } = await supabase
    .from("ai_learning_stats")
    .select("*")
    .order("total_battles", { ascending: false })

  if (error) throw error

  const userIds = (stats || []).map((s: any) => s.user_id).filter(Boolean)
  let userMap: Record<string, any> = {}
  if (userIds.length > 0) {
    const { data: users } = await supabase
      .from("profiles")
      .select("id, username, avatar_url")
      .in("id", userIds)
    userMap = Object.fromEntries((users || []).map((u: any) => [u.id, u]))
  }

  return (stats || []).map((s: any) => ({
    ...s,
    username: userMap[s.user_id]?.username || null,
    avatar_url: userMap[s.user_id]?.avatar_url || null,
  }))
}

/* ------------------------------------------------------------------ */
/* Чёрный список IP (защита от автосканеров и паразитных ботов)        */
/* ------------------------------------------------------------------ */

export interface IpBanRow {
  id: string
  target: string
  reason: string | null
  source: string
  created_at: string
}

export interface EditorialReviewRow {
  id: string
  anime_id: string
  content: string
  author: string
  created_at: string
  updated_at: string
}

const IP_TARGET_PATTERN = /^[0-9a-fA-F:.\[\]/]+$/

export async function getIpBans(): Promise<IpBanRow[]> {
  const supabase = await getAdminSupabase()
  const { data, error } = await supabase
    .from("ip_bans")
    .select("id, target, reason, source, created_at")
    .order("created_at", { ascending: false })
    .limit(5000)
  if (error) throw error
  return (data || []) as IpBanRow[]
}

export async function addIpBan(target: string, reason?: string): Promise<IpBanRow> {
  const supabase = await getAdminSupabase()

  const raw = String(target || "").trim()
  if (!raw || raw.length > 49 || !IP_TARGET_PATTERN.test(raw)) {
    throw new Error("Некорректный IP или подсеть")
  }
  const normalized = normalizeBlockTarget(raw)
  if (!normalized) throw new Error("Некорректный IP или подсеть")

  const cleanReason = reason?.trim() ? reason.trim().slice(0, 500) : null

  const { data, error } = await supabase
    .from("ip_bans")
    .insert({ target: normalized, reason: cleanReason, source: "admin" })
    .select("id, target, reason, source, created_at")
    .single()
  if (error) {
    if (String(error.message).includes("duplicate") || (error as { code?: string }).code === "23505") {
      throw new Error(`Запись ${normalized} уже есть в чёрном списке`)
    }
    throw error
  }
  return data as IpBanRow
}

export async function removeIpBan(id: string): Promise<void> {
  const supabase = await getAdminSupabase()
  if (!USER_ID_PATTERN.test(id)) throw new Error("Invalid request")
  const { error } = await supabase.from("ip_bans").delete().eq("id", id)
  if (error) throw error
}

export interface IpLookupResult {
  ip: string
  org: string | null
  asn: string | null
  city: string | null
  region: string | null
  country: string | null
  hostname: string | null
  isHostingLike: boolean
}

/** Подсети крупных хостингов — повод банить смелее. */
const HOSTING_ORG_MARKERS = [
  "hetzner", "selectel", "vdsina", "timeweb", "reg.ru", "beget", "ovh",
  "digitalocean", "linode", "akamai", "amazon", "aws", "google cloud",
  "google llc", "microsoft", "azure", "cloudflare", "hostkey", "aeza",
  "firstbyte", "justhost", "ihor", "ruvds", "masterhost", "jino",
  "contabo", "scaleway", "vultr", "ukfast", "ionos", "hostinger",
]

/**
 * Пробиваем IP через ipinfo.io (бесплатный режим без токена).
 * Оператор (org/ASN) сразу показывает, серверный это хостинг или
 * обычный провайдер — хостинг можно банить всей подсетью.
 */
export async function lookupIpInfo(ip: string): Promise<IpLookupResult> {
  const isAdmin = await checkAdminAuth()
  if (!isAdmin) throw new Error("Unauthorized")

  const raw = String(ip || "").trim()
  if (!isValidIp(raw)) throw new Error("Некорректный IP")

  const res = await fetch(`https://ipinfo.io/${encodeURIComponent(raw)}/json`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout?.(8000),
  })
  if (!res.ok) throw new Error(`ipinfo.io вернул ${res.status}`)
  const info = (await res.json()) as {
    ip?: string
    org?: string
    city?: string
    region?: string
    country?: string
    hostname?: string
  }

  const org = info.org?.trim() || null
  const orgLower = (org || "").toLowerCase()
  const asnMatch = orgLower.match(/^as\d+/)

  return {
    ip: info.ip || raw,
    org,
    asn: asnMatch ? asnMatch[0].toUpperCase() : null,
    city: info.city || null,
    region: info.region || null,
    country: info.country || null,
    hostname: info.hostname || null,
    isHostingLike: HOSTING_ORG_MARKERS.some((marker) => orgLower.includes(marker)),
  }
}

/** Быстрый бан подсети: /24 для IPv4 и /64 для IPv6. */
export async function addIpSubnetBan(ip: string, reason?: string): Promise<IpBanRow> {
  const subnet = subnetForIp(String(ip || "").trim())
  if (!subnet) throw new Error("Не удалось вычислить подсеть")
  return addIpBan(subnet, reason)
}

// ============================================================
// Мнения редакции (editorial_reviews)
// ============================================================
//
// Раньше вкладка писала в таблицу напрямую из браузера через anon-ключ
// Supabase (@/lib/supabase). Это означало две проблемы:
//
//  1. Авторизация держалась ТОЛЬКО на RLS таблицы, а миграции для
//     editorial_reviews в репозитории не было — её состояние нельзя было
//     проверить по коду.
//  2. Контент отсюда попадает на публичные страницы тайтлов через
//     parseInlineMarkdown, поэтому любой, кто мог писать в таблицу, мог
//     заplantить payload, исполнявшийся у всех посетителей.
//
// Теперь все три операции идут через server action с checkAdminAuth()
// (внутри getAdminSupabase), а таблица дополнительно закрыта RLS-миграцией:
// anon — только SELECT, запись исключительно через service_role.

const EDITORIAL_ANIME_ID_PATTERN = /^[0-9]{1,12}$/
const EDITORIAL_AUTHOR_MAX = 120
const EDITORIAL_CONTENT_MAX = 20_000

function assertEditorialAnimeId(value: unknown): string {
  const animeId = String(value ?? "").trim()
  if (!EDITORIAL_ANIME_ID_PATTERN.test(animeId)) {
    throw new Error("Некорректный Shikimori ID тайтла")
  }
  return animeId
}

function assertEditorialText(value: unknown, max: number, field: string): string {
  const text = String(value ?? "").trim()
  if (!text) throw new Error(`Поле «${field}» не может быть пустым`)
  if (text.length > max) {
    throw new Error(`Поле «${field}»: максимум ${max} символов (сейчас ${text.length})`)
  }
  return text
}

export async function getEditorialReviews() {
  const supabase = await getAdminSupabase()
  const { data, error } = await supabase
    .from("editorial_reviews")
    .select("id, anime_id, content, author, created_at, updated_at")
    .order("updated_at", { ascending: false })
    .limit(500)
  if (error) throw error
  return (data ?? []) as EditorialReviewRow[]
}

export async function upsertEditorialReview(input: {
  anime_id: string
  content: string
  author?: string
}) {
  const supabase = await getAdminSupabase()
  const animeId = assertEditorialAnimeId(input?.anime_id)
  const content = assertEditorialText(input?.content, EDITORIAL_CONTENT_MAX, "Текст мнения")
  const author = assertEditorialText(
    input?.author || "Редакция Weebx",
    EDITORIAL_AUTHOR_MAX,
    "Автор",
  )

  const { data, error } = await supabase
    .from("editorial_reviews")
    .upsert(
      { anime_id: animeId, content, author },
      { onConflict: "anime_id" },
    )
    .select("id, anime_id, content, author, created_at, updated_at")
    .single()
  if (error) throw error
  return data as EditorialReviewRow
}

export async function deleteEditorialReview(animeId: string) {
  const supabase = await getAdminSupabase()
  const id = assertEditorialAnimeId(animeId)
  const { error } = await supabase.from("editorial_reviews").delete().eq("anime_id", id)
  if (error) throw error
  return true
}
