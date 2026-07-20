"use client"

import { useEffect, useState, useTransition } from "react"
import { Users, Eye, Bookmark, User, Search, LogOut, Lock, Brain, Sword, Shield, Map, Settings, Trash2, Plus, Check, X, History, Trophy, Gift, Mail, Calendar, Edit, Sparkles, BookOpen, ChevronDown, ChevronRight, Lightbulb, CheckCircle, AlertTriangle, BellRing, Send } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { ScrollToTop } from "@/components/layout/scroll-to-top"
import { Footer } from "@/components/layout/footer"
import { adminLogin, adminLogout, checkAdminAuth, getAdminUsers, getPvPRules, updatePvPRule, getPvPLocations, createPvPLocation, deletePvPLocation, getPvPLogs, getAdminUsersSimple, getBanners, createBanner, updateBanner, deleteBanner, getBannerCards, addBannerCard, updateBannerCard, deleteBannerCard, adminSendMail, adminSendMailBulk, adminGiftCardToUser, searchCharactersForBanner, searchUserCardsForBanner, adminSendPushNotification, adminSendPushNotificationBulk } from "./actions"
import { rarityConfig } from "@/types/gacha"
import type { Rarity } from "@/types/gacha"
import { toast } from "sonner"

interface UserProfile {
  id: string
  username: string | null
  avatar_url: string | null
  updated_at: string | null
  allow_nsfw_search?: boolean
  email?: string
  created_at?: string
}

interface WatchHistoryItem {
  id: string
  user_id: string
  anime_id: string
  title: string
  poster: string | null
  timestamp: number
  episode?: number
  episodes_total?: number
  created_at: string
}

interface BookmarkItem {
  id: string
  user_id: string
  anime_id: string
  anime_data: any
  created_at: string
}

interface UserWithStats extends UserProfile {
  watchHistoryCount: number
  bookmarksCount: number
  lastActivity: string | null
  recentHistory: WatchHistoryItem[]
  recentBookmarks: BookmarkItem[]
  allHistory: WatchHistoryItem[]
  allBookmarks: BookmarkItem[]
  aiStats: {
    total_battles: number
    last_battle_date: string | null
    favorite_cards: any[]
    preferred_roles: Record<string, number>
    preferred_rarities: Record<string, number>
    avg_provision_cost: number
    aggressive_rating: number
    defensive_rating: number
  } | null
}

interface PvPRule {
  id: string
  name_ru: string
  description_ru: string
  is_active: boolean
  category: string
}

interface PvPLocation {
  id: string
  name: string
  name_ru: string
  description: string
  description_ru: string
  is_active: boolean
  is_empty: boolean
  rules: { rule_id: string }[]
}

interface PvPLog {
  id: string
  player1_id: string
  player2_id: string
  winner_id: string | null
  player1_mmr_before: number
  player2_mmr_before: number
  player1_mmr_after: number
  player2_mmr_after: number
  player1_deck: any
  player2_deck: any
  battle_data: any
  duration_seconds: number
  created_at: string
  player1: { username: string | null; avatar_url: string | null }
  player2: { username: string | null; avatar_url: string | null }
}

interface SimpleUser {
  id: string
  username: string | null
  avatar_url: string | null
  email: string | null
  updated_at: string | null
  created_at: string | null
}

interface Banner {
  id: string
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
  guaranteed_card_payload?: any | null
  guaranteed_card_pity?: number
  banner_type?: string
}

interface BannerCard {
  id: string
  banner_id: string
  card_payload: any
  weight: number
  is_featured: boolean
  created_at?: string
}

type MailType = "card_gift" | "coins" | "dust" | "event_reward" | "message"

const GRADIENT_PRESETS = [
  "from-purple-600 to-pink-700",
  "from-blue-600 to-cyan-500",
  "from-red-600 to-orange-500",
  "from-green-600 to-emerald-500",
  "from-indigo-600 to-purple-700",
  "from-pink-500 to-rose-600",
  "from-amber-500 to-orange-600",
  "from-cyan-500 to-blue-600",
  "from-violet-600 to-fuchsia-600",
  "from-slate-700 to-slate-900",
  "from-teal-500 to-green-600",
  "from-fuchsia-500 to-pink-600",
]

interface TutorialSection {
  id: string
  title: string
  icon: React.ReactNode
  description: string
  steps: { title: string; detail: string }[]
  tips?: string[]
  warnings?: string[]
}

