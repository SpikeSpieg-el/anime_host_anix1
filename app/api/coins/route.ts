import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('Supabase env vars missing')
      return NextResponse.json(
        { error: 'Server misconfigured: Supabase env vars missing' },
        { status: 500 },
      )
    }

    // Use service role key for admin operations (bypasses RLS)
    const supabase = createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey)

    // Get the authorization header
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      console.warn('No auth header or invalid format')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.substring(7)

    // Verify the JWT token
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      console.error('Auth error:', authError)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's coins
    const { data, error } = await supabase
      .from('user_coins')
      .select('coins')
      .eq('id', user.id)
      .single()

    if (error) {
      console.log('Coins query error:', error.code, error.message)
      
      // PGRST116 = row not found
      if (error.code === 'PGRST116') {
        // User has no coins record, create one with 10000 bonus (1000 base + 9000 registration bonus)
        const { data: newRecord, error: insertError } = await supabase
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
            coins: 10000,
            warning: 'Using default coins due to database error',
            error: insertError.message
          })
        }

        return NextResponse.json({ coins: newRecord.coins })
      }

      // PGRST115 = relation does not exist (table doesn't exist)
      if (error.code === 'PGRST115') {
        console.warn('user_coins table does not exist, returning default coins')
        return NextResponse.json({ coins: 10000, warning: 'Table not found' })
      }

      console.error('Get coins error:', error)
      return NextResponse.json({ error: 'Failed to get coins' }, { status: 500 })
    }

    return NextResponse.json({ coins: data.coins })

  } catch (error) {
    console.error('API GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { error: 'Server misconfigured: Supabase env vars missing' },
        { status: 500 },
      )
    }

    // Use service role key for admin operations (bypasses RLS)
    const supabase = createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey)

    // Get the authorization header
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.substring(7)

    // Verify the JWT token
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { coins, operation } = await request.json()

    if (typeof coins !== 'number') {
      return NextResponse.json({ error: 'Invalid coins value' }, { status: 400 })
    }

    // Update or insert coins
    const { data, error } = await supabase
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
        coins: coins,
        warning: 'Database update failed, coins may not be persisted',
        error: error.message
      })
    }

    return NextResponse.json({ coins: data.coins })

  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
