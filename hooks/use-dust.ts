import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '@/components/auth-provider'
import { supabase } from '@/lib/supabase'

const DUST_STORAGE_KEY = 'gacha-dust'

export function useDust() {
  const { user, loading: authLoading } = useAuth()
  const [dust, setDust] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  const abortControllerRef = useRef<AbortController | null>(null)
  const isMountedRef = useRef(true)
  const isLoadingRef = useRef(false) // Защита от повторных вызовов

  // Загрузка пыли
  const loadDust = useCallback(async () => {
    // Защита от повторных вызовов
    if (isLoadingRef.current) {
      console.log('[useDust] Already loading, skipping...')
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
    
    console.log('[useDust] loadDust called, user:', user?.id || 'null')

    if (!user) {
      // Для неавторизованных - загружаем из localStorage
      const saved = localStorage.getItem(DUST_STORAGE_KEY)
      const savedDust = saved ? parseInt(saved, 10) || 0 : 0
      console.log('[useDust] No user, using localStorage:', savedDust)
      if (isMountedRef.current) {
        setDust(savedDust)
        setLoading(false)
      }
      isLoadingRef.current = false
      return
    }

    // Запускаем таймаут ТОЛЬКО когда начинаем реальную загрузку
    const loadingTimeout = setTimeout(() => {
      console.warn('[useDust] Loading timeout, forcing loading to false')
      if (isMountedRef.current) {
        setLoading(false)
      }
      isLoadingRef.current = false
    }, 20000) // 20 секунд

    try {
      // Для авторизованных - загружаем из API
      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData?.session?.access_token) {
        console.warn('[useDust] No session token available')
        const saved = localStorage.getItem(DUST_STORAGE_KEY)
        if (isMountedRef.current) {
          setDust(saved ? parseInt(saved, 10) || 0 : 0)
          setLoading(false)
        }
        clearTimeout(loadingTimeout)
        isLoadingRef.current = false
        return
      }

      const res = await fetch('/api/dust', {
        headers: {
          'Authorization': `Bearer ${sessionData.session.access_token}`
        },
        signal
      })

      const result = await res.json()

      if (result.success) {
        console.log('[useDust] Dust loaded from server:', result.dust)
        if (isMountedRef.current) {
          setDust(result.dust || 0)
          // Сохраняем в localStorage как кэш
          localStorage.setItem(DUST_STORAGE_KEY, (result.dust || 0).toString())
          setLoading(false)
        }
        clearTimeout(loadingTimeout)
        isLoadingRef.current = false
      } else {
        console.warn('[useDust] Server error, using localStorage fallback:', result.message)
        const saved = localStorage.getItem(DUST_STORAGE_KEY)
        if (isMountedRef.current) {
          setDust(saved ? parseInt(saved, 10) || 0 : 0)
          setLoading(false)
        }
        clearTimeout(loadingTimeout)
        isLoadingRef.current = false
      }
    } catch (error: any) {
      // Игнорируем AbortError - это нормальная ситуация при размонтировании или отмене запроса
      if (error.name === 'AbortError') {
        console.log('[useDust] Request aborted (expected behavior)')
        clearTimeout(loadingTimeout)
        isLoadingRef.current = false
        return
      }

      console.error('[useDust] Error loading dust:', error)
      // Фолбэк на localStorage
      const saved = localStorage.getItem(DUST_STORAGE_KEY)
      if (isMountedRef.current) {
        setDust(saved ? parseInt(saved, 10) || 0 : 0)
        setLoading(false)
      }
      clearTimeout(loadingTimeout)
      isLoadingRef.current = false
    }
  }, [user])

  // SECURE: Добавить пыль через безопасный API
  const addDust = useCallback(async (amount: number): Promise<boolean> => {
    if (!user) {
      console.warn('[useDust] Cannot add dust: user not authenticated')
      // Для неавторизованных обновляем только локальное состояние
      const newDust = dust + amount
      if (isMountedRef.current) {
        setDust(newDust)
        localStorage.setItem(DUST_STORAGE_KEY, newDust.toString())
      }
      return true
    }

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData?.session?.access_token) {
        console.warn('[useDust] No session token available')
        return false
      }

      const res = await fetch('/api/dust', {
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
        if (isMountedRef.current) {
          setDust(result.newBalance || dust)
          localStorage.setItem(DUST_STORAGE_KEY, (result.newBalance || dust).toString())
        }
        console.log(`[useDust] Successfully added ${amount} dust`)
        return true
      } else {
        console.error('[useDust] Failed to add dust:', result.message)
        return false
      }
    } catch (error: any) {
      // Игнорируем AbortError
      if (error.name === 'AbortError') {
        console.log('[useDust] Add dust request aborted')
        return false
      }
      console.error('[useDust] Error adding dust:', error)
      return false
    }
  }, [user, dust])

  // SECURE: Потратить пыль через безопасный API
  const spendDust = useCallback(async (amount: number): Promise<boolean> => {
    if (!user) {
      console.warn('[useDust] Cannot spend dust: user not authenticated')
      // Для неавторизованных проверяем локальный баланс
      if (dust < amount) return false
      const newDust = dust - amount
      if (isMountedRef.current) {
        setDust(newDust)
        localStorage.setItem(DUST_STORAGE_KEY, newDust.toString())
      }
      return true
    }

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData?.session?.access_token) {
        console.warn('[useDust] No session token available')
        return false
      }

      const res = await fetch('/api/dust', {
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
        if (isMountedRef.current) {
          setDust(result.newBalance || dust)
          localStorage.setItem(DUST_STORAGE_KEY, (result.newBalance || dust).toString())
        }
        console.log(`[useDust] Successfully spent ${amount} dust`)
        return true
      } else {
        console.error('[useDust] Failed to spend dust:', result.message)
        return false
      }
    } catch (error: any) {
      // Игнорируем AbortError
      if (error.name === 'AbortError') {
        console.log('[useDust] Spend dust request aborted')
        return false
      }
      console.error('[useDust] Error spending dust:', error)
      return false
    }
  }, [user, dust])

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

  // Слушаем изменения авторизации, но ждём пока authLoading !== true
  useEffect(() => {
    // Не начинаем загрузку, пока авторизация ещё загружается
    if (authLoading) {
      console.log('[useDust] Auth still loading, waiting...')
      return
    }
    loadDust()
  }, [user?.id, authLoading])

  return {
    dust,
    loading,
    addDust,        // Безопасная API операция
    spendDust,      // Безопасная API операция
    refresh: loadDust
  }
}
