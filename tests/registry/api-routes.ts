/**
 * Реестр API-роутов.
 *
 * Когда добавляете новый app/api/.../route.ts:
 *  1. Добавьте запись сюда (path, methods, auth).
 *  2. Тест inventory упадёт, если файл есть, а записи нет.
 *  3. Если эндпоинт должен быть закрыт — поставьте auth: "bearer".
 */

export type ApiAuth = "public" | "bearer" | "admin" | "mixed"

export interface ApiRegistryEntry {
  path: string
  methods: Array<"GET" | "POST" | "PUT" | "PATCH" | "DELETE">
  auth: ApiAuth
  notes?: string
}

export const API_ROUTES: ApiRegistryEntry[] = [
  { path: "/api/admin/test", methods: ["GET"], auth: "admin" },
  { path: "/api/admin/users", methods: ["GET"], auth: "admin" },
  { path: "/api/anime-batch", methods: ["GET"], auth: "public" },
  { path: "/api/anime/:id", methods: ["GET"], auth: "public" },
  { path: "/api/anime/catalog", methods: ["GET"], auth: "public" },
  { path: "/api/anime/search", methods: ["GET"], auth: "public" },
  { path: "/api/auth/forgot-password", methods: ["POST"], auth: "public" },
  { path: "/api/backdrops", methods: ["GET"], auth: "public" },
  { path: "/api/banners", methods: ["GET"], auth: "public" },
  { path: "/api/banners/pulls", methods: ["GET"], auth: "bearer" },
  { path: "/api/battle-backgrounds", methods: ["GET"], auth: "public" },
  { path: "/api/battle", methods: ["GET", "POST"], auth: "bearer" },
  { path: "/api/battle/deck", methods: ["GET", "POST"], auth: "bearer" },
  { path: "/api/battle/presets", methods: ["GET", "POST", "DELETE"], auth: "bearer" },
  { path: "/api/card/change-art", methods: ["POST"], auth: "bearer" },
  { path: "/api/card/update-art-position", methods: ["POST"], auth: "bearer" },
  { path: "/api/cards", methods: ["GET", "POST", "DELETE"], auth: "bearer" },
  { path: "/api/coins", methods: ["GET", "POST"], auth: "bearer" },
  { path: "/api/dust", methods: ["GET", "POST"], auth: "bearer" },
  { path: "/api/gacha/spin-art", methods: ["POST"], auth: "public", notes: "поиск арта, без сессии" },
  { path: "/api/gift/claim", methods: ["POST"], auth: "bearer" },
  { path: "/api/hentasis", methods: ["GET"], auth: "public" },
  { path: "/api/hero-recommendation", methods: ["GET"], auth: "public" },
  { path: "/api/home-data", methods: ["GET"], auth: "public" },
  { path: "/api/image-proxy", methods: ["GET"], auth: "public" },
  { path: "/api/kodik/player-proxy", methods: ["GET"], auth: "public" },
  { path: "/api/kodik/translations", methods: ["GET"], auth: "public" },
  { path: "/api/lampa/activate", methods: ["GET", "POST"], auth: "mixed", notes: "внешняя интеграция, CSRF exempt" },
  { path: "/api/lampa/authorize", methods: ["POST"], auth: "mixed" },
  { path: "/api/lampa/bookmarks", methods: ["GET", "POST", "DELETE"], auth: "mixed" },
  { path: "/api/lampa/devices", methods: ["GET", "DELETE"], auth: "mixed" },
  { path: "/api/lampa/history", methods: ["GET"], auth: "mixed" },
  { path: "/api/lampa/sync", methods: ["POST"], auth: "mixed" },
  { path: "/api/mail", methods: ["GET", "POST"], auth: "bearer" },
  { path: "/api/manga/comick", methods: ["GET"], auth: "public" },
  { path: "/api/manga/info", methods: ["GET"], auth: "public" },
  { path: "/api/manga/mangaeden", methods: ["GET"], auth: "public" },
  { path: "/api/manga/mangalib", methods: ["GET"], auth: "public" },
  { path: "/api/manga/popular", methods: ["GET"], auth: "public" },
  { path: "/api/manga/read", methods: ["GET"], auth: "public" },
  { path: "/api/manga/recent", methods: ["GET"], auth: "public" },
  { path: "/api/manga/search", methods: ["GET"], auth: "public" },
  { path: "/api/market/analytics", methods: ["GET"], auth: "public" },
  { path: "/api/market/buy", methods: ["POST"], auth: "bearer" },
  { path: "/api/market/cancel", methods: ["POST"], auth: "bearer" },
  { path: "/api/market/list", methods: ["POST"], auth: "bearer" },
  { path: "/api/market/listings", methods: ["GET"], auth: "public" },
  { path: "/api/market/price-stats", methods: ["GET"], auth: "public" },
  { path: "/api/market/release", methods: ["POST"], auth: "bearer" },
  { path: "/api/market/reserve", methods: ["POST"], auth: "bearer" },
  { path: "/api/market/sales-history", methods: ["GET"], auth: "public" },
  { path: "/api/market/suggested-price", methods: ["POST"], auth: "public" },
  { path: "/api/pity", methods: ["GET", "POST"], auth: "bearer" },
  { path: "/api/posters", methods: ["POST"], auth: "public" },
  { path: "/api/profile", methods: ["GET"], auth: "bearer" },
  { path: "/api/profile/update", methods: ["POST"], auth: "bearer" },
  { path: "/api/proxy/image", methods: ["GET"], auth: "public" },
  { path: "/api/proxy/video", methods: ["GET"], auth: "public" },
  { path: "/api/push/send", methods: ["POST"], auth: "admin" },
  { path: "/api/push/subscribe", methods: ["POST"], auth: "bearer" },
  { path: "/api/push/unsubscribe", methods: ["POST"], auth: "bearer" },
  { path: "/api/push/vapid-public-key", methods: ["GET"], auth: "public" },
  { path: "/api/recommendations/ai-generate", methods: ["POST"], auth: "public" },
  { path: "/api/recommendations/search-anime", methods: ["POST"], auth: "public" },
  { path: "/api/recommendations/user-data", methods: ["GET"], auth: "bearer" },
  { path: "/api/recommendations/web-search", methods: ["POST"], auth: "public" },
  { path: "/api/referrals", methods: ["POST"], auth: "bearer" },
  { path: "/api/region", methods: ["GET"], auth: "public" },
  { path: "/api/translate", methods: ["POST"], auth: "public" },
  { path: "/api/vk-video", methods: ["GET"], auth: "public" },
]

export const AUTH_REQUIRED_API = API_ROUTES.filter((r) => r.auth === "bearer" || r.auth === "admin")
