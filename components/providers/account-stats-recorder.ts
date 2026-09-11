// Account stats activity recorder + session/watch heartbeat (pure module, no React)

import { trackEvent } from "@/lib/analytics"

export type ActivityEvent = {
  eventType: string          // page_view, page_leave, watch_start, watch_end, gacha_roll, ...
  category?: string | null   // time | viewing | activity
  payload?: Record<string, any>
}

const SESSION_STORAGE_KEY = "account-stats-session"
const WATCH_TIME_STORAGE_KEY = "account-stats-watch-time"
const SESSION_SYNC_STORAGE_KEY = "account-stats-session-sync"

// Минимальная длительность сессии для сохранения (5 секунд)
const MIN_SESSION_MS = 5000

// Если пользователь не проявляет активности 15 минут — следующая активность начнет новую сессию
const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000

// Троттлинг записи состояния в localStorage
const HEARTBEAT_THROTTLE_MS = 2000
const WATCH_TIME_SYNC_THRESHOLD_MS = 60_000

// Эти события уже покрыты AnalyticsWrapper (pageview + время на странице),
// дублировать их кастомными событиями в Umami не нужно.
const UMAMI_SKIP_EVENT_TYPES = new Set(["page_view", "page_leave"])

let lastBeatTime = 0
let activeUserId: string | null = null

export type SessionRecord = { start: number; end: number }

type SessionState = {
  currentSession: { start: number; lastActive: number } | null
  sessions: SessionRecord[]  // Завершенные сессии
}

type WatchTimeState = {
  totalMs: number
  pendingMs: number
}

type SessionSyncState = {
  totalSessions: number
  totalTimeMs: number
}

export const activityRecorder = createActivityRecorder()

