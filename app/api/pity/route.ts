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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { user, supabaseAdmin } = authData

    const { data: pityData, error } = await supabaseAdmin
      .from('user_pity')
      .select('bad_luck_streak, last_rare_roll')
      .eq('id', user.id)
      .single()

    if (error) {
      // If no record exists, create one
      if (error.code === 'PGRST116') {
        const { data: newPity, error: insertError } = await supabaseAdmin
          .from('user_pity')
          .insert({ id: user.id, bad_luck_streak: 0 })
          .select('bad_luck_streak, last_rare_roll')
          .single()

        if (insertError) {
          console.error('[Pity GET] Insert error:', insertError)
          return NextResponse.json({ error: 'Failed to create pity record' }, { status: 500 })
        }

        return NextResponse.json({ pity: newPity })
      }

      console.error('[Pity GET] Database error:', error)
      return NextResponse.json({ error: 'Failed to fetch pity data' }, { status: 500 })
    }

    return NextResponse.json({ pity: pityData })
  } catch (error) {
    console.error('[Pity GET] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const authData = await getAuthenticatedUser(request)
    if (!authData) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { user, supabaseAdmin } = authData

    const body = await request.json()
    const { bad_luck_streak, last_rare_roll } = body

    if (typeof bad_luck_streak !== 'number' || bad_luck_streak < 0) {
      return NextResponse.json({ error: 'Invalid bad_luck_streak value' }, { status: 400 })
    }

    const { data: pityData, error } = await supabaseAdmin
      .from('user_pity')
      .upsert({ 
        id: user.id, 
        bad_luck_streak,
        last_rare_roll: last_rare_roll || null
      })
      .select('bad_luck_streak, last_rare_roll')
      .single()

    if (error) {
      console.error('[Pity POST] Database error:', error)
      return NextResponse.json({ error: 'Failed to update pity data' }, { status: 500 })
    }

    return NextResponse.json({ pity: pityData })
  } catch (error) {
    console.error('[Pity POST] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
