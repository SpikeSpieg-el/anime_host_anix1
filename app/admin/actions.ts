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

  const usersWithStats = profiles.map((profile) => {
    const userHistory = watchHistory.filter((item) => item.user_id === profile.id)
    const userBookmarks = bookmarks.filter((item) => item.user_id === profile.id)

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
    }
  })

  return usersWithStats
}