const tutorialSections: TutorialSection[] = [
  {
    id: "login",
    title: "Вход в админку",
    icon: <Lock className="w-5 h-5" />,
    description: "Авторизация в панели администратора",
    steps: [
      { title: "Откройте /admin", detail: "Перейдите по адресу вашего сайта на страницу /admin" },
      { title: "Введите логин и пароль", detail: "Используются переменные окружения ADMIN_USERNAME и ADMIN_PASSWORD" },
      { title: "Войдите", detail: "После успешной авторизации вы увидите Dashboard с 7 вкладками" },
    ],
    warnings: [
      "Не делитесь логином и паролем с посторонними",
      "Кука admin_auth хранится в браузере — после выхода нужно войти заново",
    ],
  },
  {
    id: "users",
    title: "Users Management — Управление пользователями",
    icon: <Users className="w-5 h-5" />,
    description: "Просмотр всех пользователей, их истории просмотров, закладок и AI-статистики",
    steps: [
      { title: "Поиск пользователей", detail: "Используйте строку поиска для фильтрации по имени или ID" },
      { title: "View Details", detail: "Нажмите кнопку «View Details» у любого пользователя для раскрытия подробной информации" },
      { title: "Watch History", detail: "Просмотр истории просмотров аниме — последние 5 или все записи" },
      { title: "Bookmarks", detail: "Просмотр закладок пользователя — последние 5 или все записи" },
      { title: "AI Learning Statistics", detail: "Статистика PvP-битв: всего битв, агрессивный/оборонительный рейтинг, любимые карты, предпочитаемые роли и редкости, средний provision cost" },
    ],
    tips: [
      "Кнопка «Show All» показывает полную историю вместо последних 5 записей",
      "AI-статистика отображается только если пользователь участвовал в PvP-битвах",
    ],
  },
  {
    id: "pvp",
    title: "PvP Settings — Настройка PvP",
    icon: <Sword className="w-5 h-5" />,
    description: "Управление правилами (модификаторами) PvP и кастомными локациями",
    steps: [
      { title: "PvP Rules", detail: "Список всех правил-модификаторов с переключателем вкл/выкл. Каждое правило имеет название, описание и категорию" },
      { title: "Включить/выключить правило", detail: "Нажмите переключатель (toggle) в правом верхнем углу карточки правила" },
      { title: "Custom Locations", detail: "Нажмите «Add Location» для создания новой PvP-локации" },
      { title: "Создание локации", detail: "Заполните: Name (внутреннее), Name (рус), Description (внутреннее), Description (рус). Отметьте «Neutral Location» если не нужны правила, иначе выберите правила из списка активных" },
      { title: "Удаление локации", detail: "Наведите курсор на карточку локации и нажмите иконку корзины" },
    ],
    tips: [
      "Обычно на одну локацию назначается 1 правило",
      "Neutral Location — локация без правил (чистая арена)",
      "Только активные правила доступны для выбора при создании локации",
    ],
  },
  {
    id: "battle_logs",
    title: "Battle Logs — Логи PvP-битв",
    icon: <History className="w-5 h-5" />,
    description: "Просмотр истории PvP-битв между игроками",
    steps: [
      { title: "Откройте вкладку Battle Logs", detail: "Логи загружаются автоматически при переходе на вкладку" },
      { title: "Обновить логи", detail: "Нажмите кнопку обновления для повторной загрузки" },
      { title: "Просмотр результатов", detail: "Каждый лог содержит: имена игроков, MMR до/после, победителя, длительность битвы, колоды игроков" },
    ],
    tips: [
      "Логи загружаются последние 100 записей",
      "Если победитель null — битва закончилась ничьей или дисконнектом",
    ],
  },
  {
    id: "cards",
    title: "Карты — Редактор карт",
    icon: <Sparkles className="w-5 h-5" />,
    description: "Создание кастомных карт с 3D-слоями, статами и модификаторами",
    steps: [
      { title: "Откройте редактор", detail: "Нажмите «Открыть редактор карт» — перейдёте на /admin/card-editor" },
      { title: "Заполните базовые данные", detail: "Имя персонажа, название аниме, URL изображения, редкость, рейтинг MAL, Shiki ID, Character ID" },
      { title: "Настройте характеристики", detail: "HP, ATK, DEF, SPD, LUCK — ползунки от 0 до 100" },
      { title: "Модификаторы", detail: "Выберите рамку (Frame) и покрытие (Coating) из выпадающих списков" },
      { title: "3D слои (опционально)", detail: "Заполните URL для Background, Character и VFX слоёв. Используйте PNG с прозрачностью" },
      { title: "Главный герой", detail: "Включите тумблер, чтобы добавить корону на карту" },
      { title: "Доставка карты", detail: "Внизу страницы есть 3 варианта доставки: подарок пользователю, добавление в баннер, установка как гаранта баннера" },
    ],
    tips: [
      "3D-слои работают только с PNG изображениями с прозрачным фоном",
      "Если указаны 3D-слои, основной URL изображения можно не заполнять — он подставится автоматически",
      "Character ID должен быть уникальным — используйте кнопку генерации",
    ],
    warnings: [
      "URL изображения должен быть прямым ссылкой на картинку (https://...)",
      "Для 3D-карт используйте только PNG с альфа-каналом",
    ],
  },
  {
    id: "mail",
    title: "Рассылка — Почта и подарки",
    icon: <Mail className="w-5 h-5" />,
    description: "Отправка писем, монет, пыли и карт пользователям",
    steps: [
      { title: "Выберите получателя", detail: "Из выпадающего списка выберите пользователя. Список загружается при первом открытии вкладки" },
      { title: "Выберите тип письма", detail: "Доступные типы: message (сообщение), card_gift (подарок карты), coins (монеты), dust (пыль), event_reward (награда события)" },
      { title: "Заполните заголовок и текст", detail: "Заголовок и текст письма видны пользователю в почтовом ящике" },
      { title: "Для coins/dust", detail: "Укажите количество валюты для начисления" },
      { title: "Для card_gift", detail: "Вставьте JSON объект карты в текстовое поле. JSON можно получить из редактора карт" },
      { title: "Отправить", detail: "Нажмите «Отправить» для одного пользователя или «Отправить всем» для массовой рассылки" },
    ],
    tips: [
      "Массовая рассылка отправляет письмо ВСЕМ пользователям в списке",
      "Для подарка карты проще создать её в редакторе карт и скопировать JSON оттуда",
      "Пользователи видят письма во вкладке «Inbox» на странице гача",
    ],
    warnings: [
      "Массовая рассылка необратима — убедитесь, что выбрали правильный тип и содержание",
      "JSON карты должен быть валидным — проверьте перед отправкой",
    ],
  },
  {
    id: "events",
    title: "События — Баннеры и гача",
    icon: <Calendar className="w-5 h-5" />,
    description: "Создание и управление гача-баннерами, добавление карт, настройка гаранта",
    steps: [
      { title: "Создать баннер", detail: "Нажмите «Создать баннер» и заполните форму: название, описание, URL изображения, featured anime IDs (через запятую), буст редкости, цена, цвет (Tailwind gradient), даты начала/окончания, сортировка, активен" },
      { title: "Редактировать баннер", detail: "Нажмите иконку карандаша на карточке баннера — раскроется форма редактирования" },
      { title: "Включить/выключить баннер", detail: "Используйте переключатель (toggle) на карточке баннера" },
      { title: "Удалить баннер", detail: "Нажмите иконку корзины — потребуется подтверждение" },
      { title: "Добавить карты в баннер", detail: "Нажмите «Карты баннера» для раскрытия секции карт. Вставьте JSON карты, укажите вес (weight) и featured-статус, нажмите «Добавить карту»" },
      { title: "Редактировать карту баннера", detail: "Измените вес или featured-чекбокс прямо в списке карт, затем нажмите иконку карандаша для сохранения" },
      { title: "Удалить карту из баннера", detail: "Нажмите иконку корзины рядом с картой" },
      { title: "Гарантированная карта (гарант)", detail: "При создании или редактировании баннера в секции «Гарантированная карта» вставьте JSON карты и укажите pity (количество круток до гаранта, например 77). 0 = выключено" },
    ],
    tips: [
      "Featured anime IDs — это ID аниме с Shikimori (например: 1, 21, 5114)",
      "Цвет — Tailwind CSS gradient класс (например: from-purple-600 to-pink-700)",
      "Sort order определяет порядок отображения баннеров на странице гача",
      "Баннер виден игрокам только если is_active=true и дата начала прошла, а дата окончания не наступила (или не указана)",
      "Вес карты (weight) определяет вероятность выпадения — чем выше, тем чаще выпадает",
      "Featured-карты помечаются особым значком в баннере",
      "Гарант-карта выпадает игроку гарантированно после N круток этого баннера. Каждый игрок имеет свой счётчик круток (таблица user_banner_pulls)",
      "Альтернативный способ установки гаранта: через Card Editor → «Установить как гарант баннера»",
    ],
    warnings: [
      "Удаление баннера удаляет все связанные карты и счётчики круток",
      "Изменение pity не сбрасывает уже существующие счётчики игроков",
      "Если у баннера есть и карты (banner_cards), и featured anime IDs, приоритет отдаётся картам",
    ],
  },
  {
    id: "card-editor-delivery",
    title: "Card Editor — Доставка карты (3 способа)",
    icon: <Gift className="w-5 h-5" />,
    description: "Как отправить созданную карту игрокам: подарок, баннер или гарант",
    steps: [
      { title: "1. Подарок пользователю", detail: "В секции «Подарить пользователю» выберите пользователя из списка и нажмите «Подарить пользователю». Карта придёт в почтовый ящик игрока" },
      { title: "2. Добавить в баннер", detail: "В секции «Добавить в баннер» выберите баннер, укажите featured-статус и нажмите «Добавить в баннер». Карта добавится в пул карт баннера с весом 1 (можно изменить позже в настройках баннера)" },
      { title: "3. Установить как гарант", detail: "В секции «Установить как гарант баннера» выберите баннер, укажите pity (по умолчанию 77) и нажмите кнопку. Карта станет гарантированной для этого баннера — игрок получит её после N круток" },
    ],
    tips: [
      "Можно использовать несколько способов одновременно: добавить карту в пул баннера И установить как гарант",
      "При добавлении в баннер через Card Editor вес = 1. Измените вес в разделе Events → Карты баннера",
      "Гарант и пул карт работают независимо: гарант срабатывает по pity, а пул — по весам при каждой крутке",
    ],
  },
  {
    id: "workflow-example",
    title: "Пример: Создание кастомной карты с гарантом 77",
    icon: <Lightbulb className="w-5 h-5" />,
    description: "Полный сценарий от создания карты до настройки гаранта",
    steps: [
      { title: "Шаг 1: Создайте баннер", detail: "Перейдите в Events → «Создать баннер». Заполните название, описание, цену, даты. Оставьте секцию гаранта пустой — заполним позже через Card Editor. Нажмите «Создать баннер»" },
      { title: "Шаг 2: Откройте Card Editor", detail: "Перейдите в Карты → «Открыть редактор карт»" },
      { title: "Шаг 3: Создайте карту", detail: "Заполните имя, аниме, URL картинки, выберите редкость, настройте статы (HP/ATK/DEF/SPD/LUCK), добавьте рамку/покрытие по желанию" },
      { title: "Шаг 4: Добавьте карту в пул баннера", detail: "В секции «Добавить в баннер» выберите созданный баннер, отметьте featured если нужно, нажмите «Добавить в баннер»" },
      { title: "Шаг 5: Установите гарант", detail: "В секции «Установить как гарант баннера» выберите тот же баннер, убедитесь что pity = 77, нажмите «Установить гарант (pity: 77)»" },
      { title: "Шаг 6: Проверьте", detail: "Вернитесь в Events → найдите баннер. Вы увидите бейдж «Гарант-карта: [имя] (через 77 круток)». Раскройте «Карты баннера» — там будет ваша карта" },
      { title: "Шаг 7: Тест", detail: "Откройте страницу гача (/gacha), выберите баннер, крутите 77 раз — на 77-й крутке выпадет гарантированная карта" },
    ],
    tips: [
      "Вес карты в пуле определяет шанс выпадения ДО срабатывания гаранта",
      "Гарант срабатывает один раз — после получения счётчик сбрасывается (guaranteed_claimed = true)",
      "Если игрок уже получил гаранта, при следующих крутках он получает карты из пула по весам",
    ],
  },
]

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<'users' | 'pvp' | 'battle_logs' | 'cards' | 'mail' | 'events' | 'tutorial'>('users')
  const [expandedTutorialId, setExpandedTutorialId] = useState<string | null>("login")
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

  // PvP state
  const [pvpRules, setPvPRules] = useState<PvPRule[]>([])
  const [pvpLocations, setPvPLocations] = useState<PvPLocation[]>([])
  const [isPvPLoading, setIsPvPLoading] = useState(false)
  const [showAddLocation, setShowAddLocation] = useState(false)
  const [newLocation, setNewLocation] = useState({
    name: '',
    name_ru: '',
    description: '',
    description_ru: '',
    is_empty: false
  })
  const [selectedRuleIds, setSelectedRuleIds] = useState<string[]>([])

  // Battle Logs state
  const [pvpLogs, setPvPLogs] = useState<PvPLog[]>([])
  const [isLogsLoading, setIsLogsLoading] = useState(false)
  const [logsLoaded, setLogsLoaded] = useState(false)
  const [logsError, setLogsError] = useState<string | null>(null)

  // Mail tab state
  const [simpleUsers, setSimpleUsers] = useState<SimpleUser[]>([])
  const [mailTargetUserId, setMailTargetUserId] = useState<string>("")
  const [mailType, setMailType] = useState<MailType>("message")
  const [mailTitle, setMailTitle] = useState("")
  const [mailBody, setMailBody] = useState("")
  const [mailAmount, setMailAmount] = useState<number>(0)
  const [mailCardJson, setMailCardJson] = useState("")
  const [isMailSending, setIsMailSending] = useState(false)
  const [mailLoaded, setMailLoaded] = useState(false)

  // Push notification state
  const [pushTargetUserId, setPushTargetUserId] = useState<string>("")
  const [pushTitle, setPushTitle] = useState("")
  const [pushBody, setPushBody] = useState("")
  const [pushUrl, setPushUrl] = useState("")
  const [isPushSending, setIsPushSending] = useState(false)

  // Events (banners) tab state
  const [banners, setBanners] = useState<Banner[]>([])
  const [isBannersLoading, setIsBannersLoading] = useState(false)
  const [bannersLoaded, setBannersLoaded] = useState(false)
  const [showCreateBanner, setShowCreateBanner] = useState(false)
  const [newBanner, setNewBanner] = useState({
    name: "",
    description: "",
    image_url: "",
    promo_image_url: "",
    featured_anime_ids: "",
    boosted_rarity: "" as Rarity | "",
    price: "",
    color: "from-purple-600 to-pink-700",
    start_date: "",
    end_date: "",
    is_active: true,
    sort_order: 0,
    guaranteed_card_json: "",
    guaranteed_card_pity: "",
    banner_type: "standard" as "standard" | "dynamic",
  })
  const [editingBannerId, setEditingBannerId] = useState<string | null>(null)
  const [expandedBannerId, setExpandedBannerId] = useState<string | null>(null)
  const [editBanner, setEditBanner] = useState<{
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
    banner_type: "standard" | "dynamic"
  } | null>(null)
  const [bannerCards, setBannerCards] = useState<Record<string, BannerCard[]>>({})
  const [bannerCardsLoading, setBannerCardsLoading] = useState<string | null>(null)
  const [newBannerCardJson, setNewBannerCardJson] = useState<Record<string, string>>({})
  const [newBannerCardWeight, setNewBannerCardWeight] = useState<Record<string, number>>({})
  const [newBannerCardFeatured, setNewBannerCardFeatured] = useState<Record<string, boolean>>({})
  // Card picker state
  const [cardPickerMode, setCardPickerMode] = useState<Record<string, "picker" | "json">>({})
  const [cardPickerSource, setCardPickerSource] = useState<Record<string, "shikimori" | "db">>({})
  const [cardPickerQuery, setCardPickerQuery] = useState<Record<string, string>>({})
  const [cardPickerResults, setCardPickerResults] = useState<Record<string, any[]>>({})
  const [cardPickerLoading, setCardPickerLoading] = useState<Record<string, boolean>>({})
  const [cardPickerSelected, setCardPickerSelected] = useState<Record<string, any | null>>({})

  useEffect(() => {
    checkAdminAuth().then((authenticated) => {
      setIsAuthenticated(authenticated)
      if (authenticated) {
        fetchUsers()
        fetchPvPData()
        fetchPvPLogs()
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
      const [rules, locations] = await Promise.all([
        getPvPRules(),
        getPvPLocations()
      ])
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

  // Lazy-load data when a tab is opened
  useEffect(() => {
    if (activeTab === 'mail' && !mailLoaded && isAuthenticated) {
      fetchSimpleUsers()
    }
    if (activeTab === 'events' && !bannersLoaded && isAuthenticated) {
      fetchBanners()
    }
    if (activeTab === 'battle_logs' && !logsLoaded && isAuthenticated) {
      fetchPvPLogs()
    }
  }, [activeTab, isAuthenticated, mailLoaded, bannersLoaded, logsLoaded])

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

  const handleCreateLocation = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const location = await createPvPLocation(newLocation, selectedRuleIds)
      setPvPLocations(prev => [location, ...prev])
      setShowAddLocation(false)
      setNewLocation({
        name: '',
        name_ru: '',
        description: '',
        description_ru: '',
        is_empty: false
      })
      setSelectedRuleIds([])
    } catch (err) {
      console.error("Failed to create location:", err)
    }
  }

  // ===== Mail handlers =====
  const handleSendMail = async () => {
    if (!mailTargetUserId) {
      toast.error("Выберите получателя")
      return
    }
    if (!mailTitle.trim()) {
      toast.error("Введите заголовок")
      return
    }
    try {
      setIsMailSending(true)
      if (mailType === "card_gift") {
        let cardPayload: any = null
        if (mailCardJson.trim()) {
          try {
            cardPayload = JSON.parse(mailCardJson)
          } catch {
            toast.error("Неверный JSON карты")
            setIsMailSending(false)
            return
          }
        } else {
          toast.error("Вставьте JSON карты для подарка")
          setIsMailSending(false)
          return
        }
        await adminGiftCardToUser(mailTargetUserId, cardPayload, mailTitle, mailBody || undefined)
      } else {
        await adminSendMail({
          userId: mailTargetUserId,
          type: mailType,
          title: mailTitle,
          body: mailBody || undefined,
          amount: (mailType === "coins" || mailType === "dust") ? mailAmount : undefined,
        })
      }
      toast.success("Письмо отправлено!")
      setMailTitle("")
      setMailBody("")
      setMailCardJson("")
      setMailAmount(0)
    } catch (err) {
      console.error("Failed to send mail:", err)
      toast.error("Ошибка при отправке письма")
    } finally {
      setIsMailSending(false)
    }
  }

  const handleSendMailBulk = async () => {
    if (simpleUsers.length === 0) {
      toast.error("Нет пользователей для рассылки")
      return
    }
    if (!mailTitle.trim()) {
      toast.error("Введите заголовок")
      return
    }
    if (mailType === "card_gift" && !mailCardJson.trim()) {
      toast.error("Вставьте JSON карты для подарка")
      return
    }
    try {
      setIsMailSending(true)
      let cardPayload: any = null
      if (mailType === "card_gift") {
        try {
          cardPayload = JSON.parse(mailCardJson)
        } catch {
          toast.error("Неверный JSON карты")
          setIsMailSending(false)
          return
        }
      }
      const result = await adminSendMailBulk({
        userIds: simpleUsers.map(u => u.id),
        type: mailType,
        title: mailTitle,
        body: mailBody || undefined,
        amount: (mailType === "coins" || mailType === "dust") ? mailAmount : undefined,
        cardPayload: cardPayload || undefined,
      })
      toast.success(`Отправлено ${result.sent} писем!`)
    } catch (err) {
      console.error("Failed to bulk send mail:", err)
      toast.error("Ошибка при массовой рассылке")
    } finally {
      setIsMailSending(false)
    }
  }

  // ===== Push notification handlers =====
  const handleSendPush = async () => {
    if (!pushTargetUserId) {
      toast.error("Выберите получателя")
      return
    }
    if (!pushTitle.trim()) {
      toast.error("Введите заголовок уведомления")
      return
    }
    try {
      setIsPushSending(true)
      const result = await adminSendPushNotification(pushTargetUserId, pushTitle, pushBody || undefined, pushUrl || undefined)
      if (result.total === 0) {
        toast.info("У пользователя нет активных push-подписок")
      } else {
        toast.success(`Отправлено ${result.sent} из ${result.total} уведомлений`)
      }
      setPushTitle("")
      setPushBody("")
      setPushUrl("")
    } catch (err) {
      console.error("Failed to send push:", err)
      toast.error("Ошибка при отправке push-уведомления")
    } finally {
      setIsPushSending(false)
    }
  }

  const handleSendPushBulk = async () => {
    if (simpleUsers.length === 0) {
      toast.error("Нет пользователей для рассылки")
      return
    }
    if (!pushTitle.trim()) {
      toast.error("Введите заголовок уведомления")
      return
    }
    try {
      setIsPushSending(true)
      const result = await adminSendPushNotificationBulk(
        simpleUsers.map(u => u.id),
        pushTitle,
        pushBody || undefined,
        pushUrl || undefined
      )
      if (result.total === 0) {
        toast.info("Нет активных push-подписок у пользователей")
      } else {
        toast.success(`Отправлено ${result.sent} из ${result.total} уведомлений`)
      }
      setPushTitle("")
      setPushBody("")
      setPushUrl("")
    } catch (err) {
      console.error("Failed to bulk send push:", err)
      toast.error("Ошибка при массовой отправке push-уведомлений")
    } finally {
      setIsPushSending(false)
    }
  }

  // ===== Banner handlers =====
  const handleCreateBanner = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const featuredIds = newBanner.featured_anime_ids
        .split(",")
        .map(s => parseInt(s.trim()))
        .filter(n => !isNaN(n))
      let guaranteedCardPayload: any = null
      const guaranteedJsonStr = newBanner.guaranteed_card_json?.trim()
      if (guaranteedJsonStr) {
        try {
          guaranteedCardPayload = JSON.parse(guaranteedJsonStr)
        } catch {
          toast.error("Неверный JSON гарантированной карты")
          return
        }
      }
      const created = await createBanner({
        name: newBanner.name,
        description: newBanner.description || undefined,
        image_url: newBanner.image_url || undefined,
        promo_image_url: newBanner.promo_image_url || undefined,
        featured_anime_ids: featuredIds.length ? featuredIds : undefined,
        boosted_rarity: newBanner.boosted_rarity || undefined,
        price: newBanner.price ? parseFloat(newBanner.price) : undefined,
        color: newBanner.color || undefined,
        start_date: newBanner.start_date ? new Date(newBanner.start_date).toISOString() : undefined,
        end_date: newBanner.end_date ? new Date(newBanner.end_date).toISOString() : undefined,
        is_active: newBanner.is_active,
        sort_order: newBanner.sort_order,
        guaranteed_card_payload: guaranteedCardPayload || undefined,
        guaranteed_card_pity: newBanner.guaranteed_card_pity ? parseInt(newBanner.guaranteed_card_pity) : 0,
        banner_type: newBanner.banner_type,
      })
      if (created) setBanners(prev => [created, ...prev])
      setShowCreateBanner(false)
      setNewBanner({
        name: "", description: "", image_url: "", promo_image_url: "", featured_anime_ids: "",
        boosted_rarity: "", price: "", color: "from-purple-600 to-pink-700",
        start_date: "", end_date: "", is_active: true, sort_order: 0,
        guaranteed_card_json: "", guaranteed_card_pity: "",
        banner_type: "standard",
      })
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
      name: banner.name,
      description: banner.description || "",
      image_url: banner.image_url || "",
      promo_image_url: banner.promo_image_url || "",
      featured_anime_ids: (banner.featured_anime_ids || []).join(", "),
      boosted_rarity: (banner.boosted_rarity as Rarity) || "",
      price: banner.price != null ? String(banner.price) : "",
      color: banner.color || "from-purple-600 to-pink-700",
      start_date: startDate,
      end_date: endDate,
      is_active: banner.is_active ?? true,
      sort_order: banner.sort_order ?? 0,
      guaranteed_card_json: banner.guaranteed_card_payload ? JSON.stringify(banner.guaranteed_card_payload, null, 2) : "",
      guaranteed_card_pity: banner.guaranteed_card_pity ? String(banner.guaranteed_card_pity) : "",
      banner_type: (banner.banner_type as "standard" | "dynamic") || "standard",
    })
    setEditingBannerId(banner.id)
  }

  const handleSaveEditBanner = async () => {
    if (!editingBannerId || !editBanner) return
    try {
      const featuredIds = editBanner.featured_anime_ids
        .split(",")
        .map(s => parseInt(s.trim()))
        .filter(n => !isNaN(n))
      let guaranteedCardPayload: any = null
      const guaranteedJsonStr = editBanner.guaranteed_card_json?.trim()
      if (guaranteedJsonStr) {
        try {
          guaranteedCardPayload = JSON.parse(guaranteedJsonStr)
        } catch {
          toast.error("Неверный JSON гарантированной карты")
          return
        }
      }
      const updated = await updateBanner(editingBannerId, {
        name: editBanner.name,
        description: editBanner.description || null,
        image_url: editBanner.image_url || null,
        promo_image_url: editBanner.promo_image_url || null,
        featured_anime_ids: featuredIds,
        boosted_rarity: editBanner.boosted_rarity || null,
        price: editBanner.price ? parseFloat(editBanner.price) : null,
        color: editBanner.color || null,
        start_date: editBanner.start_date ? new Date(editBanner.start_date).toISOString() : null,
        end_date: editBanner.end_date ? new Date(editBanner.end_date).toISOString() : null,
        is_active: editBanner.is_active,
        sort_order: editBanner.sort_order,
        guaranteed_card_payload: guaranteedCardPayload || null,
        guaranteed_card_pity: editBanner.guaranteed_card_pity ? parseInt(editBanner.guaranteed_card_pity) : 0,
        banner_type: editBanner.banner_type,
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
    if (!jsonStr.trim()) {
      toast.error("Вставьте JSON карты")
      return
    }
    let cardPayload: any
    try {
      cardPayload = JSON.parse(jsonStr)
    } catch {
      toast.error("Неверный JSON карты")
      return
    }
    try {
      const created = await addBannerCard({
        bannerId,
        cardPayload,
        weight: newBannerCardWeight[bannerId] ?? 1,
        isFeatured: newBannerCardFeatured[bannerId] ?? false,
      })
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
    if (expandedBannerId === bannerId) {
      setExpandedBannerId(null)
      return
    }
    setExpandedBannerId(bannerId)
    if (!bannerCards[bannerId]) {
      fetchBannerCards(bannerId)
    }
  }

  const handleCardPickerSearch = async (bannerId: string, banner: Banner) => {
    const source = cardPickerSource[bannerId] ?? "shikimori"
    const query = cardPickerQuery[bannerId] || undefined
    setCardPickerLoading(prev => ({ ...prev, [bannerId]: true }))
    try {
      if (source === "shikimori") {
        const animeIds = banner.featured_anime_ids || []
        if (animeIds.length === 0) {
          toast.error("У баннера нет featured anime IDs — добавьте ID аниме в настройках")
          setCardPickerResults(prev => ({ ...prev, [bannerId]: [] }))
          return
        }
        const results = await searchCharactersForBanner(animeIds, query)
        setCardPickerResults(prev => ({ ...prev, [bannerId]: results }))
        if (results.length === 0) toast.info("Персонажи не найдены")
      } else {
        const results = await searchUserCardsForBanner(query)
        setCardPickerResults(prev => ({ ...prev, [bannerId]: results }))
        if (results.length === 0) toast.info("Карты в БД не найдены")
      }
    } catch (err) {
      console.error("Card picker search failed:", err)
      toast.error("Ошибка поиска персонажей")
    } finally {
      setCardPickerLoading(prev => ({ ...prev, [bannerId]: false }))
    }
  }

  const handleAddCardFromPicker = async (bannerId: string) => {
    const selected = cardPickerSelected[bannerId]
    if (!selected) {
      toast.error("Выберите карту из списка")
      return
    }
    try {
      const created = await addBannerCard({
        bannerId,
        cardPayload: selected,
        weight: newBannerCardWeight[bannerId] ?? 1,
        isFeatured: newBannerCardFeatured[bannerId] ?? false,
      })
      setBannerCards(prev => ({ ...prev, [bannerId]: [created, ...(prev[bannerId] || [])] }))
      setCardPickerSelected(prev => ({ ...prev, [bannerId]: null }))
      setNewBannerCardWeight(prev => ({ ...prev, [bannerId]: 1 }))
      setNewBannerCardFeatured(prev => ({ ...prev, [bannerId]: false }))
      toast.success("Карта добавлена в баннер!")
    } catch (err) {
      console.error("Failed to add card from picker:", err)
      toast.error("Ошибка при добавлении карты")
    }
  }

  const filteredUsers = users.filter(user => 
    user.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.id.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never'
    return new Date(dateString).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
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
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-3 py-2 bg-muted border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary text-foreground"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-muted border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary text-foreground"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isPending}
                className="w-full py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors font-medium disabled:opacity-50"
              >
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
            <button 
              onClick={fetchUsers}
              className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto p-3 sm:p-4 md:p-6 lg:p-8">
        {/* Header */}
        <div className="flex flex-col gap-4 mb-6 md:mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground mb-1 md:mb-2">Admin Dashboard</h1>
            </div>
            <div className="flex gap-2 sm:gap-4 items-center">
              <div className="text-xs sm:text-sm text-muted-foreground hidden sm:block">
                Total Users: {users.length}
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-muted hover:bg-muted/80 rounded transition text-sm"
                disabled={isPending}
              >
                <LogOut size={16} />
                {isPending ? "..." : "Logout"}
              </button>
            </div>
          </div>
          {/* Tabs - horizontally scrollable on mobile */}
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-thin">
              <button
                onClick={() => setActiveTab('users')}
                className={`text-xs sm:text-sm px-3 sm:px-4 py-2 rounded-lg transition whitespace-nowrap ${activeTab === 'users' ? 'bg-primary text-primary-foreground font-semibold' : 'text-muted-foreground hover:bg-muted'}`}
              >
                Users
              </button>
              <button
                onClick={() => setActiveTab('pvp')}
                className={`text-xs sm:text-sm px-3 sm:px-4 py-2 rounded-lg transition whitespace-nowrap ${activeTab === 'pvp' ? 'bg-primary text-primary-foreground font-semibold' : 'text-muted-foreground hover:bg-muted'}`}
              >
                PvP
              </button>
              <button
                onClick={() => setActiveTab('battle_logs')}
                className={`text-xs sm:text-sm px-3 sm:px-4 py-2 rounded-lg transition whitespace-nowrap ${activeTab === 'battle_logs' ? 'bg-primary text-primary-foreground font-semibold' : 'text-muted-foreground hover:bg-muted'}`}
              >
                Battle Logs
              </button>
              <button
                onClick={() => setActiveTab('cards')}
                className={`text-xs sm:text-sm px-3 sm:px-4 py-2 rounded-lg transition whitespace-nowrap ${activeTab === 'cards' ? 'bg-primary text-primary-foreground font-semibold' : 'text-muted-foreground hover:bg-muted'}`}
              >
                Карты
              </button>
              <button
                onClick={() => setActiveTab('mail')}
                className={`text-xs sm:text-sm px-3 sm:px-4 py-2 rounded-lg transition whitespace-nowrap ${activeTab === 'mail' ? 'bg-primary text-primary-foreground font-semibold' : 'text-muted-foreground hover:bg-muted'}`}
              >
                Рассылка
              </button>
              <button
                onClick={() => setActiveTab('events')}
                className={`text-xs sm:text-sm px-3 sm:px-4 py-2 rounded-lg transition whitespace-nowrap ${activeTab === 'events' ? 'bg-primary text-primary-foreground font-semibold' : 'text-muted-foreground hover:bg-muted'}`}
              >
                События
              </button>
              <button
                onClick={() => setActiveTab('tutorial')}
                className={`text-xs sm:text-sm px-3 sm:px-4 py-2 rounded-lg transition whitespace-nowrap ${activeTab === 'tutorial' ? 'bg-primary text-primary-foreground font-semibold' : 'text-muted-foreground hover:bg-muted'}`}
              >
                Туториал
              </button>
            </div>
        </div>

        {activeTab === 'users' ? (
          <>
            {/* Search */}
            <div className="mb-4 sm:mb-6">
              <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={20} />
                <input
                  type="text"
                  placeholder="Search users by username or ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-muted border border-border rounded focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            {/* Users Grid */}
            <div className="grid gap-3 sm:gap-4 md:gap-6">
              {filteredUsers.map((user) => (
                <div key={user.id} className="bg-card border border-border rounded-lg p-4 sm:p-6 hover:bg-card/80 transition">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4 mb-4">
                    <div className="flex items-center gap-3 sm:gap-4">
                      {/* Avatar */}
                      <div className="relative">
                        {user.avatar_url ? (
                          <Image
                            src={user.avatar_url}
                            alt={user.username || 'User'}
                            width={48}
                            height={48}
                            className="rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center">
                            <User size={24} className="text-muted-foreground" />
                          </div>
                        )}
                      </div>
                      
                      {/* User Info */}
                      <div>
                        <h3 className="font-semibold text-foreground">
                          {user.username || 'Unknown User'}
                        </h3>
                        <p className="text-sm text-muted-foreground font-mono">
                          ID: {user.id}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Last active: {formatDate(user.lastActivity)}
                        </p>
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="flex gap-4 sm:gap-6 text-sm">
                      <div className="text-center">
                        <div className="flex items-center gap-1 text-foreground font-semibold">
                          <Eye size={16} />
                          {user.watchHistoryCount}
                        </div>
                        <div className="text-[10px] sm:text-xs text-muted-foreground">History</div>
                      </div>
                      <div className="text-center">
                        <div className="flex items-center gap-1 text-foreground font-semibold">
                          <Bookmark size={16} />
                          {user.bookmarksCount}
                        </div>
                        <div className="text-[10px] sm:text-xs text-muted-foreground">Bookmarks</div>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setSelectedUser(selectedUser?.id === user.id ? null : user)
                        setShowAllHistory(false)
                        setShowAllBookmarks(false)
                      }}
                      className="px-3 py-1 bg-primary text-primary-foreground text-sm rounded hover:bg-primary/90 transition"
                    >
                      {selectedUser?.id === user.id ? 'Hide Details' : 'View Details'}
                    </button>
                  </div>

                  {/* Detailed View */}
                  {selectedUser?.id === user.id && (
                    <div className="mt-4 sm:mt-6 pt-4 sm:pt-6 border-t border-border space-y-4 sm:space-y-6">
                      {/* Recent Watch History */}
                      {(showAllHistory ? user.allHistory : user.recentHistory.slice(0, 5)).length > 0 && (
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="font-semibold text-foreground flex items-center gap-2">
                              <Eye size={16} />
                              Watch History {showAllHistory ? `(${user.allHistory.length})` : `(Recent 5)`}
                            </h4>
                            {user.allHistory.length > 5 && (
                              <button
                                onClick={() => setShowAllHistory(!showAllHistory)}
                                className="text-sm text-primary hover:text-primary/80 transition"
                              >
                                {showAllHistory ? 'Show Less' : `Show All (${user.allHistory.length})`}
                              </button>
                            )}
                          </div>
                          <div className="grid gap-2 max-h-80 sm:max-h-96 overflow-y-auto">
                            {(showAllHistory ? user.allHistory : user.recentHistory.slice(0, 5)).map((item) => (
                              <div key={item.id} className="flex items-center gap-2 sm:gap-3 p-2 bg-muted/50 rounded hover:bg-muted/70 transition">
                                {item.poster && (
                                  <Image
                                    src={item.poster}
                                    alt={item.title}
                                    width={32}
                                    height={32}
                                    className="rounded object-cover flex-shrink-0"
                                  />
                                )}
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-foreground truncate">{item.title}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {item.episode ? `Episode ${item.episode}` : 'Started watching'} • {formatTimestamp(item.timestamp)}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Recent Bookmarks */}
                      {(showAllBookmarks ? user.allBookmarks : user.recentBookmarks.slice(0, 5)).length > 0 && (
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="font-semibold text-foreground flex items-center gap-2">
                              <Bookmark size={16} />
                              Bookmarks {showAllBookmarks ? `(${user.allBookmarks.length})` : `(Recent 5)`}
                            </h4>
                            {user.allBookmarks.length > 5 && (
                              <button
                                onClick={() => setShowAllBookmarks(!showAllBookmarks)}
                                className="text-sm text-primary hover:text-primary/80 transition"
                              >
                                {showAllBookmarks ? 'Show Less' : `Show All (${user.allBookmarks.length})`}
                              </button>
                            )}
                          </div>
                          <div className="grid gap-2 max-h-80 sm:max-h-96 overflow-y-auto">
                            {(showAllBookmarks ? user.allBookmarks : user.recentBookmarks.slice(0, 5)).map((item) => (
                              <div key={item.id} className="flex items-center gap-2 sm:gap-3 p-2 bg-muted/50 rounded hover:bg-muted/70 transition">
                                {item.anime_data?.poster && (
                                  <Image
                                    src={item.anime_data.poster}
                                    alt={item.anime_data?.title || 'Untitled'}
                                    width={32}
                                    height={32}
                                    className="rounded object-cover flex-shrink-0"
                                  />
                                )}
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-foreground truncate">
                                    {item.anime_data?.title || 'Untitled'}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    Bookmarked on {formatDate(item.created_at)}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* AI Learning Stats */}
                      {user.aiStats && user.aiStats.total_battles > 0 && (
                        <div>
                          <h4 className="font-semibold text-foreground flex items-center gap-2 mb-3">
                            <Brain size={16} />
                            AI Learning Statistics
                          </h4>
                          <div className="bg-muted/50 rounded-lg p-4 space-y-4">
                            {/* Basic Stats */}
                            <div className="grid grid-cols-2 gap-3 sm:gap-4">
                              <div>
                                <p className="text-xs text-muted-foreground mb-1">Total Battles</p>
                                <p className="text-lg font-semibold text-foreground">{user.aiStats.total_battles}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground mb-1">Last Battle</p>
                                <p className="text-sm text-foreground">
                                  {user.aiStats.last_battle_date ? formatDate(user.aiStats.last_battle_date) : 'Never'}
                                </p>
                              </div>
                            </div>

                            {/* Playstyle Ratings */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                              <div>
                                <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                                  <Sword size={12} />
                                  Aggressive
                                </p>
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                                    <div 
                                      className="h-full bg-red-500 transition-all"
                                      style={{ width: `${user.aiStats.aggressive_rating * 100}%` }}
                                    />
                                  </div>
                                  <span className="text-sm font-medium text-foreground">
                                    {(user.aiStats.aggressive_rating * 100).toFixed(0)}%
                                  </span>
                                </div>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                                  <Shield size={12} />
                                  Defensive
                                </p>
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                                    <div 
                                      className="h-full bg-blue-500 transition-all"
                                      style={{ width: `${user.aiStats.defensive_rating * 100}%` }}
                                    />
                                  </div>
                                  <span className="text-sm font-medium text-foreground">
                                    {(user.aiStats.defensive_rating * 100).toFixed(0)}%
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Preferred Roles */}
                            <div>
                              <p className="text-xs text-muted-foreground mb-2">Preferred Roles</p>
                              <div className="flex gap-2 flex-wrap">
                                {Object.entries(user.aiStats.preferred_roles).map(([role, count]) => (
                                  count > 0 && (
                                    <span key={role} className="px-2 py-1 bg-primary/20 text-primary text-xs rounded capitalize">
                                      {role}: {count}
                                    </span>
                                  )
                                ))}
                              </div>
                            </div>

                            {/* Preferred Rarities */}
                            <div>
                              <p className="text-xs text-muted-foreground mb-2">Preferred Rarities</p>
                              <div className="flex gap-2 flex-wrap">
                                {Object.entries(user.aiStats.preferred_rarities)
                                  .sort(([, a], [, b]) => b - a)
                                  .slice(0, 5)
                                  .map(([rarity, count]) => (
                                    <span key={rarity} className="px-2 py-1 bg-secondary/50 text-foreground text-xs rounded capitalize">
                                      {rarity}: {count}
                                    </span>
                                  ))}
                              </div>
                            </div>

                            {/* Favorite Cards */}
                            {user.aiStats.favorite_cards.length > 0 && (
                              <div>
                                <p className="text-xs text-muted-foreground mb-2">Top Favorite Cards</p>
                                <div className="space-y-2 max-h-48 overflow-y-auto">
                                  {user.aiStats.favorite_cards.slice(0, 5).map((card: any) => (
                                    <div key={card.cardId} className="flex items-center justify-between p-2 bg-muted rounded">
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-foreground truncate">{card.cardName}</p>
                                        <p className="text-xs text-muted-foreground">
                                          {card.anime} • {card.rarity} • {card.role}
                                        </p>
                                      </div>
                                      <div className="text-right ml-2">
                                        <p className="text-sm font-semibold text-foreground">{card.usageCount}x</p>
                                        <p className="text-xs text-muted-foreground">
                                          WR: {(card.winRate * 100).toFixed(0)}%
                                        </p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Avg Provision Cost */}
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Average Provision Cost</p>
                              <p className="text-lg font-semibold text-foreground">{user.aiStats.avg_provision_cost.toFixed(1)}</p>
                            </div>
                          </div>
                        </div>
                      )}

                      {user.allHistory.length === 0 && user.allBookmarks.length === 0 && (!user.aiStats || user.aiStats.total_battles === 0) && (
                        <p className="text-center text-muted-foreground py-4">
                          No recent activity
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {filteredUsers.length === 0 && !loading && (
              <div className="text-center py-12">
                <Users size={48} className="mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No users found matching your search</p>
              </div>
            )}
          </>
        ) : activeTab === 'pvp' ? (
          <div className="space-y-8 sm:space-y-12">
            {/* PvP Rules Section */}
            <section>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 sm:mb-6">
                <h2 className="text-lg sm:text-2xl font-bold flex items-center gap-2">
                  <Settings size={24} className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
                  PvP Rules (Modifiers)
                </h2>
                <div className="text-xs sm:text-sm text-muted-foreground">
                  {pvpRules.filter(r => r.is_active).length} active / {pvpRules.length} total
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {pvpRules.map((rule) => (
                  <div key={rule.id} className={`p-4 rounded-lg border transition ${rule.is_active ? 'bg-card border-primary/20' : 'bg-muted/50 border-transparent opacity-60'}`}>
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold text-sm">{rule.name_ru}</h3>
                      <button
                        onClick={() => handleToggleRule(rule.id, rule.is_active)}
                        className={`w-10 h-5 rounded-full relative transition-colors ${rule.is_active ? 'bg-primary' : 'bg-muted'}`}
                      >
                        <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${rule.is_active ? 'left-6' : 'left-1'}`} />
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{rule.description_ru}</p>
                    <div className="text-[10px] uppercase tracking-wider text-primary font-bold">{rule.category}</div>
                  </div>
                ))}
              </div>
            </section>

            {/* PvP Locations Section */}
            <section>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 sm:mb-6">
                <h2 className="text-lg sm:text-2xl font-bold flex items-center gap-2">
                  <Map size={24} className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
                  Custom Locations
                </h2>
                <button
                  onClick={() => setShowAddLocation(true)}
                  className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition text-sm w-fit"
                >
                  <Plus size={18} />
                  Add Location
                </button>
              </div>

              {showAddLocation && (
                <div className="bg-card border border-primary/30 rounded-xl p-4 sm:p-6 mb-6 sm:mb-8 shadow-xl">
                  <form onSubmit={handleCreateLocation} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1 uppercase">Name (Internal)</label>
                        <input
                          type="text"
                          required
                          value={newLocation.name}
                          onChange={(e) => setNewLocation({...newLocation, name: e.target.value})}
                          placeholder="e.g. leaf_village"
                          className="w-full px-3 py-2 bg-muted border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1 uppercase">Name (Russian)</label>
                        <input
                          type="text"
                          required
                          value={newLocation.name_ru}
                          onChange={(e) => setNewLocation({...newLocation, name_ru: e.target.value})}
                          placeholder="e.g. Деревня Листа"
                          className="w-full px-3 py-2 bg-muted border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary text-sm"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1 uppercase">Description (Internal)</label>
                        <textarea
                          required
                          value={newLocation.description}
                          onChange={(e) => setNewLocation({...newLocation, description: e.target.value})}
                          className="w-full px-3 py-2 bg-muted border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary text-sm h-20"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1 uppercase">Description (Russian)</label>
                        <textarea
                          required
                          value={newLocation.description_ru}
                          onChange={(e) => setNewLocation({...newLocation, description_ru: e.target.value})}
                          className="w-full px-3 py-2 bg-muted border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary text-sm h-20"
                        />
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 mb-4">
                      <input
                        type="checkbox"
                        id="is_empty"
                        checked={newLocation.is_empty}
                        onChange={(e) => setNewLocation({...newLocation, is_empty: e.target.checked})}
                      />
                      <label htmlFor="is_empty" className="text-sm cursor-pointer">Neutral Location (No rules)</label>
                    </div>

                    {!newLocation.is_empty && (
                      <div className="space-y-2">
                        <label className="block text-xs font-medium text-muted-foreground mb-1 uppercase">Select Rules (Max 1 per location usually)</label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 max-h-48 overflow-y-auto p-2 border border-border rounded bg-muted/30">
                          {pvpRules.filter(r => r.is_active).map(rule => (
                            <div 
                              key={rule.id}
                              onClick={() => {
                                if (selectedRuleIds.includes(rule.id)) {
                                  setSelectedRuleIds(prev => prev.filter(id => id !== rule.id))
                                } else {
                                  setSelectedRuleIds(prev => [...prev, rule.id])
                                }
                              }}
                              className={`p-2 rounded text-[10px] cursor-pointer transition flex items-center justify-between ${selectedRuleIds.includes(rule.id) ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted-foreground/10'}`}
                            >
                              <span className="truncate">{rule.name_ru}</span>
                              {selectedRuleIds.includes(rule.id) && <Check size={10} />}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4">
                      <button
                        type="button"
                        onClick={() => setShowAddLocation(false)}
                        className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-6 py-2 bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-primary/90 transition shadow-lg"
                      >
                        Create Location
                      </button>
                    </div>
                  </form>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                {pvpLocations.map((loc) => (
                  <div key={loc.id} className="bg-card border border-border rounded-xl p-4 sm:p-6 shadow-sm group">
                    <div className="flex items-start justify-between mb-4">
                      <div className="min-w-0 flex-1">
                        <h3 className="text-lg sm:text-xl font-bold flex items-center gap-2">
                          {loc.name_ru}
                          {loc.is_empty && <span className="text-[10px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full uppercase tracking-tighter">Neutral</span>}
                        </h3>
                        <p className="text-sm text-muted-foreground italic">{loc.name}</p>
                      </div>
                      <button
                        onClick={() => handleDeleteLocation(loc.id)}
                        className="p-2 text-muted-foreground hover:text-destructive transition sm:opacity-0 sm:group-hover:opacity-100 flex-shrink-0"
                      >
                        <Trash2 size={20} />
                      </button>
                    </div>
                    <p className="text-sm mb-4 line-clamp-3 break-words">{loc.description_ru}</p>
                    
                    <div className="flex flex-wrap gap-2">
                      {loc.rules.map((ruleMapping: any) => {
                        const rule = pvpRules.find(r => r.id === ruleMapping.rule_id)
                        return (
                          <span key={ruleMapping.rule_id} className="text-[10px] bg-primary/10 text-primary border border-primary/20 px-2 py-1 rounded-md font-semibold">
                            {rule?.name_ru || ruleMapping.rule_id}
                          </span>
                        )
                      })}
                      {loc.rules.length === 0 && !loc.is_empty && (
                        <span className="text-[10px] text-destructive font-bold uppercase">No rules assigned</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        ) : activeTab === 'battle_logs' ? (
          <div className="space-y-4 sm:space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h2 className="text-lg sm:text-2xl font-bold flex items-center gap-2">
                <History size={24} className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
                PvP Battle Logs
              </h2>
              <button
                onClick={fetchPvPLogs}
                className="text-sm text-primary hover:underline w-fit"
                disabled={isLogsLoading}
              >
                Refresh
              </button>
            </div>

            {isLogsLoading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : logsError ? (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-4">
                <p className="text-sm text-red-500 font-medium">Ошибка загрузки логов: {logsError}</p>
                <button onClick={fetchPvPLogs} className="mt-2 text-xs text-red-400 hover:underline">Попробовать снова</button>
              </div>
            ) : (
              <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[700px]">
                  <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-3 sm:px-6 py-3 sm:py-4 font-semibold">Match ID / Time</th>
                      <th className="px-3 sm:px-6 py-3 sm:py-4 font-semibold">Player 1</th>
                      <th className="px-3 sm:px-6 py-3 sm:py-4 font-semibold">Player 2</th>
                      <th className="px-3 sm:px-6 py-3 sm:py-4 font-semibold">Winner</th>
                      <th className="px-3 sm:px-6 py-3 sm:py-4 font-semibold">Duration</th>
                      <th className="px-3 sm:px-6 py-3 sm:py-4 font-semibold">Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {pvpLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-muted/30 transition text-sm">
                        <td className="px-3 sm:px-6 py-3 sm:py-4">
                          <div className="font-mono text-[10px] text-muted-foreground mb-1 truncate max-w-[100px]">{log.id}</div>
                          <div className="text-xs">{formatDate(log.created_at)}</div>
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4">
                          <div className="flex items-center gap-2">
                            {log.player1.avatar_url && (
                              <Image src={log.player1.avatar_url} alt="" width={24} height={24} className="rounded-full" />
                            )}
                            <div className="flex flex-col">
                              <span className="font-medium truncate max-w-[80px]">{log.player1.username || 'P1'}</span>
                              <span className="text-[10px] text-muted-foreground">{log.player1_mmr_before} → {log.player1_mmr_after}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4">
                          <div className="flex items-center gap-2">
                            {log.player2.avatar_url && (
                              <Image src={log.player2.avatar_url} alt="" width={24} height={24} className="rounded-full" />
                            )}
                            <div className="flex flex-col">
                              <span className="font-medium truncate max-w-[80px]">{log.player2.username || 'P2'}</span>
                              <span className="text-[10px] text-muted-foreground">{log.player2_mmr_before} → {log.player2_mmr_after}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4">
                          {log.winner_id ? (
                            <div className="flex items-center gap-1 text-emerald-500 font-bold">
                              <Trophy size={14} />
                              <span className="truncate max-w-[80px]">
                                {log.winner_id === log.player1_id ? (log.player1.username || 'P1') : (log.player2.username || 'P2')}
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">Draw</span>
                          )}
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 text-muted-foreground">
                          {log.duration_seconds}s
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            log.battle_data?.reason === 'complete' ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20' : 
                            log.battle_data?.reason === 'disconnect' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' :
                            'bg-muted text-muted-foreground'
                          }`}>
                            {log.battle_data?.reason || 'unknown'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
                {pvpLogs.length === 0 && (
                  <div className="py-12 text-center text-muted-foreground">
                    No battle logs found
                  </div>
                )}
              </div>
            )}
          </div>
        ) : activeTab === 'cards' ? (
          <div className="space-y-4 sm:space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg sm:text-2xl font-bold flex items-center gap-2">
                <Sparkles size={24} className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
                Редактор карт
              </h2>
            </div>
            <div className="bg-card border border-border rounded-xl p-4 sm:p-8 text-center space-y-4 sm:space-y-6">
              <Sparkles size={48} className="text-primary mx-auto" />
              <div className="space-y-2">
                <h3 className="text-xl font-bold">Создание и редактирование карт</h3>
                <p className="text-muted-foreground max-w-xl mx-auto">
                  Откройте редактор карт, чтобы создать новую карту с 3D-слоями, статами и модификаторами.
                  Готовую карту можно подарить пользователю или добавить в баннер события.
                </p>
              </div>
              <Link
                href="/admin/card-editor"
                className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-primary/90 transition"
              >
                <Sparkles size={20} />
                Открыть редактор карт
              </Link>
            </div>
          </div>
        ) : activeTab === 'mail' ? (
          <div className="space-y-4 sm:space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h2 className="text-lg sm:text-2xl font-bold flex items-center gap-2">
                <Mail size={24} className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
                Рассылка и подарки
              </h2>
              <button
                onClick={fetchSimpleUsers}
                className="text-sm text-primary hover:underline w-fit"
              >
                Обновить список
              </button>
            </div>

            <div className="bg-card border border-border rounded-xl p-4 sm:p-6 space-y-4">
              {/* Recipient */}
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1 uppercase">Получатель</label>
                <select
                  value={mailTargetUserId}
                  onChange={(e) => setMailTargetUserId(e.target.value)}
                  className="w-full px-3 py-2 bg-muted border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary text-sm"
                >
                  <option value="">Выберите пользователя...</option>
                  {simpleUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.username || "Без имени"} {u.email ? `(${u.email})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              {/* Type */}
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1 uppercase">Тип письма</label>
                <select
                  value={mailType}
                  onChange={(e) => setMailType(e.target.value as MailType)}
                  className="w-full px-3 py-2 bg-muted border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary text-sm"
                >
                  <option value="message">Сообщение (message)</option>
                  <option value="card_gift">Подарок карты (card_gift)</option>
                  <option value="coins">Монеты (coins)</option>
                  <option value="dust">Пыль (dust)</option>
                  <option value="event_reward">Награда события (event_reward)</option>
                </select>
              </div>

              {/* Title */}
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1 uppercase">Заголовок</label>
                <input
                  type="text"
                  value={mailTitle}
                  onChange={(e) => setMailTitle(e.target.value)}
                  placeholder="Заголовок письма..."
                  className="w-full px-3 py-2 bg-muted border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary text-sm"
                />
              </div>

              {/* Body */}
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1 uppercase">Текст письма</label>
                <textarea
                  value={mailBody}
                  onChange={(e) => setMailBody(e.target.value)}
                  placeholder="Текст письма..."
                  className="w-full px-3 py-2 bg-muted border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary text-sm h-24"
                />
              </div>

              {/* Conditional: amount for coins/dust */}
              {(mailType === "coins" || mailType === "dust") && (
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1 uppercase">
                    Количество ({mailType})
                  </label>
                  <input
                    type="number"
                    value={mailAmount}
                    onChange={(e) => setMailAmount(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-muted border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary text-sm"
                  />
                </div>
              )}

              {/* Conditional: card JSON for card_gift */}
              {mailType === "card_gift" && (
                <div className="space-y-2">
                  <label className="block text-xs font-medium text-muted-foreground mb-1 uppercase">
                    JSON карты
                  </label>
                  <textarea
                    value={mailCardJson}
                    onChange={(e) => setMailCardJson(e.target.value)}
                    placeholder='Вставьте объект Card в формате JSON. Можно получить в редакторе карт...'
                    className="w-full px-3 py-2 bg-muted border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary text-sm h-32 font-mono text-xs"
                  />
                  <p className="text-xs text-muted-foreground">
                    Совет: откройте{" "}
                    <Link href="/admin/card-editor" className="text-primary hover:underline">редактор карт</Link>
                    , чтобы создать карту и скопировать её JSON.
                  </p>
                </div>
              )}

              {/* Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  onClick={handleSendMail}
                  disabled={isMailSending || !mailTargetUserId}
                  className="flex items-center justify-center gap-2 px-6 py-2 bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-primary/90 transition disabled:opacity-50"
                >
                  <Mail size={18} />
                  {isMailSending ? "Отправка..." : "Отправить"}
                </button>
                <button
                  onClick={handleSendMailBulk}
                  disabled={isMailSending}
                  className="flex items-center justify-center gap-2 px-6 py-2 bg-secondary text-secondary-foreground rounded-lg font-semibold hover:bg-secondary/80 transition disabled:opacity-50"
                >
                  <Gift size={18} />
                  {isMailSending ? "Отправка..." : `Отправить всем (${simpleUsers.length})`}
                </button>
              </div>
            </div>

            {/* Push Notifications Section */}
            <div className="border-t border-border pt-4 mt-4">
              <h3 className="text-base font-bold flex items-center gap-2 mb-3">
                <BellRing size={18} className="text-primary" />
                Push-уведомления
              </h3>
              <div className="bg-muted/30 rounded-lg p-4 space-y-3">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1 uppercase">Получатель</label>
                  <select
                    value={pushTargetUserId}
                    onChange={(e) => setPushTargetUserId(e.target.value)}
                    className="w-full px-3 py-2 bg-muted border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary text-sm"
                  >
                    <option value="">Выберите пользователя...</option>
                    {simpleUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.username || "Без имени"} {u.email ? `(${u.email})` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1 uppercase">Заголовок</label>
                  <input
                    type="text"
                    value={pushTitle}
                    onChange={(e) => setPushTitle(e.target.value)}
                    placeholder="Заголовок уведомления..."
                    className="w-full px-3 py-2 bg-muted border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1 uppercase">Текст</label>
                  <textarea
                    value={pushBody}
                    onChange={(e) => setPushBody(e.target.value)}
                    placeholder="Текст уведомления..."
                    className="w-full px-3 py-2 bg-muted border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary text-sm h-20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1 uppercase">URL (опционально)</label>
                  <input
                    type="text"
                    value={pushUrl}
                    onChange={(e) => setPushUrl(e.target.value)}
                    placeholder="/watch/12345 или https://..."
                    className="w-full px-3 py-2 bg-muted border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary text-sm"
                  />
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-1">
                  <button
                    onClick={handleSendPush}
                    disabled={isPushSending || !pushTargetUserId}
                    className="flex items-center justify-center gap-2 px-6 py-2 bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-primary/90 transition disabled:opacity-50"
                  >
                    <Send size={16} />
                    {isPushSending ? "Отправка..." : "Отправить"}
                  </button>
                  <button
                    onClick={handleSendPushBulk}
                    disabled={isPushSending}
                    className="flex items-center justify-center gap-2 px-6 py-2 bg-secondary text-secondary-foreground rounded-lg font-semibold hover:bg-secondary/80 transition disabled:opacity-50"
                  >
                    <BellRing size={16} />
                    {isPushSending ? "Отправка..." : `Всем (${simpleUsers.length})`}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Push-уведомления получают только пользователи с активной подпиской. Устройства с истёкшими подписками удаляются автоматически.
                </p>
              </div>
            </div>
          </div>
        ) : activeTab === 'events' ? (
          <div className="space-y-4 sm:space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h2 className="text-lg sm:text-2xl font-bold flex items-center gap-2">
                <Calendar size={24} className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
                Баннеры и события
              </h2>
              <button
                onClick={() => setShowCreateBanner(!showCreateBanner)}
                className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition text-sm w-fit"
              >
                <Plus size={18} />
                Создать баннер
              </button>
            </div>

            {/* Create banner form */}
            {showCreateBanner && (
              <div className="bg-card border border-primary/30 rounded-xl p-4 sm:p-6 space-y-4">
                <form onSubmit={handleCreateBanner} className="space-y-4">
                  {/* Banner type selector */}
                  <div className="flex gap-2 p-1 bg-muted rounded-lg">
                    <button
                      type="button"
                      onClick={() => setNewBanner({ ...newBanner, banner_type: "standard" })}
                      className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition ${newBanner.banner_type === "standard" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      Стандартный
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewBanner({ ...newBanner, banner_type: "dynamic" })}
                      className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition ${newBanner.banner_type === "dynamic" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      Ивент (Онгоинги)
                    </button>
                  </div>
                  {newBanner.banner_type === "dynamic" && (
                    <div className="p-3 bg-cyan-500/5 border border-cyan-500/20 rounded-lg text-xs text-cyan-300">
                      Баннер будет автоматически выбирать онгоинг-тайтл и его главных персонажей (1-3 ГГ). Тайтл меняется каждые 3 дня. Пул роллов — все онгоинги, гарант — одна из 3 ГГ карт. Название и описание будут показаны вместо автоматических.
                    </div>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1 uppercase">Название *</label>
                      <input
                        type="text"
                        required
                        value={newBanner.name}
                        onChange={(e) => setNewBanner({ ...newBanner, name: e.target.value })}
                        className="w-full px-3 py-2 bg-muted border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1 uppercase">URL фона баннера</label>
                      <input
                        type="text"
                        value={newBanner.image_url}
                        onChange={(e) => setNewBanner({ ...newBanner, image_url: e.target.value })}
                        className="w-full px-3 py-2 bg-muted border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary text-sm"
                        placeholder="https://... (фон карточки баннера)"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1 uppercase">URL промо-арта (шапка 7:5)</label>
                    <input
                      type="text"
                      value={newBanner.promo_image_url}
                      onChange={(e) => setNewBanner({ ...newBanner, promo_image_url: e.target.value })}
                      className="w-full px-3 py-2 bg-muted border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary text-sm"
                      placeholder="https://... (промо-арт для шапки баннера, соотношение 7:5)"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1 uppercase">Описание</label>
                    <textarea
                      value={newBanner.description}
                      onChange={(e) => setNewBanner({ ...newBanner, description: e.target.value })}
                      className="w-full px-3 py-2 bg-muted border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary text-sm h-20"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1 uppercase">Featured anime IDs (через запятую)</label>
                      <input
                        type="text"
                        value={newBanner.featured_anime_ids}
                        onChange={(e) => setNewBanner({ ...newBanner, featured_anime_ids: e.target.value })}
                        placeholder="1, 21, 5114"
                        className="w-full px-3 py-2 bg-muted border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1 uppercase">Буст редкости</label>
                      <select
                        value={newBanner.boosted_rarity}
                        onChange={(e) => setNewBanner({ ...newBanner, boosted_rarity: e.target.value as Rarity | "" })}
                        className="w-full px-3 py-2 bg-muted border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary text-sm"
                      >
                        <option value="">Нет</option>
                        {Object.entries(rarityConfig).map(([key, config]) => (
                          <option key={key} value={key}>{config.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1 uppercase">Цена</label>
                      <input
                        type="number"
                        value={newBanner.price}
                        onChange={(e) => setNewBanner({ ...newBanner, price: e.target.value })}
                        className="w-full px-3 py-2 bg-muted border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary text-sm"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium text-muted-foreground mb-2 uppercase">Цвет (gradient)</label>
                      <div className="flex flex-wrap gap-2">
                        {GRADIENT_PRESETS.map((g) => (
                          <button
                            key={g}
                            type="button"
                            onClick={() => setNewBanner({ ...newBanner, color: g })}
                            className={`relative w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-gradient-to-br ${g} transition-all ${newBanner.color === g ? 'ring-2 ring-primary ring-offset-2 ring-offset-background scale-110' : 'hover:scale-105 opacity-80 hover:opacity-100'}`}
                            title={g}
                          >
                            {newBanner.color === g && (
                              <Check className="absolute inset-0 m-auto w-5 h-5 text-white drop-shadow-lg" />
                            )}
                          </button>
                        ))}
                      </div>
                      <input
                        type="text"
                        value={newBanner.color}
                        onChange={(e) => setNewBanner({ ...newBanner, color: e.target.value })}
                        placeholder="from-purple-600 to-pink-700"
                        className="w-full mt-2 px-3 py-1.5 bg-muted border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1 uppercase">Дата начала</label>
                      <input
                        type="datetime-local"
                        value={newBanner.start_date}
                        onChange={(e) => setNewBanner({ ...newBanner, start_date: e.target.value })}
                        className="w-full px-3 py-2 bg-muted border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1 uppercase">Дата окончания</label>
                      <input
                        type="datetime-local"
                        value={newBanner.end_date}
                        onChange={(e) => setNewBanner({ ...newBanner, end_date: e.target.value })}
                        className="w-full px-3 py-2 bg-muted border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary text-sm"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="banner_active"
                        checked={newBanner.is_active}
                        onChange={(e) => setNewBanner({ ...newBanner, is_active: e.target.checked })}
                      />
                      <label htmlFor="banner_active" className="text-sm cursor-pointer">Активен</label>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1 uppercase">Порядок (sort_order)</label>
                      <input
                        type="number"
                        value={newBanner.sort_order}
                        onChange={(e) => setNewBanner({ ...newBanner, sort_order: parseInt(e.target.value) || 0 })}
                        className="w-full px-3 py-2 bg-muted border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary text-sm"
                      />
                    </div>
                  </div>

                  {/* Guaranteed custom card */}
                  <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-lg space-y-3">
                    <div className="flex items-center gap-2">
                      <Sparkles size={16} className="text-amber-500" />
                      <label className="text-xs font-bold text-amber-500 uppercase">Гарантированная карта</label>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1 uppercase">JSON гарантированной карты</label>
                      <textarea
                        value={newBanner.guaranteed_card_json}
                        onChange={(e) => setNewBanner({ ...newBanner, guaranteed_card_json: e.target.value })}
                        placeholder="Вставьте объект Card в формате JSON. Можно получить в редакторе карт..."
                        className="w-full px-3 py-2 bg-muted border border-border rounded text-xs font-mono h-24"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1 uppercase">Пулл до гарантии (0 = выключено)</label>
                      <input
                        type="number"
                        value={newBanner.guaranteed_card_pity}
                        onChange={(e) => setNewBanner({ ...newBanner, guaranteed_card_pity: e.target.value })}
                        placeholder="Напр. 50 — гарантия через 50 круток"
                        className="w-full px-3 py-2 bg-muted border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary text-sm"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowCreateBanner(false)}
                      className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition"
                    >
                      Отмена
                    </button>
                    <button
                      type="submit"
                      className="px-6 py-2 bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-primary/90 transition"
                    >
                      Создать баннер
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Banners list */}
            {isBannersLoading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : banners.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                Баннеров пока нет. Создайте первый баннер.
              </div>
            ) : (
              <div className="space-y-4">
                {banners.map((banner) => (
                  <div key={banner.id} className="bg-card border border-border rounded-xl p-4 sm:p-6 shadow-sm">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 mb-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-lg flex items-center gap-2">
                          {banner.name}
                          {banner.banner_type === 'dynamic' && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase bg-cyan-500/10 text-cyan-500 border border-cyan-500/20">
                              Ивент
                            </span>
                          )}
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${banner.is_active ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-muted text-muted-foreground'}`}>
                            {banner.is_active ? 'Активен' : 'Неактивен'}
                          </span>
                        </h3>
                        {banner.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{banner.description}</p>
                        )}
                        <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
                          {banner.boosted_rarity && (
                            <span>Буст: {rarityConfig[banner.boosted_rarity as Rarity]?.label || banner.boosted_rarity}</span>
                          )}
                          {banner.price != null && <span>Цена: {banner.price}</span>}
                          {banner.start_date && <span>С: {formatDate(banner.start_date)}</span>}
                          {banner.end_date && <span>До: {formatDate(banner.end_date)}</span>}
                          {banner.featured_anime_ids && banner.featured_anime_ids.length > 0 && (
                            <span>Featured: {banner.featured_anime_ids.join(", ")}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2 flex-shrink-0 self-end sm:self-auto">
                        <button
                          onClick={() => handleStartEditBanner(banner)}
                          className="p-2 text-muted-foreground hover:text-primary transition"
                          title="Редактировать баннер"
                        >
                          <Edit size={18} />
                        </button>
                        <button
                          onClick={() => handleToggleBannerActive(banner)}
                          className={`w-10 h-5 rounded-full relative transition-colors ${banner.is_active ? 'bg-primary' : 'bg-muted'}`}
                        >
                          <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${banner.is_active ? 'left-6' : 'left-1'}`} />
                        </button>
                        <button
                          onClick={() => handleDeleteBanner(banner.id)}
                          className="p-2 text-muted-foreground hover:text-destructive transition"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>

                    {/* Guaranteed card badge in banner info */}
                    {banner.guaranteed_card_payload && (
                      <div className="flex items-center gap-2 mt-2 text-xs">
                        <Sparkles size={12} className="text-amber-500" />
                        <span className="text-amber-500 font-semibold">
                          Гарант-карта: {banner.guaranteed_card_payload?.name || "Без названия"}
                          {banner.guaranteed_card_pity ? ` (через ${banner.guaranteed_card_pity} круток)` : ""}
                        </span>
                      </div>
                    )}

                    {/* Edit form */}
                    {editingBannerId === banner.id && editBanner && (
                      <div className="mt-4 pt-4 border-t border-border bg-muted/30 rounded-lg p-3 sm:p-4 space-y-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Edit size={16} className="text-primary" />
                          <h4 className="font-semibold text-sm">Редактирование баннера</h4>
                        </div>
                        {/* Banner type selector */}
                        <div className="flex gap-2 p-1 bg-muted rounded-lg">
                          <button
                            type="button"
                            onClick={() => setEditBanner({ ...editBanner, banner_type: "standard" })}
                            className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition ${editBanner.banner_type === "standard" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                          >
                            Стандартный
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditBanner({ ...editBanner, banner_type: "dynamic" })}
                            className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition ${editBanner.banner_type === "dynamic" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                          >
                            Ивент (Онгоинги)
                          </button>
                        </div>
                        {editBanner.banner_type === "dynamic" && (
                          <div className="p-3 bg-cyan-500/5 border border-cyan-500/20 rounded-lg text-xs text-cyan-300">
                            Баннер будет автоматически выбирать онгоинг-тайтл и его главных персонажей (1-3 ГГ). Тайтл меняется каждые 3 дня. Пул роллов — все онгоинги, гарант — одна из 3 ГГ карт. Название и описание будут показаны вместо автоматических.
                          </div>
                        )}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-medium text-muted-foreground mb-1 uppercase">Название *</label>
                            <input
                              type="text"
                              value={editBanner.name}
                              onChange={(e) => setEditBanner({ ...editBanner, name: e.target.value })}
                              className="w-full px-3 py-2 bg-muted border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-muted-foreground mb-1 uppercase">URL фона баннера</label>
                            <input
                              type="text"
                              value={editBanner.image_url}
                              onChange={(e) => setEditBanner({ ...editBanner, image_url: e.target.value })}
                              className="w-full px-3 py-2 bg-muted border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary text-sm"
                              placeholder="https://... (фон карточки)"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-muted-foreground mb-1 uppercase">URL промо-арта (шапка 7:5)</label>
                          <input
                            type="text"
                            value={editBanner.promo_image_url}
                            onChange={(e) => setEditBanner({ ...editBanner, promo_image_url: e.target.value })}
                            className="w-full px-3 py-2 bg-muted border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary text-sm"
                            placeholder="https://... (промо-арт для шапки, 7:5)"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-muted-foreground mb-1 uppercase">Описание</label>
                          <textarea
                            value={editBanner.description}
                            onChange={(e) => setEditBanner({ ...editBanner, description: e.target.value })}
                            className="w-full px-3 py-2 bg-muted border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary text-sm h-20"
                          />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <label className="block text-xs font-medium text-muted-foreground mb-1 uppercase">Featured anime IDs</label>
                            <input
                              type="text"
                              value={editBanner.featured_anime_ids}
                              onChange={(e) => setEditBanner({ ...editBanner, featured_anime_ids: e.target.value })}
                              placeholder="1, 21, 5114"
                              className="w-full px-3 py-2 bg-muted border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-muted-foreground mb-1 uppercase">Буст редкости</label>
                            <select
                              value={editBanner.boosted_rarity}
                              onChange={(e) => setEditBanner({ ...editBanner, boosted_rarity: e.target.value as Rarity | "" })}
                              className="w-full px-3 py-2 bg-muted border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary text-sm"
                            >
                              <option value="">Нет</option>
                              {Object.entries(rarityConfig).map(([key, config]) => (
                                <option key={key} value={key}>{config.label}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-muted-foreground mb-1 uppercase">Цена</label>
                            <input
                              type="number"
                              value={editBanner.price}
                              onChange={(e) => setEditBanner({ ...editBanner, price: e.target.value })}
                              className="w-full px-3 py-2 bg-muted border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary text-sm"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="md:col-span-2">
                            <label className="block text-xs font-medium text-muted-foreground mb-2 uppercase">Цвет (gradient)</label>
                            <div className="flex flex-wrap gap-2">
                              {GRADIENT_PRESETS.map((g) => (
                                <button
                                  key={g}
                                  type="button"
                                  onClick={() => setEditBanner({ ...editBanner, color: g })}
                                  className={`relative w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-gradient-to-br ${g} transition-all ${editBanner.color === g ? 'ring-2 ring-primary ring-offset-2 ring-offset-background scale-110' : 'hover:scale-105 opacity-80 hover:opacity-100'}`}
                                  title={g}
                                >
                                  {editBanner.color === g && (
                                    <Check className="absolute inset-0 m-auto w-5 h-5 text-white drop-shadow-lg" />
                                  )}
                                </button>
                              ))}
                            </div>
                            <input
                              type="text"
                              value={editBanner.color}
                              onChange={(e) => setEditBanner({ ...editBanner, color: e.target.value })}
                              placeholder="from-purple-600 to-pink-700"
                              className="w-full mt-2 px-3 py-1.5 bg-muted border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary text-xs font-mono"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-muted-foreground mb-1 uppercase">Дата начала</label>
                            <input
                              type="datetime-local"
                              value={editBanner.start_date}
                              onChange={(e) => setEditBanner({ ...editBanner, start_date: e.target.value })}
                              className="w-full px-3 py-2 bg-muted border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-muted-foreground mb-1 uppercase">Дата окончания</label>
                            <input
                              type="datetime-local"
                              value={editBanner.end_date}
                              onChange={(e) => setEditBanner({ ...editBanner, end_date: e.target.value })}
                              className="w-full px-3 py-2 bg-muted border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary text-sm"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              id="edit_banner_active"
                              checked={editBanner.is_active}
                              onChange={(e) => setEditBanner({ ...editBanner, is_active: e.target.checked })}
                            />
                            <label htmlFor="edit_banner_active" className="text-sm cursor-pointer">Активен</label>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-muted-foreground mb-1 uppercase">Порядок (sort_order)</label>
                            <input
                              type="number"
                              value={editBanner.sort_order}
                              onChange={(e) => setEditBanner({ ...editBanner, sort_order: parseInt(e.target.value) || 0 })}
                              className="w-full px-3 py-2 bg-muted border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary text-sm"
                            />
                          </div>
                        </div>
                        {/* Guaranteed card in edit mode */}
                        <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-lg space-y-3">
                          <div className="flex items-center gap-2">
                            <Sparkles size={16} className="text-amber-500" />
                            <label className="text-xs font-bold text-amber-500 uppercase">Гарантированная карта</label>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-muted-foreground mb-1 uppercase">JSON гарантированной карты</label>
                            <textarea
                              value={editBanner.guaranteed_card_json}
                              onChange={(e) => setEditBanner({ ...editBanner, guaranteed_card_json: e.target.value })}
                              placeholder="Вставьте объект Card в формате JSON..."
                              className="w-full px-3 py-2 bg-muted border border-border rounded text-xs font-mono h-24"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-muted-foreground mb-1 uppercase">Пулл до гарантии (0 = выключено)</label>
                            <input
                              type="number"
                              value={editBanner.guaranteed_card_pity}
                              onChange={(e) => setEditBanner({ ...editBanner, guaranteed_card_pity: e.target.value })}
                              placeholder="Напр. 50 — гарантия через 50 круток"
                              className="w-full px-3 py-2 bg-muted border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary text-sm"
                            />
                          </div>
                        </div>
                        <div className="flex flex-col sm:flex-row justify-end gap-3 pt-2">
                          <button
                            type="button"
                            onClick={() => { setEditingBannerId(null); setEditBanner(null) }}
                            className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition"
                          >
                            Отмена
                          </button>
                          <button
                            type="button"
                            onClick={handleSaveEditBanner}
                            className="px-6 py-2 bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-primary/90 transition"
                          >
                            Сохранить
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
                      <button
                        onClick={() => toggleBannerExpand(banner.id)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-muted hover:bg-muted/70 rounded text-sm transition"
                      >
                        <Calendar size={14} />
                        Карты баннера
                      </button>
                    </div>

                    {/* Banner cards sub-section */}
                    {expandedBannerId === banner.id && (
                      <div className="mt-4 pt-4 border-t border-border space-y-3 sm:space-y-4">
                        {bannerCardsLoading === banner.id ? (
                          <div className="flex justify-center py-6">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                          </div>
                        ) : (
                          <>
                            {/* Existing cards */}
                            {(bannerCards[banner.id] || []).length > 0 && (
                              <div className="space-y-2">
                                {(bannerCards[banner.id] || []).map((bc) => (
                                  <div key={bc.id} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 p-3 bg-muted/50 rounded-lg">
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium truncate">
                                        {bc.card_payload?.name || "Без названия"}
                                      </p>
                                      <p className="text-xs text-muted-foreground">
                                        Редкость: {rarityConfig[bc.card_payload?.rarity as Rarity]?.label || bc.card_payload?.rarity || "—"}
                                      </p>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2">
                                      <label className="text-xs text-muted-foreground">Вес:</label>
                                      <input
                                        type="number"
                                        value={bc.weight}
                                        onChange={(e) => {
                                          const w = parseInt(e.target.value) || 0
                                          setBannerCards(prev => ({
                                            ...prev,
                                            [banner.id]: (prev[banner.id] || []).map(c => c.id === bc.id ? { ...c, weight: w } : c)
                                          }))
                                        }}
                                        className="w-16 px-2 py-1 bg-muted border border-border rounded text-xs"
                                      />
                                      <label className="text-xs text-muted-foreground flex items-center gap-1">
                                        <input
                                          type="checkbox"
                                          checked={bc.is_featured}
                                          onChange={(e) => {
                                            const f = e.target.checked
                                            setBannerCards(prev => ({
                                              ...prev,
                                              [banner.id]: (prev[banner.id] || []).map(c => c.id === bc.id ? { ...c, is_featured: f } : c)
                                          }))
                                          }}
                                        />
                                        Featured
                                      </label>
                                      <button
                                        onClick={() => handleUpdateBannerCard(bc)}
                                        className="px-2 py-1 bg-primary/10 text-primary rounded text-xs hover:bg-primary/20 transition"
                                      >
                                        <Edit size={12} />
                                      </button>
                                      <button
                                        onClick={() => handleDeleteBannerCard(bc.id, banner.id)}
                                        className="p-1 text-muted-foreground hover:text-destructive transition"
                                      >
                                        <Trash2 size={14} />
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Add new card */}
                            <div className="space-y-2 p-3 bg-muted/30 rounded-lg border border-dashed border-border">
                              <label className="block text-xs font-medium text-muted-foreground uppercase">Добавить карту (JSON)</label>
                              <textarea
                                value={newBannerCardJson[banner.id] || ""}
                                onChange={(e) => setNewBannerCardJson(prev => ({ ...prev, [banner.id]: e.target.value }))}
                                placeholder="Вставьте объект Card в формате JSON..."
                                className="w-full px-3 py-2 bg-muted border border-border rounded text-xs font-mono h-24"
                              />
                              <div className="flex flex-wrap items-center gap-3">
                                <div className="flex items-center gap-2">
                                  <label className="text-xs text-muted-foreground">Вес:</label>
                                  <input
                                    type="number"
                                    value={newBannerCardWeight[banner.id] ?? 1}
                                    onChange={(e) => setNewBannerCardWeight(prev => ({ ...prev, [banner.id]: parseInt(e.target.value) || 1 }))}
                                    className="w-16 px-2 py-1 bg-muted border border-border rounded text-xs"
                                  />
                                </div>
                                <label className="text-xs text-muted-foreground flex items-center gap-1">
                                  <input
                                    type="checkbox"
                                    checked={newBannerCardFeatured[banner.id] ?? false}
                                    onChange={(e) => setNewBannerCardFeatured(prev => ({ ...prev, [banner.id]: e.target.checked }))}
                                  />
                                  Featured
                                </label>
                                <button
                                  onClick={() => handleAddBannerCard(banner.id)}
                                  className="ml-auto flex items-center gap-1 px-3 py-1.5 bg-primary text-primary-foreground rounded text-xs hover:bg-primary/90 transition"
                                >
                                  <Plus size={14} />
                                  Добавить карту
                                </button>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : activeTab === 'tutorial' ? (
          <div className="space-y-3 sm:space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <BookOpen className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
              <div>
                <h2 className="text-lg sm:text-2xl font-bold">Туториал админ-панели</h2>
                <p className="text-xs sm:text-sm text-muted-foreground">Полное руководство по всем разделам</p>
              </div>
            </div>

            {/* Quick nav */}
            <div className="flex flex-wrap gap-2 mb-2">
              {tutorialSections.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setExpandedTutorialId(s.id)}
                  className="inline-flex items-center gap-1.5 px-2 sm:px-3 py-1.5 bg-muted/50 hover:bg-muted border border-border rounded-lg text-[10px] sm:text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground transition whitespace-nowrap"
                >
                  {s.icon}
                  {s.title.split("—")[0].trim()}
                </button>
              ))}
            </div>

            {/* Sections */}
            <div className="space-y-3">
              {tutorialSections.map((section) => {
                const isExpanded = expandedTutorialId === section.id
                return (
                  <div key={section.id} className="bg-card border border-border rounded-xl overflow-hidden">
                    <button
                      onClick={() => setExpandedTutorialId(isExpanded ? null : section.id)}
                      className="w-full flex items-center justify-between p-3 sm:p-4 hover:bg-muted/50 transition text-left"
                    >
                      <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                        <div className="p-2 bg-primary/10 rounded-lg border border-primary/20 flex-shrink-0">
                          {section.icon}
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-sm sm:text-base font-bold truncate">{section.title}</h3>
                          <p className="text-[10px] sm:text-xs text-muted-foreground truncate">{section.description}</p>
                        </div>
                      </div>
                      {isExpanded ? <ChevronDown className="w-5 h-5 text-muted-foreground flex-shrink-0" /> : <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />}
                    </button>
                    {isExpanded && (
                      <div className="px-3 sm:px-4 pb-3 sm:pb-4 space-y-3">
                        <div className="space-y-2">
                          {section.steps.map((step, i) => (
                            <div key={i} className="flex gap-2 sm:gap-3 p-2 sm:p-3 bg-muted/30 rounded-lg border border-border/50">
                              <div className="flex-shrink-0 w-5 h-5 sm:w-6 sm:h-6 bg-primary/20 rounded-full flex items-center justify-center text-[10px] sm:text-xs font-black text-primary">
                                {i + 1}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs sm:text-sm font-bold text-foreground">{step.title}</p>
                                <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">{step.detail}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                        {section.tips && section.tips.length > 0 && (
                          <div className="p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-lg space-y-1.5">
                            <div className="flex items-center gap-2 text-emerald-500 font-bold text-xs uppercase tracking-wider">
                              <Lightbulb className="w-4 h-4" />
                              Советы
                            </div>
                            {section.tips.map((tip, i) => (
                              <div key={i} className="flex items-start gap-2 text-sm text-emerald-600/80">
                                <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-emerald-500" />
                                <span>{tip}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {section.warnings && section.warnings.length > 0 && (
                          <div className="p-3 bg-amber-500/5 border border-amber-500/20 rounded-lg space-y-1.5">
                            <div className="flex items-center gap-2 text-amber-500 font-bold text-xs uppercase tracking-wider">
                              <AlertTriangle className="w-4 h-4" />
                              Внимание
                            </div>
                            {section.warnings.map((w, i) => (
                              <div key={i} className="flex items-start gap-2 text-sm text-amber-600/80">
                                <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0 text-amber-500" />
                                <span>{w}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ) : null}
      </div>

      <ScrollToTop />
      <Footer />
    </div>
  )
}
