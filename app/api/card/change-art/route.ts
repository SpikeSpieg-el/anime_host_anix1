import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const ART_CHANGE_COST = 50 // Пыль за смену арта

async function getAuthenticatedUser(request: NextRequest) {
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

export async function POST(request: NextRequest) {
  try {
    const authData = await getAuthenticatedUser(request)
    if (!authData) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
    }

    const { user, supabaseAdmin } = authData
    const body = await request.json()
    const { uniqueId, newImageUrl, newOriginalUrl } = body

    if (!uniqueId || !newImageUrl || !newOriginalUrl) {
      return NextResponse.json({ success: false, message: "Invalid request" }, { status: 400 })
    }

    // Проверяем баланс пыли
    const { data: dustData, error: dustError } = await supabaseAdmin
      .from('user_dust')
      .select('dust')
      .eq('id', user.id)
      .single()

    if (dustError && dustError.code !== 'PGRST116') {
      console.error('[Art Change] Error fetching dust:', dustError)
      return NextResponse.json({ success: false, message: "Database error" }, { status: 500 })
    }

    const currentDust = dustData?.dust || 0

    if (currentDust < ART_CHANGE_COST) {
      return NextResponse.json({ 
        success: false, 
        message: `Insufficient dust. Need ${ART_CHANGE_COST}, have ${currentDust}`,
        need: ART_CHANGE_COST,
        have: currentDust
      }, { status: 400 })
    }

    // Проверяем, что карта принадлежит пользователю
    const { data: card, error: cardError } = await supabaseAdmin
      .from('user_cards')
      .select('id, user_id')
      .eq('unique_id', uniqueId)
      .single()

    if (cardError || card.user_id !== user.id) {
      return NextResponse.json({ success: false, message: "Card not found or not owned" }, { status: 404 })
    }

    // Списываем пыль
    const newDustBalance = currentDust - ART_CHANGE_COST
    const { error: updateDustError } = await supabaseAdmin
      .from('user_dust')
      .upsert({ 
        id: user.id, 
        dust: newDustBalance,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'id'
      })

    if (updateDustError) {
      console.error('[Art Change] Error updating dust:', updateDustError)
      return NextResponse.json({ success: false, message: "Failed to update dust" }, { status: 500 })
    }

    // Обновляем арт карты
    const { error: updateCardError } = await supabaseAdmin
      .from('user_cards')
      .update({
        image_url: newImageUrl,
        original_url: newOriginalUrl,
      })
      .eq('unique_id', uniqueId)

    if (updateCardError) {
      console.error('[Art Change] Error updating card:', updateCardError)
      // Возвращаем пыль в случае ошибки
      await supabaseAdmin
        .from('user_dust')
        .upsert({ 
          id: user.id, 
          dust: currentDust,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'id'
        })
      return NextResponse.json({ success: false, message: "Failed to update card art" }, { status: 500 })
    }

    console.log(`[Art Change] User ${user.id} changed art for card ${uniqueId}. Spent ${ART_CHANGE_COST} dust. New balance: ${newDustBalance}`)

    return NextResponse.json({ 
      success: true, 
      newDustBalance,
      message: `Art changed successfully. Spent ${ART_CHANGE_COST} dust` 
    })

  } catch (error) {
    console.error('[Art Change] Unexpected error:', error)
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 })
  }
}
