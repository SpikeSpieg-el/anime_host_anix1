"use server"

import { cookies, headers } from "next/headers"
import { redirect } from "next/navigation"
import { createHash } from "node:crypto"
import { createClient } from "@supabase/supabase-js"
import webpush from "web-push"
import { ADMIN_AUTH_COOKIE, ADMIN_SESSION_TTL_SECONDS, constantTimeStringEqual, consumeAdminTotp, createAdminSessionToken, getAdminAuthConfigurationError, isAdminTotpRequired, isValidAdminSession } from "@/lib/admin-auth"
import { rateLimiters } from "@/lib/rate-limit"
import { sanitizeNewsHtml } from "@/lib/news/sanitize-html"

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
  const clientIp = (
    requestHeaders.get("cf-connecting-ip") ||
    requestHeaders.get("x-real-ip") ||
    requestHeaders.get("x-forwarded-for")?.split(",")[0] ||
    "unknown"
  ).trim().slice(0, 128)
  const allowlistedIps = (process.env.ADMIN_ALLOWED_IPS || "")
    .split(",")
    .map((ip) => ip.trim())
    .filter(Boolean)
  if (allowlistedIps.length > 0 && !allowlistedIps.includes(clientIp)) {
    return { error: "Неверные данные для входа." }
  }

  // Process-local throttling is a backstop. Production should also rate-limit
  // /admin at its trusted CDN/WAF so attempts are capped across instances.
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
    fetchAllPages<any>((from, to) => supabase
      .from("profiles")
      .select("*")
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

export async function updatePvPRule(id: string, updates: any) {
  const isAdmin = await checkAdminAuth()
  if (!isAdmin) throw new Error("Unauthorized")

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabase = createClient(supabaseUrl!, supabaseServiceKey!)

  const { error } = await supabase
    .from("pvp_rules")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)

  if (error) throw error
  return { success: true }
}

export async function getPvPLogs(limit = 100) {
  const isAdmin = await checkAdminAuth()
  if (!isAdmin) throw new Error("Unauthorized")

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabase = createClient(supabaseUrl!, supabaseServiceKey!)

  const { data, error } = await supabase
    .from("pvp_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit)

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

export async function getPvPLocations() {
  const isAdmin = await checkAdminAuth()
  if (!isAdmin) throw new Error("Unauthorized")

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabase = createClient(supabaseUrl!, supabaseServiceKey!)

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

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabase = createClient(supabaseUrl!, supabaseServiceKey!)

  const { data, error } = await supabase
    .from("pvp_locations")
    .insert([location])
    .select()
    .single()

  if (error) throw error

  if (ruleIds.length > 0) {
    const { error: rulesError } = await supabase
      .from("pvp_location_rules")
      .insert(ruleIds.map(ruleId => ({
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

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabase = createClient(supabaseUrl!, supabaseServiceKey!)

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

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabase = createClient(supabaseUrl!, supabaseServiceKey!)

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

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabase = createClient(supabaseUrl!, supabaseServiceKey!)

  const { data, error } = await supabase
    .from("battle_backgrounds")
    .insert([{
      ...bg,
      scale: bg.scale ?? 1.0,
      position_x: bg.position_x ?? 50.0,
      position_y: bg.position_y ?? 50.0,
      opacity: bg.opacity ?? 0.35,
    }])
    .select()
    .single()

  if (error) throw error
  return data
}

export async function deleteBattleBackground(id: string) {
  const isAdmin = await checkAdminAuth()
  if (!isAdmin) throw new Error("Unauthorized")

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabase = createClient(supabaseUrl!, supabaseServiceKey!)

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

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabase = createClient(supabaseUrl!, supabaseServiceKey!)

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

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabase = createClient(supabaseUrl!, supabaseServiceKey!)

  const { data, error } = await supabase
    .from("battle_backgrounds")
    .update(updates)
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

export async function adminSendMail(input: AdminMailInput) {
  const supabase = await getAdminSupabase()

  const row: any = {
    user_id: input.userId,
    sender: input.sender ?? "admin",
    type: input.type,
    title: input.title,
    body: input.body ?? null,
    card_payload: input.cardPayload ?? null,
    amount: input.amount ?? 0,
    is_read: false,
    is_claimed: false,
  }
  if (input.expiresAt) row.expires_at = input.expiresAt

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

  const rows = input.userIds.map((userId) => ({
    user_id: userId,
    sender: input.sender ?? "admin",
    type: input.type,
    title: input.title,
    body: input.body ?? null,
    card_payload: input.cardPayload ?? null,
    amount: input.amount ?? 0,
    is_read: false,
    is_claimed: false,
    ...(input.expiresAt ? { expires_at: input.expiresAt } : {}),
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
    await adminSendPushNotificationBulk(input.userIds, pushTitle, pushBody, "/gacha")
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
  if (amount === 0) return { success: true, balance: null }

  const table = currency === "coins" ? "user_coins" : "user_dust"
  const column = currency

  // Get current
  const { data: current, error: fetchErr } = await supabase
    .from(table)
    .select(column)
    .eq("id", userId)
    .single()

  if (fetchErr && fetchErr.code !== "PGRST116") throw fetchErr

  const currentBalance = (current as any)?.[column] ?? 0
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

export async function updateBanner(id: string, updates: Partial<BannerInput>) {
  const supabase = await getAdminSupabase()
  const { data, error } = await supabase
    .from("banners")
    .update({ ...updates, updated_at: new Date().toISOString() } as any)
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
    .eq("user_id", userId)

  if (error) throw error
  if (!subs || subs.length === 0) {
    return { sent: 0, total: 0 }
  }

  const payload = JSON.stringify({
    title,
    body,
    data: { url: url || "/" },
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

  webpush.setVapidDetails("mailto:admin@weeb-x.com", publicKey, privateKey)

  const { data: subs, error } = await supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth, user_id")
    .in("user_id", userIds)

  if (error) throw error
  if (!subs || subs.length === 0) {
    return { sent: 0, total: 0 }
  }

  const payload = JSON.stringify({
    title,
    body,
    data: { url: url || "/" },
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
  const offset = (page - 1) * limit

  const { data, error, count } = await supabase
    .from("custom_news")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1)

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
