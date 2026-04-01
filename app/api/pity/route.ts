import { supabase } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: pityData, error } = await supabase
      .from('user_pity')
      .select('bad_luck_streak, last_rare_roll')
      .eq('id', user.id)
      .single()

    if (error) {
      // If no record exists, create one
      if (error.code === 'PGRST116') {
        const { data: newPity, error: insertError } = await supabase
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
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { bad_luck_streak, last_rare_roll } = body

    if (typeof bad_luck_streak !== 'number' || bad_luck_streak < 0) {
      return NextResponse.json({ error: 'Invalid bad_luck_streak value' }, { status: 400 })
    }

    const { data: pityData, error } = await supabase
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
