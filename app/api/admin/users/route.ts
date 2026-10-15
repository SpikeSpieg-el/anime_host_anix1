import { NextResponse, type NextRequest } from "next/server"
import { cookies } from "next/headers"
import { ADMIN_AUTH_COOKIE, isValidAdminSession } from "@/lib/admin-auth"
import { getRateLimitKey, rateLimiters } from "@/lib/rate-limit"
import { getAdminUsers } from "@/app/admin/actions"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const cookieStore = await cookies()
  if (!isValidAdminSession(cookieStore.get(ADMIN_AUTH_COOKIE)?.value)) {
    return NextResponse.json({ error: "Unauthorized: Admin authentication required" }, { status: 401 })
  }

  // getAdminUsers() подтягивает ВСЕ таблицы profiles/watch_history/bookmarks
  // постранично и прогоняет через auth.admin.listUsers(). Без ограничения
  // один вызов (а у злоумышленника с украденной сессией их может быть много
  // параллельно) превращался в тяжёлый запрос ко всей базе. Адрес, который
  // определить не удалось, ограничение пропускает — см. getRateLimitKey.
  const limitKey = getRateLimitKey(request)
  if (limitKey) {
    const limit = rateLimiters.strict.checkLimit(`admin-users:${limitKey}`)
    if (!limit.success) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429, headers: { "Retry-After": String(Math.ceil((limit.reset - Date.now()) / 1000)) } },
      )
    }
  }

  try {
    const users = await getAdminUsers()
    return NextResponse.json({ users }, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    // Детали ошибки уходят в лог, а не в ответ: текст message от Supabase
    // раскрывает имена таблиц, колонок и детали подключения.
    console.error("[admin/users] failed to load users:", error)
    return NextResponse.json({ error: "Failed to fetch users data" }, { status: 500 })
  }
}