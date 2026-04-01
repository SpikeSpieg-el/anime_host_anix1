"use server"

import { createClient } from '@supabase/supabase-js'
import { headers } from 'next/headers'

interface DustOperationResult {
  success: boolean
  message?: string
  newBalance?: number
}

/**
 * Get authenticated user from request headers
 */
async function getAuthenticatedUser() {
  const headersList = await headers()
  const authHeader = headersList.get('authorization')
  
  if (!authHeader?.startsWith('Bearer ')) {
    return null
  }

  const token = authHeader.substring(7)
  
  // Create Supabase clients
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    return null
  }

  // Client for JWT verification
  const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey)
  
  // Admin client for database operations
  const supabaseAdmin = createClient(
    supabaseUrl, 
    supabaseServiceKey || supabaseAnonKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  )

  // Verify the JWT token
  const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token)

  if (authError || !user) {
    return null
  }

  return { user, supabaseAdmin }
}

/**
 * Secure server action to add dust to user balance
 * Used for card dismantling
 */
export async function addDustServer(amount: number): Promise<DustOperationResult> {
  if (amount <= 0) {
    return { success: false, message: "Amount must be positive" }
  }

  try {
    const authData = await getAuthenticatedUser()
    if (!authData) {
      return { success: false, message: "Unauthorized" }
    }

    const { user, supabaseAdmin } = authData
    
    // Get current dust balance
    const { data: profile, error: fetchError } = await supabaseAdmin
      .from('user_dust')
      .select('dust')
      .eq('id', user.id)
      .single()

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('[addDustServer] Error fetching profile:', fetchError)
      return { success: false, message: "Database error" }
    }

    const currentBalance = profile?.dust || 0
    const newBalance = currentBalance + amount

    // Update dust balance
    const { error: updateError } = await supabaseAdmin
      .from('user_dust')
      .upsert({ 
        id: user.id, 
        dust: newBalance,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'id'
      })

    if (updateError) {
      console.error('[addDustServer] Error updating dust:', updateError)
      return { success: false, message: "Failed to update dust balance" }
    }

    console.log(`[addDustServer] Added ${amount} dust to user ${user.id}. New balance: ${newBalance}`)
    
    return { 
      success: true, 
      newBalance,
      message: `Added ${amount} dust`
    }
  } catch (error) {
    console.error('[addDustServer] Unexpected error:', error)
    return { success: false, message: "Server error" }
  }
}

/**
 * Secure server action to spend dust from user balance
 * For future dust shop features
 */
export async function spendDustServer(amount: number): Promise<DustOperationResult> {
  if (amount <= 0) {
    return { success: false, message: "Amount must be positive" }
  }

  try {
    const authData = await getAuthenticatedUser()
    if (!authData) {
      return { success: false, message: "Unauthorized" }
    }

    const { user, supabaseAdmin } = authData
    
    // Get current dust balance
    const { data: profile, error: fetchError } = await supabaseAdmin
      .from('user_dust')
      .select('dust')
      .eq('id', user.id)
      .single()

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('[spendDustServer] Error fetching profile:', fetchError)
      return { success: false, message: "Database error" }
    }

    const currentBalance = profile?.dust || 0

    // Check if user has enough dust
    if (currentBalance < amount) {
      return { 
        success: false, 
        message: `Insufficient dust. Need ${amount}, have ${currentBalance}` 
      }
    }

    const newBalance = currentBalance - amount

    // Update dust balance
    const { error: updateError } = await supabaseAdmin
      .from('user_dust')
      .upsert({ 
        id: user.id, 
        dust: newBalance,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'id'
      })

    if (updateError) {
      console.error('[spendDustServer] Error updating dust:', updateError)
      return { success: false, message: "Failed to update dust balance" }
    }

    console.log(`[spendDustServer] Spent ${amount} dust from user ${user.id}. New balance: ${newBalance}`)
    
    return { 
      success: true, 
      newBalance,
      message: `Spent ${amount} dust`
    }
  } catch (error) {
    console.error('[spendDustServer] Unexpected error:', error)
    return { success: false, message: "Server error" }
  }
}

/**
 * Get current dust balance for user
 */
export async function getDustBalanceServer(): Promise<DustOperationResult> {
  try {
    const authData = await getAuthenticatedUser()
    if (!authData) {
      return { success: false, message: "Unauthorized" }
    }

    const { user, supabaseAdmin } = authData
    
    // Get current dust balance
    const { data: profile, error: fetchError } = await supabaseAdmin
      .from('user_dust')
      .select('dust')
      .eq('id', user.id)
      .single()

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('[getDustBalanceServer] Error fetching profile:', fetchError)
      return { success: false, message: "Database error" }
    }

    const currentBalance = profile?.dust || 0
    
    return { 
      success: true, 
      newBalance: currentBalance,
      message: `Current dust balance: ${currentBalance}`
    }
  } catch (error) {
    console.error('[getDustBalanceServer] Unexpected error:', error)
    return { success: false, message: "Server error" }
  }
}
