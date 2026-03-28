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
  signOut: async () => {},
  profile: null,
  refreshProfile: async () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
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
    setProfileLoading(true)
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
           const { data: newProfile, error: createError } = await supabase
              .from('profiles')
              .insert({ id: user.id, username: user.email })
              .select()
              .single()

          if (!createError) {
              setProfile(newProfile)
              setProfileLoading(false)
              return
            } else if (createError.code === '23505' || createError.code === '409') {
             const { data: retryData, error: retryError } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single()

             if (!retryError && retryData) {
               setProfile(retryData)
               setProfileLoading(false)
               return
             }
           }
        }

        if (error.message?.includes('406') || error.details?.includes('Not Acceptable')) {
          loggers.auth.warn('User may be deleted or invalid, signing out')
          setProfileLoading(false)
          await hardSignOut()
          return
        }

        throw error
      }

      setProfile(data)
      setProfileLoading(false)
    } catch (error: any) {
      loggers.auth.error('Error fetching profile:', error)
      setProfileLoading(false)
      if (error.message?.includes('406') || error.details?.includes('Not Acceptable') || error.code === 'PGRST116') {
        toast({
          title: "Ошибка авторизации",
          description: "Пользователь не найден. Пожалуйста, войдите снова.",
          variant: "destructive"
        })
        await hardSignOut()
      }
    }
  }

  useEffect(() => {
    if (user) {
      refreshProfile()
    } else {
      setProfile(null)
      setProfileLoading(false)
    }
  }, [user])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }: { data: { session: any } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event: any, session: any) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)

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
      document.cookie = `bookmark_ids=; path=/; max-age=0; SameSite=Lax`
    } catch {
      // ignore
    }
  }

  const signOut = async () => {
    try {
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
    <AuthContext.Provider value={{ user, session, loading, profileLoading, signOut, profile, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)