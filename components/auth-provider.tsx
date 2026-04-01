"use client"

import { createContext, useContext, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { User, Session } from "@supabase/supabase-js"
import { supabase, syncLocalDataToAccount } from "@/lib/supabase"
import { useToast } from "@/hooks/use-toast"
import { loggers } from "@/lib/logger"

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
  const router = useRouter()
  const { toast } = useToast()

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

  const isAuthSessionMissingError = (error: any) => {
    const name = error?.name
    const message = error?.message
    return name === "AuthSessionMissingError" || (typeof message === "string" && message.includes("Auth session missing"))
  }

  const safeSupabaseSignOutLocal = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    try {
      await supabase.auth.signOut({ scope: "local" })
    } catch (error: any) {
      if (!isAuthSessionMissingError(error)) throw error
    }
  }

  const hardSignOut = async () => {
    try {
      // Отправляем событие начала выхода для оверлея
      window.dispatchEvent(new Event("logout-start"))
      
      await safeSupabaseSignOutLocal()
    } finally {
      forceClearSupabaseAuthStorage()
      setSession(null)
      setUser(null)
      setProfile(null)
      setLoading(false)
      router.push("/")
      router.refresh()
    }
  }

  const refreshProfile = async () => {
    if (!user) return
    console.log('[Auth] refreshProfile started for user:', user.id, 'session:', !!session)
    setProfileLoading(true)

    // Увеличенный timeout для продакшена (холодные подключения, задержки сети)
    const timeoutId = setTimeout(() => {
      console.warn('[Auth] Profile loading timeout, forcing loading to false')
      setProfileLoading(false)
    }, 25000) // 25 секунд для продакшена

    // Retry logic с экспоненциальной задержкой
    const maxRetries = 3
    const baseDelay = 1000 // 1 секунда

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[Auth] Profile fetch attempt ${attempt}/${maxRetries}...`)
        const fetchStart = Date.now()
        
        // Используем API вместо прямого запроса к Supabase
        const accessToken = session?.access_token
        if (!accessToken) {
          console.warn('[Auth] No access token, skipping profile fetch')
          clearTimeout(timeoutId)
          setProfileLoading(false)
          return
        }
        
        const res = await fetch('/api/profile', {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        })
        
        const fetchTime = Date.now() - fetchStart
        console.log(`[Auth] Profile API response in ${fetchTime}ms, status: ${res.status}`)
        
        if (!res.ok) {
          throw new Error(`Profile API error: ${res.status}`)
        }
        
        const result = await res.json()
        
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

        // Экспоненциальная задержка перед следующей попыткой
        const delay = baseDelay * Math.pow(2, attempt - 1)
        loggers.auth.info(`Retrying in ${delay}ms... (attempt ${attempt + 1}/${maxRetries})`)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }

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
  }, [user?.id, user, sessionLoading])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }: { data: { session: any } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
      setSessionLoading(false) // Сессия загружена
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event: any, session: any) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
      setSessionLoading(false) // Сессия обновлена

      if (_event === 'SIGNED_IN' && session?.user) {
        try {
          await syncLocalDataToAccount(session.user.id)
          window.dispatchEvent(new Event("auth-synced"))
          toast({ title: "Вход выполнен", description: "Данные синхронизированы" })
        } catch (e) {
          loggers.auth.error("Sync error", e)
        }
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const clearGuestLocalData = () => {
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

  const signOut = async () => {
    try {
      // Отправляем событие начала выхода для оверлея
      window.dispatchEvent(new Event("logout-start"))
      
      setLoading(true)
      await safeSupabaseSignOutLocal()
      forceClearSupabaseAuthStorage()
    } catch (error: any) {
      loggers.auth.error("Sign out error:", error)
      toast({
        title: "Ошибка",
        description: error?.message || "Не удалось выйти из аккаунта",
        variant: "destructive",
      })
    } finally {
      clearGuestLocalData()
      setSession(null)
      setUser(null)
      setProfile(null)
      setLoading(false)
      router.push("/")
      router.refresh()
    }
  }

  return (
    <AuthContext.Provider value={{ user, session, loading, sessionLoading, profileLoading, signOut, profile, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)