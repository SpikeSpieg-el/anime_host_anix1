"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { createClient } from "@supabase/supabase-js"
import webpush from "web-push"

const ADMIN_USERNAME = process.env.ADMIN_USERNAME
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD

export async function adminLogin(formData: FormData) {
  const username = formData.get("username") as string
  const password = formData.get("password") as string

  if (!username || !password) {
    return { error: "Введите логин и пароль" }
  }

  if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
    return { error: "Неверный логин или пароль" }
  }

  const cookieStore = await cookies()
  cookieStore.set("admin_auth", "true", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24, // 1 day
    path: "/",
  })

  redirect("/admin")
}

export async function adminLogout() {
  const cookieStore = await cookies()
  cookieStore.delete("admin_auth")
  redirect("/admin")
}

export async function checkAdminAuth(): Promise<boolean> {
  const cookieStore = await cookies()
  const adminAuth = cookieStore.get("admin_auth")?.value
  return adminAuth === "true"
}

export async function getAdminUsers() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Server misconfigured: Supabase env vars missing")
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("*")
    .order("updated_at", { ascending: false })

  if (profilesError) throw profilesError

  const { data: watchHistory, error: historyError } = await supabase
    .from("watch_history")
    .select("*")
    .order("timestamp", { ascending: false })

  if (historyError) throw historyError

  const { data: bookmarks, error: bookmarksError } = await supabase
    .from("bookmarks")
    .select("*")
    .order("created_at", { ascending: false })

  if (bookmarksError) throw bookmarksError

  const { data: aiStats, error: aiStatsError } = await supabase
    .from("ai_learning_stats")
    .select("*")

  if (aiStatsError) {
    console.error("Error fetching AI stats:", aiStatsError)
    // Don't throw - continue without AI stats if table doesn't exist yet
  }

  const usersWithStats = profiles.map((profile) => {
    const userHistory = watchHistory.filter((item) => item.user_id === profile.id)
    const userBookmarks = bookmarks.filter((item) => item.user_id === profile.id)
    const userAIStats = aiStats?.find((stat) => stat.user_id === profile.id) || null

    const lastActivity = [
      ...userHistory.map((h) => h.created_at),
      ...userBookmarks.map((b) => b.created_at),
      profile.updated_at,
    ]
      .filter(Boolean)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0]

    return {
      ...profile,
      watchHistoryCount: userHistory.length,
      bookmarksCount: userBookmarks.length,
      lastActivity,
      recentHistory: userHistory.slice(0, 5),
      recentBookmarks: userBookmarks.slice(0, 5),
      allHistory: userHistory,
      allBookmarks: userBookmarks,
      aiStats: userAIStats,
    }
  })

  return usersWithStats
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

// ============================================================
// Lightweight users list (for card-gifting / mail targeting)
// Returns: id, username, avatar_url, email, created_at
// ============================================================
export async function getAdminUsersSimple() {
  const supabase = await getAdminSupabase()

  // profiles table (note: profiles has no created_at column)
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, username, avatar_url, updated_at")
    .order("updated_at", { ascending: false, nullsFirst: false })

  if (profilesError) throw profilesError

  // auth.users emails (only accessible via service role through the auth schema)
  // Supabase exposes auth.users only via admin API; we try to fetch emails.
  const { data: usersAuth, error: authError } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  })

  const emailMap = new Map<string, string>()
  if (!authError && usersAuth?.users) {
    for (const u of usersAuth.users) {
      if (u.email) emailMap.set(u.id, u.email)
    }
  }

  return (profiles || []).map((p: any) => ({
    ...p,
    email: emailMap.get(p.id) ?? null,
  }))
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
