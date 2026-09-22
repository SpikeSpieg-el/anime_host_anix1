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

// GET - Fetch user's account stats
export async function GET(request: Request) {
  try {
    const authData = await getAuthenticatedUser(request)
    if (!authData) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
    }

    const { user, supabaseAdmin } = authData
    
    const { data, error } = await supabaseAdmin
      .from('account_stats')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (error && error.code !== 'PGRST116') {
      console.error('Account stats fetch error:', error)
      return NextResponse.json({ success: false, message: "Failed to fetch account stats" }, { status: 500 })
    }

    if (!data) {
      // Return default stats if none exist
      return NextResponse.json({ 
        success: true, 
        stats: {
          total_sessions: 0,
          total_time_ms: 0,
          watch_time_ms: 0,
          last_visit_at: null,
          first_visit_at: null,
          page_views: 0,
          watch_events: 0,
          gacha_rolls: 0,
          battles_started: 0,
          bookmarks_added: 0,
          market_actions: 0,
          searches: 0,
          avg_session_ms: 0,
          last_updated_at: null
        }
      })
    }

    return NextResponse.json({ success: true, stats: data })
  } catch (error) {
    console.error('Account stats GET error:', error)
    return NextResponse.json({ success: false, message: "Server error" }, { status: 500 })
  }
}

// PATCH - Update account stats (increment specific counters)
export async function PATCH(request: Request) {
  try {
    const authData = await getAuthenticatedUser(request)
    if (!authData) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
    }

    const { user, supabaseAdmin } = authData
    const body = await request.json()
    const { increments } = body

    if (!increments || typeof increments !== 'object') {
      return NextResponse.json({ success: false, message: "Invalid increments data" }, { status: 400 })
    }

    // Validate and sanitize increments
    const validFields = [
      'total_sessions', 'total_time_ms', 'page_views', 'watch_events',
      'watch_time_ms', 'gacha_rolls', 'battles_started', 'bookmarks_added',
      'market_actions', 'searches'
    ]

    const updateData: any = {
      last_updated_at: new Date().toISOString()
    }

    for (const [key, value] of Object.entries(increments)) {
      if (validFields.includes(key) && typeof value === 'number') {
        // Convert camelCase to snake_case for DB
        const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase()
        updateData[dbKey] = value
      }
    }

    // First, get current stats
    const { data: currentStats, error: fetchError } = await supabaseAdmin
      .from('account_stats')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('Account stats fetch error:', fetchError)
      return NextResponse.json({ success: false, message: "Failed to fetch current stats" }, { status: 500 })
    }

    // Calculate new values by incrementing current values
    if (currentStats) {
      for (const [key, value] of Object.entries(updateData)) {
        if (key !== 'last_updated_at' && typeof currentStats[key] === 'number') {
          updateData[key] = currentStats[key] + (value as number)
        }
      }
    }

    // Add user_id if creating new record
    updateData.user_id = user.id

    const { error: upsertError } = await supabaseAdmin
      .from('account_stats')
      .upsert(updateData, { onConflict: 'user_id' })

    if (upsertError) {
      console.error('Account stats update error:', upsertError)
      return NextResponse.json({ success: false, message: "Failed to update account stats" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Account stats PATCH error:', error)
    return NextResponse.json({ success: false, message: "Server error" }, { status: 500 })
  }
}