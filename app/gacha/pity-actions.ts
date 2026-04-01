/**
 * Client-side functions for pity system operations
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
    if (error.name === 'AbortError') {
      console.warn(`[Fetch] Request to ${url} was aborted.`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export interface PityData {
  bad_luck_streak: number;
  last_rare_roll?: string;
}

export async function loadUserPity(): Promise<PityData | null> {
  try {
    const { supabase } = await import('@/lib/supabase');
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      console.log('[loadUserPity] No session found');
      return null;
    }

    const token = session.access_token;

    const res = await fetchWithTimeout('/api/pity', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    }, 8000);

    if (!res.ok) {
      if (res.status === 401) {
        console.warn('[loadUserPity] Token expired or invalid, user may need to re-authenticate');
        return null;
      }

      console.error('[loadUserPity] API error:', res.status);
      return null;
    }

    const data = await res.json();
    console.log('[loadUserPity] Loaded pity data:', data.pity);
    return data.pity || null;
  } catch (error) {
    console.error('[loadUserPity] Error:', error);
    return null;
  }
}

export async function updateUserPity(bad_luck_streak: number, last_rare_roll?: string): Promise<{ success: boolean; pity?: PityData; error?: string }> {
  try {
    const { supabase } = await import('@/lib/supabase');
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      return { success: false, error: 'Not authenticated' };
    }

    const token = session.access_token;

    const res = await fetchWithTimeout('/api/pity', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ bad_luck_streak, last_rare_roll })
    }, 8000);

    if (!res.ok) {
      if (res.status === 401) {
        console.warn('[updateUserPity] Token expired or invalid, attempting refresh');
        const { error } = await supabase.auth.refreshSession();
        if (error) {
          console.error('[updateUserPity] Failed to refresh session:', error);
          return { success: false, error: 'Authentication failed' };
        }

        const { data: { session: newSession } } = await supabase.auth.getSession();
        if (!newSession) {
          console.log('[updateUserPity] No session after refresh');
          return { success: false, error: 'Not authenticated' };
        }

        const retryRes = await fetchWithTimeout('/api/pity', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${newSession.access_token}`
          },
          body: JSON.stringify({ bad_luck_streak, last_rare_roll })
        }, 8000);

        if (!retryRes.ok) {
          const errorData = await retryRes.json();
          console.error('[updateUserPity] API error after retry:', errorData.error);
          return { success: false, error: errorData.error || 'Failed to update pity' };
        }

        const retryData = await retryRes.json();
        console.log('[updateUserPity] Pity updated successfully after retry:', retryData.pity);
        return { success: true, pity: retryData.pity };
      }

      const data = await res.json();
      console.error('[updateUserPity] API error:', data.error);
      return { success: false, error: data.error || 'Failed to update pity' };
    }

    const data = await res.json();
    console.log('[updateUserPity] Pity updated successfully:', data.pity);
    return { success: true, pity: data.pity };
  } catch (error) {
    console.error('[updateUserPity] Error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}