function createActivityRecorder(): ActivityRecorder {
  let enabled = true
  let pendingSyncTimeout: ReturnType<typeof setTimeout> | null = null
  let pendingWatchSyncTimeout: ReturnType<typeof setTimeout> | null = null

  function getUserId(): string | null {
    if (activeUserId) return activeUserId
    return getCurrentUserId()
  }

  function storageKey(base: string): string {
    // Время гостя не должно случайно попасть следующему пользователю на том же
    // устройстве. Авторизованный пользователь получает отдельное хранилище.
    const suffix = getUserId() || "guest"
    return `${base}:${suffix}`
  }

  function processActivity(now: number = Date.now()): SessionState {
    const state = readSession()
    const isVisible = typeof document !== "undefined" ? document.visibilityState === "visible" : true

    if (!isVisible) {
      return state
    }

    if (!state.currentSession) {
      // Начинаем новую сессию
      state.currentSession = { start: now, lastActive: now }
    } else {
      const timeSinceLastActive = now - state.currentSession.lastActive

      if (timeSinceLastActive > INACTIVITY_TIMEOUT_MS) {
        // Предыдущая сессия завершилась по таймауту
        const prevDuration = state.currentSession.lastActive - state.currentSession.start
        if (prevDuration >= MIN_SESSION_MS) {
          state.sessions.push({
            start: state.currentSession.start,
            end: state.currentSession.lastActive,
          })
        }
        // Начинаем новую сессию
        state.currentSession = { start: now, lastActive: now }
      } else {
        // Продолжаем текущую сессию
        state.currentSession.lastActive = now
      }
    }

    return state
  }

  function beat(_event?: ActivityEvent): void {
    if (typeof window === "undefined") return
    try {
      const now = Date.now()
      if (now - lastBeatTime < HEARTBEAT_THROTTLE_MS) return
      lastBeatTime = now

      const nextState = processActivity(now)
      writeSession(nextState)
    } catch (e) {
      console.error("[account-stats] beat error:", e)
    }
  }

  function scheduleDbSync(userId: string): void {
    if (pendingSyncTimeout) {
      clearTimeout(pendingSyncTimeout)
    }
    pendingSyncTimeout = setTimeout(() => {
      void syncSessionStatsToDb(userId)
      pendingSyncTimeout = null
    }, 3000)
  }

  function scheduleWatchTimeSync(userId: string): void {
    if (pendingWatchSyncTimeout) {
      clearTimeout(pendingWatchSyncTimeout)
    }
    pendingWatchSyncTimeout = setTimeout(() => {
      void syncWatchTimeToDb(userId)
      pendingWatchSyncTimeout = null
    }, 3000)
  }

  async function syncSessionStatsToDb(userId: string): Promise<void> {
    if (typeof window === "undefined") return
    try {
      const summary = getSessionSummary()
      if (summary.totalSessions === 0 && summary.totalTimeMs === 0) return

      const mod = await import("../../lib/supabase")
      const current = await mod.getAccountStats(userId)
      const syncState = readSessionSyncState()

      // Важный момент: раньше локальная статистика полностью перезаписывала
      // строку в БД и обнуляла данные с другого устройства. Отправляем только
      // дельту, накопленную после последней успешной синхронизации.
      let baseline = syncState
      if (!syncState && current) {
        // Старая версия приложения могла уже записать эти значения. Не дублируем
        // их при первом запуске новой синхронизации.
        if ((current.totalTimeMs ?? 0) >= summary.totalTimeMs && (current.totalSessions ?? 0) >= summary.totalSessions) {
          baseline = {
            totalTimeMs: summary.totalTimeMs,
            totalSessions: summary.totalSessions,
          }
        } else {
          baseline = { totalTimeMs: 0, totalSessions: 0 }
        }
      } else {
        baseline = baseline ?? { totalTimeMs: 0, totalSessions: 0 }
      }

      const deltaTimeMs = Math.max(0, summary.totalTimeMs - baseline.totalTimeMs)
      const deltaSessions = Math.max(0, summary.totalSessions - baseline.totalSessions)
      let synced = deltaTimeMs === 0 && deltaSessions === 0

      if (!synced && typeof mod.incrementAccountStats === "function") {
        synced = await mod.incrementAccountStats(userId, {
          totalTimeMs: deltaTimeMs,
          totalSessions: deltaSessions,
        })
      }

      if (synced) {
        writeSessionSyncState({
          totalTimeMs: summary.totalTimeMs,
          totalSessions: summary.totalSessions,
        })
      }

      // Даты не являются счётчиками: обновляем их отдельно, не затирая
      // значения, пришедшие с другого устройства.
      const patch: Record<string, any> = {}
      if (!current?.firstVisitAt || (summary.firstVisitAt && new Date(summary.firstVisitAt).getTime() < new Date(current.firstVisitAt).getTime())) {
        if (summary.firstVisitAt) patch.firstVisitAt = summary.firstVisitAt
      }
      if (!current?.lastVisitAt || (summary.lastVisitAt && new Date(summary.lastVisitAt).getTime() > new Date(current.lastVisitAt).getTime())) {
        if (summary.lastVisitAt) patch.lastVisitAt = summary.lastVisitAt
      }
      if (Object.keys(patch).length > 0 && typeof mod.updateAccountStats === "function") {
        await mod.updateAccountStats(userId, patch)
      }
    } catch (e) {
      console.error("[account-stats] syncSessionStatsToDb error:", e)
    }
  }

  async function syncWatchTimeToDb(userId: string): Promise<void> {
    if (typeof window === "undefined") return
    try {
      const state = readWatchTimeState()
      if (state.pendingMs <= 0) return

      const pending = state.pendingMs
      const mod = await import("../../lib/supabase")
      let synced = false
      if (typeof mod.incrementAccountStats === "function") {
        synced = await mod.incrementAccountStats(userId, { watchTimeMs: pending })
      }

      if (synced) {
        state.pendingMs = Math.max(0, state.pendingMs - pending)
        writeWatchTimeState(state)
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("account-watch-time-updated"))
        }
      }
    } catch (e) {
      console.error("[account-stats] syncWatchTimeToDb error:", e)
    }
  }

  function computeSessionRecords(): SessionRecord[] {
    const state = readSession()
    const list: SessionRecord[] = []

    for (const s of state.sessions) {
      if (!s || !Number.isFinite(s.start) || !Number.isFinite(s.end)) continue
      if (s.end - s.start >= MIN_SESSION_MS) list.push(s)
    }

    if (state.currentSession) {
      const ongoing = state.currentSession.lastActive - state.currentSession.start
      if (ongoing >= MIN_SESSION_MS) {
        list.push({
          start: state.currentSession.start,
          end: state.currentSession.lastActive,
        })
      }
    }

    // Новые сверху. Не обрезаем список: длина нужна для настоящего totalSessions,
    // а UI сам пагинирует журнал.
    return list.sort((a, b) => b.end - a.end)
  }

  function getSessionSummary(): SessionSummary {
    const sessions = computeSessionRecords()
    const totalTimeMs = sessions.reduce((sum, session) => sum + Math.max(0, session.end - session.start), 0)
    const starts = sessions.map((session) => session.start)
    const ends = sessions.map((session) => session.end)

    return {
      totalSessions: sessions.length,
      totalTimeMs,
      firstVisitAt: starts.length > 0 ? new Date(starts.reduce((min, value) => Math.min(min, value), Number.POSITIVE_INFINITY)).toISOString() : null,
      lastVisitAt: ends.length > 0 ? new Date(ends.reduce((max, value) => Math.max(max, value), 0)).toISOString() : null,
    }
  }

  function flushSessionInternal(): number {
    if (typeof window === "undefined") return 0
    try {
      const state = readSession()
      if (state.currentSession) {
        const duration = state.currentSession.lastActive - state.currentSession.start
        if (duration >= MIN_SESSION_MS) {
          state.sessions.push({
            start: state.currentSession.start,
            end: state.currentSession.lastActive,
          })
        }
        state.currentSession = null
        writeSession(state)

        const userId = getUserId()
        if (userId) scheduleDbSync(userId)
        return Math.max(0, duration)
      }
    } catch (e) {
      console.error("[account-stats] flushSession error:", e)
    }
    return 0
  }

  function flushWatchTimeInternal(): void {
    const userId = getUserId()
    if (userId) void syncWatchTimeToDb(userId)
  }

  return {
    enabled,

    async recordActivity(event: ActivityEvent): Promise<void> {
      // Дублируем внутреннюю активность в Umami. Функция сама по себе no-op,
      // если аналитика не настроена или пользователь не принял cookie.
      if (!UMAMI_SKIP_EVENT_TYPES.has(event.eventType)) {
        try {
          trackEvent(event.eventType, {
            ...(event.payload ?? {}),
            ...(event.category ? { activity_category: event.category } : {}),
          })
        } catch (e) {
          console.error("[account-stats] umami trackEvent error:", e)
        }
      }

      try {
        const userId = getUserId()
        if (userId) {
          void supabaseRecordActivityEvent(userId, event.eventType, event.category, event.payload ?? {})
          // Просмотры страниц раньше нигде не попадали в сводную таблицу.
          // Остальные счётчики обновляются в своём домене, чтобы не считать их дважды.
          if (event.eventType === "page_view") {
            void incrementSummaryCounter(userId, { pageViews: 1 })
          }
          scheduleDbSync(userId)
        }
      } catch (e) {
        console.error("[account-stats] recordActivity DB error:", e)
      }
      beat(event)
    },

    recordWatchTime(deltaMs: number, payload: Record<string, any> = {}): void {
      if (typeof window === "undefined" || typeof document !== "undefined" && document.visibilityState !== "visible") return
      if (!Number.isFinite(deltaMs) || deltaMs <= 0) return

      const safeDelta = Math.min(Math.round(deltaMs), 60_000)
      const state = readWatchTimeState()
      state.totalMs += safeDelta
      state.pendingMs += safeDelta
      writeWatchTimeState(state)

      // Сохраняем редкое событие для activity history, а не каждый тик.
      if (state.pendingMs >= WATCH_TIME_SYNC_THRESHOLD_MS) {
        const userId = getUserId()
        if (userId) scheduleWatchTimeSync(userId)
      }

      beat({ eventType: "watch_heartbeat", category: "viewing", payload: { ...payload, duration_ms: safeDelta } })
    },

    setEnabled: (value: boolean): void => { enabled = value },
    isEnabled: (): boolean => enabled,
    beat: (_event?: ActivityEvent): void => beat(),

    setUserId(userId: string | null): void {
      if (activeUserId === userId) return
      // Закрываем сессию в старом пространстве пользователя до переключения.
      flushSessionInternal()
      flushWatchTimeInternal()
      activeUserId = userId
    },

    startSession(): void {
      if (typeof window === "undefined") return
      const now = Date.now()
      const state = processActivity(now)
      writeSession(state)

      const userId = getUserId()
      if (userId) scheduleDbSync(userId)
    },

    flushSession: (): number => flushSessionInternal(),
    flushWatchTime: (): void => flushWatchTimeInternal(),

    getTotalTimeMs: (): number => getSessionSummary().totalTimeMs,
    getSessionDurations: (): SessionRecord[] => computeSessionRecords(),
    getSessionSummary: (): SessionSummary => getSessionSummary(),
    getWatchTimeMs: (): number => readWatchTimeState().totalMs,

    syncStatsToDb: async (): Promise<void> => {
      const userId = getUserId()
      if (userId) {
        await syncSessionStatsToDb(userId)
        await syncWatchTimeToDb(userId)
      }
    },

    getCurrentUserId: (): string | null => getUserId(),
    readSession: (): SessionState => readSession(),
    writeSession: (state: SessionState): void => writeSession(state),
    supabaseRecordActivityEvent,
  }
}

