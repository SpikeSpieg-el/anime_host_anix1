// Account stats activity recorder + session heartbeat (pure module, no React)

export type ActivityEvent = {
  eventType: string          // page_view, page_leave, watch_start, watch_end, gacha_roll, ...
  category?: string | null   // time | viewing | activity
  payload?: Record<string, any>
}

const SESSION_STORAGE_KEY = "account-stats-session"

// Минимальная длительность сессии для сохранения (5 секунд)
const MIN_SESSION_MS = 5000

// Если пользователь не проявляет активности 15 минут — следующая активность начнет новую сессию
const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000

// Троттлинг записи в localStorage (не чаще 1 раза в 2 секунды)
const HEARTBEAT_THROTTLE_MS = 2000

let lastBeatTime = 0

export type SessionRecord = { start: number; end: number }

type SessionState = {
  currentSession: { start: number; lastActive: number } | null
  sessions: SessionRecord[]  // Завершенные сессии
}

export const activityRecorder = createActivityRecorder()

function createActivityRecorder(): ActivityRecorder {
  let enabled = true
  let pendingSyncTimeout: ReturnType<typeof setTimeout> | null = null

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
      syncSessionStatsToDb(userId)
      pendingSyncTimeout = null
    }, 3000)
  }

  async function syncSessionStatsToDb(userId: string): Promise<void> {
    if (typeof window === "undefined") return
    try {
      const durations = computeSessionDurations()
      const totalTimeMs = computeTotalTimeMs()
      const totalSessions = durations.length

      if (totalSessions === 0 && totalTimeMs === 0) return

      const avgSessionMs = totalSessions > 0 ? Math.round(totalTimeMs / totalSessions) : 0

      let lastVisitAt: string | undefined
      if (durations.length > 0) {
        lastVisitAt = new Date(durations[0].end).toISOString()
      }

      const mod = await import("../../lib/supabase")
      if (typeof mod.updateAccountStats === "function") {
        await mod.updateAccountStats(userId, {
          totalSessions,
          totalTimeMs,
          avgSessionMs,
          lastVisitAt,
        })
      }
    } catch (e) {
      console.error("[account-stats] syncSessionStatsToDb error:", e)
    }
  }

  function computeTotalTimeMs(): number {
    const state = readSession()
    let total = 0

    // Завершенные сессии
    for (const s of state.sessions) {
      const d = s.end - s.start
      if (d >= MIN_SESSION_MS) total += d
    }

    // Текущая активная сессия
    if (state.currentSession) {
      const ongoing = state.currentSession.lastActive - state.currentSession.start
      if (ongoing >= MIN_SESSION_MS) total += ongoing
    }

    return total
  }

  function computeSessionDurations(): SessionRecord[] {
    const state = readSession()
    const list: SessionRecord[] = []

    for (const s of state.sessions) {
      if (s.end - s.start >= MIN_SESSION_MS) {
        list.push(s)
      }
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

    // Возвращаем последние 30 сессий (от новых к старым)
    return list.slice(-30).reverse()
  }

  return {
    enabled,

    async recordActivity(event: ActivityEvent): Promise<void> {
      try {
        const userId = getCurrentUserId()
        if (userId) {
          void supabaseRecordActivityEvent(userId, event.eventType, event.category, event.payload ?? {})
          scheduleDbSync(userId)
        }
      } catch (e) {
        console.error("[account-stats] recordActivity DB error:", e)
      }
      beat(event)
    },

    setEnabled: (value: boolean): void => { enabled = value },
    isEnabled: (): boolean => enabled,
    beat: (_event?: ActivityEvent): void => beat(),

    startSession(): void {
      if (typeof window === "undefined") return
      const now = Date.now()
      const state = processActivity(now)
      writeSession(state)

      const userId = getCurrentUserId()
      if (userId) scheduleDbSync(userId)
    },

    flushSession(): number {
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

          const userId = getCurrentUserId()
          if (userId) scheduleDbSync(userId)
          return Math.max(0, duration)
        }
      } catch (e) {
        console.error("[account-stats] flushSession error:", e)
      }
      return 0
    },

    getTotalTimeMs: (): number => computeTotalTimeMs(),
    getSessionDurations: (): SessionRecord[] => computeSessionDurations(),

    syncStatsToDb: async (): Promise<void> => {
      const userId = getCurrentUserId()
      if (userId) await syncSessionStatsToDb(userId)
    },

    getCurrentUserId: (): string | null => getCurrentUserId(),
    readSession: (): SessionState => readSession(),
    writeSession: (state: SessionState): void => writeSession(state),
    supabaseRecordActivityEvent,
  }
}

function getCurrentUserId(): string | null {
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
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY)
    if (!raw) return { currentSession: null, sessions: [] }
    const parsed = JSON.parse(raw)

    // Обратная совместимость со старым форматом
    if (parsed.startedAt && !parsed.currentSession) {
      return {
        currentSession: { start: parsed.startedAt, lastActive: Date.now() },
        sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
      }
    }

    return {
      currentSession: parsed.currentSession || null,
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
    }
  } catch {
    return { currentSession: null, sessions: [] }
  }
}

function writeSession(state: SessionState): void {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(state))
    } catch {}
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

type ActivityRecorder = {
  enabled: boolean
  recordActivity(event: ActivityEvent): Promise<void>
  setEnabled(value: boolean): void
  isEnabled(): boolean
  beat(_event?: ActivityEvent): void
  startSession(): void
  flushSession(): number
  getTotalTimeMs(): number
  getSessionDurations(): SessionRecord[]
  syncStatsToDb(): Promise<void>
  getCurrentUserId(): string | null
  readSession(): SessionState
  writeSession(state: SessionState): void
  supabaseRecordActivityEvent(userId: string, eventType: string, category: string | null | undefined, payload: Record<string, any>): Promise<void>
}