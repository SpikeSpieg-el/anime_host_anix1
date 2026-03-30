"use client"

import type { Card } from './page'

/**
 * Client-side functions for card database operations
 * These functions run in the browser and have access to the user session
 */

export async function saveCardToDatabase(card: Card): Promise<{ success: boolean; error?: string; exists?: boolean }> {
  try {
    const { supabase } = await import('@/lib/supabase')

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      console.log('[saveCardToDatabase] No session found, card not saved to DB')
      return { success: false, error: 'Not authenticated' }
    }

    const token = session.access_token

    const res = await fetch('/api/cards', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(card)
    })

    if (!res.ok) {
      if (res.status === 401) {
        console.warn('[saveCardToDatabase] Token expired or invalid, attempting refresh')
        // Try to refresh the session
        const { error } = await supabase.auth.refreshSession()
        if (error) {
          console.error('[saveCardToDatabase] Failed to refresh session:', error)
          return { success: false, error: 'Authentication failed' }
        }
        
        // Try again with new session
        const { data: { session: newSession } } = await supabase.auth.getSession()
        if (!newSession) {
          console.log('[saveCardToDatabase] No session after refresh')
          return { success: false, error: 'Not authenticated' }
        }
        
        const retryRes = await fetch('/api/cards', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${newSession.access_token}`
          },
          body: JSON.stringify(card)
        })
        
        if (!retryRes.ok) {
          const errorData = await retryRes.json()
          console.error('[saveCardToDatabase] API error after retry:', errorData.error)
          return { success: false, error: errorData.error || 'Failed to save card' }
        }
        
        const retryData = await retryRes.json()
        if (retryData.exists) {
          console.log('[saveCardToDatabase] Card already exists:', card.uniqueId)
          return { success: true, exists: true }
        }
        
        console.log('[saveCardToDatabase] Card saved successfully after retry:', card.uniqueId)
        return { success: true }
      }
      
      const data = await res.json()
      console.error('[saveCardToDatabase] API error:', data.error)
      return { success: false, error: data.error || 'Failed to save card' }
    }

    const data = await res.json()

    // Card already exists for user - treat as success but mark as exists
    if (data.exists) {
      console.log('[saveCardToDatabase] Card already exists:', card.uniqueId)
      return { success: true, exists: true }
    }

    console.log('[saveCardToDatabase] Card saved successfully:', card.uniqueId)
    return { success: true }
  } catch (error) {
    console.error('[saveCardToDatabase] Error:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

export async function loadUserCards(): Promise<Card[]> {
  try {
    const { supabase } = await import('@/lib/supabase')
    
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      console.log('[loadUserCards] No session found')
      return []
    }

    const token = session.access_token

    const res = await fetch('/api/cards', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })

    if (!res.ok) {
      if (res.status === 401) {
        console.warn('[loadUserCards] Token expired or invalid, user may need to re-authenticate')
        // Try to refresh the session
        const { error } = await supabase.auth.refreshSession()
        if (error) {
          console.error('[loadUserCards] Failed to refresh session:', error)
          return []
        }
        
        // Try again with new session
        const { data: { session: newSession } } = await supabase.auth.getSession()
        if (!newSession) {
          console.log('[loadUserCards] No session after refresh')
          return []
        }
        
        const retryRes = await fetch('/api/cards', {
          headers: {
            'Authorization': `Bearer ${newSession.access_token}`
          }
        })
        
        if (!retryRes.ok) {
          console.error('[loadUserCards] API error after retry:', retryRes.status)
          return []
        }
        
        const retryData = await retryRes.json()
        console.log('[loadUserCards] Loaded', retryData.cards?.length || 0, 'cards after retry')
        return retryData.cards || []
      }
      
      console.error('[loadUserCards] API error:', res.status)
      return []
    }

    const data = await res.json()
    console.log('[loadUserCards] Loaded', data.cards?.length || 0, 'cards')
    return data.cards || []
  } catch (error) {
    console.error('[loadUserCards] Error:', error)
    return []
  }
}

export async function deleteCardFromDatabase(uniqueId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { supabase } = await import('@/lib/supabase')
    
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return { success: false, error: 'Not authenticated' }
    }

    const token = session.access_token

    const res = await fetch('/api/cards', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ uniqueId })
    })

    if (!res.ok) {
      if (res.status === 401) {
        console.warn('[deleteCardFromDatabase] Token expired or invalid, attempting refresh')
        // Try to refresh the session
        const { error } = await supabase.auth.refreshSession()
        if (error) {
          console.error('[deleteCardFromDatabase] Failed to refresh session:', error)
          return { success: false, error: 'Authentication failed' }
        }
        
        // Try again with new session
        const { data: { session: newSession } } = await supabase.auth.getSession()
        if (!newSession) {
          console.log('[deleteCardFromDatabase] No session after refresh')
          return { success: false, error: 'Not authenticated' }
        }
        
        const retryRes = await fetch('/api/cards', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${newSession.access_token}`
          },
          body: JSON.stringify({ uniqueId })
        })
        
        if (!retryRes.ok) {
          const errorData = await retryRes.json()
          console.error('[deleteCardFromDatabase] API error after retry:', errorData.error)
          return { success: false, error: errorData.error || 'Failed to delete card' }
        }
        
        console.log('[deleteCardFromDatabase] Card deleted successfully after retry:', uniqueId)
        return { success: true }
      }
      
      const data = await res.json()
      console.error('[deleteCardFromDatabase] API error:', data.error)
      return { success: false, error: data.error || 'Failed to delete card' }
    }

    const data = await res.json()

    console.log('[deleteCardFromDatabase] Card deleted successfully:', uniqueId)
    return { success: true }
  } catch (error) {
    console.error('[deleteCardFromDatabase] Error:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}
