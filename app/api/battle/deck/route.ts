import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.substring(7)
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    })

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const { data: deck, error } = await supabase
      .from('user_battle_decks')
      .select('card_ids, leader_id, formation')
      .eq('user_id', user.id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        // No deck found, return default
        return NextResponse.json({
          card_ids: [],
          leader_id: null,
          formation: 'balance'
        })
      }
      throw error
    }

    return NextResponse.json(deck)
  } catch (error) {
    console.error('[API] Error loading battle deck:', error)
    return NextResponse.json({ error: 'Failed to load deck' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.substring(7)
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    })

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const body = await request.json()
    const { card_ids, leader_id, formation } = body

    if (!Array.isArray(card_ids)) {
      return NextResponse.json({ error: 'Invalid card_ids format' }, { status: 400 })
    }

    if (formation && !['aggression', 'defense', 'balance'].includes(formation)) {
      return NextResponse.json({ error: 'Invalid formation' }, { status: 400 })
    }

    const { data: deck, error } = await supabase
      .from('user_battle_decks')
      .upsert({
        user_id: user.id,
        card_ids,
        leader_id: leader_id || null,
        formation: formation || 'balance'
      }, {
        onConflict: 'user_id'
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json(deck)
  } catch (error) {
    console.error('[API] Error saving battle deck:', error)
    return NextResponse.json({ error: 'Failed to save deck' }, { status: 500 })
  }
}
