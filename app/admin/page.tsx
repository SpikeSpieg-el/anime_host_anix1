"use client"

import { useEffect, useState, useTransition } from "react"
import { LogOut, Lock } from "lucide-react"
import { ScrollToTop } from "@/components/layout/scroll-to-top"
import { Footer } from "@/components/layout/footer"
import { adminLogin, adminLogout, checkAdminAuth, getAdminUsers, getPvPRules, updatePvPRule, getPvPLocations, createPvPLocation, deletePvPLocation, getPvPLogs, getBattleAIDashboard, getAdminUsersSimple, getBanners, createBanner, updateBanner, deleteBanner, getBannerCards, addBannerCard, updateBannerCard, deleteBannerCard, adminSendMail, adminSendMailBulk, adminGiftCardToUser, adminSendPushNotification, adminSendPushNotificationBulk, getPlayerLearningProfiles, getBattleBackgrounds, createBattleBackground, deleteBattleBackground, toggleBattleBackground, updateBattleBackground } from "./actions"
import type { Rarity } from "@/types/gacha"
import { toast } from "sonner"

import type { AdminTab, UserWithStats, PvPRule, PvPLocation, PvPLog, SimpleUser, Banner, BannerCard, BattleAIDashboard, MailType, BattleBackground } from "./components/types"
import { AdminTabs } from "./components/AdminTabs"
import { UsersTab } from "./components/UsersTab"
import { PvPTab } from "./components/PvPTab"
import { AIBattleTab } from "./components/AIBattleTab"
import { BattleLogsTab } from "./components/BattleLogsTab"
import { CardsTab } from "./components/CardsTab"
import { MailTab } from "./components/MailTab"
import { EventsTab } from "./components/EventsTab"
import { TutorialTab } from "./components/TutorialTab"

interface BannerFormData {
  name: string
  description: string
  image_url: string
  promo_image_url: string
  featured_anime_ids: string
  boosted_rarity: Rarity | ""
  price: string
  color: string
  start_date: string
  end_date: string
  is_active: boolean
  sort_order: number
  guaranteed_card_json: string
  guaranteed_card_pity: string
  guaranteed_cards_pool_json: string
  banner_type: "standard" | "dynamic"
}

