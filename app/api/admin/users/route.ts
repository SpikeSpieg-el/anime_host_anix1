import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { ADMIN_AUTH_COOKIE, isValidAdminSession } from "@/lib/admin-auth"
import { getAdminUsers } from "@/app/admin/actions"

export async function GET() {
  const cookieStore = await cookies()
  if (!isValidAdminSession(cookieStore.get(ADMIN_AUTH_COOKIE)?.value)) {
    return NextResponse.json({ error: "Unauthorized: Admin authentication required" }, { status: 401 })
  }

  try {
    const users = await getAdminUsers()
    return NextResponse.json({ users }, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    console.error("[admin/users] failed to load users:", error)
    return NextResponse.json(
      { error: "Failed to fetch users data", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
