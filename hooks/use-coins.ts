import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '@/components/auth-provider'
import { supabase } from '@/lib/supabase'

const COINS_STORAGE_KEY = 'gacha-coins'

export function useCoins() {
  const { user } = useAuth()
  const [coins, setCoins] = useState<number>(1000)
  const [loading, setLoading] = useState(true)
  const retryCountRef = useRef(0)

  const MAX_RETRIES = 3

  // Загрузка монет
  const loadCoins = useCallback(async () => {
    console.log('[useCoins] loadCoins called, user:', user?.id || 'null', 'retry:', retryCountRef.current)
    
    if (!user) {
      // Для неавторизованных - загружаем из localStorage (гостевой баланс 1000)
      const saved = localStorage.getItem(COINS_STORAGE_KEY)
      const savedCoins = saved ? parseInt(saved, 10) || 1000 : 1000
      console.log('[useCoins] No user, using localStorage:', savedCoins)
      setCoins(savedCoins)
      setLoading(false)
      return
    }

    try {
      // Для авторизованных - загружаем из БД (10000 для новых пользователей)
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
      
      if (sessionError) {
        console.error('[useCoins] Session error:', sessionError)
      }
      
      if (sessionError || !sessionData?.session) {
        console.warn('[useCoins] No valid session found, using localStorage fallback')
        const saved = localStorage.getItem(COINS_STORAGE_KEY)
        setCoins(saved ? parseInt(saved, 10) || 1000 : 1000)
        setLoading(false)
        return
      }

      const token = sessionData.session.access_token
      console.log('[useCoins] Fetching coins from API...')

      const res = await fetch('/api/coins', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      console.log('[useCoins] API response status:', res.status)

      if (res.ok) {
        const data = await res.json()
        console.log('[useCoins] Coins loaded:', data.coins)
        setCoins(data.coins || 10000)
        // Сохраняем в localStorage как кэш
        localStorage.setItem(COINS_STORAGE_KEY, data.coins.toString())
        // Reset retry count on success
        retryCountRef.current = 0
      } else {
        const errorData = await res.json().catch(() => ({}))
        console.warn('[useCoins] Coins API error:', res.status, errorData)
        
        // Handle 500 errors with fallback and retry
        if (res.status === 500) {
          console.warn('[useCoins] Server error, attempt:', retryCountRef.current + 1, 'of', MAX_RETRIES)
          
          if (retryCountRef.current < MAX_RETRIES) {
            // Retry after a delay
            retryCountRef.current += 1
            setTimeout(() => {
              loadCoins()
            }, 1000 * retryCountRef.current) // Exponential backoff
            return
          } else {
            // Max retries reached, use fallback
            console.warn('[useCoins] Max retries reached, using fallback coins')
            const fallbackCoins = 10000
            setCoins(fallbackCoins)
            localStorage.setItem(COINS_STORAGE_KEY, fallbackCoins.toString())
            retryCountRef.current = 0
            return
          }
        }
        
        // При ошибке 401/403 - пробуем выйти и войти заново
        if (res.status === 401 || res.status === 403) {
          console.warn('[useCoins] Auth error, clearing session')
          await supabase.auth.signOut({ scope: 'local' })
        }
        const saved = localStorage.getItem(COINS_STORAGE_KEY)
        setCoins(saved ? parseInt(saved, 10) || 1000 : 1000)
      }
    } catch (error) {
      console.error('[useCoins] Error loading coins:', error)
      // Фолбэк на localStorage
      const saved = localStorage.getItem(COINS_STORAGE_KEY)
      setCoins(saved ? parseInt(saved, 10) || 1000 : 1000)
    } finally {
      setLoading(false)
      console.log('[useCoins] Loading complete, final coins:', coins)
    }
  }, [user])

  // Обновление монет
  const updateCoins = useCallback(async (newCoins: number, syncWithDb: boolean = true) => {
    setCoins(newCoins)
    localStorage.setItem(COINS_STORAGE_KEY, newCoins.toString())

    if (!user || !syncWithDb) return

    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token
      if (!token) return

      await fetch('/api/coins', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ coins: newCoins })
      })
    } catch (error) {
      console.error('Error updating coins:', error)
    }
  }, [user])

  // Потратить монеты
  const spendCoins = useCallback(async (amount: number): Promise<boolean> => {
    if (coins < amount) return false

    const newCoins = coins - amount
    await updateCoins(newCoins, true)
    return true
  }, [coins, updateCoins])

  // Добавить монеты
  const addCoins = useCallback(async (amount: number) => {
    const newCoins = coins + amount
    await updateCoins(newCoins, true)
  }, [coins, updateCoins])

  // Слушаем изменения авторизации
  useEffect(() => {
    loadCoins()
  }, [user?.id])

  return {
    coins,
    loading,
    updateCoins,
    spendCoins,
    addCoins,
    refresh: loadCoins
  }
}
