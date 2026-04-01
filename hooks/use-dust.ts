import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/components/auth-provider'
import { supabase } from '@/lib/supabase'

const DUST_STORAGE_KEY = 'gacha-dust'

export function useDust() {
  const { user } = useAuth()
  const [dust, setDust] = useState<number>(0)
  const [loading, setLoading] = useState(true)

  // Загрузка пыли
  const loadDust = useCallback(async () => {
    console.log('[useDust] loadDust called, user:', user?.id || 'null')
    
    if (!user) {
      // Для неавторизованных - загружаем из localStorage
      const saved = localStorage.getItem(DUST_STORAGE_KEY)
      const savedDust = saved ? parseInt(saved, 10) || 0 : 0
      console.log('[useDust] No user, using localStorage:', savedDust)
      setDust(savedDust)
      setLoading(false)
      return
    }

    try {
      // Для авторизованных - загружаем из API
      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData?.session?.access_token) {
        console.warn('[useDust] No session token available')
        const saved = localStorage.getItem(DUST_STORAGE_KEY)
        setDust(saved ? parseInt(saved, 10) || 0 : 0)
        setLoading(false)
        return
      }

      const res = await fetch('/api/dust', {
        headers: {
          'Authorization': `Bearer ${sessionData.session.access_token}`
        }
      })
      
      const result = await res.json()
      
      if (result.success) {
        console.log('[useDust] Dust loaded from server:', result.dust)
        setDust(result.dust || 0)
        // Сохраняем в localStorage как кэш
        localStorage.setItem(DUST_STORAGE_KEY, (result.dust || 0).toString())
      } else {
        console.warn('[useDust] Server error, using localStorage fallback:', result.message)
        const saved = localStorage.getItem(DUST_STORAGE_KEY)
        setDust(saved ? parseInt(saved, 10) || 0 : 0)
      }
    } catch (error) {
      console.error('[useDust] Error loading dust:', error)
      // Фолбэк на localStorage
      const saved = localStorage.getItem(DUST_STORAGE_KEY)
      setDust(saved ? parseInt(saved, 10) || 0 : 0)
    } finally {
      setLoading(false)
    }
  }, [user])

  // SECURE: Добавить пыль через безопасный API
  const addDust = useCallback(async (amount: number): Promise<boolean> => {
    if (!user) {
      console.warn('[useDust] Cannot add dust: user not authenticated')
      // Для неавторизованных обновляем только локальное состояние
      const newDust = dust + amount
      setDust(newDust)
      localStorage.setItem(DUST_STORAGE_KEY, newDust.toString())
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
        setDust(result.newBalance || dust)
        localStorage.setItem(DUST_STORAGE_KEY, (result.newBalance || dust).toString())
        console.log(`[useDust] Successfully added ${amount} dust`)
        return true
      } else {
        console.error('[useDust] Failed to add dust:', result.message)
        return false
      }
    } catch (error) {
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
      setDust(newDust)
      localStorage.setItem(DUST_STORAGE_KEY, newDust.toString())
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
        setDust(result.newBalance || dust)
        localStorage.setItem(DUST_STORAGE_KEY, (result.newBalance || dust).toString())
        console.log(`[useDust] Successfully spent ${amount} dust`)
        return true
      } else {
        console.error('[useDust] Failed to spend dust:', result.message)
        return false
      }
    } catch (error) {
      console.error('[useDust] Error spending dust:', error)
      return false
    }
  }, [user, dust])

  // Слушаем изменения авторизации
  useEffect(() => {
    loadDust()
  }, [user?.id])

  return {
    dust,
    loading,
    addDust,        // Безопасная API операция
    spendDust,      // Безопасная API операция
    refresh: loadDust
  }
}
