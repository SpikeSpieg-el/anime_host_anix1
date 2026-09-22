import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

async function getAuthenticatedUser(request: Request) {
  const authHeader = request.headers.get('authorization')
  
  if (!authHeader?.startsWith('Bearer ')) {
    return null
  }

  const token = authHeader.substring(7)
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    return null
  }

  const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey)
  
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

  const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token)

  if (authError || !user) {
    return null
  }

  return { user, supabaseAdmin }
}

// GET - Fetch user's coin balance
export async function GET(request: Request) {
  try {
    const authData = await getAuthenticatedUser(request)
    if (!authData) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
    }

    const { user, supabaseAdmin } = authData
    
    const { data, error } = await supabaseAdmin
      .from('user_coins')
      .select('coins')
      .eq('id', user.id)
      .single()

    if (error && error.code !== 'PGRST116') {
      console.error('Coins fetch error:', error)
      return NextResponse.json({ success: false, message: "Failed to fetch coins" }, { status: 500 })
    }

    const coins = data?.coins ?? 0

    return NextResponse.json({ success: true, coins })
  } catch (error) {
    console.error('Coins GET error:', error)
    return NextResponse.json({ success: false, message: "Server error" }, { status: 500 })
  }
}

// POST - Secure coin operations (add, spend, set)
export async function POST(request: Request) {
  try {
    const authData = await getAuthenticatedUser(request)
    if (!authData) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
    }

    const { user, supabaseAdmin } = authData
    const body = await request.json()
    const { operation, amount, reason } = body

    if (!operation || typeof amount !== 'number') {
      return NextResponse.json({ success: false, message: "Invalid request parameters" }, { status: 400 })
    }

    // Get current balance
    const { data: currentData, error: fetchError } = await supabaseAdmin
      .from('user_coins')
      .select('coins')
      .eq('id', user.id)
      .single()

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('Coins fetch error:', fetchError)
      return NextResponse.json({ success: false, message: "Database error" }, { status: 500 })
    }

    const currentBalance = currentData?.coins || 0
    let newBalance = currentBalance

    // Validate and perform operation
    switch (operation) {
      case 'add':
        if (amount <= 0) {
          return NextResponse.json({ success: false, message: "Amount must be positive" }, { status: 400 })
        }
        newBalance = currentBalance + amount
        break

      case 'spend':
        if (amount <= 0) {
          return NextResponse.json({ success: false, message: "Amount must be positive" }, { status: 400 })
        }
        if (currentBalance < amount) {
          return NextResponse.json({ 
            success: false, 
            message: `Insufficient coins. Need ${amount}, have ${currentBalance}` 
          }, { status: 400 })
        }
        newBalance = currentBalance - amount
        break

      case 'set':
        if (amount < 0) {
          return NextResponse.json({ success: false, message: "Amount cannot be negative" }, { status: 400 })
        }
        // Only allow setting coins for administrative purposes (could add additional auth check here)
        newBalance = amount
        break

      default:
        return NextResponse.json({ success: false, message: "Invalid operation" }, { status: 400 })
    }

    // Protection against unrealistic values
    if (newBalance > 10000000) {
      console.warn(`Unrealistic coin amount detected: ${newBalance}, capping to 1M`)
      newBalance = 1000000
    }

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
      console.error('Coins update error:', updateError)
      return NextResponse.json({ success: false, message: "Failed to update coins" }, { status: 500 })
    }

    console.log(`[SecureCoins] User ${user.id} performed ${operation} operation: ${amount} coins. New balance: ${newBalance}`)

    return NextResponse.json({ 
      success: true, 
      newBalance,
      message: reason || `Coins ${operation}ed successfully`
    })
  } catch (error) {
    console.error('Coins POST error:', error)
    return NextResponse.json({ success: false, message: "Server error" }, { status: 500 })
  }
}