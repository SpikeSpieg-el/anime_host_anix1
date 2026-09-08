/**
 * Реестр страниц сайта.
 *
 * Когда добавляете новую страницу:
 *  1. Добавьте запись сюда.
 *  2. Если страница публичная — она автоматически попадёт в E2E smoke.
 *  3. Тест inventory/completeness упадёт, если page.tsx появился, а записи нет.
 */

export type PageAuth = "public" | "optional" | "required" | "admin"

export interface PageRegistryEntry {
  /** App Router path, динамические сегменты как :id */
  route: string
  name: string
  auth: PageAuth
  /** Реальный URL для E2E (без динамических параметров). null = не открывать в smoke. */
  smokePath: string | null
  notes?: string
}

export const PAGES: PageRegistryEntry[] = [
  { route: "/", name: "Главная", auth: "public", smokePath: "/" },
  { route: "/catalog", name: "Каталог", auth: "public", smokePath: "/catalog" },
  { route: "/search", name: "Поиск", auth: "public", smokePath: "/search" },
  { route: "/schedule", name: "Расписание", auth: "public", smokePath: "/schedule" },
  { route: "/news", name: "Новости", auth: "public", smokePath: "/news" },
  { route: "/news/:id", name: "Новость", auth: "public", smokePath: null, notes: "динамическая" },
  { route: "/manga", name: "Манга", auth: "public", smokePath: "/manga" },
  { route: "/manga/:id", name: "Манга — тайтл", auth: "public", smokePath: null, notes: "динамическая" },
  { route: "/watch/:id", name: "Просмотр", auth: "public", smokePath: null, notes: "динамическая" },
  { route: "/bookmarks", name: "Закладки", auth: "optional", smokePath: "/bookmarks" },
  { route: "/history", name: "История", auth: "optional", smokePath: "/history" },
  { route: "/gacha", name: "Гача", auth: "optional", smokePath: "/gacha" },
  { route: "/battle", name: "PVE бои", auth: "optional", smokePath: "/battle" },
  { route: "/pvp", name: "PvP", auth: "optional", smokePath: "/pvp" },
  { route: "/beginners", name: "Для новичков", auth: "public", smokePath: "/beginners" },
  { route: "/settings", name: "Настройки", auth: "optional", smokePath: "/settings" },
  { route: "/contacts", name: "Контакты", auth: "public", smokePath: "/contacts" },
  { route: "/dmca", name: "DMCA", auth: "public", smokePath: "/dmca" },
  { route: "/faq", name: "FAQ", auth: "public", smokePath: "/faq" },
  { route: "/help", name: "Помощь", auth: "public", smokePath: "/help" },
  { route: "/privacy", name: "Политика конфиденциальности", auth: "public", smokePath: "/privacy" },
  { route: "/terms", name: "Условия использования", auth: "public", smokePath: "/terms" },
  { route: "/easter-eggs", name: "Пасхалки", auth: "public", smokePath: "/easter-eggs" },
  { route: "/market-dashboard", name: "Дашборд рынка", auth: "optional", smokePath: "/market-dashboard" },
  { route: "/account-stats", name: "Статистика аккаунта", auth: "required", smokePath: "/account-stats" },
  { route: "/activate", name: "Активация Lampa", auth: "public", smokePath: "/activate" },
  { route: "/auth/register", name: "Регистрация", auth: "public", smokePath: "/auth/register" },
  { route: "/reset-password", name: "Сброс пароля", auth: "public", smokePath: "/reset-password" },
  { route: "/admin", name: "Админ-панель", auth: "admin", smokePath: "/admin" },
  { route: "/admin/card-editor", name: "Редактор карт", auth: "admin", smokePath: null },
  { route: "/admin/tutorial", name: "Админ туториал", auth: "admin", smokePath: null },
  { route: "/test-search", name: "Тестовый поиск", auth: "public", smokePath: "/test-search", notes: "dev/test page" },
]

export const SMOKE_PAGES = PAGES.filter((p) => p.smokePath)

export const LEGAL_PAGES = PAGES.filter((p) =>
  ["/privacy", "/terms", "/dmca", "/faq", "/help", "/contacts"].includes(p.route),
)
