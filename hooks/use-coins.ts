import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '@/components/auth-provider'
import { supabase, syncLocalDataToAccount, forceSyncCoins, fixOverflowCoins } from '@/lib/supabase'

const COINS_STORAGE_KEY = 'gacha-coins'

export function useCoins() {
  const { user, loading: authLoading, sessionLoading, session } = useAuth()
  const [coins, setCoins] = useState<number>(1000)
  const [loading, setLoading] = useState(true)
  const retryCountRef = useRef(0)
  const abortControllerRef = useRef<AbortController | null>(null)
  const isMountedRef = useRef(true)
  const isLoadingRef = useRef(false) // Защита от повторных вызовов

  const MAX_RETRIES = 3
  const RETRY_DELAY_BASE = 2000 // Increased base delay to 2 seconds

  // Загрузка монет
  const loadCoins = useCallback(async () => {
    // Защита от повторных вызовов
    if (isLoadingRef.current) {
      console.log('[useCoins] Already loading, skipping...')
      return
    }

    isLoadingRef.current = true

    // Отменяем предыдущий запрос если есть
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    // Создаем новый AbortController для этого запроса
    abortControllerRef.current = new AbortController()
    const { signal } = abortControllerRef.current

    console.log('[useCoins] loadCoins called, user:', user?.id || 'null', 'session:', !!session, 'retry:', retryCountRef.current)

    if (!user) {
      // Для неавторизованных - загружаем из localStorage (гостевой баланс 1000)
      const saved = localStorage.getItem(COINS_STORAGE_KEY)
      const savedCoins = saved ? parseInt(saved, 10) || 1000 : 1000
      console.log('[useCoins] No user, using localStorage:', savedCoins)
      if (isMountedRef.current) {
        setCoins(savedCoins)
        setLoading(false)
      }
      isLoadingRef.current = false
      return
    }

    // Используем сессию напрямую из useAuth вместо дублирующего getSession()
    const accessToken = session?.access_token
    
    if (!accessToken) {
      console.warn('[useCoins] No access token in session, using localStorage fallback')
      const saved = localStorage.getItem(COINS_STORAGE_KEY)
      if (isMountedRef.current) {
        setCoins(saved ? parseInt(saved, 10) || 1000 : 1000)
        setLoading(false)
      }
      isLoadingRef.current = false
      return
    }

    // Запускаем таймаут ТОЛЬКО когда начинаем реальную загрузку
    const loadingTimeout = setTimeout(() => {
      console.warn('[useCoins] Loading timeout, forcing loading to false')
      if (isMountedRef.current) {
        setLoading(false)
      }
      isLoadingRef.current = false
    }, 15000) // 15 секунд для продакшена

    try {
      console.log('[useCoins] Fetching coins from API with token...')

      const res = await fetch('/api/coins', {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        },
        signal
      })

      console.log('[useCoins] API response status:', res.status)

      if (res.ok) {
        const data = await res.json()
        console.log('[useCoins] Coins loaded:', data.coins)
        if (isMountedRef.current) {
          setCoins(data.coins || 10000)
          // Сохраняем в localStorage как кэш
          localStorage.setItem(COINS_STORAGE_KEY, data.coins.toString())
          // Reset retry count on success
          retryCountRef.current = 0
          setLoading(false)
        }
        clearTimeout(loadingTimeout)
        isLoadingRef.current = false
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
            if (isMountedRef.current) {
              setCoins(fallbackCoins)
              localStorage.setItem(COINS_STORAGE_KEY, fallbackCoins.toString())
              setLoading(false)
            }
            retryCountRef.current = 0
            clearTimeout(loadingTimeout)
            isLoadingRef.current = false
            return
          }
        }

        // При ошибке 401/403 - пробуем выйти и войти заново
        if (res.status === 401 || res.status === 403) {
          console.warn('[useCoins] Auth error, clearing session')
          await supabase.auth.signOut({ scope: 'local' })
        }
        const saved = localStorage.getItem(COINS_STORAGE_KEY)
        if (isMountedRef.current) {
          setCoins(saved ? parseInt(saved, 10) || 1000 : 1000)
          setLoading(false)
        }
        clearTimeout(loadingTimeout)
        isLoadingRef.current = false
      }
    } catch (error: any) {
      // Игнорируем AbortError - это нормальная ситуация при размонтировании или отмене запроса
      if (error.name === 'AbortError') {
        console.log('[useCoins] Request aborted (expected behavior)')
        clearTimeout(loadingTimeout)
        isLoadingRef.current = false
        return
      }

      console.error('[useCoins] Error loading coins:', error)
      // Фолбэк на localStorage
      const saved = localStorage.getItem(COINS_STORAGE_KEY)
      if (isMountedRef.current) {
        setCoins(saved ? parseInt(saved, 10) || 1000 : 1000)
        setLoading(false)
      }
      clearTimeout(loadingTimeout)
      isLoadingRef.current = false
    }
  }, [user])

  // SECURE: Потратить монеты через безопасный API
  const spendCoins = useCallback(async (amount: number): Promise<boolean> => {
    if (!user) {
      console.warn('[useCoins] Cannot spend coins: user not authenticated')
      return false
    }

    // Используем сессию напрямую из useAuth
    const accessToken = session?.access_token
    if (!accessToken) {
      console.warn('[useCoins] No session token available')
      return false
    }

    try {
      const res = await fetch('/api/coins', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({ operation: 'spend', amount })
      })

      const result = await res.json()

      if (result.success) {
        // Обновляем локальное состояние после успешной операции
        if (isMountedRef.current) {
          setCoins(result.newBalance || coins)
          localStorage.setItem(COINS_STORAGE_KEY, (result.newBalance || coins).toString())
        }
        console.log(`[useCoins] Successfully spent ${amount} coins`)
        return true
      } else {
        console.error('[useCoins] Failed to spend coins:', result.message)
        return false
      }
    } catch (error: any) {
      // Игнорируем AbortError
      if (error.name === 'AbortError') {
        console.log('[useCoins] Spend coins request aborted')
        return false
      }
      console.error('[useCoins] Error spending coins:', error)
      return false
    }
  }, [user, coins, session])

  // SECURE: Добавить монеты через безопасный API
  const addCoins = useCallback(async (amount: number): Promise<boolean> => {
    if (!user) {
      console.warn('[useCoins] Cannot add coins: user not authenticated')
      return false
    }

    // Используем сессию напрямую из useAuth
    const accessToken = session?.access_token
    if (!accessToken) {
      console.warn('[useCoins] No session token available')
      return false
    }

    try {
      const res = await fetch('/api/coins', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({ operation: 'add', amount })
      })

      const result = await res.json()

      if (result.success) {
        // Обновляем локальное состояние после успешной операции
        if (isMountedRef.current) {
          setCoins(result.newBalance || coins)
          localStorage.setItem(COINS_STORAGE_KEY, (result.newBalance || coins).toString())
        }
        console.log(`[useCoins] Successfully added ${amount} coins`)
        return true
      } else {
        console.error('[useCoins] Failed to add coins:', result.message)
        return false
      }
    } catch (error: any) {
      // Игнорируем AbortError
      if (error.name === 'AbortError') {
        console.log('[useCoins] Add coins request aborted')
        return false
      }
      console.error('[useCoins] Error adding coins:', error)
      return false
    }
  }, [user, coins])

  // Отслеживаем монтирование/размонтирование компонента
  useEffect(() => {
    isMountedRef.current = true
    
    return () => {
      isMountedRef.current = false
      // Отменяем все pending запросы при размонтировании
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
        abortControllerRef.current = null
      }
    }
  }, [])

  // Слушаем изменения авторизации, но ждём пока authLoading !== true И sessionLoading !== true
  useEffect(() => {
    const userId = user?.id
    
    // Не начинаем загрузку, пока авторизация ещё загружается
    if (authLoading) {
      console.log('[useCoins] Auth still loading (authLoading=true), waiting...')
      return
    }

    // Если сессия уже есть - начинаем загрузку, даже если sessionLoading ещё true
    // Это нужно для случаев, когда сессия восстановлена из localStorage
    if (userId) {
      console.log('[useCoins] User exists, starting load. sessionLoading:', sessionLoading)
      loadCoins()
      return
    }

    // Для неавторизованных - ждём пока sessionLoading не станет false
    if (sessionLoading) {
      console.log('[useCoins] No user, session still loading, waiting...')
      return
    }

    console.log('[useCoins] No user, session not loading, starting load for guest')
    loadCoins()
  }, [user?.id, authLoading, sessionLoading]) // Используем user?.id вместо user

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
