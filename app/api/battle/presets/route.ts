import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

function getSupabaseUserClient(token: string) {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${token}` 
      }
    }
  })
}

// GET - Получение всех пресетов пользователя (с возможностью фильтра по is_pvp)
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.substring(7)
    const supabase = getSupabaseUserClient(token)

    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    if (userError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const isPvPParam = searchParams.get('isPvP')

    let query = supabase
      .from('deck_presets')
      .select('*')
      .eq('user_id', user.id)
      .order('slot_number', { ascending: true })

    if (isPvPParam !== null) {
      query = query.eq('is_pvp', isPvPParam === 'true')
    }

    const { data: presets, error } = await query

    if (error) {
      console.error('[Presets API] Error fetching presets:', error)
      return NextResponse.json({ error: 'Failed to fetch presets' }, { status: 500 })
    }

    return NextResponse.json({ presets: presets || [] })
  } catch (error: any) {
    console.error('[Presets API] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Сохранение или перезапись пресета в слот
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.substring(7)
    const supabase = getSupabaseUserClient(token)

    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    if (userError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const body = await request.json()
    const { slotNumber, name, cardIds, leaderId, formation, isPvP } = body

    const numericSlot = Number(slotNumber)
    if (!numericSlot || numericSlot < 1 || numericSlot > 6) {
      return NextResponse.json({ error: 'Номер слота должен быть от 1 до 6' }, { status: 400 })
    }

    if (!Array.isArray(cardIds) || cardIds.length === 0) {
      return NextResponse.json({ error: 'Колода не может быть пустой' }, { status: 400 })
    }

    const validFormation = ['aggression', 'defense', 'balance'].includes(formation)
      ? formation
      : 'balance'

    const cleanName = (typeof name === 'string' && name.trim()) 
      ? name.trim().slice(0, 30) 
      : `Пресет ${numericSlot}` 

    const booleanPvP = Boolean(isPvP)

    // Выполняем upsert с гарантированным onConflict
    const { data: preset, error } = await supabase
      .from('deck_presets')
      .upsert(
        {
          user_id: user.id,
          slot_number: numericSlot,
          name: cleanName,
          card_ids: cardIds,
          leader_id: leaderId || null,
          formation: validFormation,
          is_pvp: booleanPvP,
          updated_at: new Date().toISOString()
        },
        {
          onConflict: 'user_id,slot_number,is_pvp'
        }
      )
      .select()
      .single()

    if (error) {
      console.error('[Presets API] Upsert error:', error)
      return NextResponse.json({ error: error.message || 'Ошибка сохранения' }, { status: 500 })
    }

    return NextResponse.json({ preset })
  } catch (error: any) {
    console.error('[Presets API] Unexpected error in POST:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE - Удаление пресета из конкретного слота
export async function DELETE(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.substring(7)
    const supabase = getSupabaseUserClient(token)

    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    if (userError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const slotNumber = searchParams.get('slotNumber')
    const isPvP = searchParams.get('isPvP') === 'true'

    if (!slotNumber) {
      return NextResponse.json({ error: 'slotNumber is required' }, { status: 400 })
    }

    const { error } = await supabase
      .from('deck_presets')
      .delete()
      .eq('user_id', user.id)
      .eq('slot_number', parseInt(slotNumber, 10))
      .eq('is_pvp', isPvP)

    if (error) {
      console.error('[Presets API] Error deleting preset:', error)
      return NextResponse.json({ error: 'Failed to delete preset' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[Presets API] Unexpected error in DELETE:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}