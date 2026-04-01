import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

async function getAuthenticatedUser(request: NextRequest) {
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

export async function GET(request: NextRequest) {
  try {
    const authData = await getAuthenticatedUser(request)
    if (!authData) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
    }

    const { user, supabaseAdmin } = authData
    
    const { data: dustData, error } = await supabaseAdmin
      .from('user_dust')
      .select('dust')
      .eq('id', user.id)
      .single()

    if (error) {
      // If no record exists, create one
      if (error.code === 'PGRST116') {
        const { data: newDust, error: insertError } = await supabaseAdmin
          .from('user_dust')
          .insert({ id: user.id, dust: 0 })
          .select('dust')
          .single()

        if (insertError) {
          console.error('[Dust GET] Insert error:', insertError)
          return NextResponse.json({ success: false, message: 'Failed to create dust record' }, { status: 500 })
        }

        return NextResponse.json({ success: true, dust: newDust.dust })
      }

      console.error('[Dust GET] Database error:', error)
      return NextResponse.json({ success: false, message: 'Failed to fetch dust data' }, { status: 500 })
    }

    return NextResponse.json({ success: true, dust: dustData.dust })
  } catch (error) {
    console.error('[Dust GET] Unexpected error:', error)
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const authData = await getAuthenticatedUser(request)
    if (!authData) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
    }

    const { user, supabaseAdmin } = authData
    const body = await request.json()
    const { operation, amount, dust } = body

    // Support both old format (direct dust set) and new format (operations)
    if (dust !== undefined) {
      // Legacy format - direct dust setting
      if (typeof dust !== 'number' || dust < 0) {
        return NextResponse.json({ success: false, message: 'Invalid dust value' }, { status: 400 })
      }

      const { data: dustData, error } = await supabaseAdmin
        .from('user_dust')
        .upsert({ 
          id: user.id, 
          dust,
          updated_at: new Date().toISOString()
        })
        .select('dust')
        .single()

      if (error) {
        console.error('[Dust POST] Database error:', error)
        return NextResponse.json({ success: false, message: 'Failed to update dust data' }, { status: 500 })
      }

      return NextResponse.json({ success: true, dust: dustData.dust })
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
        
        // Get current dust balance
        const { data: profile, error: fetchError } = await supabaseAdmin
          .from('user_dust')
          .select('dust')
          .eq('id', user.id)
          .single()

        if (fetchError && fetchError.code !== 'PGRST116') {
          console.error('[Dust POST] Error fetching profile:', fetchError)
          return NextResponse.json({ success: false, message: "Database error" }, { status: 500 })
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
          console.error('[Dust POST] Error updating dust:', updateError)
          return NextResponse.json({ success: false, message: "Failed to update dust balance" }, { status: 500 })
        }

        console.log(`[Dust POST] Added ${amount} dust to user ${user.id}. New balance: ${newBalance}`)
        result = { success: true, newBalance, message: `Added ${amount} dust` }
        break

      case 'spend':
        if (amount <= 0) {
          return NextResponse.json({ success: false, message: "Amount must be positive" }, { status: 400 })
        }
        
        // Get current dust balance
        const { data: spendProfile, error: spendFetchError } = await supabaseAdmin
          .from('user_dust')
          .select('dust')
          .eq('id', user.id)
          .single()

        if (spendFetchError && spendFetchError.code !== 'PGRST116') {
          console.error('[Dust POST] Error fetching profile for spend:', spendFetchError)
          return NextResponse.json({ success: false, message: "Database error" }, { status: 500 })
        }

        const currentSpendBalance = spendProfile?.dust || 0

        // Check if user has enough dust
        if (currentSpendBalance < amount) {
          return NextResponse.json({ 
            success: false, 
            message: `Insufficient dust. Need ${amount}, have ${currentSpendBalance}` 
          }, { status: 400 })
        }

        const newSpendBalance = currentSpendBalance - amount

        // Update dust balance
        const { error: spendUpdateError } = await supabaseAdmin
          .from('user_dust')
          .upsert({ 
            id: user.id, 
            dust: newSpendBalance,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'id'
          })

        if (spendUpdateError) {
          console.error('[Dust POST] Error updating dust for spend:', spendUpdateError)
          return NextResponse.json({ success: false, message: "Failed to update dust balance" }, { status: 500 })
        }

        console.log(`[Dust POST] Spent ${amount} dust from user ${user.id}. New balance: ${newSpendBalance}`)
        result = { success: true, newBalance: newSpendBalance, message: `Spent ${amount} dust` }
        break

      default:
        return NextResponse.json({ success: false, message: "Invalid operation" }, { status: 400 })
    }

    return NextResponse.json(result)

  } catch (error) {
    console.error('[Dust POST] Unexpected error:', error)
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 })
  }
}