type SessionSummary = {
  totalSessions: number
  totalTimeMs: number
  firstVisitAt: string | null
  lastVisitAt: string | null
}

type ActivityRecorder = {
  enabled: boolean
  recordActivity(event: ActivityEvent): Promise<void>
  recordWatchTime(deltaMs: number, payload?: Record<string, any>): void
  setEnabled(value: boolean): void
  isEnabled(): boolean
  beat(_event?: ActivityEvent): void
  setUserId(userId: string | null): void
  startSession(): void
  flushSession(): number
  flushWatchTime(): void
  getTotalTimeMs(): number
  getSessionDurations(): SessionRecord[]
  getSessionSummary(): SessionSummary
  getWatchTimeMs(): number
  syncStatsToDb(): Promise<void>
  getCurrentUserId(): string | null
  readSession(): SessionState
  writeSession(state: SessionState): void
  supabaseRecordActivityEvent(userId: string, eventType: string, category: string | null | undefined, payload: Record<string, any>): Promise<void>
}

function getCurrentUserId(): string | null {
  if (activeUserId) return activeUserId
  try {
    if (typeof window !== "undefined") {
      const g = (window as any).__accountStatsUserId
      if (g && typeof g === "string") return g
    }
  } catch {}
  return null
}

function readSession(): SessionState {
  try {
    const key = `${SESSION_STORAGE_KEY}:${activeUserId || getCurrentUserId() || "guest"}`
    const raw = window.localStorage.getItem(key)
    if (!raw) {
      // Подхватываем старый ключ один раз для совместимости с уже собранной
      // статистикой. После следующей записи он будет сохранён в новом ключе.
      const legacyRaw = window.localStorage.getItem(SESSION_STORAGE_KEY)
      if (!legacyRaw) return { currentSession: null, sessions: [] }
      const parsedLegacy = JSON.parse(legacyRaw)
      return normalizeSessionState(parsedLegacy)
    }
    return normalizeSessionState(JSON.parse(raw))
  } catch {
    return { currentSession: null, sessions: [] }
  }
}

