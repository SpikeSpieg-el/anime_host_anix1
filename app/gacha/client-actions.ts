"use client"

import type { Card } from './page'

/**
 * Client-side functions for card database operations
 * These functions run in the browser and have access to the user session
 */

// Helper function to fetch with timeout
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs: number = 10000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    return response;
  } catch (error: any) {
    // If this is a system abort (e.g., tab change), don't treat it as a fatal error
    if (error.name === 'AbortError') {
      console.warn(`[Fetch] Request to ${url} was aborted.`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function saveCardToDatabase(card: Card): Promise<{ success: boolean; error?: string; exists?: boolean; isAbort?: boolean }> {
  try {
    const { supabase } = await import('@/lib/supabase')

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      console.log('[saveCardToDatabase] No session found, card not saved to DB')
      return { success: false, error: 'Not authenticated' }
    }

    const token = session.access_token

    const res = await fetchWithTimeout('/api/cards', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(card)
    }, 10000)

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

        const retryRes = await fetchWithTimeout('/api/cards', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${newSession.access_token}`
          },
          body: JSON.stringify(card)
        }, 10000)

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
  } catch (error: any) {
    // Handle AbortError specially - this is when browser aborts due to tab change
    if (error.name === 'AbortError') {
      console.warn('[saveCardToDatabase] Operation aborted by browser');
      return { success: false, error: 'Operation aborted by browser', isAbort: true };
    }
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

    const res = await fetchWithTimeout('/api/cards', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    }, 8000)

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

        const retryRes = await fetchWithTimeout('/api/cards', {
          headers: {
            'Authorization': `Bearer ${newSession.access_token}`
          }
        }, 8000)

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

    const res = await fetchWithTimeout('/api/cards', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ uniqueId })
    }, 8000)

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

        const retryRes = await fetchWithTimeout('/api/cards', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${newSession.access_token}`
          },
          body: JSON.stringify({ uniqueId })
        }, 8000)

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

/**
 * Save cards to localStorage queue for later sync to DB
 * Used when DB save fails due to network issues or tab switching
 */
export function queueCardForSync(card: Card) {
  try {
    const queue = JSON.parse(localStorage.getItem('gacha-sync-queue') || '[]');
    // Check if card already in queue
    if (!queue.some((c: Card) => c.uniqueId === card.uniqueId)) {
      queue.push(card);
      localStorage.setItem('gacha-sync-queue', JSON.stringify(queue));
      console.log('[queueCardForSync] Card queued for sync:', card.uniqueId);
    }
  } catch (error) {
    console.error('[queueCardForSync] Error:', error);
  }
}

/**
 * Sync queued cards from localStorage to DB
 * Called on page load to recover from failed saves
 */
export async function syncQueuedCards(): Promise<{ success: number; failed: number }> {
  try {
    const { supabase } = await import('@/lib/supabase');
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      console.log('[syncQueuedCards] No session, skipping sync');
      return { success: 0, failed: 0 };
    }

    const queue = JSON.parse(localStorage.getItem('gacha-sync-queue') || '[]');
    if (queue.length === 0) {
      return { success: 0, failed: 0 };
    }

    console.log('[syncQueuedCards] Syncing', queue.length, 'cards');
    
    let success = 0;
    let failed = 0;

    for (const card of queue) {
      try {
        const result = await saveCardToDatabase(card);
        if (result.success) {
          success++;
        } else {
          failed++;
        }
      } catch (error) {
        console.error('[syncQueuedCards] Failed to sync card:', card.uniqueId, error);
        failed++;
      }
    }

    // Clear synced cards from queue
    const remainingQueue = queue.filter((card: Card, index: number) => {
      // Assume first N cards were synced (simplified logic)
      return index >= success;
    });
    localStorage.setItem('gacha-sync-queue', JSON.stringify(remainingQueue));
    
    console.log('[syncQueuedCards] Sync complete:', { success, failed, remaining: remainingQueue.length });
    return { success, failed };
  } catch (error) {
    console.error('[syncQueuedCards] Error:', error);
    return { success: 0, failed: 0 };
  }
}
