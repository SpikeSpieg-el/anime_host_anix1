"use client"

import { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from "react"
import { useRouter } from "next/navigation"
import { User, Session } from "@supabase/supabase-js"
import { supabase, syncLocalDataToAccount } from "@/lib/supabase"
import { useToast } from "@/hooks/use-toast"
import { signOutLocalWithTimeout } from "@/lib/auth-session"
import { loggers } from "@/lib/logger"
import { AnalyticsEvent, trackEvent } from "@/lib/analytics"

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  profileLoading: boolean
  sessionLoading: boolean // Готовность сессии для хуков useCoins/useDust
  signOut: () => Promise<void>
  profile: Profile | null
  refreshProfile: () => Promise<void>
}

interface Profile {
  id: string
  avatar_url: string | null
  username: string | null
  updated_at: string | null
  allow_nsfw_search?: boolean
  referral_code?: string | null
  referred_by?: string | null
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  profileLoading: false,
  sessionLoading: true,
  signOut: async () => {},
  profile: null,
  refreshProfile: async () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [sessionLoading, setSessionLoading] = useState(true) // Отдельное состояние для сессии
  const [profileLoading, setProfileLoading] = useState(false)
  const signingOut = useRef(false)
  const currentUserId = useRef<string | null>(null)
  const profileRequest = useRef(0)
  const router = useRouter()
  const { toast } = useToast()

  // Account-stats recorder can receive events from components that render before
  // its provider effect. Keep the current user available globally as a small
  // bridge until the recorder switches to the per-user storage namespace.
  useEffect(() => {
    if (typeof window !== "undefined") {
      ;(window as any).__accountStatsUserId = user?.id ?? null
    }
  }, [user?.id])

  const forceClearSupabaseAuthStorage = () => {
    if (typeof window === "undefined") return
    try {
      for (const key of Object.keys(window.localStorage)) {
        if (key.startsWith("sb-") && key.includes("auth-token")) {
          window.localStorage.removeItem(key)
        }
      }
      for (const key of Object.keys(window.sessionStorage)) {
        if (key.startsWith("sb-") && key.includes("auth-token")) {
          window.sessionStorage.removeItem(key)
        }
      }
    } catch {
      // ignore
    }
  }

  const hardSignOut = useCallback(async () => {
    if (signingOut.current) return
    signingOut.current = true
    currentUserId.current = null
    profileRequest.current++ // Ignore profile responses/retries started before logout.
    let resetClient = false
    window.dispatchEvent(new Event("logout-start"))
    setLoading(true)
    try {
      trackEvent(AnalyticsEvent.AUTH_SIGN_OUT)
      await signOutLocalWithTimeout(supabase.auth)
    } catch (error) {
      loggers.auth.error("Sign out error:", error)
      // Clearing storage alone does not clear GoTrue's in-memory session/lock.
      // Recreate the client via navigation only on this exceptional path.
      resetClient = true
    } finally {
      forceClearSupabaseAuthStorage()
      clearGuestLocalData()
      setSession(null)
      setUser(null)
      setProfile(null)
      setLoading(false)
      setSessionLoading(false)
      setProfileLoading(false)
      window.dispatchEvent(new Event("logout-end"))
      if (resetClient) {
        window.location.replace("/")
      } else {
        signingOut.current = false
        router.replace("/")
        router.refresh()
      }
    }
  }, [router])