const DEFAULT_BANNER_FORM: BannerFormData = {
  name: "", description: "", image_url: "", promo_image_url: "", featured_anime_ids: "",
  boosted_rarity: "", price: "", color: "from-purple-600 to-pink-700",
  start_date: "", end_date: "", is_active: true, sort_order: 0,
  guaranteed_card_json: "", guaranteed_card_pity: "", guaranteed_cards_pool_json: "",
  banner_type: "standard",
}

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<AdminTab>('users')
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [authError, setAuthError] = useState("")
  const [isPending, startTransition] = useTransition()

  const [users, setUsers] = useState<UserWithStats[]>([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedUser, setSelectedUser] = useState<UserWithStats | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showAllHistory, setShowAllHistory] = useState(false)
  const [showAllBookmarks, setShowAllBookmarks] = useState(false)

  const [pvpRules, setPvPRules] = useState<PvPRule[]>([])
  const [pvpLocations, setPvPLocations] = useState<PvPLocation[]>([])
  const [isPvPLoading, setIsPvPLoading] = useState(false)
  const [showAddLocation, setShowAddLocation] = useState(false)
  const [newLocation, setNewLocation] = useState({ name: '', name_ru: '', description: '', description_ru: '', is_empty: false })
  const [selectedRuleIds, setSelectedRuleIds] = useState<string[]>([])

  const [battleBackgrounds, setBattleBackgrounds] = useState<BattleBackground[]>([])
  const [pvpLogs, setPvPLogs] = useState<PvPLog[]>([])
  const [isLogsLoading, setIsLogsLoading] = useState(false)
  const [logsLoaded, setLogsLoaded] = useState(false)
  const [logsError, setLogsError] = useState<string | null>(null)
  const [battleAIDashboard, setBattleAIDashboard] = useState<BattleAIDashboard | null>(null)
  const [isBattleAILoading, setIsBattleAILoading] = useState(false)
  const [battleAIError, setBattleAIError] = useState<string | null>(null)
  const [learningProfiles, setLearningProfiles] = useState<any[]>([])
  const [isMlLoading, setIsMlLoading] = useState(false)

  const [simpleUsers, setSimpleUsers] = useState<SimpleUser[]>([])
  const [mailTargetUserId, setMailTargetUserId] = useState<string>("")
  const [mailType, setMailType] = useState<MailType>("message")
  const [mailTitle, setMailTitle] = useState("")
  const [mailBody, setMailBody] = useState("")
  const [mailAmount, setMailAmount] = useState<number>(0)
  const [mailCardJson, setMailCardJson] = useState("")
  const [isMailSending, setIsMailSending] = useState(false)
  const [mailLoaded, setMailLoaded] = useState(false)

  const [pushTargetUserId, setPushTargetUserId] = useState<string>("")
  const [pushTitle, setPushTitle] = useState("")
  const [pushBody, setPushBody] = useState("")
  const [pushUrl, setPushUrl] = useState("")
  const [isPushSending, setIsPushSending] = useState(false)

  const [banners, setBanners] = useState<Banner[]>([])
  const [isBannersLoading, setIsBannersLoading] = useState(false)
  const [bannersLoaded, setBannersLoaded] = useState(false)
  const [showCreateBanner, setShowCreateBanner] = useState(false)
  const [newBanner, setNewBanner] = useState<BannerFormData>(DEFAULT_BANNER_FORM)
  const [editingBannerId, setEditingBannerId] = useState<string | null>(null)
  const [expandedBannerId, setExpandedBannerId] = useState<string | null>(null)
  const [editBanner, setEditBanner] = useState<BannerFormData | null>(null)
  const [bannerCards, setBannerCards] = useState<Record<string, BannerCard[]>>({})
  const [bannerCardsLoading, setBannerCardsLoading] = useState<string | null>(null)
  const [newBannerCardJson, setNewBannerCardJson] = useState<Record<string, string>>({})
  const [newBannerCardWeight, setNewBannerCardWeight] = useState<Record<string, number>>({})
  const [newBannerCardFeatured, setNewBannerCardFeatured] = useState<Record<string, boolean>>({})

  useEffect(() => {
    checkAdminAuth().then((authenticated) => {
      setIsAuthenticated(authenticated)
      if (authenticated) {
        fetchUsers()
        fetchPvPData()
        fetchPvPLogs()
        fetchBattleBackgrounds()
      }
    })
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    startTransition(async () => {
      const formData = new FormData()
      formData.set("username", username)
      formData.set("password", password)
      const result = await adminLogin(formData)
      if (result?.error) {
        setAuthError(result.error)
      } else {
        setAuthError("")
        setIsAuthenticated(true)
        fetchUsers()
      }
    })
  }

  const handleLogout = async () => {
    await adminLogout()
    setIsAuthenticated(false)
    setUsers([])
  }

  const fetchUsers = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await getAdminUsers()
      setUsers(data)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to load users data"
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const fetchPvPData = async () => {
    try {
      setIsPvPLoading(true)
      const [rules, locations] = await Promise.all([getPvPRules(), getPvPLocations()])
      setPvPRules(rules)
      setPvPLocations(locations)
    } catch (err) {
      console.error("Failed to fetch PvP data:", err)
    } finally {
      setIsPvPLoading(false)
    }
  }

  const fetchPvPLogs = async () => {
    try {
      setIsLogsLoading(true)
      setLogsError(null)
      const logs = await getPvPLogs()
      setPvPLogs(logs)
      setLogsLoaded(true)
    } catch (err) {
      console.error("Failed to fetch PvP logs:", err)
      setLogsError(err instanceof Error ? err.message : 'Не удалось загрузить логи')
      toast.error("Не удалось загрузить логи PvP-битв")
    } finally {
      setIsLogsLoading(false)
    }
  }

  const fetchBattleAIDashboard = async () => {
    try {
      setIsBattleAILoading(true)
      setBattleAIError(null)
      const data = await getBattleAIDashboard()
      setBattleAIDashboard(data as BattleAIDashboard)
    } catch (err) {
      console.error("Failed to fetch battle AI dashboard:", err)
      setBattleAIError(err instanceof Error ? err.message : "Не удалось загрузить AI-метрики")
    } finally {
      setIsBattleAILoading(false)
    }
  }

  const fetchMLData = async () => {
    try {
      setIsMlLoading(true)
      const [profiles] = await Promise.all([getPlayerLearningProfiles()])
      setLearningProfiles(profiles)
    } catch (err) {
      console.error("Failed to fetch ML data:", err)
    } finally {
      setIsMlLoading(false)
    }
  }

  const fetchSimpleUsers = async () => {
    try {
      const data = await getAdminUsersSimple()
      setSimpleUsers(data as SimpleUser[])
      setMailLoaded(true)
    } catch (err) {
      console.error("Failed to fetch simple users:", err)
      toast.error("Не удалось загрузить список пользователей")
    }
  }

  const fetchBanners = async () => {
    try {
      setIsBannersLoading(true)
      const data = await getBanners()
      setBanners(data as Banner[])
      setBannersLoaded(true)
    } catch (err) {
      console.error("Failed to fetch banners:", err)
      toast.error("Не удалось загрузить баннеры")
    } finally {
      setIsBannersLoading(false)
    }
  }

  const fetchBannerCards = async (bannerId: string) => {
    try {
      setBannerCardsLoading(bannerId)
      const data = await getBannerCards(bannerId)
      setBannerCards(prev => ({ ...prev, [bannerId]: data as BannerCard[] }))
    } catch (err) {
      console.error("Failed to fetch banner cards:", err)
      toast.error("Не удалось загрузить карты баннера")
    } finally {
      setBannerCardsLoading(null)
    }
  }

  useEffect(() => {
    if (activeTab === 'mail' && !mailLoaded && isAuthenticated) fetchSimpleUsers()
    if (activeTab === 'events' && !bannersLoaded && isAuthenticated) fetchBanners()
    if (activeTab === 'battle_logs' && !logsLoaded && isAuthenticated) fetchPvPLogs()
    if (activeTab === 'ai_battle' && !battleAIDashboard && isAuthenticated) fetchBattleAIDashboard()
    if (activeTab === 'ai_battle' && isAuthenticated) fetchMLData()
  }, [activeTab, isAuthenticated, mailLoaded, bannersLoaded, logsLoaded, battleAIDashboard])

  const handleToggleRule = async (id: string, currentStatus: boolean) => {
    try {
      await updatePvPRule(id, { is_active: !currentStatus })
      setPvPRules(prev => prev.map(r => r.id === id ? { ...r, is_active: !currentStatus } : r))
    } catch (err) {
      console.error("Failed to toggle rule:", err)
    }
  }

  const handleDeleteLocation = async (id: string) => {
    if (!confirm("Вы уверены, что хотите удалить эту локацию?")) return
    try {
      await deletePvPLocation(id)
      setPvPLocations(prev => prev.filter(l => l.id !== id))
    } catch (err) {
      console.error("Failed to delete location:", err)
    }
  }

  const fetchBattleBackgrounds = async () => {
    try {
      const data = await getBattleBackgrounds()
      setBattleBackgrounds(data)
    } catch (err) {
      console.error("Failed to fetch battle backgrounds:", err)
    }
  }

  const handleAddBackground = async (bg: { name: string; image_url: string; mode: string; scale: number; position_x: number; position_y: number; opacity: number }) => {
    try {
      const created = await createBattleBackground({ ...bg, is_active: true, sort_order: 0 })
      setBattleBackgrounds(prev => [...prev, created])
      toast.success("Фон добавлен")
    } catch (err) {
      console.error("Failed to create background:", err)
      toast.error("Ошибка добавления фона")
    }
  }

  const handleDeleteBackground = async (id: string) => {
    if (!confirm("Удалить этот фон?")) return
    try {
      await deleteBattleBackground(id)
      setBattleBackgrounds(prev => prev.filter(b => b.id !== id))
      toast.success("Фон удалён")
    } catch (err) {
      console.error("Failed to delete background:", err)
      toast.error("Ошибка удаления фона")
    }
  }

  const handleToggleBackground = async (id: string, currentStatus: boolean) => {
    try {
      await toggleBattleBackground(id, currentStatus)
      setBattleBackgrounds(prev => prev.map(b => b.id === id ? { ...b, is_active: !currentStatus } : b))
    } catch (err) {
      console.error("Failed to toggle background:", err)
    }
  }

  const handleUpdateBackground = async (id: string, updates: { name?: string; image_url?: string; mode?: string; scale?: number; position_x?: number; position_y?: number; opacity?: number }) => {
    try {
      const updated = await updateBattleBackground(id, updates)
      setBattleBackgrounds(prev => prev.map(b => b.id === id ? { ...b, ...updated } : b))
      toast.success("Фон обновлён")
    } catch (err) {
      console.error("Failed to update background:", err)
      toast.error("Ошибка обновления фона")
    }
  }

  const handleCreateLocation = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const location = await createPvPLocation(newLocation, selectedRuleIds)
      setPvPLocations(prev => [location, ...prev])
      setShowAddLocation(false)
      setNewLocation({ name: '', name_ru: '', description: '', description_ru: '', is_empty: false })
      setSelectedRuleIds([])
    } catch (err) {
      console.error("Failed to create location:", err)
    }
  }

  const handleSendMail = async () => {
    if (!mailTargetUserId) { toast.error("Выберите получателя"); return }
    if (!mailTitle.trim()) { toast.error("Введите заголовок"); return }
    try {
      setIsMailSending(true)
      if (mailType === "card_gift") {
        let cardPayload: any = null
        if (mailCardJson.trim()) {
          try { cardPayload = JSON.parse(mailCardJson) } catch { toast.error("Неверный JSON карты"); setIsMailSending(false); return }
        } else { toast.error("Вставьте JSON карты для подарка"); setIsMailSending(false); return }
        await adminGiftCardToUser(mailTargetUserId, cardPayload, mailTitle, mailBody || undefined)
      } else {
        await adminSendMail({ userId: mailTargetUserId, type: mailType, title: mailTitle, body: mailBody || undefined, amount: (mailType === "coins" || mailType === "dust") ? mailAmount : undefined })
      }
      toast.success("Письмо отправлено!")
      setMailTitle(""); setMailBody(""); setMailCardJson(""); setMailAmount(0)
    } catch (err) {
      console.error("Failed to send mail:", err)
      toast.error("Ошибка при отправке письма")
    } finally {
      setIsMailSending(false)
    }
  }

  const handleSendMailBulk = async () => {
    if (simpleUsers.length === 0) { toast.error("Нет пользователей для рассылки"); return }
    if (!mailTitle.trim()) { toast.error("Введите заголовок"); return }
    if (mailType === "card_gift" && !mailCardJson.trim()) { toast.error("Вставьте JSON карты для подарка"); return }
    try {
      setIsMailSending(true)
      let cardPayload: any = null
      if (mailType === "card_gift") {
        try { cardPayload = JSON.parse(mailCardJson) } catch { toast.error("Неверный JSON карты"); setIsMailSending(false); return }
      }
      const result = await adminSendMailBulk({ userIds: simpleUsers.map(u => u.id), type: mailType, title: mailTitle, body: mailBody || undefined, amount: (mailType === "coins" || mailType === "dust") ? mailAmount : undefined, cardPayload: cardPayload || undefined })
      toast.success(`Отправлено ${result.sent} писем!`)
    } catch (err) {
      console.error("Failed to bulk send mail:", err)
      toast.error("Ошибка при массовой рассылке")
    } finally {
      setIsMailSending(false)
    }
  }

  const handleSendPush = async () => {
    if (!pushTargetUserId) { toast.error("Выберите получателя"); return }
    if (!pushTitle.trim()) { toast.error("Введите заголовок уведомления"); return }
    try {
      setIsPushSending(true)
      const result = await adminSendPushNotification(pushTargetUserId, pushTitle, pushBody || undefined, pushUrl || undefined)
      if (result.total === 0) { toast.info("У пользователя нет активных push-подписок") } else { toast.success(`Отправлено ${result.sent} из ${result.total} уведомлений`) }
      setPushTitle(""); setPushBody(""); setPushUrl("")
    } catch (err) {
      console.error("Failed to send push:", err)
      toast.error("Ошибка при отправке push-уведомления")
    } finally {
      setIsPushSending(false)
    }
  }

  const handleSendPushBulk = async () => {
    if (simpleUsers.length === 0) { toast.error("Нет пользователей для рассылки"); return }
    if (!pushTitle.trim()) { toast.error("Введите заголовок уведомления"); return }
    try {
      setIsPushSending(true)
      const result = await adminSendPushNotificationBulk(simpleUsers.map(u => u.id), pushTitle, pushBody || undefined, pushUrl || undefined)
      if (result.total === 0) { toast.info("Нет активных push-подписок у пользователей") } else { toast.success(`Отправлено ${result.sent} из ${result.total} уведомлений`) }
      setPushTitle(""); setPushBody(""); setPushUrl("")
    } catch (err) {
      console.error("Failed to bulk send push:", err)
      toast.error("Ошибка при массовой отправке push-уведомлений")
    } finally {
      setIsPushSending(false)
    }
  }

  const handleCreateBanner = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const featuredIds = newBanner.featured_anime_ids.split(",").map(s => parseInt(s.trim())).filter(n => !isNaN(n))
      let guaranteedCardPayload: any = null
      const guaranteedJsonStr = newBanner.guaranteed_card_json?.trim()
      if (guaranteedJsonStr) { try { guaranteedCardPayload = JSON.parse(guaranteedJsonStr) } catch { toast.error("Неверный JSON гарантированной карты"); return } }
      let guaranteedCardsPool: any[] | null = null
      const poolJsonStr = newBanner.guaranteed_cards_pool_json?.trim()
      if (poolJsonStr) { try { const parsed = JSON.parse(poolJsonStr); if (!Array.isArray(parsed)) { toast.error("Пул гарантированных карт должен быть массивом: [{ ... }, { ... }]"); return } guaranteedCardsPool = parsed } catch { toast.error("Неверный JSON пула гарантированных карт. Оберните карты в квадратные скобки: [{ ... }, { ... }]"); return } }
      const created = await createBanner({
        name: newBanner.name, description: newBanner.description || undefined, image_url: newBanner.image_url || undefined,
        promo_image_url: newBanner.promo_image_url || undefined, featured_anime_ids: featuredIds.length ? featuredIds : undefined,
        boosted_rarity: newBanner.boosted_rarity || undefined, price: newBanner.price ? parseFloat(newBanner.price) : undefined,
        color: newBanner.color || undefined, start_date: newBanner.start_date ? new Date(newBanner.start_date).toISOString() : undefined,
        end_date: newBanner.end_date ? new Date(newBanner.end_date).toISOString() : undefined, is_active: newBanner.is_active,
        sort_order: newBanner.sort_order, guaranteed_card_payload: guaranteedCardPayload || undefined,
        guaranteed_card_pity: newBanner.guaranteed_card_pity ? parseInt(newBanner.guaranteed_card_pity) : 0,
        guaranteed_cards_pool: guaranteedCardsPool, banner_type: newBanner.banner_type,
      })
      if (created) setBanners(prev => [created, ...prev])
      setShowCreateBanner(false)
      setNewBanner(DEFAULT_BANNER_FORM)
      toast.success("Баннер создан!")
    } catch (err) {
      console.error("Failed to create banner:", err)
      toast.error("Ошибка при создании баннера")
    }
  }

  const handleDeleteBanner = async (id: string) => {
    if (!confirm("Удалить баннер?")) return
    try {
      await deleteBanner(id)
      setBanners(prev => prev.filter(b => b.id !== id))
      toast.success("Баннер удалён")
    } catch (err) {
      console.error("Failed to delete banner:", err)
      toast.error("Ошибка при удалении баннера")
    }
  }

  const handleToggleBannerActive = async (banner: Banner) => {
    try {
      await updateBanner(banner.id, { is_active: !banner.is_active })
      setBanners(prev => prev.map(b => b.id === banner.id ? { ...b, is_active: !banner.is_active } : b))
    } catch (err) {
      console.error("Failed to toggle banner:", err)
      toast.error("Ошибка при обновлении баннера")
    }
  }

  const handleStartEditBanner = (banner: Banner) => {
    const startDate = banner.start_date ? new Date(banner.start_date).toISOString().slice(0, 16) : ""
    const endDate = banner.end_date ? new Date(banner.end_date).toISOString().slice(0, 16) : ""
    setEditBanner({
      name: banner.name, description: banner.description || "", image_url: banner.image_url || "",
      promo_image_url: banner.promo_image_url || "", featured_anime_ids: (banner.featured_anime_ids || []).join(", "),
      boosted_rarity: (banner.boosted_rarity as Rarity) || "", price: banner.price != null ? String(banner.price) : "",
      color: banner.color || "from-purple-600 to-pink-700", start_date: startDate, end_date: endDate,
      is_active: banner.is_active ?? true, sort_order: banner.sort_order ?? 0,
      guaranteed_card_json: banner.guaranteed_card_payload ? JSON.stringify(banner.guaranteed_card_payload, null, 2) : "",
      guaranteed_card_pity: banner.guaranteed_card_pity ? String(banner.guaranteed_card_pity) : "",
      guaranteed_cards_pool_json: banner.guaranteed_cards_pool ? JSON.stringify(banner.guaranteed_cards_pool, null, 2) : "",
      banner_type: (banner.banner_type as "standard" | "dynamic") || "standard",
    })
    setEditingBannerId(banner.id)
  }

  const handleSaveEditBanner = async () => {
    if (!editingBannerId || !editBanner) return
    try {
      const featuredIds = editBanner.featured_anime_ids.split(",").map(s => parseInt(s.trim())).filter(n => !isNaN(n))
      let guaranteedCardPayload: any = null
      const guaranteedJsonStr = editBanner.guaranteed_card_json?.trim()
      if (guaranteedJsonStr) { try { guaranteedCardPayload = JSON.parse(guaranteedJsonStr) } catch { toast.error("Неверный JSON гарантированной карты"); return } }
      let guaranteedCardsPool: any[] | null = null
      const poolJsonStr = editBanner.guaranteed_cards_pool_json?.trim()
      if (poolJsonStr) { try { const parsed = JSON.parse(poolJsonStr); if (!Array.isArray(parsed)) { toast.error("Пул гарантированных карт должен быть массивом: [{ ... }, { ... }]"); return } guaranteedCardsPool = parsed } catch { toast.error("Неверный JSON пула гарантированных карт. Оберните карты в квадратные скобки: [{ ... }, { ... }]"); return } }
      const updated = await updateBanner(editingBannerId, {
        name: editBanner.name, description: editBanner.description || null, image_url: editBanner.image_url || null,
        promo_image_url: editBanner.promo_image_url || null, featured_anime_ids: featuredIds,
        boosted_rarity: editBanner.boosted_rarity || null, price: editBanner.price ? parseFloat(editBanner.price) : null,
        color: editBanner.color || null, start_date: editBanner.start_date ? new Date(editBanner.start_date).toISOString() : null,
        end_date: editBanner.end_date ? new Date(editBanner.end_date).toISOString() : null, is_active: editBanner.is_active,
        sort_order: editBanner.sort_order, guaranteed_card_payload: guaranteedCardPayload || null,
        guaranteed_card_pity: editBanner.guaranteed_card_pity ? parseInt(editBanner.guaranteed_card_pity) : 0,
        guaranteed_cards_pool: guaranteedCardsPool, banner_type: editBanner.banner_type,
      })
      setBanners(prev => prev.map(b => b.id === editingBannerId ? { ...b, ...updated } : b))
      setEditingBannerId(null)
      setEditBanner(null)
      toast.success("Баннер обновлён!")
    } catch (err) {
      console.error("Failed to update banner:", err)
      toast.error("Ошибка при обновлении баннера")
    }
  }

  const handleAddBannerCard = async (bannerId: string) => {
    const jsonStr = newBannerCardJson[bannerId] || ""
    if (!jsonStr.trim()) { toast.error("Вставьте JSON карты"); return }
    let cardPayload: any
    try { cardPayload = JSON.parse(jsonStr) } catch { toast.error("Неверный JSON карты"); return }
    try {
      const created = await addBannerCard({ bannerId, cardPayload, weight: newBannerCardWeight[bannerId] ?? 1, isFeatured: newBannerCardFeatured[bannerId] ?? false })
      setBannerCards(prev => ({ ...prev, [bannerId]: [created, ...(prev[bannerId] || [])] }))
      setNewBannerCardJson(prev => ({ ...prev, [bannerId]: "" }))
      setNewBannerCardWeight(prev => ({ ...prev, [bannerId]: 1 }))
      setNewBannerCardFeatured(prev => ({ ...prev, [bannerId]: false }))
      toast.success("Карта добавлена в баннер!")
    } catch (err) {
      console.error("Failed to add banner card:", err)
      toast.error("Ошибка при добавлении карты")
    }
  }

  const handleUpdateBannerCard = async (card: BannerCard) => {
    try {
      await updateBannerCard(card.id, { weight: card.weight, is_featured: card.is_featured })
      toast.success("Карта обновлена")
    } catch (err) {
      console.error("Failed to update banner card:", err)
      toast.error("Ошибка при обновлении карты")
    }
  }

  const handleDeleteBannerCard = async (cardId: string, bannerId: string) => {
    if (!confirm("Удалить карту из баннера?")) return
    try {
      await deleteBannerCard(cardId)
      setBannerCards(prev => ({ ...prev, [bannerId]: (prev[bannerId] || []).filter(c => c.id !== cardId) }))
      toast.success("Карта удалена из баннера")
    } catch (err) {
      console.error("Failed to delete banner card:", err)
      toast.error("Ошибка при удалении карты")
    }
  }

  const toggleBannerExpand = (bannerId: string) => {
    if (expandedBannerId === bannerId) { setExpandedBannerId(null); return }
    setExpandedBannerId(bannerId)
    if (!bannerCards[bannerId]) fetchBannerCards(bannerId)
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never'
    return new Date(dateString).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4 sm:p-8">
        <div className="max-w-md w-full">
          <div className="bg-card border border-border rounded-lg p-6 sm:p-8">
            <div className="text-center mb-8">
              <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Lock className="w-6 h-6 text-primary" />
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-foreground mb-2">Admin Access</h1>
              <p className="text-sm text-muted-foreground">Enter credentials to access admin dashboard</p>
            </div>
            <form onSubmit={handleLogin} className="space-y-4">
              {authError && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
                  {authError}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Username</label>
                <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} className="w-full px-3 py-2 bg-muted border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary text-foreground" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Password</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-3 py-2 bg-muted border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary text-foreground" required />
              </div>
              <button type="submit" disabled={isPending} className="w-full py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors font-medium disabled:opacity-50">
                {isPending ? "Signing in..." : "Sign In"}
              </button>
            </form>
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-3 sm:p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-muted rounded w-48 mb-6 sm:mb-8"></div>
            <div className="grid gap-3 sm:gap-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-20 bg-muted rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background p-3 sm:p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">
            <p className="text-destructive">{error}</p>
            <button onClick={fetchUsers} className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded">Retry</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto p-3 sm:p-4 md:p-6 lg:p-8">
        <div className="flex flex-col gap-4 mb-6 md:mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground mb-1 md:mb-2">Admin Dashboard</h1>
            </div>
            <div className="flex gap-2 sm:gap-4 items-center">
              <div className="text-xs sm:text-sm text-muted-foreground hidden sm:block">
                Total Users: {users.length}
              </div>
              <button onClick={handleLogout} className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-muted hover:bg-muted/80 rounded transition text-sm" disabled={isPending}>
                <LogOut size={16} />
                {isPending ? "..." : "Logout"}
              </button>
            </div>
          </div>
          <AdminTabs activeTab={activeTab} onTabChange={setActiveTab} />
        </div>

        {activeTab === 'users' && (
          <UsersTab
            users={users}
            loading={loading}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            selectedUser={selectedUser}
            onSelectUser={(user) => {
              setSelectedUser(selectedUser?.id === user.id ? null : user)
              setShowAllHistory(false)
              setShowAllBookmarks(false)
            }}
            showAllHistory={showAllHistory}
            onToggleAllHistory={() => setShowAllHistory(!showAllHistory)}
            showAllBookmarks={showAllBookmarks}
            onToggleAllBookmarks={() => setShowAllBookmarks(!showAllBookmarks)}
            formatDate={formatDate}
            formatTimestamp={formatTimestamp}
          />
        )}

        {activeTab === 'pvp' && (
          <PvPTab
            pvpRules={pvpRules}
            pvpLocations={pvpLocations}
            isPvPLoading={isPvPLoading}
            showAddLocation={showAddLocation}
            onToggleAddLocation={() => setShowAddLocation(!showAddLocation)}
            newLocation={newLocation}
            onNewLocationChange={setNewLocation}
            selectedRuleIds={selectedRuleIds}
            onToggleRuleId={(id) => {
              if (selectedRuleIds.includes(id)) {
                setSelectedRuleIds(prev => prev.filter(rid => rid !== id))
              } else {
                setSelectedRuleIds(prev => [...prev, id])
              }
            }}
            onCreateLocation={handleCreateLocation}
            onToggleRule={handleToggleRule}
            onDeleteLocation={handleDeleteLocation}
            battleBackgrounds={battleBackgrounds}
            onAddBackground={handleAddBackground}
            onDeleteBackground={handleDeleteBackground}
            onToggleBackground={handleToggleBackground}
            onUpdateBackground={handleUpdateBackground}
          />
        )}

        {activeTab === 'ai_battle' && (
          <AIBattleTab
            battleAIDashboard={battleAIDashboard}
            isBattleAILoading={isBattleAILoading}
            battleAIError={battleAIError}
            learningProfiles={learningProfiles}
            onRefresh={fetchBattleAIDashboard}
            formatDate={formatDate}
          />
        )}

        {activeTab === 'battle_logs' && (
          <BattleLogsTab
            pvpLogs={pvpLogs}
            isLogsLoading={isLogsLoading}
            logsError={logsError}
            onRefresh={fetchPvPLogs}
            formatDate={formatDate}
          />
        )}

        {activeTab === 'cards' && <CardsTab />}

        {activeTab === 'mail' && (
          <MailTab
            simpleUsers={simpleUsers}
            mailTargetUserId={mailTargetUserId}
            onMailTargetChange={setMailTargetUserId}
            mailType={mailType}
            onMailTypeChange={setMailType}
            mailTitle={mailTitle}
            onMailTitleChange={setMailTitle}
            mailBody={mailBody}
            onMailBodyChange={setMailBody}
            mailAmount={mailAmount}
            onMailAmountChange={setMailAmount}
            mailCardJson={mailCardJson}
            onMailCardJsonChange={setMailCardJson}
            isMailSending={isMailSending}
            onSendMail={handleSendMail}
            onSendMailBulk={handleSendMailBulk}
            onRefreshUsers={fetchSimpleUsers}
            pushTargetUserId={pushTargetUserId}
            onPushTargetChange={setPushTargetUserId}
            pushTitle={pushTitle}
            onPushTitleChange={setPushTitle}
            pushBody={pushBody}
            onPushBodyChange={setPushBody}
            pushUrl={pushUrl}
            onPushUrlChange={setPushUrl}
            isPushSending={isPushSending}
            onSendPush={handleSendPush}
            onSendPushBulk={handleSendPushBulk}
          />
        )}

        {activeTab === 'events' && (
          <EventsTab
            banners={banners}
            isBannersLoading={isBannersLoading}
            showCreateBanner={showCreateBanner}
            onToggleCreateBanner={() => setShowCreateBanner(!showCreateBanner)}
            newBanner={newBanner}
            onNewBannerChange={setNewBanner}
            onCreateBanner={handleCreateBanner}
            editingBannerId={editingBannerId}
            editBanner={editBanner}
            onEditBannerChange={setEditBanner}
            onStartEditBanner={handleStartEditBanner}
            onSaveEditBanner={handleSaveEditBanner}
            onCancelEditBanner={() => { setEditingBannerId(null); setEditBanner(null) }}
            onDeleteBanner={handleDeleteBanner}
            onToggleBannerActive={handleToggleBannerActive}
            expandedBannerId={expandedBannerId}
            onToggleBannerExpand={toggleBannerExpand}
            bannerCards={bannerCards}
            bannerCardsLoading={bannerCardsLoading}
            newBannerCardJson={newBannerCardJson}
            onNewBannerCardJsonChange={(bannerId, value) => setNewBannerCardJson(prev => ({ ...prev, [bannerId]: value }))}
            newBannerCardWeight={newBannerCardWeight}
            onNewBannerCardWeightChange={(bannerId, value) => setNewBannerCardWeight(prev => ({ ...prev, [bannerId]: value }))}
            newBannerCardFeatured={newBannerCardFeatured}
            onNewBannerCardFeaturedChange={(bannerId, value) => setNewBannerCardFeatured(prev => ({ ...prev, [bannerId]: value }))}
            onAddBannerCard={handleAddBannerCard}
            onUpdateBannerCard={handleUpdateBannerCard}
            onDeleteBannerCard={handleDeleteBannerCard}
            onBannerCardsChange={(bannerId, cards) => setBannerCards(prev => ({ ...prev, [bannerId]: cards }))}
            formatDate={formatDate}
          />
        )}

        {activeTab === 'tutorial' && <TutorialTab />}
      </div>

      <ScrollToTop />
      <Footer />
    </div>
  )
}
