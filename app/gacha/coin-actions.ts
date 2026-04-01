"use server"

import { createClient } from '@supabase/supabase-js'
import { headers } from 'next/headers'

interface CoinOperationResult {
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
 * Secure server action to add coins to user balance
 * Only callable from server actions, not directly from client
 */
export async function addCoinsServer(amount: number): Promise<CoinOperationResult> {
  if (amount <= 0) {
    return { success: false, message: "Amount must be positive" }
  }

  try {
    const authData = await getAuthenticatedUser()
    if (!authData) {
      return { success: false, message: "Unauthorized" }
    }

    const { user, supabaseAdmin } = authData
    
    // Get current balance
    const { data: profile, error: fetchError } = await supabaseAdmin
      .from('user_coins')
      .select('coins')
      .eq('id', user.id)
      .single()

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('[addCoinsServer] Error fetching profile:', fetchError)
      return { success: false, message: "Database error" }
    }

    const currentBalance = profile?.coins || 0
    const newBalance = currentBalance + amount

    // Update balance
    const { error: updateError } = await supabaseAdmin
      .from('user_coins')
      .upsert({ 
        id: user.id, 
        coins: newBalance,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'id'
      })

    if (updateError) {
      console.error('[addCoinsServer] Error updating coins:', updateError)
      return { success: false, message: "Failed to update balance" }
    }

    console.log(`[addCoinsServer] Added ${amount} coins to user ${user.id}. New balance: ${newBalance}`)
    
    return { 
      success: true, 
      newBalance,
      message: `Added ${amount} coins`
    }
  } catch (error) {
    console.error('[addCoinsServer] Unexpected error:', error)
    return { success: false, message: "Server error" }
  }
}

/**
 * Secure server action to spend coins from user balance
 * Includes validation to prevent negative balance
 */
export async function spendCoinsServer(amount: number): Promise<CoinOperationResult> {
  if (amount <= 0) {
    return { success: false, message: "Amount must be positive" }
  }

  try {
    const authData = await getAuthenticatedUser()
    if (!authData) {
      return { success: false, message: "Unauthorized" }
    }

    const { user, supabaseAdmin } = authData
    
    // Get current balance
    const { data: profile, error: fetchError } = await supabaseAdmin
      .from('user_coins')
      .select('coins')
      .eq('id', user.id)
      .single()

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('[spendCoinsServer] Error fetching profile:', fetchError)
      return { success: false, message: "Database error" }
    }

    const currentBalance = profile?.coins || 0

    // Check if user has enough coins
    if (currentBalance < amount) {
      return { 
        success: false, 
        message: `Insufficient coins. Need ${amount}, have ${currentBalance}` 
      }
    }

    const newBalance = currentBalance - amount

    // Update balance
    const { error: updateError } = await supabaseAdmin
      .from('user_coins')
      .upsert({ 
        id: user.id, 
        coins: newBalance,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'id'
      })

    if (updateError) {
      console.error('[spendCoinsServer] Error updating coins:', updateError)
      return { success: false, message: "Failed to update balance" }
    }

    console.log(`[spendCoinsServer] Spent ${amount} coins from user ${user.id}. New balance: ${newBalance}`)
    
    return { 
      success: true, 
      newBalance,
      message: `Spent ${amount} coins`
    }
  } catch (error) {
    console.error('[spendCoinsServer] Unexpected error:', error)
    return { success: false, message: "Server error" }
  }
}

/**
 * Secure server action to set coins to specific amount
 * Only for administrative purposes (like fixes or adjustments)
 */
export async function setCoinsServer(amount: number, reason?: string): Promise<CoinOperationResult> {
  if (amount < 0) {
    return { success: false, message: "Amount cannot be negative" }
  }

  try {
    const authData = await getAuthenticatedUser()
    if (!authData) {
      return { success: false, message: "Unauthorized" }
    }

    const { user, supabaseAdmin } = authData

    // Update balance
    const { error: updateError } = await supabaseAdmin
      .from('user_coins')
      .upsert({ 
        id: user.id, 
        coins: amount,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'id'
      })

    if (updateError) {
      console.error('[setCoinsServer] Error setting coins:', updateError)
      return { success: false, message: "Failed to set balance" }
    }

    console.log(`[setCoinsServer] Set coins to ${amount} for user ${user.id}. Reason: ${reason || 'Not specified'}`)
    
    return { 
      success: true, 
      newBalance: amount,
      message: `Balance set to ${amount}`
    }
  } catch (error) {
    console.error('[setCoinsServer] Unexpected error:', error)
    return { success: false, message: "Server error" }
  }
}
