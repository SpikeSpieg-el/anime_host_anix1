// Account stats activity recorder + session heartbeat (pure module, no React)

export type ActivityEvent = {
  eventType: string          // page_view, page_leave, watch_start, watch_end, gacha_roll, ...
  category?: string | null   // time | viewing | activity
  payload?: Record<string, any>
}

const SESSION_STORAGE_KEY = "account-stats-session"

type SessionRecord = { start: number; end: number }

type SessionState = {
  startedAt: number          // epoch ms when current session began (last visible moment)
  sessions: SessionRecord[]  // flushed completed sessions
  pausedAt?: number          // epoch ms the page last went hidden (for ongoing-but-paused sessions)
  flushed: boolean           // whether the currently open session has been flushed yet
}

// Singleton instance shared across the app. Imported by recorder + provider + instrumentation.
export const activityRecorder = createActivityRecorder()

function createActivityRecorder(): ActivityRecorder {
  let enabled = true

  function beat(_event?: ActivityEvent): void {
    if (typeof window === "undefined") return
    try {
      const current = readSession()
      const now = Date.now()
      // If a previous session is still open, flush it.
      if (current.startedAt && !current.flushed) {
        current.sessions.push({ start: current.startedAt, end: now })
        current.flushed = true
      }
      // On visible -> keep/refresh the "session started" timestamp so idle gaps don't kill time-on-site.
      const wasVisible = document.visibilityState === "visible"
      if (wasVisible) {
        current.startedAt = now
      } else {
        // page hidden: mark session as open-but-paused; we recompute duration on next visible.
        current.pausedAt = now
      }
      writeSession(current)
    } catch (e) {
      console.error("[account-stats] beat error:", e)
    }
  }

  return {
    enabled,

    /** Fails open: if Supabase is unavailable, still persist to localStorage so guests get time-on-site. */
    async recordActivity(event: ActivityEvent): Promise<void> {
      try {
        const userId = getCurrentUserId()
        if (userId) {
          // Fire-and-forget DB write; never block the UI on it.
          void supabaseRecordActivityEvent(userId, event.eventType, event.category, event.payload ?? {})
        }
      } catch (e) {
        console.error("[account-stats] recordActivity DB error:", e)
      }

      // Always update the client-side session heartbeat regardless of DB success.
      beat(event)
    },

    setEnabled: (value: boolean): void => { enabled = value },
    isEnabled: (): boolean => enabled,

    /** Beat updates localStorage session start/end timestamps (powers "time on-site" for guests). */
    beat: (_event?: ActivityEvent): void => beat(),

    /** Start a new session (called on mount / first page_view). */
    startSession(): void {
      if (typeof window === "undefined") return
      try {
        const current = readSession()
        writeSession({ ...current, startedAt: Date.now(), pausedAt: undefined, flushed: false })
      } catch (e) { console.error("[account-stats] startSession error:", e) }
    },

    /** Flush the currently open session and compute its duration. Returns ms or 0. */
    flushSession: (): number => {
      if (typeof window === "undefined") return 0
      try {
        const current = readSession()
        let durationMs = 0
        if (current.startedAt && !current.flushed) {
          const now = Date.now()
          // If still visible, session is ongoing -> measure to now.
          if (document.visibilityState === "visible") {
            durationMs = now - current.startedAt
          } else {
            durationMs = (current.pausedAt ?? now) - current.startedAt
          }
          current.sessions.push({ start: current.startedAt, end: durationMs > 0 ? current.pausedAt ?? now : current.startedAt })
          current.flushed = true
          writeSession(current)
        }
        return durationMs
      } catch (e) { console.error("[account-stats] flushSession error:", e) }
      return 0
    },

    /** Total accumulated time-on-site across all flushed sessions. */
    getTotalTimeMs: (): number => {
      const current = readSession()
      let total = 0
      for (const s of current.sessions) total += s.end - s.start
      if (!current.flushed && current.startedAt) {
        const now = Date.now()
        total += Math.max(0, (document.visibilityState === "visible" ? now : current.pausedAt ?? now) - current.startedAt)
      }
      return total
    },

    /** Read the last N session durations from localStorage. */
    getSessionDurations: (): SessionRecord[] => {
      const current = readSession()
      return current.sessions.slice(-30)
    },

    // --- internal helpers ---
    getCurrentUserId: (): string | null => getCurrentUserId(),

    readSession: (): SessionState => readSession(),

    writeSession: (state: SessionState): void => writeSession(state),

    // Expose the DB write helper used by recordActivity. Importers must import supabase too.
    supabaseRecordActivityEvent,
  }
}

function getCurrentUserId(): string | null {
  try {
    if (typeof window !== "undefined") {
      // The AccountStatsProvider exposes the signed-in user id on auth change.
      const g = (window as any).__accountStatsUserId
      if (g && typeof g === "string" && g) return g
    }
  } catch {}
  return null
}

function readSession(): SessionState {
  try {
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY)
    if (!raw) return { startedAt: Date.now(), sessions: [], flushed: false }
    const parsed = JSON.parse(raw) as Partial<SessionState>
    return {
      startedAt: (parsed.startedAt ?? Date.now()) as number,
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
      pausedAt: parsed.pausedAt === undefined ? undefined : (parsed.pausedAt as number),
      flushed: !!parsed.flushed,
    }
  } catch { return { startedAt: Date.now(), sessions: [], flushed: false } }
}

function writeSession(state: SessionState): void {
  if (typeof window !== "undefined") {
    try { window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(state)) } catch {}
  }
}

async function supabaseRecordActivityEvent(userId: string, eventType: string, category: string | null | undefined, payload: Record<string, any>): Promise<void> {
  try {
    const mod = await import("../../lib/supabase")
    if (typeof mod.recordActivityEvent === "function") {
      void mod.recordActivityEvent(userId, eventType, category, payload).catch(() => {})
    } else {
      console.warn("[account-stats] recordActivityEvent not available yet:", eventType)
    }
  } catch (e) { console.error("[account-stats] dynamic supabase import error:", e) }
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
  getCurrentUserId(): string | null
  readSession(): SessionState
  writeSession(state: SessionState): void
  supabaseRecordActivityEvent(userId: string, eventType: string, category: string | null | undefined, payload: Record<string, any>): Promise<void>
}
