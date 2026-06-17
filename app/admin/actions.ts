"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { createClient } from "@supabase/supabase-js"

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
    .select(`
      *,
      player1:profiles!player1_id(username, avatar_url),
      player2:profiles!player2_id(username, avatar_url)
    `)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) throw error
  return data
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
