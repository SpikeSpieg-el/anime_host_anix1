import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '@/components/auth-provider'
import { supabase, syncLocalDataToAccount, forceSyncCoins, fixOverflowCoins } from '@/lib/supabase'

const COINS_STORAGE_KEY = 'gacha-coins'

export function useCoins() {
  const { user } = useAuth()
  const [coins, setCoins] = useState<number>(1000)
  const [loading, setLoading] = useState(true)
  const retryCountRef = useRef(0)

  const MAX_RETRIES = 3
  const RETRY_DELAY_BASE = 2000 // Increased base delay to 2 seconds

  // Загрузка монет
  const loadCoins = useCallback(async () => {
    console.log('[useCoins] loadCoins called, user:', user?.id || 'null', 'retry:', retryCountRef.current)
    
    // Добавим timeout для защиты от бесконечной загрузки
    const loadingTimeout = setTimeout(() => {
      console.warn('[useCoins] Loading timeout, forcing loading to false')
      setLoading(false)
    }, 15000) // 15 секунд
    
    if (!user) {
      // Для неавторизованных - загружаем из localStorage (гостевой баланс 1000)
      const saved = localStorage.getItem(COINS_STORAGE_KEY)
      const savedCoins = saved ? parseInt(saved, 10) || 1000 : 1000
      console.log('[useCoins] No user, using localStorage:', savedCoins)
      setCoins(savedCoins)
      clearTimeout(loadingTimeout)
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
        clearTimeout(loadingTimeout)
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
            // Retry after a delay with exponential backoff
            retryCountRef.current += 1
            clearTimeout(loadingTimeout)
            setTimeout(() => {
              loadCoins()
            }, RETRY_DELAY_BASE * Math.pow(2, retryCountRef.current - 1)) // 2s, 4s, 8s
            return
          } else {
            // Max retries reached, use fallback
            console.warn('[useCoins] Max retries reached, using fallback coins')
            const fallbackCoins = 10000
            setCoins(fallbackCoins)
            localStorage.setItem(COINS_STORAGE_KEY, fallbackCoins.toString())
            retryCountRef.current = 0
            clearTimeout(loadingTimeout)
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
      clearTimeout(loadingTimeout)
      setLoading(false)
      console.log('[useCoins] Loading complete, final coins:', coins)
    }
  }, [user])

  // SECURE: Потратить монеты через безопасный API
  const spendCoins = useCallback(async (amount: number): Promise<boolean> => {
    if (!user) {
      console.warn('[useCoins] Cannot spend coins: user not authenticated')
      return false
    }

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData?.session?.access_token) {
        console.warn('[useCoins] No session token available')
        return false
      }

      const res = await fetch('/api/coins', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionData.session.access_token}`
        },
        body: JSON.stringify({ operation: 'spend', amount })
      })

      const result = await res.json()
      
      if (result.success) {
        // Обновляем локальное состояние после успешной операции
        setCoins(result.newBalance || coins)
        localStorage.setItem(COINS_STORAGE_KEY, (result.newBalance || coins).toString())
        console.log(`[useCoins] Successfully spent ${amount} coins`)
        return true
      } else {
        console.error('[useCoins] Failed to spend coins:', result.message)
        return false
      }
    } catch (error) {
      console.error('[useCoins] Error spending coins:', error)
      return false
    }
  }, [user, coins])

  // SECURE: Добавить монеты через безопасный API
  const addCoins = useCallback(async (amount: number): Promise<boolean> => {
    if (!user) {
      console.warn('[useCoins] Cannot add coins: user not authenticated')
      return false
    }

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData?.session?.access_token) {
        console.warn('[useCoins] No session token available')
        return false
      }

      const res = await fetch('/api/coins', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionData.session.access_token}`
        },
        body: JSON.stringify({ operation: 'add', amount })
      })

      const result = await res.json()
      
      if (result.success) {
        // Обновляем локальное состояние после успешной операции
        setCoins(result.newBalance || coins)
        localStorage.setItem(COINS_STORAGE_KEY, (result.newBalance || coins).toString())
        console.log(`[useCoins] Successfully added ${amount} coins`)
        return true
      } else {
        console.error('[useCoins] Failed to add coins:', result.message)
        return false
      }
    } catch (error) {
      console.error('[useCoins] Error adding coins:', error)
      return false
    }
  }, [user, coins])

  // Слушаем изменения авторизации
  useEffect(() => {
    loadCoins()
  }, [user?.id])

  return {
    coins,
    loading,
    // УБРАНО: updateCoins - небезопасная функция
    spendCoins,      // Безопасная API операция
    addCoins,        // Безопасная API операция  
    refresh: loadCoins,
    forceSync: async () => {
      if (!user) return
      const syncedCoins = await forceSyncCoins(user.id)
      if (syncedCoins !== null) {
        setCoins(syncedCoins)
        localStorage.setItem(COINS_STORAGE_KEY, syncedCoins.toString())
      }
      await loadCoins()
    },
    fixOverflow: async (targetAmount: number = 70000) => {
      if (!user) return
      const fixedCoins = await fixOverflowCoins(user.id, targetAmount)
      if (fixedCoins !== null && fixedCoins !== undefined) {
        setCoins(fixedCoins)
        localStorage.setItem(COINS_STORAGE_KEY, fixedCoins.toString())
      }
      await loadCoins()
    }
  }
}
