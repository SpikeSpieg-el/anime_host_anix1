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

    const data = await res.json()

    if (!res.ok) {
      console.error('[saveCardToDatabase] API error:', data.error)
      return { success: false, error: data.error || 'Failed to save card' }
    }

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

    const data = await res.json()

    if (!res.ok) {
      console.error('[deleteCardFromDatabase] API error:', data.error)
      return { success: false, error: data.error || 'Failed to delete card' }
    }

    console.log('[deleteCardFromDatabase] Card deleted successfully:', uniqueId)
    return { success: true }
  } catch (error) {
    console.error('[deleteCardFromDatabase] Error:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}