  const refreshProfile = useCallback(async () => {
    if (!user || signingOut.current) return
    const requestId = ++profileRequest.current
    const isCurrent = () => requestId === profileRequest.current && currentUserId.current === user.id && !signingOut.current
    console.log('[Auth] refreshProfile started for user:', user.id, 'session:', !!session)
    setProfileLoading(true)

    // Увеличенный timeout для продакшена (холодные подключения, задержки сети)
    const timeoutId = setTimeout(() => {
      if (!isCurrent()) return
      console.warn('[Auth] Profile loading timeout, forcing loading to false')
      setProfileLoading(false)
    }, 25000) // 25 секунд для продакшена

    // Retry logic с экспоненциальной задержкой
    const maxRetries = 3
    const baseDelay = 1000 // 1 секунда

    let currentToken = session?.access_token

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      if (!isCurrent()) { clearTimeout(timeoutId); return }
      try {
        console.log(`[Auth] Profile fetch attempt ${attempt}/${maxRetries}...`)
        const fetchStart = Date.now()

        if (!currentToken) {
          console.warn('[Auth] No access token, skipping profile fetch')
          clearTimeout(timeoutId)
          setProfileLoading(false)
          return
        }
        
        const res = await fetch('/api/profile', {
          headers: {
            'Authorization': `Bearer ${currentToken}`
          }
        })
        
        const fetchTime = Date.now() - fetchStart
        console.log(`[Auth] Profile API response in ${fetchTime}ms, status: ${res.status}`)
        
        if (!res.ok) {
          throw new Error(`Profile API error: ${res.status}`)
        }
        
        const result = await res.json()
        if (!isCurrent()) { clearTimeout(timeoutId); return }
        
        // API возвращает { success: true, profile: data }
        if (!result.success || !result.profile) {
          throw new Error(result.message || 'No profile data')
        }
        
        const data = result.profile
        console.log('[Auth] Profile fetched successfully:', data?.id)

        clearTimeout(timeoutId)
        setProfile(data)
        setProfileLoading(false)
        return // Успех, выходим из цикла
      } catch (error: any) {
        if (!isCurrent()) { clearTimeout(timeoutId); return }
        loggers.auth.error(`Error fetching profile (attempt ${attempt}/${maxRetries}):`, error)

        // Если последняя попытка - выходим с ошибкой
        if (attempt === maxRetries) {
          clearTimeout(timeoutId)
          setProfileLoading(false)

          if (error.message?.includes('406') || error.message?.includes('Not Acceptable') || error.message?.includes('PGRST116')) {
            toast({
              title: "Ошибка авторизации",
              description: "Пользователь не найден. Пожалуйста, войдите снова.",
              variant: "destructive"
            })
            await hardSignOut()
          } else {
            toast({
              title: "Ошибка загрузки профиля",
              description: "Не удалось загрузить профиль. Попробуйте обновить страницу.",
              variant: "destructive"
            })
          }
          return
        }

        // При 401 пытаемся обновить сессию перед следующей попыткой
        if (error.message?.includes('401')) {
          loggers.auth.info('Got 401, attempting session refresh...')
          const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession()
          if (!isCurrent()) { clearTimeout(timeoutId); return }
          if (refreshError || !refreshData.session) {
            loggers.auth.error('Session refresh failed:', refreshError)
            clearTimeout(timeoutId)
            setProfileLoading(false)
            toast({
              title: "Сессия истекла",
              description: "Пожалуйста, войдите снова.",
              variant: "destructive"
            })
            await hardSignOut()
            return
          }
          setSession(refreshData.session)
          currentToken = refreshData.session.access_token
          loggers.auth.info('Session refreshed successfully, retrying profile fetch...')
          // Небольшая задержка перед retry
          await new Promise(resolve => setTimeout(resolve, 500))
          continue
        }

        // Экспоненциальная задержка перед следующей попыткой
        const delay = baseDelay * Math.pow(2, attempt - 1)
        loggers.auth.info(`Retrying in ${delay}ms... (attempt ${attempt + 1}/${maxRetries})`)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }, [user?.id, session?.access_token, toast, hardSignOut]);

  useEffect(() => {
    if (user) {
      // Ждём готовности сессии перед загрузкой профиля
      if (sessionLoading) {
        console.log('[Auth] Session still loading, waiting to refresh profile...')
        return
      }
      // Добавим защиту от повторных вызовов, если профиль уже загружается
      if (!profileLoading) {
        console.log('[Auth] Starting profile refresh for user:', user.id)
        refreshProfile()
      }
    } else {
      setProfile(null)
      setProfileLoading(false)
    }
  }, [user?.id, sessionLoading])

  useEffect(() => {
    let active = true
    let authRevision = 0
    const syncTimers = new Set<ReturnType<typeof setTimeout>>()

    const applySession = (nextSession: Session | null) => {
      if (!active || signingOut.current) return
      const nextId = nextSession?.user.id ?? null
      if (currentUserId.current !== nextId) {
        profileRequest.current++
        setProfile(null)
        setProfileLoading(false)
      }
      currentUserId.current = nextId
      setSession(nextSession)
      setUser(nextSession?.user ?? null)
      setLoading(false)
      setSessionLoading(false)
    }

    const checkSession = async () => {
      const revision = authRevision
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (revision === authRevision) applySession(session)
      } catch (err) {
        loggers.auth.error("Failed to check session", err)
        if (active && !signingOut.current && revision === authRevision) {
          setLoading(false)
          setSessionLoading(false)
        }
      }
    }

    void checkSession()
    // Supabase holds its auth lock while invoking subscribers. Never await a
    // Supabase query here: it requests that same lock and deadlocks logout/login.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event: string, session: Session | null) => {
      authRevision++
      applySession(session)
      if (event === "SIGNED_IN" && session?.user && !signingOut.current) {
        const userId = session.user.id
        const timer = setTimeout(async () => {
          syncTimers.delete(timer)
          if (!active || signingOut.current || currentUserId.current !== userId) return
          try {
            await syncLocalDataToAccount(userId)
            if (!active || signingOut.current || currentUserId.current !== userId) return
            window.dispatchEvent(new Event("auth-synced"))
            toast({ title: "Вход выполнен", description: "Данные синхронизированы" })
          } catch (e) {
            loggers.auth.error("Sync error", e)
          }
        }, 0)
        syncTimers.add(timer)
      }
    })

    const handleFocus = () => {
      if (document.visibilityState === "visible" && !signingOut.current) void checkSession()
    }
    document.addEventListener("visibilitychange", handleFocus)
    window.addEventListener("focus", handleFocus)
    return () => {
      active = false
      for (const timer of syncTimers) clearTimeout(timer)
      subscription.unsubscribe()
      document.removeEventListener("visibilitychange", handleFocus)
      window.removeEventListener("focus", handleFocus)
    }
  }, [toast])

  function clearGuestLocalData() {
    if (typeof window === "undefined") return
    try {
      window.localStorage.removeItem("watch-history")
      window.localStorage.removeItem("bookmarks_v1")
      window.localStorage.removeItem("gacha-collection")
      window.localStorage.removeItem("gacha-sync-queue")
      window.localStorage.removeItem("gacha-prioritize-main-characters")
      window.localStorage.removeItem("gacha-coins")
      window.localStorage.removeItem("gacha-dust")
      document.cookie = `bookmark_ids=; path=/; max-age=0; SameSite=Lax`
    } catch {
      // ignore
    }
  }

  const signOut = hardSignOut

  // Мемоизация значения контекста
  const contextValue = useMemo(() => ({
    user, 
    session, 
    loading, 
    sessionLoading, 
    profileLoading, 
    signOut, 
    profile, 
    refreshProfile
  }), [user, session, loading, sessionLoading, profileLoading, profile, signOut, refreshProfile]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)