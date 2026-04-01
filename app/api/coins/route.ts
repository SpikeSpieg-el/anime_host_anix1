import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

async function getAuthenticatedUser(request: Request) {
  const authHeader = request.headers.get('authorization')
  
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

export async function GET(request: Request) {
  try {
    const authData = await getAuthenticatedUser(request)
    if (!authData) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
    }

    const { user, supabaseAdmin } = authData
    
    // Get user's coins
    const { data, error } = await supabaseAdmin
      .from('user_coins')
      .select('coins')
      .eq('id', user.id)
      .single()

    if (error) {
      console.error('Coins query error:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
        userId: user.id
      })
      
      // PGRST116 = row not found
      if (error.code === 'PGRST116') {
        // User has no coins record, create one with 10000 bonus (1000 base + 9000 registration bonus)
        const { data: newRecord, error: insertError } = await supabaseAdmin
          .from('user_coins')
          .insert({ id: user.id, coins: 10000 })
          .select('coins')
          .single()

        if (insertError) {
          console.error('Create coins error:', insertError)
          console.error('Insert error details:', {
            code: insertError.code,
            message: insertError.message,
            details: insertError.details,
            hint: insertError.hint,
            userId: user.id
          })
          
          // Fallback: return default coins if database insert fails
          console.warn('Database insert failed, returning default coins as fallback')
          return NextResponse.json({ 
            success: true,
            coins: 10000,
            warning: 'Using default coins due to database error',
            error: insertError.message
          })
        }

        return NextResponse.json({ success: true, coins: newRecord.coins })
      }

      // PGRST115 = relation does not exist (table doesn't exist)
      if (error.code === 'PGRST115') {
        console.warn('user_coins table does not exist, returning default coins')
        return NextResponse.json({ success: true, coins: 10000, warning: 'Table not found' })
      }

      console.error('Get coins error:', error)
      return NextResponse.json({ success: false, message: 'Failed to get coins' }, { status: 500 })
    }

    return NextResponse.json({ success: true, coins: data.coins })

  } catch (error) {
    console.error('API GET error:', error)
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const authData = await getAuthenticatedUser(request)
    if (!authData) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
    }

    const { user, supabaseAdmin } = authData
    const body = await request.json()
    const { operation, amount, coins } = body

    // Support both old format (direct coins set) and new format (operations)
    if (coins !== undefined) {
      // Legacy format - direct coins setting
      if (typeof coins !== 'number') {
        return NextResponse.json({ success: false, message: 'Invalid coins value' }, { status: 400 })
      }

      // Update or insert coins
      const { data, error } = await supabaseAdmin
        .from('user_coins')
        .upsert({ id: user.id, coins, updated_at: new Date().toISOString() })
        .select('coins')
        .single()

      if (error) {
        console.error('Update coins error:', error)
        console.error('Update error details:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
          userId: user.id,
          coins: coins
        })
        
        // Fallback: return the requested coins amount if database update fails
        console.warn('Database update failed, returning requested coins as fallback')
        return NextResponse.json({ 
          success: true,
          coins: coins,
          warning: 'Database update failed, coins may not be persisted',
          error: error.message
        })
      }

      return NextResponse.json({ success: true, coins: data.coins })
    }

    // New format - operations
    if (!operation || typeof amount !== 'number') {
      return NextResponse.json({ success: false, message: "Invalid request" }, { status: 400 })
    }

    let result: any

    switch (operation) {
      case 'add':
        if (amount <= 0) {
          return NextResponse.json({ success: false, message: "Amount must be positive" }, { status: 400 })
        }
        
        // Get current balance
        const { data: profile, error: fetchError } = await supabaseAdmin
          .from('user_coins')
          .select('coins')
          .eq('id', user.id)
          .single()

        if (fetchError && fetchError.code !== 'PGRST116') {
          console.error('[API Coins] Error fetching profile:', fetchError)
          return NextResponse.json({ success: false, message: "Database error" }, { status: 500 })
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
          console.error('[API Coins] Error updating coins:', updateError)
          return NextResponse.json({ success: false, message: "Failed to update balance" }, { status: 500 })
        }

        console.log(`[API Coins] Added ${amount} coins to user ${user.id}. New balance: ${newBalance}`)
        result = { success: true, newBalance, message: `Added ${amount} coins` }
        break

      case 'spend':
        if (amount <= 0) {
          return NextResponse.json({ success: false, message: "Amount must be positive" }, { status: 400 })
        }
        
        // Get current balance
        const { data: spendProfile, error: spendFetchError } = await supabaseAdmin
          .from('user_coins')
          .select('coins')
          .eq('id', user.id)
          .single()

        if (spendFetchError && spendFetchError.code !== 'PGRST116') {
          console.error('[API Coins] Error fetching profile for spend:', spendFetchError)
          return NextResponse.json({ success: false, message: "Database error" }, { status: 500 })
        }

        const currentSpendBalance = spendProfile?.coins || 0

        // Check if user has enough coins
        if (currentSpendBalance < amount) {
          return NextResponse.json({ 
            success: false, 
            message: `Insufficient coins. Need ${amount}, have ${currentSpendBalance}` 
          }, { status: 400 })
        }

        const newSpendBalance = currentSpendBalance - amount

        // Update balance
        const { error: spendUpdateError } = await supabaseAdmin
          .from('user_coins')
          .upsert({ 
            id: user.id, 
            coins: newSpendBalance,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'id'
          })

        if (spendUpdateError) {
          console.error('[API Coins] Error updating coins for spend:', spendUpdateError)
          return NextResponse.json({ success: false, message: "Failed to update balance" }, { status: 500 })
        }

        console.log(`[API Coins] Spent ${amount} coins from user ${user.id}. New balance: ${newSpendBalance}`)
        result = { success: true, newBalance: newSpendBalance, message: `Spent ${amount} coins` }
        break

      default:
        return NextResponse.json({ success: false, message: "Invalid operation" }, { status: 400 })
    }

    return NextResponse.json(result)

  } catch (error) {
    console.error('API POST error:', error)
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 })
  }
}