function normalizeSessionState(parsed: any): SessionState {
  // Обратная совместимость со старым форматом
  if (parsed?.startedAt && !parsed.currentSession) {
    return {
      currentSession: { start: parsed.startedAt, lastActive: Date.now() },
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
    }
  }

  return {
    currentSession: parsed?.currentSession || null,
    sessions: Array.isArray(parsed?.sessions) ? parsed.sessions : [],
  }
}

function writeSession(state: SessionState): void {
  if (typeof window !== "undefined") {
    try {
      const key = `${SESSION_STORAGE_KEY}:${activeUserId || getCurrentUserId() || "guest"}`
      window.localStorage.setItem(key, JSON.stringify(state))
      // Старый ключ больше не используется: он позволял переносить время между
      // разными аккаунтами на одном браузере.
      window.localStorage.removeItem(SESSION_STORAGE_KEY)
    } catch {}
  }
}

function readWatchTimeState(): WatchTimeState {
  try {
    const key = `${WATCH_TIME_STORAGE_KEY}:${activeUserId || getCurrentUserId() || "guest"}`
    const raw = window.localStorage.getItem(key)
    if (!raw) return { totalMs: 0, pendingMs: 0 }
    const parsed = JSON.parse(raw)
    return {
      totalMs: Math.max(0, Number(parsed?.totalMs) || 0),
      pendingMs: Math.max(0, Number(parsed?.pendingMs) || 0),
    }
  } catch {
    return { totalMs: 0, pendingMs: 0 }
  }
}

function writeWatchTimeState(state: WatchTimeState): void {
  if (typeof window !== "undefined") {
    try {
      const key = `${WATCH_TIME_STORAGE_KEY}:${activeUserId || getCurrentUserId() || "guest"}`
      window.localStorage.setItem(key, JSON.stringify(state))
    } catch {}
  }
}

function readSessionSyncState(): SessionSyncState | null {
  if (typeof window === "undefined") return null
  try {
    const key = `${SESSION_SYNC_STORAGE_KEY}:${activeUserId || getCurrentUserId() || "guest"}`
    const raw = window.localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return {
      totalSessions: Math.max(0, Number(parsed?.totalSessions) || 0),
      totalTimeMs: Math.max(0, Number(parsed?.totalTimeMs) || 0),
    }
  } catch {
    return null
  }
}

function writeSessionSyncState(state: SessionSyncState): void {
  if (typeof window === "undefined") return
  try {
    const key = `${SESSION_SYNC_STORAGE_KEY}:${activeUserId || getCurrentUserId() || "guest"}`
    window.localStorage.setItem(key, JSON.stringify(state))
  } catch {}
}

async function incrementSummaryCounter(userId: string, increments: Record<string, number>): Promise<void> {
  try {
    const mod = await import("../../lib/supabase")
    if (typeof mod.incrementAccountStats === "function") {
      await mod.incrementAccountStats(userId, increments)
    }
  } catch (e) {
    console.error("[account-stats] increment counter error:", e)
  }
}

async function supabaseRecordActivityEvent(userId: string, eventType: string, category: string | null | undefined, payload: Record<string, any>): Promise<void> {
  try {
    const mod = await import("../../lib/supabase")
    if (typeof mod.recordActivityEvent === "function") {
      void mod.recordActivityEvent(userId, eventType, category, payload).catch(() => {})
    }
  } catch (e) {
    console.error("[account-stats] dynamic supabase import error:", e)
  }
}
